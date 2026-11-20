/**
 * First-person view, in the spirit of the old grid raycasters: one ray per screen column,
 * textured walls, floor and ceiling, flat sprites that always face the camera.
 *
 * Style (c): low resolution, crisp pixels, but every texture is our ink on paper.
 * Pure presentation: it reads the world and never changes it.
 */
import type { ClassId } from '../core/classes';
import type { Point } from '../core/dungeon';
import type { EnemyKind } from '../core/enemies';
import { castWallRay } from '../core/geometry';
import { Rng } from '../core/rng';
import type { Enemy, World, WorldEvent } from '../core/world';
import { drawItem, drawProjectile } from './art';
import { drawEnemySheet, ENEMY_SIZE, type SpriteSheet } from './sprites';

const TEX = 64;
/** Wall height and eye height, in tiles. */
const WALL_H = 2.2;
const EYE = 1.15;
const PAPER = '#ece2cb';
const INK = '#211b17';
const FLAME = '#d9822b';
/** Warm tint of the flame, as channel multipliers. */
const TINT = [1, 0.84, 0.62] as const;

/** Eye designs per horror, in design units from the feet (same as the top view). */
const EYES: Record<EnemyKind, { h: number; dots: Array<[number, number, number]> }> = {
  crawler: { h: 7.5, dots: [[-3.5, 0.3, 1.1], [-1, -0.4, 0.9], [3.5, 0.3, 1.1]] },
  husk: { h: 39.7, dots: [[-10.5, 0, 1.4]] },
  mourner: { h: 39.8, dots: [[-1.6, 0, 0.9], [1.6, 0, 0.9]] },
  snuffer: { h: 42.3, dots: [[-1.5, 0, 0.7], [1.5, 0, 0.7]] },
};

interface Texture {
  data: Uint8ClampedArray;
}

function makeTexture(paint: (ctx: CanvasRenderingContext2D, rng: Rng) => void, seed: string): Texture {
  const c = document.createElement('canvas');
  c.width = TEX;
  c.height = TEX;
  const ctx = c.getContext('2d')!;
  ctx.lineCap = 'round';
  paint(ctx, new Rng(seed));
  return { data: ctx.getImageData(0, 0, TEX, TEX).data };
}

function wobble(ctx: CanvasRenderingContext2D, rng: Rng, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0 + rng.range(-0.4, 0.4), y0 + rng.range(-0.4, 0.4));
  ctx.lineTo((x0 + x1) / 2 + rng.range(-0.6, 0.6), (y0 + y1) / 2 + rng.range(-0.6, 0.6));
  ctx.lineTo(x1 + rng.range(-0.4, 0.4), y1 + rng.range(-0.4, 0.4));
  ctx.stroke();
}

