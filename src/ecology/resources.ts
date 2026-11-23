import { generatorVersion, modelVersion, type HabitatGraph } from './habitats.ts';
import { emptyStock, parameters as p, resources, type Resource, type Stock } from './parameters.ts';
import { fluxes } from './transport.ts';

export type Inventory = Map<number, Stock>;
export interface ModelState {
  tick: number;
  /** Closed disables external inputs and passive losses. Growth still pays its energy cost. */
  closed: boolean;
  stocks: Inventory;
}
export interface Entry {
  kind: 'source' | 'sink' | 'transfer' | 'conversion';
  process: string;
  from: number | null;
  to: number | null;
  resource: Resource;
  amount: number;
  connector?: string;
}

const none = emptyStock();
const ordered = (ids: Iterable<number>) => [...ids].sort((a, b) => a - b);

export function totals(stocks: Inventory): Stock {
  const sum = emptyStock();
  for (const stock of stocks.values()) for (const r of resources) sum[r] += stock[r];
  return sum;
}
export function initialState(closed = false): ModelState {
  return { tick: 0, closed, stocks: new Map() };
}

function validateState(graph: HabitatGraph, state: ModelState) {
  if (!Number.isSafeInteger(state.tick) || state.tick < 0 || typeof state.closed !== 'boolean') throw new Error('Invalid clock or scenario');
  let total = 0;
  for (const [id, stock] of state.stocks) {
    if (!Number.isInteger(id) || !graph.habitats[id]) throw new Error('Invalid habitat in inventory');
    for (const r of resources) {
      if (!Number.isSafeInteger(stock[r]) || stock[r] < 0) throw new Error('Invalid stock: ' + r);
      total += stock[r];
    }
  }
  const remainingInput = state.closed ? 0 : Math.max(0, p.surfaceTicks - state.tick) * (p.runoff + p.litter + p.irradiance);
  if (total + remainingInput > p.inventoryLimit) throw new Error('Inventory exceeds scenario budget');
}

/** Produce a new committed state and a replayable ledger. Never spend incoming flux twice. */
export function step(graph: HabitatGraph, previous: ModelState): { state: ModelState; ledger: Entry[] } {
  validateState(graph, previous);
  const tick = previous.tick + 1;
  if (!Number.isSafeInteger(tick)) throw new Error('Tick outside integer range');
  const stocks: Inventory = new Map([...previous.stocks].map(([id, stock]) => [id, { ...stock }]));
  const ledger: Entry[] = [];
  function apply(kind: Entry['kind'], process: string, resource: Resource, amount: number,
    from: number | null, to: number | null, connector?: string) {
    if (!amount) return;
    if (from !== null) {
      const donor = stocks.get(from)!;
      if (donor[resource] < amount) throw new Error('Overdraw: ' + process);
      donor[resource] -= amount;
    }
    if (to !== null) {
      if (!stocks.has(to)) stocks.set(to, emptyStock());
      stocks.get(to)![resource] += amount;
    }
    ledger.push({ kind, process, resource, amount, from, to, connector });
  }
  if (!previous.closed && tick <= p.surfaceTicks) {
    apply('source', 'surface-runoff', 'water', p.runoff, null, graph.entrance);
    apply('source', 'root-litter', 'detritus', p.litter, null, graph.entrance);
    apply('source', 'surface-light', 'energy', p.irradiance, null, graph.entrance);
  }
  // Only cuts incident to nonempty habitats can carry anything.
  const active = new Set<number>();
  for (const id of stocks.keys()) for (const cut of graph.incident[id]) active.add(cut);
  const remaining: Inventory = new Map([...stocks].map(([id, stock]) => [id, { ...stock }]));
  const proposals = ordered(active).flatMap(index => {
    const cut = graph.boundaries[index];
    return fluxes(graph, cut, remaining.get(cut.from) ?? none, remaining.get(cut.to) ?? none);
  });
  for (const flux of proposals) {
    const budget = remaining.get(flux.from)!;
    const amount = Math.min(flux.amount, budget[flux.resource]);
    budget[flux.resource] -= amount;
    apply('transfer', 'transport', flux.resource, amount, flux.from, flux.to, flux.connector);
  }
  for (const id of ordered(stocks.keys())) {
    const stock = stocks.get(id)!;
    const mineral = Math.min(p.mineralize, stock.detritus);
    apply('conversion', 'mineralization', 'detritus', mineral, id, null);
    apply('conversion', 'mineralization', 'nutrients', mineral, null, id);
    const yieldPerGrowth = p.detritusPerGrowth + p.nutrientsPerGrowth;
    const growth = stock.water > 0 ? Math.min(p.growth, Math.floor(stock.energy / p.energyPerGrowth),
      Math.floor(stock.nutrients / p.nutrientsPerGrowth), Math.floor(stock.detritus / p.detritusPerGrowth),
      Math.floor((graph.habitats[id].capacity - stock.fungalBiomass) / yieldPerGrowth)) : 0;
    if (growth > 0) {
      apply('conversion', 'fungal-growth', 'detritus', p.detritusPerGrowth * growth, id, null);
      apply('conversion', 'fungal-growth', 'nutrients', p.nutrientsPerGrowth * growth, id, null);
      apply('conversion', 'fungal-growth', 'fungalBiomass', yieldPerGrowth * growth, null, id);
      apply('sink', 'growth-energy', 'energy', p.energyPerGrowth * growth, id, null);
    }
    if (!previous.closed) {
      if (tick % p.evaporationPeriod === 0 && stock.water) apply('sink', 'evaporation', 'water', 1, id, null);
      if (tick % p.respirationPeriod === 0 && stock.fungalBiomass) apply('sink', 'respiration', 'fungalBiomass', 1, id, null);
    }
    if (resources.every(r => stock[r] === 0)) stocks.delete(id);
  }
  return { state: { stocks, tick, closed: previous.closed }, ledger };
}

