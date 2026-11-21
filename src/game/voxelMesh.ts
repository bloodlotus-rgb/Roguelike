/**
 * One mesher for the whole dungeon, from its voxels (V2): wherever an open column has air
 * and its neighbour something solid at the same height there is a vertical face, and the
 * tops and undersides of the spans are the floors and ceilings. What it returns is plain
 * arrays (no three.js), grouped by how each face is drawn:
 *
 *   floor    tops of the ground, and the fronts of terraces and the sides of ramps
 *   wall     the faces of the rock walls above the floor (set back behind their bricks)
 *   cap      the tops of the walls where the view cuts them off (from above)
 *   ceiling  undersides of the rock overhead, and the lintels where a low ceiling meets a
 *            higher one
 *   rock     everything below the floor: the sides of chasms, pits and basins, fading to
 *            ink the deeper they go
 *
 * Coordinates of the output are the renderer's: x along the tiles, y up, z along the rows.
 */
import { DEEP, HIGH, Material, topAt, type Span, type Voxels } from '../core/voxels';

export type MeshPart = 'floor' | 'wall' | 'cap' | 'ceiling' | 'rock';
export const MESH_PARTS: MeshPart[] = ['floor', 'wall', 'cap', 'ceiling', 'rock'];

export interface MeshBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  /** Only the rock has them: how much light is left at that depth. */
  colors: number[];
  indices: number[];
  quads: number;
}

export interface MeshOptions {
  /** Nothing is drawn above this (from above, the walls are cut low). */
  maxZ: number;
  /** Nor below this: where the light gives out. */
  minZ: number;
  /** How far wall faces sit back into the wall (behind the bricks laid on them). */
  inset?: number;
  /** The lowest floor drawn (by default, anything above the tile's lowest drawn height). */
  floorMin?: number;
  /** The depth at which rock has gone to ink. */
  fade?: number;
  /** The faces in this open tile go no lower than this (a hole drawn as a thin slab). */
  clipBelow?: (x: number, y: number) => number | undefined;
  /** Tiles that draw nothing of their own (drawn elsewhere). */
  skip?: (x: number, y: number) => boolean;
  /** Solid tiles drawn elsewhere (round columns): no faces against them, no cap. */
  hollow?: (x: number, y: number) => boolean;
  /** Per tile, instead of `minZ` and `maxZ`: how far down and up it is drawn. */
  minZAt?: (x: number, y: number) => number;
  maxZAt?: (x: number, y: number) => number;
  /** Per tile: whether its rock fades to ink with depth (a chasm), or keeps its tone. */
  fadeAt?: (x: number, y: number) => boolean;
  /** Only the tiles of this rectangle [x0, x1) × [y0, y1) (a sector). */
  region?: { x0: number; y0: number; x1: number; y1: number };
}

/** Solid for drawing: rock and stone, and deep water, which hides what is under it. */
function opaque(s: Span): boolean {
  return s.mat === Material.Rock || s.mat === Material.Stone || (s.mat === Material.Water && s.top - s.bottom > 0.5);
}

/** Walkable ground: a top that is drawn as floor. */
function ground(s: Span): boolean {
  return s.mat === Material.Rock || s.mat === Material.Stone;
}

