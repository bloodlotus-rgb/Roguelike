import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { chemicalDelivery, chemicalDigest, type ChemicalSupply } from './chemical-ledger.ts';
import { planChemicalTransport } from './chemical-transport.ts';
import { saveChemical } from './chemical-snapshot.ts';
import * as foodChain from './chemical-food-chain.ts';
import { foodLedgerDigest, splitLiving, stepFoodChain } from './chemical-food-chain.ts';
import { foundFoodChain, type ChemicalAnimal, type FoodChainRules, type FoodChainState } from './chemical-food-contract.ts';
import { projectFoodChain, restoreFoodChain, saveFoodChain } from './chemical-food-snapshot.ts';
import { buildDispersalWorld, changeDispersalBarrier, indexWorld, type DispersalWorld } from './dispersal-world.ts';
import type { Boundary } from './habitats.ts';

const body = (matter: number, chemicalEnergy: number, storedEnergy: number) => ({matter, chemicalEnergy, storedEnergy});
const stock = (matter: number, chemicalEnergy: number, water = 0) => ({detritus: {matter, chemicalEnergy}, mineralMatter: 0, water});
const animal = (id: number, kind: ChemicalAnimal['kind'], region = 'a', b = body(1,2,0)): ChemicalAnimal =>
  ({id, kind, region, bornAt: 0, body: b});

function configuration(): FoodChainRules {
  const common = {maintenance: 1, reservePerMatter: 10, movement: {modes: ['crawl'] as const, width: 0.1, height: 0.1, cost: 0},
    birth: {interval: 1, adultAge: 1, matter: 1, energy: 2, reserve: 1, heat: 1}};
  return {
    fungus: {maintenance: 1, reservePerMatter: 10,
      feeding: {interval: 1, biteMatter: 1, retainedMatterPermille: 0, reservePermille: 667, residueEnergyPermille: 0}},
    prey: {...common,
      feeding: {interval: 1, biteMatter: 1, retainedMatterPermille: 0, reservePermille: 600, residueEnergyPermille: 0}},
    predator: {...common,
      feeding: {interval: 1, retainedMatterPermille: 0, reservePermille: 400, residueEnergyPermille: 200}},
  };
}

// These test-only worlds keep all regions at the same depth and use real section rules.
function fixture(state: Boundary['state'] = 'open', mixed = false, capacity = 20) {
  const regionToHabitat = new Map([['a',0], ['b',mixed ? 0 : 1], ['c',mixed ? 1 : 2]]);
  const ports = new Map([['ab',['a','b'] as const], ['bc',['b','c'] as const]]);
  const boundaries: Boundary[] = [...ports].flatMap(([id,[a,b]]) => {
    const from = regionToHabitat.get(a)!, to = regionToHabitat.get(b)!;
    return from === to ? [] : [{id, from, to, kind: 'opening', state: id === 'ab' ? state : 'open'}];
  });
  const habitats = Array.from({length: mixed ? 2 : 3}, () =>
    ({zone: 0, depthM: 0, areaM2: 36, capacity, humidity: 0, morphology: []}));
  return indexWorld({seed: 'food-fixture', signature: JSON.stringify([state,mixed,capacity]), entrance: 0, habitats,
    regionToHabitat, boundaries, incident: habitats.map((_,i) => boundaries.flatMap((cut,j) => cut.from === i || cut.to === i ? [j] : [])),
    barriers: state === 'open' ? [] : [['ab',state]]}, ports,
    new Map([['a',capacity],['b',capacity],['c',capacity]]), new Map([['ab','opening'],['bc','opening']]));
}

function step(world: DispersalWorld, rules: FoodChainRules, before: FoodChainState,
  actions: Omit<Parameters<typeof stepFoodChain>[4], 'chemical'> = {}) {
  return stepFoodChain(world, [], rules, before, {chemical: planChemicalTransport(world, before.chemical), ...actions});
}

it('closes 6 M and 16 E with 10 E chemical plus 6 E heat through the full local chain', () => {
  // One viable quantum is explicitly declared inside the 4 M/12 E of inoculated substrate.
  const world = fixture('closed'), rules = configuration();
  // Circle no transport around the testing habitat: its only incident cut is closed.
  const before = foundFoodChain(world, [], rules, {inventory: new Map([[0,stock(3,9,1)]]),
    fungus: new Map([[0,body(1,3,0)]]), animals: [animal(0,'prey'), animal(1,'predator')]});
  const out = step(world, rules, before);
  expect(out.entries.map(entry => [entry.phase,entry.heat.energy])).toEqual([['grow',1],['graze',2],['capture',2],['maintain',1]]);
  expect(out.audit).toMatchObject({opening: {matter:6n, chemicalEnergy:16n, water:1n},
    closing: {matter:6n, chemicalEnergy:10n, water:1n}, dissipated: 6n});
  expect(out.state.chemical.inventory.get(0)).toEqual({...stock(3,7,1), mineralMatter: 2});
  expect([...out.state.animals.values()]).toEqual([animal(1,'predator','a',body(1,3,1))]);
  const next = step(world, rules, out.state);
  expect(next.state.animals.get(1)?.body).toEqual(body(1,2,0));
  expect(next.audit.dissipated).toBe(1n);
  const last = step(world, rules, next.state);
  expect(last.entries.map(entry => entry.phase)).toEqual(['die']);
  expect(last.audit.closing).toMatchObject({matter:6n, chemicalEnergy:9n});
  expect(last.state.chemical.inventory.get(0)?.detritus).toEqual({matter:4,chemicalEnergy:9});
  expect(last.state.chemical.heat.get(0)).toBe(7);
  expect(last.state.fungus.size).toBe(0); // Sterile substrate did not spawn new micelium.
});

