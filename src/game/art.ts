/**
 * Placeholder "ink on paper" art, drawn procedurally with the Canvas 2D API.
 * Visual randomness uses its own seeded stream, so it never touches game logic.
 */
import { isFloor, type FeatureKind, type Level, type LootKind } from '../core/dungeon';
import { Rng } from '../core/rng';

export const PAPER = '#ece2cb';
export const PAPER_RGB = [236, 226, 203] as const;
export const INK = '#211b17';
export const INK_FADED = 'rgba(33, 27, 23, 0.35)';
export const FLAME = '#d9822b';
export const DARK = '#110e0c';
export const DARK_RGB = [17, 14, 12] as const;

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

  // Deep rock, far from any floor, is solid ink that bleeds a little into its neighbors.
  ctx.fillStyle = DARK;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isFloor(level, x, y) || nearFloor(x, y)) continue;
      ctx.beginPath();
      ctx.arc((x + 0.5) * tile, (y + 0.5) * tile, tile * rng.range(0.72, 0.85), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Floor: irregular flagstones, some split in two, with the odd crack.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isFloor(level, x, y)) continue;
      const l = x * tile;
      const t = y * tile;
      const inset = 1.6 * s;
      ctx.fillStyle = rng.chance(0.5) ? 'rgba(120, 100, 70, 0.05)' : 'rgba(255, 250, 235, 0.06)';
      ctx.fillRect(l + inset, t + inset, tile - inset * 2, tile - inset * 2);
      ctx.strokeStyle = INK_FADED;
      ctx.lineWidth = 0.9 * s;
      const j = 0.9 * s;
      ctx.beginPath();
      ctx.moveTo(l + inset + rng.range(-j, j), t + inset + rng.range(-j, j));
      ctx.lineTo(l + tile - inset + rng.range(-j, j), t + inset + rng.range(-j, j));
      ctx.lineTo(l + tile - inset + rng.range(-j, j), t + tile - inset + rng.range(-j, j));
      ctx.lineTo(l + inset + rng.range(-j, j), t + tile - inset + rng.range(-j, j));
      ctx.closePath();
      ctx.stroke();
      if (rng.chance(0.3)) {
        // Split slab.
        const mid = rng.range(0.35, 0.65) * tile;
        if (rng.chance(0.5)) inkLine(ctx, rng, l + mid, t + inset, l + mid, t + tile - inset, 0.6 * s);
        else inkLine(ctx, rng, l + inset, t + mid, l + tile - inset, t + mid, 0.6 * s);
      }
      if (rng.chance(0.1)) {
        // A crack running across.
        ctx.strokeStyle = 'rgba(33, 27, 23, 0.55)';
        ctx.lineWidth = 0.8 * s;
        let cx = l + rng.range(0.2, 0.8) * tile;
        let cy = t + rng.range(0.2, 0.8) * tile;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let k = 0; k < 4; k++) {
          cx += rng.range(-6, 6) * s;
          cy += rng.range(-6, 6) * s;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    }
  }

  drawWallFootShade(level, ctx, tile);

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
      // Grime darkening toward the floor, and a few chipped bricks.
      const grime = ctx.createLinearGradient(0, top + faceHeight, 0, top);
      grime.addColorStop(0, 'rgba(33, 27, 23, 0.4)');
      grime.addColorStop(0.6, 'rgba(33, 27, 23, 0)');
      ctx.fillStyle = grime;
      ctx.fillRect(left, top, tile, faceHeight);
      if (rng.chance(0.25)) {
        const bx = left + rng.range(0.15, 0.7) * tile;
        const by = top + rng.range(0.1, 0.6) * faceHeight;
        ctx.fillStyle = 'rgba(33, 27, 23, 0.55)';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + rng.range(3, 7) * s, by + rng.range(-1, 2) * s);
        ctx.lineTo(bx + rng.range(2, 5) * s, by + rng.range(3, 5) * s);
        ctx.closePath();
        ctx.fill();
      }
      ctx.lineWidth = 2 * s;
      inkLine(ctx, rng, left, top, left + tile, top, 0.8 * s);
    }
  }

  // Columns: a wall tile with floor on all four sides.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isColumn(level, x, y)) drawColumn(ctx, rng, x * tile, y * tile, tile);
    }
  }

  drawDecor(level, ctx, rng, tile);

  // Outline every floor/wall boundary with a bold ink stroke (columns draw their own).
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4 * s;
  const solid = (x: number, y: number) => !isFloor(level, x, y) && !isColumn(level, x, y);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isFloor(level, x, y)) continue;
      const l = x * tile;
      const t = y * tile;
      if (solid(x, y - 1)) inkLine(ctx, rng, l, t, l + tile, t, 1 * s);
      if (solid(x, y + 1)) inkLine(ctx, rng, l, t + tile, l + tile, t + tile, 1 * s);
      if (solid(x - 1, y)) inkLine(ctx, rng, l, t, l, t + tile, 1 * s);
      if (solid(x + 1, y)) inkLine(ctx, rng, l + tile, t, l + tile, t + tile, 1 * s);
    }
  }

  drawStairs(ctx, rng, level.stairs.x * tile, level.stairs.y * tile, tile);
  return c;
}

