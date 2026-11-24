import { sections, type State } from '../src/core/spatial.ts';
import { changeDispersalBarrier, dispersalRules, indexWorld, organismPass, type DispersalWorld } from '../src/ecology/dispersal-world.ts';
import { buildHabitatGraph } from '../src/ecology/habitats.ts';
import { type Deposit } from '../src/ecology/metapopulation.ts';
import { biology, inlet, type TrophicStock } from '../src/ecology/trophic-contract.ts';
import { channelLimit } from '../src/ecology/transport.ts';
import { viabilityTrial } from './viability-trials.ts';

/** A three-region enclosure inside the complete building. Seal real peripheral cuts; retain the inlet and one lateral bridge. */
export function enclosure(base: DispersalWorld) {
  const setup = viabilityTrial(base.graph, 'control');
  const stream = inlet(base.graph, setup);
  const [source, outlet] = base.ports.get(stream.id)!;
  const bridge = base.graph.incident[stream.from].map(i => base.graph.boundaries[i]).find(c =>
    c.id !== stream.id && organismPass(base.graph, c, stream.from, 'detritivores', true) &&
    base.graph.habitats[c.from].depthM === base.graph.habitats[c.to].depthM);
  if (!bridge) throw new Error('Trial needs a lateral bridge at the inlet');
  const ports = base.ports.get(bridge.id)!;
  const target = ports[0] === source ? ports[1] : ports[0];
  const sites = new Set([source, target, outlet]);
  const overlay = new Map<string, State>();
  for (const [id, [a,b]] of base.ports) {
    if (id !== bridge.id && id !== stream.id && (sites.has(a) || sites.has(b))) overlay.set(id, 'blocked');
  }
  const open = indexWorld(buildHabitatGraph(base.graph.seed, overlay), base.ports, base.capacities);
  const closed = changeDispersalBarrier(open, bridge.id, 'blocked');
  return { open, closed, setup, bridge: bridge.id, source, target };
}

// Prepaid 48-hour survey reserve. Bound exports by actual incident conduits and
// maintenance by the maximum number of rations that could fit locally.
export function surveyReserve(world: DispersalWorld, id: number): TrophicStock {
  const graph = world.graph;
  const exportLimit = (r: 'water' | 'detritus' | 'energy') => graph.incident[id].reduce((sum, i) => {
    const cut = graph.boundaries[i];
    const dry = cut.kind === 'gate' ? { ...cut, state: 'destroyed' as const } : cut;
    return sum + channelLimit(graph, dry, id, r);
  }, 0);
  const hours = 48;
  const rations = Math.ceil(graph.habitats[id].capacity / Math.min(biology.animalsPerRation, biology.fungalUnitsPerRation)) + 1;
  const meals = Math.ceil(hours / biology.maintenancePeriod) * rations;
  return { water: 1 + hours * exportLimit('water') + Math.ceil(hours / biology.evaporationPeriod),
    detritus: meals * biology.maintenanceFood + hours * (exportLimit('detritus') + biology.mineralizationRate + biology.birthFood + biology.fungalGrowthFood),
    energy: meals * biology.maintenanceEnergy + hours * (exportLimit('energy') + biology.mineralizationEnergy + biology.fungalGrowthEnergy +
      biology.birthEnergy + dispersalRules.propagationEnergy + dispersalRules.migrationEnergy + dispersalRules.germinationEnergy),
    nutrients: 2, fungalBiomass: 4, detritivores: 2 };
}

// Finite, individually itemized historical survey deposits. A breadth-first walk from the
// surface certifies a walk/crawl route through open, sufficiently large sections to every site.
export function surveyDeposits(world: DispersalWorld, count: number, exclude: number): Deposit[] {
  if (!count) return [];
  const g = world.graph, queue = [g.entrance], seen = new Set(queue), deposits: Deposit[] = [];
  for (const id of queue) {
    for (const i of g.incident[id]) {
      const cut = g.boundaries[i], section = sections[cut.kind];
      if (cut.state === 'blocked' || cut.state === 'closed' || cut.state === 'flooded' ||
        section.width < 0.45 || section.clearance < 0.45 || !section.modes.some(m => m === 'walk' || m === 'crawl')) continue;
      const to = cut.from === id ? cut.to : cut.from;
      if (seen.has(to)) continue;
      seen.add(to);
      queue.push(to);
      if (to === exclude) continue;
      const ends = world.ports.get(cut.id)!;
      deposits.push({ region: ends[cut.from === id ? 1 : 0], connector: cut.id, origin: 'surface-survey',
        stock: surveyReserve(world,to) });
      if (deposits.length === count) return deposits;
    }
  }
  throw new Error('Insufficient physically accessible survey sites');
}
