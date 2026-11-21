import { describe, expect, it } from 'vitest';
import type { Level } from './dungeon';
import { clearSight, Surfaces, visibleTiles3D } from './paths';
import { DEEP, HIGH, Material, Voxels, type Span } from './voxels';

const ground = (top: number, slope?: Span['slope']): Span => ({ bottom: DEEP, top, mat: Material.Rock, slope });
const roof = (bottom = 5): Span => ({ bottom, top: HIGH, mat: Material.Rock });
const rock: Span = { bottom: DEEP, top: HIGH, mat: Material.Rock };

/** A level from rows of columns; the tiles all floor (the voxels say what is what). */
function grid(rows: Span[][][]): { v: Voxels; level: Level } {
  const h = rows.length;
  const w = rows[0].length;
  const v = new Voxels(w, h);
  rows.forEach((r, y) => r.forEach((c, x) => v.set(x, y, c)));
  const level = { width: w, height: h, tiles: new Uint8Array(w * h).fill(1) } as unknown as Level;
  return { v, level };
}

describe('ways over the surfaces', () => {
  const floor = [ground(0), roof()];
  const terrace = [ground(0.7), roof()];
  const ramp = [ground(0.35, [0, 0.7, 0.7, 0]), roof()];

  it('a terrace is reached by its ramp, not up its face; but its top steps down to its foot', () => {
    // Row 0: floor, floor, terrace, terrace. Row 1: floor, ramp, terrace, terrace.
    const { v, level } = grid([
      [floor, floor, terrace, terrace],
      [floor, ramp, terrace, terrace],
    ]);
    const s = new Surfaces(v, level);
    const toTop = s.distancesTo(3);
    // From (1,0), right under the terrace's face, the way goes round by the ramp.
    expect(toTop[1]).toBe(4);
    const toFoot = s.distancesTo(1);
    // From the top it hops straight down.
    expect(toFoot[2]).toBe(1);
    // The direction from (1,0) toward the top: down to the ramp, not into the face.
    const dir = s.directionFrom(toTop, { x: 1.5, y: 0.5 }, 0)!;
    expect(dir.y).toBeGreaterThan(0.5);
    expect(Math.abs(dir.x)).toBeLessThan(0.01);
  });

  it('a balcony is a second surface: a way above the way below', () => {
    const slab: Span = { bottom: 2.6, top: 2.9, mat: Material.Stone };
    const under = [ground(0), slab, roof(6)];
    const up = [ground(2.9), roof(6)];
    const low = [ground(0), roof(6)];
    const { v, level } = grid([[low, under, under, up]]);
    const s = new Surfaces(v, level);
    expect(s.nodesOf(1)).toHaveLength(2);
    // Below the balcony one walks on the floor; on it, from the high ground at its end.
    const upper = s.nodesOf(1)[1];
    expect(s.nodeAt({ x: 1.5, y: 0.5 }, 2.9)).toBe(upper);
    expect(s.nodeAt({ x: 1.5, y: 0.5 }, 0)).toBe(1);
    const toHigh = s.distancesTo(3);
    expect(toHigh[upper]).toBe(2);
    // The floor under it does not lead up (no stairs): it is cut off from the high ground.
    expect(toHigh[0]).toBe(-1);
  });
});

describe('sight through the voxels', () => {
  const floor = [ground(0), roof()];

  it('a wall blocks, a low terrace does not, a shut door does', () => {
    const { v, level } = grid([[floor, floor, [rock], floor, floor], [floor, floor, [ground(0.7), roof()], floor, floor]]);
    expect(clearSight(v, level, { x: 0.5, y: 0.5 }, 1.5, { x: 4.5, y: 0.5 }, 1)).toBe(false);
    expect(clearSight(v, level, { x: 0.5, y: 1.5 }, 1.5, { x: 4.5, y: 1.5 }, 1)).toBe(true);
    level.closed = new Set([1 * 5 + 2]);
    expect(clearSight(v, level, { x: 0.5, y: 1.5 }, 1.5, { x: 4.5, y: 1.5 }, 1)).toBe(false);
  });

  it('from a balcony one sees the hall below, past the edge', () => {
    // A ledge 3 high over a hall: looking down from its edge.
    const ledge = [ground(3), roof(8)];
    const hall = [ground(0), roof(8)];
    const { v, level } = grid([[ledge, ledge, hall, hall, hall, hall]]);
    const seen = new Set(visibleTiles3D(v, level, { x: 1.7, y: 0.5 }, 4.5, 3, 8));
    for (const x of [2, 3, 4, 5]) expect(seen.has(x)).toBe(true);
    // From the hall, the ledge's top is out of sight right under it, but its face is seen.
    const below = new Set(visibleTiles3D(v, level, { x: 2.5, y: 0.5 }, 1.5, 0, 8));
    expect(below.has(1)).toBe(true);
  });
});