/** A lone wall tile with floor on all four sides is drawn as a column. */
function isColumn(level: Level, x: number, y: number): boolean {
  return (
    !isFloor(level, x, y) &&
    isFloor(level, x - 1, y) &&
    isFloor(level, x + 1, y) &&
    isFloor(level, x, y - 1) &&
    isFloor(level, x, y + 1)
  );
}

function drawColumn(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, tile: number): void {
  const s = tile / 32;
  const cx = x + tile / 2;
  ctx.save();
  // Clear the hatching under it, then a round shaft seen from above at 3/4.
  ctx.fillStyle = PAPER;
  ctx.fillRect(x - 1, y - 1, tile + 2, tile + 2);
  ctx.fillStyle = 'rgba(33, 27, 23, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx + 3 * s, y + tile - 3 * s, 13 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(236, 226, 203, 1)';
  ctx.fillRect(cx - 10 * s, y - 6 * s, 20 * s, tile);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * s;
  for (const ox of [-6, -2, 3, 7]) inkLine(ctx, rng, cx + ox * s, y - 2 * s, cx + ox * s, y + tile - 6 * s, 0.4 * s);
  ctx.lineWidth = 2.2 * s;
  inkLine(ctx, rng, cx - 10 * s, y - 6 * s, cx - 10 * s, y + tile - 5 * s, 0.6 * s);
  inkLine(ctx, rng, cx + 10 * s, y - 6 * s, cx + 10 * s, y + tile - 5 * s, 0.6 * s);
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.ellipse(cx, y - 6 * s, 10 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, y + tile - 5 * s, 10 * s, 4 * s, 0, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}

/** Ink pooling along the foot of the walls gives the rooms depth. */
function drawWallFootShade(level: Level, ctx: CanvasRenderingContext2D, tile: number): void {
  const { width, height } = level;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isFloor(level, x, y)) continue;
      const l = x * tile;
      const t = y * tile;
      const band = tile * 0.42;
      const sides: Array<[boolean, number, number, number, number]> = [
        [!isFloor(level, x, y - 1), l, t, l, t + band],
        [!isFloor(level, x, y + 1), l, t + tile, l, t + tile - band * 0.6],
        [!isFloor(level, x - 1, y), l, t, l + band, t],
        [!isFloor(level, x + 1, y), l + tile, t, l + tile - band, t],
      ];
      for (const [wall, x0, y0, x1, y1] of sides) {
        if (!wall) continue;
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(33, 27, 23, 0.32)');
        g.addColorStop(1, 'rgba(33, 27, 23, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(l, t, tile, tile);
      }
    }
  }
}

