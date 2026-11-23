import { CELL, Face, mayJoin, placeOpening, opposite, STEP, type ZoneLayout } from './jenga.ts';
import { STOREYS_PER_ZONE, ZONE_SLAB, zoneKey } from './plan.ts';
import { owner, type Cell, type Location, type PassageKind, type Port, type Structure } from './structure.ts';

export type Mode = 'walk' | 'crawl' | 'climb' | 'fly' | 'swim' | 'squeeze';
export type State = 'open' | 'closed' | 'blocked' | 'destroyed' | 'flooded';
export type Kind = PassageKind | 'opening' | 'interior' | 'stairs';
export interface Traveler {
  modes: readonly Mode[];
  width: number;
  height: number;
  keys?: readonly string[];
  breakBarrier?: boolean;
}

interface Section {
  width: number; // clear metres across the path
  clearance: number; // headroom along the path
  modes: readonly Mode[];
  downOnly?: boolean;
}
export const sections: Record<Kind, Section> = {
  interior: { width: 2, clearance: 2.4, modes: ['walk', 'crawl', 'fly'] },
  opening: { width: 2, clearance: 2.4, modes: ['walk', 'crawl', 'fly'] },
  stairs: { width: 1.4, clearance: 2.2, modes: ['walk', 'crawl', 'climb', 'fly'] },
  gate: { width: 1.4, clearance: 2.2, modes: ['walk', 'crawl', 'climb', 'fly'] },
  fissure: { width: 0.18, clearance: 0.35, modes: ['squeeze'] },
  duct: { width: 0.6, clearance: 0.55, modes: ['climb', 'crawl'] },
  shaft: { width: 1, clearance: 2, modes: ['climb', 'fly'] },
  watercourse: { width: 1.2, clearance: 1, modes: ['swim'], downOnly: true },
};

export interface Edge {
  /** IDs are scoped to the building seed. Endpoints retain the materialization evidence. */
  id: string;
  from: string;
  to: string;
  a: Port;
  b: Port;
  kind: Kind;
  state: State;
  key?: string;
}
export interface SpatialGraph {
  adjacent: Map<string, Edge[]>;
  edges: Map<string, Edge>;
  errors: string[];
}

/** A connected floor or gallery, never the entire volume of a tall piece. */
export function region(layout: ZoneLayout, p: Location): string {
  const floor = [p.zone, p.block, p.cell[2]].join('/');
  return layout.blocks[p.block]?.def.interior ? floor + '/' + p.cell.slice(0, 2).join('/') : floor;
}

/** Metres east/south/down. Slab ports are separated by the real thickness of rock. */
export function anchor(layout: ZoneLayout, p: Port): Cell {
  const [dx, dy, dz] = STEP[p.face];
  return [(p.cell[0] - layout.spec.width / 2 + (1 + dx) / 2) * CELL,
    (p.cell[1] - layout.spec.depth / 2 + (1 + dy) / 2) * CELL,
    p.zone * (STOREYS_PER_ZONE * CELL + ZONE_SLAB) + (p.cell[2] + (dz < 0 ? 0 : 1)) * CELL];
}

function adjacentCell(cell: Cell, face: Face): Cell {
  const [dx, dy, dz] = STEP[face];
  return [cell[0] + dx, cell[1] + dy, cell[2] + dz];
}
function hasOpening(layout: ZoneLayout, p: Port): boolean {
  return layout.blocks[p.block]?.openings.some(o => o.joined && o.face === p.face &&
    o.cell.every((v, i) => v === p.cell[i])) ?? false;
}
function bearing(layout: ZoneLayout, p: Port): boolean {
  return p.block >= 0 && owner(layout, p.cell) === p.block;
}

