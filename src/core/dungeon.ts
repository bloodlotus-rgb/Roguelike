import { CONFIG } from './config';
import type { ItemKind } from './inventory';
import { Rng } from './rng';

export const Tile = {
  Wall: 0,
  Floor: 1,
  /** Open air over the level below: you see and light across it, but nobody walks on it. */
  Void: 2,
  /** A chasm: a crack with no bottom in sight. Seen and lit across; crossed only by a bridge. */
  Chasm: 3,
  /** Deep water: seen and lit across, never walked (it is walked around). */
  Deep: 4,
} as const;

/** Water on a tile: none, shallow (floor you wade through) or deep (see `Tile.Deep`). */
export const Water = { None: 0, Shallow: 1, Deep: 2 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** What can lie on the floor: anything that goes in the backpack, or a pile of gold. */
export type LootKind = ItemKind | 'gold';

/** Fixed things in a level: fountains are part of its geography; remains and crates can be searched. */
export type FeatureKind = 'fountain' | 'drip' | 'remains' | 'crate';

export interface Feature {
  id: number;
  kind: FeatureKind;
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

export type RoomShape = 'rect' | 'cave' | 'hall';

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: RoomShape;
}

export interface LevelItem {
  id: number;
  kind: LootKind;
  /** Coins in a pile of gold. */
  amount?: number;
  /** Uses left, for a dropped waterskin. */
  charges?: number;
  turbid?: boolean;
  poison?: boolean;
  /** Tile coordinates. */
  x: number;
  y: number;
}

/**
 * A flight of stairs between two levels stacked in the same space: an entrance tile at the
 * top, three steps, and an exit tile at the bottom, walled in on both sides. On the level
 * above, the top opens into a room and the bottom is rock; on the level below, the bottom
 * opens into a room and the top is rock. The steps are the same tiles on both levels.
 */
export interface Stairwell {
  top: Point;
  /** One tile, pointing down the stairs. */
  dir: Point;
  steps: [Point, Point, Point];
  bottom: Point;
}

export function makeStairwell(top: Point, dir: Point): Stairwell {
  const at = (k: number) => ({ x: top.x + dir.x * k, y: top.y + dir.y * k });
  return { top, dir, steps: [at(1), at(2), at(3)], bottom: at(4) };
}

/** How far down the stairs a point is, in tiles from the top tile's centre (0 to 4). */
export function stairProgress(sw: Stairwell, p: Point): number {
  return (p.x - (sw.top.x + 0.5)) * sw.dir.x + (p.y - (sw.top.y + 0.5)) * sw.dir.y;
}

/** Whether a point stands on the steps of a stairwell (not its top or bottom tile). */
export function onSteps(sw: Stairwell, p: Point): boolean {
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  return sw.steps.some((s) => s.x === tx && s.y === ty);
}

/** Height between two floors: what the three steps go down. */
export const LEVEL_HEIGHT = 2.4;

/** Ground within a level: the floor, a ramp, or a raised terrace. */
export const Ground = { Low: 0, Ramp: 1, High: 2 } as const;
/** How high a terrace stands: too high to step up, low enough to jump down. */
export const TERRACE_HEIGHT = 0.7;

export function groundAt(level: Level, x: number, y: number): number {
  if (!level.ground || x < 0 || y < 0 || x >= level.width || y >= level.height) return Ground.Low;
  return level.ground[y * level.width + x];
}

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Height of the ground at a point: on a ramp it rises evenly from its low side. */
export function groundHeight(level: Level, p: Point): number {
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  const g = groundAt(level, tx, ty);
  if (g === Ground.High) return TERRACE_HEIGHT;
  if (g === Ground.Low) return 0;
  const low = NEIGHBOURS.find(([dx, dy]) => groundAt(level, tx + dx, ty + dy) === Ground.Low && isFloor(level, tx + dx, ty + dy));
  if (!low) return TERRACE_HEIGHT / 2;
  const fx = p.x - tx;
  const fy = p.y - ty;
  // Zero at the edge shared with the low floor, full height at the opposite edge.
  const t = low[0] === 1 ? 1 - fx : low[0] === -1 ? fx : low[1] === 1 ? 1 - fy : fy;
  return TERRACE_HEIGHT * Math.min(1, Math.max(0, t));
}

/** Whether one can go from one tile to the next: up onto a terrace only by a ramp. */
export function canStep(level: Level, fx: number, fy: number, tx: number, ty: number): boolean {
  return !(groundAt(level, fx, fy) === Ground.Low && groundAt(level, tx, ty) === Ground.High);
}

export interface Level {
  seed: string;
  depth: number;
  width: number;
  height: number;
  /** Row-major tiles, `tiles[y * width + x]`. */
  tiles: Uint8Array;
  rooms: Room[];
  start: Point;
  stairs: Point;
  items: LevelItem[];
  features: Feature[];
  /** Narrow entrances to rooms: where doors hang and barricades go. */
  doorways: Point[];
  /** Doorways that have a door (part of the level's geography). */
  doors: Point[];
  /** The stairs down to the next level, and the stairs up (the previous level's down). */
  down: Stairwell;
  up: Stairwell;
  /** A hole down to the next level; a rope tied here is a shortcut. */
  pit: Point;
  /**
   * A double-height room: its walkway runs along the walls, its middle is open air over a
   * hall of the level below. The rectangle is the room's; the void is its inside.
   */
  gallery: Room | null;
  /** Where a rope from the level above comes down. */
  landing: Point;
  /** Collapses blocking a corridor: floor under the stones, shut until someone clears them. */
  rubble: Point[];
  /** Tiles of chasm spanned by a bridge (floor now, drawn as planks). */
  bridges: number[];
  /** Ground of each tile (see `Ground`); absent means all low. */
  ground?: Uint8Array;
  /** Water of each tile (see `Water`); absent means dry. */
  water?: Uint8Array;
  /** An underground river: its course, upstream first (tiles of the deep channel's middle). */
  river?: Point[];
  /** Where the river drains down a sinkhole, falling to the level below. */
  sink?: Point;
  /** Where the river from the level above falls in from the ceiling, into a pool. */
  fall?: Point;
  /** Tiles shut right now (closed doors, barricades): floor, but nothing gets through. */
  closed?: Set<number>;
}

export function tileAt(level: Level, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return Tile.Wall;
  return level.tiles[y * level.width + x] as Tile;
}

export function isFloor(level: Level, x: number, y: number): boolean {
  return tileAt(level, x, y) === Tile.Floor;
}

/** Floor that can be crossed right now (not behind a shut door, not open air). */
export function isPassable(level: Level, x: number, y: number): boolean {
  return isFloor(level, x, y) && !level.closed?.has(y * level.width + x);
}

/** Whether sight and light get across a tile: floor or open air, not shut. */
export function isSeeThrough(level: Level, x: number, y: number): boolean {
  const t = tileAt(level, x, y);
  return (t === Tile.Floor || t === Tile.Void || t === Tile.Chasm || t === Tile.Deep) && !level.closed?.has(y * level.width + x);
}

export function waterAt(level: Level, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return Water.None;
  return level.water?.[y * level.width + x] ?? Water.None;
}

export function isShallow(level: Level, x: number, y: number): boolean {
  return waterAt(level, x, y) === Water.Shallow;
}

export function isDeep(level: Level, x: number, y: number): boolean {
  return tileAt(level, x, y) === Tile.Deep;
}

export function isChasm(level: Level, x: number, y: number): boolean {
  return tileAt(level, x, y) === Tile.Chasm;
}

/** A tile with a bridge over a chasm. */
export function isBridge(level: Level, x: number, y: number): boolean {
  return level.bridges.includes(y * level.width + x);
}

/** Open air over the level below (a gallery's void). */
export function isVoid(level: Level, x: number, y: number): boolean {
  return tileAt(level, x, y) === Tile.Void;
}

function center(room: Room): Point {
  return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
}

function overlaps(a: Room, b: Room, margin: number): boolean {
  return (
    a.x - margin < b.x + b.w &&
    a.x + a.w + margin > b.x &&
    a.y - margin < b.y + b.h &&
    a.y + a.h + margin > b.y
  );
}

function carveRoom(tiles: Uint8Array, width: number, room: Room, rng: Rng): void {
  const cx = room.x + (room.w - 1) / 2;
  const cy = room.y + (room.h - 1) / 2;
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (room.shape === 'cave') {
        // Irregular blob: an ellipse with a ragged edge.
        const dx = (x - cx) / (room.w / 2);
        const dy = (y - cy) / (room.h / 2);
        if (dx * dx + dy * dy > 1 + rng.range(-0.35, 0.15)) continue;
      }
      tiles[y * width + x] = Tile.Floor;
    }
  }
  if (room.shape === 'hall') {
    // Columns on a grid, never touching each other or the walls.
    for (let y = room.y + 2; y < room.y + room.h - 2; y += 2) {
      for (let x = room.x + 2; x < room.x + room.w - 2; x += 2) tiles[y * width + x] = Tile.Wall;
    }
  }
}