it('allocates competing bites with a bounded reserve and routes assimilation overflow to heat', () => {
  const world = fixture('closed'), rules = configuration();
  const tight = {...rules, prey: {...rules.prey, reservePerMatter: 1}};
  const before = foundFoodChain(world, [], tight, {inventory: new Map(), fungus: new Map([[0,body(3,11,5)]]),
    animals: [animal(2,'prey'), animal(0,'prey'), animal(1,'prey'), animal(3,'prey')]});
  const out = step(world, tight, before);
  const grazing = out.entries.filter(entry => entry.phase === 'graze');
  expect(grazing.map(entry => entry.heat.energy)).toEqual([3,3,2]);
  expect([...out.state.animals.keys()].sort()).toEqual([0,1,2]);
  expect(out.audit).toMatchObject({opening:{matter:7n,chemicalEnergy:19n}, closing:{matter:7n,chemicalEnergy:8n}, dissipated:11n});
});

it('requires a local watered adult pair with food, spare capacity and payment for every birth', () => {
  const rule = configuration();
  const rules = {...rule, prey: {...rule.prey, feeding: {...rule.prey.feeding, interval: 3}}};
  const first = animal(0,'prey','a',body(3,6,6)), second = animal(1,'prey','a',body(3,6,6));
  const start = (w: DispersalWorld, water: number, animals = [first, second], food = true) => foundFoodChain(w, [], rules,
    {inventory: new Map([[0,stock(0,0,water)]]), fungus: food ? new Map([[0,body(1,5,5)]]) : new Map(), animals});
  const world = fixture('closed');
  const out = step(world, rules, start(world,1), {pairs:[[1,0]]});
  expect(out.entries.map(entry => entry.phase)).toEqual(['maintain','maintain','maintain','birth']);
  expect(out.state.animals.get(2)).toEqual({...animal(2,'prey','a',body(1,2,1)),bornAt:1});
  expect(out.state.animals.get(0)?.body).toEqual(body(2,3,3));
  expect(out.state.animals.get(1)?.body).toEqual(body(3,4,4));
  expect(out.audit).toMatchObject({opening:{matter:7n,chemicalEnergy:17n}, closing:{matter:7n,chemicalEnergy:13n}, dissipated:4n});
  expect(step(world,rules,start(world,0),{pairs:[[0,1]]}).state.animals.size).toBe(2);
  expect(step(world,rules,start(world,1,[first, {...second,region:'b'}]),{pairs:[[0,1]]}).state.animals.size).toBe(2);
  const full = fixture('closed',false,6);
  expect(step(full,rules,start(full,1),{pairs:[[0,1]]}).state.animals.size).toBe(2);
  expect(step(world,rules,start(world,1,[first,{...second,body:body(3,2,1)}]),{pairs:[[0,1]]}).state.animals.size).toBe(2);
  expect(step(world,rules,start(world,1,[first,second],false),{pairs:[[0,1]]}).state.animals.size).toBe(2);
});

it('moves a whole animal once, charges movement to both energy accounts and respects barriers and locality', () => {
  const rule = configuration(), rules = {...rule, predator:{...rule.predator,movement:{...rule.predator.movement,cost:1}}};
  const founder = {inventory: new Map(), fungus: new Map(), animals: [
    animal(0,'predator','a',body(2,7,5)),animal(1,'prey','b',body(1,2,1))]};
  const world = fixture(), before = foundFoodChain(world,[],rules,founder);
  const out = step(world,rules,before,{moves:[{animal:0,connector:'ab'}]});
  expect(out.cutFlows.animals).toEqual([{connector:'ab',from:0,to:1,cargo:body(2,6,4)}]);
  expect(out.state.animals.get(0)?.region).toBe('b');
  expect(out.state.animals.has(1)).toBe(false);
  expect(out.byHabitat.get(0)?.dissipated).toBe(1n);
  expect(() => step(world,rules,before,{moves:[{animal:0,connector:'ab'},{animal:0,connector:'bc'}]})).toThrow(/repeated/);
  const blocked = fixture('closed');
  const other = step(blocked,rules,foundFoodChain(blocked,[],rules,founder),{moves:[{animal:0,connector:'ab'}]});
  expect(other.cutFlows.animals).toHaveLength(0);
  expect(other.state.animals.has(1)).toBe(true);
});

it('rejects an invalid late event atomically and still requires the passive transport batch', () => {
  const world = fixture(), rules = configuration();
  const before = foundFoodChain(world,[],rules,{inventory:new Map([[0,stock(30,30,20)]]),fungus:new Map(),
    animals:[animal(0,'prey','a',body(1,3,3))]});
  const checkpoint = saveFoodChain(world,[],rules,before);
  expect(planChemicalTransport(world,before.chemical).length).toBeGreaterThan(0);
  expect(() => stepFoodChain(world,[],rules,before,{chemical:[]})).toThrow(/physical opening plan/);
  expect(() => step(world,rules,before,{moves:[{animal:0,connector:'ab'}],pairs:[[0,0]]})).toThrow(/distinct/);
  expect(saveFoodChain(world,[],rules,before)).toEqual(checkpoint);
});

