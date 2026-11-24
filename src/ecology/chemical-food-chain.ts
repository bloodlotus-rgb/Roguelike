import { sections } from '../core/spatial.ts';
import { applyChemicalHour, chemicalDigest, type ChemicalInventory, type ChemicalPosting,
  type ChemicalSupply } from './chemical-ledger.ts';
import { apportion, compareChemicalIds } from './chemical-transport.ts';
import { checkLiving, permille, quantum, regionCapacity, regionHabitat, reserveCapacity, validateFoodState,
  zeroLiving, type AnimalRules, type ChemicalAnimal, type Feeding, type FoodChainRules, type FoodChainState,
  type LivingStock } from './chemical-food-contract.ts';
import type { DispersalWorld } from './dispersal-world.ts';

export interface FoodHourInput {
  readonly chemical: readonly ChemicalPosting[];
  readonly moves?: readonly { readonly animal: number; readonly connector: string }[];
  readonly pairs?: readonly (readonly [number, number])[];
}
type Phase = 'move' | 'grow' | 'graze' | 'capture' | 'maintain' | 'die' | 'birth';
type Account =
  | { readonly kind: 'stock'; readonly habitat: number; readonly stock: ChemicalInventory | undefined }
  | { readonly kind: 'fungus'; readonly habitat: number; readonly stock: LivingStock | undefined }
  | { readonly kind: 'animal'; readonly id: number; readonly stock: ChemicalAnimal | undefined };
interface FoodPosting {
  readonly id: number;
  readonly tick: number;
  readonly phase: Phase;
  readonly debits: readonly Account[];
  readonly credits: readonly Account[];
  readonly heat: { readonly habitat: number; readonly energy: number };
  readonly crossing?: { readonly connector: string; readonly from: number; readonly to: number; readonly cargo: LivingStock };
}

const empty: ChemicalInventory = {detritus: {matter: 0, chemicalEnergy: 0}, mineralMatter: 0, water: 0};
const numeric = (a: number, b: number) => a - b;
const orderedAnimals = (animals: FoodChainState['animals']) => [...animals.values()].sort((a,b) => a.id - b.id);
const fraction = (value: number, rate: number) => Number(BigInt(value) * BigInt(rate) / BigInt(permille));
function reserveRoom(matter: number, rate: number, requested: bigint) {
  const capacity = reserveCapacity(matter, rate);
  return quantum(Number(capacity < requested ? capacity : requested));
}

export function splitLiving(stock: LivingStock, mass: readonly number[], reservePerMatter: number) {
  const energy = apportion(stock.chemicalEnergy, mass);
  const capacity = energy.map((part, i) => reserveRoom(mass[i], reservePerMatter, BigInt(part)));
  const reserve = apportion(stock.storedEnergy, capacity);
  return mass.map((matter, i) => ({matter, chemicalEnergy: energy[i], storedEnergy: reserve[i]}));
}

type Balance = {matter: bigint; chemicalEnergy: bigint; water: bigint};
const zero: Balance = {matter: 0n, chemicalEnergy: 0n, water: 0n};
function sum(a: Balance, b: Balance, sign = 1n): Balance {
  return {matter: a.matter + sign * b.matter, chemicalEnergy: a.chemicalEnergy + sign * b.chemicalEnergy,
    water: a.water + sign * b.water};
}
function heat(energy: bigint): Balance {
  return {...zero, chemicalEnergy: energy};
}
function balance(stock: ChemicalInventory | LivingStock): Balance {
  if ('detritus' in stock) return {matter: BigInt(stock.detritus.matter) + BigInt(stock.mineralMatter),
    chemicalEnergy: BigInt(stock.detritus.chemicalEnergy), water: BigInt(stock.water)};
  return {matter: BigInt(stock.matter), chemicalEnergy: BigInt(stock.chemicalEnergy), water: 0n};
}
function assertBalance(a: Balance, b: Balance) {
  if (a.matter !== b.matter || a.chemicalEnergy !== b.chemicalEnergy || a.water !== b.water) {
    throw new Error('Unbalanced food-chain ledger');
  }
}
function accountBalance(account: Account) {
  return balance(account.kind === 'animal' ? account.stock?.body ?? zeroLiving : account.stock ?? zeroLiving);
}

