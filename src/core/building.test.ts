import { describe, expect, it } from 'vitest';
import { BODY, fallHarm, moveBody, settle, type Fall } from './bodies';
import { Building, floorZ, STOREY } from './building';
import { isChasm, type Point } from './dungeon';
import { Surfaces } from './paths';

const building = new Building('ashen-crypt-417', 1);

describe('the building: storeys in one space', () => {
  it('storeys are 6 m apart: a room of storey 2 has its floor 6 below storey 1', () => {
    expect(floorZ(2) - floorZ(1)).toBe(-STOREY);
    const v = building.view(1);
    const lower = building.levelAt(2);
    const r = lower.rooms[3];
    const x = r.x + Math.floor(r.w / 2);
    const y = r.y + Math.floor(r.h / 2);
    // In storey 1's frame, the floor of storey 2 is at -6.
    expect(v.surfaces(x, y)).toContain(-STOREY);
  });

  it('sectors are built when asked for, and kept', () => {
    const b = new Building('ashen-crypt-417', 1);
    expect(b.sectorCount).toBe(0);
    b.band(2, 10, 10);
    expect(b.sectorCount).toBe(1);
    b.band(2, 20, 20);
    expect(b.sectorCount).toBe(1);
    b.view(2);
    expect(b.sectorCount).toBeGreaterThan(12);
  });

  /** Walks a body along a distance field until it gets there or gives up; returns it. */
  function walkTo(depth: number, goal: Point, goalZ: number, start: Point, startZ: number) {
    const v = building.view(depth);
    const level = building.levelAt(depth);
    const s = new Surfaces(v, level);
    const field = s.distancesTo(s.nodeAt(goal, goalZ));
    let pos = { ...start };
    const body: Fall = { z: startZ, vz: 0, from: null };
    let worst = 0;
    for (let i = 0; i < 2000; i++) {
      const dir = s.directionFrom(field, pos, body.z);
      if (!dir) break;
      const l = Math.hypot(dir.x, dir.y) || 1;
      pos = moveBody(v, level, pos, body.z, (dir.x / l) * 0.03, (dir.y / l) * 0.03, 0.3);
      worst = Math.max(worst, settle(v, pos, body, 1 / 60));
    }
    return { pos, z: body.z, worst, reachable: field[s.nodeAt(start, startZ)] > 0 };
  }

  it('the spiral well takes you down a storey, round its newel, without a fall that hurts', () => {
    const level = building.levelAt(1);
    const { down } = level;
    const top = { x: down.top.x + 0.5, y: down.top.y + 0.5 };
    const exit = { x: down.top.x + 4 * down.dir.x + 0.5, y: down.top.y + 4 * down.dir.y + 0.5 };
    const walk = walkTo(1, exit, -STOREY, top, 0);
    expect(walk.reachable).toBe(true);
    expect(Math.floor(walk.pos.x)).toBe(Math.floor(exit.x));
    expect(Math.floor(walk.pos.y)).toBe(Math.floor(exit.y));
    expect(walk.z).toBeCloseTo(-STOREY, 1);
    // At most a hop off the last step onto the floor beside it.
    expect(walk.worst).toBeLessThanOrEqual(BODY.maxDrop);
    expect(fallHarm(walk.worst)).toBe(0);
    // And back up.
    const up = walkTo(1, top, 0, exit, -STOREY);
    expect(up.z).toBeCloseTo(0, 1);
  });

  it('the pit opens into the landing below: a fall of a storey, which hurts', () => {
    const level = building.levelAt(1);
    const v = building.view(1);
    const p = { x: level.pit.x + 0.5, y: level.pit.y + 0.5 };
    expect(v.groundAt(p.x, p.y, 0)).toBeCloseTo(-STOREY);
    const body: Fall = { z: 0, vz: 0, from: null };
    let fell = 0;
    for (let t = 0; t < 3 && !fell; t += 1 / 60) fell = settle(v, p, body, 1 / 60);
    expect(fell).toBeCloseTo(STOREY);
    expect(fallHarm(fell)).toBeGreaterThan(0);
  });

  it('a chasm is a crack: it goes down through rock, and opens into a room or ends far below', () => {
    for (let depth = 1; depth <= 6; depth++) {
      const level = building.levelAt(depth);
      const v = building.view(depth);
      for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
          if (!isChasm(level, x, y)) continue;
          const g = v.groundAt(x + 0.5, y + 0.5, 0);
          // Nothing to stand on within a storey's fall.
          if (g !== null) expect(g).toBeLessThan(-STOREY + 0.5);
        }
      }
    }
    expect(BODY.maxDrop).toBeLessThan(STOREY);
  });
});
