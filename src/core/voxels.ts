/**
 * The dungeon in voxels: every tile keeps its column, the list of solid spans from the
 * bottom up (rock, worked stone, wood, water). It is a voxel grid packed by columns, with
 * free vertical resolution, so the heights the game already has fit exactly (terraces of
 * 0.7, steps, water, ceilings of 3 to 5.5), and a tile can hold several walkable surfaces,
 * one above another.
 *
 * V1: the model, its queries, and the columns derived from a level as the game builds it
 * today. Pure logic, no drawing.
 */
import { Ground, groundAt, groundHeight, isBridge, isChasm, isDeep, isFloor, isShallow, isVoid, LEVEL_HEIGHT, onSteps, stairProgress, type Level, type Point } from './dungeon';

export const Material = {
  Rock: 1,
  /** Worked stone: steps, slabs. */
  Stone: 2,
  Wood: 3,
  /** Not solid: walked (wading) or swum through, drawn as a surface. */
  Water: 4,
} as const;
export type Material = (typeof Material)[keyof typeof Material];

export interface Span {
  bottom: number;
  /** The top; on a sloped span (a ramp), its height at the middle of the tile. */
  top: number;
  mat: Material;
  /** A sloped top: its height at the corners (x0y0, x1y0, x1y1, x0y1). */
  slope?: [number, number, number, number];
}

/** The top of a span at a point of its tile (fx, fy in 0..1). */
export function topAt(s: Span, fx: number, fy: number): number {
  if (!s.slope) return s.top;
  const [a, b, c, d] = s.slope;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + c * fx) * fy;
}

/** A tile's column: solid spans, sorted from the bottom, never overlapping. */
export type Column = Span[];

/** Far below and far above everything: the rock the dungeon is cut into. */
export const DEEP = -30;
export const HIGH = 40;
/** How much room a body needs above a surface to stand on it. */
export const CLEARANCE = 1.6;

/**
 * How high the ceiling is over each open tile: passages 3, rooms 4, great halls 5; over
 * the stairs up it comes down to meet the flight.
 */
export const CEILING = { passage: 3, room: 4, hall: 5, stairs: LEVEL_HEIGHT + 0.6 };

export function ceilingHeights(level: Level): Float32Array {
  const { width, height } = level;
  const heights = new Float32Array(width * height);
  const open = (x: number, y: number) => isFloor(level, x, y) || isVoid(level, x, y) || isChasm(level, x, y) || isDeep(level, x, y);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (open(x, y)) heights[y * width + x] = CEILING.passage;
  for (const r of level.rooms) {
    const tall = r.shape === 'hall' || r.w * r.h >= 150 ? CEILING.hall : CEILING.room;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (open(x, y)) heights[y * width + x] = tall;
  }
  // Only over open tiles: an end of the flight can be rock.
  for (const p of [...level.up.steps, level.up.top, level.up.bottom]) {
    const i = p.y * width + p.x;
    if (heights[i]) heights[i] = Math.min(heights[i], CEILING.stairs);
  }
  return heights;
}

/** How deep deep water is, and where its surface lies. */
export const DEEP_WATER = { floor: -0.9, surface: -0.16 };

export class Voxels {
  readonly columns: Column[];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.columns = Array.from({ length: width * height }, () => [{ bottom: DEEP, top: HIGH, mat: Material.Rock }]);
  }

  column(x: number, y: number): Column {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return [{ bottom: DEEP, top: HIGH, mat: Material.Rock }];
    return this.columns[y * this.width + x];
  }

  set(x: number, y: number, column: Column): void {
    this.columns[y * this.width + x] = column;
  }

  /** Whether the point is inside something solid (water is not). */
  solidAt(x: number, y: number, z: number): boolean {
    return this.column(Math.floor(x), Math.floor(y)).some((s) => s.mat !== Material.Water && z >= s.bottom && z < s.top);
  }

  /**
   * The heights one can stand on in a tile: the top of every solid span with room enough
   * above it before the next solid one. Lowest first.
   */
  surfaces(x: number, y: number): number[] {
    const col = this.column(x, y).filter((s) => s.mat !== Material.Water);
    const out: number[] = [];
    col.forEach((s, i) => {
      const above = col[i + 1]?.bottom ?? HIGH;
      if (s.top > DEEP && above - s.top >= CLEARANCE) out.push(s.top);
    });
    return out;
  }

  /** The surface a body at height z stands on (the highest at or a little above it). */
  floorBelow(x: number, y: number, z: number, step = 0.45): number | null {
    let best: number | null = null;
    for (const top of this.surfaces(x, y)) if (top <= z + step && (best === null || top > best)) best = top;
    return best;
  }

  /**
   * The ground under a point (px, py in level units, not a tile): the highest surface
   * at or a little above z, read on sloped tops (ramps, stairs) at that exact spot.
   */
  groundAt(px: number, py: number, z: number, step = 0.45): number | null {
    const tx = Math.floor(px);
    const ty = Math.floor(py);
    const col = this.column(tx, ty).filter((s) => s.mat !== Material.Water);
    let best: number | null = null;
    col.forEach((s, i) => {
      const above = col[i + 1]?.bottom ?? HIGH;
      if (s.top <= DEEP || above - s.top < CLEARANCE) return;
      const top = topAt(s, px - tx, py - ty);
      if (top <= z + step && (best === null || top > best)) best = top;
    });
    return best;
  }

  /** The underside of the first solid thing above z. */
  ceilingAbove(x: number, y: number, z: number): number {
    for (const s of this.column(x, y)) if (s.mat !== Material.Water && s.bottom >= z) return s.bottom;
    return HIGH;
  }

  /** The water surface in a tile, if there is water. */
  waterAt(x: number, y: number): number | null {
    const w = this.column(x, y).find((s) => s.mat === Material.Water);
    return w ? w.top : null;
  }
}