function consumeReserve(stock: LivingStock, cost: number): LivingStock {
  return {...stock, chemicalEnergy: quantum(stock.chemicalEnergy - cost), storedEnergy: quantum(stock.storedEnergy - cost)};
}

function assimilate(body: LivingStock, food: LivingStock, rule: Omit<Feeding, 'biteMatter'>,
  reservePerMatter: number, room: number, organicResidue = false) {
  const retained = Math.min(room, fraction(food.matter, rule.retainedMatterPermille));
  const matter = quantum(body.matter + retained);
  const reserve = reserveRoom(matter, reservePerMatter,
    BigInt(body.storedEnergy) + BigInt(fraction(food.chemicalEnergy, rule.reservePermille))) - body.storedEnergy;
  const residueMatter = food.matter - retained;
  const residueEnergy = organicResidue && residueMatter ? fraction(food.chemicalEnergy, rule.residueEnergyPermille) : 0;
  return {body: {matter, chemicalEnergy: quantum(body.chemicalEnergy + reserve), storedEnergy: body.storedEnergy + reserve},
    residue: {matter: residueMatter, chemicalEnergy: residueEnergy},
    heat: food.chemicalEnergy - reserve - residueEnergy};
}

/** A single hour writes to private maps. An exception discards the entire draft. */
class Hour {
  readonly inventory: Map<number, ChemicalInventory>;
  readonly fungus: Map<number, LivingStock>;
  readonly animals: Map<number, ChemicalAnimal>;
  readonly heat: Map<number, number>;
  readonly entries: FoodPosting[] = [];
  readonly occupancy: Map<string, number>;
  nextAnimalId: number;

  constructor(readonly world: DispersalWorld, readonly rules: FoodChainRules, readonly before: FoodChainState,
    readonly chemical: ReturnType<typeof applyChemicalHour>, occupancy: Map<string, number>) {
    this.inventory = new Map(chemical.state.inventory);
    this.heat = new Map(chemical.state.heat);
    this.fungus = new Map(before.fungus);
    this.animals = new Map(before.animals);
    this.nextAnimalId = before.nextAnimalId;
    this.occupancy = occupancy;
  }

  get tick() { return this.chemical.state.tick; }
  stock(habitat: number) { return this.inventory.get(habitat) ?? empty; }
  space(region: string) { return regionCapacity(this.world, region) - (this.occupancy.get(region) ?? 0); }

  post(phase: Phase, habitat: number, energy: number, credits: readonly Account[], crossing?: FoodPosting['crossing']) {
    quantum(energy);
    const debits = credits.map((entry): Account => {
      switch (entry.kind) {
        case 'stock': return {...entry, stock: this.inventory.get(entry.habitat)};
        case 'fungus': return {...entry, stock: this.fungus.get(entry.habitat)};
        case 'animal': return {...entry, stock: this.animals.get(entry.id)};
      }
    });
    assertBalance(debits.reduce((total, entry) => sum(total, accountBalance(entry)), zero),
      credits.reduce((total, entry) => sum(total, accountBalance(entry)), heat(BigInt(energy))));
    for (const entry of credits) {
      switch (entry.kind) {
        case 'stock':
          if (!entry.stock) throw new Error('Missing stock after food-chain posting');
          checkLiving({...entry.stock.detritus, storedEnergy: 0}, 0);
          quantum(entry.stock.mineralMatter); quantum(entry.stock.water);
          this.inventory.set(entry.habitat, entry.stock);
          break;
        case 'fungus':
          if (entry.stock) {
            checkLiving(entry.stock, this.rules.fungus.reservePerMatter);
            this.fungus.set(entry.habitat, entry.stock);
          } else this.fungus.delete(entry.habitat);
          break;
        case 'animal': {
          const prior = this.animals.get(entry.id);
          if (prior) this.occupancy.set(prior.region, (this.occupancy.get(prior.region) ?? 0) - prior.body.matter);
          if (entry.stock) {
            if (!entry.stock.body.matter || entry.stock.body.matter > this.space(entry.stock.region)) {
              throw new Error('Animal capacity exceeded by posting');
            }
            checkLiving(entry.stock.body, this.rules[entry.stock.kind].reservePerMatter);
            this.occupancy.set(entry.stock.region, (this.occupancy.get(entry.stock.region) ?? 0) + entry.stock.body.matter);
            this.animals.set(entry.id, entry.stock);
          } else this.animals.delete(entry.id);
          break;
        }
      }
    }
    if (energy) this.heat.set(habitat, quantum((this.heat.get(habitat) ?? 0) + energy));
    this.entries.push({id: this.entries.length, tick: this.tick, phase, debits, credits, heat: {habitat, energy}, crossing});
  }

