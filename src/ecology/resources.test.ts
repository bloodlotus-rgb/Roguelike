import { describe, expect, it } from 'vitest';
import { audit } from './audit';
import { type HabitatGraph, type Boundary } from './habitats';
import { channels, conductance, emptyStock, parameters, type Stock, resources } from './parameters';
import { initialState, step, snapshot, restore, totals } from './resources';
import { channelLimit, fluxes } from './transport';

function chain(kind: Boundary['kind'] = 'opening', state: Boundary['state'] = 'open'): HabitatGraph {
  const boundaries: Boundary[] = [0, 1].map(i => ({ id: 'cut-' + i, from: i, to: i + 1, kind, state }));
  return { seed: 'fixture', signature: 'chain-' + kind + state, entrance: 0, barriers: [], boundaries,
    regionToHabitat: new Map(), incident: [[0], [0, 1], [1]],
    habitats: [0, 1, 2].map(i => ({ zone: 0, depthM: 6 * i, areaM2: 36, capacity: 36, morphology: ['tunnel'], humidity: 0.2 })) };
}
const matter = (s: Stock) => s.detritus + s.nutrients + s.fungalBiomass;

describe('resource accounts', () => {
  it('conserves water and matter in a closed system, charges energy, and advances at most one crossing', () => {
    const graph = chain();
    let state = initialState(true);
    state.stocks.set(0, { water: 4, detritus: 22, nutrients: 3, fungalBiomass: 0, energy: 13 });
    const opening = totals(state.stocks);
    let energyPaid = 0;
    for (let i = 0; i < 12; i++) {
      const next = step(graph, state);
      const book = audit(state.stocks, next.state.stocks, next.ledger);
      expect(book.sources).toEqual(emptyStock());
      energyPaid += book.sinks.energy;
      state = next.state;
      if (i === 0) expect(state.stocks.has(2)).toBe(false);
      const current = totals(state.stocks);
      expect(current.water).toBe(opening.water);
      expect(matter(current)).toBe(matter(opening));
      expect(current.energy + energyPaid).toBe(opening.energy);
    }
    expect(energyPaid).toBeGreaterThan(0);
  });
  it('stops declared inputs after their budget, accounts for every sink and reconciles every tick', () => {
    const graph = chain();
    let state = initialState();
    let waterLost = 0, matterLost = 0, energyPaid = 0;
    for (let t = 0; t < parameters.surfaceTicks + 12; t++) {
      const next = step(graph, state);
      const book = audit(state.stocks, next.state.stocks, next.ledger);
      if (t >= parameters.surfaceTicks) expect(book.sources).toEqual(emptyStock());
      waterLost += book.sinks.water;
      matterLost += matter(book.sinks);
      energyPaid += book.sinks.energy;
      state = next.state;
    }
    const end = totals(state.stocks);
    expect(end.water + waterLost).toBe(parameters.surfaceTicks * parameters.runoff);
    expect(matter(end) + matterLost).toBe(parameters.surfaceTicks * parameters.litter);
    expect(end.energy + energyPaid).toBe(parameters.surfaceTicks * parameters.irradiance);
    expect(waterLost * matterLost * energyPaid).toBeGreaterThan(0);
  });
  it('cannot overdraw a scarce donor across competing downhill cuts', () => {
    const graph = chain('shaft');
    graph.boundaries[1].from = 0;
    graph.incident = [[0, 1], [0], [1]];
    const state = initialState(true);
    state.stocks.set(0, { ...emptyStock(), water: 1 });
    const next = step(graph, state);
    expect(audit(state.stocks, next.state.stocks, next.ledger).transported.water).toBe(1);
    expect(step(graph, initialState(true)).ledger).toEqual([]);
  });
  it('uses distinct permeabilities, barrier states, water and gravity', () => {
    const graph = chain('watercourse');
    const all: Stock = { water: 15, detritus: 15, nutrients: 15, fungalBiomass: 15, energy: 15 };
    const cut = graph.boundaries[0];
    expect(fluxes(graph, cut, emptyStock(), all)).toEqual([]);
    const forward = fluxes(graph, cut, all, emptyStock());
    expect(forward.map(f => f.amount)).toEqual([12, 4, 4, 1]);
    expect(forward.every(f => f.connector === cut.id)).toBe(true);
    for (const state of ['blocked', 'closed'] as const) expect(fluxes(graph, { ...cut, state }, all, emptyStock())).toEqual([]);
    expect(fluxes(graph, { ...cut, kind: 'gate' }, all, emptyStock()).map(f => f.resource)).toEqual(['energy']);
    expect(fluxes(graph, { ...cut, kind: 'gate', state: 'flooded' }, all, emptyStock()).length).toBe(4);
    expect(fluxes(graph, { ...cut, kind: 'fissure' }, { ...all, water: 0 }, emptyStock()).map(f => f.resource)).toEqual(['energy']);
  });
  it('rejects incompatible or corrupt checkpoints and detects ledger discrepancies', () => {
    const graph = chain();
    const next = step(graph, initialState());
    const data = snapshot(graph, next.state);
    expect(() => restore(chain('gate'), data)).toThrow();
    expect(() => restore(graph, { ...data, generator: 'older' })).toThrow();
    for (const r of resources) {
      const bad = { ...data, stocks: [[0, { ...data.stocks[0][1], [r]: -1 }] as const] };
      expect(() => restore(graph, bad)).toThrow();
    }
    expect(() => audit(new Map(), next.state.stocks, next.ledger.slice(1))).toThrow();
  });
});