/** Turns into rock any floor that cannot be reached from `origin`. */
function removeUnreachable(level: Level, origin: Point): void {
  const dist = floorDistances(level, origin);
  for (let i = 0; i < level.tiles.length; i++) {
    if (level.tiles[i] === Tile.Floor && dist[i] < 0) level.tiles[i] = Tile.Wall;
  }
}

/**
 * A natural tunnel: it heads for its goal but drifts from side to side, and here and
 * there opens a little wider, as water or old digging would leave it.
 */
function carveTunnel(tiles: Uint8Array, width: number, height: number, from: Point, to: Point, rng: Rng): void {
  let { x, y } = from;
  const carve = (cx: number, cy: number) => {
    if (cx >= 2 && cy >= 2 && cx < width - 2 && cy < height - 2) tiles[cy * width + cx] = Tile.Floor;
  };
  for (let steps = 0; steps < 400 && (x !== to.x || y !== to.y); steps++) {
    carve(x, y);
    if (rng.chance(0.18)) carve(x + rng.int(-1, 1), y + rng.int(-1, 1));
    const dx = Math.sign(to.x - x);
    const dy = Math.sign(to.y - y);
    // Mostly toward the goal, now and then sideways.
    if (rng.chance(0.25)) {
      if (dx !== 0 && rng.chance(0.5)) y += rng.chance(0.5) ? 1 : -1;
      else if (dy !== 0) x += rng.chance(0.5) ? 1 : -1;
      else x += dx || (rng.chance(0.5) ? 1 : -1);
    } else if (dx !== 0 && (dy === 0 || rng.chance(Math.abs(to.x - x) / (Math.abs(to.x - x) + Math.abs(to.y - y))))) x += dx;
    else y += dy;
    x = Math.max(2, Math.min(width - 3, x));
    y = Math.max(2, Math.min(height - 3, y));
  }
  carve(x, y);
}

function carveCorridor(tiles: Uint8Array, width: number, from: Point, to: Point, horizontalFirst: boolean): void {
  const carve = (x: number, y: number) => {
    tiles[y * width + x] = Tile.Floor;
  };
  let { x, y } = from;
  const stepX = () => {
    while (x !== to.x) {
      carve(x, y);
      x += Math.sign(to.x - x);
    }
  };
  const stepY = () => {
    while (y !== to.y) {
      carve(x, y);
      y += Math.sign(to.y - y);
    }
  };
  if (horizontalFirst) {
    stepX();
    stepY();
  } else {
    stepY();
    stepX();
  }
  carve(x, y);
}

/** Breadth-first distances in tiles from `origin` over floor tiles; -1 means unreachable. */
export function floorDistances(level: Level, origin: Point): Int32Array {
  const { width, height } = level;
  const dist = new Int32Array(width * height).fill(-1);
  const queue: number[] = [origin.y * width + origin.x];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const x = index % width;
    const y = Math.floor(index / width);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isPassable(level, nx, ny)) continue;
      // Distances are walked back toward the origin: from the neighbour into this tile.
      if (!canStep(level, nx, ny, x, y)) continue;
      const next = ny * width + nx;
      if (dist[next] !== -1) continue;
      dist[next] = dist[index] + 1;
      queue.push(next);
    }
  }
  return dist;
}

/** Tiles of a stairwell's 3 × 5 block, with what each is on the level above and below. */
function stairBlock(sw: Stairwell): Array<{ p: Point; upper: Tile; lower: Tile }> {
  const across = { x: -sw.dir.y, y: sw.dir.x };
  const at = (k: number, side: number) => ({ x: sw.top.x + sw.dir.x * k + across.x * side, y: sw.top.y + sw.dir.y * k + across.y * side });
  const out: Array<{ p: Point; upper: Tile; lower: Tile }> = [
    { p: at(0, 0), upper: Tile.Floor, lower: Tile.Wall },
    { p: at(4, 0), upper: Tile.Wall, lower: Tile.Floor },
  ];
  for (let k = 1; k <= 3; k++) {
    out.push({ p: at(k, 0), upper: Tile.Floor, lower: Tile.Floor });
    out.push({ p: at(k, -1), upper: Tile.Wall, lower: Tile.Wall });
    out.push({ p: at(k, 1), upper: Tile.Wall, lower: Tile.Wall });
  }
  return out;
}

