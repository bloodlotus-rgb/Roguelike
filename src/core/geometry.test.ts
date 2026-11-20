import { describe, expect, it } from 'vitest';
import { generateLevel, isFloor } from './dungeon';
import { castWallRay } from './geometry';

describe('castWallRay', () => {
  const level = generateLevel('estirpe', 1);
  const start = { x: level.start.x + 0.5, y: level.start.y + 0.5 };

  it('stops at the first wall and reports where it leaves that tile', () => {
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const hit = castWallRay(level, start, angle, 30);
      expect(hit.enter).toBeLessThan(30);
      expect(hit.exit).toBeGreaterThan(hit.enter);
      // Just before the hit there is floor; just after it there is wall.
      const before = { x: start.x + Math.cos(angle) * (hit.enter - 0.01), y: start.y + Math.sin(angle) * (hit.enter - 0.01) };
      const after = { x: start.x + Math.cos(angle) * (hit.enter + 0.01), y: start.y + Math.sin(angle) * (hit.enter + 0.01) };
      expect(isFloor(level, Math.floor(before.x), Math.floor(before.y))).toBe(true);
      expect(isFloor(level, Math.floor(after.x), Math.floor(after.y))).toBe(false);
    }
  });

  it('returns the maximum distance when nothing is in the way', () => {
    const hit = castWallRay(level, start, 0, 0.1);
    expect(hit.hit).toBe(false);
    expect(hit.enter).toBe(0.1);
  });
});
