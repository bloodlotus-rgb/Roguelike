/**
 * The jenga (Ed3a): how a zone is put together from pieces on the grid of cells.
 *
 * A zone is a box of cells (6 × 6 m each, one storey high), four storeys deep. Pieces are
 * prisms of cells that turn in four ways; on their faces they have openings: doors (on a
 * side, at a storey's floor) and hatches (in a top or bottom face, for the ways between
 * storeys). Two pieces fit where their openings meet.
 *
 * The zone grows from where one arrives (the passage down from the zone above): every open
 * door asks for a piece whose own opening meets it, one that fits in the free cells, until
 * the zone is full enough. The ways between storeys are planted first, so the zone has its
 * four storeys joined. Then whatever was left apart is joined by tunnels, and the way out
 * (the passage to the zone below) goes on the deepest storey, as far as it can be from the
 * arrival. Only the layout: which piece goes where. Their shapes in voxels come after.
 *
 * Pure logic, deterministic from the seed.
 */
import { Rng } from './rng';

/** Tiles a cell measures a side. */
export const CELL = 6;

/** Faces of a cell: the four sides clockwise from east, then up and down. */
export const Face = { E: 0, S: 1, W: 2, N: 3, Up: 4, Down: 5 } as const;
export type Face = (typeof Face)[keyof typeof Face];

/** Each face's step to the neighbour cell (x, y, storey; storeys count down). */
const STEP: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [0, 1, 0],
  [-1, 0, 0],
  [0, -1, 0],
  [0, 0, -1],
  [0, 0, 1],
];

export function opposite(f: Face): Face {
  return (f < 4 ? (f + 2) % 4 : f === Face.Up ? Face.Down : Face.Up) as Face;
}

/** A face turned clockwise `turn` quarters (up and down stay). */
function turnFace(f: Face, turn: number): Face {
  return (f < 4 ? (f + turn) % 4 : f) as Face;
}

export type OpeningKind = 'door' | 'hatch';

export interface Opening {
  /** The cell of the piece it is on, in the piece's own frame (x, y, storey). */
  at: [number, number, number];
  face: Face;
}

export type BlockKind = 'corridor' | 'room' | 'hall' | 'vertical' | 'well' | 'tunnel';

export interface BlockDef {
  id: string;
  kind: BlockKind;
  /** Cells: across (x), along (y), storeys (z). */
  size: [number, number, number];
  openings: Opening[];
  /** How likely it is picked, relative to the others. */
  weight: number;
  /** Plain stonework: more doors can be opened in its walls (to join it to a tunnel). */
  openable?: boolean;
}

/** A piece set in the zone. */
export interface Placed {
  id: number;
  def: BlockDef;
  /** Its corner cell in the zone, and its turn (quarters clockwise). */
  at: [number, number, number];
  turn: number;
  /** Its size as turned. */
  size: [number, number, number];
  /** Its openings in zone cells, as turned (more can be added to openable pieces). */
  openings: Array<{ cell: [number, number, number]; face: Face; joined: boolean }>;
}

/**
 * The first pieces: plain stonework the plan can always use. The designed pieces (a
 * hundred, by era) and the procedural ones join them later.
 */
const door = (x: number, y: number, z: number, face: Face): Opening => ({ at: [x, y, z], face });
export const BASIC_BLOCKS: BlockDef[] = [
  { id: 'corridor', kind: 'corridor', size: [1, 1, 1], openings: [door(0, 0, 0, Face.E), door(0, 0, 0, Face.W)], weight: 10, openable: true },
  { id: 'corner', kind: 'corridor', size: [1, 1, 1], openings: [door(0, 0, 0, Face.E), door(0, 0, 0, Face.S)], weight: 6, openable: true },
  { id: 'tee', kind: 'corridor', size: [1, 1, 1], openings: [door(0, 0, 0, Face.E), door(0, 0, 0, Face.S), door(0, 0, 0, Face.W)], weight: 4, openable: true },
  { id: 'cross', kind: 'corridor', size: [1, 1, 1], openings: [0, 1, 2, 3].map((f) => door(0, 0, 0, f as Face)), weight: 2, openable: true },
  { id: 'closet', kind: 'room', size: [1, 1, 1], openings: [door(0, 0, 0, Face.W)], weight: 2, openable: true },
  {
    id: 'room',
    kind: 'room',
    size: [2, 1, 1],
    openings: [door(0, 0, 0, Face.W), door(1, 0, 0, Face.E), door(0, 0, 0, Face.S)],
    weight: 5,
    openable: true,
  },
  {
    id: 'bigRoom',
    kind: 'room',
    size: [2, 2, 1],
    openings: [door(0, 0, 0, Face.W), door(1, 1, 0, Face.E), door(1, 0, 0, Face.N), door(0, 1, 0, Face.S)],
    weight: 3,
    openable: true,
  },
  {
    id: 'hall',
    kind: 'hall',
    size: [3, 3, 1],
    openings: [door(0, 1, 0, Face.W), door(2, 1, 0, Face.E), door(1, 0, 0, Face.N), door(1, 2, 0, Face.S)],
    weight: 1.5,
    openable: true,
  },
  {
    // Two storeys high, with a gallery round the top: doors below, and one onto the gallery.
    id: 'tallHall',
    kind: 'hall',
    size: [2, 2, 2],
    openings: [door(0, 0, 1, Face.W), door(1, 1, 1, Face.E), door(1, 0, 0, Face.N)],
    weight: 1,
  },
  // The ways between storeys: spirals of one, two or three storeys' fall.
  { id: 'spiral2', kind: 'vertical', size: [1, 1, 2], openings: [door(0, 0, 0, Face.W), door(0, 0, 1, Face.E)], weight: 1.2 },
  { id: 'spiral3', kind: 'vertical', size: [1, 1, 3], openings: [door(0, 0, 0, Face.W), door(0, 0, 1, Face.S), door(0, 0, 2, Face.E)], weight: 0.6 },
];

