import { CONFIG } from './config';
import type { ItemKind } from './inventory';
import { Rng } from './rng';

export const Tile = {
  Wall: 0,
  Floor: 1,
  /** Open air over the level below: you see and light across it, but nobody walks on it. */
  Void: 2,
} as const;
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
  return (t === Tile.Floor || t === Tile.Void) && !level.closed?.has(y * level.width + x);
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
  const upBlock = stairBlock(up).map((b) => b.p);
  const touchesStairs = (r: Room) => upBlock.some((p) => p.x >= r.x - 2 && p.x < r.x + r.w + 2 && p.y >= r.y - 2 && p.y < r.y + r.h + 2);

  // Other rooms: random placement without overlap, keeping a border of rock.
  const targetRooms = rng.int(cfg.minRooms, cfg.maxRooms);
  for (let attempt = 0; attempt < cfg.roomAttempts && rooms.length < targetRooms; attempt++) {
    const w = rng.int(cfg.roomMinSize, cfg.roomMaxSize);
    const h = rng.int(cfg.roomMinSize, Math.min(cfg.roomMaxSize, 8));
    const shapeRoll = rng.next();
    const shape: RoomShape = w >= 7 && h >= 6 && shapeRoll < 0.35 ? 'hall' : shapeRoll > 0.72 ? 'cave' : 'rect';
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
    .filter(({ room, index }) => index > (landing ? 1 : 0) + (above?.gallery ? 1 : 0) && room.shape === 'rect')
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
  for (const [a, b] of edges) carveCorridor(tiles, width, centers[a], centers[b], rng.chance(0.5));

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
    const blocked = [...upBlock, ...downBlock, level.pit, level.landing];
    // Never one of the rooms this level owes to the one above.
    const forced = 1 + (landing ? 1 : 0) + (above?.gallery ? 1 : 0);
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

  // Fountains and drips are geography: the same in every life.
  const taken = new Set<string>();
  for (const p of [...upBlock, ...downBlock, level.pit, level.landing]) {
    for (const d of [{ x: 0, y: 0 }, ...DIRS]) taken.add(`${p.x + d.x},${p.y + d.y}`);
  }
  const fountains = placeSpots(level, Rng.derive(seed, 'fountains', depth), taken, rngCount(Rng.derive(seed, 'fountains-n', depth), CONFIG.features.fountain));
  const features: Feature[] = fountains.map(([x, y]) => ({ id: 0, kind: 'fountain' as const, x, y }));
  const dripRng = Rng.derive(seed, 'drips', depth);
  for (const [x, y] of placeSpots(level, dripRng, taken, rngCount(dripRng, CONFIG.features.drip))) features.push({ id: 0, kind: 'drip', x, y });
  level.features = features;
  level.doorways = findDoorways(level);
  const doorRng = Rng.derive(seed, 'doors', depth);
  level.doors = level.doorways.filter(() => doorRng.chance(CONFIG.features.doorChance));
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
      if (taken.has(key) || !isFloor(level, x, y)) continue;
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