export function snapshot(graph: HabitatGraph, state: ModelState) {
  return { version: modelVersion, generator: generatorVersion, seed: graph.seed, signature: graph.signature,
    barriers: graph.barriers.map(([id, value]) => [id, value] as const), tick: state.tick, closed: state.closed,
    stocks: ordered(state.stocks.keys()).map(id => [id, { ...state.stocks.get(id)! }] as const) };
}
export function restore(graph: HabitatGraph, data: ReturnType<typeof snapshot>): ModelState {
  if (data.version !== modelVersion || data.generator !== generatorVersion || data.seed !== graph.seed ||
      data.signature !== graph.signature || JSON.stringify(data.barriers) !== JSON.stringify(graph.barriers) ||
      !Number.isSafeInteger(data.tick) || data.tick < 0 || typeof data.closed !== 'boolean') {
    throw new Error('Incompatible habitat snapshot');
  }
  const stocks: Inventory = new Map();
  for (const [id, value] of data.stocks) {
    if (stocks.has(id)) throw new Error('Duplicate habitat in snapshot');
    stocks.set(id, { ...value });
  }
  const restored = { tick: data.tick, closed: data.closed, stocks };
  validateState(graph, restored);
  return restored;
}

/** Redistribute a mixed stock on a barrier epoch change. Overlap is measured in fine regions. */
export function reaggregate(oldGraph: HabitatGraph, newGraph: HabitatGraph, state: ModelState): ModelState {
  if (oldGraph.seed !== newGraph.seed || oldGraph.regionToHabitat.size !== newGraph.regionToHabitat.size) {
    throw new Error('Cannot project across different buildings');
  }
  const overlaps = new Map<number, Map<number, number>>();
  for (const [region, oldId] of oldGraph.regionToHabitat) {
    const newId = newGraph.regionToHabitat.get(region);
    if (newId === undefined) throw new Error('Missing fine region: ' + region);
    if (!state.stocks.has(oldId)) continue;
    if (!overlaps.has(oldId)) overlaps.set(oldId, new Map());
    const counts = overlaps.get(oldId)!;
    counts.set(newId, (counts.get(newId) ?? 0) + 1);
  }
  const stocks: Inventory = new Map();
  for (const [oldId, counts] of overlaps) {
    const stock = state.stocks.get(oldId)!;
    const count = [...counts.values()].reduce((a, b) => a + b, 0);
    let preceding = 0;
    for (const id of ordered(counts.keys())) {
      const end = preceding + counts.get(id)!;
      if (!stocks.has(id)) stocks.set(id, emptyStock());
      const dest = stocks.get(id)!;
      for (const r of resources) {
        dest[r] += Math.floor(stock[r] * end / count) - Math.floor(stock[r] * preceding / count);
      }
      preceding = end;
    }
  }
  for (const [id, s] of stocks) if (resources.every(r => s[r] === 0)) stocks.delete(id);
  return { ...state, stocks };
}
