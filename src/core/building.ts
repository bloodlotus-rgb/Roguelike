/**
 * The building (Ed1): one space of voxels instead of separate levels.
 *
 * For now its content is still the levels of today, laid one under another as storeys
 * 6 m apart (storey d has its floor at z = -(d - 1) * STOREY). Each storey fills a band of
 * the space from 1 m under its floor (the slab) to 5 m above it. Then:
 *   - where today's stairs were, a spiral well joins each storey to the next: a 3 × 3 shaft
 *     with a stone newel, its steps going round one and a half turns over 6 m;
 *   - holes are real: the pit, the gallery and the chasms open the slab, and a crack goes
 *     down through the rock of the storeys below until it reaches open air (falling into
 *     a room below) or has gone through three storeys of rock (and ends there, far down).
 *
 * The space is cut into sectors (48 × 48 tiles, one storey thick for now), generated when
 * asked for and dropped when not used. The game reads it through a view around one
 * storey, in that storey's frame (its floor at 0), as a plain `Voxels`.
 *
 * Pure logic, deterministic: the same seed always gives the same building.
 */
import { generateLevel, type Level, type Point, type Stairwell } from './dungeon';
import { DEEP, HIGH, levelVoxels, Material, Voxels, type Column, type Span } from './voxels';

/** Height of a storey: floor to floor. */
export const STOREY = 6;
/** A storey's band, from its floor: the slab under it, the room over it. */
export const BAND = { low: -1, high: 5 } as const;
/** Sectors: square, this many tiles a side. */
export const SECTOR = 48;
/** Rock a crack can go down through before it ends (in storeys). */
const CRACK_STOREYS = 3;

/** The floor of storey d, in the building's height. */
export function floorZ(depth: number): number {
  return -(depth - 1) * STOREY;
}

/** The 3 × 3 tiles of a stairwell's spiral: (k along the flight 1..3, s across -1..1). */
function wellTile(sw: Stairwell, k: number, s: number): Point {
  const across = { x: -sw.dir.y, y: sw.dir.x };
  return { x: sw.top.x + sw.dir.x * k + across.x * s, y: sw.top.y + sw.dir.y * k + across.y * s };
}