function applyStairs(tiles: Uint8Array, width: number, sw: Stairwell, role: 'upper' | 'lower'): void {
  for (const b of stairBlock(sw)) tiles[b.p.y * width + b.p.x] = role === 'upper' ? b.upper : b.lower;
}

/** The room where a stairwell arrives on the level below: the bottom tile and the space beyond it. */
function arrivalRoom(sw: Stairwell): Room {
  const across = { x: -sw.dir.y, y: sw.dir.x };
  const pts: Point[] = [];
  for (let k = 1; k <= 7; k++) {
    for (let side = -2; side <= 2; side++) pts.push({ x: sw.top.x + sw.dir.x * k + across.x * side, y: sw.top.y + sw.dir.y * k + across.y * side });
  }
  return rectAround(pts, 'rect');
}

/** A small room around the spot where a rope from above comes down. */
function landingRoom(p: Point): Room {
  return { x: p.x - 2, y: p.y - 2, w: 5, h: 5, shape: 'rect' };
}

function rectAround(points: Point[], shape: RoomShape): Room {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1, shape };
}

const inBounds = (r: Room, width: number, height: number) => r.x >= 2 && r.y >= 2 && r.x + r.w <= width - 2 && r.y + r.h <= height - 2;
const DIRS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
const inside = (r: Room, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

/**
 * Chasms: a crack one or two tiles wide that cuts a plain room from wall to wall. If it
 * would split the level, a bridge spans it; otherwise there may be one, or the way is
 * around. No passage ever runs straight into the crack.
 */
function cutChasms(level: Level, rng: Rng, keepClear: Point[], forced: number): void {
  const { width, tiles } = level;
  level.rooms.forEach((room, index) => {
    if (index < forced || room.shape !== 'rect' || !rng.chance(CONFIG.level.chasmChance)) return;
    if (level.gallery && overlaps(room, level.gallery, 0)) return;
    if (keepClear.some((p) => p.x >= room.x - 2 && p.x <= room.x + room.w + 1 && p.y >= room.y - 2 && p.y <= room.y + room.h + 1)) return;
    // The crack runs across the room's long side, leaving at least two tiles on each bank.
    const acrossX = room.w >= room.h;
    const long = acrossX ? room.w : room.h;
    const wide = rng.int(1, 2);
    if (long < wide + 4) return;
    const at = rng.int(2, long - 2 - wide);
    const crack: Point[] = [];
    for (let k = 0; k < wide; k++) {
      for (let j = 0; j < (acrossX ? room.h : room.w); j++) {
        crack.push(acrossX ? { x: room.x + at + k, y: room.y + j } : { x: room.x + j, y: room.y + at + k });
      }
    }
    if (crack.some((p) => !isFloor(level, p.x, p.y))) return;
    // Both ends of the crack meet wall, not a passage.
    const ends = crack.flatMap((p) => NEIGHBOURS.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))).filter((q) => !inside(room, q));
    if (ends.some((q) => isFloor(level, q.x, q.y))) return;
    const before = floorDistances(level, level.start);
    for (const p of crack) tiles[p.y * width + p.x] = Tile.Chasm;
    const after = floorDistances(level, level.start);
    const split = before.some((d, i) => d !== -1 && after[i] === -1 && tiles[i] === Tile.Floor);
    if (!split && !rng.chance(CONFIG.level.bridgeChance)) return;
    // A bridge across, somewhere along the crack (not against a wall).
    const span = (acrossX ? room.h : room.w) - 2;
    if (span < 1) return;
    const j = rng.int(1, span);
    for (let k = 0; k < wide; k++) {
      const p = acrossX ? { x: room.x + at + k, y: room.y + j } : { x: room.x + j, y: room.y + at + k };
      tiles[p.y * width + p.x] = Tile.Floor;
      level.bridges.push(p.y * width + p.x);
    }
  });
}

/**
 * Terraces: in some plain rooms, a raised band along one wall. One ramp climbs to it
 * from the room's floor, and wherever a passage runs into the band there is a ramp too,
 * so no way in is lost.
 */
function raiseTerraces(level: Level, rng: Rng, keepClear: Point[], forced: number): void {
  const { width } = level;
  const ground = level.ground!;
  level.rooms.forEach((room, index) => {
    if (index < forced || room.shape !== 'rect' || room.w < 6 || room.h < 6 || !rng.chance(CONFIG.level.terraceChance)) return;
    if (level.gallery && overlaps(room, level.gallery, 0)) return;
    if (keepClear.some((p) => p.x >= room.x - 1 && p.x <= room.x + room.w && p.y >= room.y - 1 && p.y <= room.y + room.h)) return;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) if (isChasm(level, x, y) || isBridge(level, x, y) || isDeep(level, x, y) || waterAt(level, x, y) !== Water.None) return;
    }
    const depth = rng.int(2, 3);
    const inside = (p: Point) => p.x >= room.x && p.x < room.x + room.w && p.y >= room.y && p.y < room.y + room.h;
    const bandFor = (side: number) => {
      const out: Point[] = [];
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          const inBand =
            side === 0 ? x < room.x + depth : side === 1 ? x >= room.x + room.w - depth : side === 2 ? y < room.y + depth : y >= room.y + room.h - depth;
          if (inBand && isFloor(level, x, y)) out.push({ x, y });
        }
      }
      return out;
    };
    // A side where at most a couple of passages come in (not one running along the wall).
    const openings = (band: Point[]) =>
      band.filter((p) => NEIGHBOURS.some(([dx, dy]) => !inside({ x: p.x + dx, y: p.y + dy }) && isFloor(level, p.x + dx, p.y + dy))).length;
    const first = rng.int(0, 3);
    let band: Point[] = [];
    for (let k = 0; k < 4 && band.length === 0; k++) {
      const candidate = bandFor((first + k) % 4);
      if (openings(candidate) <= 2) band = candidate;
    }
    if (band.length === 0) return;
    for (const p of band) ground[p.y * width + p.x] = Ground.High;
    // The main ramp: a band tile facing the room's floor.
    const edge = band.filter((p) => NEIGHBOURS.some(([dx, dy]) => isFloor(level, p.x + dx, p.y + dy) && ground[(p.y + dy) * width + p.x + dx] === Ground.Low));
    const facingRoom = edge.filter((p) => NEIGHBOURS.some(([dx, dy]) => inside({ x: p.x + dx, y: p.y + dy }) && isFloor(level, p.x + dx, p.y + dy) && ground[(p.y + dy) * width + p.x + dx] === Ground.Low));
    if (facingRoom.length > 0) {
      const ramp = rng.pick(facingRoom);
      ground[ramp.y * width + ramp.x] = Ground.Ramp;
    }
    // Passages that run into the band arrive by a ramp.
    for (const p of edge) {
      if (NEIGHBOURS.some(([dx, dy]) => !inside({ x: p.x + dx, y: p.y + dy }) && isFloor(level, p.x + dx, p.y + dy))) ground[p.y * width + p.x] = Ground.Ramp;
    }
  });
}

