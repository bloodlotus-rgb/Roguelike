import { createHash } from 'node:crypto';
import { sections } from '../core/spatial.ts';
import { auditAccounts } from './audit.ts';
import { dispersalRules as rules, organismPass, type DispersalWorld } from './dispersal-world.ts';
import { generatorVersion } from './habitats.ts';
import { parameters } from './parameters.ts';
import { projectInventory, type Entry } from './resources.ts';
import { advanceResources, foundColony, metabolize } from './trophic.ts';
import { accounts, biology, cargo, colonyHome, emptyTrophicStock, inlet, matter, natural, trophicSignature, validateScenario,
  type TrophicScenario, type TrophicStock } from './trophic-contract.ts';

export const living = ['fungalBiomass', 'detritivores', 'propagules'] as const;
type Living = typeof living[number];
type Tissue = Record<Living, number>;
const bare = (): Tissue => ({ fungalBiomass: 0, detritivores: 0, propagules: 0 });
export const metaAccounts = [...accounts, 'propagules'] as const;
export const metaMatter = [...matter, 'propagules'] as const;
export type MetaStock = TrophicStock & { propagules: number };
export type MetaPosting = Entry<typeof metaAccounts[number]>;
export const emptyMeta = (): MetaStock => ({ ...emptyTrophicStock(), propagules: 0 });
const biomass = (s: Tissue) => s.fungalBiomass + s.detritivores + s.propagules;
export interface Deposit { region: string; connector: string; origin: string; stock: TrophicStock }
export interface MetaState {
  setup: TrophicScenario; tick: number; lotsUsed: number; topology: string; enabled: boolean;
  deposits: readonly Deposit[];
  stocks: Map<number, MetaStock>;
  // Spatial decomposition of the three living accounts. Never added a second time to totals.
  anchors: Map<string, Tissue>;
}
export function auditMetaTransfers(world: DispersalWorld, after: MetaState['stocks'], ledger: readonly MetaPosting[]) {
  const crossed = new Set<string>();
  for (const e of ledger) {
    if (e.kind !== 'transfer' || (e.resource !== 'propagules' && e.resource !== 'detritivores' && e.resource !== 'fungalBiomass')) continue;
    if (e.resource === 'fungalBiomass' || e.from === null || e.to === null || !e.connector || e.amount !== 1) {
      throw new Error('Invalid organism transfer');
    }
    const graph = world.graph;
    const index = graph.incident[e.from]?.find(i => graph.boundaries[i].id === e.connector);
    const cut = index === undefined ? undefined : graph.boundaries[index];
    const key = e.resource + '/' + e.connector;
    // Water has its final hourly value when dispersal starts.
    if (!cut || crossed.has(key) || (e.from === cut.from ? cut.to : cut.from) !== e.to ||
        !organismPass(graph,cut,e.from,e.resource,(after.get(e.from)?.water ?? 0) > 0)) {
      throw new Error('Incompatible organism crossing: ' + e.connector);
    }
    crossed.add(key);
  }
}

export function auditMeta(world: DispersalWorld, before: MetaState['stocks'], after: MetaState['stocks'], ledger: MetaPosting[]) {
  auditMetaTransfers(world, after, ledger);
  return auditAccounts(before, after, ledger, metaAccounts, emptyMeta, metaMatter);
}

function validateDeposits(world: DispersalWorld, setup: TrophicScenario, deposits: readonly Deposit[]) {
  validateScenario(world.graph, setup);
  let budget = accounts.reduce((sum, r) => sum + setup.founders[r], 0);
  const s = setup.source;
  if (s) budget += s.quota * (cargo[s.kind].energy + cargo[s.kind].detritus + cargo[s.kind].water);
  for (const d of deposits) {
    if (typeof d.origin !== 'string' || !d.origin.trim() || !world.ports.get(d.connector)?.includes(d.region) ||
      !world.graph.regionToHabitat.has(d.region) || !accounts.every(r => natural(d.stock[r]))) throw new Error('Invalid founding provenance');
    for (const r of accounts) budget += d.stock[r];
  }
  if (budget > parameters.inventoryLimit) throw new Error('External budget exceeds scenario limit');
}

