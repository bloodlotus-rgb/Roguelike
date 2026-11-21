/**
 * Bodies in the voxels (V3): the hero and the horrors have a height and stand on a surface.
 * They walk up low steps (stairs and ramps are slopes of stone), are stopped by anything
 * solid between their knees and their head, will not walk off a drop higher than a jump
 * down, and fall when there is nothing underfoot, hurt if the fall was high.
 *
 * Positions stay in level units (x, y) with the height apart (z), so the rest of the game
 * keeps its points. Pure logic.
 */
import { isDeep, type Level, type Point } from './dungeon';
import { CLEARANCE, Material, topAt, type Voxels } from './voxels';

export const BODY = {
  /** The highest step one walks up without noticing. */
  step: 0.45,
  /** How tall a body is: it fits under anything higher. */
  height: CLEARANCE,
  /** Walking stops at the edge of a higher drop (a terrace is hopped down; a chasm is not). */
  maxDrop: 1.0,
  /** Metres per second squared, a little strong so short drops feel quick. */
  gravity: 20,
  /** Falls up to this height do no harm. */
  safeFall: 2.5,
  /** Health lost per metre fallen past the safe height. */
  fallDamage: 12,
  /** Below this a body has fallen out of the level (a chasm): it is lost. */
  abyss: -12,
} as const;

/** What a body standing at z can do with a tile it touches. */
function tileBlocks(v: Voxels, level: Level, tx: number, ty: number, px: number, py: number, z: number, airborne: boolean): boolean {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return true;
  const i = ty * level.width + tx;
  // What is not in the voxels: shut doors, rubble, furniture; deep water is not swum (yet).
  if (level.closed?.has(i) || level.blocked?.[i] || isDeep(level, tx, ty)) return true;
  const fx = px - tx;
  const fy = py - ty;
  const col = v.column(tx, ty);
  // Anything solid between the knees and the head is a wall (a terrace from below too).
  for (const s of col) {
    if (s.mat === Material.Water) continue;
    if (topAt(s, fx, fy) > z + BODY.step && s.bottom < z + BODY.height) return true;
  }
  if (airborne) return false;
  // Something to stand on, not too far down.
  const ground = v.groundAt(px, py, z, BODY.step);
  return ground === null || z - ground > BODY.maxDrop;
}

function collides(v: Voxels, level: Level, cx: number, cy: number, z: number, radius: number, airborne: boolean): boolean {
  const minX = Math.floor(cx - radius);
  const maxX = Math.floor(cx + radius);
  const minY = Math.floor(cy - radius);
  const maxY = Math.floor(cy + radius);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      // The point of the tile nearest the body's centre: that is where it would step in.
      const px = Math.max(tx, Math.min(cx, tx + 1 - 1e-6));
      const py = Math.max(ty, Math.min(cy, ty + 1 - 1e-6));
      if ((px - cx) ** 2 + (py - cy) ** 2 >= radius * radius) continue;
      if (tileBlocks(v, level, tx, ty, px, py, z, airborne)) return true;
    }
  }
  return false;
}

/**
 * Moves a body of `radius` by dx, dy at height z, sliding along whatever stops it. Airborne
 * (a leap) it needs no ground underfoot. Returns the new position; the height follows with
 * `settle`.
 */
export function moveBody(v: Voxels, level: Level, pos: Point, z: number, dx: number, dy: number, radius: number, airborne = false): Point {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (radius * 0.9)));
  let x = pos.x;
  let y = pos.y;
  let h = z;
  for (let i = 0; i < steps; i++) {
    const nx = x + dx / steps;
    if (!collides(v, level, nx, y, h, radius, airborne)) x = nx;
    const ny = y + dy / steps;
    if (!collides(v, level, x, ny, h, radius, airborne)) y = ny;
    // Up the slope as it goes, so a long step up a flight is taken in small ones.
    if (!airborne) {
      const g = v.groundAt(x, y, h, BODY.step);
      if (g !== null && g > h) h = g;
    }
  }
  return { x, y };
}

/** Whether a body at this spot overlaps anything that stops it. */
export function bodyBlocked(v: Voxels, level: Level, p: Point, z: number, radius: number): boolean {
  return collides(v, level, p.x, p.y, z, radius, false);
}

/** The height a body stands at, there (the highest surface at or under `from`). */
export function standingHeight(v: Voxels, p: Point, from: number): number {
  return v.groundAt(p.x, p.y, from, BODY.step) ?? from;
}

export interface Fall {
  z: number;
  /** Vertical speed (negative is down). */
  vz: number;
  /** Where the fall began, while falling. */
  from: number | null;
}

/**
 * The height after a moment: on the ground it follows the ground (up steps, down slopes);
 * with nothing close underfoot it falls. Returns how far it fell when it lands (0 if it
 * did not), or Infinity if it fell out of the level.
 */
export function settle(v: Voxels, p: Point, body: Fall, dt: number): number {
  // Set down inside something solid (moved there by hand): it stands on top of it.
  if (v.solidAt(p.x, p.y, body.z + 0.01)) {
    const up = v.groundAt(p.x, p.y, body.z, BODY.height + 2);
    if (up !== null && up > body.z) {
      body.z = up;
      body.vz = 0;
      body.from = null;
      return 0;
    }
  }
  const ground = v.groundAt(p.x, p.y, body.z, BODY.step);
  if (body.from === null && ground !== null && body.z - ground <= BODY.step) {
    body.z = ground;
    body.vz = 0;
    return 0;
  }
  if (body.from === null) body.from = body.z;
  body.vz -= BODY.gravity * dt;
  body.z += body.vz * dt;
  if (ground !== null && body.z <= ground) {
    const fell = body.from - ground;
    body.z = ground;
    body.vz = 0;
    body.from = null;
    return fell;
  }
  if (body.z < BODY.abyss) return Infinity;
  return 0;
}

/** The health a fall takes (none for a short one). */
export function fallHarm(height: number): number {
  return height <= BODY.safeFall ? 0 : Math.round((height - BODY.safeFall) * BODY.fallDamage);
}