it('replays the same canonical journal and checkpoint across projection and rejects incompatible data', () => {
  const split = fixture(), merged = fixture('open',true), rules = configuration();
  const foundation = {inventory:new Map([[1,stock(3,4,2)],[0,stock(3,4,2)]]),
    fungus:new Map([[1,body(1,9,4)],[0,body(2,7,5)]]),
    animals:[animal(2,'prey','b',body(1,4,4)),animal(0,'prey','a',body(1,4,4))]};
  const opening = foundFoodChain(split,[],rules,foundation);
  const reordered = foundFoodChain(split,[],rules,{inventory:new Map([...foundation.inventory].reverse()),
    fungus:new Map([...foundation.fungus].reverse()),animals:[...foundation.animals].reverse()});
  expect(foodLedgerDigest(step(split,rules,opening))).toBe(foodLedgerDigest(step(split,rules,reordered)));
  const checkpoint = projectFoodChain(split,merged,[],rules,opening);
  const divided = projectFoodChain(merged,split,[],rules,checkpoint);
  expect([...divided.fungus.values()].reduce((n,s) => n + s.chemicalEnergy,0)).toBe(16);
  expect([...divided.fungus.values()].reduce((n,s) => n + s.storedEnergy,0)).toBe(9);
  expect(divided.animals).toEqual(opening.animals);
  const saved = saveFoodChain(merged,[],rules,checkpoint);
  const resumed = restoreFoodChain(merged,[],rules,JSON.parse(JSON.stringify(saved)));
  const ongoing = step(merged,rules,checkpoint), replayed = step(merged,rules,resumed);
  expect(foodLedgerDigest(replayed)).toBe(foodLedgerDigest(ongoing));
  expect(JSON.stringify(saveFoodChain(merged,[],rules,replayed.state)))
    .toBe(JSON.stringify(saveFoodChain(merged,[],rules,ongoing.state)));
  const changed = {...rules, fungus:{...rules.fungus,maintenance:2}};
  expect(() => restoreFoodChain(merged,[],changed,saved)).toThrow(/contract/);
  expect(() => restoreFoodChain(split,[],rules,saved)).toThrow(/epoch/);
  expect(() => restoreFoodChain(merged,[],rules,saveChemical(merged,[],checkpoint.chemical))).toThrow(/version/);
  const {integrity: _, ...tampered} = structuredClone(saved);
  tampered.animals[0][4][2] = 99;
  expect(() => restoreFoodChain(merged,[],rules,{...tampered,integrity:chemicalDigest(tampered)})).toThrow(/reserve/);
  expect(() => foundFoodChain(split,[],{...rules, fungus:{...rules.fungus,maintenance:0}},foundation)).toThrow(/positive/);
});

it('preserves a real mansion source through a fusion, replays the inactive hour and keeps the fine anchors', () => {
  const connector = '0/12/12/0/1';
  const merged = buildDispersalWorld('mansion'), split = changeDispersalBarrier(merged,connector,'flooded');
  const [fromRegion,toRegion] = split.ports.get(connector)!;
  const from = split.graph.regionToHabitat.get(fromRegion)!;
  const supply: ChemicalSupply = {id:'fixture',origin:'test',port:{connector,fromRegion,toRegion},
    perLot:stock(1,2),rate:2,periodHours:1,activeHours:1,quotaLots:5};
  const rules = configuration(), sources = [supply];
  const initial = foundFoodChain(split,sources,rules,{inventory:new Map(), fungus:new Map([[from,body(1,3,3)]]),
    animals:[animal(0,'predator',toRegion,body(1,4,4))]});
  const first = stepFoodChain(split,sources,rules,initial,{chemical:[chemicalDelivery(split,supply,initial.chemical,'first')!]});
  expect(first.audit.imported).toEqual({matter:2n,chemicalEnergy:4n,water:0n});
  const joined = projectFoodChain(split,merged,sources,rules,first.state);
  const saved = saveFoodChain(merged,sources,rules,joined);
  const restored = restoreFoodChain(merged,sources,rules,JSON.parse(JSON.stringify(saved)));
  expect(chemicalDelivery(merged,supply,restored.chemical,'inactive')).toBeUndefined();
  const input = {chemical:planChemicalTransport(merged,restored.chemical)};
  const continuous = stepFoodChain(merged,sources,rules,joined,input);
  const resumed = stepFoodChain(merged,sources,rules,restored,input);
  expect(resumed.state.chemical.lotsUsed.get(supply.id)).toBe(2);
  expect(resumed.state.animals.get(0)?.region).toBe(toRegion);
  expect(foodLedgerDigest(resumed)).toBe(foodLedgerDigest(continuous));
  expect(saveFoodChain(merged,sources,rules,resumed.state)).toEqual(saveFoodChain(merged,sources,rules,continuous.state));
  const separated = projectFoodChain(merged,split,sources,rules,resumed.state);
  expect(chemicalDelivery(split,supply,separated.chemical,'active')).toMatchObject({lots:2});
}, 30000);

it('grows established fungal biomass from local watered detritus and conserves the residue', () => {
  const world = fixture('closed'), defaults = configuration();
  const rules = {...defaults, fungus:{...defaults.fungus, feeding:{...defaults.fungus.feeding,
    biteMatter: 2, retainedMatterPermille: 500}}};
  const before = foundFoodChain(world,[],rules,{inventory:new Map([[0,stock(2,6,1)]]),
    fungus:new Map([[0,body(1,2,2)]]),animals:[]});
  const out = step(world,rules,before);
  expect(out.state.fungus.get(0)).toEqual(body(2,4,4));
  expect(out.state.chemical.inventory.get(0)).toEqual({...stock(0,0,1),mineralMatter:1});
  expect(out.audit).toMatchObject({opening:{matter:3n,chemicalEnergy:8n,water:1n},
    closing:{matter:3n,chemicalEnergy:4n,water:1n},dissipated:4n});
});

it('awards one prey carcass to one hunter and never substitutes another habitat’s stock', () => {
  const world = fixture('closed'), rules = configuration();
  const before = foundFoodChain(world,[],rules,{inventory:new Map(),fungus:new Map(),
    animals:[animal(3,'predator','a',body(1,4,2)),animal(2,'predator','a',body(1,4,2)),
      animal(0,'prey','a',body(1,5,1)),animal(1,'prey','b',body(1,5,1))]});
  const out = step(world,rules,before);
  expect(out.entries.filter(entry => entry.phase === 'capture')).toHaveLength(1);
  expect(out.state.animals.get(2)?.body).toEqual(body(1,5,3));
  expect(out.state.animals.get(3)?.body).toEqual(body(1,3,1));
  expect(out.state.animals.has(1)).toBe(true);
  expect(out.state.animals.has(0)).toBe(false);
});

