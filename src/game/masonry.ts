/**
 * Real masonry for the 3D walls: every brick is its own slightly uneven block standing out
 * from a recessed bed of mortar, so the flame casts a shadow from each edge and hatching
 * follows the true shape of each brick.
 *
 * Courses have the same heights on every wall of the level, so they line up around
 * corners, and at each corner the bricks of the two walls take turns covering it, like
 * real bonded masonry. Pure layout: it returns where each brick goes, the renderer builds
 * the meshes.
 */
import { isChasm, isDeep, isFloor, isVoid, type Level } from '../core/dungeon';
import { Rng } from '../core/rng';

/** How far bricks stand out from the mortar, which is set back by this much. */
export const BRICK_DEPTH = 0.07;
/** Mortar between bricks. */
const GAP = 0.022;

export interface Brick {
  /** Center. */
  x: number;
  y: number;
  z: number;
  /** Size along the world axes. */
  sx: number;
  sy: number;
  sz: number;
  /** Small turns that keep the wall from looking machined. */
  yaw: number;
  roll: number;
  /** Tone of the stone, around 1. */
  tone: number;
}

/** Course heights from the floor up, the same for every wall of the level. */
function courses(rng: Rng, height: number): Array<[number, number]> {
  const list: Array<[number, number]> = [];
  let y = 0;
  while (y < height - 0.04) {
    // Bricks near the floor, big ashlar blocks higher up (fewer, and the eye barely reaches).
    const h = Math.min(y < 2.2 ? rng.range(0.14, 0.3) : rng.range(0.4, 0.62), height - y);
    list.push([y, y + h]);
    y += h;
  }
  return list;
}

/** A straight stretch of wall face, along x (facing ±z) or along z (facing ±x). */
interface Run {
  alongZ: boolean;
  /** The face's plane coordinate (x for faces along z, z for faces along x). */
  plane: number;
  /** +1 or -1: which way the face looks, toward the floor. */
  normal: 1 | -1;
  start: number;
  end: number;
  startCorner: Corner;
  endCorner: Corner;
}

type Corner = 'convex' | 'concave' | 'none';

/**
 * Finds every straight run of exposed wall face. A face is exposed where a wall tile
 * touches a floor tile on that side.
 */
function runs(level: Level): Run[] {
  const list: Run[] = [];
  // Open air (a gallery's void) is neither floor nor wall: no bricks face it.
  const wall = (x: number, y: number) => !isFloor(level, x, y) && !isVoid(level, x, y) && !isChasm(level, x, y) && !isDeep(level, x, y);
  // Faces along z, looking +x (wall at x-1, floor at x) or -x (wall at x, floor at x-1).
  for (let x = 1; x < level.width; x++) {
    for (const normal of [1, -1] as const) {
      const wallX = normal === 1 ? x - 1 : x;
      const floorX = normal === 1 ? x : x - 1;
      let z = 0;
      while (z < level.height) {
        if (!(wall(wallX, z) && !wall(floorX, z))) {
          z++;
          continue;
        }
        const start = z;
        while (z < level.height && wall(wallX, z) && !wall(floorX, z)) z++;
        const corner = (zz: number): Corner => (wall(floorX, zz) ? 'concave' : !wall(wallX, zz) ? 'convex' : 'none');
        list.push({ alongZ: true, plane: x, normal, start, end: z, startCorner: corner(start - 1), endCorner: corner(z) });
      }
    }
  }
  // Faces along x, looking +z or -z.
  for (let y = 1; y < level.height; y++) {
    for (const normal of [1, -1] as const) {
      const wallY = normal === 1 ? y - 1 : y;
      const floorY = normal === 1 ? y : y - 1;
      let x = 0;
      while (x < level.width) {
        if (!(wall(x, wallY) && !wall(x, floorY))) {
          x++;
          continue;
        }
        const start = x;
        while (x < level.width && wall(x, wallY) && !wall(x, floorY)) x++;
        const corner = (xx: number): Corner => (wall(xx, floorY) ? 'concave' : !wall(xx, wallY) ? 'convex' : 'none');
        list.push({ alongZ: false, plane: y, normal, start, end: x, startCorner: corner(start - 1), endCorner: corner(x) });
      }
    }
  }
  return list;
}

