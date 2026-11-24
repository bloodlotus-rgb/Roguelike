import { expect, it } from 'vitest';
import { applyChemicalHour, auditChemicalLedger, chemicalDelivery, declareChemicalSupply, serializeChemicalState,
  type ChemicalInventory, type ChemicalPosting, type ChemicalState, type ChemicalSupply } from './chemical-ledger';
import { buildDispersalWorld, indexWorld } from './dispersal-world';
import type { Boundary } from './habitats';

const port = { connector: 'stream', fromRegion: 'upper', toRegion: 'lower' };
function fixture(state: Boundary['state'] = 'open') {
  return indexWorld({
    seed: 'chemical-fixture', signature: 'chemical-fixture/' + state, entrance: 0, barriers: [],
    habitats: [0, 1, 2].map(depthM => ({ zone: 1, depthM, capacity: 36, areaM2: 36, humidity: 1, morphology: [] })),
    regionToHabitat: new Map([['upper', 0], ['lower', 1], ['other', 2]]),
    boundaries: [{ id: 'stream', from: 0, to: 1, kind: 'watercourse', state }],
    incident: [[0], [0], []],
  }, new Map([['stream', ['upper', 'lower']]]), new Map());
}

const stock = (matter = 0, chemicalEnergy = 0, mineralMatter = 0, water = 0): ChemicalInventory =>
  ({ detritus: { matter, chemicalEnergy }, mineralMatter, water });
const state = (inventory: ChemicalState['inventory'] = new Map()): ChemicalState =>
  ({ tick: 0, inventory, heat: new Map(), lotsUsed: new Map() });
const supply: ChemicalSupply = { id: 'basin', origin: 'fixture basin upstream', port, perLot: stock(2, 3, 1, 4),
  rate: 2, periodHours: 2, activeHours: 1, quotaLots: 3 };
const convert = (debit: ChemicalInventory, credit: ChemicalInventory, heat = 0, tick = 1): ChemicalPosting =>
  ({ kind: 'conversion', habitat: 0, transactionId: 'convert', tick, process: 'fixture reaction', debit, credit, heat });
const exportCargo = (id: string, cargo: ChemicalInventory): ChemicalPosting =>
  ({ kind: 'export', port, destination: 'external collector', transactionId: id, tick: 1, process: id, cargo });

it('closes a sealed fixture for dry matter, water and chemistry plus accumulated heat', () => {
  const world = fixture(), before = state(new Map([[0, stock(4, 12, 2, 8)]]));
  const first = [convert(stock(1, 3), stock(1, 2), 1)];
  const after = applyChemicalHour(world, [], before, first).state;
  expect(after.inventory.get(0)).toEqual(stock(4, 11, 2, 8));
  const next = [convert(stock(2, 6), stock(0, 0, 2), 6, 2)];
  const final = applyChemicalHour(world, [], after, next).state;
  const audit = auditChemicalLedger(world, [], after, next, final);
  expect(final.inventory.get(0)).toEqual(stock(2, 5, 4, 8));
  expect(final.heat.get(0)).toBe(7);
  expect(audit.dissipated).toBe(6n);
  expect(audit.imported).toEqual({ matter: 0n, chemicalEnergy: 0n, water: 0n });
  expect(() => applyChemicalHour(world, [], final, [convert(stock(2, 6), stock(0, 0, 2), 6, 3)])).toThrow(/overdraw/);
});

it('reconciles a source, sedimentation, a separate export and heat by habitat and directed cut', () => {
  const world = fixture(), before = state();
  const delivery = chemicalDelivery(world, supply, before, 'initial delivery')!;
  const postings = [delivery, exportCargo('settling', stock(1, 1)), exportCargo('export', stock(1, 2, 1, 2)),
    convert(stock(2, 3), stock(2, 2), 1)];
  const report = applyChemicalHour(world, [supply], before, postings);
  expect(report.state.inventory.get(0)).toEqual(stock(2, 2, 1, 6));
  expect(report.state.inventory.has(1)).toBe(false);
  expect(report.state.heat.get(0)).toBe(1);
  expect(report.imported).toEqual({ matter: 6n, chemicalEnergy: 6n, water: 8n });
  expect(report.exported).toEqual({ matter: 3n, chemicalEnergy: 3n, water: 2n });
  expect(report.byHabitat.get(0)).toEqual({ imported: report.imported, exported: report.exported, dissipated: 1n });
  expect(report.cutFlows.map(flow => [flow.kind, flow.transactionId, flow.port, flow.cargo])).toEqual([
    ['source', 'initial delivery', port, stock(4, 6, 2, 8)],
    ['export', 'settling', port, stock(1, 1)],
    ['export', 'export', port, stock(1, 2, 1, 2)],
  ]);
  const wrong = { ...report.state, inventory: new Map([[1, stock(2, 2, 1, 6)]]) };
  expect(() => auditChemicalLedger(world, [supply], before, postings, wrong)).toThrow(/closing state/);
  expect(auditChemicalLedger(world, [supply], before, postings, report.state)).toEqual(report);
});

