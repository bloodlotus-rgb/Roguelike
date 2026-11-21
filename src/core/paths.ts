/**
 * Ways and sight in the voxels (V4).
 *
 * Ways: the places one can stand are the surfaces of the voxels, several in a tile if
 * there is room between them (a floor and a balcony above). Two of them in neighbouring
 * tiles are joined if a body walks from one to the other: up at most a low step, down at
 * most a hop off a terrace, measured on the shared edge (so stairs and ramps join their
 * steps). Distance fields over that graph lead the horrors.
 *
 * Sight: a straight line through the voxels, blocked by anything solid and by shut doors,
 * so from a balcony one sees the hall below and from below a terrace's top.
 */
import { BODY } from './bodies';
import { isDeep, type Level, type Point } from './dungeon';
import { CLEARANCE, DEEP, HIGH, Material, topAt, type Span, type Voxels } from './voxels';

const SIDES: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
/** Where each side's edge is, in the tile (fx, fy): its middle. */
const EDGE_MID: ReadonlyArray<readonly [number, number]> = [
  [1, 0.5],
  [0, 0.5],
  [0.5, 1],
  [0.5, 0],
];

/**
 * The surfaces of a level. A tile's lowest surface has the tile's own index as its node;
 * any above it get nodes past the end of the grid.
 */
export class Surfaces {
  /** Nodes in all: the grid's tiles, then the extra surfaces. */
  readonly count: number;
  /** For each node: its tile, its height at the middle, and its height at each side's edge. */
  readonly tile: Int32Array;
  readonly height: Float32Array;
  private readonly edges: Float32Array;
  /** Whether a node is a real surface (tiles of rock have none, their node is unused). */
  readonly exists: Uint8Array;
  /** Extra surfaces of a tile, above its first. */
  private readonly extra = new Map<number, number[]>();

  constructor(
    readonly voxels: Voxels,
    readonly level: Level,
  ) {
    const { width, height } = voxels;
    const tiles = width * height;
    const found: Array<{ tile: number; span: Span }> = [];
    const first: Array<Span | null> = new Array(tiles).fill(null);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const col = voxels.column(x, y).filter((s) => s.mat !== Material.Water);
        const t = y * width + x;
        col.forEach((s, i) => {
          const above = col[i + 1]?.bottom ?? HIGH;
          if (s.top <= DEEP || above - s.top < CLEARANCE) return;
          if (!first[t]) first[t] = s;
          else found.push({ tile: t, span: s });
        });
      }
    }
    this.count = tiles + found.length;
    this.tile = new Int32Array(this.count);
    this.height = new Float32Array(this.count);
    this.edges = new Float32Array(this.count * 4);
    this.exists = new Uint8Array(this.count);
    const fill = (node: number, tile: number, s: Span) => {
      this.tile[node] = tile;
      this.height[node] = s.top;
      this.exists[node] = 1;
      EDGE_MID.forEach(([fx, fy], k) => (this.edges[node * 4 + k] = topAt(s, fx, fy)));
    };
    for (let t = 0; t < tiles; t++) {
      this.tile[t] = t;
      const s = first[t];
      if (s) fill(t, t, s);
    }
    found.forEach(({ tile, span }, i) => {
      const node = tiles + i;
      fill(node, tile, span);
      const list = this.extra.get(tile) ?? [];
      list.push(node);
      this.extra.set(tile, list);
    });
  }

  /** Every surface of a tile, lowest first. */
  nodesOf(tile: number): number[] {
    const more = this.extra.get(tile);
    const base = this.exists[tile] ? [tile] : [];
    return more ? [...base, ...more] : base;
  }

  /** The surface a body at (p, z) stands on, or -1. */
  nodeAt(p: Point, z: number): number {
    const tx = Math.floor(p.x);
    const ty = Math.floor(p.y);
    if (tx < 0 || ty < 0 || tx >= this.voxels.width || ty >= this.voxels.height) return -1;
    let best = -1;
    let gap = Infinity;
    for (const n of this.nodesOf(ty * this.voxels.width + tx)) {
      // The one just under the feet (a body is never far above what it stands on).
      const d = Math.abs(this.height[n] - z);
      if (d < gap) {
        gap = d;
        best = n;
      }
    }
    return best;
  }

  /** Whether a body walks from node `a` onto node `b` in the tile beside it, on `side`. */
  private joins(a: number, b: number, side: number): boolean {
    const level = this.level;
    const tb = this.tile[b];
    if (level.closed?.has(tb) || level.blocked?.[tb] || isDeep(level, tb % level.width, Math.floor(tb / level.width))) return false;
    const from = this.edges[a * 4 + side];
    // The neighbour's edge on the far side of the shared one.
    const to = this.edges[b * 4 + (side ^ 1)];
    return to - from <= BODY.step + 1e-3 && from - to <= BODY.maxDrop + 1e-3;
  }

  /** The surfaces one walks onto from node `a`, with the side they are on. */
  private next(a: number, visit: (b: number, side: number) => void): void {
    const w = this.voxels.width;
    const t = this.tile[a];
    const x = t % w;
    const y = Math.floor(t / w);
    SIDES.forEach(([dx, dy], side) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= this.voxels.height) return;
      for (const b of this.nodesOf(ny * w + nx)) if (this.joins(a, b, side)) visit(b, side);
    });
  }

  /**
   * Steps from every surface to `goal`, walking (so a terrace's foot is far from its top
   * unless there is a ramp, though its top is near its foot). -1 where it cannot be reached.
   */
  distancesTo(goal: number): Int32Array {
    const dist = new Int32Array(this.count).fill(-1);
    if (goal < 0 || !this.exists[goal]) return dist;
    dist[goal] = 0;
    const queue = [goal];
    for (let head = 0; head < queue.length; head++) {
      const m = queue[head];
      // Who can walk into m: look at the neighbours, and test the step from them.
      const w = this.voxels.width;
      const t = this.tile[m];
      const x = t % w;
      const y = Math.floor(t / w);
      SIDES.forEach(([dx, dy], side) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= this.voxels.height) return;
        for (const n of this.nodesOf(ny * w + nx)) {
          if (dist[n] !== -1) continue;
          // From n, m lies on the opposite side.
          if (!this.joins(n, m, side ^ 1)) continue;
          dist[n] = dist[m] + 1;
          queue.push(n);
        }
      });
    }
    return dist;
  }

  /**
   * Which way to go from a body at (p, z) to come closer along a distance field: toward the
   * middle of the next surface, or null if already there or lost.
   */
  directionFrom(field: Int32Array, p: Point, z: number): Point | null {
    const here = this.nodeAt(p, z);
    if (here < 0) return null;
    const value = field[here];
    if (value <= 0) return null;
    let best: Point | null = null;
    let bestValue = value;
    const w = this.voxels.width;
    this.next(here, (b) => {
      if (field[b] >= 0 && field[b] < bestValue) {
        bestValue = field[b];
        const t = this.tile[b];
        best = { x: (t % w) + 0.5 - p.x, y: Math.floor(t / w) + 0.5 - p.y };
      }
    });
    return best;
  }
}

