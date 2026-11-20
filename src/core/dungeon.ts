import { CONFIG } from './config';
import type { ItemKind } from './inventory';
import { Rng } from './rng';

export const Tile = {
  Wall: 0,
  Floor: 1,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** What can lie on the floor: anything that goes in the backpack, or a pile of gold. */
export type LootKind = ItemKind | 'gold';

/** Fixed things in a level: fountains are part of its geography; remains and crates can be searched. */
export type FeatureKind = 'fountain' | 'remains' | 'crate';

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
  /** Tile coordinates. */
  x: number;
  y: number;
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
}

export function tileAt(level: Level, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return Tile.Wall;
  return level.tiles[y * level.width + x] as Tile;
}

export function isFloor(level: Level, x: number, y: number): boolean {
  return tileAt(level, x, y) === Tile.Floor;
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
      if (!isFloor(level, nx, ny)) continue;
      const next = ny * width + nx;
      if (dist[next] !== -1) continue;
      dist[next] = dist[index] + 1;
      queue.push(next);
    }
  }
  return dist;
}

/**
 * Generates the level at `depth` for `seed`. The same seed and depth always give
 * the same layout; item placement uses its own stream so it can be re-rolled per life.
 */
export function generateLevel(seed: string, depth: number, itemsRoll = 0): Level {
  const cfg = CONFIG.level;
  const rng = Rng.derive(seed, 'level', depth);
  const { width, height } = cfg;
  const tiles = new Uint8Array(width * height).fill(Tile.Wall);

  // Rooms: random placement without overlap, keeping a one-tile border of rock.
  const targetRooms = rng.int(cfg.minRooms, cfg.maxRooms);
  const rooms: Room[] = [];
  for (let attempt = 0; attempt < cfg.roomAttempts && rooms.length < targetRooms; attempt++) {
    const w = rng.int(cfg.roomMinSize, cfg.roomMaxSize);
    const h = rng.int(cfg.roomMinSize, Math.min(cfg.roomMaxSize, 8));
    const shapeRoll = rng.next();
    const shape: RoomShape = w >= 7 && h >= 6 && shapeRoll < 0.35 ? 'hall' : shapeRoll > 0.72 ? 'cave' : 'rect';
    const room: Room = { x: rng.int(2, width - w - 2), y: rng.int(2, height - h - 2), w, h, shape };
    if (rooms.some((other) => overlaps(room, other, 2))) continue;
    rooms.push(room);
  }
  // The starting room is always a plain one.
  if (rooms.length > 0) rooms[0].shape = 'rect';
  for (const room of rooms) carveRoom(tiles, width, room, rng);

  // Connections: minimum spanning tree over room centers, plus a few loops.
  const centers = rooms.map(center);
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
    start: centers[0],
    stairs: centers[0],
    items: [],
    features: [],
  };

  removeUnreachable(level, level.start);

  // Stairs down: the room center farthest from the start.
  const distances = floorDistances(level, level.start);
  let farthest = 0;
  for (let i = 1; i < centers.length; i++) {
    const d = distances[centers[i].y * width + centers[i].x];
    if (d > distances[centers[farthest].y * width + centers[farthest].x]) farthest = i;
  }
  level.stairs = centers[farthest];

  const taken = new Set<string>([`${level.start.x},${level.start.y}`, `${level.stairs.x},${level.stairs.y}`]);
  // Fountains are geography: the same in every life. Loot, remains and crates re-roll.
  const fountains = placeSpots(level, Rng.derive(seed, 'fountains', depth), taken, rngCount(Rng.derive(seed, 'fountains-n', depth), CONFIG.features.fountain));
  const lootRng = Rng.derive(seed, 'items', depth, itemsRoll);
  const features: Feature[] = fountains.map(([x, y]) => ({ id: 0, kind: 'fountain' as const, x, y }));
  for (const kind of ['remains', 'crate'] as const) {
    for (const [x, y] of placeSpots(level, lootRng, taken, rngCount(lootRng, CONFIG.features[kind]))) features.push({ id: 0, kind, x, y });
  }
  features.forEach((f, i) => (f.id = i));
  level.features = features;
  level.items = placeItems(level, lootRng, taken);
  return level;
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
  return items;
}
