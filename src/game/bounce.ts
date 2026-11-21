/**
 * Light that bounces. The flame does not stop at the first wall it touches: part of it is
 * thrown back off walls and floor, spreads and fades, reaching around corners and into
 * the far side of a room. Worked out on the level's grid, one value per tile, and handed
 * to the ink shader as a texture it adds to the direct light (so a wall at the back of a
 * room is hatched instead of black, and shadows are not quite solid).
 *
 * Direct light comes from the sources (the hero's flame, torches, a camp fire) over tiles
 * they can see; then a few rounds of diffusion pass a share of it from tile to tile, walls
 * included (they reflect but let nothing through). Only a window around the hero is worked.
 */
import * as THREE from 'three';
import { isFloor, isSeeThrough, type Level } from '../core/dungeon';
import { hasLineOfSight } from '../core/geometry';

export interface LightSource {
  x: number;
  y: number;
  /** How far it reaches, in tiles. */
  radius: number;
  /** Its strength, about 1 for the hero's flame. */
  power: number;
  /** A cone: the direction it points and its half-angle (the hero's lantern). */
  dir?: number;
  cone?: number;
  /** Tiles it is known to see (skips the line-of-sight test). */
  sees?: Set<number>;
}

/** Share of the light a surface throws back, per tile it travels. */
const ALBEDO = 0.74;
const ROUNDS = 14;
const WINDOW = 20;

export class BounceLight {
  readonly texture: THREE.DataTexture;
  private readonly data: Uint8Array;
  private readonly direct: Float32Array;
  private readonly light: Float32Array;
  private readonly next: Float32Array;
  private readonly open: Uint8Array;
  private readonly solid: Uint8Array;

  constructor(private readonly level: Level) {
    const { width, height } = level;
    this.data = new Uint8Array(width * height);
    this.texture = new THREE.DataTexture(this.data, width, height, THREE.RedFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
    this.direct = new Float32Array(width * height);
    this.light = new Float32Array(width * height);
    this.next = new Float32Array(width * height);
    // Light travels over open tiles and is thrown back by the walls that bound them.
    this.open = new Uint8Array(width * height);
    this.solid = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (isSeeThrough(level, x, y)) this.open[i] = 1;
        else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isSeeThrough(level, x + dx, y + dy))) this.solid[i] = 1;
      }
    }
  }

  /** Works out the bounced light around `center` from `sources`, and updates the texture. */
  update(center: { x: number; y: number }, sources: LightSource[]): void {
    const { width, height } = this.level;
    const x0 = Math.max(1, Math.floor(center.x) - WINDOW);
    const x1 = Math.min(width - 2, Math.floor(center.x) + WINDOW);
    const y0 = Math.max(1, Math.floor(center.y) - WINDOW);
    const y1 = Math.min(height - 2, Math.floor(center.y) + WINDOW);
    const { direct, light, next, open, solid, data } = this;
    direct.fill(0);
    light.fill(0);
    // Direct light on every tile a source sees, falling off toward the edge of its reach.
    for (const s of sources) {
      const r = Math.ceil(s.radius);
      for (let y = Math.max(y0, Math.floor(s.y) - r); y <= Math.min(y1, Math.floor(s.y) + r); y++) {
        for (let x = Math.max(x0, Math.floor(s.x) - r); x <= Math.min(x1, Math.floor(s.x) + r); x++) {
          const i = y * width + x;
          if (!open[i] && !solid[i]) continue;
          const dx = x + 0.5 - s.x;
          const dy = y + 0.5 - s.y;
          const d = Math.hypot(dx, dy);
          if (d > s.radius) continue;
          if (s.cone !== undefined && s.dir !== undefined && d > 0.8) {
            let a = Math.atan2(dy, dx) - s.dir;
            a = Math.atan2(Math.sin(a), Math.cos(a));
            if (Math.abs(a) > s.cone) continue;
          }
          const seen = s.sees ? s.sees.has(i) : open[i] ? hasLineOfSight(this.level, s, { x: x + 0.5, y: y + 0.5 }) : this.seesWall(s, x, y);
          if (!seen) continue;
          const k = 1 - (d / s.radius) ** 2;
          direct[i] = Math.max(direct[i], s.power * k);
        }
      }
    }
    // Diffusion: each round, every tile takes a share of what its neighbours hold. Walls take
    // light from the open tiles beside them and give it back, but pass none through.
    for (let round = 0; round < ROUNDS; round++) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * width + x;
          if (!open[i] && !solid[i]) continue;
          let sum = 0;
          let n = 0;
          for (const j of [i - 1, i + 1, i - width, i + width]) {
            if (!open[j] && !(open[i] && solid[j])) continue;
            sum += direct[j] + light[j];
            n++;
          }
          next[i] = n > 0 ? (ALBEDO * sum) / Math.max(n, 2) : 0;
        }
      }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) light[y * width + x] = next[y * width + x];
    }
    data.fill(0);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x;
        data[i] = Math.min(255, Math.round(light[i] * 255));
      }
    }
    this.texture.needsUpdate = true;
  }

  /** A wall tile is lit if one of the open tiles beside it is seen from the source. */
  private seesWall(s: LightSource, x: number, y: number): boolean {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!isFloor(this.level, x + dx, y + dy) && !isSeeThrough(this.level, x + dx, y + dy)) continue;
      if (Math.hypot(x + dx + 0.5 - s.x, y + dy + 0.5 - s.y) >= Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y)) continue;
      if (hasLineOfSight(this.level, s, { x: x + dx + 0.5, y: y + dy + 0.5 })) return true;
    }
    return false;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
