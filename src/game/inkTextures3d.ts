/**
 * Wall textures for the 3D engine. One texture covers a stretch of wall SPAN_X tiles wide
 * and SPAN_Y tiles tall and tiles with no seams: bricks that cross the side edges are drawn
 * on both sides, and the courses add up exactly to the height.
 *
 * The masonry is deliberately uneven: courses of different heights, bricks of different
 * lengths, corners a little off square, chipped and cracked bricks, the odd one missing.
 * A matching relief map makes each brick stand out, so light and hatching follow them.
 */
import { Rng } from '../core/rng';

/** Tiles of wall covered by one texture, across and up. */
export const SPAN_X = 3;
export const SPAN_Y = 2;
/** Gap of mortar around each brick, in tiles. */
const GAP = 0.02;

type Corner = [number, number];

interface Brick {
  /** Outline in tile units, clockwise, already inset from the mortar. */
  shape: Corner[];
  tone: number;
  hatched: boolean;
  crack: Corner[] | null;
  missing: boolean;
}

function layout(): Brick[] {
  const rng = new Rng('wall3d-masonry');
  // Courses of uneven height that add up exactly to SPAN_Y.
  const heights: number[] = [];
  let total = 0;
  while (total < SPAN_Y - 0.12) {
    const h = rng.range(0.17, 0.31);
    heights.push(h);
    total += h;
  }
  const scale = SPAN_Y / total;
  const list: Brick[] = [];
  let y = 0;
  for (const raw of heights) {
    const h = raw * scale;
    const start = rng.range(0, 0.5);
    let x = start;
    while (x < start + SPAN_X - 0.05) {
      let w = rng.range(0.26, 0.64);
      // The last brick of the course closes the loop exactly.
      if (start + SPAN_X - (x + w) < 0.2) w = start + SPAN_X - x;
      const jitter = () => rng.range(-0.008, 0.008);
      const x0 = x + GAP;
      const x1 = x + w - GAP;
      const y0 = y + GAP;
      const y1 = y + h - GAP;
      const shape: Corner[] = [
        [x0 + jitter(), y0 + jitter()],
        [x1 + jitter(), y0 + jitter()],
        [x1 + jitter(), y1 + jitter()],
        [x0 + jitter(), y1 + jitter()],
      ];
      // A chipped corner.
      if (rng.chance(0.18)) {
        const k = rng.int(0, 3);
        const [cx, cy] = shape[k];
        const prev = shape[(k + 3) % 4];
        const next = shape[(k + 1) % 4];
        const t1 = rng.range(0.12, 0.3);
        const t2 = rng.range(0.15, 0.35);
        shape.splice(
          k,
          1,
          [cx + (prev[0] - cx) * t1, cy + (prev[1] - cy) * t1],
          [cx + (next[0] - cx) * t2 * 0.5, cy + (next[1] - cy) * t2],
        );
      }
      let crack: Corner[] | null = null;
      if (rng.chance(0.14)) {
        crack = [];
        let cx = rng.range(x0, x1);
        const steps = rng.int(3, 5);
        for (let i = 0; i <= steps; i++) {
          crack.push([cx, y0 + ((y1 - y0) * i) / steps]);
          cx += rng.range(-0.05, 0.05);
        }
      }
      list.push({ shape, tone: rng.range(-0.1, 0.08), hatched: rng.chance(0.22), crack, missing: rng.chance(0.015) });
      x += w;
    }
    y += h;
  }
  return list;
}

const BRICKS = layout();

/** Paints at every horizontal copy of a brick that reaches the texture's side edges. */
function wrapped(brick: Brick, paint: (dx: number) => void): void {
  const xs = brick.shape.map((p) => p[0]);
  paint(0);
  if (Math.min(...xs) < 0) paint(SPAN_X);
  if (Math.max(...xs) > SPAN_X) paint(-SPAN_X);
}

function tracePath(ctx: CanvasRenderingContext2D, shape: Corner[], dx: number, px: number, shrink = 0): void {
  const cx = shape.reduce((s, p) => s + p[0], 0) / shape.length;
  const cy = shape.reduce((s, p) => s + p[1], 0) / shape.length;
  ctx.beginPath();
  shape.forEach(([x, y], i) => {
    // Shrinking toward the middle fakes a bevel in the relief map.
    const sx = x + Math.sign(cx - x) * shrink;
    const sy = y + Math.sign(cy - y) * shrink;
    if (i === 0) ctx.moveTo((sx + dx) * px, sy * px);
    else ctx.lineTo((sx + dx) * px, sy * px);
  });
  ctx.closePath();
}

