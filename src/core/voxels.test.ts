import { describe, expect, it } from 'vitest';
import { generateLevel, Ground, groundAt, groundHeight, isChasm, isDeep, isFloor, isShallow, LEVEL_HEIGHT, onSteps } from './dungeon';
import { ceilingHeights, CLEARANCE, DEEP_WATER, levelVoxels, Material, Voxels } from './voxels';

describe('voxels: columns of spans', () => {
  it('answers what is solid, where one stands and what is overhead', () => {
    const v = new Voxels(3, 1);
    // A floor, a slab above it like a balcony, and the rock of the ceiling.
    v.set(1, 0, [
      { bottom: -30, top: 0, mat: Material.Rock },
      { bottom: 2.6, top: 2.9, mat: Material.Stone },
      { bottom: 5.5, top: 40, mat: Material.Rock },
    ]);
    expect(v.solidAt(1.5, 0.5, -0.1)).toBe(true);
    expect(v.solidAt(1.5, 0.5, 1)).toBe(false);
    expect(v.solidAt(1.5, 0.5, 2.7)).toBe(true);
    // Two surfaces in one tile: the floor and the slab.
    expect(v.surfaces(1, 0)).toEqual([0, 2.9]);
    expect(v.floorBelow(1, 0, 1)).toBe(0);
    expect(v.floorBelow(1, 0, 3.2)).toBe(2.9);
    expect(v.ceilingAbove(1, 0, 0)).toBe(2.6);
    expect(v.ceilingAbove(1, 0, 3)).toBe(5.5);
    // Outside the grid, and untouched columns, are rock.
    expect(v.solidAt(-1, 0, 1)).toBe(true);
    expect(v.surfaces(0, 0)).toEqual([]);
  });

  it('a slab with too little room above is not a place to stand', () => {
    const v = new Voxels(1, 1);
    v.set(0, 0, [
      { bottom: -30, top: 0, mat: Material.Rock },
      { bottom: CLEARANCE - 0.2, top: 40, mat: Material.Rock },
    ]);
    expect(v.surfaces(0, 0)).toEqual([]);
  });
});

describe('voxels of a level', () => {
  const level = generateLevel('voxels', 2);
  const v = levelVoxels(level);
  const ceilings = ceilingHeights(level);

  it('rock where there is wall, and on open floor the ground with the ceiling of its space above', () => {
    let floors = 0;
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const i = y * level.width + x;
        if (!ceilings[i]) {
          expect(v.solidAt(x + 0.5, y + 0.5, 1)).toBe(true);
          continue;
        }
        if (!isFloor(level, x, y) || onSteps(level.down, { x: x + 0.5, y: y + 0.5 }) || onSteps(level.up, { x: x + 0.5, y: y + 0.5 })) continue;
        if (x === level.pit.x && y === level.pit.y) continue;
        floors++;
        const ground = groundAt(level, x, y) === Ground.Ramp ? groundHeight(level, { x: x + 0.5, y: y + 0.5 }) : groundHeight(level, { x: x + 0.5, y: y + 0.5 });
        expect(v.floorBelow(x, y, ground + 0.1)).toBeCloseTo(ground, 5);
        expect(v.ceilingAbove(x, y, ground)).toBeCloseTo(ceilings[i], 5);
        if (isShallow(level, x, y)) expect(v.waterAt(x, y)).toBeGreaterThan(ground);
      }
    }
    expect(floors).toBeGreaterThan(1000);
  });

  it('chasms have no floor; deep water has its floor well under the surface', () => {
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (isChasm(level, x, y)) expect(v.surfaces(x, y)).toEqual([]);
        if (isDeep(level, x, y)) {
          expect(v.waterAt(x, y)).toBeCloseTo(DEEP_WATER.surface);
          expect(v.floorBelow(x, y, 0)).toBeLessThan(DEEP_WATER.surface - 0.5);
        }
      }
    }
  });

  it('the stairs down go down a storey, the stairs up rise a storey into the level above', () => {
    const bottomDown = level.down.steps[2];
    const topUp = level.up.steps[0];
    expect(v.floorBelow(bottomDown.x, bottomDown.y, 0.5)).toBeLessThan(-LEVEL_HEIGHT / 2);
    expect(v.floorBelow(topUp.x, topUp.y, LEVEL_HEIGHT + 0.5)).toBeGreaterThan(LEVEL_HEIGHT / 2);
    // Nothing overhead on the steps up: they rise into the level above.
    expect(v.ceilingAbove(topUp.x, topUp.y, LEVEL_HEIGHT)).toBeGreaterThan(30);
    // The pit opens onto the level below.
    expect(v.floorBelow(level.pit.x, level.pit.y, 0)).toBe(-LEVEL_HEIGHT);
  });
});