it('bounds fungal biomass through growth, foundation, projection and restore', () => {
  const world = fixture('closed',false,1), defaults = configuration();
  const rules = {...defaults, fungus:{...defaults.fungus,
    feeding:{...defaults.fungus.feeding, retainedMatterPermille:1000}}};
  const foundation = {inventory:new Map([[0,stock(1,3,1)]]), fungus:new Map([[0,body(1,3,3)]]), animals:[]};
  const opening = foundFoodChain(world,[],rules,foundation);
  const out = step(world,rules,opening);
  expect(out.state.fungus.get(0)?.matter).toBe(1);
  expect(out.state.chemical.inventory.get(0)?.mineralMatter).toBe(1);
  expect(out.audit.closing.matter).toBe(out.audit.opening.matter);
  expect(() => foundFoodChain(world,[],rules,{...foundation,fungus:new Map([[0,body(2,3,3)]])})).toThrow(/fungal capacity/);
  const {integrity: _, ...snapshot} = saveFoodChain(world,[],rules,opening);
  snapshot.fungus[0][1][0] = 2;
  expect(() => restoreFoodChain(world,[],rules,{...snapshot,integrity:chemicalDigest(snapshot)})).toThrow(/fungal capacity/);

  const partition = (mixed: boolean) => {
    const base = fixture('open',mixed);
    const graph = {...base.graph, habitats:base.graph.habitats.map((h,i) =>
      ({...h,capacity: (mixed ? [4,1] : [3,1,1])[i]}))};
    return indexWorld(graph,base.ports,new Map([['a',3],['b',1],['c',1]]),base.connectorKinds);
  };
  const merged = partition(true), split = partition(false);
  const founder = foundFoodChain(merged,[],rules,{inventory:new Map(),fungus:new Map([[0,body(4,7,6)]]),animals:[]});
  const projected = projectFoodChain(merged,split,[],rules,founder);
  expect([...projected.fungus.values()].map(s => s.matter)).toEqual([3,1]);
  expect(projectFoodChain(split,merged,[],rules,projected).fungus).toEqual(founder.fungus);
});

it('binds the food checkpoint to fine capacities even when the aggregated epoch is identical', () => {
  const base = fixture('open',true);
  const w = indexWorld(base.graph,base.ports,new Map([['a',10],['b',10],['c',20]]),base.connectorKinds);
  const changed = indexWorld(base.graph,base.ports,new Map([['a',19],['b',1],['c',20]]),base.connectorKinds);
  const rules = configuration();
  const state = foundFoodChain(w,[],rules,{inventory:new Map(),fungus:new Map(),animals:[animal(0,'prey','c',body(2,4,4))]});
  const saved = saveFoodChain(w,[],rules,state);
  expect(() => restoreFoodChain(changed,[],rules,saved)).toThrow(/epoch/);
  const reordered = indexWorld(base.graph,new Map([...base.ports].reverse()),new Map([...w.capacities].reverse()),base.connectorKinds);
  expect(restoreFoodChain(reordered,[],rules,saved)).toEqual(state);
  expect(() => restoreFoodChain(w,[],rules,{...saved,version:'E1-Chemical-FoodChain/1'})).toThrow(/version/);
});

it('imports the food engine and checkpoint directly with Node 24 strip-only TypeScript support', async () => {
  const engine = new URL('./chemical-food-chain.ts',import.meta.url).href;
  const snapshot = new URL('./chemical-food-snapshot.ts',import.meta.url).href;
  await expect(promisify(execFile)(process.execPath, ['--input-type=module','-e',
    `await import(${JSON.stringify(engine)}); await import(${JSON.stringify(snapshot)});`],
    {env:{...process.env,NODE_OPTIONS:''}})).resolves.toMatchObject({stderr:''});
});

it('exports the proportional energy of each detritus withdrawal from the current homogeneous stock', () => {
  const w = fixture(), rules = configuration();
  const initial = foundFoodChain(w,[],rules,{inventory:new Map([0,1,2].map(i => [i,stock(2,10)])),
    fungus:new Map(),animals:[]});
  const checkpoint = saveFoodChain(w,[],rules,initial);
  const posting = {kind:'export',transactionId:'out',tick:1,process:'withdrawal',destination:'outside',
    port:{connector:'ab',fromRegion:'a',toRegion:'b'},cargo:stock(1,10)} as const;
  expect(() => stepFoodChain(w,[],rules,initial,{chemical:[posting]})).toThrow(/proportional/);
  expect(saveFoodChain(w,[],rules,initial)).toEqual(checkpoint);
  const report = stepFoodChain(w,[],rules,initial,{chemical:[{...posting,cargo:stock(1,5)}]});
  expect(report.state.chemical.inventory.get(0)?.detritus).toEqual({matter:1,chemicalEnergy:5});
  const odd = foundFoodChain(w,[],rules,{inventory:new Map([0,1,2].map(i => [i,stock(2,9)])),
    fungus:new Map(),animals:[]});
  const final = stepFoodChain(w,[],rules,odd,{chemical:[{...posting,cargo:stock(1,5)},
    {...posting,transactionId:'out-next',cargo:stock(1,4)}]});
  expect(final.audit.exported.chemicalEnergy).toBe(9n);
});

it('identifies the actual source and lot count even when two sources have the same cargo and port', () => {
  const w = fixture(), rules = configuration();
  const template = {origin:'basin',port:{connector:'ab',fromRegion:'a',toRegion:'b'},
    perLot:stock(1,2),rate:2,periodHours:1,activeHours:1,quotaLots:2};
  const sources = [{...template,id:'A'}, {...template,id:'B'}];
  const initial = foundFoodChain(w,sources,rules,{inventory:new Map(),fungus:new Map(),animals:[]});
  const reports = sources.map(source => stepFoodChain(w,sources,rules,initial,
    {chemical:[chemicalDelivery(w,source,initial.chemical,'delivery')!]}));
  expect(reports.map(report => report.cutFlows.chemical[0])).toMatchObject(
    [{kind:'source',supply:'A',lots:2},{kind:'source',supply:'B',lots:2}]);
  expect(foodLedgerDigest(reports[0])).not.toBe(foodLedgerDigest(reports[1]));
});

