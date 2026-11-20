import { isFloor } from '../core/dungeon';
import type { World } from '../core/world';

const PAPER = '#ece2cb';
const PAPER_DARK = '#d9cba9';
const INK = '#211b17';
const BLOOD = '#8b2a1f';

/**
 * The hero's map: only what has been seen, drawn like a sketch on paper.
 * Fits the explored area into the canvas.
 */
export function drawMap(canvas: HTMLCanvasElement, world: World): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = rect.width;
  const H = rect.height;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const { level, explored } = world;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (!explored[y * level.width + x]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return;
  const pad = 2;
  const cols = maxX - minX + 1 + pad * 2;
  const rows = maxY - minY + 1 + pad * 2;
  const size = Math.min(W / cols, H / rows, 22);
  const offX = (W - cols * size) / 2 - (minX - pad) * size;
  const offY = (H - rows * size) / 2 - (minY - pad) * size;
  const at = (x: number, y: number) => ({ x: offX + x * size, y: offY + y * size });
  const seen = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < level.width && y < level.height && explored[y * level.width + x] === 1;

  // Explored floor, slightly darker than the page.
  ctx.fillStyle = PAPER_DARK;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!seen(x, y) || !isFloor(level, x, y)) continue;
      const p = at(x, y);
      ctx.fillRect(p.x, p.y, size + 0.5, size + 0.5);
    }
  }

  // Walls: hatched where they touch a seen floor, outlined along the floor.
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  for (let y = minY - 1; y <= maxY + 1; y++) {
    for (let x = minX - 1; x <= maxX + 1; x++) {
      if (isFloor(level, x, y)) continue;
      const touches = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => seen(x + dx, y + dy) && isFloor(level, x + dx, y + dy));
      if (!touches) continue;
      const p = at(x, y);
      ctx.lineWidth = Math.max(0.6, size / 14);
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(p.x + (i / 4) * size, p.y + size);
        ctx.lineTo(p.x + size, p.y + (i / 4) * size);
        ctx.stroke();
      }
      ctx.lineWidth = Math.max(1, size / 7);
      ctx.beginPath();
      if (seen(x, y + 1) && isFloor(level, x, y + 1)) {
        ctx.moveTo(p.x, p.y + size);
        ctx.lineTo(p.x + size, p.y + size);
      }
      if (seen(x, y - 1) && isFloor(level, x, y - 1)) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + size, p.y);
      }
      if (seen(x + 1, y) && isFloor(level, x + 1, y)) {
        ctx.moveTo(p.x + size, p.y);
        ctx.lineTo(p.x + size, p.y + size);
      }
      if (seen(x - 1, y) && isFloor(level, x - 1, y)) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + size);
      }
      ctx.stroke();
    }
  }

  // The stairs down, once found.
  const { stairs } = level;
  if (seen(stairs.x, stairs.y)) {
    const p = at(stairs.x, stairs.y);
    ctx.fillStyle = INK;
    ctx.fillRect(p.x + size * 0.15, p.y + size * 0.15, size * 0.7, size * 0.7);
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = Math.max(1, size / 12);
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(p.x + size * (0.15 + i * 0.08), p.y + size * (0.15 + i * 0.17));
      ctx.lineTo(p.x + size * (0.85 - i * 0.08), p.y + size * (0.15 + i * 0.17));
      ctx.stroke();
    }
  }

  // The hero.
  const hero = at(world.player.x, world.player.y);
  ctx.fillStyle = BLOOD;
  ctx.beginPath();
  ctx.arc(hero.x, hero.y, Math.max(3, size * 0.35), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