/**
 * An underground river: a deep channel that crosses the level from side to side, cutting
 * through rock and rooms alike, with low banks you wade along. Fords (shallow stretches)
 * cross it wherever it would cut anything off.
 */
function runRiver(level: Level, rng: Rng, keepClear: Point[], next: { down: Stairwell; nextArrival: Room }): void {
  if (!rng.chance(CONFIG.level.riverChance)) return;
  // Some rivers do not reach the far side: they drain down a sinkhole to the level below.
  const drains = rng.chance(CONFIG.level.waterfallChance);
  const { width, height, tiles } = level;
  const water = level.water!;
  const across = rng.chance(0.5);
  const long = across ? width : height;
  const short = across ? height : width;
  const at = (u: number, v: number) => (across ? { x: u, y: v } : { x: v, y: u });
  const forbidden = (p: Point) =>
    p.x < 1 || p.y < 1 || p.x >= width - 1 || p.y >= height - 1 ||
    keepClear.some((q) => Math.abs(q.x - p.x) <= 3 && Math.abs(q.y - p.y) <= 3) ||
    (level.gallery !== null && p.x >= level.gallery.x - 1 && p.x <= level.gallery.x + level.gallery.w && p.y >= level.gallery.y - 1 && p.y <= level.gallery.y + level.gallery.h);
  for (let attempt = 0; attempt < 12; attempt++) {
    // The course: across the map, wandering a little from side to side.
    const course: Point[] = [];
    let v = rng.int(6, short - 7);
    const end = drains ? rng.int(Math.floor(long * 0.35), Math.floor(long * 0.7)) : long - 1;
    for (let u = 1; u < end; u++) {
      course.push(at(u, v));
      if (rng.chance(0.3)) {
        const nv = Math.max(4, Math.min(short - 5, v + (rng.chance(0.5) ? 1 : -1)));
        if (nv !== v) {
          v = nv;
          course.push(at(u, v));
        }
      }
    }
    const wide = rng.chance(0.4);
    // Deep in the middle (one or two tiles), a bank of shallow water on each side.
    const deep = new Set<number>();
    const banks = new Set<number>();
    for (const p of course) {
      for (let k = -2; k <= 2 + (wide ? 1 : 0); k++) {
        const q = across ? { x: p.x, y: p.y + k } : { x: p.x + k, y: p.y };
        if (q.x < 1 || q.y < 1 || q.x >= width - 1 || q.y >= height - 1) continue;
        const i = q.y * width + q.x;
        if (k >= 0 && k <= (wide ? 1 : 0)) deep.add(i);
        else banks.add(i);
      }
    }
    for (const i of deep) banks.delete(i);
    if ([...deep, ...banks].some((i) => forbidden({ x: i % width, y: Math.floor(i / width) }))) continue;
    // The sinkhole, at the end of the course: its pool below needs a room of its own there.
    const sink = drains ? course[course.length - 1] : null;
    if (sink) {
      const below = landingRoom(sink);
      const far = (p: Point, d: number) => Math.abs(p.x - sink.x) > d || Math.abs(p.y - sink.y) > d;
      if (!inBounds(below, width, height) || overlaps(below, next.nextArrival, 1) || !far(level.pit, 6) || !far(level.landing, 3)) continue;
      if (stairBlock(next.down).some((b) => !far(b.p, 6))) continue;
      if (level.gallery && overlaps(below, level.gallery, 1)) continue;
    }
    const savedTiles = tiles.slice();
    const savedWater = water.slice();
    for (const i of banks) {
      tiles[i] = Tile.Floor;
      water[i] = Water.Shallow;
    }
    for (const i of deep) {
      tiles[i] = Tile.Deep;
      water[i] = Water.Deep;
    }
    // Fords until nothing is cut off: each one a shallow stretch straight across.
    const fordAt = (p: Point) => {
      for (let k = 0; k <= (wide ? 1 : 0); k++) {
        const q = across ? { x: p.x, y: p.y + k } : { x: p.x + k, y: p.y };
        const i = q.y * width + q.x;
        if (!deep.has(i)) continue;
        tiles[i] = Tile.Floor;
        water[i] = Water.Shallow;
        deep.delete(i);
      }
    };
    let ok = false;
    for (let fords = 0; fords < 12; fords++) {
      const dist = floorDistances(level, level.start);
      const cut = dist.some((d, i) => d === -1 && tiles[i] === Tile.Floor);
      if (!cut) {
        ok = true;
        break;
      }
      // A ford where one bank is reached and the other is not.
      const candidates = course.filter((p) => {
        const a = across ? { x: p.x, y: p.y - 1 } : { x: p.x - 1, y: p.y };
        const b = across ? { x: p.x, y: p.y + (wide ? 2 : 1) } : { x: p.x + (wide ? 2 : 1), y: p.y };
        return deep.has(p.y * width + p.x) && (dist[a.y * width + a.x] === -1) !== (dist[b.y * width + b.x] === -1);
      });
      if (candidates.length === 0) break;
      fordAt(rng.pick(candidates.slice(Math.floor(candidates.length * 0.2), Math.ceil(candidates.length * 0.8)).concat(candidates.length < 5 ? candidates : [])));
    }
    if (!ok) {
      tiles.set(savedTiles);
      water.set(savedWater);
      continue;
    }
    // Now and then one ford more, for convenience.
    if (rng.chance(0.5)) fordAt(rng.pick(course.slice(Math.floor(course.length * 0.3), Math.floor(course.length * 0.7))));
    level.river = course;
    if (sink) level.sink = { ...sink };
    return;
  }
}