/** The well one arrives by, from the zone above (its hatch up is the passage). */
export const ARRIVAL: BlockDef = { id: 'arrival', kind: 'well', size: [1, 1, 1], openings: [{ at: [0, 0, 0], face: Face.Up }, door(0, 0, 0, Face.E), door(0, 0, 0, Face.W)], weight: 0 };
/** The well out, to the zone below (its hatch down is the passage, locked). */
export const EXIT: BlockDef = { id: 'exit', kind: 'well', size: [1, 1, 1], openings: [{ at: [0, 0, 0], face: Face.Down }], weight: 0 };
const TUNNEL: BlockDef = { id: 'tunnel', kind: 'tunnel', size: [1, 1, 1], openings: [], weight: 0, openable: true };

export interface ZoneSpec {
  seed: string;
  /** Which zone of the building (0 at the top). */
  zone: number;
  /** Cells across and along, and storeys. */
  width: number;
  depth: number;
  storeys: number;
  /** The cell one arrives at, on the top storey. */
  arrival: [number, number];
  /** Whether there is a way out at the bottom (the deepest zone has none). */
  exit: boolean;
  /** How much of the zone is built, about (the rest is rock). */
  density?: number;
}

export interface ZoneLayout {
  spec: ZoneSpec;
  /** Which piece holds each cell (index x + y·width + z·width·depth), or -1 for rock. */
  cells: Int32Array;
  blocks: Placed[];
  arrival: number;
  /** The piece of the way out, and its cell. */
  exit: number | null;
  exitCell: [number, number] | null;
}

/** The cells a piece set at `at`, turned `turn`, takes; and its openings there. */
function setAt(def: BlockDef, at: [number, number, number], turn: number): Omit<Placed, 'id' | 'def'> {
  const [w, d, h] = def.size;
  const size: [number, number, number] = turn % 2 === 0 ? [w, d, h] : [d, w, h];
  const rot = (x: number, y: number): [number, number] => {
    let px = x;
    let py = y;
    let cw = w;
    let cd = d;
    for (let i = 0; i < turn; i++) {
      // A quarter turn clockwise (y grows southward): (x, y) -> (depth - 1 - y, x).
      [px, py] = [cd - 1 - py, px];
      [cw, cd] = [cd, cw];
    }
    return [px, py];
  };
  const openings = def.openings.map((o) => {
    const [x, y] = rot(o.at[0], o.at[1]);
    return { cell: [at[0] + x, at[1] + y, at[2] + o.at[2]] as [number, number, number], face: turnFace(o.face, turn), joined: false };
  });
  return { at, turn, size, openings };
}