  move(requests: NonNullable<FoodHourInput['moves']>) {
    const claimed = new Set<number>(), incoming = new Map<string, number>();
    const candidates = requests.map(({animal, connector}) => {
      const body = this.animals.get(animal);
      if (!body || claimed.has(animal)) throw new Error('Unknown or repeated moving animal');
      claimed.add(animal);
      const ends = this.world.ports.get(connector);
      if (!ends || !ends.includes(body.region) || ends[0] === ends[1]) throw new Error('Invalid animal connector');
      const direction = ends[0] === body.region ? 0 : 1;
      return {body, connector, direction, destination: ends[1 - direction]};
    }).sort((a,b) => compareChemicalIds(a.connector,b.connector) || a.direction - b.direction || a.body.id - b.body.id);
    const accepted = [];
    for (const {body, connector, direction, destination} of candidates) {
      const from = regionHabitat(this.world, body.region), to = regionHabitat(this.world, destination);
      const boundary = this.world.graph.incident[from].map(i => this.world.graph.boundaries[i]).find(cut => cut.id === connector);
      // Only physical cuts between habitats are traversed in this stage.
      if (!boundary) {
        if (from === to) continue;
        throw new Error('Animal route lacks a physical cut');
      }
      if (boundary.from !== (direction === 0 ? from : to) || boundary.to !== (direction === 0 ? to : from)) {
        throw new Error('Animal cut endpoints differ from ports');
      }
      const profile = this.rules[body.kind].movement, section = sections[boundary.kind];
      if (boundary.state === 'closed' || boundary.state === 'blocked' || (section.downOnly && direction !== 0) ||
          profile.width > section.width || profile.height > section.clearance ||
          !(boundary.state === 'flooded' ? profile.modes.includes('swim') :
            profile.modes.some(mode => section.modes.includes(mode))) || body.body.storedEnergy < profile.cost) continue;
      const reserved = incoming.get(destination) ?? 0;
      if (body.body.matter > this.space(destination) - reserved) continue;
      incoming.set(destination, reserved + body.body.matter);
      accepted.push({body, from, to, connector, destination, cost: profile.cost});
    }
    // All departures and ingress capacity were reserved before any location was changed.
    for (const {body, from, to, connector, destination, cost} of accepted) {
      const cargo = consumeReserve(body.body, cost);
      this.post('move', from, cost, [{kind: 'animal', id: body.id, stock: {...body, region: destination, body: cargo}}],
        {connector, from, to, cargo});
    }
  }

  grow() {
    const rule = this.rules.fungus;
    if (this.tick % rule.feeding.interval) return;
    for (const habitat of [...this.fungus.keys()].sort(numeric)) {
      const body = this.fungus.get(habitat)!;
      const stock = this.stock(habitat), mass = Math.min(rule.feeding.biteMatter, stock.detritus.matter);
      if (!mass || !stock.water) continue;
      const [food, remainder] = splitLiving({...stock.detritus, storedEnergy: 0}, [mass, stock.detritus.matter - mass], 0);
      const result = assimilate(body, food, rule.feeding, rule.reservePerMatter, Number.MAX_SAFE_INTEGER);
      this.post('grow', habitat, result.heat, [{kind: 'fungus', habitat, stock: result.body},
        {kind: 'stock', habitat, stock: {...stock, detritus: organic(remainder),
          mineralMatter: quantum(stock.mineralMatter + result.residue.matter)}}]);
    }
  }

