import { auditAccounts } from './audit.ts';
import { generatorVersion, type HabitatGraph } from './habitats.ts';
import { type Entry, projectInventory, transportStocks } from './resources.ts';
import { accounts, biology as b, cargo, colonyHome, emptyTrophicStock, inlet, matter, natural, trophicSignature, validateScenario,
  type Account, type TrophicScenario, type TrophicStock } from './trophic-contract.ts';

type Inventory = Map<number, TrophicStock>;
type Posting = Entry<Account>;
export interface TrophicState {
  tick: number;
  lotsUsed: number;
  topology: string;
  setup: TrophicScenario;
  stocks: Inventory;
}

// A committed state and its descendants share the same source and founding budget.
function freezeScenario(scenario: TrophicScenario) {
  const setup = structuredClone(scenario);
  Object.freeze(setup.founders);
  if (setup.source) Object.freeze(setup.source);
  return Object.freeze(setup);
}

export function auditTrophic(before: Inventory, after: Inventory, ledger: Posting[]) {
  return auditAccounts(before, after, ledger, accounts, emptyTrophicStock, matter);
}

export function foundColony(graph: HabitatGraph, setup: TrophicScenario) {
  validateScenario(graph, setup);
  const cut = inlet(graph, setup);
  const home = colonyHome(graph, setup);
  const stocks: Inventory = new Map();
  const ledger: Posting[] = [];
  for (const r of accounts) {
    const amount = setup.founders[r];
    if (amount) ledger.push({ kind: 'source', process: 'founding-deposit/' + setup.watershed,
      resource: r, amount, from: null, to: home, connector: cut.id });
  }
  if (ledger.length) {
    if (cut.state === 'closed' || cut.state === 'blocked') throw new Error('Blocked founding deposit');
    stocks.set(home, { ...setup.founders });
  }
  const state: TrophicState = { tick: 0, lotsUsed: 0, topology: graph.signature, setup: freezeScenario(setup), stocks };
  return { state, ledger };
}

export function metabolize(stock: TrophicStock, id: number, tick: number, capacity: number, maintenancePeriod: number, ledger: Posting[]) {
  function post(kind: 'sink' | 'conversion', process: string, resource: Account, delta: number) {
    if (!delta) return;
    stock[resource] += delta;
    ledger.push({ kind, process, resource, amount: Math.abs(delta), from: delta < 0 ? id : null, to: delta > 0 ? id : null });
  }
  function convert(process: string, from: Account, to: Account, amount: number) {
    post('conversion', process, from, -amount);
    post('conversion', process, to, amount);
  }
  function maintain(group: 'fungalBiomass' | 'detritivores', perRation: number) {
    const need = Math.ceil(stock[group] / perRation);
    const fed = stock.water ? Math.min(need, Math.floor(stock.energy / b.maintenanceEnergy),
      Math.floor(stock.detritus / b.maintenanceFood)) : 0;
    convert(group + '-feeding', 'detritus', 'nutrients', fed * b.maintenanceFood);
    post('sink', group + '-maintenance', 'energy', -fed * b.maintenanceEnergy);
    const dead = Math.max(0, stock[group] - fed * perRation);
    if (dead) {
      const limiting = !stock.water ? 'water' : stock.energy < b.maintenanceEnergy ? 'energy' : 'food';
      convert(group + '-mortality/' + limiting, group, 'detritus', dead);
    }
  }
  if (tick % maintenancePeriod === 0) {
    maintain('fungalBiomass', b.fungalUnitsPerRation);
    maintain('detritivores', b.animalsPerRation);
  }
  if (stock.water && stock.fungalBiomass) {
    const mineralized = Math.min(b.mineralizationRate, stock.detritus, Math.floor(stock.energy / b.mineralizationEnergy));
    convert('fungal-mineralization', 'detritus', 'nutrients', mineralized);
    post('sink', 'fungal-mineralization', 'energy', -mineralized * b.mineralizationEnergy);
    if (tick % b.fungalGrowthPeriod === 0 && stock.detritus >= b.fungalGrowthFood && stock.nutrients >= b.fungalGrowthNutrients &&
        stock.energy >= b.fungalGrowthEnergy && stock.fungalBiomass + stock.detritivores + b.fungalGrowthFood + b.fungalGrowthNutrients <= capacity) {
      convert('fungal-growth', 'detritus', 'fungalBiomass', b.fungalGrowthFood);
      convert('fungal-growth', 'nutrients', 'fungalBiomass', b.fungalGrowthNutrients);
      post('sink', 'fungal-growth', 'energy', -b.fungalGrowthEnergy);
    }
  }
  if (stock.water && stock.detritivores && tick % b.detritivoreBirthPeriod === 0 &&
      stock.detritus >= b.birthFood && stock.energy >= b.birthEnergy && stock.detritivores + stock.fungalBiomass < capacity) {
    convert('detritivore-birth', 'detritus', 'detritivores', 1);
    convert('detritivore-birth-feeding', 'detritus', 'nutrients', b.birthFood - 1);
    post('sink', 'detritivore-birth', 'energy', -b.birthEnergy);
  }
  if (tick % b.evaporationPeriod === 0 && stock.water) post('sink', 'evaporation', 'water', -1);
}