it('rejects splitLiving allocations that create or drop matter or use invalid quanta', () => {
  expect(() => splitLiving(body(1,2,2),[2,2],10)).toThrow();
  expect(() => splitLiving(body(1,0,0),[],10)).toThrow();
  expect(() => splitLiving(body(1,2,2),[-1,2],10)).toThrow();
  expect(() => splitLiving(body(1,2,3),[1],10)).toThrow();
  expect(() => splitLiving(body(1,2,2),[1],-1)).toThrow();
  expect(splitLiving(body(2,5,2),[1,0,1],1)).toEqual([body(1,3,1),body(0,0,0),body(1,2,1)]);
});

it('pays births with a feasible split of both matter and reserve before breaking ties by ID', () => {
  const w = fixture('closed'), base = configuration();
  const rules = {...base,prey:{...base.prey,feeding:{...base.prey.feeding,interval:3}}};
  const parents = [animal(0,'prey','a',body(1,5,5)),animal(1,'prey','a',body(3,5,5))];
  const fund = (animals: readonly ChemicalAnimal[], config: FoodChainRules) => foundFoodChain(w,[],config,
    {inventory:new Map([[0,stock(0,0,1)]]),fungus:new Map([[0,body(1,5,5)]]),animals});
  for (const animals of [parents,parents.map(parent => ({...parent,id:1-parent.id}))]) {
    const report = step(w,rules,fund(animals,rules),{pairs:[[0,1]]});
    expect(report.state.animals.get(2)?.body).toEqual(body(1,2,1));
    expect(report.audit.closing.matter).toBe(report.audit.opening.matter);
  }
  const tight = {...rules,prey:{...rules.prey,reservePerMatter:4}};
  const report = step(w,tight,fund([animal(0,'prey','a',body(3,2,2)),
    animal(1,'prey','a',body(2,8,8))],tight),{pairs:[[0,1]]});
  expect(report.state.animals.get(2)?.body).toEqual(body(1,2,1));
  expect(report.state.animals.get(0)?.body).toEqual(body(2,0,0));
  expect(report.state.animals.get(1)?.body).toEqual(body(2,5,5));
});

it('serializes the food journal canonically across save and restore', () => {
  const w = fixture('closed'), rules = configuration();
  const initial = foundFoodChain(w,[],rules,{inventory:new Map(),fungus:new Map(),
    animals:[animal(0,'predator','a',{storedEnergy:4,chemicalEnergy:4,matter:1})]});
  const restored = restoreFoodChain(w,[],rules,saveFoodChain(w,[],rules,initial));
  const continuous = step(w,rules,initial), replay = step(w,rules,restored);
  const serialize: (report: typeof continuous) => string = Reflect.get(foodChain,'serializeFoodLedger');
  expect(serialize).toBeTypeOf('function');
  expect(serialize(continuous)).toBe(serialize(replay));
  expect(JSON.parse(serialize(replay))[0][0]).toMatchObject({phase:'maintain'});
});

it('rejects saving, advancing or projecting a state under a different fine geometry', () => {
  const base = fixture('open',true), rules = configuration();
  const w = indexWorld(base.graph,base.ports,new Map([['a',10],['b',10],['c',20]]),base.connectorKinds);
  const changed = indexWorld(base.graph,base.ports,new Map([['a',19],['b',1],['c',20]]),base.connectorKinds);
  const founded = foundFoodChain(w,[],rules,{inventory:new Map(),fungus:new Map(),animals:[animal(0,'prey','c',body(2,6,6))]});
  const saved = saveFoodChain(w,[],rules,founded);
  const restored = restoreFoodChain(w,[],rules,saved);
  for (const state of [founded,restored,step(w,rules,restored).state]) {
    expect(() => saveFoodChain(changed,[],rules,state)).toThrow(/geometry epoch/);
    expect(() => step(changed,rules,state,{moves:[{animal:0,connector:'bc'}]})).toThrow(/geometry epoch/);
    expect(() => projectFoodChain(changed,w,[],rules,state)).toThrow(/geometry epoch/);
    expect(() => projectFoodChain(w,changed,[],rules,state)).toThrow(/capacity/);
    expect(() => saveFoodChain(w,[],rules,state)).not.toThrow();
  }
});

it('excludes auxiliary animal and nested body fields from journal entries and replay digests', () => {
  const w = fixture('closed'), rules = configuration();
  const founder = {...animal(0,'predator','a',body(1,4,4)),founderLabel:'fixture'};
  const founded = foundFoodChain(w,[],rules,{inventory:new Map(),fungus:new Map(),animals:[founder]});
  const confirmed = step(w,rules,founded).state;
  const resident = confirmed.animals.get(0)!;
  const decorated = {...confirmed,animals:new Map([[0,{...resident,founderLabel:'fixture',
    body:{...resident.body,note:'auxiliary'}}]])};
  const checkpoint = saveFoodChain(w,[],rules,decorated);
  const restored = restoreFoodChain(w,[],rules,checkpoint);
  const continuous = step(w,rules,decorated), replay = step(w,rules,restored);
  expect(continuous.entries).toEqual(replay.entries);
  expect(foodChain.serializeFoodLedger(continuous)).toBe(foodChain.serializeFoodLedger(replay));
  expect(foodLedgerDigest(continuous)).toBe(foodLedgerDigest(replay));
  expect(saveFoodChain(w,[],rules,continuous.state)).toEqual(saveFoodChain(w,[],rules,replay.state));
});