export function assembleZone(spec: ZoneSpec): ZoneLayout {
  const { width, depth, storeys } = spec;
  const rng = Rng.derive(spec.seed, 'jenga', spec.zone);
  const cells = new Int32Array(width * depth * storeys).fill(-1);
  const index = (x: number, y: number, z: number) => x + y * width + z * width * depth;
  const inside = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < width && y < depth && z < storeys;
  const blocks: Placed[] = [];
  const target = Math.floor(width * depth * storeys * (spec.density ?? 0.42));
  let used = 0;

  const fits = (p: Omit<Placed, 'id' | 'def'>) => {
    for (let z = 0; z < p.size[2]; z++)
      for (let y = 0; y < p.size[1]; y++)
        for (let x = 0; x < p.size[0]; x++) {
          const c = [p.at[0] + x, p.at[1] + y, p.at[2] + z] as const;
          if (!inside(c[0], c[1], c[2]) || cells[index(c[0], c[1], c[2])] !== -1) return false;
        }
    return true;
  };
  const place = (def: BlockDef, p: Omit<Placed, 'id' | 'def'>): Placed => {
    const placed: Placed = { ...p, id: blocks.length, def };
    blocks.push(placed);
    for (let z = 0; z < p.size[2]; z++) for (let y = 0; y < p.size[1]; y++) for (let x = 0; x < p.size[0]; x++) cells[index(p.at[0] + x, p.at[1] + y, p.at[2] + z)] = placed.id;
    used += p.size[0] * p.size[1] * p.size[2];
    return placed;
  };
  /** The opening of a piece that meets this one from the neighbour cell, if any. */
  const facing = (cell: [number, number, number], face: Face) => {
    const [dx, dy, dz] = STEP[face];
    const n: [number, number, number] = [cell[0] + dx, cell[1] + dy, cell[2] + dz];
    if (!inside(n[0], n[1], n[2])) return { n, out: true, other: null as Placed | null, o: -1 };
    const id = cells[index(n[0], n[1], n[2])];
    if (id < 0) return { n, out: false, other: null, o: -1 };
    const other = blocks[id];
    const back = opposite(face);
    const o = other.openings.findIndex((q) => q.cell[0] === n[0] && q.cell[1] === n[1] && q.cell[2] === n[2] && q.face === back);
    return { n, out: false, other, o };
  };
  /** Joins whatever openings of a newly set piece meet others; returns the ones still open. */
  const join = (p: Placed) => {
    const open: Array<[number, number]> = [];
    p.openings.forEach((op, i) => {
      if (op.joined) return;
      const f = facing(op.cell, op.face);
      if (f.other && f.o >= 0) {
        op.joined = true;
        f.other.openings[f.o].joined = true;
      } else if (!f.out && !f.other && op.face < 4) open.push([p.id, i]);
    });
    return open;
  };

  // Where one arrives: its hatch up is the passage from above (joined, outside the zone).
  const [ax, ay] = spec.arrival;
  const arrivalBlock = place(ARRIVAL, setAt(ARRIVAL, [ax, ay, 0], rng.int(0, 3)));
  arrivalBlock.openings[0].joined = true;
  const frontier: Array<[number, number]> = join(arrivalBlock);

  // The ways between storeys, planted first: for each storey, a few spirals going down.
  const verticals = BASIC_BLOCKS.filter((b) => b.kind === 'vertical');
  for (let z = 0; z < storeys - 1; z++) {
    const count = Math.max(2, Math.round((width * depth) / 120));
    for (let k = 0; k < count; k++) {
      for (let tries = 0; tries < 20; tries++) {
        const def = rng.pick(verticals.filter((v) => z + v.size[2] <= storeys));
        const p = setAt(def, [rng.int(0, width - 1), rng.int(0, depth - 1), z], rng.int(0, 3));
        if (!fits(p)) continue;
        frontier.push(...join(place(def, p)));
        break;
      }
    }
  }

  // Growth: every open door asks for a piece that meets it.
  const catalogue = BASIC_BLOCKS;
  const total = catalogue.reduce((s, b) => s + b.weight, 0);
  const draw = () => {
    let r = rng.range(0, total);
    for (const b of catalogue) if ((r -= b.weight) < 0) return b;
    return catalogue[0];
  };
  while (frontier.length > 0 && used < target) {
    const [bid, oi] = frontier.splice(rng.int(0, frontier.length - 1), 1)[0];
    const op = blocks[bid].openings[oi];
    if (op.joined) continue;
    const f = facing(op.cell, op.face);
    if (f.out || f.other) continue;
    const want = opposite(op.face);
    let done = false;
    for (let tries = 0; tries < 14 && !done; tries++) {
      const def = draw();
      const turn = rng.int(0, 3);
      // Which of its openings meets this one, once turned: set the piece so it lands on n.
      const probe = setAt(def, [0, 0, 0], turn);
      const choices = probe.openings.map((q, i) => ({ q, i })).filter(({ q }) => q.face === want);
      if (choices.length === 0) continue;
      const { q } = rng.pick(choices);
      const at: [number, number, number] = [f.n[0] - q.cell[0], f.n[1] - q.cell[1], f.n[2] - q.cell[2]];
      const p = setAt(def, at, turn);
      if (!fits(p)) continue;
      frontier.push(...join(place(def, p)));
      done = true;
    }
  }

  // Whatever is not joined to the arrival gets a tunnel to it, through the rock.
  connect(blocks, cells, { width, depth, storeys, index, inside, place, rng, arrival: arrivalBlock.id });

  // The way out: on the deepest storey, beside the piece farthest from the arrival.
  let exit: number | null = null;
  let exitCell: [number, number] | null = null;
  if (spec.exit) {
    const dist = distances(blocks, cells, { width, depth, index, inside }, arrivalBlock.id);
    const z = storeys - 1;
    let best = -1;
    for (const b of blocks) {
      if (!b.def.openable || dist[b.id] < 0) continue;
      for (let y = 0; y < b.size[1]; y++)
        for (let x = 0; x < b.size[0]; x++) {
          const cz = b.at[2] + b.size[2] - 1;
          if (cz !== z) continue;
          for (const face of [Face.E, Face.S, Face.W, Face.N]) {
            const [dx, dy] = STEP[face];
            const n: [number, number, number] = [b.at[0] + x + dx, b.at[1] + y + dy, z];
            if (!inside(n[0], n[1], n[2]) || cells[index(n[0], n[1], n[2])] !== -1) continue;
            const score = dist[b.id] * 100 + rng.int(0, 99);
            if (score > best) {
              best = score;
              exitCell = [n[0], n[1]];
              exit = b.id * 4 + face;
            }
          }
        }
    }
    if (exitCell !== null && exit !== null) {
      const from = blocks[Math.floor(exit / 4)];
      const face = (exit % 4) as Face;
      const [dx, dy] = STEP[face];
      const fromCell: [number, number, number] = [exitCell[0] - dx, exitCell[1] - dy, storeys - 1];
      from.openings.push({ cell: fromCell, face, joined: true });
      const way = place(EXIT, setAt(EXIT, [exitCell[0], exitCell[1], storeys - 1], 0));
      way.openings[0].joined = true;
      way.openings.push({ cell: [exitCell[0], exitCell[1], storeys - 1], face: opposite(face), joined: true });
      exit = way.id;
    } else exit = null;
  }
  // Doors that lead nowhere are walled up.
  for (const b of blocks) b.openings = b.openings.filter((o) => o.joined);
  return { spec, cells, blocks, arrival: arrivalBlock.id, exit, exitCell };
}

