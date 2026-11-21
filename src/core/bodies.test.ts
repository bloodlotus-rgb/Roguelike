import { describe, expect, it } from 'vitest';
import { BODY, bodyBlocked, fallHarm, moveBody, settle, type Fall } from './bodies';
import type { Level } from './dungeon';
import { DEEP, HIGH, Material, Voxels, type Span } from './voxels';

/** A row of tiles, all open floor as far as the level goes; the voxels say the rest. */
function row(columns: Span[][]): { v: Voxels; level: Level } {
  const v = new Voxels(columns.length, 3);
  columns.forEach((c, x) => v.set(x, 1, c));
  const level = { width: columns.length, height: 3, tiles: new Uint8Array(columns.length * 3).fill(1) } as unknown as Level;
  return { v, level };
}
const ground = (top: number, slope?: Span['slope']): Span => ({ bottom: DEEP, top, mat: Material.Rock, slope });
const roof = (bottom = 5): Span => ({ bottom, top: HIGH, mat: Material.Rock });

/** Walks a body along +x for `seconds`, settling as it goes; returns it and the worst fall. */
function walk(v: Voxels, level: Level, x: number, z: number, seconds: number, speed = 2): { x: number; body: Fall; fell: number } {
  let pos = { x, y: 1.5 };
  const body: Fall = { z, vz: 0, from: null };
  let fell = 0;
  for (let t = 0; t < seconds; t += 1 / 60) {
    pos = moveBody(v, level, pos, body.z, speed / 60, 0, 0.3, body.from !== null);
    fell = Math.max(fell, settle(v, pos, body, 1 / 60));
  }
  return { x: pos.x, body, fell };
}

describe('bodies in the voxels', () => {
  it('walk up a slope of steps, and down it again', () => {
    // A flight rising 0.8 a tile, then a landing.
    const { v, level } = row([
      [ground(0), roof()],
      [ground(0.4, [0, 0.8, 0.8, 0]), roof()],
      [ground(1.2, [0.8, 1.6, 1.6, 0.8]), roof()],
      [ground(1.6), roof()],
      [ground(1.6), roof()],
    ]);
    const up = walk(v, level, 0.5, 0, 3);
    expect(up.x).toBeGreaterThan(4);
    expect(up.body.z).toBeCloseTo(1.6);
    const down = walk(v, level, 4.5, 1.6, 3, -2);
    expect(down.x).toBeLessThan(1);
    expect(down.body.z).toBeCloseTo(0);
    expect(down.fell).toBe(0);
  });

  it('a terrace is a wall from below, and hopped down from above without harm', () => {
    const { v, level } = row([[ground(0), roof()], [ground(0), roof()], [ground(0.7), roof()], [ground(0.7), roof()]]);
    const blocked = walk(v, level, 0.5, 0, 2);
    expect(blocked.x).toBeLessThan(2);
    const hop = walk(v, level, 3.5, 0.7, 2, -2);
    expect(hop.x).toBeLessThan(1);
    expect(hop.body.z).toBe(0);
    expect(fallHarm(hop.fell)).toBe(0);
  });

  it('nobody walks off the edge of a drop or into a chasm, nor under a low ceiling', () => {
    const drop = row([[ground(0), roof()], [ground(0), roof()], [ground(-2), roof()]]);
    expect(walk(drop.v, drop.level, 0.5, 0, 2).x).toBeLessThan(2);
    const chasm = row([[ground(0), roof()], [ground(0), roof()], [roof()]]);
    expect(walk(chasm.v, chasm.level, 0.5, 0, 2).x).toBeLessThan(2);
    const low = row([[ground(0), roof()], [ground(0), roof()], [ground(0), roof(1.2)]]);
    expect(walk(low.v, low.level, 0.5, 0, 2).x).toBeLessThan(2);
    expect(bodyBlocked(low.v, low.level, { x: 2.5, y: 1.5 }, 0, 0.3)).toBe(true);
  });

  it('a high fall hurts, one out of the level is the end', () => {
    // Pushed off a ledge 6 high (moving as if already in the air).
    const { v } = row([[ground(6), roof(9)], [ground(0), roof(9)]]);
    const body: Fall = { z: 6, vz: 0, from: null };
    const pos = { x: 1.5, y: 1.5 };
    let fell = 0;
    for (let t = 0; t < 2; t += 1 / 60) fell = Math.max(fell, settle(v, pos, body, 1 / 60));
    expect(fell).toBeCloseTo(6);
    expect(fallHarm(fell)).toBe(Math.round((6 - BODY.safeFall) * BODY.fallDamage));
    const abyss = row([[ground(0), roof()], [roof()]]);
    const lost: Fall = { z: 0, vz: 0, from: null };
    let end = 0;
    for (let t = 0; t < 3 && end === 0; t += 1 / 60) end = settle(abyss.v, { x: 1.5, y: 1.5 }, lost, 1 / 60);
    expect(end).toBe(Infinity);
  });

  it('a slab overhead is a second floor: walking under it, standing on it', () => {
    const slab: Span = { bottom: 2.6, top: 2.9, mat: Material.Stone };
    const { v, level } = row([[ground(0), roof(6)], [ground(0), slab, roof(6)], [ground(0), roof(6)]]);
    expect(walk(v, level, 0.5, 0, 2).x).toBeGreaterThan(2);
    const body: Fall = { z: 2.9, vz: 0, from: null };
    settle(v, { x: 1.5, y: 1.5 }, body, 1 / 60);
    expect(body.z).toBeCloseTo(2.9);
  });

  it('set down inside the ground (moved by hand), a body stands on top of it', () => {
    const { v } = row([[ground(0), roof()], [ground(1.2, [0.8, 1.6, 1.6, 0.8]), roof()]]);
    const body: Fall = { z: 0, vz: 0, from: null };
    settle(v, { x: 1.5, y: 1.5 }, body, 1 / 60);
    expect(body.z).toBeCloseTo(1.2);
    expect(body.from).toBeNull();
  });
});
