/**
 * The jenga (Ed3a): how a zone is put together from pieces on the grid of cells.
 *
 * A zone is a box of cells (6 × 6 m each, one storey high), four storeys deep. Pieces are
 * prisms of cells that turn in four ways; on their faces they have openings: doors (on a
 * side, at a storey's floor) and hatches (in a top or bottom face, for the ways between
 * storeys). Two pieces fit where their openings meet.
 *
 * Openings have a role: most lead onto the circulation (passages, galleries, stairs); an
 * interior one joins two spaces inside a piece (a chapel behind its antechamber). A room
 * never opens straight onto another room: rooms hang from the circulation, so there are no
 * strings of rooms one after another.
 *
 * The zone is laid in passes, like a building: first the circulation (from where one
 * arrives, and the ways between storeys planted first, so the four storeys are joined),
 * long runs with loops in them, so there are ways round; then the rooms, hung from it;
 * then whatever was left apart is joined by tunnels, and the way out (the passage to the
 * zone below) goes on the deepest storey, as far as it can be from the arrival. Only the
 * layout: which piece goes where. Their shapes in voxels come after.
 *
 * Pure logic, deterministic from the seed.
 */
import { Rng } from './rng.ts';
import { monumentalAtrium, processionalGallery } from './macros.ts';

/** Tiles a cell measures a side. */
export const CELL = 6;

/** Faces of a cell: the four sides clockwise from east, then up and down. */
export const Face = { E: 0, S: 1, W: 2, N: 3, Up: 4, Down: 5 } as const;
export type Face = (typeof Face)[keyof typeof Face];

