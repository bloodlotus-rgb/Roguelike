import { createHash, type Hash } from 'node:crypto';
import { CELL } from '../core/jenga.ts';
import { makePlan, STOREYS_PER_ZONE, ZONE_SLAB } from '../core/plan.ts';
import { extractGraph, region, type SpatialGraph, type Kind, type State, type Edge } from '../core/spatial.ts';
import { buildStructure, type Structure } from '../core/structure.ts';
import { parameters } from './parameters.ts';

export interface Habitat {
  zone: number;
  depthM: number;
  areaM2: number;
  capacity: number;
  humidity: number;
  morphology: string[];
}
export interface Boundary {
  id: string;
  from: number;
  to: number;
  kind: Kind;
  state: State;
  key?: string;
}
export interface HabitatGraph {
  seed: string;
  signature: string;
  entrance: number;
  habitats: Habitat[];
  regionToHabitat: Map<string, number>;
  boundaries: Boundary[];
  incident: number[][];
  barriers: [string, State][];
}
export const generatorVersion = 'jenga-e0m-9ecd0b7';
export const modelVersion = 1;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

// Only the small SHA-256 prefix state survives derivation. The fine graph is released.
const partitionDigest = new WeakMap<HabitatGraph['regionToHabitat'], Hash>();
export function sharesDerivedPartition(first: HabitatGraph, second: HabitatGraph) {
  return first.regionToHabitat === second.regionToHabitat && partitionDigest.has(first.regionToHabitat);
}

function signature(prefix: Hash, boundaries: Boundary[], habitats: Habitat[], entrance: number) {
  const digest = prefix.copy();
  for (const boundary of boundaries) digest.update(JSON.stringify(boundary));
  for (const habitat of habitats) digest.update(JSON.stringify(habitat));
  return digest.update(String(entrance)).digest('hex');
}

/** Iterative low-link DFS. Skip only the parent edge, so parallel cuts stay distinct. */
function findBridges(adjacent: Map<string, Edge[]>): Set<string> {
  const bridges = new Set<string>();
  const seen = new Map<string, number>();
  const low = new Map<string, number>();
  function enter(node: string, via?: Edge) {
    const time = seen.size;
    seen.set(node, time);
    low.set(node, time);
    return { node, via, cursor: 0 };
  }
  for (const start of adjacent.keys()) {
    if (seen.has(start)) continue;
    const stack = [enter(start)];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const edge = adjacent.get(frame.node)![frame.cursor++];
      if (edge) {
        if (edge === frame.via) continue;
        const other = frame.node === edge.from ? edge.to : edge.from;
        if (!seen.has(other)) stack.push(enter(other, edge));
        else low.set(frame.node, Math.min(low.get(frame.node)!, seen.get(other)!));
      } else {
        stack.pop();
        const parent = stack.at(-1);
        if (!parent) continue;
        const minimum = low.get(frame.node)!;
        if (minimum > seen.get(parent.node)!) bridges.add(frame.via!.id);
        low.set(parent.node, Math.min(low.get(parent.node)!, minimum));
      }
    }
  }
  return bridges;
}