/**
 * A flood spreading from where a waterfall lands, `amount` tiles out: shallow water over the
 * low floor nearest the pool first (never on stairs or bridges), and once it has risen far
 * enough, the room of the pool itself goes deep, as long as that cuts no way off. Changes
 * the level in place.
 */
export function flood(level: Level, amount: number): void {
  const { fall } = level;
  if (!fall || amount <= 0) return;
  const { width, tiles } = level;
  const water = level.water!;
  const steps = new Set([...level.up.steps, ...level.down.steps].map((p) => p.y * width + p.x));
  const dist = new Int32Array(tiles.length).fill(-1);
  const start = fall.y * width + fall.x;
  dist[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    if (dist[i] >= amount) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    for (const d of DIRS) {
      const j = (y + d.y) * width + x + d.x;
      if (dist[j] !== -1 || steps.has(j) || level.bridges.includes(j)) continue;
      if (tiles[j] !== Tile.Floor && tiles[j] !== Tile.Deep) continue;
      if (tiles[j] === Tile.Floor && groundAt(level, x + d.x, y + d.y) !== Ground.Low) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  for (const i of queue) if (tiles[i] === Tile.Floor && water[i] === Water.None) water[i] = Water.Shallow;
  // Deep in the pool's room once the water has risen high.
  const rise = amount - CONFIG.water.floodDeepLag;
  if (rise <= 0) return;
  for (const i of queue) {
    const x = i % width;
    const y = Math.floor(i / width);
    if (tiles[i] !== Tile.Floor || dist[i] > rise || Math.abs(x - fall.x) > 2 || Math.abs(y - fall.y) > 2) continue;
    tiles[i] = Tile.Deep;
    const reached = floorDistances(level, level.start);
    if (reached.some((d, k) => d === -1 && tiles[k] === Tile.Floor)) tiles[i] = Tile.Floor;
    else water[i] = Water.Deep;
  }
}

/** Under a waterfall from above: a deep plunge pool where it lands, shallow around it. */
function plungePool(level: Level, fall: Point): void {
  const { width, tiles } = level;
  const water = level.water!;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = fall.x + dx;
      const y = fall.y + dy;
      if (!isFloor(level, x, y) || Math.hypot(dx, dy) > 2.3) continue;
      water[y * width + x] = Water.Shallow;
    }
  }
  tiles[fall.y * width + fall.x] = Tile.Deep;
  water[fall.y * width + fall.x] = Water.Deep;
  level.fall = { ...fall };
}

/**
 * Pools: in some plain rooms, standing water: a shallow rim you wade through around a deep
 * middle you walk around. If the deep part would cut the way, it stays shallow.
 */
function fillPools(level: Level, rng: Rng, keepClear: Point[], forced: number): void {
  const { width, tiles } = level;
  const water = level.water!;
  level.rooms.forEach((room, index) => {
    if (index < forced || room.w < 5 || room.h < 5 || !rng.chance(CONFIG.level.poolChance)) return;
    if (level.gallery && overlaps(room, level.gallery, 0)) return;
    if (keepClear.some((p) => p.x >= room.x - 1 && p.x <= room.x + room.w && p.y >= room.y - 1 && p.y <= room.y + room.h)) return;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (isChasm(level, x, y) || isBridge(level, x, y) || (groundAt(level, x, y) !== Ground.Low && isFloor(level, x, y))) return;
        if (water[y * width + x] !== Water.None || isDeep(level, x, y)) return;
      }
    }
    // An oval somewhere in the room, rippled at the edge.
    const rx = rng.range(1.6, Math.max(1.8, room.w / 2 - 0.6));
    const ry = rng.range(1.6, Math.max(1.8, room.h / 2 - 0.6));
    const cx = rng.range(room.x + rx * 0.7, room.x + room.w - rx * 0.7);
    const cy = rng.range(room.y + ry * 0.7, room.y + room.h - ry * 0.7);
    const deep: number[] = [];
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (!isFloor(level, x, y)) continue;
        const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + (rng.next() - 0.5) * 0.25;
        if (d > 1.05) continue;
        water[y * width + x] = Water.Shallow;
        if (d < 0.6) deep.push(y * width + x);
      }
    }
    if (deep.length === 0) return;
    const before = floorDistances(level, level.start);
    for (const i of deep) tiles[i] = Tile.Deep;
    const after = floorDistances(level, level.start);
    const cut = before.some((d, i) => d !== -1 && after[i] === -1 && tiles[i] === Tile.Floor);
    if (cut) for (const i of deep) tiles[i] = Tile.Floor;
    else for (const i of deep) water[i] = Water.Deep;
  });
}

/** Where the stairs down from the mansion reach depth 1. */
function mansionStairs(seed: string, width: number, height: number): Stairwell {
  const rng = Rng.derive(seed, 'mansion-stairs');
  for (let i = 0; i < 50; i++) {
    const sw = makeStairwell({ x: rng.int(10, width - 11), y: rng.int(10, height - 11) }, rng.pick(DIRS));
    if (inBounds(arrivalRoom(sw), width, height)) return sw;
  }
  return makeStairwell({ x: Math.floor(width / 2), y: Math.floor(height / 2) - 4 }, { x: 0, y: 1 });
}

const layouts = new Map<string, Level>();

/**
 * The shape of the level at `depth`: rooms, corridors, stairs, pit, fountains and drips.
 * Levels are stacked in one space: each is laid out under the one above, so the stairs
 * from above arrive into a room here, and the pit above falls onto a room here. The same
 * seed and depth always give the same layout. Cached: callers must not change it.
 */