it('meters partial and exhausted quotas without implicit deposits and rejects duplicate or off-window deliveries', () => {
  const world = fixture(), before = state();
  const hour = (opening: ChemicalState, ...postings: ChemicalPosting[]) =>
    applyChemicalHour(world, [supply], opening, postings).state;
  expect(hour(before).inventory.size).toBe(0);
  const first = chemicalDelivery(world, supply, before, 'first')!;
  expect(first).toMatchObject({ tick: 1, lots: 2 });
  expect(() => hour(before, first, { ...first, transactionId: 'again' })).toThrow(/delivery/);
  const afterFirst = hour(before, first);
  expect(chemicalDelivery(world, supply, afterFirst, 'too soon')).toBeUndefined();
  expect(() => hour(afterFirst, { ...first, tick: 2 })).toThrow(/unscheduled/);
  const afterSecond = hour(afterFirst);
  const partial = chemicalDelivery(world, supply, afterSecond, 'last')!;
  expect(partial).toMatchObject({ tick: 3, lots: 1 });
  const final = hour(afterSecond, partial);
  expect(final.lotsUsed.get(supply.id)).toBe(3);
  expect(chemicalDelivery(world, supply, hour(final), 'spent')).toBeUndefined();
  expect(() => hour(hour(final), { ...partial, tick: 5 })).toThrow(/delivery/);
});

it.each([
  { port: { ...port, connector: 'missing' } },
  { port: { ...port, fromRegion: 'other' } },
  { port: { ...port, fromRegion: 'lower', toRegion: 'upper' } },
  { origin: '' },
  { periodHours: 0 },
  { activeHours: 3 },
  { rate: 0 },
  { quotaLots: 0 },
  { rate: 1.5 },
  { perLot: stock(0, 1, 10, 10) },
  { perLot: stock(Number.MAX_SAFE_INTEGER) },
])('rejects an invalid supply declaration %j', override => {
  expect(() => declareChemicalSupply(fixture(), { ...supply, ...override })).toThrow();
});

it.each(['blocked', 'closed'] as const)('rejects supplies through a %s cut', barrier => {
  expect(() => declareChemicalSupply(fixture(barrier), supply)).toThrow(/cut or direction/);
});

it('accepts water and mineral-only loads without crediting chemical energy', () => {
  const world = fixture(), before = state(), mineralSupply = { ...supply, perLot: stock(0, 0, 1, 2) };
  const delivery = chemicalDelivery(world, mineralSupply, before, 'mineral')!;
  const final = applyChemicalHour(world, [mineralSupply], before, [delivery]).state;
  expect(final.inventory.get(0)).toEqual(stock(0, 0, 2, 4));
});

it.each([
  ['negative energy', [convert(stock(1, -1), stock(1))]],
  ['fractional matter', [convert(stock(0.5), stock(0.5))]],
  ['unsafe amount', [convert(stock(Number.MAX_SAFE_INTEGER + 1), stock())]],
  ['energy without a carrier', [convert(stock(0, 1), stock(), 1)]],
  ['matter created without a source', [convert(stock(), stock(1))]],
  ['energy created without a source', [convert(stock(1), stock(1, 1))]],
  ['water created in a conversion', [convert(stock(), stock(0, 0, 0, 1))]],
  ['energy missing from the output', [convert(stock(1, 2), stock(1))]],
  ['unknown habitat', [{ ...convert(stock(1), stock(1)), habitat: 99 } as ChemicalPosting]],
  ['incomplete', [{ ...convert(stock(1), stock(1)), credit: undefined } as unknown as ChemicalPosting]],
  ['sediment leaving uncarried energy', [exportCargo('settling', stock(2, 1))]],
  ['duplicate transaction', [convert(stock(1, 3), stock(1, 2), 1), convert(stock(1, 3), stock(1, 2), 1)]],
  ['double debit', [exportCargo('out-A', stock(2, 4)), exportCargo('out-B', stock(2, 4))]],
] as const)('rejects %s and leaves opening state untouched', (_, postings) => {
  const before = state(new Map([[0, stock(2, 4, 3, 5)]]));
  const original = serializeChemicalState(before);
  expect(() => applyChemicalHour(fixture(), [], before, postings)).toThrow();
  expect(serializeChemicalState(before)).toBe(original);
});

it('checks aggregate range exactly and rejects a closing stock overflow', () => {
  const world = fixture(), max = Number.MAX_SAFE_INTEGER;
  const before = state(new Map([[0, stock(max, 0, max)], [1, stock(max, max)]]));
  expect(applyChemicalHour(world, [], before, []).state.inventory.size).toBe(2);
  const delivery = chemicalDelivery(world, supply, before, 'overflow')!;
  expect(() => applyChemicalHour(world, [supply], before, [delivery])).toThrow(/safe range/);
  expect(before.inventory.get(0)).toEqual(stock(max, 0, max));
});

it('replays the same ordered book across different insertion orders and a real generated seed', () => {
  function run(reverse: boolean) {
    const world = buildDispersalWorld('mansion');
    const cut = world.graph.boundaries.find(b => b.kind === 'watercourse' &&
      world.graph.habitats[b.from].depthM < world.graph.habitats[b.to].depthM)!;
    const [fromRegion, toRegion] = world.ports.get(cut.id)!;
    const source = { ...supply, port: { connector: cut.id, fromRegion, toRegion } };
    const initial = [[cut.from, stock(2, 2)], [cut.to, stock(3, 4)]] as const;
    const before = state(new Map(reverse ? [...initial].reverse() : initial));
    const postings = [chemicalDelivery(world, source, before, 'physical entry')!];
    const after = applyChemicalHour(world, [source], before, postings).state;
    auditChemicalLedger(world, [source], before, postings, after);
    return [JSON.stringify(postings), serializeChemicalState(after)];
  }
  expect(run(false)).toEqual(run(true));
}, 20000);
