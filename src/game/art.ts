/**
 * Placeholder "ink on paper" art, drawn procedurally with the Canvas 2D API.
 * Visual randomness uses its own seeded stream, so it never touches game logic.
 */
import { isFloor, type Level } from '../core/dungeon';
import { Rng } from '../core/rng';

export const PAPER = '#ece2cb';
export const PAPER_RGB = [236, 226, 203] as const;
export const INK = '#211b17';
export const INK_FADED = 'rgba(33, 27, 23, 0.35)';
export const FLAME = '#d9822b';

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

/** Paper with fibers and stains. */
function paintPaper(ctx: CanvasRenderingContext2D, width: number, height: number, rng: Rng): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  const specks = Math.floor((width * height) / 90);
  for (let i = 0; i < specks; i++) {
    const shade = rng.chance(0.5) ? '120, 100, 70' : '255, 250, 235';
    ctx.fillStyle = `rgba(${shade}, ${rng.range(0.04, 0.12)})`;
    ctx.fillRect(rng.range(0, width), rng.range(0, height), rng.range(0.6, 2), rng.range(0.6, 1.4));
  }
  const stains = Math.max(1, Math.floor((width * height) / 120000));
  for (let i = 0; i < stains; i++) {
    const x = rng.range(0, width);
    const y = rng.range(0, height);
    const r = rng.range(40, 160);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(150, 120, 70, 0.07)');
    g.addColorStop(1, 'rgba(150, 120, 70, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** A slightly shaky hand-drawn line. */
function inkLine(ctx: CanvasRenderingContext2D, rng: Rng, x0: number, y0: number, x1: number, y1: number, jitter: number): void {
  const mx = (x0 + x1) / 2 + rng.range(-jitter, jitter);
  const my = (y0 + y1) / 2 + rng.range(-jitter, jitter);
  ctx.beginPath();
  ctx.moveTo(x0 + rng.range(-jitter, jitter) * 0.5, y0 + rng.range(-jitter, jitter) * 0.5);
  ctx.quadraticCurveTo(mx, my, x1 + rng.range(-jitter, jitter) * 0.5, y1 + rng.range(-jitter, jitter) * 0.5);
  ctx.stroke();
}

/** Short parallel strokes inside a square, at a random angle. */
function hatch(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, size: number, density: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  const angle = rng.range(0, Math.PI);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const cx = x + size / 2;
  const cy = y + size / 2;
  const gap = size / density;
  for (let o = -size; o <= size; o += gap) {
    const len = size * rng.range(0.35, 0.75);
    const px = cx - dy * o + rng.range(-gap, gap) * 0.4;
    const py = cy + dx * o + rng.range(-gap, gap) * 0.4;
    inkLine(ctx, rng, px - dx * len, py - dy * len, px + dx * len, py + dy * len, 0.6);
  }
  ctx.restore();
}

/**
 * The whole level drawn as an ink map. `tile` is the size of one tile in pixels.
 * Walls next to floor get hatching; walls with floor below show their front face (3/4 view).
 */
export function drawLevel(level: Level, tile: number): HTMLCanvasElement {
  const { width, height } = level;
  const [c, ctx] = canvas(width * tile, height * tile);
  const rng = Rng.derive(level.seed, 'art', level.depth);
  paintPaper(ctx, c.width, c.height, rng);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s = tile / 32;

  const nearFloor = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isFloor(level, x + dx, y + dy)) return true;
    return false;
  };

  // Floor: faint flagstone joints.
  ctx.strokeStyle = INK_FADED;
  ctx.lineWidth = 0.8 * s;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isFloor(level, x, y)) continue;
      if (rng.chance(0.55)) inkLine(ctx, rng, x * tile, (y + 1) * tile, (x + 1) * tile, (y + 1) * tile, 0.8 * s);
      if (rng.chance(0.55)) inkLine(ctx, rng, (x + 1) * tile, y * tile, (x + 1) * tile, (y + 1) * tile, 0.8 * s);
      if (rng.chance(0.08)) {
        // A crack or a pebble.
        const px = (x + rng.range(0.2, 0.8)) * tile;
        const py = (y + rng.range(0.2, 0.8)) * tile;
        inkLine(ctx, rng, px, py, px + rng.range(-6, 6) * s, py + rng.range(-6, 6) * s, 1.5 * s);
      }
    }
  }

  // Rock near the rooms: hatching.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1 * s;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isFloor(level, x, y) || !nearFloor(x, y)) continue;
      hatch(ctx, rng, x * tile, y * tile, tile, 6);
    }
  }

  // Wall faces (3/4 view): the wall tile right above a floor tile shows its masonry.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isFloor(level, x, y) || !isFloor(level, x, y + 1)) continue;
      const left = x * tile;
      const top = y * tile + tile * 0.3;
      const faceHeight = tile * 0.7;
      ctx.fillStyle = PAPER;
      ctx.fillRect(left, top, tile, faceHeight);
      ctx.fillStyle = 'rgba(60, 45, 30, 0.12)';
      ctx.fillRect(left, top, tile, faceHeight);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1 * s;
      const rows = 3;
      for (let r = 1; r < rows; r++) {
        const ry = top + (faceHeight / rows) * r;
        inkLine(ctx, rng, left, ry, left + tile, ry, 0.7 * s);
      }
      for (let r = 0; r < rows; r++) {
        const offset = r % 2 === 0 ? 0.33 : 0.75;
        const bx = left + tile * offset + rng.range(-2, 2) * s;
        const ry = top + (faceHeight / rows) * r;
        inkLine(ctx, rng, bx, ry, bx, ry + faceHeight / rows, 0.5 * s);
      }
      ctx.lineWidth = 2 * s;
      inkLine(ctx, rng, left, top, left + tile, top, 0.8 * s);
    }
  }

  // Outline every floor/wall boundary with a bold ink stroke.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4 * s;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isFloor(level, x, y)) continue;
      const l = x * tile;
      const t = y * tile;
      if (!isFloor(level, x, y - 1)) inkLine(ctx, rng, l, t, l + tile, t, 1 * s);
      if (!isFloor(level, x, y + 1)) inkLine(ctx, rng, l, t + tile, l + tile, t + tile, 1 * s);
      if (!isFloor(level, x - 1, y)) inkLine(ctx, rng, l, t, l, t + tile, 1 * s);
      if (!isFloor(level, x + 1, y)) inkLine(ctx, rng, l + tile, t, l + tile, t + tile, 1 * s);
    }
  }

  drawStairs(ctx, rng, level.stairs.x * tile, level.stairs.y * tile, tile);
  return c;
}

