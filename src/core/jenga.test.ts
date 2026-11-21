import { describe, expect, it } from 'vitest';
import { assembleZone, distances, Face, opposite, zoneText, type ZoneLayout, type ZoneSpec } from './jenga';

const STEP: Record<number, [number, number, number]> = { 0: [1, 0, 0], 1: [0, 1, 0], 2: [-1, 0, 0], 3: [0, -1, 0], 4: [0, 0, -1], 5: [0, 0, 1] };
const spec = (over: Partial<ZoneSpec> = {}): ZoneSpec => ({ seed: 'estirpe', zone: 0, width: 24, depth: 24, storeys: 4, arrival: [12, 12], exit: true, ...over });
const grid = (l: ZoneLayout) => {
  const { width, depth, storeys } = l.spec;
  return {
    width,
    depth,
    index: (x: number, y: number, z: number) => x + y * width + z * width * depth,
    inside: (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < width && y < depth && z < storeys,
  };
};
const live = (l: ZoneLayout) => l.blocks.filter((b) => l.cells[grid(l).index(b.at[0], b.at[1], b.at[2])] === b.id);

describe('the jenga: a zone from pieces on the grid of cells', () => {
  it('the same seed and zone give the same zone; another zone, another', () => {
    const a = assembleZone(spec());
    const b = assembleZone(spec());
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
    const c = assembleZone(spec({ zone: 1 }));
    expect(Array.from(a.cells)).not.toEqual(Array.from(c.cells));
  });

  it('every piece is joined to the arrival, every opening meets another, every storey is built', () => {
    for (const seed of ['estirpe', 'abc', 'zz', 'mansion']) {
      for (const zone of [0, 3, 7]) {
        const l = assembleZone(spec({ seed, zone }));
        const g = grid(l);
        const dist = distances(l.blocks, l.cells, g, l.arrival);
        const pieces = live(l);
        for (const b of pieces) expect(dist[b.id]).toBeGreaterThanOrEqual(0);
        for (const b of pieces) {
          for (const op of b.openings) {
            const [dx, dy, dz] = STEP[op.face];
            const n = [op.cell[0] + dx, op.cell[1] + dy, op.cell[2] + dz] as const;
            // The hatches of the wells lead out of the zone (up from the arrival, down from the exit).
            if (!g.inside(n[0], n[1], n[2])) {
              expect(op.face === Face.Up || op.face === Face.Down).toBe(true);
              continue;
            }
            const other = l.blocks[l.cells[g.index(n[0], n[1], n[2])]];
            expect(other).toBeDefined();
            expect(other.openings.some((q) => q.cell[0] === n[0] && q.cell[1] === n[1] && q.cell[2] === n[2] && q.face === opposite(op.face))).toBe(true);
          }
        }
        for (let z = 0; z < 4; z++) expect(pieces.some((b) => b.at[2] <= z && z < b.at[2] + b.size[2])).toBe(true);
        // About the density asked for.
        const built = Array.from(l.cells).filter((c) => c >= 0).length;
        expect(built / l.cells.length).toBeGreaterThan(0.25);
        expect(built / l.cells.length).toBeLessThan(0.6);
      }
    }
  });

  it('the way out is on the deepest storey, far from the arrival', () => {
    const l = assembleZone(spec());
    expect(l.exit).not.toBeNull();
    const exit = l.blocks[l.exit!];
    expect(exit.at[2]).toBe(3);
    const dist = distances(l.blocks, l.cells, grid(l), l.arrival);
    const deepest = Math.max(...live(l).filter((b) => b.at[2] + b.size[2] - 1 === 3).map((b) => dist[b.id]));
    expect(dist[exit.id]).toBeGreaterThanOrEqual(deepest - 1);
    // No way out from the deepest zone.
    expect(assembleZone(spec({ exit: false })).exit).toBeNull();
  });

  it('big zones too (the widest area)', () => {
    const t = performance.now();
    const l = assembleZone(spec({ width: 112, depth: 112, arrival: [56, 56] }));
    const ms = performance.now() - t;
    expect(l.exit).not.toBeNull();
    expect(ms).toBeLessThan(5000);
    console.log(`zone 112×112×4: ${live(l).length} pieces in ${ms.toFixed(0)} ms`);
  });

  it('prints a zone (for a look)', () => {
    const l = assembleZone(spec());
    console.log(zoneText(l).map((rows, z) => `storey ${z + 1}\n${rows.join('\n')}`).join('\n\n'));
  });
});
