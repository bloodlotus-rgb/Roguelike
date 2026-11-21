import { describe, expect, it } from 'vitest';
import { generateLevel, isChasm, isFloor, TERRACE_HEIGHT } from '../core/dungeon';
import { DEEP, HIGH, levelVoxels, Material, Voxels } from '../core/voxels';
import { meshVoxels, type MeshBuffers } from './voxelMesh';

const floorAt = (top: number) => ({ bottom: DEEP, top, mat: Material.Rock });
const roofAt = (bottom: number) => ({ bottom, top: HIGH, mat: Material.Rock });

/** The vertical extent of every quad of a part: [lowest, highest] corner. */
function heights(b: MeshBuffers): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let q = 0; q < b.quads; q++) {
    const ys = [0, 1, 2, 3].map((k) => b.positions[(q * 4 + k) * 3 + 1]);
    out.push([Math.min(...ys), Math.max(...ys)]);
  }
  return out;
}

/** Each quad's normal must agree with the winding of its first triangle. */
function wound(b: MeshBuffers): boolean {
  for (let q = 0; q < b.quads; q++) {
    const p = (k: number) => [0, 1, 2].map((a) => b.positions[b.indices[q * 6 + k] * 3 + a]);
    const [a, c, d] = [p(0), p(1), p(2)];
    const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const normal = [0, 1, 2].map((a) => b.normals[b.indices[q * 6] * 3 + a]);
    const dot = n[0] * normal[0] + n[1] * normal[1] + n[2] * normal[2];
    if (Math.hypot(...n) > 1e-6 && dot <= 0) return false;
  }
  return true;
}

describe('voxel mesher', () => {
  it('a room between walls: floor, walls up to the ceiling, ceiling, and lintels to a lower passage', () => {
    // Row: wall | room (ceiling 4) | passage (ceiling 3) | wall.
    const v = new Voxels(4, 1);
    v.set(1, 0, [floorAt(0), roofAt(4)]);
    v.set(2, 0, [floorAt(0), roofAt(3)]);
    const m = meshVoxels(v, { maxZ: 6, minZ: -6 });
    expect(m.floor.quads).toBe(2);
    expect(m.ceiling.quads).toBe(2 + 1);
    // The lintel: from the passage's ceiling up to the room's, facing the room.
    const lintels = heights(m.ceiling).filter(([a, b]) => b > a);
    expect(lintels).toEqual([[3, 4]]);
    // Walls: the outer ends of the row (two), plus the grid's edges all round (rock outside).
    const walls = heights(m.wall);
    expect(walls).toContainEqual([0, 4]);
    expect(walls).toContainEqual([0, 3]);
    expect(m.rock.quads).toBe(0);
    for (const part of [m.floor, m.wall, m.ceiling]) expect(wound(part)).toBe(true);
  });

  it('cut low from above: walls end at the cut, with caps beside the open tiles', () => {
    const v = new Voxels(3, 3);
    v.set(1, 1, [floorAt(0), roofAt(4)]);
    const m = meshVoxels(v, { maxZ: 1.6, minZ: -6 });
    expect(m.ceiling.quads).toBe(0);
    expect(heights(m.wall).every(([a, b]) => a === 0 && b === 1.6)).toBe(true);
    expect(m.wall.quads).toBe(4);
    // The eight tiles round the open one.
    expect(m.cap.quads).toBe(8);
  });

  it('terraces have fronts, ramps slope, chasms go down into rock', () => {
    const v = new Voxels(4, 1);
    v.set(0, 0, [floorAt(0), roofAt(4)]);
    v.set(1, 0, [{ ...floorAt(TERRACE_HEIGHT / 2), slope: [0, TERRACE_HEIGHT, TERRACE_HEIGHT, 0] }, roofAt(4)]);
    v.set(2, 0, [floorAt(TERRACE_HEIGHT), roofAt(4)]);
    v.set(3, 0, [roofAt(4)]);
    const m = meshVoxels(v, { maxZ: 6, minZ: -6 });
    // The ramp's floor rises from 0 to the terrace.
    expect(heights(m.floor)).toContainEqual([0, TERRACE_HEIGHT]);
    // Its sides, facing out of the grid (rock) are walls; fronts face the low floor: the
    // terrace drops into the chasm, through the floor and on down as rock.
    const rocks = heights(m.rock);
    expect(rocks).toContainEqual([-6, 0]);
    const fronts = heights(m.floor).filter(([a, b]) => a === 0 && b === TERRACE_HEIGHT);
    expect(fronts.length).toBeGreaterThanOrEqual(2);
    expect(wound(m.floor) && wound(m.rock)).toBe(true);
  });

  it('wall faces sit back behind their bricks', () => {
    const v = new Voxels(2, 1);
    v.set(0, 0, [floorAt(0), roofAt(3)]);
    const m = meshVoxels(v, { maxZ: 6, minZ: -6, inset: 0.07 });
    // The face toward the wall at x = 1 is at x = 1.07.
    const xs = new Set<number>();
    for (let q = 0; q < m.wall.quads; q++) if (m.wall.normals[q * 12] === -1) xs.add(m.wall.positions[q * 12]);
    expect([...xs]).toEqual([1.07]);
  });

  it('a level: one floor quad per dry ground tile, walls where floor meets rock, rock in the chasms', () => {
    const level = generateLevel('mesher', 3);
    const v = levelVoxels(level);
    const m = meshVoxels(v, { maxZ: 6, minZ: -6, inset: 0.07, floorMin: -0.5 });
    let floors = 0;
    let chasms = 0;
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (isChasm(level, x, y)) chasms++;
        if (!isFloor(level, x, y) || (x === level.pit.x && y === level.pit.y)) continue;
        const base = v.column(x, y)[0];
        // Bridges are planks drawn as models; the lower steps down are under the floor.
        if (base.mat === Material.Wood || base.top < -0.5) continue;
        floors++;
      }
    }
    let up = 0;
    for (let q = 0; q < m.floor.quads; q++) if (m.floor.normals[q * 12 + 1] === 1) up++;
    expect(up).toBe(floors);
    expect(m.wall.quads).toBeGreaterThan(1000);
    if (chasms > 0) expect(m.rock.quads).toBeGreaterThan(0);
    for (const part of Object.values(m)) expect(wound(part)).toBe(true);
  });
});