  graze() {
    const rule = this.rules.prey;
    if (this.tick % rule.feeding.interval) return;
    const claims = new Map<number, ChemicalAnimal[]>();
    for (const animal of orderedAnimals(this.animals)) {
      if (animal.kind !== 'prey') continue;
      const habitat = regionHabitat(this.world, animal.region);
      if (!this.fungus.has(habitat)) continue;
      const group = claims.get(habitat) ?? [];
      group.push(animal);
      claims.set(habitat, group);
    }
    for (const habitat of [...claims.keys()].sort(numeric)) {
      const stock = this.fungus.get(habitat)!;
      const takers = claims.get(habitat)!;
      let matter = stock.matter;
      const allocations: number[] = [];
      for (let i = 0; i < takers.length && matter > 0; i++) {
        const bite = Math.min(rule.feeding.biteMatter, matter);
        allocations.push(bite);
        matter -= bite;
      }
      const portions = splitLiving(stock, [...allocations, matter], this.rules.fungus.reservePerMatter);
      for (let i = 0; i < allocations.length; i++) {
        const animal = takers[i], food = portions[i], current = this.fungus.get(habitat)!;
        const left = {matter: current.matter - food.matter, chemicalEnergy: current.chemicalEnergy - food.chemicalEnergy,
          storedEnergy: current.storedEnergy - food.storedEnergy};
        this.feed('graze', habitat, animal, food, {kind: 'fungus', habitat, stock: left.matter ? left : undefined});
      }
    }
  }

  capture() {
    if (this.tick % this.rules.predator.feeding.interval) return;
    const groups = new Map<number, ChemicalAnimal[]>();
    const animals = orderedAnimals(this.animals);
    for (const prey of animals.filter(animal => animal.kind === 'prey').reverse()) {
      const habitat = regionHabitat(this.world, prey.region);
      const group = groups.get(habitat) ?? [];
      group.push(prey);
      groups.set(habitat, group);
    }
    for (const predator of animals.filter(animal => animal.kind === 'predator')) {
      const habitat = regionHabitat(this.world, predator.region);
      const prey = groups.get(habitat)?.pop();
      if (prey) this.feed('capture', habitat, predator, prey.body, {kind: 'animal', id: prey.id, stock: undefined},
        prey.region === predator.region ? prey.body.matter : 0);
    }
  }

  private feed(phase: 'graze' | 'capture', habitat: number, animal: ChemicalAnimal, food: LivingStock,
    prey: Account, releasedSpace = 0) {
    const rule = this.rules[animal.kind];
    const result = assimilate(animal.body, food, rule.feeding, rule.reservePerMatter,
      this.space(animal.region) + releasedSpace, phase === 'capture');
    const stock = this.stock(habitat);
    const residue = phase === 'capture' ? addDetritus(stock, result.residue) :
      {...stock, mineralMatter: quantum(stock.mineralMatter + result.residue.matter)};
    this.post(phase, habitat, result.heat, [prey, {kind: 'animal', id: animal.id, stock: {...animal, body: result.body}},
      {kind: 'stock', habitat, stock: residue}]);
  }

  maintain() {
    for (const habitat of [...this.fungus.keys()].sort(numeric)) {
      const stock = this.fungus.get(habitat)!;
      this.payMaintenance(habitat, stock, BigInt(this.rules.fungus.maintenance) * BigInt(stock.matter),
        body => ({kind: 'fungus', habitat, stock: body}));
    }
    for (const animal of orderedAnimals(this.animals)) {
      this.payMaintenance(regionHabitat(this.world, animal.region), animal.body, BigInt(this.rules[animal.kind].maintenance),
        body => ({kind: 'animal', id: animal.id, stock: body ? {...animal, body} : undefined}));
    }
  }