/** Each face's step to the neighbour cell (x, y, storey; storeys count down). */
export const STEP: ReadonlyArray<readonly [number, number, number]> = [
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

/**
 * What a piece is: circulation (corridors, tunnels, stairs, wells), a space (rooms and
 * halls, which hang from the circulation), or a complex (several rooms round its own
 * circulation, which goes on into the zone's).
 */
export type BlockKind = 'corridor' | 'room' | 'hall' | 'vertical' | 'well' | 'tunnel' | 'complex' | 'macro';

/** Spaces hang from the circulation; everything else is (or carries) circulation. */
export function isSpace(kind: BlockKind): boolean {
  return kind === 'room' || kind === 'hall';
}

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
  /** Reserve a stair between adjacent landings in the corner cell of each storey. */
  stair?: boolean;
  /** Compound cells are separate chambers. Each cut joins exactly two adjacent chambers. */
  interior?: Opening[];
  /** Empty volume permanently reserved for a multi-storey macropiece; not a floor. */
  voidCells?: Array<[number, number, number]>;
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

/** External room doors meet a circulation piece. Internal cuts belong to a single blueprint. */
export function mayJoin(a: BlockDef, b: BlockDef): boolean {
  return !(isSpace(a.kind) && isSpace(b.kind));
}

/**
 * The first pieces: plain stonework the plan can always use. The designed pieces (a
 * hundred, by era) and the procedural ones join them later.
 */
const door = (x: number, y: number, z: number, face: Face): Opening => ({ at: [x, y, z], face });
export const BASIC_BLOCKS: BlockDef[] = [
  // Circulation: long runs, now and then a turn or a branch.
  { id: 'corridor', kind: 'corridor', size: [1, 1, 1], openings: [door(0, 0, 0, Face.E), door(0, 0, 0, Face.W)], weight: 12, openable: true },
  { id: 'corner', kind: 'corridor', size: [1, 1, 1], openings: [door(0, 0, 0, Face.E), door(0, 0, 0, Face.S)], weight: 3, openable: true },
  { id: 'tee', kind: 'corridor', size: [1, 1, 1], openings: [door(0, 0, 0, Face.E), door(0, 0, 0, Face.S), door(0, 0, 0, Face.W)], weight: 1.4, openable: true },
  { id: 'cross', kind: 'corridor', size: [1, 1, 1], openings: [0, 1, 2, 3].map((f) => door(0, 0, 0, f as Face)), weight: 0.4, openable: true },
  {
    // A wing: a passage along one side, three rooms off it (its doors inside are interior).
    id: 'wing',
    interior: [door(0, 0, 0, Face.E), door(1, 0, 0, Face.E),
      door(0, 0, 0, Face.S), door(1, 0, 0, Face.S), door(2, 0, 0, Face.S)],
    kind: 'complex',
    size: [3, 2, 1],
    openings: [door(0, 0, 0, Face.W), door(2, 0, 0, Face.E)],
    weight: 1.2,
  },
  {
    // A cloister: a covered walk round a court with one interior doorway; in by the middle of each side.
    id: 'cloister',
    interior: [door(0, 0, 0, Face.E), door(1, 0, 0, Face.E),
      door(2, 0, 0, Face.S), door(2, 1, 0, Face.S), door(2, 2, 0, Face.W),
      door(1, 2, 0, Face.W), door(0, 2, 0, Face.N), door(0, 1, 0, Face.N),
      door(1, 0, 0, Face.S)], // One doorway into the court.
    kind: 'complex',
    size: [3, 3, 1],
    openings: [door(0, 1, 0, Face.W), door(2, 1, 0, Face.E), door(1, 0, 0, Face.N), door(1, 2, 0, Face.S)],
    weight: 0.6,
  },
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
    stair: true,
    kind: 'hall',
    size: [2, 2, 2],
    openings: [door(0, 0, 1, Face.W), door(1, 1, 1, Face.E), door(1, 0, 0, Face.N)],
    weight: 1,
  },
  // The ways between storeys: spirals of one, two or three storeys' fall.
  { id: 'spiral2', kind: 'vertical', stair: true, size: [1, 1, 2], openings: [door(0, 0, 0, Face.W), door(0, 0, 1, Face.E)], weight: 1.2 },
  { id: 'spiral3', kind: 'vertical', stair: true, size: [1, 1, 3], openings: [door(0, 0, 0, Face.W), door(0, 0, 1, Face.S), door(0, 0, 2, Face.E)], weight: 0.6 },
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

/** Rotate a catalogue cut with its footprint, including interior partitions. */
export function placeOpening(def: BlockDef, at: [number, number, number], turn: number, opening: Opening) {
  let [x, y, z] = opening.at;
  let [width, depth] = def.size;
  for (let i = 0; i < turn; i++) {
    [x, y] = [depth - 1 - y, x];
    [width, depth] = [depth, width];
  }
  const cell: [number, number, number] = [at[0] + x, at[1] + y, at[2] + z];
  return { cell, face: turnFace(opening.face, turn), joined: false };
}

function setAt(def: BlockDef, at: [number, number, number], turn: number): Omit<Placed, 'id' | 'def'> {
  const [w, d, h] = def.size;
  const size: [number, number, number] = turn % 2 === 0 ? [w, d, h] : [d, w, h];
  const openings = def.openings.map(o => placeOpening(def, at, turn, o));
  return { at, turn, size, openings };
}

export function assembleZone(spec: ZoneSpec): ZoneLayout {
  const { width, depth, storeys } = spec;
  const rng = Rng.derive(spec.seed, 'jenga', spec.zone);
  const cells = new Int32Array(width * depth * storeys).fill(-1);
  const index = (x: number, y: number, z: number) => x + y * width + z * width * depth;
  const inside = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < width && y < depth && z < storeys;
  const blocks: Placed[] = [];
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
    // -2 means reserved air void: other pieces must not fill it and it has no floor.
    const reservedVoid = def.voidCells && new Set(def.voidCells.map(local => {
      const transformed = placeOpening(def, p.at, p.turn, { at: local, face: Face.Up }).cell;
      return transformed.join('/');
    }));
    for (let z = 0; z < p.size[2]; z++) for (let y = 0; y < p.size[1]; y++) for (let x = 0; x < p.size[0]; x++) {
      const wx = p.at[0] + x, wy = p.at[1] + y, wz = p.at[2] + z;
      cells[index(wx, wy, wz)] = reservedVoid?.has([wx, wy, wz].join('/')) ? -2 : placed.id;
    }
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
        // Only where the two may meet (never a room straight onto a room).
        if (mayJoin(p.def, f.other.def)) {
          op.joined = true;
          f.other.openings[f.o].joined = true;
        }
      } else if (!f.out && !f.other && op.face < 4) open.push([p.id, i]);
    });
    return open;
  };

  // Where one arrives: its hatch up is the passage from above (joined, outside the zone).
  const [ax, ay] = spec.arrival;
  const arrivalBlock = place(ARRIVAL, setAt(ARRIVAL, [ax, ay, 0], rng.int(0, 3)));
  arrivalBlock.openings[0].joined = true;
  const frontier: Array<[number, number]> = join(arrivalBlock);

  // E0-M: architectural anchors reserve their full 3D envelope before the
  // ordinary circulation/room growth. They cannot cross a sealed zone slab.
  const reserveMacro = (def: BlockDef, attempts: number, preferred?: 0 | 1): boolean => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const turn = preferred ?? rng.int(0, 3);
      const size = turn % 2 === 0 ? def.size : [def.size[1], def.size[0], def.size[2]];
      const maxX = width - size[0] - 1, maxY = depth - size[1] - 1;
      if (maxX < 1 || maxY < 1) return false;
      const candidate = setAt(def, [rng.int(1, maxX), rng.int(1, maxY), 0], turn);
      if (!fits(candidate)) continue;
      frontier.push(...join(place(def, candidate)));
      return true;
    }
    return false;
  };
  if (width >= 12 && depth >= 12 && storeys >= 2) {
    const horizontal = width >= depth;
    const gallery = processionalGallery((horizontal ? width : depth) - 2, storeys);
    if (!reserveMacro(gallery, 50, horizontal ? 0 : 1)) {
      throw new Error('Cannot reserve zone-spanning gallery in zone ' + spec.zone);
    }
    // Every fifth zone marks an area with a four-storey central void.
    if (spec.zone % 5 === 0 && !reserveMacro(monumentalAtrium(6, storeys), 80)) {
      throw new Error('Cannot reserve monumental atrium in zone ' + spec.zone);
    }
  }

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

  /**
   * Grows from the open doors in `frontier`, with pieces drawn from `catalogue`, until
   * `limit` cells are built: each door asks for a piece whose opening meets it (and may
   * meet it) and that fits in the free cells. Doors of circulation go on growing; with
   * `onlyOnce`, each door is asked once (a room hung on it or nothing).
   */
  const grow = (catalogue: BlockDef[], limit: number, onlyOnce: boolean, chance = 1) => {
    const total = catalogue.reduce((sum, b) => sum + b.weight, 0);
    const draw = () => {
      let r = rng.range(0, total);
      for (const b of catalogue) if ((r -= b.weight) < 0) return b;
      return catalogue[0];
    };
    const later: Array<[number, number]> = [];
    while (frontier.length > 0 && used < limit) {
      const [bid, oi] = frontier.splice(rng.int(0, frontier.length - 1), 1)[0];
      const from = blocks[bid];
      const op = from.openings[oi];
      if (op.joined) continue;
      const f = facing(op.cell, op.face);
      if (f.out || f.other) continue;
      if (!rng.chance(chance)) {
        later.push([bid, oi]);
        continue;
      }
      const want = opposite(op.face);
      let done = false;
      for (let tries = 0; tries < 14 && !done; tries++) {
        const def = draw();
        const turn = rng.int(0, 3);
        // Which of its openings meets this one, once turned: set the piece so it lands on n.
        const probe = setAt(def, [0, 0, 0], turn);
        const choices = probe.openings.filter((q) => q.face === want && mayJoin(from.def, def));
        if (choices.length === 0) continue;
        const q = rng.pick(choices);
        const at: [number, number, number] = [f.n[0] - q.cell[0], f.n[1] - q.cell[1], f.n[2] - q.cell[2]];
        const p = setAt(def, at, turn);
        if (!fits(p)) continue;
        const placed = place(def, p);
        const open = join(placed);
        // Rooms do not grow the zone: only circulation carries on.
        if (!isSpace(def.kind)) frontier.push(...open);
        done = true;
      }
      if (!done && !onlyOnce) later.push([bid, oi]);
    }
    frontier.push(...later);
  };

  const circulation = BASIC_BLOCKS.filter((b) => !isSpace(b.kind) && b.kind !== 'vertical');
  const spaces = BASIC_BLOCKS.filter((b) => isSpace(b.kind));
  const all = width * depth * storeys;
  const density = spec.density ?? 0.42;
  /**
   * Rooms along the passages: beside a passage (or a tunnel) with free rock on that side,
   * now and then a room, with a door opened in the passage's wall. Then rooms on the
   * passages' open ends too.
   */
  const hangRooms = (limit: number, chance: number) => {
    const sides: Array<[number, Face]> = [];
    for (const b of blocks) {
      if (b.def.kind !== 'corridor' && b.def.kind !== 'tunnel') continue;
      for (const face of [Face.E, Face.S, Face.W, Face.N]) sides.push([b.id, face]);
    }
    for (const [bid, face] of rng.shuffle(sides)) {
      if (used >= limit) break;
      if (!rng.chance(chance)) continue;
      const from = blocks[bid];
      const cell: [number, number, number] = [from.at[0], from.at[1], from.at[2]];
      if (from.openings.some((o) => o.face === face)) continue;
      const f = facing(cell, face);
      if (f.out || f.other) continue;
      const want = opposite(face);
      for (let tries = 0; tries < 8; tries++) {
        const def = rng.pick(spaces);
        const turn = rng.int(0, 3);
        const probe = setAt(def, [0, 0, 0], turn);
        const choices = probe.openings.filter((q) => q.face === want);
        if (choices.length === 0) continue;
        const q = rng.pick(choices);
        const p = setAt(def, [f.n[0] - q.cell[0], f.n[1] - q.cell[1], f.n[2] - q.cell[2]], turn);
        if (!fits(p)) continue;
        from.openings.push({ cell, face, joined: false });
        join(place(def, p));
        break;
      }
    }
    for (const b of blocks) {
      if (isSpace(b.def.kind)) continue;
      b.openings.forEach((op, i) => {
        if (!op.joined && op.face < 4) frontier.push([b.id, i]);
      });
    }
    grow(spaces, limit, true, 0.7);
  };

  // First the circulation: about a quarter of what will be built.
  grow(circulation, Math.floor(all * density * 0.28), false);
  // Loops: some dangling passages joined to other circulation close by, so there are ways round.
  closeLoops(blocks, cells, { width, depth, storeys, index, inside, place, rng, arrival: arrivalBlock.id }, 5, Math.max(storeys * 3, Math.round((width * depth * storeys) / 140)));
  // Then the rooms, hung from the circulation.
  hangRooms(Math.floor(all * density), 0.45);
  // And if the zone is still thin, more circulation and rooms off it, in turn.
  for (let round = 0; round < 4 && used < Math.floor(all * density * 0.85); round++) {
    for (const b of blocks) {
      if (isSpace(b.def.kind)) continue;
      b.openings.forEach((op, i) => {
        if (!op.joined && op.face < 4) frontier.push([b.id, i]);
      });
    }
    grow(circulation, used + Math.floor(all * density * 0.06), false);
    hangRooms(Math.floor(all * density), 0.45);
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
              // Do not open a tunnel into a reserved void (no traversable landing).
              if (cells[g.index(b.at[0] + x, b.at[1] + y, z)] !== b.id) continue;
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

/**
 * Closes loops in the circulation: from every passage that ends in a dead end (one door
 * joined), a short tunnel through the rock to the nearest other circulation on its storey,
 * no longer than `reach` cells. Ways round, so a horde can be given the slip.
 */
function closeLoops(
  blocks: Placed[],
  cells: Int32Array,
  g: Grid & { storeys: number; place: (def: BlockDef, p: Omit<Placed, 'id' | 'def'>) => Placed; rng: Rng; arrival: number },
  reach: number,
  most: number,
): void {
  const sides = [Face.E, Face.S, Face.W, Face.N];
  const ends = blocks.filter((b) => b.def.kind === 'corridor' && b.openings.filter((o) => o.joined).length === 1);
  let made = 0;
  for (const b of g.rng.shuffle(ends)) {
    if (made >= most) return;
    const z = b.at[2];
    const start = g.index(b.at[0], b.at[1], z);
    // Search the free cells from the dead end's open sides.
    const prev = new Map<number, number>();
    const queue: number[] = [];
    const depthOf = new Map<number, number>();
    for (const f of sides) {
      if (b.openings.some((o) => o.joined && o.face === f)) continue;
      const [dx, dy] = STEP[f];
      const nx = b.at[0] + dx;
      const ny = b.at[1] + dy;
      if (!g.inside(nx, ny, z) || cells[g.index(nx, ny, z)] !== -1) continue;
      const i = g.index(nx, ny, z);
      prev.set(i, start);
      depthOf.set(i, 1);
      queue.push(i);
    }
    let done = false;
    for (let head = 0; head < queue.length && !done; head++) {
      const i = queue[head];
      if (depthOf.get(i)! > reach) continue;
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
          const other = blocks[id];
          // Onto other plain circulation, not back onto itself or its neighbour.
          if (id === b.id || other.def.kind !== 'corridor' || depthOf.get(i)! < 2) continue;
          const path: number[] = [];
          for (let c = i; c !== start; c = prev.get(c)!) path.unshift(c);
          const cellOf = (c: number): [number, number, number] => [c % g.width, Math.floor(c / g.width) % g.depth, z];
          const tunnel = path.map((c) => g.place(TUNNEL, { at: cellOf(c), turn: 0, size: [1, 1, 1], openings: [] }));
          const faceTo = (a: [number, number, number], c: [number, number, number]): Face => (c[0] > a[0] ? Face.E : c[0] < a[0] ? Face.W : c[1] > a[1] ? Face.S : Face.N) as Face;
          const chain: Array<[number, number, number]> = [[b.at[0], b.at[1], z], ...path.map(cellOf), [nx, ny, z]];
          const owners = [b, ...tunnel, other];
          for (let k = 0; k + 1 < chain.length; k++) {
            const f2 = faceTo(chain[k], chain[k + 1]);
            owners[k].openings.push({ cell: chain[k], face: f2, joined: true });
            owners[k + 1].openings.push({ cell: chain[k + 1], face: opposite(f2), joined: true });
          }
          done = true;
          made++;
          break;
        }
        if (prev.has(ni)) continue;
        prev.set(ni, i);
        depthOf.set(ni, depthOf.get(i)! + 1);
        queue.push(ni);
      }
    }
  }
}

/** The zone storey by storey in text, for tests and debugging: a letter per cell. */
export function zoneText(layout: ZoneLayout): string[][] {
  const { width, depth, storeys } = layout.spec;
  const letter: Record<BlockKind, string> = { corridor: '+', room: 'r', hall: 'H', vertical: 'S', well: 'W', tunnel: 't', complex: 'C', macro: 'M' };
  const out: string[][] = [];
  for (let z = 0; z < storeys; z++) {
    const rows: string[] = [];
    for (let y = 0; y < depth; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        const id = layout.cells[x + y * width + z * width * depth];
        row += id === -2 ? '○' : id < 0 ? '·' : letter[layout.blocks[id].def.kind];
      }
      rows.push(row);
    }
    out.push(rows);
  }
  return out;
}