it('rejects unsigned saves and changes in resource budgets or aperture rates', () => {
  const graph = chain();
  const saved = snapshot(graph, initialState());
  const unsigned = { ...saved, resourceContract: '' };
  expect(() => restore(graph, unsigned)).toThrow('resource contract');
  const rate = parameters.runoff;
  const table = conductance.gate;
  try {
    Object.assign(parameters, { runoff: rate + 1 });
    expect(() => restore(graph, saved)).toThrow('resource contract');
    Object.assign(parameters, { runoff: rate });
    conductance.gate = [1, 0, 0, 1];
    expect(() => restore(graph, saved)).toThrow('resource contract');
  } finally {
    Object.assign(parameters, { runoff: rate });
    conductance.gate = table;
  }
  expect(restore(graph, saved)).toEqual(initialState());
});

it('applies the effective dry or wet gate state in both directions', () => {
  const graph = chain('gate'), cut = graph.boundaries[0];
  for (const [state, down, up] of [
    ['closed', [0,0,0,0], [0,0,0,0]],
    ['destroyed', [0,0,0,1], [0,0,0,1]],
    ['flooded', [8,3,3,1], [0,0,0,1]],
    ['open', [0,0,0,1], [0,0,0,1]],
    ['blocked', [0,0,0,0], [0,0,0,0]],
  ] as const) {
    const gate = { ...cut, state };
    expect(channels.map(r => channelLimit(graph, gate, gate.from, r))).toEqual(down);
    expect(channels.map(r => channelLimit(graph, gate, gate.to, r))).toEqual(up);
    expect(fluxes(graph, gate, emptyStock(), emptyStock())).toEqual([]);
  }
});

it('meters declared external recharge at the physical inlet across cycles and restart', () => {
  const graph = chain('watercourse');
  graph.regionToHabitat.set('inlet', 0);
  const source = { seed: graph.seed, watershed: 'fixture-catchment', region: 'inlet', connector: 'cut-0', rate: 3, period: 4, activeHours: 2 };
  let state = initialState(false, source);
  state.tick = 240;
  let total = 0;
  for (let hour = 0; hour < 9; hour++) {
    const next = step(graph, state);
    const book = audit(state.stocks, next.state.stocks, next.ledger);
    expect(book.sources.water).toBe(hour % 4 < 2 ? 3 : 0);
    total += book.sources.water;
    for (const event of next.ledger.filter(e => e.kind === 'source')) {
      expect(event).toMatchObject({ connector: 'cut-0', to: 0, process: 'aquifer/fixture-catchment' });
    }
    const resumed = restore(graph, JSON.parse(JSON.stringify(snapshot(graph, next.state))));
    expect(step(graph, resumed)).toEqual(step(graph, next.state));
    state = next.state;
  }
  expect(total).toBe(15);
  const saved = snapshot(graph, state);
  expect(() => restore(graph, { ...saved, recharge: { ...source, rate: 4 } })).toThrow('resource contract');
  const capped = initialState(false, source);
  capped.tick = 240;
  capped.stocks.set(0, { ...emptyStock(), water: parameters.inventoryLimit - 1 });
  expect(step(graph, capped).ledger.find(e => e.kind === 'source')?.amount).toBe(1);
  expect(step(graph, initialState(true, source)).ledger).toEqual([]);
  expect(() => step(graph, initialState(false, { ...source, connector: 'cut-1' }))).toThrow('inlet');
  expect(() => step(graph, initialState(false, { ...source, rate: Infinity }))).toThrow('recharge');
});

it('wakes a dry nutrient donor on the hour after water arrives and still runs scheduled local losses', () => {
  const graph = chain('watercourse');
  const before = initialState();
  before.tick = 243;
  before.stocks.set(0, { ...emptyStock(), water: 12 });
  before.stocks.set(1, { ...emptyStock(), nutrients: 3 });
  before.stocks.set(2, { ...emptyStock(), fungalBiomass: 1 });
  const oldSave = JSON.stringify(snapshot(graph, before));
  const first = step(graph, before);
  expect(audit(before.stocks, first.state.stocks, first.ledger).transported.nutrients).toBe(0);
  expect(first.state.stocks.has(2)).toBe(false); // Respiration on hour 244.
  const second = step(graph, first.state);
  expect(second.ledger).toContainEqual({ kind: 'transfer', process: 'transport', resource: 'nutrients',
    amount: 3, from: 1, to: 2, connector: 'cut-1' });
  expect(JSON.stringify(snapshot(graph, before))).toBe(oldSave);
});