function checkFoodEpoch(original: DispersalWorld, different: DispersalWorld) {
  const rules = configuration();
  const founded = foundFoodChain(original,[],rules,{inventory:new Map(),fungus:new Map(),animals:[]});
  const saved = saveFoodChain(original,[],rules,founded);
  expect(() => restoreFoodChain(different,[],rules,saved)).toThrow(/epoch/);
  const restored = restoreFoodChain(original,[],rules,saved);
  for (const state of [founded,restored,step(original,rules,restored).state]) {
    expect(() => saveFoodChain(different,[],rules,state)).toThrow(/epoch/);
    expect(() => step(different,rules,state)).toThrow(/epoch/);
    expect(() => projectFoodChain(different,original,[],rules,state)).toThrow(/epoch/);
    expect(saveFoodChain(original,[],rules,state).chemical.epoch).toEqual(saved.chemical.epoch);
  }
  return {rules, founded, saved};
}

it('binds an explicit closed barrier independently of mansion’s unchanged physical topology', () => {
  const original = buildDispersalWorld('mansion');
  const connector = '0/3/8/3/5';
  expect(original.graph.boundaries.find(cut => cut.id === connector)?.state).toBe('closed');
  expect(new Map(original.graph.barriers).has(connector)).toBe(false);
  const explicit = changeDispersalBarrier(original,connector,'closed');
  expect(explicit.graph.signature).toBe(original.graph.signature);
  const {rules, founded, saved} = checkFoodEpoch(original,explicit);
  const projected = projectFoodChain(original,explicit,[],rules,founded);
  expect(() => saveFoodChain(original,[],rules,projected)).toThrow(/epoch/);
  const moved = saveFoodChain(explicit,[],rules,projected);
  expect(new Map(moved.chemical.epoch.barriers).get(connector)).toBe('closed');
  expect(restoreFoodChain(explicit,[],rules,moved)).toEqual(projected);
  expect(saveFoodChain(original,[],rules,projectFoodChain(explicit,original,[],rules,projected))).toEqual(saved);
}, 30000);

it('rejects an identical geometry with another seed across the food-chain operations', () => {
  const original = fixture();
  const other = {...original,graph:{...original.graph,seed:'another-seed'}};
  const {rules, founded} = checkFoodEpoch(original,other);
  expect(() => projectFoodChain(original,other,[],rules,founded)).toThrow(/building/);
});

it.each([
  {reservePerMatter:6, initialReserve:3, foodEnergy:4, retained:1, paid:1, heat:1},
  {reservePerMatter:6, initialReserve:3, foodEnergy:5, retained:2, paid:2, heat:2},
  {reservePerMatter:2, initialReserve:2, foodEnergy:5, retained:1, paid:1, heat:4},
])('funds growth only when the surviving reserve can pay the full interval ($reservePerMatter, $foodEnergy)', example => {
  const world = fixture('closed'), base = configuration();
  const rules = {...base,fungus:{...base.fungus,regulation:'growth-budget' as const,
    reservePerMatter:example.reservePerMatter,
    feeding:{...base.fungus.feeding,interval:3,biteMatter:2,retainedMatterPermille:1000,reservePermille:1000}}};
  const before = foundFoodChain(world,[],rules,{inventory:new Map([[0,stock(2,example.foodEnergy,1)]]),
    fungus:new Map([[0,body(1,example.initialReserve,example.initialReserve)]]),animals:[]});
  const ready = step(world,rules,step(world,rules,before).state).state;
  const result = step(world,rules,ready);
  expect(result.state.fungus.get(0)?.matter).toBe(example.retained);
  expect(result.state.chemical.inventory.get(0)?.mineralMatter).toBe(3-example.retained);
  expect(result.entries[1].heat.energy).toBe(example.paid);
  expect(result.audit.dissipated).toBe(BigInt(example.heat));
});

it.each([
  {cap:3, maintenance:2, matter:2, livingEnergy:2, reserve:1, lost:2, lostEnergy:1, heat:4, phase:'regress'},
  {cap:2, maintenance:2, matter:2, livingEnergy:1, reserve:0, lost:2, lostEnergy:2, heat:4, phase:'regress'},
  {cap:2, maintenance:3, matter:0, livingEnergy:0, reserve:0, lost:4, lostEnergy:2, heat:5, phase:'die'},
])('accounts for all retired tissue and caps remaining reserve ($cap, $maintenance)', e => {
  const world = fixture('closed'), base = configuration();
  const rules = {...base,fungus:{...base.fungus,regulation:'partial-regression' as const,
    reservePerMatter:e.cap,maintenance:e.maintenance}};
  const initial = foundFoodChain(world,[],rules,{inventory:new Map(),fungus:new Map([[0,body(4,7,5)]]),animals:[]});
  const result = step(world,rules,initial);
  expect(result.state.fungus.get(0) ?? body(0,0,0)).toEqual(body(e.matter,e.livingEnergy,e.reserve));
  expect(result.state.chemical.inventory.get(0)?.detritus).toEqual({matter:e.lost,chemicalEnergy:e.lostEnergy});
  expect(result.entries.map(entry=>entry.phase)).toEqual([e.phase]);
  expect(result.audit.dissipated).toBe(BigInt(e.heat));
  const snapshot = JSON.parse(JSON.stringify(saveFoodChain(world,[],rules,initial)));
  const restored = restoreFoodChain(world,[],rules,snapshot);
  expect(foodChain.serializeFoodLedger(step(world,rules,restored))).toBe(foodChain.serializeFoodLedger(result));
  expect(() => restoreFoodChain(world,[],base,snapshot)).toThrow(/contract/);
});