  private payMaintenance(habitat: number, body: LivingStock, due: bigint, entry: (body?: LivingStock) => Account) {
    const sufficient = BigInt(body.storedEnergy) >= due;
    const paid = sufficient ? Number(due) : body.storedEnergy, remaining = consumeReserve(body, paid);
    if (sufficient) this.post('maintain', habitat, paid, [entry(remaining)]);
    else this.post('die', habitat, paid, [entry(), {kind: 'stock', habitat,
      stock: addDetritus(this.stock(habitat), remaining)}]);
  }

  birth(pairs: NonNullable<FoodHourInput['pairs']>) {
    const attempted = new Set<number>();
    const ediblePrey = new Set<number>();
    for (const animal of this.animals.values()) {
      if (animal.kind === 'prey' && animal.body.chemicalEnergy > 0) {
        ediblePrey.add(regionHabitat(this.world, animal.region));
      }
    }
    const ordered = pairs.map(([a,b]) => [Math.min(quantum(a),quantum(b)), Math.max(a,b)] as const)
      .sort(([a,b], [c,d]) => a - c || b - d);
    for (const [a,b] of ordered) {
      if (a === b) throw new Error('A reproductive pair requires distinct animals');
      const first = this.animals.get(a), second = this.animals.get(b);
      if (!first || !second || first.kind !== second.kind || first.region !== second.region ||
          attempted.has(a) || attempted.has(b)) continue;
      const habitat = regionHabitat(this.world, first.region), rule = this.rules[first.kind];
      const food = first.kind === 'prey' ? this.fungus.get(habitat)?.chemicalEnergy : ediblePrey.has(habitat);
      if (this.space(first.region) < rule.birth.matter || !this.stock(habitat).water || !food ||
          this.tick % rule.birth.interval || this.tick - first.bornAt < rule.birth.adultAge ||
          this.tick - second.bornAt < rule.birth.adultAge) continue;
      const parents = payBirth(first, second, rule);
      if (!parents) continue;
      const id = this.nextAnimalId;
      this.nextAnimalId = quantum(id + 1);
      const {matter, energy, reserve, heat} = rule.birth;
      this.post('birth', habitat, heat, [...parents.map((stock): Account => ({kind: 'animal', id: stock.id, stock})),
        {kind: 'animal', id, stock: {id, kind: first.kind, region: first.region, bornAt: this.tick,
          body: {matter, chemicalEnergy: energy, storedEnergy: reserve}}}]);
      attempted.add(a); attempted.add(b);
    }
  }
}

function organic(stock: LivingStock) { return {matter: stock.matter, chemicalEnergy: stock.chemicalEnergy}; }
function addDetritus(stock: ChemicalInventory, residue: ChemicalInventory['detritus']): ChemicalInventory {
  return {...stock, detritus: {matter: quantum(stock.detritus.matter + residue.matter),
    chemicalEnergy: quantum(stock.detritus.chemicalEnergy + residue.chemicalEnergy)}};
}
function payBirth(first: ChemicalAnimal, second: ChemicalAnimal, rule: AnimalRules) {
  const {matter, energy, heat} = rule.birth;
  const masses = apportion(matter, [1, 1]), energies = apportion(energy + heat, [1, 1]);
  const parents: ChemicalAnimal[] = [];
  for (const [i, parent] of [first, second].entries()) {
    const remaining = parent.body.matter - masses[i];
    const payment = energies[i];
    if (remaining <= 0 || parent.body.storedEnergy < Math.max(1, payment) ||
        BigInt(parent.body.storedEnergy - payment) > reserveCapacity(remaining, rule.reservePerMatter)) return undefined;
    parents.push({...parent, body: {...consumeReserve(parent.body, payment), matter: remaining}});
  }
  return parents;
}

