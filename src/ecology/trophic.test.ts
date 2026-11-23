import { describe, expect, it } from 'vitest';
import { type HabitatGraph, type Boundary } from './habitats';
import { accounts, biology, emptyTrophicStock, type TrophicScenario, type TrophicStock } from './trophic-contract';
import { auditTrophic, foundColony, projectColony, restoreColony, saveColony, stepTrophic } from './trophic';

function channel(state: Boundary['state'] = 'open', seed = 'brook'): HabitatGraph {
  return { seed, signature: seed + '/' + state, entrance: 0, barriers: [['brook-cut', state]],
    habitats: [6, 12, 12].map(depthM => ({ capacity: 36, depthM, morphology: ['tunnel'], humidity: 0.85, zone: 1, areaM2: 36 })),
    boundaries: [{ from: 0, to: 1, id: 'brook-cut', kind: 'watercourse', state }],
    regionToHabitat: new Map([['up', 0], ['down', 1], ['isolated', 2]]), incident: [[0], [0], []] };
}
function config(seed = 'brook'): TrophicScenario {
  return { seed, watershed: 'outer-basin', region: 'up', connector: 'brook-cut',
    founders: { water: 12, detritus: 16, energy: 10, fungalBiomass: 2, nutrients: 1, detritivores: 2 },
    source: { kind: 'organicSediment', rate: 2, quota: 5, period: 3, activeHours: 1 } };
}