/** Extract and validate in one pass. An invalid pair is reported and never enters adjacency. */
export function extractGraph(structure: Pick<Structure, 'zones' | 'passages'>): SpatialGraph {
  const { zones, passages } = structure;
  const byZone = new Map(zones.map(layout => [layout.spec.zone, layout]));
  const adjacent = new Map<string, Edge[]>();
  const edges = new Map<string, Edge>();
  const errors: string[] = [];
  function add(a: Port, b: Port, kind: Kind, key?: string) {
    const from = region(byZone.get(a.zone)!, a), to = region(byZone.get(b.zone)!, b);
    const id = [a.zone, ...a.cell, a.face].join('/');
    if (edges.has(id) || !adjacent.has(from) || !adjacent.has(to)) {
      errors.push('Duplicate cut or missing region at ' + id);
      return;
    }
    const edge: Edge = { id, from, to, a, b, kind, key, state: kind === 'gate' ? 'closed' : 'open' };
    edges.set(id, edge);
    adjacent.get(from)!.push(edge);
    adjacent.get(to)!.push(edge);
  }
  for (const layout of zones) {
    const zone = layout.spec.zone;
    const live = layout.blocks.filter(b => owner(layout, b.at) === b.id);
    for (const block of live) {
      for (let z = block.at[2]; z < block.at[2] + block.size[2]; z++) {
        const [width, depth] = block.def.interior ? block.size : [1, 1];
        for (let y = 0; y < depth; y++) for (let x = 0; x < width; x++) {
          const cell: Cell = [block.at[0] + x, block.at[1] + y, z];
          // Reserved voids have no walking region even though their envelope is occupied.
          if (owner(layout, cell) !== block.id) continue;
          adjacent.set(region(layout, { zone, block: block.id, cell }), []);
        }
      }
    }
    for (const block of live) {
      for (const cut of block.def.interior ?? []) {
        const { cell, face } = placeOpening(block.def, block.at, block.turn, cut);
        const a: Port = { zone, block: block.id, cell, face };
        const b = { ...a, cell: adjacentCell(cell, face), face: opposite(face) };
        if (bearing(layout, a) && bearing(layout, b)) add(a, b, face >= Face.Up ? 'stairs' : 'interior');
        else errors.push('Interior cut outside its footprint at ' + region(layout, a));
      }
      if (block.def.stair) {
        for (let floor = 1; floor < block.size[2]; floor++) {
          const cell: Cell = [block.at[0], block.at[1], block.at[2] + floor - 1];
          const a: Port = { zone, block: block.id, cell, face: Face.Down };
          const b = { ...a, cell: adjacentCell(cell, Face.Down), face: Face.Up };
          if (bearing(layout, a) && bearing(layout, b)) add(a, b, 'stairs');
          else errors.push('Stair outside its piece at ' + region(layout, a));
        }
      }
      for (const opening of block.openings) {
        const a: Port = { zone, block: block.id, cell: opening.cell, face: opening.face };
        if (!opening.joined) continue;
        if (!bearing(layout, a)) { errors.push('Opening outside its piece at ' + region(layout, a)); continue; }
        if ((block.id === layout.arrival && a.face === Face.Up && a.cell[2] === 0) ||
            (block.id === layout.exit && a.face === Face.Down && a.cell[2] === layout.spec.storeys - 1)) continue;
        const cell = adjacentCell(a.cell, a.face);
        const b: Port = { zone, cell, block: owner(layout, cell), face: opposite(a.face) };
        if (b.block === a.block || !hasOpening(layout, b) || !mayJoin(block.def, layout.blocks[b.block].def)) errors.push('Unmatched opening at ' + region(layout, a));
        else if (a.block < b.block) add(a, b, a.face < 4 ? 'opening' : 'shaft');
      }
    }
  }
  const gates = new Set<number>();
  const cuts = new Set<string>();
  for (const { upper: a, lower: b, kind, key } of passages) {
    const upper = byZone.get(a.zone), lower = byZone.get(b.zone);
    const cut = [a.zone, ...a.cell].join('/');
    if (!upper || !lower || b.zone !== a.zone + 1 || a.face !== Face.Down || b.face !== Face.Up ||
        a.cell[2] !== upper.spec.storeys - 1 || b.cell[2] !== 0 || !bearing(upper, a) || !bearing(lower, b)) {
      errors.push('Invalid slab endpoints at ' + cut); continue;
    }
    const top = anchor(upper, a), bottom = anchor(lower, b);
    const compatible = kind === 'gate'
      ? a.block === upper.exit && b.block === lower.arrival && hasOpening(upper, a) && hasOpening(lower, b) &&
        key === zoneKey((a.zone + 1) * STOREYS_PER_ZONE)
      : upper.blocks[a.block].def.openable && lower.blocks[b.block].def.openable;
    if (!compatible || cuts.has(cut) || top[0] !== bottom[0] || top[1] !== bottom[1] ||
        bottom[2] - top[2] !== ZONE_SLAB) {
      errors.push('Unsupported or misaligned slab cut at ' + cut); continue;
    }
    cuts.add(cut);
    if (kind === 'gate') gates.add(a.zone);
    add(a, b, kind, key);
  }
  for (const layout of zones.slice(0, -1)) {
    if (!gates.has(layout.spec.zone)) errors.push('Missing gate below zone ' + layout.spec.zone);
  }
  return { adjacent, edges, errors };
}

/** The effective state may come from a persistent overlay indexed by seed and cut ID. */
export function canCross(edge: Edge, from: string, traveler: Traveler, state = edge.state): boolean {
  const section = sections[edge.kind];
  if (from !== edge.from && from !== edge.to) return false;
  if (section.downOnly && from !== edge.from) return false;
  if (!(traveler.width > 0 && traveler.height > 0)) return false;
  if (traveler.width > section.width || traveler.height > section.clearance || state === 'blocked') return false;
  if (state === 'closed' && !(edge.key && traveler.keys?.includes(edge.key)) &&
      !(edge.kind === 'gate' && traveler.breakBarrier)) return false;
  if (state === 'flooded') return traveler.modes.includes('swim');
  return traveler.modes.some(mode => section.modes.includes(mode));
}

/** BFS minimizes the number of physical crossings. Each predecessor is the actual cut used. */
export function reachable(graph: SpatialGraph, start: string, traveler: Traveler,
  states: ReadonlyMap<string, State> = new Map(), target?: string): Map<string, Edge | null> {
  const previous = new Map<string, Edge | null>();
  if (!graph.adjacent.has(start)) return previous;
  previous.set(start, null);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (node === target) break;
    for (const edge of graph.adjacent.get(node)!) {
      const next = edge.from === node ? edge.to : edge.from;
      if (previous.has(next) || !canCross(edge, node, traveler, states.get(edge.id))) continue;
      previous.set(next, edge);
      queue.push(next);
    }
  }
  return previous;
}

export function route(graph: SpatialGraph, start: string, end: string, traveler: Traveler,
  states?: ReadonlyMap<string, State>): Edge[] | null {
  const previous = reachable(graph, start, traveler, states, end);
  if (!previous.has(end)) return null;
  const path: Edge[] = [];
  for (let node = end; node !== start;) {
    const edge = previous.get(node)!;
    path.push(edge);
    node = edge.from === node ? edge.to : edge.from;
  }
  return path.reverse();
}
