import { createHash } from 'node:crypto';
import type { DispersalWorld } from './dispersal-world.ts';
import { generatorVersion } from './habitats.ts';
import { conductance, flooded } from './parameters.ts';
import { serializeChemicalState, validateChemicalState, type ChemicalState, type ChemicalSupply,
  type ChemicalInventory } from './chemical-ledger.ts';
import { apportion, chemicalTransportRules, compareChemicalIds } from './chemical-transport.ts';

const version = 'E1-Chemical-Transport/1';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function manifestHash(sources: readonly ChemicalSupply[]) {
  return digest([...sources].sort((a,b) => compareChemicalIds(a.id,b.id)).map(s => [
    s.id, s.origin, s.port.connector, s.port.fromRegion, s.port.toRegion,
    s.perLot.detritus.matter, s.perLot.detritus.chemicalEnergy, s.perLot.mineralMatter, s.perLot.water,
    s.rate, s.periodHours, s.activeHours, s.quotaLots,
  ]));
}

function epoch(world: DispersalWorld) {
  return {
    seed: world.graph.seed, generator: generatorVersion, topology: world.graph.signature,
    barriers: [...world.graph.barriers].sort(([a],[b]) => compareChemicalIds(a,b)),
  };
}

type SerializedState = [number, [number, number, number, number, number][], [number, number][], [string, number][]];

export function saveChemical(world: DispersalWorld, sources: readonly ChemicalSupply[], state: ChemicalState) {
  if (state.topology !== world.graph.signature) throw new Error('Wrong chemical geometry epoch');
  validateChemicalState(world,sources,state);
  const payload = { version, epoch: epoch(world),
    rules: digest([chemicalTransportRules,conductance,flooded]), manifest: manifestHash(sources),
    accounts: JSON.parse(serializeChemicalState(state)) as SerializedState };
  return { ...payload, integrity: digest(payload) };
}

export function restoreChemical(world: DispersalWorld, sources: readonly ChemicalSupply[], saved: unknown): ChemicalState {
  if (!saved || typeof saved !== 'object' || !('version' in saved) || saved.version !== version) {
    throw new Error('Unsupported chemical snapshot version');
  }
  const { integrity, ...payload } = saved as ReturnType<typeof saveChemical>;
  if (integrity !== digest(payload)) throw new Error('Chemical snapshot integrity mismatch');
  const [tick, rows, heatRows, meterRows] = payload.accounts;
  const inventory = new Map<number,ChemicalInventory>(rows.map(([id,m,e,n,w]) =>
    [id,{detritus:{matter:m,chemicalEnergy:e},mineralMatter:n,water:w}]));
  const heat = new Map(heatRows), lotsUsed = new Map(meterRows);
  if (inventory.size !== rows.length || heat.size !== heatRows.length || lotsUsed.size !== meterRows.length) {
    throw new Error('Duplicate chemical snapshot account');
  }
  const state = { topology: world.graph.signature,tick,inventory,heat,lotsUsed };
  if (saveChemical(world,sources,state).integrity !== integrity) throw new Error('Incompatible chemical snapshot contract or epoch');
  return state;
}

export function projectChemicalState(oldWorld: DispersalWorld, newWorld: DispersalWorld, state: ChemicalState) {
  const old = oldWorld.graph, next = newWorld.graph;
  if (state.topology !== old.signature) throw new Error('Wrong chemical geometry epoch');
  if (old.seed !== next.seed || old.regionToHabitat.size !== next.regionToHabitat.size ||
      oldWorld.ports.size !== newWorld.ports.size || oldWorld.capacities.size !== newWorld.capacities.size) {
    throw new Error('Different chemical building');
  }
  for (const [key,[a,b]] of oldWorld.ports) {
    const port = newWorld.ports.get(key);
    if (!port || port[0] !== a || port[1] !== b) throw new Error('Different chemical building ports');
  }
  for (const [id,capacity] of oldWorld.capacities) {
    if (newWorld.capacities.get(id) !== capacity) throw new Error('Different chemical building capacity');
  }

  const overlaps = new Map<number,Map<number,number>>();
  for (const [region,from] of old.regionToHabitat) {
    const to = next.regionToHabitat.get(region);
    if (to === undefined) throw new Error('Missing chemical region');
    const destinations = overlaps.get(from) ?? new Map<number,number>();
    destinations.set(to,(destinations.get(to) ?? 0)+1);
    overlaps.set(from,destinations);
  }
  const inventory = new Map<number,ChemicalInventory>(), heat = new Map<number,number>();
  function parts(from: number) {
    const edges = overlaps.get(from);
    if (!edges) throw new Error('Chemical account without a physical habitat');
    return [...edges].sort(([a],[b]) => a-b);
  }
  function add(a: number, b: number) {
    const sum = a+b;
    if (!Number.isSafeInteger(a) || a < 0 || !Number.isSafeInteger(sum)) throw new Error('Invalid projected chemical quantum');
    return sum;
  }
  const ids = [...state.inventory.keys()].sort((a,b) => a-b);
  for (const from of ids) {
    const s = state.inventory.get(from)!;
    const destinations = parts(from), weights = destinations.map(([,weight]) => weight);
    for (const n of [s.detritus.matter,s.detritus.chemicalEnergy,s.mineralMatter,s.water]) add(n,0);
    const mass = apportion(s.detritus.matter,weights), energy = apportion(s.detritus.chemicalEnergy,mass);
    const mineral = apportion(s.mineralMatter,weights), water = apportion(s.water,weights);
    destinations.forEach(([to], i) => {
      const existing = inventory.get(to);
      inventory.set(to, {
        detritus:{matter:add(mass[i],existing?.detritus.matter ?? 0),
          chemicalEnergy:add(energy[i],existing?.detritus.chemicalEnergy ?? 0)},
        mineralMatter:add(mineral[i],existing?.mineralMatter ?? 0),water:add(water[i],existing?.water ?? 0),
      });
    });
  }
  for (const [from,value] of [...state.heat].sort(([a],[b]) => a-b)) {
    add(value,0);
    const destinations = parts(from), shares = apportion(value,destinations.map(([,n]) => n));
    destinations.forEach(([to],i) => heat.set(to,add(shares[i],heat.get(to) ?? 0)));
  }
  function totals(value: typeof inventory, loss: ReadonlyMap<number,number>) {
    const sums = [0n,0n,0n,0n,0n];
    for (const s of value.values()) {
      [s.detritus.matter,s.detritus.chemicalEnergy,s.mineralMatter,s.water].forEach((n,i) => { sums[i] += BigInt(n); });
    }
    for (const n of loss.values()) sums[4] += BigInt(n);
    return sums;
  }
  const before = totals(new Map(state.inventory),state.heat), after = totals(inventory,heat);
  if (before.some((n,i) => n !== after[i])) throw new Error('Unbalanced chemical projection');
  return { ...state, topology:next.signature, inventory, heat };
}