describe('stationary trophic communities', () => {
  it('accounts for every hour, limits export to paid lots, preserves population through blockade and restart', () => {
    const open = channel(), blocked = channel('blocked');
    const setup = config();
    const founder = foundColony(open, setup);
    expect(auditTrophic(new Map(), founder.state.stocks, founder.ledger).sources).toEqual(setup.founders);
    let graph = open, state = founder.state;
    const original = saveColony(graph, state);
    let resumed = restoreColony(graph, JSON.parse(JSON.stringify(original)));
    const balance = { ...setup.founders };
    for (let hour = 1; hour <= 20; hour++) {
      if (hour === 4 || hour === 9) {
        const nextGraph = hour === 4 ? blocked : open;
        const projected = projectColony(graph, nextGraph, state);
        expect(projected.stocks).toEqual(state.stocks);
        resumed = restoreColony(nextGraph, JSON.parse(JSON.stringify(saveColony(nextGraph, projectColony(graph, nextGraph, resumed)))));
        state = projected;
        graph = nextGraph;
      }
      const next = stepTrophic(graph, state);
      const restarted = stepTrophic(graph, resumed);
      expect(restarted).toEqual(next);
      const book = auditTrophic(state.stocks, next.state.stocks, next.ledger);
      const deliveries = hour === 1 || hour === 10 ? 2 : hour === 13 ? 1 : 0;
      expect(book.sources.energy).toBe(2 * deliveries);
      expect(book.sources.detritus).toBe(3 * deliveries);
      expect(book.sinks.detritus).toBe(deliveries);
      expect(next.state.stocks.has(2)).toBe(false);
      if (graph === blocked) expect(next.ledger.some(e => e.connector)).toBe(false);
      for (const e of next.ledger.filter(e => e.kind === 'transfer')) {
        expect([e.from, e.to, e.connector]).toEqual([0, 1, 'brook-cut']);
      }
      for (const r of accounts) {
        balance[r] += book.sources[r] - book.sinks[r] + book.converted[r];
        const sum = [...next.state.stocks.values()].reduce((n, stock) => n + stock[r], 0);
        expect(sum).toBe(balance[r]);
      }
      resumed = hour === 12 ? restoreColony(graph, JSON.parse(JSON.stringify(saveColony(graph, restarted.state)))) : restarted.state;
      state = next.state;
    }
    expect(state.lotsUsed).toBe(5);
    expect(saveColony(open, founder.state)).toEqual(original);
  });

  it.each(['energy', 'food', 'water'] as const)('reports mortality and returns every body to detritus under %s scarcity', reason => {
    const graph = channel(), setup = config();
    setup.source = null;
    setup.founders = { ...emptyTrophicStock(), detritivores: 3, water: 6, energy: 3, detritus: 2 };
    setup.founders[reason === 'food' ? 'detritus' : reason] = 0;
    let state = foundColony(graph, setup).state;
    for (let i = 1; i <= 12; i++) {
      const next = stepTrophic(graph, state);
      auditTrophic(state.stocks, next.state.stocks, next.ledger);
      expect(next.ledger.some(e => e.kind === 'source' || e.process === 'detritivore-birth')).toBe(false);
      if (i === biology.maintenancePeriod) {
        expect(next.ledger.find(e => e.resource === 'detritivores')?.process).toBe('detritivores-mortality/' + reason);
        expect(next.state.stocks.get(1)!.detritus).toBe(setup.founders.detritus + 3);
      }
      state = next.state;
    }
    expect(state.stocks.get(1)!.detritivores).toBe(0);
  });

  it('requires living founders, food, energy and local space for new tissue and offspring', () => {
    const graph = channel(), setup = config();
    setup.source = null;
    const run = (founders: TrophicStock, capacity: number) => {
      graph.habitats[1].capacity = capacity;
      let state = foundColony(graph, { ...setup, founders }).state;
      for (let i = 0; i < 4; i++) {
        const next = stepTrophic(graph, state);
        auditTrophic(state.stocks, next.state.stocks, next.ledger);
        state = next.state;
      }
      return state.stocks.get(1)!;
    };
    const full = setup.founders;
    expect(run(full, 4)).toMatchObject({ fungalBiomass: 2, detritivores: 2 });
    expect(run(full, 36)).toMatchObject({ fungalBiomass: 4, detritivores: 3, energy: 3 });
    expect(run({ ...full, detritivores: 0, fungalBiomass: 0 }, 36)).toEqual({ ...full, detritivores: 0, fungalBiomass: 0 });
    expect(run({ ...full, energy: 0 }, 36)).toMatchObject({ fungalBiomass: 2, detritivores: 2 });
    expect(run({ ...full, detritus: 0 }, 36)).toMatchObject({ fungalBiomass: 2, detritivores: 2 });
  });

  it('rejects incompatible rules, corrupted inventories, wrong region, missing physical inlet and wrong epoch', () => {
    const graph = channel(), setup = config(), { state } = foundColony(graph, setup);
    const saved = saveColony(graph, state);
    expect(() => Object.assign(state.setup.source!, { quota: 10 })).toThrow();
    setup.source!.quota = 9;
    expect(state.setup.source!.quota).toBe(5);
    expect(() => restoreColony(channel('open', 'other'), saved)).toThrow();
    expect(() => restoreColony(graph, { ...saved, version: 'E1-A' })).toThrow();
    expect(() => restoreColony(graph, { ...saved, lotsUsed: 6 })).toThrow();
    expect(() => restoreColony(graph, { ...saved, lotsUsed: 1 })).toThrow('elapsed');
    expect(() => restoreColony(graph, { ...saved, stocks: [] })).toThrow('deposit');
    expect(() => restoreColony(graph, { ...saved, stocks: [[2, { ...setup.founders }]] })).toThrow('stationary');
    expect(() => restoreColony(graph, { ...saved, setup: { ...setup, source: null } })).toThrow();
    expect(() => restoreColony(graph, { ...saved, stocks: [[1, { ...setup.founders, detritivores: -1 }]] })).toThrow();
    expect(() => foundColony(graph, { ...setup, region: 'down' })).toThrow();
    expect(() => foundColony(graph, { ...setup, connector: 'fiction' })).toThrow();
    expect(() => stepTrophic(channel('closed'), state)).toThrow();
    const old = biology.maintenancePeriod;
    try {
      Object.assign(biology, { maintenancePeriod: 11 });
      expect(() => restoreColony(graph, saved)).toThrow('contract');
    } finally { Object.assign(biology, { maintenancePeriod: old }); }
  });

  it('imports only water from a groundwater source and keeps sterile or empty sites unoccupied', () => {
    const graph = channel(), setup = config();
    setup.founders = emptyTrophicStock();
    setup.source!.kind = 'groundwater';
    const from = foundColony(graph, setup).state;
    const first = stepTrophic(graph, from);
    expect(auditTrophic(from.stocks, first.state.stocks, first.ledger).sources).toEqual({ ...emptyTrophicStock(), water: 8 });
    expect(first.ledger.some(e => e.resource === 'detritivores' || e.resource === 'fungalBiomass')).toBe(false);
    const empty = foundColony(graph, { ...setup, source: null }).state;
    expect(stepTrophic(graph, empty).state.stocks.size).toBe(0);
  });
});