export function foundMeta(world: DispersalWorld, setup: TrophicScenario, deposits: readonly Deposit[] = [], enabled = true) {
  validateDeposits(world, setup, deposits);
  const first = foundColony(world.graph, setup);
  const ledger: MetaPosting[] = [...first.ledger];
  const state: MetaState = { ...first.state, deposits: Object.freeze(deposits.map(d => Object.freeze({ ...d, stock: Object.freeze({ ...d.stock }) }))),
    stocks: new Map(), anchors: new Map(), enabled };
  const cut = inlet(world.graph, setup);
  const home = colonyHome(world.graph, setup);
  const firstRegion = world.ports.get(cut.id)![home === cut.from ? 0 : 1];
  function deposit(region: string, stock: TrophicStock) {
    const id = world.graph.regionToHabitat.get(region)!;
    const total = state.stocks.get(id) ?? emptyMeta();
    for (const r of accounts) total[r] += stock[r];
    if (accounts.some(r => total[r])) state.stocks.set(id, total);
    const tissue = state.anchors.get(region) ?? bare();
    tissue.detritivores += stock.detritivores;
    tissue.fungalBiomass += stock.fungalBiomass;
    if (biomass(tissue) > world.capacities.get(region)!) throw new Error('Founding region over capacity');
    if (biomass(tissue)) state.anchors.set(region, tissue);
  }
  deposit(firstRegion, setup.founders);
  for (const d of state.deposits) {
    const site = world.graph.regionToHabitat.get(d.region)!;
    const route = world.graph.incident[site].map(i => world.graph.boundaries[i]).find(c => c.id === d.connector);
    if (!route || route.state === 'closed' || route.state === 'blocked' ||
        (sections[route.kind].downOnly && route.to !== site)) throw new Error('Founding access blocked or directed away');
    deposit(d.region, d.stock);
    const id = world.graph.regionToHabitat.get(d.region)!;
    for (const r of accounts) if (d.stock[r]) ledger.push({ kind: 'source', process: 'founding-deposit/' + d.origin, from: null,
      to: id, resource: r, amount: d.stock[r], connector: d.connector });
  }
  return { state, ledger };
}

// The fine position matters at a later split. Space inside a mixed habitat is contiguous
// by construction; use its physical port first and overflow only within the same habitat.
function locate(world: DispersalWorld, anchors: MetaState['anchors'], id: number, r: Living, delta: number, preferred?: string, occupied?: ReadonlyMap<string, number>) {
  const members = world.members[id];
  const regions = preferred ? [preferred, ...members.filter(m => m !== preferred)] : members;
  let remaining = Math.abs(delta);
  let first: string | undefined;
  for (const region of regions) {
    const t = anchors.get(region) ?? bare();
    const amount = Math.min(remaining, delta < 0 ? t[r] : world.capacities.get(region)! - biomass(t) - (occupied?.get(region) ?? 0));
    if (!amount) continue;
    first ??= region;
    t[r] += delta < 0 ? -amount : amount;
    if (biomass(t)) anchors.set(region, t);
    else anchors.delete(region);
    remaining -= amount;
    if (!remaining) return first;
  }
  throw new Error('Fine stock or capacity mismatch');
}

export interface CompanionPhase {
  occupied: Map<string, number>;
  afterMetabolism(stocks: MetaState['stocks'], anchors: ReadonlyMap<string,Tissue>, offset: number, debit: (id: number, account: Living, amount: number) => void): void;
}

