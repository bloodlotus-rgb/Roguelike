import type { DispersalWorld } from './dispersal-world.ts';
import { channelLimit } from './transport.ts';
import { planChemicalTransport } from './chemical-transport.ts';

export type MatterQ = number;
export type EnergyQ = number;
export interface OrganicStock {
  readonly matter: MatterQ;
  readonly chemicalEnergy: EnergyQ;
}
export interface ChemicalInventory {
  readonly detritus: OrganicStock;
  readonly mineralMatter: MatterQ;
  readonly water: number;
}
export interface ChemicalPort {
  connector: string;
  fromRegion: string;
  toRegion: string;
}
export interface ChemicalSupply {
  id: string;
  origin: string;
  port: ChemicalPort;
  perLot: ChemicalInventory;
  rate: number;
  periodHours: number;
  activeHours: number;
  quotaLots: number;
}
export interface ChemicalState {
  topology?: string;
  tick: number;
  inventory: ReadonlyMap<number, ChemicalInventory>;
  heat: ReadonlyMap<number, EnergyQ>;
  lotsUsed: ReadonlyMap<string, number>;
}
interface Transaction {
  transactionId: string;
  tick: number;
  process: string;
}
export type ChemicalTransfer = Transaction & {
  kind: 'transfer'; fromHabitat: number; toHabitat: number; connector: string; cargo: ChemicalInventory;
};
export type ChemicalPosting = ChemicalTransfer | Transaction & (
  | { kind: 'source'; supply: string; lots: number }
  | { kind: 'export'; port: ChemicalPort; destination: string; cargo: ChemicalInventory }
  | { kind: 'conversion'; habitat: number; debit: ChemicalInventory; credit: ChemicalInventory; heat: EnergyQ }
);
interface CutFlow {
  transactionId: string;
  kind: 'source' | 'export';
  port: ChemicalPort;
  counterparty: string;
  cargo: ChemicalInventory;
}

function quantum(n: number): bigint {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid chemical quantum');
  return BigInt(n);
}

function checked(n: bigint): number {
  const value = Number(n);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Chemical account outside safe range');
  return value;
}

function bins(stock: ChemicalInventory) {
  const m = quantum(stock.detritus.matter), e = quantum(stock.detritus.chemicalEnergy);
  if (!m && e) throw new Error('Chemical energy requires organic matter');
  return [m, e, quantum(stock.mineralMatter), quantum(stock.water)] as const;
}

function pack(m: bigint, e: bigint, mineral: bigint, water: bigint): ChemicalInventory {
  const result = { detritus: { matter: checked(m), chemicalEnergy: checked(e) },
    mineralMatter: checked(mineral), water: checked(water) };
  bins(result);
  return result;
}

const empty = pack(0n, 0n, 0n, 0n);
type Total = { matter: bigint; chemicalEnergy: bigint; water: bigint };

function total(stock: ChemicalInventory): Total {
  const [m, e, n, w] = bins(stock);
  return { matter: m + n, chemicalEnergy: e, water: w };
}

const zero = total(empty);

function add(a: Total, b: Total): Total {
  return { matter: a.matter + b.matter, chemicalEnergy: a.chemicalEnergy + b.chemicalEnergy, water: a.water + b.water };
}

function balance(open: Total, close: Total, imports: Total, exports: Total, heat: bigint) {
  const left = add(open, imports), right = add(close, exports);
  if (left.matter !== right.matter || left.water !== right.water || left.chemicalEnergy !== right.chemicalEnergy + heat) {
    throw new Error('Unbalanced chemical ledger');
  }
}

function change(stock: ChemicalInventory, debit: ChemicalInventory, credit: ChemicalInventory) {
  const [m, e, n, w] = bins(stock), [dm, de, dn, dw] = bins(debit), [cm, ce, cn, cw] = bins(credit);
  if (dm > m || de > e || dn > n || dw > w) throw new Error('Chemical account overdraw');
  if (m === dm && e !== de) throw new Error('Debit leaves chemical energy without a carrier');
  return pack(m - dm + cm, e - de + ce, n - dn + cn, w - dw + cw);
}

function requireIdentifier(value: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing chemical ledger identifier');
}

function habitat(world: DispersalWorld, id: number) {
  if (!Number.isSafeInteger(id) || !world.graph.habitats[id]) throw new Error('Unknown chemical habitat');
}