/** Bones, rubble, stains, chains and the remains of earlier delvers. Purely decorative. */
function drawDecor(level: Level, ctx: CanvasRenderingContext2D, rng: Rng, tile: number, flatOnly = false): void {
  const s = tile / 32;
  const { width, height } = level;
  const start = level.start;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isFloor(level, x, y)) {
        // Chains and rings hanging from wall faces.
        if (isFloor(level, x, y + 1) && rng.chance(0.06)) {
          const cx = (x + rng.range(0.3, 0.7)) * tile;
          ctx.lineWidth = 1.2 * s;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.ellipse(cx, y * tile + tile * 0.4 + i * 4 * s, 1.6 * s, 2.4 * s, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        continue;
      }
      if (Math.abs(x - start.x) + Math.abs(y - start.y) < 2) continue;
      if ((x === level.stairs.x && y === level.stairs.y) || !rng.chance(0.11)) continue;
      const px = (x + rng.range(0.2, 0.8)) * tile;
      const py = (y + rng.range(0.25, 0.8)) * tile;
      const roll = rng.next();
      // The 3D engine builds bones, rubble and skulls with real volume; only flat things are painted.
      if (flatOnly && (roll < 0.55 || (roll >= 0.78 && roll < 0.9))) continue;
      if (roll < 0.3) {
        // Scattered bones.
        ctx.lineWidth = 2 * s;
        for (let i = 0; i < rng.int(1, 3); i++) {
          const a = rng.range(0, Math.PI);
          const l = rng.range(4, 8) * s;
          const bx = px + rng.range(-5, 5) * s;
          const by = py + rng.range(-4, 4) * s;
          inkLine(ctx, rng, bx - Math.cos(a) * l, by - Math.sin(a) * l, bx + Math.cos(a) * l, by + Math.sin(a) * l, 0.3 * s);
          ctx.beginPath();
          ctx.arc(bx + Math.cos(a) * l, by + Math.sin(a) * l, 1.6 * s, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (roll < 0.55) {
        // Rubble.
        ctx.lineWidth = 1.2 * s;
        ctx.fillStyle = PAPER;
        for (let i = 0; i < rng.int(2, 5); i++) {
          const r = rng.range(1.5, 3.5) * s;
          const rx = px + rng.range(-7, 7) * s;
          const ry = py + rng.range(-5, 5) * s;
          ctx.beginPath();
          ctx.moveTo(rx - r, ry);
          ctx.lineTo(rx - r * 0.3, ry - r);
          ctx.lineTo(rx + r, ry - r * 0.4);
          ctx.lineTo(rx + r * 0.6, ry + r * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else if (roll < 0.78) {
        // An old stain.
        ctx.fillStyle = rng.chance(0.5) ? 'rgba(110, 35, 25, 0.18)' : 'rgba(33, 27, 23, 0.14)';
        ctx.beginPath();
        ctx.ellipse(px, py, rng.range(5, 11) * s, rng.range(3, 7) * s, rng.range(0, Math.PI), 0, Math.PI * 2);
        ctx.fill();
      } else if (roll < 0.9) {
        // A skull.
        ctx.lineWidth = 1.4 * s;
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.arc(px, py, 4.5 * s, Math.PI, 0);
        ctx.lineTo(px + 3 * s, py + 4 * s);
        ctx.lineTo(px - 3 * s, py + 4 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.fillRect(px - 2.6 * s, py - 1 * s, 1.8 * s, 1.8 * s);
        ctx.fillRect(px + 0.8 * s, py - 1 * s, 1.8 * s, 1.8 * s);
      } else {
        // What is left of another delver: a broken sword and a torn pack.
        ctx.lineWidth = 2 * s;
        inkLine(ctx, rng, px - 8 * s, py + 3 * s, px + 6 * s, py - 4 * s, 0.3 * s);
        inkLine(ctx, rng, px - 4 * s, py - 1 * s, px - 2 * s, py + 4 * s, 0.3 * s);
        ctx.lineWidth = 1.2 * s;
        ctx.fillStyle = 'rgba(33, 27, 23, 0.12)';
        ctx.beginPath();
        ctx.ellipse(px + 6 * s, py + 5 * s, 5 * s, 3.5 * s, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  ctx.restore();
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
/**
 * The floor's decoration for the 3D engine, on a transparent canvas covering the whole
 * level: ink pooling at the foot of the walls, stains and remains (bones, rubble and skulls
 * are built in 3D).
 */
export function drawFloorDecor(level: Level, tile: number): HTMLCanvasElement {
  const [c, ctx] = canvas(level.width * tile, level.height * tile);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawWallFootShade(level, ctx, tile);
  drawDecor(level, ctx, Rng.derive(level.seed, 'art', level.depth), tile, true);
  return c;
}

export function drawPaper(size: number, seed: string): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  paintPaper(ctx, size, size, Rng.derive(seed, 'paper'));
  return c;
}

/**
 * Light falloff around the player: slightly warm at the center, a soft edge, and full
 * ink darkness from `edge` (as a fraction of the half-size) to the border.
 */
export function drawLightMask(size: number, edge: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const r = size / 2;
  const [dr, dg, db] = DARK_RGB;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r * edge);
  g.addColorStop(0, 'rgba(255, 190, 120, 0.06)');
  g.addColorStop(0.45, `rgba(${dr},${dg},${db},0)`);
  g.addColorStop(0.75, `rgba(${dr},${dg},${db},0.35)`);
  g.addColorStop(0.92, `rgba(${dr},${dg},${db},0.85)`);
  g.addColorStop(1, `rgba(${dr},${dg},${db},1)`);
  ctx.fillStyle = DARK;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'copy';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r * edge, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Everything that can lie on the floor, in the order the views load them. */
export const LOOT_KINDS: readonly LootKind[] = ['ration', 'marchRation', 'waterskin', 'oil', 'gold'];

export function drawItem(kind: LootKind, tile: number): HTMLCanvasElement {
  const s = tile / 32;
  const size = Math.ceil(24 * s);
  const [c, ctx] = canvas(size, size);
  const rng = new Rng(`item-art-${kind}`);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  ctx.lineWidth = 1.8 * s;
  if (kind === 'marchRation') {
    // A bundle wrapped in cloth and tied with string.
    ctx.beginPath();
    ctx.roundRect(5 * s, 7 * s, 14 * s, 11 * s, 3 * s);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.2 * s;
    inkLine(ctx, rng, 12 * s, 6 * s, 12 * s, 19 * s, 0.3 * s);
    inkLine(ctx, rng, 4 * s, 12 * s, 20 * s, 12 * s, 0.3 * s);
    ctx.beginPath();
    ctx.arc(12 * s, 12 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'gold') {
    // A few coins, one on edge.
    for (const [x, y] of [[8, 16], [14, 17], [11, 13]] as const) {
      ctx.fillStyle = '#d8b25a';
      ctx.beginPath();
      ctx.ellipse(x * s, y * s, 4 * s, 2.4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(17 * s, 11 * s, 1.6 * s, 4 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'ration') {
    ctx.beginPath();
    ctx.ellipse(12 * s, 13 * s, 9 * s, 6 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.2 * s;
    for (const ox of [-4, 0, 4]) inkLine(ctx, rng, (12 + ox - 1.5) * s, 10 * s, (12 + ox + 1.5) * s, 15 * s, 0.3 * s);
  } else if (kind === 'waterskin') {
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

export const BLOOD = '#8b2a1f';

/**
 * Places in a level, drawn upright: a fountain basin, an explorer's remains, a crate.
 * `spent` draws a searched container (an empty pack, a crate with its lid off).
 */
export function drawFeature(kind: FeatureKind, tile: number, spent = false): HTMLCanvasElement {
  const s = tile / 32;
  const [c, ctx] = canvas(Math.ceil(32 * s), Math.ceil(32 * s));
  const rng = new Rng(`feature-art-${kind}`);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  ctx.lineWidth = 1.8 * s;
  if (kind === 'fountain') {
    // A stone basin with a spout, water lines inside.
    ctx.beginPath();
    ctx.moveTo(4 * s, 16 * s);
    ctx.lineTo(28 * s, 16 * s);
    ctx.lineTo(25 * s, 29 * s);
    ctx.lineTo(7 * s, 29 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(16 * s, 16 * s, 12 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7d93a3';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PAPER;
    ctx.fillRect(14 * s, 3 * s, 4 * s, 12 * s);
    ctx.strokeRect(14 * s, 3 * s, 4 * s, 12 * s);
    ctx.lineWidth = 1 * s;
    for (let i = 0; i < 3; i++) inkLine(ctx, rng, (8 + i * 6) * s, 21 * s, (11 + i * 6) * s, 21 * s, 0.4 * s);
    for (const y of [10, 14]) inkLine(ctx, rng, 16 * s, y * s, 16 * s, (y + 2) * s, 0.2 * s);
  } else if (kind === 'crate') {
    ctx.fillRect(5 * s, 11 * s, 22 * s, 18 * s);
    ctx.strokeRect(5 * s, 11 * s, 22 * s, 18 * s);
    ctx.lineWidth = 1.1 * s;
    for (const y of [17, 23]) inkLine(ctx, rng, 5 * s, y * s, 27 * s, y * s, 0.3 * s);
    inkLine(ctx, rng, 6 * s, 28 * s, 26 * s, 12 * s, 0.4 * s);
    ctx.lineWidth = 1.8 * s;
    if (spent) {
      // The lid leans against it.
      ctx.save();
      ctx.translate(24 * s, 10 * s);
      ctx.rotate(0.5);
      ctx.fillRect(0, -2 * s, 12 * s, 4 * s);
      ctx.strokeRect(0, -2 * s, 12 * s, 4 * s);
      ctx.restore();
      ctx.fillStyle = INK;
      ctx.fillRect(7 * s, 12 * s, 18 * s, 3 * s);
    } else {
      ctx.fillRect(4 * s, 8 * s, 24 * s, 4 * s);
      ctx.strokeRect(4 * s, 8 * s, 24 * s, 4 * s);
    }
  } else {
    // An explorer's remains: a skull, bones and, until searched, a pack.
    ctx.lineWidth = 2 * s;
    inkLine(ctx, rng, 5 * s, 27 * s, 20 * s, 24 * s, 0.4 * s);
    inkLine(ctx, rng, 9 * s, 23 * s, 14 * s, 29 * s, 0.4 * s);
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.arc(8 * s, 19 * s, 4.5 * s, Math.PI, 0);
    ctx.lineTo(11 * s, 23 * s);
    ctx.lineTo(5 * s, 23 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(5.5 * s, 18 * s, 1.8 * s, 1.8 * s);
    ctx.fillRect(8.8 * s, 18 * s, 1.8 * s, 1.8 * s);
    if (!spent) {
      ctx.fillStyle = '#b89a6a';
      ctx.beginPath();
      ctx.roundRect(16 * s, 13 * s, 12 * s, 15 * s, 3 * s);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1.1 * s;
      inkLine(ctx, rng, 16 * s, 18 * s, 28 * s, 18 * s, 0.3 * s);
      ctx.beginPath();
      ctx.arc(22 * s, 13 * s, 3 * s, Math.PI, 0);
      ctx.stroke();
    }
  }
  return c;
}

function ctxFor(width: number, height: number, tile: number): [HTMLCanvasElement, CanvasRenderingContext2D, number] {
  const s = tile / 32;
  const [c, ctx] = canvas(Math.ceil(width * s), Math.ceil(height * s));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  return [c, ctx, s];
}

/** Ink blot left where a horror falls. */
export function drawSplat(tile: number, seed: string): HTMLCanvasElement {
  const [c, ctx, s] = ctxFor(40, 32, tile);
  const rng = new Rng(seed);
  ctx.fillStyle = 'rgba(33, 27, 23, 0.75)';
  ctx.beginPath();
  ctx.ellipse(20 * s, 16 * s, 11 * s, 8 * s, rng.range(0, Math.PI), 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(10, 17);
    ctx.beginPath();
    ctx.arc(20 * s + Math.cos(a) * d * s, 16 * s + Math.sin(a) * d * 0.7 * s, rng.range(0.8, 2.6) * s, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** The mourner's ink spit. */
export function drawProjectile(tile: number): HTMLCanvasElement {
  const [c, ctx, s] = ctxFor(14, 14, tile);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(7 * s, 7 * s, 4.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BLOOD;
  ctx.beginPath();
  ctx.arc(6 * s, 6 * s, 1.6 * s, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