/**
 * Whether the straight line from a (at height za) to b (at zb) is clear: nothing solid
 * on it, and no shut door. Stops short of `stopTile` (a wall being looked at).
 */
export function clearSight(v: Voxels, level: Level, a: Point, za: number, b: Point, zb: number, stopTile = -1): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = zb - za;
  const length = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(length / 0.25));
  const startTile = Math.floor(a.y) * level.width + Math.floor(a.x);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const tile = ty * level.width + tx;
    if (tile === stopTile) return true;
    if (tile !== startTile && level.closed?.has(tile)) return false;
    if (v.solidAt(x, y, za + dz * t)) return false;
  }
  return true;
}

/** How high the eyes are above the feet. */
export const EYE_HEIGHT = 1.5;

/**
 * The tiles seen from the eye at (origin, eyeZ) within `radius`: floors whose surface the
 * eye can see, the walls whose face it can see, and open drops (looked at the level of the
 * viewer's feet). Indices y * width + x.
 */
export function visibleTiles3D(v: Voxels, level: Level, origin: Point, eyeZ: number, feetZ: number, radius: number): number[] {
  const { width, height } = level;
  const out: number[] = [];
  const r = Math.ceil(radius);
  const ox = Math.floor(origin.x);
  const oy = Math.floor(origin.y);
  for (let ty = Math.max(0, oy - r); ty <= Math.min(height - 1, oy + r); ty++) {
    for (let tx = Math.max(0, ox - r); tx <= Math.min(width - 1, ox + r); tx++) {
      // The point of the tile nearest the eye.
      const px = Math.max(tx + 0.02, Math.min(origin.x, tx + 0.98));
      const py = Math.max(ty + 0.02, Math.min(origin.y, ty + 0.98));
      if ((px - origin.x) ** 2 + (py - origin.y) ** 2 > radius * radius) continue;
      const tile = ty * width + tx;
      if (tx === ox && ty === oy) {
        out.push(tile);
        continue;
      }
      const p = { x: px, y: py };
      // What is seen of a floor is its top, or the water over it.
      const floor = v.groundAt(px, py, eyeZ + 1);
      const water = v.waterAt(tx, ty);
      const ground = floor === null ? null : Math.max(floor, water ?? floor);
      let seen: boolean;
      if (ground !== null) seen = clearSight(v, level, origin, eyeZ, p, ground + 0.05, -1) || clearSight(v, level, origin, eyeZ, { x: tx + 0.5, y: ty + 0.5 }, ground + 0.05, -1);
      else if (v.solidAt(tx + 0.5, ty + 0.5, eyeZ)) seen = clearSight(v, level, origin, eyeZ, p, eyeZ, tile);
      else seen = clearSight(v, level, origin, eyeZ, p, feetZ, -1);
      // A shut door is seen, like a wall, but not past.
      if (!seen && level.closed?.has(tile)) seen = clearSight(v, level, origin, eyeZ, p, eyeZ, tile);
      if (seen) out.push(tile);
    }
  }
  return out;
}