/** Lays the bricks of every exposed wall face of the level, up to `height`. */
export function layBricks(
  level: Level,
  height: number,
  skip: (x: number, y: number) => boolean = () => false,
  top: (x: number, y: number) => number = () => height,
): Brick[] {
  const courseRng = Rng.derive(level.seed, 'courses', level.depth);
  const rows = courses(courseRng, height);
  const bricks: Brick[] = [];
  const d = BRICK_DEPTH;
  for (const run of runs(level)) {
    rows.forEach(([y0, y1], k) => {
      const rng = Rng.derive(level.seed, 'bricks', level.depth, run.alongZ ? 'z' : 'x', run.plane, run.normal, run.start, k);
      // Corners: the two walls take turns covering it, course by course.
      const owns = run.alongZ ? k % 2 === 0 : k % 2 === 1;
      // Outside corners: both brick layers meet over the same square; the owner covers it and
      // shows its end on the other face, the other stops short. Inside corners: the owner
      // reaches into the other wall's layer, the other starts at the corner.
      const reach = (corner: Corner) => (corner === 'convex' ? (owns ? 0 : -d) : corner === 'concave' ? (owns ? d : 0) : 0);
      const from = run.start - reach(run.startCorner);
      const to = run.end + reach(run.endCorner);
      let s = from - rng.range(0, 0.4);
      while (s < to - 0.02) {
        // Mostly ordinary bricks, now and then a long block or a short one.
        const len = y0 >= 2.2 ? rng.range(0.6, 1.1) : rng.chance(0.12) ? rng.range(0.6, 0.85) : rng.range(0.2, 0.55);
        const a = Math.max(s, from);
        const b = Math.min(s + len, to);
        s += len;
        if (b - a < 0.06) continue;
        // Now and then a brick has fallen out, leaving a real hole (never at a corner).
        if (a > from + 0.1 && b < to - 0.1 && y0 > 0.2 && rng.chance(0.02)) continue;
        // Bricks on tiles the renderer handles otherwise (columns) are left out.
        const mid = Math.floor((a + b) / 2);
        const tileX = run.alongZ ? (run.normal === 1 ? run.plane - 1 : run.plane) : mid;
        const tileY = run.alongZ ? mid : run.normal === 1 ? run.plane - 1 : run.plane;
        if (skip(tileX, tileY)) continue;
        // Walls are as tall as the space they face: the last course is cut to fit.
        const limit = top(tileX, tileY);
        if (y0 >= limit - 0.05) continue;
        const yTop = Math.min(y1, limit);
        const depth = d * rng.range(0.6, 1.35);
        const along = (a + b) / 2;
        const across = run.plane - run.normal * (d - depth / 2);
        const length = b - a - GAP;
        const tall = yTop - y0 - GAP;
        bricks.push({
          x: run.alongZ ? across : along,
          y: (y0 + yTop) / 2,
          z: run.alongZ ? along : across,
          sx: run.alongZ ? depth : length,
          sy: tall * rng.range(0.9, 1),
          sz: run.alongZ ? length : depth,
          yaw: rng.range(-0.035, 0.035),
          roll: rng.range(-0.03, 0.03),
          tone: rng.chance(0.06) ? rng.range(0.7, 0.82) : rng.range(0.9, 1.04),
        });
      }
    });
  }
  return bricks;
}

/** How far flagstones stand above the floor's bed, and their thickness. */
export const FLAG_TOP = 0.03;
const FLAG_THICK = 0.1;
const FLAG_GAP = 0.05;

/**
 * The paving of the floor: each tile laid with one, two, three or four flagstones of
 * uneven size, a little sunk or tilted here and there, with joints between them. `paved`
 * says which tiles are paved, `ground` their height. Pure layout, like the bricks.
 */
export function layFlagstones(level: Level, paved: (x: number, y: number) => boolean, ground: (x: number, y: number) => number): Brick[] {
  const stones: Brick[] = [];
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = 0; tx < level.width; tx++) {
      if (!paved(tx, ty)) continue;
      const rng = Rng.derive(level.seed, 'flags', level.depth, tx, ty);
      // Rectangles within the tile, in tile units: [x0, y0, x1, y1].
      const cut = rng.range(0.35, 0.65);
      const cut2 = rng.range(0.35, 0.65);
      const pattern = rng.int(0, 5);
      let parts: Array<[number, number, number, number]>;
      if (pattern === 0) parts = [[0, 0, 1, 1]];
      else if (pattern === 1) parts = [[0, 0, cut, 1], [cut, 0, 1, 1]];
      else if (pattern === 2) parts = [[0, 0, 1, cut], [0, cut, 1, 1]];
      else if (pattern === 3) parts = [[0, 0, cut, cut2], [cut, 0, 1, cut2], [0, cut2, cut, 1], [cut, cut2, 1, 1]];
      else if (pattern === 4) parts = [[0, 0, cut, 1], [cut, 0, 1, cut2], [cut, cut2, 1, 1]];
      else parts = [[0, 0, 1, cut], [0, cut, cut2, 1], [cut2, cut, 1, 1]];
      const base = ground(tx, ty);
      for (const [x0, y0, x1, y1] of parts) {
        const sx = x1 - x0 - FLAG_GAP;
        const sz = y1 - y0 - FLAG_GAP;
        if (sx < 0.1 || sz < 0.1) continue;
        // Most lie level; some have sunk a little, a few are tipped.
        const sink = rng.chance(0.2) ? rng.range(0.008, 0.025) : rng.range(0, 0.006);
        stones.push({
          x: tx + (x0 + x1) / 2,
          y: base + FLAG_TOP - sink - FLAG_THICK / 2,
          z: ty + (y0 + y1) / 2,
          sx,
          sy: FLAG_THICK,
          sz,
          yaw: rng.range(-0.025, 0.025),
          roll: rng.chance(0.15) ? rng.range(-0.03, 0.03) : 0,
          tone: rng.range(0.82, 1.08),
        });
      }
    }
  }
  return stones;
}