export function stepMeta(world: DispersalWorld, previous: MetaState, companion?: CompanionPhase) {
  const graph = world.graph, tick = previous.tick + 1;
  if (previous.topology !== graph.signature || !natural(tick)) throw new Error('Invalid structural epoch or clock');
  const { stocks, lotsUsed, input } = advanceResources(graph, previous, emptyMeta);
  const ledger: MetaPosting[] = input;
  const anchors = new Map<string, Tissue>();
  for (const [region, t] of previous.anchors) anchors.set(region, { ...t });
  const occupied = new Map<number, number>();
  const updateOccupied = () => {
    occupied.clear();
    for (const [region, mass] of companion?.occupied ?? []) {
      const id = graph.regionToHabitat.get(region)!;
      occupied.set(id, (occupied.get(id) ?? 0) + mass);
    }
  };
  if (companion) updateOccupied();
  const ids = [...stocks.keys()].sort((a,b) => a-b);
  for (const id of ids) {
    const start = ledger.length, stock = stocks.get(id)!;
    metabolize(stock, id, tick, graph.habitats[id].capacity - stock.propagules - (occupied.get(id) ?? 0),
      previous.setup.maintenancePeriod ?? biology.maintenancePeriod, input);
    for (let i = start; i < ledger.length; i++) {
      const e = ledger[i];
      if (e.resource === 'fungalBiomass' || e.resource === 'detritivores') {
        const r = e.resource;
        const parent = world.members[id].find(region => (anchors.get(region)?.[r] ?? 0) > 0);
        locate(world, anchors, id, r, e.to === null ? -e.amount : e.amount, parent, companion?.occupied);
      }
    }
  }

  if (companion) {
    companion.afterMetabolism(stocks, anchors, ledger.length, (id, account, amount) => {
      locate(world, anchors, id, account, -amount);
      stocks.get(id)![account] -= amount;
    });
    updateOccupied();
  }

  function convert(id: number, from: Living, to: 'propagules' | 'fungalBiomass' | 'detritus', process: string) {
    const s = stocks.get(id)!;
    s[from]--;
    const region = locate(world, anchors, id, from, -1);
    s[to]++;
    if (to !== 'detritus') locate(world, anchors, id, to, 1, region);
    ledger.push({ kind: 'conversion', process, from: id, to: null, resource: from, amount: 1 },
      { kind: 'conversion', process, from: null, to: id, resource: to, amount: 1 });
  }
  function spend(id: number, amount: number, process: string) {
    stocks.get(id)!.energy -= amount;
    ledger.push({ kind: 'sink', process, from: id, to: null, resource: 'energy', amount });
  }
  if (previous.enabled && tick % rules.movementPeriod === 0) {
    const arrivals: MetaPosting[] = [];
    const reserved = new Map<number, number>();
    const used = new Set<string>();
    for (const id of ids) {
      const s = stocks.get(id)!;
      if (!biomass(s)) continue;
      for (const r of ['propagules', 'detritivores'] as const) {
        for (const i of graph.incident[id]) {
          const cut = graph.boundaries[i], to = cut.from === id ? cut.to : cut.from;
          const dest = stocks.get(to);
          if (used.has(r + '/' + cut.id) || !organismPass(graph, cut, id, r, s.water > 0) ||
            (dest ? biomass(dest) : 0) + (reserved.get(to) ?? 0) + (occupied.get(to) ?? 0) >= graph.habitats[to].capacity) continue;
          if (r === 'propagules') {
            if (dest?.fungalBiomass || dest?.propagules) continue;
            if (!s.propagules) {
              if (tick % rules.sporePeriod || !s.water || !s.detritus || s.fungalBiomass <= rules.reserveFungus || s.energy < rules.propagationEnergy) continue;
              convert(id, 'fungalBiomass', 'propagules', 'propagule-production');
              spend(id, rules.propagationEnergy, 'propagule-production');
            }
          } else {
            if (!dest?.water || !dest.detritus || s.detritivores <= rules.reserveGrazers ||
              dest.detritivores + 1 >= s.detritivores || s.energy < rules.migrationEnergy) continue;
            spend(id, rules.migrationEnergy, 'migration-cost');
          }
          s[r]--;
          locate(world, anchors, id, r, -1);
          const e: MetaPosting = { kind: 'transfer', process: r === 'propagules' ? 'packet-drift' : 'grazer-migration',
            connector: cut.id, resource: r, amount: 1, from: id, to };
          ledger.push(e);
          arrivals.push(e);
          reserved.set(to, (reserved.get(to) ?? 0) + 1);
          used.add(r + '/' + cut.id);
          break; // One passage per donor and group on this movement hour.
        }
      }
    }
    for (const e of arrivals) {
      const to = e.to!, dest = stocks.get(to) ?? emptyMeta();
      const r = e.resource as 'propagules' | 'detritivores';
      dest[r]++;
      stocks.set(to, dest);
      const ports = world.ports.get(e.connector!)!;
      locate(world, anchors, to, r, 1, graph.regionToHabitat.get(ports[0]) === to ? ports[0] : ports[1], companion?.occupied);
    }
  }
  for (const id of [...stocks.keys()].sort((a,b) => a-b)) {
    const s = stocks.get(id)!;
    if (s.propagules) {
      if (!s.fungalBiomass && s.water && s.detritus && s.energy >= rules.germinationEnergy) {
        convert(id, 'propagules', 'fungalBiomass', 'germination');
        spend(id, rules.germinationEnergy, 'germination');
      } else if (tick % rules.decayPeriod === 0) convert(id, 'propagules', 'detritus', 'packet-decay');
    }
    if (metaAccounts.every(r => !s[r])) stocks.delete(id);
  }
  return { state: { ...previous, stocks, anchors, tick, lotsUsed }, ledger };
}