export function foodBalances(world: DispersalWorld, state: FoodChainState) {
  const totals = new Map<number, Balance>();
  function add(id: number, stock: ChemicalInventory | LivingStock) {
    totals.set(id, sum(totals.get(id) ?? zero, balance(stock)));
  }
  for (const [id, stock] of state.chemical.inventory) add(id, stock);
  for (const [id, stock] of state.fungus) add(id, stock);
  for (const animal of state.animals.values()) add(regionHabitat(world, animal.region), animal.body);
  return totals;
}

export function stepFoodChain(world: DispersalWorld, sources: readonly ChemicalSupply[], rules: FoodChainRules,
  before: FoodChainState, input: FoodHourInput) {
  const occupancy = validateFoodState(world, sources, rules, before);
  if (input.chemical.some(posting => posting.kind === 'conversion')) throw new Error('Use food-chain processes for conversions');
  const chemical = applyChemicalHour(world, sources, before.chemical, input.chemical);
  const hour = new Hour(world, rules, before, chemical, occupancy);
  hour.move(input.moves ?? []);
  hour.grow();
  hour.graze();
  hour.capture();
  hour.maintain();
  hour.birth(input.pairs ?? []);
  const state = {...before, chemical: {...chemical.state, inventory: hour.inventory, heat: hour.heat},
    fungus: hour.fungus, animals: hour.animals, nextAnimalId: hour.nextAnimalId};
  validateFoodState(world, sources, rules, state);

  const opening = foodBalances(world, before), closing = foodBalances(world, state);
  const crossings = hour.entries.flatMap(entry => entry.crossing ? [entry.crossing] : []);
  const inAnimal = new Map<number, Balance>(), outAnimal = new Map<number, Balance>();
  for (const {from, to, cargo} of crossings) {
    inAnimal.set(to, sum(inAnimal.get(to) ?? zero, balance(cargo)));
    outAnimal.set(from, sum(outAnimal.get(from) ?? zero, balance(cargo)));
  }
  const byHabitat = new Map<number, {opening: Balance; closing: Balance; imported: Balance; exported: Balance; dissipated: bigint}>();
  for (const id of [...new Set([...opening.keys(), ...closing.keys(), ...chemical.byHabitat.keys(), ...hour.heat.keys()])].sort(numeric)) {
    const start = opening.get(id) ?? zero, end = closing.get(id) ?? zero;
    const imported = chemical.byHabitat.get(id)?.imported ?? zero, exported = chemical.byHabitat.get(id)?.exported ?? zero;
    const incoming = sum(chemical.internalIn.get(id) ?? zero, inAnimal.get(id) ?? zero);
    const outgoing = sum(chemical.internalOut.get(id) ?? zero, outAnimal.get(id) ?? zero);
    const dissipated = BigInt(hour.heat.get(id) ?? 0) - BigInt(before.chemical.heat.get(id) ?? 0);
    assertBalance(sum(sum(start, imported), incoming), sum(sum(sum(end, exported), outgoing), heat(dissipated)));
    byHabitat.set(id, {opening: start, closing: end, imported, exported, dissipated});
  }
  const audit = [...byHabitat.values()].reduce((total, row) => ({
    opening: sum(total.opening, row.opening), closing: sum(total.closing, row.closing),
    imported: sum(total.imported, row.imported), exported: sum(total.exported, row.exported),
    dissipated: total.dissipated + row.dissipated,
  }), {opening: zero, closing: zero, imported: zero, exported: zero, dissipated: 0n});
  assertBalance(sum(audit.opening, audit.imported), sum(sum(audit.closing, audit.exported), heat(audit.dissipated)));
  return {state, entries: hour.entries, byHabitat, audit,
    cutFlows: {chemical: chemical.cutFlows, passive: chemical.transfers, animals: crossings}};
}

/** Canonical journal comparison, independent of the key order of caller-supplied records. */
export function foodLedgerDigest(report: ReturnType<typeof stepFoodChain>) {
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([a],[b]) => compareChemicalIds(a,b))
        .map(([key, item]) => [key, canonical(item)]));
    }
    return value;
  }
  return chemicalDigest(canonical([report.entries, report.cutFlows]));
}