export function advanceResources<S extends TrophicStock>(graph: HabitatGraph, previous: Omit<TrophicState, 'stocks'> & { stocks: Map<number, S> },
  empty: () => S) {
  const stocks: Map<number, S> = new Map();
  for (const [id, s] of previous.stocks) stocks.set(id, { ...s });
  const input: Entry[] = [];
  const supplied: Map<number, S> = new Map();
  const { setup } = previous;
  const source = setup.source;
  let lotsUsed = previous.lotsUsed;
  if (source && lotsUsed < source.quota && previous.tick % source.period < source.activeHours) {
    const cut = inlet(graph, setup);
    if (cut.state !== 'blocked' && cut.state !== 'closed') {
      const stock = stocks.get(cut.from) ?? empty();
      const lots = Math.min(source.rate, source.quota - lotsUsed);
      const lot = cargo[source.kind];
      for (const r of ['water', 'detritus', 'energy'] as const) {
        const amount = lots * lot[r];
        if (!amount) continue;
        stock[r] += amount;
        input.push({ kind: 'source', process: source.kind + '/' + setup.watershed, resource: r,
          amount, from: null, to: cut.from, connector: cut.id });
      }
      if (lot.settling) {
        const amount = lots * lot.settling;
        stock.detritus -= amount;
        input.push({ kind: 'sink', process: 'inlet-settling', resource: 'detritus', amount, from: cut.from, to: null, connector: cut.id });
      }
      stocks.set(cut.from, stock);
      supplied.set(cut.from, { ...stock });
      lotsUsed += lots;
    }
  }
  transportStocks(graph, previous.stocks, supplied, stocks, input, empty);
  return { stocks, input, lotsUsed };
}

export function stepTrophic(graph: HabitatGraph, previous: TrophicState) {
  const tick = previous.tick + 1;
  if (!natural(tick) || previous.topology !== graph.signature) throw new Error('Invalid clock or structural epoch');
  const { setup } = previous;
  const { stocks, input, lotsUsed } = advanceResources(graph, previous, emptyTrophicStock);
  const ledger: Posting[] = input;
  for (const id of [...stocks.keys()].sort((a, b) => a - b)) {
    const stock = stocks.get(id)!;
    metabolize(stock, id, tick, graph.habitats[id].capacity, setup.maintenancePeriod ?? b.maintenancePeriod, ledger);
    if (accounts.every(r => stock[r] === 0)) stocks.delete(id);
  }
  return { state: { ...previous, stocks, lotsUsed, tick }, ledger };
}

export function projectColony(oldGraph: HabitatGraph, newGraph: HabitatGraph, state: TrophicState): TrophicState {
  if (oldGraph.signature !== state.topology) throw new Error('Invalid structural epoch');
  inlet(newGraph, state.setup);
  const stocks = projectInventory(oldGraph, newGraph, state.stocks, accounts, emptyTrophicStock);
  return { ...state, topology: newGraph.signature, stocks };
}

export function saveColony(graph: HabitatGraph, state: TrophicState) {
  if (graph.signature !== state.topology) throw new Error('Invalid structural epoch');
  return { version: 'E1-B1/1', generator: generatorVersion, signature: graph.signature, barriers: structuredClone(graph.barriers),
    contract: trophicSignature(state.setup), setup: structuredClone(state.setup), tick: state.tick, lotsUsed: state.lotsUsed,
    stocks: [...state.stocks].sort(([a], [b]) => a - b).map(([id, stock]) => [id, { ...stock }] as const) };
}
export function restoreColony(graph: HabitatGraph, data: ReturnType<typeof saveColony>): TrophicState {
  if (data.version !== 'E1-B1/1' || data.generator !== generatorVersion || data.signature !== graph.signature ||
      JSON.stringify(data.barriers) !== JSON.stringify(graph.barriers)) throw new Error('Incompatible structural snapshot');
  validateScenario(graph, data.setup);
  if (trophicSignature(data.setup) !== data.contract || !natural(data.tick) || !natural(data.lotsUsed) ||
    data.lotsUsed > (data.setup.source?.quota ?? 0)) throw new Error('Invalid trophic contract or quota');
  const { source, founders } = data.setup;
  const home = colonyHome(graph, data.setup);
  if (source) {
    const hours = Math.floor(data.tick / source.period) * source.activeHours + Math.min(data.tick % source.period, source.activeHours);
    if (Math.ceil(data.lotsUsed / source.rate) > hours) throw new Error('Quota exceeds elapsed delivery windows');
  }
  const stocks: Inventory = new Map();
  const totals = emptyTrophicStock();
  for (const [id, s] of data.stocks) {
    if (!natural(id) || !graph.habitats[id] || stocks.has(id) || !accounts.every(r => natural(s[r]))) throw new Error('Invalid saved account');
    if ((s.detritivores && (id !== home || !founders.detritivores)) ||
        (s.fungalBiomass && (id !== home || !founders.fungalBiomass)) ||
        s.fungalBiomass + s.detritivores > graph.habitats[id].capacity) throw new Error('Invalid stationary colony');
    for (const r of accounts) totals[r] += s[r];
    stocks.set(id, { ...s });
  }
  const lot = source && cargo[source.kind];
  const organic = (lot?.detritus ?? 0) - (lot?.settling ?? 0);
  if (totals.water > founders.water + data.lotsUsed * (lot?.water ?? 0) ||
      totals.energy > founders.energy + data.lotsUsed * (lot?.energy ?? 0) ||
      matter.reduce((sum, r) => sum + totals[r] - founders[r], 0) !== data.lotsUsed * organic) {
    throw new Error('Inventory inconsistent with founding deposit and delivered lots');
  }
  return { tick: data.tick, lotsUsed: data.lotsUsed, topology: graph.signature, setup: freezeScenario(data.setup), stocks };
}