export function projectMeta(old: DispersalWorld, next: DispersalWorld, state: MetaState): MetaState {
  if (old.graph.signature !== state.topology) throw new Error('Invalid source epoch');
  const mobile = ['water', 'detritus', 'nutrients', 'energy'] as const;
  const mixed = projectInventory(old.graph, next.graph, state.stocks, mobile, () => ({ water: 0, detritus: 0, nutrients: 0, energy: 0 }));
  const stocks = new Map<number, MetaStock>();
  for (const [id, value] of mixed) stocks.set(id, { ...emptyMeta(), ...value });
  for (const [region, tissue] of state.anchors) {
    const id = next.graph.regionToHabitat.get(region);
    if (id === undefined) throw new Error('Missing occupied region');
    const stock = stocks.get(id) ?? emptyMeta();
    for (const r of living) stock[r] += tissue[r];
    stocks.set(id, stock);
  }
  const anchors = new Map<string, Tissue>();
  for (const [region,t] of state.anchors) anchors.set(region, { ...t });
  return { ...state, stocks, anchors, topology: next.graph.signature };
}

function contract(setup: TrophicScenario, deposits: readonly Deposit[], enabled: boolean) {
  return createHash('sha256').update(JSON.stringify([1, trophicSignature(setup), rules, sections, enabled,
    deposits.map(d => [d.region, d.connector, d.origin, accounts.map(r => d.stock[r])])])).digest('hex');
}
function frameDigest(topology: string, rulesHash: string, tick: number, used: number,
  stocks: readonly (readonly [number, MetaStock])[], anchors: readonly (readonly [string, Tissue])[]) {
  return createHash('sha256').update(JSON.stringify([topology, rulesHash, tick, used,
    stocks.map(([id,s]) => [id,...metaAccounts.map(r => s[r])]), anchors.map(([id,t]) => [id,...living.map(r => t[r])])])).digest('hex');
}
export function saveMeta(world: DispersalWorld, state: MetaState) {
  if (world.graph.signature !== state.topology) throw new Error('Invalid structural epoch');
  const checkpoint = { version: 'E1-B2/1', generator: generatorVersion, topology: state.topology, barriers: structuredClone(world.graph.barriers),
    setup: structuredClone(state.setup), enabled: state.enabled, deposits: structuredClone(state.deposits), tick: state.tick, lotsUsed: state.lotsUsed,
    contract: contract(state.setup, state.deposits, state.enabled),
    stocks: [...state.stocks].sort(([a],[b]) => a-b).map(([id,s]) => [id,{ ...s }] as const),
    anchors: [...state.anchors].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([region,t]) => [region,{ ...t }] as const) };
  return { ...checkpoint, integrity: frameDigest(checkpoint.topology,checkpoint.contract,checkpoint.tick,checkpoint.lotsUsed,checkpoint.stocks,checkpoint.anchors) };
}
export function restoreMeta(world: DispersalWorld, data: ReturnType<typeof saveMeta>): MetaState {
  return restoreMetaWithMatter(world, data, 0);
}