function generateLayout(seed: string, depth: number): Level {
  const key = `${seed}|${depth}`;
  const cached = layouts.get(key);
  if (cached) return cached;
  const cfg = CONFIG.level;
  const { width, height } = cfg;
  const above = depth > 1 ? generateLayout(seed, depth - 1) : null;
  const up = above ? above.down : mansionStairs(seed, width, height);
  const landing = above ? above.pit : null;
  const rng = Rng.derive(seed, 'level', depth);
  const tiles = new Uint8Array(width * height).fill(Tile.Wall);

  // The rooms that must be there: where the stairs from above arrive, and (if any) where the
  // rope from the pit above comes down.
  const arrival = arrivalRoom(up);
  const rooms: Room[] = [arrival];
  if (landing) rooms.push(landingRoom(landing));
  // Under a gallery above, a hall as big as it.
  if (above?.gallery) rooms.push({ ...above.gallery, shape: 'rect' });
  // Under a waterfall from above, a room for its pool.
  const fall = above?.sink ?? null;
  if (fall) rooms.push(landingRoom(fall));
  const forced = rooms.length;
  const upBlock = stairBlock(up).map((b) => b.p);
  const touchesStairs = (r: Room) => upBlock.some((p) => p.x >= r.x - 2 && p.x < r.x + r.w + 2 && p.y >= r.y - 2 && p.y < r.y + r.h + 2);

  // Other rooms: random placement without overlap, keeping a border of rock.
  const targetRooms = rng.int(cfg.minRooms, cfg.maxRooms);
  for (let attempt = 0; attempt < cfg.roomAttempts && rooms.length < targetRooms; attempt++) {
    const w = rng.int(cfg.roomMinSize, cfg.roomMaxSize);
    const h = rng.int(cfg.roomMinSize, Math.min(cfg.roomMaxSize, 8));
    const shapeRoll = rng.next();
    const shape: RoomShape = w >= 7 && h >= 6 && shapeRoll < 0.3 ? 'hall' : shapeRoll > 0.62 ? 'cave' : 'rect';
    const room: Room = { x: rng.int(2, width - w - 2), y: rng.int(2, height - h - 2), w, h, shape };
    if (rooms.some((other) => overlaps(room, other, 2)) || touchesStairs(room)) continue;
    rooms.push(room);
  }

  // The stairs down: in a plain room far from the arrival, with room for the next level's
  // arrival below them. If no room fits, one is made for them.
  const fits = (sw: Stairwell, room: Room) => {
    const before = { x: sw.top.x - sw.dir.x, y: sw.top.y - sw.dir.y };
    const block = stairBlock(sw).map((b) => b.p);
    return (
      inside(room, before) &&
      block.every((p) => inside(room, p) || (p.x === sw.bottom.x && p.y === sw.bottom.y)) &&
      inBounds(arrivalRoom(sw), width, height) &&
      !block.some((p) => upBlock.some((q) => Math.abs(p.x - q.x) <= 2 && Math.abs(p.y - q.y) <= 2))
    );
  };
  const order = rooms
    .map((room, index) => ({ room, index }))
    .filter(({ room, index }) => index >= forced && room.shape === 'rect')
    .sort((a, b) => Math.hypot(center(b.room).x - up.bottom.x, center(b.room).y - up.bottom.y) - Math.hypot(center(a.room).x - up.bottom.x, center(a.room).y - up.bottom.y));
  let down: Stairwell | null = null;
  for (const { room } of order) {
    for (const dir of DIRS) {
      for (let y = room.y; y < room.y + room.h && !down; y++) {
        for (let x = room.x; x < room.x + room.w && !down; x++) {
          const sw = makeStairwell({ x, y }, dir);
          if (fits(sw, room)) down = sw;
        }
      }
      if (down) break;
    }
    if (down) break;
  }
  for (let attempt = 0; !down && attempt < 200; attempt++) {
    const dir = rng.pick(DIRS);
    const room: Room = dir.x !== 0 ? { x: rng.int(2, width - 11), y: rng.int(2, height - 7), w: 9, h: 5, shape: 'rect' } : { x: rng.int(2, width - 7), y: rng.int(2, height - 11), w: 5, h: 9, shape: 'rect' };
    if (rooms.some((other) => overlaps(room, other, 1)) || touchesStairs(room)) continue;
    const top = dir.x !== 0 ? { x: dir.x > 0 ? room.x + 1 : room.x + room.w - 2, y: room.y + 2 } : { x: room.x + 2, y: dir.y > 0 ? room.y + 1 : room.y + room.h - 2 };
    const sw = makeStairwell(top, dir);
    if (!fits(sw, room)) continue;
    rooms.push(room);
    down = sw;
  }
  if (!down) down = makeStairwell({ x: up.bottom.x + up.dir.x * 2, y: up.bottom.y + up.dir.y * 2 }, up.dir);

  for (const room of rooms) carveRoom(tiles, width, room, rng);

  // Connections: minimum spanning tree over room centers, plus a few loops. The arrival
  // room connects from beyond the stairs, so corridors leave the stairwell alone.
  const centers = rooms.map(center);
  centers[0] = { x: up.top.x + up.dir.x * 6, y: up.top.y + up.dir.y * 6 };
  const connected = new Set<number>([0]);
  const edges: Array<[number, number]> = [];
  while (connected.size < rooms.length) {
    let best: [number, number] | null = null;
    let bestDistance = Infinity;
    for (const a of connected) {
      for (let b = 0; b < rooms.length; b++) {
        if (connected.has(b)) continue;
        const d = Math.abs(centers[a].x - centers[b].x) + Math.abs(centers[a].y - centers[b].y);
        if (d < bestDistance) {
          bestDistance = d;
          best = [a, b];
        }
      }
    }
    if (!best) break;
    connected.add(best[1]);
    edges.push(best);
  }
  for (let i = 0; i < cfg.extraConnections && rooms.length > 2; i++) {
    const a = rng.int(0, rooms.length - 1);
    const b = rng.int(0, rooms.length - 1);
    if (a !== b) edges.push([a, b]);
  }
  // Some passages are natural tunnels that wander and widen; the rest are cut straight.
  for (const [a, b] of edges) {
    if (rng.chance(CONFIG.level.tunnelChance)) carveTunnel(tiles, width, height, centers[a], centers[b], rng);
    else carveCorridor(tiles, width, centers[a], centers[b], rng.chance(0.5));
  }

  const level: Level = {
    seed,
    depth,
    width,
    height,
    tiles,
    rooms,
    start: up.bottom,
    stairs: down.top,
    down,
    up,
    items: [],
    features: [],
    doorways: [],
    doors: [],
    pit: { x: 0, y: 0 },
    landing: landing ?? { ...up.bottom },
    gallery: null,
    bridges: [],
    rubble: [],
  };

  // Stairwells are cut last, so no corridor breaks them; any room a stairwell cut off is
  // joined again the other way round.
  for (let pass = 0; pass < 4; pass++) {
    applyStairs(tiles, width, up, 'lower');
    applyStairs(tiles, width, down, 'upper');
    const dist = floorDistances(level, up.bottom);
    const lost = rooms.map((_, i) => i).filter((i) => i > 0 && dist[centers[i].y * width + centers[i].x] < 0 && tiles[centers[i].y * width + centers[i].x] === Tile.Floor);
    const downLost = dist[down.top.y * width + down.top.x] < 0;
    if (lost.length === 0 && !downLost) break;
    for (const i of lost) carveCorridor(tiles, width, centers[i], centers[0], pass % 2 === 0);
    if (downLost) carveCorridor(tiles, width, { x: down.top.x - down.dir.x, y: down.top.y - down.dir.y }, centers[0], pass % 2 === 1);
  }
  applyStairs(tiles, width, up, 'lower');
  applyStairs(tiles, width, down, 'upper');
  // The stairwell walls can seal a small stairs room off; then a passage is cut to it, so
  // the way down is never lost.
  const entrance = { x: down.top.x - down.dir.x, y: down.top.y - down.dir.y };
  const reached = floorDistances(level, level.start);
  if (reached[entrance.y * width + entrance.x] === -1) {
    // The shortest way through the rock to anything reached, around both stairwells.
    const sealed = new Set([...stairBlock(up), ...stairBlock(down)].map((b) => b.p.y * width + b.p.x));
    const from = new Int32Array(width * height).fill(-2);
    const queue = [entrance.y * width + entrance.x];
    from[queue[0]] = -1;
    let goal = -1;
    for (let head = 0; head < queue.length && goal < 0; head++) {
      const i = queue[head];
      const x = i % width;
      const y = Math.floor(i / width);
      for (const d of DIRS) {
        const nx = x + d.x;
        const ny = y + d.y;
        const j = ny * width + nx;
        if (nx < 1 || ny < 1 || nx >= width - 1 || ny >= height - 1 || from[j] !== -2 || sealed.has(j)) continue;
        from[j] = i;
        if (reached[j] !== -1) {
          goal = j;
          break;
        }
        queue.push(j);
      }
    }
    for (let i = goal; i >= 0; i = from[i]) tiles[i] = Tile.Floor;
  }
  removeUnreachable(level, level.start);

  // The pit: in a room, away from both stairwells, with room below for its landing.
  const shaftRng = Rng.derive(seed, 'shafts', depth);
  const downBlock = stairBlock(down).map((b) => b.p);
  const nextArrival = arrivalRoom(down);
  for (let attempt = 0; attempt < 200; attempt++) {
    const room = shaftRng.pick(rooms);
    const p = { x: shaftRng.int(room.x, room.x + room.w - 1), y: shaftRng.int(room.y, room.y + room.h - 1) };
    if (!isFloor(level, p.x, p.y)) continue;
    const near = (blocks: Point[], d: number) => blocks.some((q) => Math.abs(q.x - p.x) <= d && Math.abs(q.y - p.y) <= d);
    if (near(downBlock, 5) || near(upBlock, 3) || (landing && Math.abs(landing.x - p.x) <= 2 && Math.abs(landing.y - p.y) <= 2)) continue;
    if (fall && Math.abs(fall.x - p.x) <= 3 && Math.abs(fall.y - p.y) <= 3) continue;
    const below = landingRoom(p);
    if (!inBounds(below, width, height) || overlaps(below, nextArrival, 1)) continue;
    // Every neighbour floor, so the pit does not cut a passage.
    if (!DIRS.every((d) => isFloor(level, p.x + d.x, p.y + d.y))) continue;
    level.pit = p;
    break;
  }
  if (level.pit.x === 0 && level.pit.y === 0) level.pit = { ...centers[rooms.length - 1] };

  // Now and then a big plain room becomes a gallery over a hall below.
  const galleryRng = Rng.derive(seed, 'gallery', depth);
  if (galleryRng.chance(CONFIG.level.galleryChance)) {
    const blocked = [...upBlock, ...downBlock, level.pit, level.landing, ...(fall ? [fall] : [])];
    // Never one of the rooms this level owes to the one above.
    const candidates = rooms.filter(
      (r, i) =>
        i >= forced &&
        r.shape === 'rect' &&
        r.w >= 7 &&
        r.h >= 6 &&
        !blocked.some((p) => p.x >= r.x - 1 && p.x <= r.x + r.w && p.y >= r.y - 1 && p.y <= r.y + r.h) &&
        !overlaps(r, nextArrival, 1) &&
        !overlaps(r, landingRoom(level.pit), 1),
    );
    if (candidates.length > 0) {
      const room = galleryRng.pick(candidates);
      level.gallery = { ...room };
      for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) tiles[y * width + x] = Tile.Void;
      }
    }
  }

  level.ground = new Uint8Array(width * height);
  level.water = new Uint8Array(width * height);
  const clear = [...upBlock, ...downBlock, level.pit, level.landing, ...(fall ? [fall] : [])];
  if (fall) plungePool(level, fall);
  runRiver(level, Rng.derive(seed, 'river', depth), clear, { down, nextArrival });
  cutChasms(level, Rng.derive(seed, 'chasms', depth), clear, forced);
  raiseTerraces(level, Rng.derive(seed, 'terraces', depth), clear, forced);
  fillPools(level, Rng.derive(seed, 'pools', depth), clear, forced);

  // Fountains and drips are geography: the same in every life.
  const taken = new Set<string>();
  for (const p of clear) {
    for (const d of [{ x: 0, y: 0 }, ...DIRS]) taken.add(`${p.x + d.x},${p.y + d.y}`);
  }
  const fountains = placeSpots(level, Rng.derive(seed, 'fountains', depth), taken, rngCount(Rng.derive(seed, 'fountains-n', depth), CONFIG.features.fountain));
  const features: Feature[] = fountains.map(([x, y]) => ({ id: 0, kind: 'fountain' as const, x, y }));
  const dripRng = Rng.derive(seed, 'drips', depth);
  for (const [x, y] of placeSpots(level, dripRng, taken, rngCount(dripRng, CONFIG.features.drip))) {
    features.push({ id: 0, kind: 'drip', x, y });
    // Where it drips, a puddle gathers.
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (isFloor(level, x + dx, y + dy) && groundAt(level, x + dx, y + dy) === Ground.Low && (dx === 0 || dripRng.chance(0.6))) {
        level.water[(y + dy) * width + x + dx] = Water.Shallow;
      }
    }
  }
  level.features = features;
  level.doorways = findDoorways(level);
  const doorRng = Rng.derive(seed, 'doors', depth);
  level.doors = level.doorways.filter(() => doorRng.chance(CONFIG.features.doorChance));
  level.rubble = collapse(level, Rng.derive(seed, 'rubble', depth), [...upBlock, ...downBlock, level.pit, level.landing]);
  layouts.set(key, level);
  return level;
}

