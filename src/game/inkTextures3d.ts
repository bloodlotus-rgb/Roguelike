/**
 * Wall textures for the 3D engine, painted so they tile with no seams: one texture
 * covers one tile of wall, and bricks that cross an edge are drawn on both sides.
 * A matching relief map makes each brick stand out, so light and hatching follow them.
 */
import { Rng } from '../core/rng';

const ROWS = 4;
const COLS = 2;

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: number;
  hatched: boolean;
}

/** The brick layout of one tile, in tile units (0..1), with staggered rows. */
function bricks(seed: string): Brick[] {
  const rng = new Rng(seed);
  const list: Brick[] = [];
  const h = 1 / ROWS;
  const w = 1 / COLS;
  for (let r = 0; r < ROWS; r++) {
    const offset = r % 2 === 0 ? 0 : w / 2;
    for (let c = -1; c < COLS; c++) {
      list.push({ x: c * w + offset, y: r * h, w, h, tone: rng.range(-0.06, 0.06), hatched: rng.chance(0.3) });
    }
  }
  return list;
}

/** Draws `paint` at every wrapped copy of a rectangle that crosses the texture edge. */
function wrapped(x: number, w: number, paint: (dx: number) => void): void {
  paint(0);
  if (x < 0) paint(1);
  if (x + w > 1) paint(-1);
}

export function wallColor(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const rng = new Rng('wall3d-color');
  // Mortar.
  ctx.fillStyle = '#5c5145';
  ctx.fillRect(0, 0, size, size);
  const gap = 0.018;
  for (const b of bricks('wall3d')) {
    wrapped(b.x, b.w, (dx) => {
      const x = (b.x + dx + gap) * size;
      const y = (b.y + gap) * size;
      const w = (b.w - gap * 2) * size;
      const h = (b.h - gap * 2) * size;
      const base = 226 + b.tone * 255;
      ctx.fillStyle = `rgb(${base}, ${base - 10}, ${base - 30})`;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, size * 0.012);
      ctx.fill();
      ctx.strokeStyle = 'rgba(33, 27, 23, 0.7)';
      ctx.lineWidth = size * 0.006;
      ctx.stroke();
      if (b.hatched) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(33, 27, 23, 0.45)';
        ctx.lineWidth = size * 0.004;
        for (let k = -h; k < w; k += size * 0.035) {
          ctx.beginPath();
          ctx.moveTo(x + k, y + h);
          ctx.lineTo(x + k + h * 0.8, y);
          ctx.stroke();
        }
        ctx.restore();
      }
    });
  }
  // Paper fibers and a few chips.
  for (let i = 0; i < size * 4; i++) {
    ctx.fillStyle = `rgba(110, 90, 60, ${rng.range(0.03, 0.1)})`;
    ctx.fillRect(rng.range(0, size), rng.range(0, size), size / 256, size / 256);
  }
  ctx.fillStyle = 'rgba(33, 27, 23, 0.5)';
  for (let i = 0; i < 6; i++) {
    const x = rng.range(0.05, 0.95) * size;
    const y = rng.range(0.05, 0.95) * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rng.range(0.01, 0.03) * size, y + rng.range(-0.01, 0.01) * size);
    ctx.lineTo(x + rng.range(0.005, 0.02) * size, y + rng.range(0.01, 0.025) * size);
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

/** Height map: bricks raised and rounded at the edges, mortar sunk between them. */
export function wallRelief(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const rng = new Rng('wall3d-relief');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const gap = 0.018;
  for (const b of bricks('wall3d')) {
    wrapped(b.x, b.w, (dx) => {
      const x = (b.x + dx + gap) * size;
      const y = (b.y + gap) * size;
      const w = (b.w - gap * 2) * size;
      const h = (b.h - gap * 2) * size;
      // Several insets fake a rounded bevel.
      for (let k = 0; k < 5; k++) {
        const inset = k * size * 0.006;
        const v = 120 + k * 30;
        ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
        ctx.beginPath();
        ctx.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, size * 0.012);
        ctx.fill();
      }
    });
  }
  // Pitted stone.
  for (let i = 0; i < size * 2; i++) {
    const v = Math.round(rng.range(140, 255));
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.35)`;
    ctx.beginPath();
    ctx.arc(rng.range(0, size), rng.range(0, size), rng.range(0.5, 2.5) * (size / 512), 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}
