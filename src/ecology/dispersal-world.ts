import { makePlan } from '../core/plan.ts';
import { extractGraph, sections, type Kind, type State } from '../core/spatial.ts';
import { buildStructure } from '../core/structure.ts';
import { deriveHabitats, regionGeometry, updateBarrier, type Boundary, type HabitatGraph } from './habitats.ts';
import { parameters } from './parameters.ts';

export interface DispersalWorld {
  graph: HabitatGraph;
  ports: ReadonlyMap<string, readonly [string, string]>;
  capacities: ReadonlyMap<string, number>;
  members: string[][];
  connectorKinds?: ReadonlyMap<string, Kind>;
}
export function indexWorld(graph: HabitatGraph, ports: DispersalWorld['ports'], capacities: DispersalWorld['capacities'], connectorKinds?: DispersalWorld['connectorKinds']): DispersalWorld {
  const members: string[][] = graph.habitats.map(() => []);
  for (const [region, id] of graph.regionToHabitat) members[id].push(region);
  for (const group of members) group.sort();
  return { graph, ports, capacities, members, connectorKinds };
}
export function buildDispersalWorld(seed: string, barriers: ReadonlyMap<string, State> = new Map()) {
  const structure = buildStructure(makePlan(seed));
  const fine = extractGraph(structure);
  const graph = deriveHabitats(structure, fine, barriers);
  const ports = new Map([...fine.edges.values()].map(e => [e.id, [e.from, e.to] as const]));
  const capacities = new Map<string, number>();
  for (const region of fine.adjacent.keys()) capacities.set(region, regionGeometry(structure, region).cells * parameters.capacityPerCell);
  return indexWorld(graph, ports, capacities, new Map([...fine.edges.values()].map(e => [e.id, e.kind])));
}

export function changeDispersalBarrier(world: DispersalWorld, connector: string, state: State): DispersalWorld {
  const graph = updateBarrier(world.graph, connector, state);
  return graph.regionToHabitat === world.graph.regionToHabitat
    ? { ...world, graph }
    : indexWorld(graph, world.ports, world.capacities, world.connectorKinds);
}

// A passive packet can traverse a narrow slit. The grazer is a terrestrial crawler.
export const dispersalRules = { sporePeriod: 4, movementPeriod: 4, decayPeriod: 12, propagationEnergy: 1,
  migrationEnergy: 1, germinationEnergy: 1, grazerWidth: 0.2, grazerHeight: 0.15, packetWidth: 0.01,
  packetHeight: 0.01, reserveFungus: 1, reserveGrazers: 1 } as const;
export type Mobile = 'propagules' | 'detritivores';

export function organismPass(graph: HabitatGraph, cut: Boundary, from: number, organism: Mobile, wet: boolean) {
  if ((from !== cut.from && from !== cut.to) || cut.state === 'blocked' || cut.state === 'closed') return false;
  const section = sections[cut.kind];
  const to = from === cut.from ? cut.to : cut.from;
  const descent = graph.habitats[to].depthM - graph.habitats[from].depthM;
  if (section.downOnly && from !== cut.from) return false;
  if (organism === 'propagules') {
    if (section.width < dispersalRules.packetWidth || section.clearance < dispersalRules.packetHeight || descent < 0) return false;
    return (cut.state !== 'flooded' && cut.kind !== 'watercourse') || wet;
  }
  if (section.width < dispersalRules.grazerWidth || section.clearance < dispersalRules.grazerHeight || cut.state === 'flooded') return false;
  return section.modes.includes('crawl') && (descent === 0 || cut.kind === 'stairs' || (descent > 0 && (cut.kind === 'duct' || cut.kind === 'gate')));
}