const SIDES: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function meshVoxels(v: Voxels, options: MeshOptions): Record<MeshPart, MeshBuffers> {
  const { maxZ, inset = 0, fade = 6 } = options;
  const skip = options.skip ?? (() => false);
  const hollow = options.hollow ?? (() => false);
  const out = {} as Record<MeshPart, MeshBuffers>;
  for (const part of MESH_PARTS) out[part] = { positions: [], normals: [], uvs: [], colors: [], indices: [], quads: 0 };

  /** A quad, wound so its front looks along `normal`. */
  let fading = true;
  const quad = (part: MeshPart, corners: number[][], normal: readonly number[], uvs: number[][]) => {
    const b = out[part];
    // The diagonals' cross product points out of the front of a counter-clockwise quad.
    const d1 = [corners[2][0] - corners[0][0], corners[2][1] - corners[0][1], corners[2][2] - corners[0][2]];
    const d2 = [corners[3][0] - corners[1][0], corners[3][1] - corners[1][1], corners[3][2] - corners[1][2]];
    const cross = [d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]];
    const order = cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2] < 0 ? [0, 3, 2, 1] : [0, 1, 2, 3];
    const n = b.quads * 4;
    for (const i of order) {
      b.positions.push(corners[i][0], corners[i][1], corners[i][2]);
      b.normals.push(normal[0], normal[1], normal[2]);
      b.uvs.push(uvs[i][0], uvs[i][1]);
      if (part === 'rock') {
        const c = fading ? Math.min(1, Math.max(0, 1 + corners[i][1] / fade)) : 1;
        b.colors.push(c, c, c);
      }
    }
    b.indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    b.quads++;
  };

  // Each column's opaque spans, once; outside the grid it is all rock.
  const opaqueColumns = v.columns.map((c) => c.filter(opaque));
  const outside = v.column(-1, -1);
  const solids = (x: number, y: number) => (x < 0 || y < 0 || x >= v.width || y >= v.height ? outside : opaqueColumns[y * v.width + x]);
  const top = (x: number, y: number) => options.maxZAt?.(x, y) ?? maxZ;
  const topSolid = opaqueColumns.map((c, i) => {
    const capZ = top(i % v.width, Math.floor(i / v.width)) - 1e-3;
    return c.some((s) => capZ >= s.bottom && capZ < s.top);
  });
  const solidAtTop = (x: number, y: number) => x < 0 || y < 0 || x >= v.width || y >= v.height || topSolid[y * v.width + x];
  const r = options.region ?? { x0: 0, y0: 0, x1: v.width, y1: v.height };

  for (let y = Math.max(0, r.y0); y < Math.min(v.height, r.y1); y++) {
    for (let x = Math.max(0, r.x0); x < Math.min(v.width, r.x1); x++) {
      if (skip(x, y)) continue;
      const col = solids(x, y);
      const maxZ = top(x, y);
      const minZ = options.minZAt?.(x, y) ?? options.minZ;
      fading = options.fadeAt?.(x, y) ?? true;
      // The cap: a solid tile cut off by the top of the view, beside open air.
      if (!hollow(x, y) && solidAtTop(x, y)) {
        let beside = false;
        for (let dy = -1; dy <= 1 && !beside; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !solidAtTop(x + dx, y + dy)) beside = true;
        if (beside) quad('cap', [[x, maxZ, y], [x + 1, maxZ, y], [x + 1, maxZ, y + 1], [x, maxZ, y + 1]], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]]);
      }
      if (hollow(x, y)) continue;
      const clip = Math.max(minZ, options.clipBelow?.(x, y) ?? -Infinity);
      // The air of this column: the gaps between its solid spans.
      for (let i = 0; i <= col.length; i++) {
        const below = col[i - 1];
        const above = col[i];
        if (below && below.top >= HIGH) continue;
        if (above && above.bottom <= DEEP) continue;
        const hi = Math.min(above ? above.bottom : HIGH, maxZ);
        /** The bottom of the air at a point of the tile. */
        const lo = (fx: number, fy: number) => Math.max(below ? topAt(below, fx, fy) : DEEP, clip);
        if (below && ground(below) && below.top >= (options.floorMin ?? minZ + 1e-3) && below.top <= maxZ) {
          // The floor, sloped on a ramp.
          const h = (fx: number, fy: number) => topAt(below, fx, fy);
          quad('floor', [[x, h(0, 0), y], [x + 1, h(1, 0), y], [x + 1, h(1, 1), y + 1], [x, h(0, 1), y + 1]], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]]);
        }
        if (above && above.bottom <= maxZ && above.bottom > (below?.top ?? DEEP)) {
          const h = above.bottom;
          quad('ceiling', [[x, h, y], [x + 1, h, y], [x + 1, h, y + 1], [x, h, y + 1]], [0, -1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]]);
        }
        if (hi <= Math.max(lo(0.5, 0.5), minZ)) continue;
        for (const [dx, dy] of SIDES) {
          const bx = x + dx;
          const by = y + dy;
          if (hollow(bx, by)) continue;
          // The shared edge's two ends, in this tile's corners (fx, fy).
          const ends: Array<[number, number]> = dx === 1 ? [[1, 0], [1, 1]] : dx === -1 ? [[0, 1], [0, 0]] : dy === 1 ? [[1, 1], [0, 1]] : [[0, 0], [1, 0]];
          for (const s of solids(bx, by)) {
            // The neighbour's corners are on its own opposite edge.
            const bottoms = ends.map(([fx, fy]) => Math.max(lo(fx, fy), s.bottom));
            const tops = ends.map(([fx, fy]) => Math.min(hi, topAt(s, fx - dx, fy - dy)));
            if (tops[0] - bottoms[0] < 1e-4 && tops[1] - bottoms[1] < 1e-4) continue;
            const upper: MeshPart = s.bottom > 0 ? 'ceiling' : s.top >= 1 ? 'wall' : 'floor';
            // Below the floor it is rock; above, a wall, a front or a lintel.
            for (const [part, from, to] of [
              ['rock', -Infinity, 0],
              [upper, 0, Infinity],
            ] as const) {
              const b = bottoms.map((z) => Math.max(z, from));
              const t = tops.map((z, k) => Math.max(b[k], Math.min(z, to)));
              if (t[0] - b[0] < 1e-4 && t[1] - b[1] < 1e-4) continue;
              const back = part === 'wall' ? inset : 0;
              const at = (k: number, z: number) => {
                const [fx, fy] = ends[k];
                return [x + fx + dx * back, z, y + fy + dy * back];
              };
              quad(part, [at(0, b[0]), at(1, b[1]), at(1, t[1]), at(0, t[0])], [-dx, 0, -dy], [[0, 0], [1, 0], [1, 1], [0, 1]]);
            }
          }
        }
      }
    }
  }
  return out;
}