/**
 * The level at `depth` for `seed`: its fixed layout (see `generateLayout`) with the loot,
 * remains and crates of one life (`itemsRoll`), which re-roll from life to life.
 */
export function generateLevel(seed: string, depth: number, itemsRoll = 0): Level {
  const layout = generateLayout(seed, depth);
  const level: Level = {
    ...layout,
    tiles: layout.tiles.slice(),
    ground: layout.ground?.slice(),
    water: layout.water?.slice(),
    river: layout.river?.map((p) => ({ ...p })),
    bridges: layout.bridges.slice(),
    rubble: layout.rubble.map((p) => ({ ...p })),
    rooms: layout.rooms.map((r) => ({ ...r })),
    features: layout.features.map((f) => ({ ...f })),
    doorways: layout.doorways.map((d) => ({ ...d })),
    doors: layout.doors.map((d) => ({ ...d })),
    items: [],
    closed: undefined,
  };
  const taken = new Set<string>();
  for (const p of [...stairBlock(level.up).map((b) => b.p), ...stairBlock(level.down).map((b) => b.p), level.pit, level.landing]) {
    for (const d of [{ x: 0, y: 0 }, ...DIRS]) taken.add(`${p.x + d.x},${p.y + d.y}`);
  }
  for (const f of level.features) taken.add(`${f.x},${f.y}`);
  const lootRng = Rng.derive(seed, 'items', depth, itemsRoll);
  for (const kind of ['remains', 'crate'] as const) {
    for (const [x, y] of placeSpots(level, lootRng, taken, rngCount(lootRng, CONFIG.features[kind]))) level.features.push({ id: 0, kind, x, y });
  }
  level.features.forEach((f, i) => (f.id = i));
  level.items = placeItems(level, lootRng, taken);
  return level;
}