/** Freeze one structural epoch. No fine adjacency or geometry is retained in the result. */
export function deriveHabitats(structure: Structure, fine: SpatialGraph,
  states: ReadonlyMap<string, State> = new Map()): HabitatGraph {
  if (fine.errors.length) throw new Error('Invalid Jenga graph: ' + fine.errors[0]);
  for (const [id, state] of states) {
    if (!fine.edges.has(id) || !['open', 'closed', 'blocked', 'destroyed', 'flooded'].includes(state)) {
      throw new Error('Unknown barrier or state: ' + id);
    }
  }
  const ids = [...fine.adjacent.keys()].sort(compare);
  const eligible = new Map<string, Edge[]>(ids.map(id => [id, []]));
  const fixed = new Set<string>();
  const wet = new Set<string>();
  const edges = [...fine.edges.values()].sort((a, b) => compare(a.id, b.id));
  for (const e of edges) {
    const state = states.get(e.id) ?? e.state;
    if (e.kind === 'watercourse' || state === 'flooded') {
      wet.add(e.from); wet.add(e.to);
    }
    if (state === 'open' && (e.kind === 'opening' || e.kind === 'interior') &&
        e.a.zone === e.b.zone && e.a.cell[2] === e.b.cell[2]) {
      eligible.get(e.from)!.push(e);
      eligible.get(e.to)!.push(e);
    } else {
      fixed.add(e.from); fixed.add(e.to);
    }
  }
  const bridges = findBridges(eligible);
  const regionToHabitat = new Map<string, number>();
  const habitats: Habitat[] = [];
  function geometry(id: string) {
    const [zone, blockId, floor] = id.split('/').map(Number);
    const block = structure.zones[zone].blocks[blockId];
    return { zone, floor, morphology: block.def.kind === 'macro' ? block.def.id : block.def.kind,
      cells: block.def.interior ? 1 : block.size[0] * block.size[1] };
  }
  for (const start of ids) {
    if (regionToHabitat.has(start)) continue;
    const index = habitats.length;
    const first = geometry(start);
    const kinds = new Set<string>([first.morphology]);
    const members = [start];
    regionToHabitat.set(start, index);
    let cells = first.cells;
    for (const id of members) {
      if (fixed.has(id)) continue;
      for (const edge of eligible.get(id)!) {
        const other = edge.from === id ? edge.to : edge.from;
        if (bridges.has(edge.id) || fixed.has(other) || regionToHabitat.has(other)) continue;
        const next = geometry(other);
        if (cells + next.cells > parameters.maxMixedCells) continue;
        cells += next.cells;
        kinds.add(next.morphology);
        members.push(other);
        regionToHabitat.set(other, index);
      }
    }
    habitats.push({ zone: first.zone, depthM: first.zone * (STOREYS_PER_ZONE * CELL + ZONE_SLAB) + (first.floor + 1) * CELL,
      areaM2: cells * CELL ** 2, capacity: cells * parameters.capacityPerCell,
      humidity: members.some(id => wet.has(id)) ? parameters.wetHumidity : parameters.dryHumidity,
      morphology: [...kinds].sort() });
  }
  const boundaries: Boundary[] = [];
  const incident: number[][] = habitats.map(() => []);
  const digest = createHash('sha256');
  for (const id of ids) digest.update(id + ':' + regionToHabitat.get(id) + '\n');
  for (const edge of edges) {
    const from = regionToHabitat.get(edge.from)!, to = regionToHabitat.get(edge.to)!;
    if (from === to) continue;
    const boundary = { id: edge.id, from, to, kind: edge.kind, key: edge.key, state: states.get(edge.id) ?? edge.state };
    incident[from].push(boundaries.length);
    incident[to].push(boundaries.length);
    boundaries.push(boundary);
  }
  const entrance = regionToHabitat.get(region(structure.zones[0], structure.entrance));
  if (entrance === undefined) throw new Error('Missing surface habitat');
  partitionDigest.set(regionToHabitat, digest);
  return { seed: structure.seed, signature: signature(digest, boundaries, habitats, entrance), entrance, habitats, regionToHabitat,
    boundaries, incident, barriers: [...states].sort(([a], [b]) => compare(a, b)) };
}

/** Build a simulation graph from a seed, releasing fine geometry after aggregation. */
export function buildHabitatGraph(seed: string, states: ReadonlyMap<string, State> = new Map()): HabitatGraph {
  const structure = buildStructure(makePlan(seed));
  return deriveHabitats(structure, extractGraph(structure), states);
}

/** A gate pins both fine endpoints in every state. All other edits use full derivation. */
export function updateBarrier(graph: HabitatGraph, id: string, state: State,
  rebuild = (states: ReadonlyMap<string, State>) => buildHabitatGraph(graph.seed, states)): HabitatGraph {
  const states = new Map(graph.barriers).set(id, state);
  const index = graph.boundaries.findIndex(cut => cut.id === id);
  const prior = graph.boundaries[index];
  const prefix = partitionDigest.get(graph.regionToHabitat);
  if (!prefix || prior?.kind !== 'gate') return rebuild(states);
  if (!['open', 'closed', 'blocked', 'destroyed', 'flooded'].includes(state)) throw new Error('Unknown barrier state: ' + state);

  const boundaries = graph.boundaries.slice();
  boundaries[index] = { ...prior, state };
  let habitats = graph.habitats;
  if ((state === 'flooded') !== (prior.state === 'flooded')) {
    habitats = habitats.slice();
    for (const endpoint of [prior.from, prior.to]) {
      const wet = graph.incident[endpoint].some(i => boundaries[i].kind === 'watercourse' || boundaries[i].state === 'flooded');
      habitats[endpoint] = { ...habitats[endpoint], humidity: wet ? parameters.wetHumidity : parameters.dryHumidity };
    }
  }
  return { ...graph, habitats, boundaries, barriers: [...states].sort(([a], [b]) => compare(a, b)),
    signature: signature(prefix, boundaries, habitats, graph.entrance) };
}