function route(world: DispersalWorld, port: ChemicalPort, stock: ChemicalInventory, dormant = false) {
  const { graph, ports } = world;
  const ends = ports.get(port.connector);
  const from = graph.regionToHabitat.get(port.fromRegion), to = graph.regionToHabitat.get(port.toRegion);
  if (!ends || from === undefined || to === undefined || from === to ||
      !((ends[0] === port.fromRegion && ends[1] === port.toRegion) ||
        (ends[1] === port.fromRegion && ends[0] === port.toRegion))) {
    throw new Error('Invalid chemical port');
  }
  const cut = graph.incident[from].map(i => graph.boundaries[i]).find(c => c.id === port.connector);
  const effective = dormant && cut && (cut.state === 'closed' || cut.state === 'blocked')
    ? { ...cut, state: 'flooded' as const } : cut;
  if (!effective || !cut || !((cut.from === from && cut.to === to) || (cut.from === to && cut.to === from)) ||
      (stock.water && !channelLimit(graph, effective, from, 'water')) ||
      (stock.mineralMatter && !channelLimit(graph, effective, from, 'nutrients')) ||
      (stock.detritus.matter && !channelLimit(graph, effective, from, 'detritus'))) {
    throw new Error('Chemical cargo incompatible with cut or direction');
  }
  // The external account is metered at the upstream-side port (or the
  // selected donor port for a two-way cut). The far habitat gets no credit.
  return from;
}

function cargoFor(supply: ChemicalSupply, lots: number) {
  const [m, e, n, w] = bins(supply.perLot), count = quantum(lots);
  return pack(m * count, e * count, n * count, w * count);
}

export function declareChemicalSupply(world: DispersalWorld, supply: ChemicalSupply, dormant = false) {
  requireIdentifier(supply.id);
  requireIdentifier(supply.origin);
  if (!quantum(supply.rate) || !quantum(supply.quotaLots) ||
      !quantum(supply.activeHours) || quantum(supply.activeHours) > quantum(supply.periodHours)) {
    throw new Error('Invalid chemical supply schedule or quota');
  }
  const load = total(supply.perLot);
  if (!load.matter && !load.water) throw new Error('Empty chemical lot');
  cargoFor(supply, Math.min(supply.rate, supply.quotaLots));
  route(world, supply.port, supply.perLot, dormant);
  return supply;
}

function nextLots(supply: ChemicalSupply, before: ChemicalState) {
  const used = before.lotsUsed.get(supply.id) ?? 0;
  const hours = quantum(before.tick), period = BigInt(supply.periodHours), active = BigInt(supply.activeHours);
  const tail = hours % period;
  const eligible = hours / period * active + (tail < active ? tail : active);
  if (quantum(used) > BigInt(supply.quotaLots) || BigInt(used) > eligible * BigInt(supply.rate)) {
    throw new Error('Invalid chemical supply meter');
  }
  return tail < active ? Math.min(supply.rate, supply.quotaLots - used) : 0;
}

export function chemicalDelivery(world: DispersalWorld, supply: ChemicalSupply, before: ChemicalState,
  transactionId: string): ChemicalPosting | undefined {
  declareChemicalSupply(world, supply);
  requireIdentifier(transactionId);
  const tick = checked(quantum(before.tick) + 1n), lots = nextLots(supply, before);
  if (lots) return { kind: 'source', tick, transactionId, process: 'delivery', supply: supply.id, lots };
}

export function validateChemicalState(world: DispersalWorld, declarations: readonly ChemicalSupply[], before: ChemicalState) {
  quantum(before.tick);
  if (before.topology !== world.graph.signature && (before.topology !== undefined || before.tick !== 0)) {
    throw new Error('Wrong chemical geometry epoch');
  }
  const supplies = new Map<string, ChemicalSupply>();
  for (const source of declarations) {
    declareChemicalSupply(world, source, true);
    if (supplies.has(source.id)) throw new Error('Duplicate chemical supply');
    supplies.set(source.id, source);
  }
  for (const [id, stock] of before.inventory) {
    habitat(world, id);
    bins(stock);
  }
  for (const [id, value] of before.heat) {
    habitat(world, id);
    quantum(value);
  }
  for (const id of before.lotsUsed.keys()) {
    const source = supplies.get(id);
    if (!source) throw new Error('Undeclared chemical supply meter');
    nextLots(source, before);
  }
  return supplies;
}

