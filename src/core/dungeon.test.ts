import { describe, expect, it } from 'vitest';
import { canStep, floorDistances, generateLevel, Ground, isChasm, isDeep, isFloor, isVoid, Water, waterAt } from './dungeon';

const seeds = ['estirpe', 'tainted', 'abc', '12345', 'mansion'];

describe('generateLevel', () => {
  it('is deterministic for the same seed and depth', () => {
    const a = generateLevel('estirpe', 3);
    const b = generateLevel('estirpe', 3);
    expect(a.tiles).toEqual(b.tiles);
    expect(a.items).toEqual(b.items);
    expect(a.stairs).toEqual(b.stairs);
  });

  it('changes between depths', () => {
    expect(generateLevel('estirpe', 1).tiles).not.toEqual(generateLevel('estirpe', 2).tiles);
  });

  it('keeps the layout but re-rolls the items with another roll', () => {
    const a = generateLevel('estirpe', 1, 0);
    const b = generateLevel('estirpe', 1, 1);
    expect(a.tiles).toEqual(b.tiles);
    expect(a.items).not.toEqual(b.items);
  });

  for (const seed of seeds) {
    for (const depth of [1, 2, 7]) {
      it(`connects every floor tile, the stairs and the items (${seed}, depth ${depth})`, () => {
        const level = generateLevel(seed, depth);
        expect(level.rooms.length).toBeGreaterThanOrEqual(5);
        const dist = floorDistances(level, level.start);
        for (let i = 0; i < level.tiles.length; i++) {
          if (level.tiles[i] === 1) expect(dist[i]).toBeGreaterThanOrEqual(0);
        }
        expect(dist[level.stairs.y * level.width + level.stairs.x]).toBeGreaterThan(0);
        for (const item of level.items) expect(isFloor(level, item.x, item.y)).toBe(true);
      });
    }
  }

  it('keeps the outer border solid', () => {
    const level = generateLevel('estirpe', 1);
    for (let x = 0; x < level.width; x++) {
      expect(isFloor(level, x, 0)).toBe(false);
      expect(isFloor(level, x, level.height - 1)).toBe(false);
    }
    for (let y = 0; y < level.height; y++) {
      expect(isFloor(level, 0, y)).toBe(false);
      expect(isFloor(level, level.width - 1, y)).toBe(false);
    }
  });

  for (const seed of seeds) {
    it(`stacks the levels: stairs and pits line up with the level below (${seed})`, () => {
      for (let depth = 1; depth <= 6; depth++) {
        const level = generateLevel(seed, depth);
        const below = generateLevel(seed, depth + 1);
        expect(below.up).toEqual(level.down);
        expect(below.landing).toEqual(level.pit);
        // The stairs down: entrance open above, steps open on both levels, the bottom open below.
        expect(isFloor(level, level.down.top.x, level.down.top.y)).toBe(true);
        expect(isFloor(level, level.down.bottom.x, level.down.bottom.y)).toBe(false);
        for (const step of level.down.steps) {
          expect(isFloor(level, step.x, step.y)).toBe(true);
          expect(isFloor(below, step.x, step.y)).toBe(true);
        }
        expect(isFloor(below, level.down.top.x, level.down.top.y)).toBe(false);
        expect(isFloor(below, level.down.bottom.x, level.down.bottom.y)).toBe(true);
        // The rope from the pit comes down onto floor.
        expect(isFloor(below, level.pit.x, level.pit.y)).toBe(true);
        // From the arrival you can walk to the stairs down and the pit.
        const dist = floorDistances(level, level.start);
        expect(dist[level.down.top.y * level.width + level.down.top.x]).toBeGreaterThan(0);
        expect(dist[level.pit.y * level.width + level.pit.x]).toBeGreaterThan(0);
      }
    });
  }

  it('galleries open over a hall of the level below, and their walkway stays connected', () => {
    let found = 0;
    for (const seed of seeds) {
      for (let depth = 1; depth <= 6; depth++) {
        const level = generateLevel(seed, depth);
        const g = level.gallery;
        if (!g) continue;
        found++;
        const below = generateLevel(seed, depth + 1);
        // The middle is open air; the hall below is floor right under it.
        for (let y = g.y + 1; y < g.y + g.h - 1; y++) {
          for (let x = g.x + 1; x < g.x + g.w - 1; x++) {
            expect(isVoid(level, x, y)).toBe(true);
            expect(isFloor(below, x, y)).toBe(true);
          }
        }
        // Every floor tile of the level is still reachable.
        const dist = floorDistances(level, level.start);
        for (let i = 0; i < level.tiles.length; i++) if (level.tiles[i] === 1) expect(dist[i]).toBeGreaterThanOrEqual(0);
      }
    }
    expect(found).toBeGreaterThan(3);
  });

  it('terraces: up only by a ramp, down anywhere, and everything still reachable', () => {
    let terraces = 0;
    for (const seed of seeds) {
      for (let depth = 1; depth <= 5; depth++) {
        const level = generateLevel(seed, depth);
        const high = [...(level.ground ?? [])].filter((g) => g === Ground.High).length;
        if (high > 0) terraces++;
        // Walking forward from the arrival, every floor tile and every item can be reached.
        const { width } = level;
        const seen = new Uint8Array(level.tiles.length);
        const queue = [level.start.y * width + level.start.x];
        seen[queue[0]] = 1;
        for (let h = 0; h < queue.length; h++) {
          const x = queue[h] % width;
          const y = Math.floor(queue[h] / width);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            const i = ny * width + nx;
            if (seen[i] || !isFloor(level, nx, ny) || !canStep(level, x, y, nx, ny)) continue;
            seen[i] = 1;
            queue.push(i);
          }
        }
        for (let i = 0; i < level.tiles.length; i++) if (level.tiles[i] === 1) expect(seen[i]).toBe(1);
        for (const item of level.items) expect(seen[item.y * width + item.x]).toBe(1);
      }
    }
    expect(terraces).toBeGreaterThan(2);
  });

  it('chasms cut rooms wall to wall; passages never run into one; bridges are floor', () => {
    let chasms = 0;
    let bridges = 0;
    for (const seed of seeds) {
      for (let depth = 1; depth <= 6; depth++) {
        const level = generateLevel(seed, depth);
        const inRoom = (x: number, y: number) => level.rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
        let here = false;
        for (let y = 0; y < level.height; y++) {
          for (let x = 0; x < level.width; x++) {
            if (!isChasm(level, x, y)) continue;
            here = true;
            expect(inRoom(x, y)).toBe(true);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              if (isFloor(level, x + dx, y + dy)) expect(inRoom(x + dx, y + dy)).toBe(true);
            }
          }
        }
        if (here) chasms++;
        for (const tile of level.bridges) {
          expect(level.tiles[tile]).toBe(1);
          bridges++;
        }
      }
    }
    expect(chasms).toBeGreaterThan(2);
    expect(bridges).toBeGreaterThan(0);
  });

  it('pools: shallow rims around deep middles, puddles under drips, nothing left lying in water', () => {
    let deep = 0;
    let shallow = 0;
    for (const seed of seeds) {
      for (let depth = 1; depth <= 6; depth++) {
        const level = generateLevel(seed, depth);
        for (let y = 0; y < level.height; y++) {
          for (let x = 0; x < level.width; x++) {
            const w = waterAt(level, x, y);
            if (isDeep(level, x, y)) {
              deep++;
              expect(w).toBe(Water.Deep);
            } else if (w === Water.Shallow) {
              shallow++;
              expect(isFloor(level, x, y)).toBe(true);
            }
          }
        }
        for (const f of level.features) if (f.kind === 'drip') expect(waterAt(level, f.x, f.y)).toBe(Water.Shallow);
        for (const f of level.features) if (f.kind !== 'drip') expect(waterAt(level, f.x, f.y)).toBe(Water.None);
      }
    }
    expect(deep).toBeGreaterThan(0);
    expect(shallow).toBeGreaterThan(deep);
  });

  it('rivers cross the level with fords, and nothing is cut off', () => {
    let rivers = 0;
    for (const seed of seeds) {
      for (let depth = 1; depth <= 6; depth++) {
        const level = generateLevel(seed, depth);
        if (!level.river) continue;
        rivers++;
        // Somewhere along it the water is shallow all the way across: a ford.
        const fords = level.river.filter((p) => !isDeep(level, p.x, p.y));
        expect(fords.length).toBeGreaterThan(0);
        const dist = floorDistances(level, level.start);
        for (let i = 0; i < level.tiles.length; i++) if (level.tiles[i] === 1) expect(dist[i]).not.toBe(-1);
      }
    }
    expect(rivers).toBeGreaterThan(2);
  });
});