/**
 * The voxels of a level as the game builds it today: rock where there is wall; on open
 * tiles, the ground (terraces raised, ramps at their middle height, steps going down or up
 * a storey), water, and the ceiling of the space above. Chasms have no floor; the pit, the
 * stairs down and the gallery open onto the level below; a bridge is a plank of wood.
 */
export function levelVoxels(level: Level): Voxels {
  const { width, height } = level;
  const v = new Voxels(width, height);
  const ceilings = ceilingHeights(level);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ceiling = ceilings[y * width + x];
      if (!ceiling) continue;
      const roof: Span = { bottom: ceiling, top: HIGH, mat: Material.Rock };
      const centre = { x: x + 0.5, y: y + 0.5 };
      if (isChasm(level, x, y)) {
        v.set(x, y, [roof]);
        continue;
      }
      if (isVoid(level, x, y) || (x === level.pit.x && y === level.pit.y)) {
        // Open onto the level below.
        v.set(x, y, [{ bottom: DEEP, top: -LEVEL_HEIGHT, mat: Material.Rock }, roof]);
        continue;
      }
      if (isDeep(level, x, y)) {
        v.set(x, y, [
          { bottom: DEEP, top: DEEP_WATER.floor, mat: Material.Rock },
          { bottom: DEEP_WATER.floor, top: DEEP_WATER.surface, mat: Material.Water },
          roof,
        ]);
        continue;
      }
      if (isBridge(level, x, y)) {
        v.set(x, y, [{ bottom: -0.12, top: 0, mat: Material.Wood }, roof]);
        continue;
      }
      // Ground: terraces and ramps, or the steps of a stairwell.
      let ground = groundHeight(level, centre);
      let mat: Material = Material.Rock;
      // The stairs are a slope of worked stone, going down or up a storey over three tiles.
      const flight = onSteps(level.down, centre) ? level.down : onSteps(level.up, centre) ? level.up : null;
      const stairs = (fx: number, fy: number) => {
        const t = Math.min(1, Math.max(0, (stairProgress(flight!, { x: x + fx, y: y + fy }) - 0.5) / 3));
        return flight === level.down ? -LEVEL_HEIGHT * t : LEVEL_HEIGHT * (1 - t);
      };
      if (flight) {
        ground = stairs(0.5, 0.5);
        mat = Material.Stone;
      }
      const column: Column = [{ bottom: DEEP, top: ground, mat }];
      if (flight) column[0].slope = [stairs(0, 0), stairs(1, 0), stairs(1, 1), stairs(0, 1)];
      else if (groundAt(level, x, y) === Ground.Ramp) {
        const at = (fx: number, fy: number) => groundHeight(level, { x: x + Math.min(0.999, Math.max(0.001, fx)), y: y + Math.min(0.999, Math.max(0.001, fy)) });
        column[0].slope = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
      }
      if (isShallow(level, x, y)) column.push({ bottom: ground, top: ground + 0.12, mat: Material.Water });
      // The stairs up rise into the level above: no ceiling right over the steps.
      if (!onSteps(level.up, centre)) column.push(roof);
      v.set(x, y, column);
    }
  }
  return v;
}

/** The tile of a point. */
export function tileOf(p: Point): Point {
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}