it('keeps the original fungal maintenance rule and rejects mixed or unknown regulation modes', () => {
  const world = fixture('closed'), rules = configuration();
  const founder = {inventory:new Map(),fungus:new Map([[0,body(4,5,3)]]),animals:[]};
  const result = step(world,rules,foundFoodChain(world,[],rules,founder));
  expect(result.entries[0].phase).toBe('die');
  expect(result.state.fungus.size).toBe(0);
  expect(result.state.chemical.inventory.get(0)?.detritus).toEqual({matter:4,chemicalEnergy:2});
  const invalid = {...rules,fungus:{...rules.fungus,regulation:['growth-budget','partial-regression']}} as unknown as FoodChainRules;
  expect(() => foundFoodChain(world,[],invalid,founder)).toThrow(/Unknown fungal regulation/);
});

it('exports proportional fungal mass and chemical energy after maintenance, with reserve recorded separately', () => {
  const w = fixture('closed'), base = configuration();
  const rules = {...base,fungus:{...base.fungus,regulation:'growth-budget-and-regression' as const}};
  const state = foundFoodChain(w,[],rules,{inventory:new Map([[0,stock(0,0,1)]]),
    fungus:new Map([[0,body(4,11,7)]]),animals:[]});
  const input = {chemical:[],harvest:{habitat:0,matter:1}};
  const out = stepFoodChain(w,[],rules,state,input);
  expect(out.entries.map(e=>e.phase)).toEqual(['maintain','harvest']);
  expect(out.entries[1].exported).toEqual(body(1,2,1));
  expect(out.state.fungus.get(0)).toEqual(body(3,5,2));
  expect(out.audit.exported).toEqual({matter:1n,chemicalEnergy:2n,water:0n});
  expect(out.byHabitat.get(0)?.exported).toEqual(out.audit.exported);
  expect(out.audit.dissipated).toBe(4n);
  expect(out.state.chemical.inventory.get(0)).toEqual(stock(0,0,1));
  const checkpoint = saveFoodChain(w,[],rules,state);
  const restored = restoreFoodChain(w,[],rules,JSON.parse(JSON.stringify(checkpoint)));
  const replay = stepFoodChain(w,[],rules,restored,input);
  expect(foodChain.serializeFoodLedger(replay)).toBe(foodChain.serializeFoodLedger(out));
  expect(saveFoodChain(w,[],rules,replay.state)).toEqual(saveFoodChain(w,[],rules,out.state));
  expect(() => stepFoodChain(w,[],rules,state,{...input,harvest:{habitat:0,matter:5}})).toThrow(/Invalid fungal harvest/);
  expect(saveFoodChain(w,[],rules,state)).toEqual(checkpoint);
});

it('applies both experimental mechanisms and keeps all four rule contracts distinct', () => {
  const w = fixture('closed'), base = configuration();
  const foundation = {inventory:new Map([[0,stock(1,12,1)]]),fungus:new Map([[0,body(4,4,4)]]),animals:[]};
  const regulation = [undefined,'growth-budget','partial-regression','growth-budget-and-regression'] as const;
  const modes = regulation.map(mode=>({...base,fungus:{...base.fungus,regulation:mode,maintenance:2,reservePerMatter:2,
    feeding:{...base.fungus.feeding,interval:2,retainedMatterPermille:1000,reservePermille:1000}}}));
  const checkpoints = modes.map(rules=>saveFoodChain(w,[],rules,foundFoodChain(w,[],rules,foundation)));
  for (const [i,saved] of checkpoints.entries()) {
    for (const [j,rules] of modes.entries()) {
      if (i===j) expect(saveFoodChain(w,[],rules,restoreFoodChain(w,[],rules,saved))).toEqual(saved);
      else expect(() => restoreFoodChain(w,[],rules,saved)).toThrow(/contract/);
    }
  }
  const rules = modes[3];
  const first = step(w,rules,restoreFoodChain(w,[],rules,checkpoints[3]));
  expect(first.entries[0].phase).toBe('regress');
  expect(first.state.fungus.get(0)?.matter).toBe(2);
  const second = step(w,rules,first.state);
  expect(second.entries.map(e=>e.phase)).toEqual(['grow','maintain']);
  expect(second.state.fungus.get(0)).toEqual(body(2,0,0));
  const next = step(w,rules,second.state);
  expect(next.entries[0].phase).toBe('die');
  expect(() => stepFoodChain(w,[],modes[2],restoreFoodChain(w,[],modes[2],checkpoints[2]),
    {chemical:[],harvest:{habitat:0,matter:1}})).toThrow(/experimental regulation/);
});

it('keeps both parents funded through the feeding gap and searches an asymmetric payment', () => {
  const w = fixture('closed'), base = configuration();
  const rules = {...base,prey:{...base.prey,reproduction:'maintenance-budget' as const,
    feeding:{...base.prey.feeding,interval:4}}};
  const founder = (reserveA: number, reserveB: number, r: FoodChainRules = rules) => foundFoodChain(w,[],r,
    {inventory:new Map([[0,stock(0,0,1)]]),fungus:new Map([[0,body(1,7,7)]]),
      animals:[animal(0,'prey','a',body(2,reserveA,reserveA)),animal(1,'prey','a',body(2,reserveB,reserveB))]});
  const input = {pairs:[[0,1]] as const};
  const permitted = founder(3,6); // The hour leaves 2 and 5 E before birth. Only the second parent can pay 3 E.
  const out = step(w,rules,permitted,input);
  expect(out.entries.map(e=>e.phase)).toContain('birth');
  expect([out.state.animals.get(0)?.body.storedEnergy,out.state.animals.get(1)?.body.storedEnergy]).toEqual([2,2]);
  expect(out.audit.opening.chemicalEnergy).toBe(out.audit.closing.chemicalEnergy+out.audit.dissipated);
  const checkpoint = saveFoodChain(w,[],rules,permitted);
  const replay = step(w,rules,restoreFoodChain(w,[],rules,JSON.parse(JSON.stringify(checkpoint))),input);
  expect(foodChain.serializeFoodLedger(replay)).toBe(foodChain.serializeFoodLedger(out));
  expect(saveFoodChain(w,[],rules,replay.state)).toEqual(saveFoodChain(w,[],rules,out.state));

  const deficient = founder(3,5);
  const rejected = step(w,rules,deficient,input);
  expect(rejected).toEqual(step(w,rules,deficient));
  const legacy = {...rules,prey:{...rules.prey,reproduction:undefined}};
  expect(step(w,legacy,founder(3,5,legacy),input)
    .entries.some(e=>e.phase==='birth')).toBe(true);
  expect(() => restoreFoodChain(w,[],legacy,checkpoint)).toThrow(/contract/);
});

