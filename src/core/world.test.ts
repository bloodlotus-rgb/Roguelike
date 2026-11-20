import { describe, expect, it } from 'vitest';
import { isFloor } from './dungeon';
import { World } from './world';

describe('World', () => {
  it('reveals the tiles around the start', () => {
    const world = new World('estirpe');
    const events = world.update(0.016, { x: 0, y: 0 });
    const revealed = events.find((e) => e.type === 'revealed');
    expect(revealed).toBeDefined();
    const start = world.level.start;
    expect(world.explored[start.y * world.level.width + start.x]).toBe(1);
  });

  it('never walks through walls', () => {
    const world = new World('estirpe');
    for (let i = 0; i < 2000; i++) {
      world.update(0.05, { x: Math.cos(i / 50), y: Math.sin(i / 37) });
      world.survival = { health: 100, hunger: 100, thirst: 100, light: 100 };
      expect(isFloor(world.level, Math.floor(world.player.x), Math.floor(world.player.y))).toBe(true);
    }
  });

  it('dies when hunger and thirst run out', () => {
    const world = new World('estirpe');
    world.survival = { health: 5, hunger: 0, thirst: 0, light: 50 };
    const events = world.update(1, { x: 0, y: 0 });
    expect(events.some((e) => e.type === 'died')).toBe(true);
    expect(world.dead).toBe(true);
  });

  it('keeps the meters when going down', () => {
    const world = new World('estirpe');
    world.survival = { health: 70, hunger: 40, thirst: 30, light: 20 };
    world.descend();
    expect(world.depth).toBe(2);
    expect(world.survival).toEqual({ health: 70, hunger: 40, thirst: 30, light: 20 });
  });
});