function drawStairs(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, tile: number): void {
  const s = tile / 32;
  ctx.save();
  ctx.fillStyle = 'rgba(33, 27, 23, 0.85)';
  ctx.fillRect(x + 4 * s, y + 4 * s, tile - 8 * s, tile - 8 * s);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.4 * s;
  for (let i = 1; i <= 4; i++) {
    const inset = 4 * s + i * 2.6 * s;
    inkLine(ctx, rng, x + inset, y + 4 * s + i * 4.5 * s, x + tile - inset, y + 4 * s + i * 4.5 * s, 0.4 * s);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2 * s;
  ctx.strokeRect(x + 4 * s, y + 4 * s, tile - 8 * s, tile - 8 * s);
  ctx.restore();
}

/** Tileable paper used to cover what has not been seen yet. */
export function drawPaper(size: number, seed: string): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  paintPaper(ctx, size, size, Rng.derive(seed, 'paper'));
  return c;
}

/** Soft round brush: opaque center, transparent edge. Used to erase the fog. */
export function drawBrush(size: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/**
 * Light falloff around the player: clear inside `holeFraction` of the radius,
 * then a wash of paper that leaves the remembered map faint, like old pencil.
 */
export function drawLightMask(size: number, holeFraction: number, wash: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const r = size / 2;
  const [pr, pg, pb] = PAPER_RGB;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `rgba(${pr},${pg},${pb},0)`);
  g.addColorStop(holeFraction * 0.6, `rgba(${pr},${pg},${pb},0)`);
  g.addColorStop(holeFraction, `rgba(${pr},${pg},${pb},${wash})`);
  g.addColorStop(1, `rgba(${pr},${pg},${pb},${wash})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** Hooded figure carrying a flame. */
export function drawPlayer(tile: number): HTMLCanvasElement {
  const s = tile / 32;
  const [c, ctx] = canvas(Math.ceil(28 * s), Math.ceil(40 * s));
  const rng = new Rng('player-art');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  ctx.lineWidth = 2 * s;
  // Cloak.
  ctx.beginPath();
  ctx.moveTo(14 * s, 10 * s);
  ctx.quadraticCurveTo(4 * s, 22 * s, 5 * s, 37 * s);
  ctx.lineTo(23 * s, 37 * s);
  ctx.quadraticCurveTo(24 * s, 22 * s, 14 * s, 10 * s);
  ctx.fill();
  ctx.stroke();
  // Cloak folds.
  ctx.lineWidth = 1 * s;
  inkLine(ctx, rng, 11 * s, 20 * s, 9 * s, 35 * s, 0.6 * s);
  inkLine(ctx, rng, 16 * s, 21 * s, 18 * s, 35 * s, 0.6 * s);
  // Hood.
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(14 * s, 11 * s, 6 * s, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  // Flame.
  ctx.fillStyle = FLAME;
  ctx.beginPath();
  ctx.ellipse(24 * s, 16 * s, 2.6 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.4 * s;
  inkLine(ctx, rng, 22 * s, 21 * s, 20 * s, 28 * s, 0.3 * s);
  return c;
}

export function drawItem(kind: 'food' | 'water' | 'oil', tile: number): HTMLCanvasElement {
  const s = tile / 32;
  const size = Math.ceil(24 * s);
  const [c, ctx] = canvas(size, size);
  const rng = new Rng(`item-art-${kind}`);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  ctx.lineWidth = 1.8 * s;
  if (kind === 'food') {
    ctx.beginPath();
    ctx.ellipse(12 * s, 13 * s, 9 * s, 6 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.2 * s;
    for (const ox of [-4, 0, 4]) inkLine(ctx, rng, (12 + ox - 1.5) * s, 10 * s, (12 + ox + 1.5) * s, 15 * s, 0.3 * s);
  } else if (kind === 'water') {
    ctx.beginPath();
    ctx.moveTo(9 * s, 5 * s);
    ctx.lineTo(15 * s, 5 * s);
    ctx.quadraticCurveTo(21 * s, 12 * s, 18 * s, 20 * s);
    ctx.quadraticCurveTo(12 * s, 23 * s, 6 * s, 20 * s);
    ctx.quadraticCurveTo(3 * s, 12 * s, 9 * s, 5 * s);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1 * s;
    inkLine(ctx, rng, 8 * s, 14 * s, 16 * s, 14 * s, 0.6 * s);
    ctx.fillStyle = INK;
    ctx.fillRect(10 * s, 2 * s, 4 * s, 3 * s);
  } else {
    ctx.beginPath();
    ctx.arc(12 * s, 15 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeRect(10 * s, 4 * s, 4 * s, 4 * s);
    ctx.fillStyle = FLAME;
    ctx.beginPath();
    ctx.arc(12 * s, 16 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}