/** The way round the well, from the top tile's side to the bottom tile's: 13 tiles. */
const SPIRAL: Array<[number, number]> = [
  [1, 0],
  [1, 1],
  [2, 1],
  [3, 1],
  [3, 0],
  [3, -1],
  [2, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [2, 1],
  [3, 1],
  [3, 0],
];
/** How high the well's ceiling is over the upper storey's floor. */
const WELL_ROOF = 3;
/** How thick a step's slab is (under its slope). */
const STEP_SLAB = 0.35;

/** The corners of a tile's side, as indices into a span's slope (x0y0, x1y0, x1y1, x0y1). */
function sideCorners(dx: number, dy: number): [number, number] {
  if (dx === 1) return [1, 2];
  if (dx === -1) return [0, 3];
  if (dy === 1) return [3, 2];
  return [0, 1];
}

/**
 * The columns of a spiral well, in the frame of the storey above it (its floor at 0; the
 * storey below has its floor at -STOREY). Keyed by tile index.
 */
function wellColumns(sw: Stairwell, width: number): Map<number, Column> {
  const out = new Map<number, Column>();
  const index = (p: Point) => p.y * width + p.x;
  const steps = new Map<number, Span[]>();
  SPIRAL.forEach(([k, s], i) => {
    const here = wellTile(sw, k, s);
    const prev = i === 0 ? wellTile(sw, 0, 0) : wellTile(sw, SPIRAL[i - 1][0], SPIRAL[i - 1][1]);
    const next = i === SPIRAL.length - 1 ? wellTile(sw, 4, 0) : wellTile(sw, SPIRAL[i + 1][0], SPIRAL[i + 1][1]);
    const hin = (-STOREY * i) / SPIRAL.length;
    const hout = (-STOREY * (i + 1)) / SPIRAL.length;
    const a = sideCorners(prev.x - here.x, prev.y - here.y);
    const b = sideCorners(next.x - here.x, next.y - here.y);
    const slope: [number, number, number, number] = [0, 0, 0, 0];
    const shared = a.find((c) => b.includes(c));
    if (shared === undefined) {
      for (const c of a) slope[c] = hin;
      for (const c of b) slope[c] = hout;
    } else {
      // Turning a corner: the inner corner halfway, the rest so each side's middle is right.
      const m = (hin + hout) / 2;
      const oa = a.find((c) => c !== shared)!;
      const ob = b.find((c) => c !== shared)!;
      slope[shared] = m;
      slope[oa] = 2 * hin - m;
      slope[ob] = 2 * hout - m;
      const last = [0, 1, 2, 3].find((c) => c !== shared && c !== oa && c !== ob)!;
      slope[last] = slope[oa] + slope[ob] - m;
    }
    const top = (slope[0] + slope[1] + slope[2] + slope[3]) / 4;
    const list = steps.get(index(here)) ?? [];
    list.push({ bottom: Math.min(...slope) - STEP_SLAB, top, mat: Material.Stone, slope });
    steps.set(index(here), list);
  });
  for (let k = 1; k <= 3; k++) {
    for (let s = -1; s <= 1; s++) {
      const t = index(wellTile(sw, k, s));
      if (k === 2 && s === 0) {
        // The newel: stone from the floor below to the roof.
        out.set(t, [{ bottom: DEEP, top: HIGH, mat: Material.Rock }]);
        continue;
      }
      const flights = (steps.get(t) ?? []).sort((p, q) => p.bottom - q.bottom);
      out.set(t, [{ bottom: DEEP, top: -STOREY, mat: Material.Rock }, ...flights, { bottom: WELL_ROOF, top: HIGH, mat: Material.Rock }]);
    }
  }
  return out;
}

/** A column moved up or down by dz. */
function shift(col: Column, dz: number): Column {
  if (dz === 0) return col;
  return col.map((s) => ({
    bottom: s.bottom <= DEEP ? DEEP : s.bottom + dz,
    top: s.top >= HIGH ? HIGH : s.top + dz,
    mat: s.mat,
    slope: s.slope ? (s.slope.map((h) => h + dz) as Span['slope']) : undefined,
  }));
}

/** A column cut to a band [low, high). */
function clip(col: Column, low: number, high: number): Column {
  const out: Column = [];
  for (const s of col) {
    const bottom = Math.max(s.bottom, low);
    const top = Math.min(s.top, high);
    if (top <= bottom + 1e-6) continue;
    const cut = top < s.top - 1e-6;
    out.push({ bottom, top, mat: s.mat, slope: cut ? undefined : s.slope });
  }
  return out;
}

/** Joins spans that touch and are the same flat material. */
function merge(col: Column): Column {
  const out: Column = [];
  for (const s of col) {
    const last = out[out.length - 1];
    if (last && !last.slope && !s.slope && last.mat === s.mat && Math.abs(last.top - s.bottom) < 1e-6) last.top = s.top;
    else out.push({ ...s });
  }
  return out;
}

interface StoreyData {
  level: Level;
  voxels: Voxels;
  /** The wells of this storey's flights, in its own frame: down (to the next) and up. */
  down: Map<number, Column>;
  up: Map<number, Column>;
}

export class Building {
  readonly width: number;
  readonly height: number;
  private readonly storeys = new Map<number, StoreyData>();
  /** Levels as generated (untouched), so each is generated only once. */
  private readonly pristine = new Map<number, Level>();
  private readonly sectors = new Map<string, Column[]>();
  /** Most recently used last, to drop the oldest. */
  private readonly order: string[] = [];
  private static readonly KEEP_SECTORS = 96;
  private static readonly KEEP_STOREYS = 10;

  constructor(
    readonly seed: string,
    readonly life: number,
    /** Brings a generated level to its state (floods); the game's own level is given apart. */
    private readonly prepare: (level: Level, depth: number) => void = () => {},
  ) {
    const first = this.freshLevel(1);
    this.width = first.width;
    this.height = first.height;
  }

  /** The level the game plays now at this depth (live: floods, bridges): it replaces the generated one. */
  setLevel(depth: number, level: Level): void {
    this.storeys.set(depth, this.makeStorey(level));
    this.touch(depth);
  }

  /** The storey at `depth` changed shape: its sectors, and those of the cracks under it, are built again. */
  touch(depth: number): void {
    const data = this.storeys.get(depth);
    if (data) this.storeys.set(depth, this.makeStorey(data.level));
    for (const key of [...this.sectors.keys()]) {
      const d = Number(key.split(':')[0]);
      if (d >= depth && d <= depth + CRACK_STOREYS + 1) this.sectors.delete(key);
    }
  }

  private makeStorey(level: Level): StoreyData {
    return { level, voxels: levelVoxels(level), down: wellColumns(level.down, level.width), up: wellColumns(level.up, level.width) };
  }

  /** A fresh copy of the level at a depth, as generated (generated once, then copied). */
  freshLevel(depth: number): Level {
    let level = this.pristine.get(depth);
    if (!level) {
      level = generateLevel(this.seed, depth, this.life);
      this.pristine.set(depth, level);
      if (this.pristine.size > Building.KEEP_STOREYS + 4) {
        const far = [...this.pristine.keys()].sort((a, b) => Math.abs(b - depth) - Math.abs(a - depth))[0];
        this.pristine.delete(far);
      }
    }
    return structuredClone(level);
  }

  private storey(depth: number): StoreyData {
    let data = this.storeys.get(depth);
    if (!data) {
      const level = this.freshLevel(depth);
      this.prepare(level, depth);
      data = this.makeStorey(level);
      this.storeys.set(depth, data);
      // Keep a handful: the game's own is set again whenever it changes.
      if (this.storeys.size > Building.KEEP_STOREYS) {
        const far = [...this.storeys.keys()].sort((a, b) => Math.abs(b - depth) - Math.abs(a - depth))[0];
        this.storeys.delete(far);
      }
    }
    return data;
  }

  /** The level at a depth (generated, or the game's own). */
  levelAt(depth: number): Level {
    return this.storey(depth).level;
  }

  /** Whether a tile of storey d is part of a well (going down from it, or coming down into it). */
  private wellAt(depth: number, tile: number): Column | null {
    const data = this.storey(depth);
    const down = data.down.get(tile);
    if (down) return down;
    const up = data.up.get(tile);
    return up ? shift(up, STOREY) : null;
  }

  /** The storey's own column, cut to its band (no wells, no cracks). */
  private own(depth: number, x: number, y: number): Column {
    return clip(this.storey(depth).voxels.column(x, y), BAND.low, BAND.high);
  }

  /** Nothing to stand on at the bottom of its band: a hole in the slab. */
  private opening(depth: number, x: number, y: number): boolean {
    if (this.wellAt(depth, y * this.width + x)) return false;
    return !this.own(depth, x, y).some((s) => s.mat !== Material.Water && s.bottom <= BAND.low + 1e-6);
  }

  /** Solid rock through the whole band. */
  private rock(depth: number, x: number, y: number): boolean {
    if (this.wellAt(depth, y * this.width + x)) return false;
    const col = this.storey(depth).voxels.column(x, y);
    return col.length === 1 && col[0].bottom <= BAND.low && col[0].top >= BAND.high;
  }

  /** The storey a crack comes down from into this tile of storey d, if any. */
  private crackFrom(depth: number, x: number, y: number): number | null {
    for (let k = 1; k <= CRACK_STOREYS + 1; k++) {
      const o = depth - k;
      if (o < 1) return null;
      if (this.opening(o, x, y)) return o;
      if (!this.rock(o, x, y)) return null;
    }
    return null;
  }

  /** A column of storey d's band, in its frame (floor at 0), with wells and cracks. */
  private bandColumn(depth: number, x: number, y: number): Column {
    if (depth < 1) {
      // Above the first storey: the rock under the mansion, with the first well going up.
      const up = this.storey(1).up.get(y * this.width + x);
      return clip(up ?? [{ bottom: DEEP, top: HIGH, mat: Material.Rock }], BAND.low, BAND.high);
    }
    const well = this.wellAt(depth, y * this.width + x);
    if (well) return clip(well, BAND.low, BAND.high);
    const col = this.own(depth, x, y);
    const from = this.crackFrom(depth, x, y);
    if (from === null) return col;
    if (this.rock(depth, x, y)) return depth - from <= CRACK_STOREYS ? [] : col;
    // Into open air: the crack takes the rock overhead and opens there.
    const top = col[col.length - 1];
    return top && top.top >= BAND.high - 1e-6 ? col.slice(0, -1) : col;
  }

  /** A sector of a storey's band: its columns, built when first asked for. */
  private sector(depth: number, sx: number, sy: number): Column[] {
    const key = `${depth}:${sx}:${sy}`;
    let cols = this.sectors.get(key);
    if (cols) {
      const i = this.order.indexOf(key);
      if (i >= 0) this.order.splice(i, 1);
      this.order.push(key);
      return cols;
    }
    cols = [];
    for (let y = sy * SECTOR; y < (sy + 1) * SECTOR; y++) {
      for (let x = sx * SECTOR; x < (sx + 1) * SECTOR; x++) {
        cols.push(x < this.width && y < this.height ? this.bandColumn(depth, x, y) : [{ bottom: BAND.low, top: BAND.high, mat: Material.Rock }]);
      }
    }
    this.sectors.set(key, cols);
    this.order.push(key);
    while (this.order.length > Building.KEEP_SECTORS) this.sectors.delete(this.order.shift()!);
    return cols;
  }

  /** A column of a storey's band (from its sector). */
  band(depth: number, x: number, y: number): Column {
    const sx = Math.floor(x / SECTOR);
    const sy = Math.floor(y / SECTOR);
    return this.sector(depth, sx, sy)[(y - sy * SECTOR) * SECTOR + (x - sx * SECTOR)];
  }

  /** How many sectors are built right now (for tests and measures). */
  get sectorCount(): number {
    return this.sectors.size;
  }

  /**
   * The space around storey d, in its frame (its floor at 0): the storey above, this one
   * and two below, with rock over all of it and under it (unless a crack goes on down).
   */
  view(depth: number): Voxels {
    const v = new Voxels(this.width, this.height);
    const bands = [depth + 2, depth + 1, depth, depth - 1];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const col: Column = [];
        // The rock under the view, unless a crack goes on down through its lowest storey.
        if (this.band(depth + 2, x, y).some((s) => s.bottom <= BAND.low + 1e-6)) col.push({ bottom: DEEP, top: floorZ(depth + 2) - floorZ(depth) + BAND.low, mat: Material.Rock });
        for (const d of bands) col.push(...shift(this.band(d, x, y), floorZ(d) - floorZ(depth)));
        col.push({ bottom: floorZ(depth - 1) - floorZ(depth) + BAND.high, top: HIGH, mat: Material.Rock });
        v.set(x, y, merge(col));
      }
    }
    return v;
  }
}