it('rejects a birth if a parent cannot store the required reserve after donating mass', () => {
  const w = fixture('closed'), base = configuration();
  const rules = {...base,prey:{...base.prey,reproduction:'maintenance-budget' as const,reservePerMatter:2,birth:{...base.prey.birth,matter:2,energy:1},
    feeding:{...base.prey.feeding,interval:5}}};
  const founded = foundFoodChain(w,[],rules,{inventory:new Map([[0,stock(0,0,1)]]),
    fungus:new Map([[0,body(1,5,5)]]),animals:[animal(0,'prey','a',body(2,4,4)),animal(1,'prey','a',body(3,6,6))]});
  // The pair has 3 + 5 E after maintenance and can pay 2 E while leaving 6 E total.
  // Any 2 M transfer leaves a one-M parent whose cap is below the 3 E floor.
  const result = step(w,rules,founded,{pairs:[[0,1]]});
  expect(result.entries.some(e=>e.phase==='birth')).toBe(false);
});

it('reuses the exact integer food split and keeps the smaller bite when two partial meals tie', () => {
  const w = fixture('closed'), base = configuration();
  const rules: FoodChainRules = {...base,prey:{...base.prey,physiology:{satiation:true},
    feeding:{...base.prey.feeding,interval:3,biteMatter:2,reservePermille:1000},
    birth:{...base.prey.birth,reserve:2}}};
  const opening = foundFoodChain(w,[],rules,{inventory:new Map([[0,stock(0,0,1)]]),
    fungus:new Map([[0,body(4,10,10)]]),animals:[animal(0,'prey','a',body(2,2,2))]});
  const ready = step(w,rules,step(w,rules,opening).state).state;
  const result = step(w,rules,ready);
  expect(result.feedingDecisions).toMatchObject([{bite:1,deficit:'3',remainingDeficit:'2',evaluated:3,tiedBest:2,reason:'partial-budget'}]);
  expect(result.state.animals.get(0)?.body).toEqual(body(2,0,0));
  expect(result.audit.opening.chemicalEnergy).toBe(result.audit.closing.chemicalEnergy+result.audit.dissipated);
  const saved = saveFoodChain(w,[],rules,ready);
  const replay = step(w,rules,restoreFoodChain(w,[],rules,JSON.parse(JSON.stringify(saved))));
  expect(foodChain.serializeFoodLedger(replay)).toBe(foodChain.serializeFoodLedger(result));
  expect(() => restoreFoodChain(w,[],base,saved)).toThrow(/contract/);
});

it('caps adult growth, routes surplus to minerals and rejects an incompatible newborn profile', () => {
  const w = fixture('closed'), base = configuration();
  const rules: FoodChainRules = {...base,prey:{...base.prey,physiology:{adultMatter:4},
    feeding:{...base.prey.feeding,biteMatter:4,retainedMatterPermille:500,reservePermille:1000}}};
  const founder = {inventory:new Map([[0,stock(0,0,1)]]),fungus:new Map([[0,body(8,40,40)]]),
    animals:[animal(0,'prey','a',body(3,2,2))]};
  const result = step(w,rules,foundFoodChain(w,[],rules,founder));
  expect(result.state.animals.get(0)?.body.matter).toBe(4);
  expect(result.state.chemical.inventory.get(0)?.mineralMatter).toBe(3);
  expect(() => foundFoodChain(w,[],{...rules,prey:{...rules.prey,birth:{...rules.prey.birth,matter:5}}},founder))
    .toThrow(/adult mass/);
  expect(() => foundFoodChain(w,[],{...rules,prey:{...rules.prey,feeding:{...rules.prey.feeding,interval:3}}},founder))
    .toThrow(/first feeding gap/);
});

it('charges mass-based maintenance and uses each body after donation in the birth budget', () => {
  const w = fixture('closed'), base = configuration();
  const rules: FoodChainRules = {...base,prey:{...base.prey,reproduction:'maintenance-budget',physiology:{maintenanceMatterStep:2},
    feeding:{...base.prey.feeding,interval:3},birth:{...base.prey.birth,reserve:2}}};
  const founder = {inventory:new Map([[0,stock(0,0,1)]]),fungus:new Map([[0,body(1,10,10)]]),
    animals:[animal(0,'prey','a',body(3,5,5)),animal(1,'prey','a',body(3,5,5))]};
  const result = step(w,rules,foundFoodChain(w,[],rules,founder),{pairs:[[0,1]]});
  expect(result.entries.filter(e=>e.phase==='maintain'&&e.debits[0].kind==='animal').map(e=>e.heat.energy)).toEqual([2,2]);
  const birth = result.entries.find(e=>e.phase==='birth');
  expect(birth?.heat.energy).toBe(1);
  expect([...result.state.animals.values()].map(a=>a.body)).toEqual([body(2,1,1),body(3,2,2),body(1,2,2)]);
  const lessReserve = {...founder,animals:[founder.animals[0],animal(1,'prey','a',body(3,4,4))]};
  const opening = foundFoodChain(w,[],rules,lessReserve);
  const rejection = step(w,rules,opening,{pairs:[[0,1]]});
  expect(rejection).toEqual(step(w,rules,opening));
});
