import { chemicalDigest, type ChemicalSupply } from './chemical-ledger.ts';
import { projectChemicalState, restoreChemical, saveChemical } from './chemical-snapshot.ts';
import { apportion, compareChemicalIds } from './chemical-transport.ts';
import { splitLiving } from './chemical-food-chain.ts';
import { foodChainVersion as version, quantum, regionCapacity, validateFoodState, type AnimalKind, type ChemicalAnimal, type FoodChainRules, type FoodChainState,
  type LivingStock } from './chemical-food-contract.ts';
import type { DispersalWorld } from './dispersal-world.ts';

function fineGeometry(world: DispersalWorld) {
  const byId = ([a]: readonly [string, unknown], [b]: readonly [string, unknown]) => compareChemicalIds(a,b);
  return chemicalDigest([
    [...world.graph.regionToHabitat].sort(byId),
    [...world.capacities].sort(byId),
    [...world.ports].sort(byId),
    [...(world.connectorKinds ?? new Map(world.graph.boundaries.map(cut => [cut.id, cut.kind])))].sort(byId),
  ]);
}
type BodyRow = [number, number, number];
function encodeBody(body: LivingStock): BodyRow {
  return [body.matter, body.chemicalEnergy, body.storedEnergy];
}
function decodeBody([matter, chemicalEnergy, storedEnergy]: BodyRow): LivingStock {
  return {matter, chemicalEnergy, storedEnergy};
}
type AnimalRow = [number, AnimalKind, string, number, BodyRow];

export function saveFoodChain(world: DispersalWorld, sources: readonly ChemicalSupply[], rules: FoodChainRules,
  state: FoodChainState) {
  validateFoodState(world, sources, rules, state);
  const payload = {version, contract: state.contract, geometry: fineGeometry(world), chemical: saveChemical(world, sources, state.chemical),
    fungus: [...state.fungus].sort(([a],[b]) => a - b).map(([id, body]): [number, BodyRow] => [id, encodeBody(body)]),
    animals: [...state.animals].sort(([a],[b]) => a - b)
      .map(([,animal]): AnimalRow => [animal.id, animal.kind, animal.region, animal.bornAt, encodeBody(animal.body)]),
    nextAnimalId: state.nextAnimalId};
  return {...payload, integrity: chemicalDigest(payload)};
}

export function restoreFoodChain(world: DispersalWorld, sources: readonly ChemicalSupply[], rules: FoodChainRules,
  saved: unknown): FoodChainState {
  if (!saved || typeof saved !== 'object' || !('version' in saved) || saved.version !== version) {
    throw new Error('Unsupported food-chain snapshot version');
  }
  const {integrity, ...payload} = saved as ReturnType<typeof saveFoodChain>;
  if (integrity !== chemicalDigest(payload)) throw new Error('Food-chain snapshot integrity mismatch');
  if (payload.geometry !== fineGeometry(world)) throw new Error('Incompatible food-chain geometry epoch');
  const chemical = restoreChemical(world, sources, payload.chemical);
  const fungus = new Map(payload.fungus.map(([id, body]) => [id, decodeBody(body)]));
  const animals = new Map<number, ChemicalAnimal>(payload.animals.map(([id, kind, region, bornAt, row]) =>
    [id, {id, kind, region, bornAt, body: decodeBody(row)}]));
  if (fungus.size !== payload.fungus.length || animals.size !== payload.animals.length) {
    throw new Error('Duplicate food-chain snapshot account');
  }
  const state = {chemical, fungus, animals, nextAnimalId: payload.nextAnimalId, contract: payload.contract};
  if (saveFoodChain(world, sources, rules, state).integrity !== integrity) throw new Error('Noncanonical food-chain snapshot');
  return state;
}

export function projectFoodChain(oldWorld: DispersalWorld, newWorld: DispersalWorld, sources: readonly ChemicalSupply[],
  rules: FoodChainRules, state: FoodChainState): FoodChainState {
  validateFoodState(oldWorld, sources, rules, state);
  const chemical = projectChemicalState(oldWorld, newWorld, state.chemical, sources);
  const overlaps = new Map<number, Map<number, number>>();
  for (const [region, before] of oldWorld.graph.regionToHabitat) {
    if (!state.fungus.has(before)) continue;
    const after = newWorld.graph.regionToHabitat.get(region)!;
    const destinations = overlaps.get(before) ?? new Map<number, number>();
    destinations.set(after, quantum((destinations.get(after) ?? 0) + regionCapacity(oldWorld, region)));
    overlaps.set(before, destinations);
  }
  const fungus = new Map<number, LivingStock>();
  for (const [id, stock] of [...state.fungus].sort(([a],[b]) => a - b)) {
    const destinations = [...overlaps.get(id)!].sort(([a],[b]) => a - b);
    const mass = apportion(stock.matter, destinations.map(([,capacity]) => capacity));
    const shares = splitLiving(stock, mass, rules.fungus.reservePerMatter);
    destinations.forEach(([to], i) => {
      const share = shares[i];
      if (!share.matter) return;
      const old = fungus.get(to);
      fungus.set(to, {matter: quantum(share.matter + (old?.matter ?? 0)),
        chemicalEnergy: quantum(share.chemicalEnergy + (old?.chemicalEnergy ?? 0)),
        storedEnergy: quantum(share.storedEnergy + (old?.storedEnergy ?? 0))});
    });
  }
  const totals = (accounts: FoodChainState['fungus']) => [...accounts.values()].reduce(
    ([m,e,r], stock) => [m + BigInt(stock.matter), e + BigInt(stock.chemicalEnergy), r + BigInt(stock.storedEnergy)],
    [0n,0n,0n]);
  const before = totals(state.fungus), after = totals(fungus);
  if (before.some((amount, i) => amount !== after[i])) throw new Error('Unbalanced fungal projection');
  const projected = {...state, chemical, fungus};
  validateFoodState(newWorld, sources, rules, projected);
  return projected;
}
