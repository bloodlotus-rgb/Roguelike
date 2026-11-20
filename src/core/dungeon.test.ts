import { describe, expect, it } from 'vitest';
import { floorDistances, generateLevel, isFloor } from './dungeon';

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
});
