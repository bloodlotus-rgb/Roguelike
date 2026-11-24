import { expect, it } from 'vitest';
import { chemicalDelivery, chemicalDigest, type ChemicalSupply } from './chemical-ledger.ts';
import { planChemicalTransport } from './chemical-transport.ts';
import { saveChemical } from './chemical-snapshot.ts';
import { foodLedgerDigest, stepFoodChain } from './chemical-food-chain.ts';
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