function paper(ctx: CanvasRenderingContext2D, rng: Rng, base = PAPER): void {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TEX, TEX);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(110, 90, 60, ${rng.range(0.04, 0.12)})`;
    ctx.fillRect(rng.range(0, TEX), rng.range(0, TEX), 1, 1);
  }
}

const WALL = (ctx: CanvasRenderingContext2D, rng: Rng) => {
  paper(ctx, rng);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  const rows = 6;
  const rowH = TEX / rows;
  for (let r = 0; r <= rows; r++) wobble(ctx, rng, 0, r * rowH, TEX, r * rowH);
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : 16;
    for (let x = offset; x < TEX; x += 32) wobble(ctx, rng, x, r * rowH, x, (r + 1) * rowH);
    // Some bricks are shaded with hatching.
    for (let x = offset; x < TEX; x += 32) {
      if (!rng.chance(0.35)) continue;
      ctx.lineWidth = 0.6;
      for (let h = 2; h < 30; h += 3) wobble(ctx, rng, x + h, r * rowH + rowH - 1, x + h + 4, r * rowH + 1);
      ctx.lineWidth = 1;
    }
  }
  // Grime toward the floor.
  const g = ctx.createLinearGradient(0, TEX, 0, TEX * 0.5);
  g.addColorStop(0, 'rgba(33, 27, 23, 0.45)');
  g.addColorStop(1, 'rgba(33, 27, 23, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TEX, TEX);
};

const FLOOR = (ctx: CanvasRenderingContext2D, rng: Rng) => {
  paper(ctx, rng, '#e2d6bb');
  ctx.strokeStyle = 'rgba(33, 27, 23, 0.55)';
  ctx.lineWidth = 1;
  for (const [x, y, w, h] of [
    [1, 1, 30, 30],
    [33, 1, 30, 30],
    [1, 33, 30, 30],
    [33, 33, 30, 30],
  ]) {
    wobble(ctx, rng, x, y, x + w, y);
    wobble(ctx, rng, x + w, y, x + w, y + h);
    wobble(ctx, rng, x + w, y + h, x, y + h);
    wobble(ctx, rng, x, y + h, x, y);
  }
  ctx.strokeStyle = 'rgba(33, 27, 23, 0.4)';
  for (let i = 0; i < 3; i++) {
    let x = rng.range(4, 60);
    let y = rng.range(4, 60);
    for (let k = 0; k < 3; k++) {
      const nx = x + rng.range(-7, 7);
      const ny = y + rng.range(-7, 7);
      wobble(ctx, rng, x, y, nx, ny);
      x = nx;
      y = ny;
    }
  }
};

const CEILING = (ctx: CanvasRenderingContext2D, rng: Rng) => {
  ctx.fillStyle = '#3a3129';
  ctx.fillRect(0, 0, TEX, TEX);
  ctx.strokeStyle = 'rgba(10, 8, 6, 0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, TEX);
    const y = rng.range(0, TEX);
    wobble(ctx, rng, x, y, x + rng.range(-8, 8), y + rng.range(4, 9));
  }
};

const STAIRS = (ctx: CanvasRenderingContext2D, rng: Rng) => {
  FLOOR(ctx, rng);
  ctx.fillStyle = INK;
  ctx.fillRect(10, 10, 44, 44);
  ctx.strokeStyle = PAPER;
  for (let i = 1; i <= 4; i++) wobble(ctx, rng, 10 + i * 4, 12 + i * 8, 54 - i * 4, 12 + i * 8);
};

export class FirstPersonView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private image!: ImageData;
  private W = 0;
  private H = 0;
  private zbuffer = new Float32Array(0);
  private readonly wall = makeTexture(WALL, 'fp-wall');
  private readonly floor = makeTexture(FLOOR, 'fp-floor');
  private readonly ceiling = makeTexture(CEILING, 'fp-ceiling');
  private readonly stairs = makeTexture(STAIRS, 'fp-stairs');
  private readonly enemySheets = new Map<EnemyKind, SpriteSheet>();
  private readonly items = new Map<string, HTMLCanvasElement>();
  private readonly projectile = drawProjectile(64);
  private readonly scratch = document.createElement('canvas');
  private readonly walks = new Map<number, { walked: number; last: Point }>();
  private readonly flashUntil = new Map<number, number>();
  private walked = 0;
  private lastPos: Point = { x: 0, y: 0 };

  constructor(private readonly container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fp-canvas';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    for (const kind of ['crawler', 'husk', 'mourner', 'snuffer'] as const) this.enemySheets.set(kind, drawEnemySheet(kind, 64));
    for (const kind of ['food', 'water', 'oil'] as const) this.items.set(kind, drawItem(kind, 64));
  }

  /** Low resolution on purpose: about 200 to 320 pixels wide, scaled up crisply. */
  private resize(): void {
    const rect = this.container.getBoundingClientRect();
    const aspect = Math.max(0.3, rect.width / Math.max(1, rect.height));
    const W = aspect < 1 ? 200 : 320;
    const H = Math.round(W / aspect);
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.canvas.width = W;
    this.canvas.height = H;
    this.image = this.ctx.createImageData(W, H);
    this.zbuffer = new Float32Array(W);
  }

  render(world: World, events: WorldEvent[], angle: number, now: number): void {
    this.resize();
    const { W, H } = this;
    const level = world.level;
    const pos = world.player;
    for (const e of events) if (e.type === 'enemyHit' && !e.burn) this.flashUntil.set(e.id, now + 90);

    const moved = Math.hypot(pos.x - this.lastPos.x, pos.y - this.lastPos.y);
    this.lastPos = { ...pos };
    this.walked += moved;

    const flicker = 1 + Math.sin(now / 110) * 0.012 + Math.sin(now / 42) * 0.008;
    const R = world.lightRadius * flicker;
    const light = (d: number) => {
      if (d >= R) return 0;
      const t = 1 - d / R;
      return Math.min(1, t * 1.1) ** 1.6;
    };

    const fov = W > H ? (70 * Math.PI) / 180 : (62 * Math.PI) / 180;
    const tanHalf = Math.tan(fov / 2);
    const plane = W / 2 / tanHalf;
    const bob = moved > 0.002 ? Math.sin(this.walked * 9) * H * 0.008 : 0;
    const horizon = H / 2 + bob;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const planeX = -dirY * tanHalf;
    const planeY = dirX * tanHalf;
    const data = this.image.data;

    // Floor and ceiling, row by row.
    const r0x = dirX - planeX;
    const r0y = dirY - planeY;
    const r1x = dirX + planeX;
    const r1y = dirY + planeY;
    for (let y = 0; y < H; y++) {
      const below = y > horizon;
      const p = below ? y - horizon : horizon - y;
      if (p < 0.5) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          data[i] = 17;
          data[i + 1] = 14;
          data[i + 2] = 12;
          data[i + 3] = 255;
        }
        continue;
      }
      const rowDist = ((below ? EYE : WALL_H - EYE) * plane) / p;
      const stepX = (rowDist * (r1x - r0x)) / W;
      const stepY = (rowDist * (r1y - r0y)) / W;
      let fx = pos.x + rowDist * r0x;
      let fy = pos.y + rowDist * r0y;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const d = Math.hypot(fx - pos.x, fy - pos.y);
        const k = light(d) * (below ? 1 : 0.55);
        if (k <= 0.002) {
          data[i] = 17;
          data[i + 1] = 14;
          data[i + 2] = 12;
        } else {
          const tx = Math.floor(fx);
          const ty = Math.floor(fy);
          const tex =
            below && tx === level.stairs.x && ty === level.stairs.y ? this.stairs.data : below ? this.floor.data : this.ceiling.data;
          const u = ((fx - tx) * TEX) | 0;
          const v = ((fy - ty) * TEX) | 0;
          const t = ((v & 63) * TEX + (u & 63)) * 4;
          data[i] = tex[t] * k * TINT[0] + 17 * (1 - k);
          data[i + 1] = tex[t + 1] * k * TINT[1] + 14 * (1 - k);
          data[i + 2] = tex[t + 2] * k * TINT[2] + 12 * (1 - k);
        }
        data[i + 3] = 255;
        fx += stepX;
        fy += stepY;
      }
    }

    // Walls, column by column, with a depth buffer for the sprites.
    for (let x = 0; x < W; x++) {
      const camX = (2 * x) / W - 1;
      const rx = dirX + planeX * camX;
      const ry = dirY + planeY * camX;
      const len = Math.hypot(rx, ry);
      const rayAngle = Math.atan2(ry, rx);
      const hit = castWallRay(level, pos, rayAngle, R + 1);
      if (!hit.hit) {
        this.zbuffer[x] = Infinity;
        continue;
      }
      const perp = hit.enter / len;
      this.zbuffer[x] = perp;
      const top = horizon - ((WALL_H - EYE) * plane) / perp;
      const bottom = horizon + (EYE * plane) / perp;
      const hx = pos.x + (rx / len) * hit.enter;
      const hy = pos.y + (ry / len) * hit.enter;
      let u = hit.horizontal ? hx - Math.floor(hx) : hy - Math.floor(hy);
      if ((hit.horizontal && ry > 0) || (!hit.horizontal && rx < 0)) u = 1 - u;
      const tu = Math.min(TEX - 1, (u * TEX) | 0);
      const k = light(hit.enter) * (hit.horizontal ? 1 : 0.8);
      const y0 = Math.max(0, Math.floor(top));
      const y1 = Math.min(H, Math.ceil(bottom));
      // The wall texture repeats once per tile of height.
      const repeat = WALL_H;
      for (let y = y0; y < y1; y++) {
        const i = (y * W + x) * 4;
        if (k <= 0.002) {
          data[i] = 17;
          data[i + 1] = 14;
          data[i + 2] = 12;
          continue;
        }
        const v = ((((y - top) / (bottom - top)) * repeat * TEX) | 0) & 63;
        const t = (v * TEX + tu) * 4;
        const tex = this.wall.data;
        data[i] = tex[t] * k * TINT[0] + 17 * (1 - k);
        data[i + 1] = tex[t + 1] * k * TINT[1] + 14 * (1 - k);
        data[i + 2] = tex[t + 2] * k * TINT[2] + 12 * (1 - k);
      }
    }
    this.ctx.putImageData(this.image, 0, 0);

    this.drawSprites(world, angle, plane, horizon, light, now);
    this.drawEyes(world, angle, plane, horizon);
    drawHands(this.ctx, W, H, world, now, this.walked, moved > 0.002);
  }

  private project(world: World, angle: number, plane: number, p: Point): { sx: number; z: number } | null {
    const rx = p.x - world.player.x;
    const ry = p.y - world.player.y;
    const z = rx * Math.cos(angle) + ry * Math.sin(angle);
    if (z < 0.2) return null;
    const xr = -rx * Math.sin(angle) + ry * Math.cos(angle);
    return { sx: this.W / 2 + (xr / z) * plane, z };
  }

  private drawSprites(
    world: World,
    angle: number,
    plane: number,
    horizon: number,
    light: (d: number) => number,
    now: number,
  ): void {
    interface Billboard {
      z: number;
      draw: () => void;
    }
    const list: Billboard[] = [];
    const level = world.level;

    const billboard = (
      source: CanvasImageSource,
      sx0: number,
      sw: number,
      sh: number,
      pos: Point,
      heightTiles: number,
      originX: number,
      brightness: number,
      flip: boolean,
      overlay: string | null,
    ) => {
      const pr = this.project(world, angle, plane, pos);
      if (!pr || brightness <= 0.01) return;
      list.push({
        z: pr.z,
        draw: () => this.blit(source, sx0, sw, sh, pr.sx, pr.z, heightTiles, originX, horizon, plane, brightness, flip, overlay),
      });
    };

    for (const item of level.items) {
      if (world.taken.has(item.id)) continue;
      const p = { x: item.x + 0.5, y: item.y + 0.5 };
      const d = Math.hypot(p.x - world.player.x, p.y - world.player.y);
      let b = light(d);
      if (world.itemSight > 0 && d <= world.itemSight) b = Math.max(b, 0.55);
      const img = this.items.get(item.kind)!;
      billboard(img, 0, img.width, img.height, p, 0.6, 0.5, b, false, null);
    }

    for (const enemy of world.enemies) {
      if (enemy.state === 'dead') continue;
      const d = Math.hypot(enemy.pos.x - world.player.x, enemy.pos.y - world.player.y);
      let b = light(d);
      if (enemy.wax > 0) b = Math.max(b, 0.6);
      if (b <= 0.01) continue;
      const sheet = this.enemySheets.get(enemy.kind)!;
      const frame = this.enemyFrame(enemy, now);
      const index = sheet.frames.indexOf(frame);
      const right = { x: -Math.sin(angle), y: Math.cos(angle) };
      const flip = enemy.facing.x * right.x + enemy.facing.y * right.y < 0;
      let overlay: string | null = null;
      if (now < (this.flashUntil.get(enemy.id) ?? 0)) overlay = 'rgba(139, 42, 31, 0.8)';
      else if (enemy.state === 'windup') overlay = 'rgba(139, 42, 31, 0.35)';
      const size = ENEMY_SIZE[enemy.kind];
      billboard(sheet.canvas, index * sheet.frameWidth, sheet.frameWidth, sheet.frameHeight, enemy.pos, size.h / 32, 0.5, b, flip, overlay);
    }

    for (const p of world.projectiles) {
      const d = Math.hypot(p.pos.x - world.player.x, p.pos.y - world.player.y);
      billboard(this.projectile, 0, this.projectile.width, this.projectile.height, p.pos, 0.35, 0.5, Math.max(0.5, light(d)), false, null);
    }

    list.sort((a, b) => b.z - a.z);
    for (const b of list) b.draw();
  }

  /** Draws a lit, depth-tested billboard column by column. */
  private blit(
    source: CanvasImageSource,
    sx0: number,
    sw: number,
    sh: number,
    screenX: number,
    z: number,
    heightTiles: number,
    originX: number,
    horizon: number,
    plane: number,
    brightness: number,
    flip: boolean,
    overlay: string | null,
  ): void {
    // Light the sprite on a scratch canvas: darken toward the edge of the light, warm it, tint it.
    const s = this.scratch;
    s.width = sw;
    s.height = sh;
    const c = s.getContext('2d')!;
    c.clearRect(0, 0, sw, sh);
    c.drawImage(source, sx0, 0, sw, sh, 0, 0, sw, sh);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(255, 190, 120, 0.12)';
    c.fillRect(0, 0, sw, sh);
    if (overlay) {
      c.fillStyle = overlay;
      c.fillRect(0, 0, sw, sh);
    }
    c.fillStyle = `rgba(17, 14, 12, ${1 - brightness})`;
    c.fillRect(0, 0, sw, sh);
    c.globalCompositeOperation = 'source-over';

    const height = (heightTiles * plane) / z;
    const width = height * (sw / sh);
    const bottom = horizon + (EYE * plane) / z;
    const top = bottom - height;
    const left = screenX - width * originX;
    const x0 = Math.max(0, Math.floor(left));
    const x1 = Math.min(this.W, Math.ceil(left + width));
    for (let x = x0; x < x1; x++) {
      if (z >= this.zbuffer[x]) continue;
      let u = (x + 0.5 - left) / width;
      if (flip) u = 1 - u;
      const srcX = Math.min(sw - 1, Math.max(0, Math.floor(u * sw)));
      this.ctx.drawImage(s, srcX, 0, 1, sh, x, top, 1, height);
    }
  }

  /** Eyes in the dark, in the same shapes as in the top view. */
  private drawEyes(world: World, angle: number, plane: number, horizon: number): void {
    const ctx = this.ctx;
    for (const enemy of world.enemies) {
      if (enemy.state === 'dead' || !enemy.watching) continue;
      const pr = this.project(world, angle, plane, enemy.pos);
      if (!pr) continue;
      const col = Math.round(pr.sx);
      if (col < 0 || col >= this.W || pr.z >= this.zbuffer[col]) continue;
      const eyes = EYES[enemy.kind];
      const unit = plane / pr.z / 32;
      const bottom = horizon + (EYE * plane) / pr.z;
      ctx.fillStyle = PAPER;
      for (const [dx, dy, r] of eyes.dots) {
        const x = pr.sx + dx * unit;
        const y = bottom - (eyes.h - dy) * unit;
        if (enemy.kind === 'mourner') {
          ctx.fillRect(x - Math.max(1, r * unit * 1.5), y, Math.max(2, r * unit * 3), Math.max(1, r * unit * 0.8));
        } else {
          const rr = Math.max(0.8, r * unit * 1.4);
          ctx.beginPath();
          ctx.arc(x, y, rr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private enemyFrame(enemy: Enemy, now: number): string {
    const walk = this.walks.get(enemy.id) ?? { walked: 0, last: { ...enemy.pos } };
    const moved = Math.hypot(enemy.pos.x - walk.last.x, enemy.pos.y - walk.last.y);
    walk.walked += moved;
    walk.last = { ...enemy.pos };
    this.walks.set(enemy.id, walk);
    if (enemy.state === 'windup') return 'windup';
    const stride = enemy.kind === 'crawler' ? 0.18 : enemy.kind === 'husk' ? 0.45 : 0.3;
    if (moved > 0.001) return `move${Math.floor(walk.walked / stride) % 4}`;
    return `idle${Math.floor((now + enemy.id * 137) / 700) % 2}`;
  }
}

/** The hero's hands: the light source on the left, the weapon on the right. */
export function drawHands(ctx: CanvasRenderingContext2D, W: number, H: number, world: World, now: number, walked: number, walking: boolean): void {
  const u = Math.min(W, H) / 100;
  const sway = walking ? Math.sin(walked * 9) * u * 1.5 : Math.sin(now / 700) * u * 0.4;
  const lift = walking ? Math.abs(Math.cos(walked * 9)) * u * 1.2 : 0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Light source.
  if (world.survival.light > 0 && !world.invisible) {
    const lx = W * 0.2 + sway;
    const ly = H - u * 22 + lift;
    drawLightSource(ctx, world.classId, lx, ly, u, now, world.survival.light);
  }

  // Weapon, posed by the current action.
  const action = world.action;
  let pose: 'rest' | 'raise' | 'strike' = 'rest';
  if (action.type === 'attack') pose = action.phase === 'windup' ? 'raise' : 'strike';
  else if (action.type === 'special') pose = 'raise';
  const wx = W * 0.74 - sway;
  const wy = H - u * 4 + lift;
  drawWeapon(ctx, world.classId, wx, wy, u, pose);
}

function drawLightSource(ctx: CanvasRenderingContext2D, classId: ClassId, x: number, y: number, u: number, now: number, light: number): void {
  const size = (0.6 + 0.4 * Math.sqrt(light / 100)) * u;
  const flick = Math.sin(now / 60) * size * 0.8;
  // Glow.
  const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 22);
  glow.addColorStop(0, 'rgba(255, 190, 110, 0.35)');
  glow.addColorStop(1, 'rgba(255, 190, 110, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - size * 22, y - size * 22, size * 44, size * 44);
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  ctx.lineWidth = Math.max(1, u * 0.9);
  if (classId === 'candlebearer') {
    ctx.fillRect(x - u * 2, y, u * 4, u * 30);
    ctx.strokeRect(x - u * 2, y, u * 4, u * 30);
  } else if (classId === 'plunderer') {
    ctx.fillStyle = 'rgba(236, 226, 203, 0.35)';
    ctx.fillRect(x - u * 5, y - u * 2, u * 10, u * 12);
    ctx.strokeRect(x - u * 5, y - u * 2, u * 10, u * 12);
    ctx.beginPath();
    ctx.moveTo(x, y - u * 2);
    ctx.lineTo(x, y - u * 8);
    ctx.stroke();
  } else {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.15);
    ctx.fillStyle = '#6b5f52';
    ctx.fillRect(-u * 1.5, 0, u * 3, u * 30);
    ctx.strokeRect(-u * 1.5, 0, u * 3, u * 30);
    ctx.restore();
  }
  // Flame.
  const fy = classId === 'plunderer' ? y + u * 4 : y;
  ctx.fillStyle = FLAME;
  ctx.beginPath();
  ctx.moveTo(x - size * 3, fy);
  ctx.quadraticCurveTo(x + flick, fy - size * 12, x + size * 3, fy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f6dc9c';
  ctx.beginPath();
  ctx.moveTo(x - size * 1.4, fy);
  ctx.quadraticCurveTo(x + flick * 0.6, fy - size * 7, x + size * 1.4, fy);
  ctx.closePath();
  ctx.fill();
}

function drawWeapon(ctx: CanvasRenderingContext2D, classId: ClassId, x: number, y: number, u: number, pose: 'rest' | 'raise' | 'strike'): void {
  const angle = pose === 'rest' ? -0.35 : pose === 'raise' ? -1.0 : 0.55;
  const dx = pose === 'strike' ? -u * 18 : 0;
  const dy = pose === 'raise' ? -u * 6 : pose === 'strike' ? -u * 10 : 0;
  ctx.save();
  ctx.translate(x + dx, y + dy);
  ctx.rotate(angle);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, u * 0.9);
  if (classId === 'headsman') {
    ctx.fillStyle = '#7a6a58';
    ctx.fillRect(-u * 1.6, -u * 34, u * 3.2, u * 40);
    ctx.strokeRect(-u * 1.6, -u * 34, u * 3.2, u * 40);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(u * 1.5, -u * 34);
    ctx.quadraticCurveTo(u * 16, -u * 30, u * 14, -u * 18);
    ctx.lineTo(u * 1.5, -u * 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(u * 14, -u * 31);
    ctx.quadraticCurveTo(u * 16.5, -u * 26, u * 14, -u * 19);
    ctx.stroke();
  } else if (classId === 'plunderer') {
    ctx.fillStyle = INK;
    ctx.fillRect(-u * 1.5, -u * 6, u * 3, u * 10);
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(-u * 2, -u * 6);
    ctx.lineTo(0, -u * 26);
    ctx.lineTo(u * 2, -u * 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(-u * 4, -u * 7, u * 8, u * 1.6);
  } else {
    ctx.fillStyle = '#7a6a58';
    ctx.fillRect(-u * 1.4, -u * 22, u * 2.8, u * 28);
    ctx.strokeRect(-u * 1.4, -u * 22, u * 2.8, u * 28);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(0, -u * 25, u * 5, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * u * 5, -u * 25 + Math.sin(a) * u * 5);
      ctx.lineTo(Math.cos(a) * u * 8, -u * 25 + Math.sin(a) * u * 8);
      ctx.stroke();
    }
  }
  // The fist holding it.
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 4, u * 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * The ink textures as canvases, for other renderers. They are painted directly at the
 * requested size (the drawing is scaled, not the pixels), so lines stay smooth.
 */
export function inkTexture(kind: 'wall' | 'floor' | 'ceiling' | 'stairs', size = TEX): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.scale(size / TEX, size / TEX);
  ctx.lineCap = 'round';
  const paint = { wall: WALL, floor: FLOOR, ceiling: CEILING, stairs: STAIRS }[kind];
  paint(ctx, new Rng(`fp-${kind}`));
  return c;
}
