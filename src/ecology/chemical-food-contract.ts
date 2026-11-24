import { sections, type Mode } from '../core/spatial.ts';
import { chemicalDigest, validateChemicalState, type ChemicalState, type ChemicalSupply,
  type OrganicStock } from './chemical-ledger.ts';
import type { DispersalWorld } from './dispersal-world.ts';

export interface LivingStock extends OrganicStock {
  readonly storedEnergy: number;
}
export type AnimalKind = 'prey' | 'predator';
export interface ChemicalAnimal {
  readonly id: number;
  readonly kind: AnimalKind;
  readonly region: string;
  readonly bornAt: number;
  readonly body: LivingStock;
}
export interface FoodChainState {
  readonly chemical: ChemicalState;
  readonly fungus: ReadonlyMap<number, LivingStock>;
  readonly animals: ReadonlyMap<number, ChemicalAnimal>;
  readonly nextAnimalId: number;
  readonly contract: string;
}
export interface Feeding {
  readonly interval: number;
  /** A grazer or fungus takes up to this much. A capture consumes a whole prey. */
  readonly biteMatter: number;
  readonly retainedMatterPermille: number;
  readonly reservePermille: number;
  readonly residueEnergyPermille: number;
}
interface Metabolism {
  readonly maintenance: number;
  readonly reservePerMatter: number;
}
export interface AnimalRules extends Metabolism {
  readonly feeding: Omit<Feeding, 'biteMatter'>;
  readonly movement: { readonly modes: readonly Mode[]; readonly width: number;
    readonly height: number; readonly cost: number };
  readonly birth: { readonly interval: number; readonly adultAge: number; readonly matter: number;
    readonly energy: number; readonly reserve: number; readonly heat: number };
}
export interface FoodChainRules {
  readonly fungus: Metabolism & { readonly feeding: Feeding };
  readonly prey: AnimalRules & { readonly feeding: Feeding };
  readonly predator: AnimalRules;
}

export const permille = 1000;
export const zeroLiving: LivingStock = Object.freeze({matter: 0, chemicalEnergy: 0, storedEnergy: 0});
export function quantum(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid food-chain quantum');
  return value;
}
function positive(value: number) {
  if (!quantum(value)) throw new Error('Expected positive food-chain parameter');
  return value;
}
export function reserveCapacity(matter: number, perMatter: number) {
  return BigInt(matter) * BigInt(perMatter);
}
export function checkLiving(stock: LivingStock, perMatter: number) {
  const {matter, chemicalEnergy, storedEnergy} = stock;
  quantum(matter); quantum(chemicalEnergy); quantum(storedEnergy);
  if ((!matter && chemicalEnergy) || storedEnergy > chemicalEnergy ||
      BigInt(storedEnergy) > reserveCapacity(matter, perMatter)) throw new Error('Invalid living carrier or reserve');
}
const modes = new Set(Object.values(sections).flatMap(section => section.modes));
function feeding(rule: Omit<Feeding, 'biteMatter'>) {
  const {interval, retainedMatterPermille, reservePermille, residueEnergyPermille} = rule;
  positive(interval);
  if (quantum(retainedMatterPermille) > permille ||
      quantum(reservePermille) + quantum(residueEnergyPermille) > permille) throw new Error('Invalid assimilation fractions');
  return [interval, retainedMatterPermille, reservePermille, residueEnergyPermille];
}
function metabolism(rule: Metabolism) {
  return [positive(rule.maintenance), positive(rule.reservePerMatter)];
}
function animalRules(rule: AnimalRules) {
  const {movement, birth} = rule;
  if (!movement.modes.length || new Set(movement.modes).size !== movement.modes.length ||
      movement.modes.some(mode => !modes.has(mode)) ||
      !Number.isFinite(movement.width) || movement.width <= 0 ||
      !Number.isFinite(movement.height) || movement.height <= 0) throw new Error('Invalid movement profile');
  const offspring = {matter: positive(birth.matter), chemicalEnergy: positive(birth.energy),
    storedEnergy: positive(birth.reserve)};
  checkLiving(offspring, rule.reservePerMatter);
  quantum(birth.energy + quantum(birth.heat));
  return [metabolism(rule), feeding(rule.feeding), [[...movement.modes].sort(), movement.width, movement.height,
    quantum(movement.cost)], [positive(birth.interval), positive(birth.adultAge), offspring, birth.heat]];
}