/** Reconcile the net matter held by a separately audited companion against the shared budget. */
export function restoreMetaWithMatter(world: DispersalWorld, data: ReturnType<typeof saveMeta>, companionNetMatter: number): MetaState {
  if (data.version !== 'E1-B2/1' || data.generator !== generatorVersion || data.topology !== world.graph.signature ||
    JSON.stringify(data.barriers) !== JSON.stringify(world.graph.barriers) || typeof data.enabled !== 'boolean' ||
    !natural(data.tick) || !natural(data.lotsUsed) || data.contract !== contract(data.setup, data.deposits, data.enabled)) throw new Error('Incompatible checkpoint');
  validateDeposits(world, data.setup, data.deposits);
  const setup = structuredClone(data.setup), deposits = structuredClone(data.deposits);
  const stocks: MetaState['stocks'] = new Map(), anchors: MetaState['anchors'] = new Map(), sums = new Map<number, Tissue>();
  const total = emptyMeta(), start = { ...emptyMeta(), ...setup.founders };
  for (const d of deposits) for (const r of accounts) start[r] += d.stock[r];
  for (const [id,s] of data.stocks) {
    if (!natural(id) || !world.graph.habitats[id] || stocks.has(id) || !metaAccounts.every(r => natural(s[r]))) throw new Error('Invalid stock');
    for (const r of metaAccounts) total[r] += s[r];
    stocks.set(id, { ...s });
  }
  for (const [region,t] of data.anchors) {
    const id = world.graph.regionToHabitat.get(region);
    if (id === undefined || !stocks.has(id) || anchors.has(region) || !living.every(r => natural(t[r])) ||
        !biomass(t) || biomass(t) > world.capacities.get(region)!) throw new Error('Invalid spatial account');
    anchors.set(region, { ...t });
    const sum = sums.get(id) ?? bare();
    for (const r of living) sum[r] += t[r];
    sums.set(id,sum);
  }
  for (const [id,s] of stocks) if (living.some(r => s[r] !== (sums.get(id)?.[r] ?? 0))) throw new Error('Unbalanced spatial account');
  const source = setup.source, lot = source && cargo[source.kind], n = data.lotsUsed;
  const hours = source ? Math.floor(data.tick / source.period) * source.activeHours + Math.min(data.tick % source.period, source.activeHours) : 0;
  if (n > (source?.quota ?? 0) || n / (source?.rate ?? 1) > hours || total.water > start.water + n * (lot?.water ?? 0) ||
      total.energy > start.energy + n * (lot?.energy ?? 0) || metaMatter.reduce((sum,r) => sum + total[r] - start[r], 0) + companionNetMatter !==
      n * ((lot?.detritus ?? 0) - (lot?.settling ?? 0))) throw new Error('Unbalanced external budget');
  if ((!start.detritivores && total.detritivores) || (!start.fungalBiomass && (total.fungalBiomass || total.propagules)) ||
      (!data.enabled && total.propagules)) throw new Error('Living accounts without founders');
  Object.freeze(setup.founders);
  if (setup.source) Object.freeze(setup.source);
  Object.freeze(setup);
  for (const deposit of deposits) { Object.freeze(deposit.stock); Object.freeze(deposit); }
  Object.freeze(deposits);
  if (data.integrity !== frameDigest(data.topology,data.contract,data.tick,n,data.stocks,data.anchors)) throw new Error('Damaged checkpoint');
  return { setup, deposits, stocks, anchors, topology: data.topology, tick: data.tick, lotsUsed: n, enabled: data.enabled };
}