/**
 * Collapses: stones fallen into a straight stretch of corridor. Only where there is
 * another way round, so a collapse is a detour to walk or a shortcut to dig out.
 */
function collapse(level: Level, rng: Rng, keepClear: Point[]): Point[] {
  const { width, height } = level;
  const inRoom = (x: number, y: number) => level.rooms.some((r) => inside(r, { x, y }));
  const near = (p: Point, list: Point[], d: number) => list.some((q) => Math.abs(q.x - p.x) <= d && Math.abs(q.y - p.y) <= d);
  const candidates: Point[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (!isFloor(level, x, y) || inRoom(x, y)) continue;
      const p = { x, y };
      if (near(p, keepClear, 4) || near(p, level.doorways, 1)) continue;
      // A straight stretch: floor on two opposite sides, rock on the other two.
      const straightX = isFloor(level, x - 1, y) && isFloor(level, x + 1, y) && !isFloor(level, x, y - 1) && !isFloor(level, x, y + 1);
      const straightY = isFloor(level, x, y - 1) && isFloor(level, x, y + 1) && !isFloor(level, x - 1, y) && !isFloor(level, x + 1, y);
      if (straightX || straightY) candidates.push(p);
    }
  }
  const chosen: Point[] = [];
  const count = rng.chance(CONFIG.level.rubbleChance) ? rng.int(1, 2) : 0;
  for (let attempt = 0; attempt < 30 && chosen.length < count && candidates.length > 0; attempt++) {
    const p = candidates.splice(rng.int(0, candidates.length - 1), 1)[0];
    if (near(p, chosen, 6)) continue;
    // Everything must still be reachable with the stones in place.
    const closed = new Set([...chosen, p].map((q) => q.y * width + q.x));
    const dist = floorDistances({ ...level, closed }, level.start);
    let cut = false;
    for (let i = 0; i < dist.length && !cut; i++) if (level.tiles[i] === Tile.Floor && !closed.has(i) && dist[i] === -1) cut = true;
    if (!cut) chosen.push(p);
  }
  return chosen;
}

/**
 * Room entrances one tile wide: corridor tiles (outside every room) next to a room tile,
 * with wall on both sides across the passage.
 */
function findDoorways(level: Level): Point[] {
  const inRoom = (x: number, y: number) => level.rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const result: Point[] = [];
  for (let y = 1; y < level.height - 1; y++) {
    for (let x = 1; x < level.width - 1; x++) {
      if (!isFloor(level, x, y) || inRoom(x, y)) continue;
      const nextToRoom = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isFloor(level, x + dx, y + dy) && inRoom(x + dx, y + dy));
      if (!nextToRoom) continue;
      const walledX = !isFloor(level, x - 1, y) && !isFloor(level, x + 1, y);
      const walledY = !isFloor(level, x, y - 1) && !isFloor(level, x, y + 1);
      if (walledX || walledY) result.push({ x, y });
    }
  }
  return result;
}

function rngCount(rng: Rng, range: { min: number; max: number }): number {
  return rng.int(range.min, range.max);
}

/** Free floor tiles inside rooms, never on the start, the stairs or each other. */
function placeSpots(level: Level, rng: Rng, taken: Set<string>, count: number): Array<[number, number]> {
  const spots: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const room = rng.pick(level.rooms);
      const x = rng.int(room.x, room.x + room.w - 1);
      const y = rng.int(room.y, room.y + room.h - 1);
      const key = `${x},${y}`;
      if (taken.has(key) || !isFloor(level, x, y) || waterAt(level, x, y) !== Water.None) continue;
      taken.add(key);
      spots.push([x, y]);
      break;
    }
  }
  return spots;
}

/** Gold in a pile: more the deeper you go. */
export function goldPile(rng: Rng, depth: number): number {
  return rng.int(3, 8) + depth * 2;
}

function placeItems(level: Level, rng: Rng, taken: Set<string>): LevelItem[] {
  const items: LevelItem[] = [];
  for (const kind of ['ration', 'oil', 'gold'] as const) {
    for (const [x, y] of placeSpots(level, rng, taken, rngCount(rng, CONFIG.items[kind]))) {
      const item: LevelItem = { id: items.length, kind, x, y };
      if (kind === 'gold') item.amount = goldPile(rng, level.depth);
      items.push(item);
    }
  }
  if (rng.chance(CONFIG.items.marchRationChance)) {
    for (const [x, y] of placeSpots(level, rng, taken, 1)) items.push({ id: items.length, kind: 'marchRation', x, y });
  }
  // Mushrooms grow in caves; some are poisonous.
  const caves = level.rooms.filter((r) => r.shape === 'cave');
  if (caves.length > 0) {
    const caveLevel = { ...level, rooms: caves };
    for (const [x, y] of placeSpots(caveLevel, rng, taken, rngCount(rng, CONFIG.items.mushroom))) {
      items.push({ id: items.length, kind: 'mushroom', x, y, poison: rng.chance(CONFIG.items.mushroomPoison) });
    }
  }
  return items;
}