export function applyChemicalHour(world: DispersalWorld, declarations: readonly ChemicalSupply[],
  before: ChemicalState, postings: readonly ChemicalPosting[]) {
  const supplies = validateChemicalState(world, declarations, before);
  const tick = checked(quantum(before.tick) + 1n);
  const inventory = new Map(before.inventory), heat = new Map(before.heat), lotsUsed = new Map(before.lotsUsed);
  const transfers = postings.filter((entry): entry is ChemicalTransfer => entry.kind === 'transfer');
  const internalIn = new Map<number, Total>(), internalOut = new Map<number, Total>();
  if (transfers.length) {
    const planned = planChemicalTransport(world, { ...before, topology: world.graph.signature });
    const key = (t: ChemicalTransfer) => JSON.stringify([t.transactionId,t.tick,t.process,t.connector,
      t.fromHabitat,t.toHabitat,...bins(t.cargo).map(Number)]);
    if (planned.length !== transfers.length || planned.some((t,i) => key(t) !== key(transfers[i])) ||
        transfers.some((t,i) => postings[i] !== t)) throw new Error('Transfer batch differs from physical opening plan');
    for (const {fromHabitat, cargo} of transfers) {
      inventory.set(fromHabitat, change(inventory.get(fromHabitat) ?? empty, cargo, empty));
      internalOut.set(fromHabitat, add(internalOut.get(fromHabitat) ?? zero, total(cargo)));
    }
    for (const {toHabitat, cargo} of transfers) {
      inventory.set(toHabitat, change(inventory.get(toHabitat) ?? empty, empty, cargo));
      internalIn.set(toHabitat, add(internalIn.get(toHabitat) ?? zero, total(cargo)));
    }
  }
  const inputs = new Map<number, Total>(), outputs = new Map<number, Total>();
  const cutFlows: CutFlow[] = [];
  const seen = new Set<string>(), delivered = new Set<string>();
  for (const entry of postings) {
    requireIdentifier(entry.transactionId);
    requireIdentifier(entry.process);
    if (entry.tick !== tick || seen.has(entry.transactionId)) throw new Error('Wrong hour or duplicate chemical transaction');
    seen.add(entry.transactionId);
    switch (entry.kind) {
      case 'transfer': break;
      case 'source': {
        const source = supplies.get(entry.supply);
        if (!source || delivered.has(source.id) || !quantum(entry.lots) || entry.lots !== nextLots(source, before)) {
          throw new Error('Invalid or unscheduled chemical delivery');
        }
        const cargo = cargoFor(source, entry.lots), id = route(world, source.port, cargo);
        inventory.set(id, change(inventory.get(id) ?? empty, empty, cargo));
        inputs.set(id, add(inputs.get(id) ?? zero, total(cargo)));
        lotsUsed.set(source.id, (lotsUsed.get(source.id) ?? 0) + entry.lots);
        delivered.add(source.id);
        cutFlows.push({ kind: 'source', transactionId: entry.transactionId, port: source.port, counterparty: source.origin, cargo });
        break;
      }
      case 'export': {
        requireIdentifier(entry.destination);
        const cargo = total(entry.cargo), id = route(world, entry.port, entry.cargo);
        if (!cargo.matter && !cargo.water) throw new Error('Empty chemical export');
        inventory.set(id, change(inventory.get(id) ?? empty, entry.cargo, empty));
        outputs.set(id, add(outputs.get(id) ?? zero, cargo));
        cutFlows.push({ kind: 'export', transactionId: entry.transactionId, port: entry.port,
          counterparty: entry.destination, cargo: entry.cargo });
        break;
      }
      case 'conversion': {
        const { habitat: id, debit, credit } = entry;
        habitat(world, id);
        const delta = quantum(entry.heat);
        balance(total(debit), total(credit), zero, zero, delta);
        inventory.set(id, change(inventory.get(id) ?? empty, debit, credit));
        heat.set(id, checked(quantum(heat.get(id) ?? 0) + delta));
        break;
      }
      default: throw new Error('Unknown chemical transaction kind');
    }
  }

  let open = zero, close = zero, imported = zero, exported = zero, dissipated = 0n;
  const byHabitat = new Map<number, { imported: Total; exported: Total; dissipated: bigint }>();
  const ids = new Set([...inventory.keys(), ...heat.keys()]);
  for (const id of [...ids].sort((a, b) => a - b)) {
    const start = total(before.inventory.get(id) ?? empty), end = total(inventory.get(id) ?? empty);
    const input = inputs.get(id) ?? zero, output = outputs.get(id) ?? zero;
    const delta = quantum(heat.get(id) ?? 0) - quantum(before.heat.get(id) ?? 0);
    balance(start, end, add(input, internalIn.get(id) ?? zero), add(output, internalOut.get(id) ?? zero), delta);
    byHabitat.set(id, { imported: input, exported: output, dissipated: delta });
    open = add(open, start);
    close = add(close, end);
    imported = add(imported, input);
    exported = add(exported, output);
    dissipated += delta;
  }
  balance(open, close, imported, exported, dissipated);
  const state: ChemicalState = { topology: world.graph.signature, tick, inventory, heat, lotsUsed };
  return { state, byHabitat, cutFlows, transfers, internalIn, internalOut, imported, exported, dissipated };
}

/** Canonical comparison of fixture state, without a persistence format. */
export function serializeChemicalState(state: ChemicalState): string {
  return JSON.stringify([
    state.tick,
    [...state.inventory].sort(([a], [b]) => a - b).map(([id, stock]) => [id, ...bins(stock).map(Number)]),
    [...state.heat].sort(([a], [b]) => a - b),
    [...state.lotsUsed].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0),
  ]);
}

export function auditChemicalLedger(world: DispersalWorld, declarations: readonly ChemicalSupply[],
  before: ChemicalState, postings: readonly ChemicalPosting[], after: ChemicalState) {
  const report = applyChemicalHour(world, declarations, before, postings);
  if (report.state.topology !== after.topology || serializeChemicalState(report.state) !== serializeChemicalState(after)) throw new Error('Chemical closing state mismatch');
  return report;
}