export function foodRulesSignature(rules: FoodChainRules) {
  if (rules.fungus.feeding.residueEnergyPermille !== 0 || rules.prey.feeding.residueEnergyPermille !== 0) {
    throw new Error('Mineral residue cannot carry chemical energy');
  }
  return chemicalDigest(['E1-Chemical-FoodChain/1', metabolism(rules.fungus), feeding(rules.fungus.feeding),
    positive(rules.fungus.feeding.biteMatter), animalRules(rules.prey), positive(rules.prey.feeding.biteMatter),
    animalRules(rules.predator)]);
}

export function regionHabitat(world: DispersalWorld, region: string) {
  const habitat = world.graph.regionToHabitat.get(region);
  if (habitat === undefined || !world.graph.habitats[habitat]) throw new Error('Unknown animal region');
  return habitat;
}

export function regionCapacity(world: DispersalWorld, region: string) {
  const capacity = world.capacities.get(region);
  if (capacity === undefined) throw new Error('Missing fine region capacity');
  return quantum(capacity);
}

export function validateFoodState(world: DispersalWorld, sources: readonly ChemicalSupply[], rules: FoodChainRules,
  state: FoodChainState) {
  const {contract} = validateChemicalState(world, sources, state.chemical);
  if (state.chemical.topology !== world.graph.signature || state.chemical.contract !== contract ||
      state.contract !== chemicalDigest([contract, foodRulesSignature(rules)])) throw new Error('Incompatible food-chain contract or epoch');
  quantum(state.nextAnimalId);
  for (const [id, stock] of state.fungus) {
    if (!Number.isSafeInteger(id) || !world.graph.habitats[id] || !stock.matter) throw new Error('Invalid fungal account');
    checkLiving(stock, rules.fungus.reservePerMatter);
  }
  const occupancy = new Map<string, number>();
  for (const [id, animal] of state.animals) {
    if (quantum(id) !== animal.id || id >= state.nextAnimalId || quantum(animal.bornAt) > state.chemical.tick ||
        (animal.kind !== 'prey' && animal.kind !== 'predator') || !animal.body.matter) throw new Error('Invalid animal record');
    regionHabitat(world, animal.region);
    checkLiving(animal.body, rules[animal.kind].reservePerMatter);
    const occupied = (occupancy.get(animal.region) ?? 0) + animal.body.matter;
    if (occupied > regionCapacity(world, animal.region)) throw new Error('Animal capacity exceeded');
    occupancy.set(animal.region, occupied);
  }
  return occupancy;
}

export interface FoodFoundation {
  readonly inventory: ChemicalState['inventory'];
  readonly fungus: FoodChainState['fungus'];
  readonly animals: readonly ChemicalAnimal[];
}

/** Declared opening inventory and founder bodies for a new scenario. */
export function foundFoodChain(world: DispersalWorld, sources: readonly ChemicalSupply[], rules: FoodChainRules,
  foundation: FoodFoundation): FoodChainState {
  const opening = {topology: world.graph.signature, tick: 0, inventory: structuredClone(new Map(foundation.inventory)),
    heat: new Map<number, number>(), lotsUsed: new Map<string, number>()};
  const {contract} = validateChemicalState(world, sources, opening);
  const animals = new Map(foundation.animals.map(animal => [animal.id, structuredClone(animal)]));
  if (animals.size !== foundation.animals.length) throw new Error('Duplicate founder animal');
  const nextAnimalId = foundation.animals.reduce((next, animal) => Math.max(next, animal.id + 1), 0);
  const state = {chemical: {...opening, contract}, fungus: structuredClone(new Map(foundation.fungus)),
    animals, nextAnimalId, contract: chemicalDigest([contract, foodRulesSignature(rules)])};
  validateFoodState(world, sources, rules, state);
  return state;
}
