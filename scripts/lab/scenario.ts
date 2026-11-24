import { chemicalDelivery, declareChemicalSupply, type ChemicalSupply } from '../../src/ecology/chemical-ledger.ts';
import { foundFoodChain, regionHabitat, type FoodChainRules, type FoodChainState } from '../../src/ecology/chemical-food-contract.ts';
import { planChemicalTransport } from '../../src/ecology/chemical-transport.ts';
import { buildDispersalWorld, changeDispersalBarrier, type DispersalWorld } from '../../src/ecology/dispersal-world.ts';
import { channelLimit, channelReach } from '../../src/ecology/transport.ts';

export const scenarioId = 'mansion-detritus/1';
export const seed = 'mansion';
export const passage = '0/2/8/3/0';
export const gate = '0/3/8/3/5';
export const rooms = [
  { region: '0/128/3/2/6', name: 'Galería lateral' },
  { region: '0/319/3', name: 'Cámara de aporte' },
  { region: '0/460/3', name: 'Pozo del micelio' },
  { region: '1/0/0', name: 'Rellano inferior' },
] as const;
const donor = rooms[1].region, receiver = rooms[2].region;

const feeding = { interval: 3, biteMatter: 2, retainedMatterPermille: 500, reservePermille: 1000, residueEnergyPermille: 0 };
const animal = { maintenance: 1, reservePerMatter: 4, feeding, movement: { modes: ['crawl'] as const, width: 1, height: 1, cost: 0 },
  birth: { interval: 3, adultAge: 3, matter: 1, energy: 2, reserve: 2, heat: 1 } };
// Observation fixture. These coefficients never enter the engine defaults.
export const rules: FoodChainRules = {
  fungus: { maintenance: 1, reservePerMatter: 20, feeding: { ...feeding, interval: 6, biteMatter: 4 },
    regulation: 'growth-budget-and-regression' },
  prey: { ...animal, physiology: { satiation: true, adultMatter: 4, maintenanceMatterStep: 2 } },
  predator: animal,
};
export const source: ChemicalSupply = {
  id: 'litter', origin: 'Declared organic litter through an existing side gallery port',
  port: { connector: '0/2/6/3/1', fromRegion: donor, toRegion: rooms[0].region },
  perLot: { detritus: { matter: 1, chemicalEnergy: 192 }, water: 0, mineralMatter: 0 },
  rate: 16, periodHours: 6, activeHours: 1, quotaLots: 96,
};
export const sources = [source];

export function hourInput(world: DispersalWorld, state: FoodChainState) {
  const chemical = planChemicalTransport(world, state.chemical);
  const delivery = chemicalDelivery(world, source, state.chemical, 'litter-' + (state.chemical.tick + 1));
  return { chemical: delivery ? [...chemical, delivery] : chemical };
}

export function createScenario() {
  const world = buildDispersalWorld(seed);
  const closed = changeDispersalBarrier(world, passage, 'closed');
  const openGate = changeDispersalBarrier(closed, gate, 'open');
  for (const candidate of [world, closed, openGate]) {
    const graph = candidate.graph;
    const from = regionHabitat(candidate, donor), to = regionHabitat(candidate, receiver);
    const cut = graph.boundaries.find(edge => edge.id === passage);
    const lowerGate = graph.boundaries.find(edge => edge.id === gate);
    if (!cut || cut.kind !== 'opening' || !lowerGate || lowerGate.kind !== 'gate' ||
        candidate.ports.get(passage)?.join() !== [donor, receiver].join() ||
        candidate.ports.get(gate)?.join() !== [receiver, rooms[3].region].join() ||
        ![cut.from, cut.to].includes(from) || ![cut.from, cut.to].includes(to) ||
        new Set(rooms.map(room => regionHabitat(candidate, room.region))).size !== rooms.length ||
        channelLimit(graph, lowerGate, lowerGate.from, 'detritus') !== 0 ||
        channelLimit(graph, cut, from, 'detritus') !== (candidate === world ? 1 : 0) ||
        channelReach(graph, from, 'detritus').includes(to) !== (candidate === world)) {
      throw new Error('El escenario ya no coincide con las rutas físicas de Jenga.');
    }
    declareChemicalSupply(candidate, source);
  }
  const habitat = regionHabitat(world, receiver);
  const initial = foundFoodChain(world, sources, rules, {
    inventory: new Map([[habitat, { detritus: { matter: 0, chemicalEnergy: 0 }, mineralMatter: 0, water: 2 }]]),
    fungus: new Map([[habitat, { matter: 16, chemicalEnergy: 256, storedEnergy: 192 }]]),
    animals: [
      { id: 0, kind: 'prey', region: receiver, bornAt: 0, body: { matter: 4, chemicalEnergy: 10, storedEnergy: 10 } },
      { id: 1, kind: 'prey', region: receiver, bornAt: 0, body: { matter: 2, chemicalEnergy: 6, storedEnergy: 6 } },
    ],
  });
  let used = 0;
  for (let hour = 1; hour <= 37; hour++) {
    const ledger = { ...initial.chemical, tick: hour - 1, lotsUsed: new Map([[source.id, used]]) };
    const posting = chemicalDelivery(world, source, ledger, 'calendar-preflight');
    const lots = posting?.kind === 'source' ? posting.lots : 0;
    if (lots !== (hour <= 31 && (hour - 1) % 6 === 0 ? 16 : 0)) throw new Error('El calendario de la fuente cambió.');
    used += lots;
  }
  const firstPlan = hourInput(world, initial).chemical;
  if (used !== source.quotaLots || firstPlan.some(entry => entry.kind === 'transfer' &&
      entry.connector === passage && entry.cargo.detritus.matter > 0)) {
    throw new Error('La fuente no cumple la cuota o la acreditación diferida.');
  }
  return { world, initial };
}