/** Pixels per tile of wall. */
function canvasFor(px: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = SPAN_X * px;
  c.height = SPAN_Y * px;
  return [c, c.getContext('2d')!];
}

export function wallColor(px: number): HTMLCanvasElement {
  const [c, ctx] = canvasFor(px);
  const rng = new Rng('wall3d-color');
  // Mortar.
  ctx.fillStyle = '#5c5145';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.lineJoin = 'round';
  for (const b of BRICKS) {
    wrapped(b, (dx) => {
      tracePath(ctx, b.shape, dx, px);
      if (b.missing) {
        // A gap where a brick fell out: deep shadow.
        ctx.fillStyle = '#463b31';
        ctx.fill();
        return;
      }
      const base = 224 + b.tone * 255;
      ctx.fillStyle = `rgb(${base}, ${base - 10}, ${base - 30})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(33, 27, 23, 0.7)';
      ctx.lineWidth = px * 0.006;
      ctx.stroke();
      if (b.hatched) {
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(33, 27, 23, 0.4)';
        ctx.lineWidth = px * 0.004;
        const xs = b.shape.map((p) => (p[0] + dx) * px);
        const ys = b.shape.map((p) => p[1] * px);
        const left = Math.min(...xs);
        const top = Math.min(...ys);
        const w = Math.max(...xs) - left;
        const h = Math.max(...ys) - top;
        for (let k = -h; k < w; k += px * rng.range(0.028, 0.045)) {
          ctx.beginPath();
          ctx.moveTo(left + k, top + h);
          ctx.lineTo(left + k + h * 0.8, top);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (b.crack) {
        ctx.strokeStyle = 'rgba(33, 27, 23, 0.75)';
        ctx.lineWidth = px * 0.005;
        ctx.beginPath();
        b.crack.forEach(([x, y], i) => (i === 0 ? ctx.moveTo((x + dx) * px, y * px) : ctx.lineTo((x + dx) * px, y * px)));
        ctx.stroke();
      }
    });
  }
  // Paper fibers and a few chips.
  for (let i = 0; i < c.width * 4; i++) {
    ctx.fillStyle = `rgba(110, 90, 60, ${rng.range(0.03, 0.1)})`;
    ctx.fillRect(rng.range(0, c.width), rng.range(0, c.height), px / 256, px / 256);
  }
  ctx.fillStyle = 'rgba(33, 27, 23, 0.5)';
  for (let i = 0; i < 18; i++) {
    const x = rng.range(0.02, 0.98) * c.width;
    const y = rng.range(0.02, 0.98) * c.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rng.range(0.01, 0.03) * px, y + rng.range(-0.01, 0.01) * px);
    ctx.lineTo(x + rng.range(0.005, 0.02) * px, y + rng.range(0.01, 0.025) * px);
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

/** Height map: bricks raised and beveled, mortar sunk between them, gaps sunk deeper. */
export function wallRelief(px: number): HTMLCanvasElement {
  const [c, ctx] = canvasFor(px);
  const rng = new Rng('wall3d-relief');
  ctx.fillStyle = '#202020';
  ctx.fillRect(0, 0, c.width, c.height);
  for (const b of BRICKS) {
    wrapped(b, (dx) => {
      if (b.missing) {
        tracePath(ctx, b.shape, dx, px);
        ctx.fillStyle = '#101010';
        ctx.fill();
        return;
      }
      // Several insets fake a rounded bevel; worn bricks sit a little lower.
      const top = 230 + b.tone * 150;
      for (let k = 0; k < 5; k++) {
        tracePath(ctx, b.shape, dx, px, k * 0.006);
        const v = Math.round(120 + ((top - 120) * k) / 4);
        ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
        ctx.fill();
      }
      if (b.crack) {
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = px * 0.008;
        ctx.beginPath();
        b.crack.forEach(([x, y], i) => (i === 0 ? ctx.moveTo((x + dx) * px, y * px) : ctx.lineTo((x + dx) * px, y * px)));
        ctx.stroke();
      }
    });
  }
  // Pitted stone.
  for (let i = 0; i < c.width * 2; i++) {
    const v = Math.round(rng.range(140, 255));
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.35)`;
    ctx.beginPath();
    ctx.arc(rng.range(0, c.width), rng.range(0, c.height), rng.range(0.5, 2.5) * (px / 512), 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}