interface Grid {
  width: number;
  depth: number;
  index: (x: number, y: number, z: number) => number;
  inside: (x: number, y: number, z: number) => boolean;
}

/** Steps (pieces crossed) from a piece to every other, through joined openings. */
export function distances(blocks: Placed[], cells: Int32Array, grid: Grid, from: number): Int32Array {
  const dist = new Int32Array(blocks.length).fill(-1);
  dist[from] = 0;
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const b = blocks[queue[head]];
    for (const op of b.openings) {
      if (!op.joined) continue;
      const [dx, dy, dz] = STEP[op.face];
      const n = [op.cell[0] + dx, op.cell[1] + dy, op.cell[2] + dz] as const;
      if (!grid.inside(n[0], n[1], n[2])) continue;
      const id = cells[grid.index(n[0], n[1], n[2])];
      if (id < 0 || dist[id] !== -1) continue;
      dist[id] = dist[b.id] + 1;
      queue.push(id);
    }
  }
  return dist;
}

/**
 * Joins every piece to the arrival. A piece cut off gets a tunnel through the rock (free
 * cells on its storey) to the nearest piece that is joined, opening a door at each end
 * (only in plain stonework). What cannot be joined is taken out.
 */
function connect(
  blocks: Placed[],
  cells: Int32Array,
  g: Grid & {
    storeys: number;
    place: (def: BlockDef, p: Omit<Placed, 'id' | 'def'>) => Placed;
    rng: Rng;
    arrival: number;
  },
): void {
  const sides = [Face.E, Face.S, Face.W, Face.N];
  for (let round = 0; round < 400; round++) {
    const dist = distances(blocks, cells, g, g.arrival);
    const lost = blocks.find((b) => dist[b.id] < 0 && cells[g.index(b.at[0], b.at[1], b.at[2])] === b.id);
    if (!lost) return;
    // From the lost piece's own group: a search through free cells, storey by storey.
    const group = distances(blocks, cells, g, lost.id);
    let joined = false;
    for (let z = lost.at[2]; z < lost.at[2] + lost.size[2] && !joined; z++) {
      // Starts: free cells beside an openable piece of the group on this storey.
      const prev = new Map<number, number>();
      const startOf = new Map<number, [number, Face]>();
      const queue: number[] = [];
      for (const b of blocks) {
        if (group[b.id] < 0 || !b.def.openable || z < b.at[2] || z >= b.at[2] + b.size[2]) continue;
        for (let y = 0; y < b.size[1]; y++)
          for (let x = 0; x < b.size[0]; x++)
            for (const f of sides) {
              const [dx, dy] = STEP[f];
              const nx = b.at[0] + x + dx;
              const ny = b.at[1] + y + dy;
              if (!g.inside(nx, ny, z)) continue;
              const i = g.index(nx, ny, z);
              if (cells[i] !== -1 || startOf.has(i)) continue;
              startOf.set(i, [b.id, f]);
              prev.set(i, -1);
              queue.push(i);
            }
      }
      for (let head = 0; head < queue.length && !joined; head++) {
        const i = queue[head];
        const x = i % g.width;
        const y = Math.floor(i / g.width) % g.depth;
        for (const f of sides) {
          const [dx, dy] = STEP[f];
          const nx = x + dx;
          const ny = y + dy;
          if (!g.inside(nx, ny, z)) continue;
          const ni = g.index(nx, ny, z);
          const id = cells[ni];
          if (id >= 0) {
            // A joined, openable piece: the tunnel ends here.
            if (dist[id] < 0 || !blocks[id].def.openable) continue;
            const path: number[] = [];
            for (let c = i; c !== -1; c = prev.get(c)!) path.unshift(c);
            const tunnel: Placed[] = path.map((c) => g.place(TUNNEL, { at: [c % g.width, Math.floor(c / g.width) % g.depth, z], turn: 0, size: [1, 1, 1], openings: [] }));
            const cellOf = (c: number): [number, number, number] => [c % g.width, Math.floor(c / g.width) % g.depth, z];
            const faceTo = (a: number, b: number): Face => {
              const ax = a % g.width;
              const ay = Math.floor(a / g.width) % g.depth;
              const bx = b % g.width;
              const by = Math.floor(b / g.width) % g.depth;
              return (bx > ax ? Face.E : bx < ax ? Face.W : by > ay ? Face.S : Face.N) as Face;
            };
            for (let k = 0; k + 1 < path.length; k++) {
              const f2 = faceTo(path[k], path[k + 1]);
              tunnel[k].openings.push({ cell: cellOf(path[k]), face: f2, joined: true });
              tunnel[k + 1].openings.push({ cell: cellOf(path[k + 1]), face: opposite(f2), joined: true });
            }
            // Its two ends: into the lost group, and into the joined piece.
            const [fromId, fromFace] = startOf.get(path[0])!;
            const back = opposite(fromFace);
            tunnel[0].openings.push({ cell: cellOf(path[0]), face: back, joined: true });
            const [bx, by] = [path[0] % g.width, Math.floor(path[0] / g.width) % g.depth];
            const [sx, sy] = STEP[back];
            blocks[fromId].openings.push({ cell: [bx + sx, by + sy, z], face: fromFace, joined: true });
            tunnel[tunnel.length - 1].openings.push({ cell: cellOf(path[path.length - 1]), face: f, joined: true });
            blocks[id].openings.push({ cell: [nx, ny, z], face: opposite(f), joined: true });
            joined = true;
            break;
          }
          if (prev.has(ni)) continue;
          prev.set(ni, i);
          queue.push(ni);
        }
      }
    }
    if (!joined) {
      // Taken out: its cells back to rock, and its group with it.
      for (const b of blocks) {
        if (group[b.id] < 0) continue;
        for (let z = 0; z < b.size[2]; z++) for (let y = 0; y < b.size[1]; y++) for (let x = 0; x < b.size[0]; x++) cells[g.index(b.at[0] + x, b.at[1] + y, b.at[2] + z)] = -1;
        b.openings = [];
      }
    }
  }
}

/** The zone storey by storey in text, for tests and debugging: a letter per cell. */
export function zoneText(layout: ZoneLayout): string[][] {
  const { width, depth, storeys } = layout.spec;
  const letter: Record<BlockKind, string> = { corridor: '+', room: 'r', hall: 'H', vertical: 'S', well: 'W', tunnel: 't' };
  const out: string[][] = [];
  for (let z = 0; z < storeys; z++) {
    const rows: string[] = [];
    for (let y = 0; y < depth; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        const id = layout.cells[x + y * width + z * width * depth];
        row += id < 0 ? '·' : letter[layout.blocks[id].def.kind];
      }
      rows.push(row);
    }
    out.push(rows);
  }
  return out;
}
