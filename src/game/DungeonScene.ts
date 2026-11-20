import Phaser from 'phaser';
import type { Point } from '../core/dungeon';
import type { EnemyKind } from '../core/enemies';
import { isFloor } from '../core/dungeon';
import { castWallRay } from '../core/geometry';
import { COMBAT, NO_INPUT, type ControlInput, type Enemy, type World, type WorldEvent } from '../core/world';
import type { StringKey } from '../i18n/i18n';
import {
  drawItem,
  drawLevel,
  drawLightMask,
  drawProjectile,
  drawSplat,
  DARK,
} from './art';
import { drawEnemySheet, drawHeroSheet, ENEMY_SIZE, FLAME_ANCHOR, type SpriteSheet } from './sprites';

/** Height of each horror's head above its feet, in tiles (for the wax flame). */
const EYE_HEIGHT: Record<EnemyKind, number> = { crawler: 0.3, husk: 1.2, mourner: 1.2, snuffer: 1.3 };

/** World units per tile. */
export const TILE = 32;
/** The art is drawn at a higher resolution so ink lines stay crisp when zoomed in. */
const ART_SCALE = 2;
/** The level art is split in blocks: phones cannot hold one texture that big. */
const ART_CHUNKS = 2;
const LIGHT_MASK_SIZE = 512;
/** Fraction of the mask's half-size where the light is fully gone. */
const LIGHT_EDGE = 0.93;
/** The vision cut-out lives in a small texture that follows the hero, softened with a blur. */
const VISION_PER_TILE = 48;
const VISION_SPAN = 18;
/** Height of a wall's front face inside its tile, in tiles (3/4 view). */
const WALL_FACE = 0.7;
/** Height of the flame above the hero's feet, in tiles: where light and sight start from. */
const LIGHT_HEIGHT = 0.45;
/** Warm tint of the flame over everything it lights. */
const LIGHT_TINT = 0xf6d6a6;
/** The pale of the horrors' eyes, as drawn in their sprites. */
const EYE_HEX = 0xece2cb;
const EYE_SCALE = 1.5;
const DARK_HEX = 0x110e0c;
/** How many tiles fit across the shortest side of the screen. */
const VIEW_TILES = 9.5;
const INK_HEX = 0x211b17;
const BLOOD_HEX = 0x8b2a1f;
const FLAME_HEX = 0xd9822b;
const ENEMY_KINDS: EnemyKind[] = ['crawler', 'husk', 'mourner', 'snuffer'];

export interface SceneHost {
  world: World;
  readonly input: ControlInput;
  readonly paused: boolean;
  onEvents(events: WorldEvent[]): void;
  onToast(key: StringKey): void;
}

const PICKUP_TOAST: Record<string, StringKey> = {
  food: 'pickupFood',
  water: 'pickupWater',
  oil: 'pickupOil',
};

interface Effect {
  kind: 'swing' | 'ring' | 'drop' | 'spark' | 'slash';
  pos: Point;
  ttl: number;
  life: number;
  facing?: Point;
  arc?: number;
  radius?: number;
  vel?: Point;
  color?: number;
}

const px = (tiles: number) => tiles * TILE;

export class DungeonScene extends Phaser.Scene {
  private host!: SceneHost;
  private player!: Phaser.GameObjects.Image;
  private lightMask!: Phaser.GameObjects.Image;
  private darkFrame!: Phaser.GameObjects.Graphics;
  private eyes!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Graphics;
  private flame!: Phaser.GameObjects.Graphics;
  private sheets = new Map<string, SpriteSheet>();
  /** Distance walked, to pick walk frames; and the same per horror. */
  private walked = 0;
  private lastPlayer: Point = { x: 0, y: 0 };
  private enemyWalk = new Map<number, { walked: number; last: Point }>();
  private emberTimer = 0;
  private vision!: Phaser.GameObjects.RenderTexture;
  private visionGfx!: Phaser.GameObjects.Graphics;
  private visionAngle = 0;
  private tint!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private itemSprites = new Map<number, Phaser.GameObjects.Image>();
  private enemySprites = new Map<number, Phaser.GameObjects.Image>();
  private projectileSprites = new Map<number, Phaser.GameObjects.Image>();
  private flashUntil = new Map<number, number>();
  private playerFlashUntil = 0;
  private effects: Effect[] = [];
  private flickerTime = 0;
  private splatCount = 0;
  private lastDust = 0;

  constructor() {
    super('dungeon');
  }

  init(data: { host: SceneHost }): void {
    this.host = data.host;
  }

  create(): void {
    const world = this.host.world;
    const level = world.level;
    this.ensureSharedTextures();
    this.effects = [];
    this.itemSprites.clear();
    this.enemySprites.clear();
    this.projectileSprites.clear();
    this.flashUntil.clear();

    this.addLevelArt();

    for (const item of level.items) {
      if (!world.taken.has(item.id)) this.addItemSprite(item.id, item.kind, item.x, item.y);
    }

    for (const enemy of world.enemies) {
      if (enemy.state === 'dead') continue;
      const sprite = this.add
        .image(px(enemy.pos.x), px(enemy.pos.y), `enemy-${enemy.kind}`, 'idle0')
        .setOrigin(0.5, ENEMY_SIZE[enemy.kind].originY)
        .setScale(1 / ART_SCALE)
        .setAlpha(0);
      this.enemySprites.set(enemy.id, sprite);
    }

    const heroKey = `hero-${world.classId}`;
    const heroSheet = this.sheets.get(heroKey)!;
    this.player = this.add
      .image(0, 0, heroKey, 'idle0')
      .setOrigin(heroSheet.originX, heroSheet.originY)
      .setScale(1 / ART_SCALE);
    this.fx = this.add.graphics().setDepth(2.6);
    this.ground = this.add.graphics().setDepth(1.5);
    this.flame = this.add.graphics();
    this.walked = 0;
    this.lastPlayer = { ...world.player };
    this.enemyWalk.clear();

    // Darkness outside what the hero sees, with soft edges.
    this.vision = this.add
      .renderTexture(0, 0, VISION_SPAN * VISION_PER_TILE, VISION_SPAN * VISION_PER_TILE)
      .setOrigin(0)
      .setScale(TILE / VISION_PER_TILE)
      .setDepth(3.9);
    this.visionGfx = this.make.graphics({}, false);
    this.tint = this.add.graphics().setDepth(3.8).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.visionAngle = Math.atan2(world.facing.y, world.facing.x);

    // Outside the flame there is nothing: the mask fades to ink and a frame covers the rest.
    this.lightMask = this.add.image(0, 0, 'light-mask').setDepth(4);
    this.darkFrame = this.add.graphics().setDepth(4);
    this.eyes = this.add.graphics().setDepth(4.7);

    const camera = this.cameras.main;
    camera.setBackgroundColor(DARK);
    camera.setBounds(-TILE * 4, -TILE * 4, (level.width + 8) * TILE, (level.height + 8) * TILE);
    camera.startFollow(this.player, false, 0.15, 0.15);
    this.fitZoom();
    this.scale.on('resize', this.fitZoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fitZoom, this));

    this.handleEvents(world.update(0, NO_INPUT));
    this.syncAll(0);
  }

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const world = this.host.world;
    if (!this.host.paused && !world.dead) this.handleEvents(world.update(dt, this.host.input));
    this.syncAll(this.host.paused ? 0 : dt, time);
  }

  // Events ------------------------------------------------------------------

  private handleEvents(events: WorldEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'revealed':
          break;
        case 'pickup':
          this.itemSprites.get(event.itemId)?.destroy();
          this.itemSprites.delete(event.itemId);
          this.host.onToast(PICKUP_TOAST[event.kind]);
          break;
        case 'drop':
          this.addItemSprite(event.item.id, event.item.kind, event.item.x, event.item.y);
          break;
        case 'attack':
          this.effects.push({
            kind: 'swing',
            pos: event.pos,
            facing: event.facing,
            arc: event.arc,
            radius: event.range,
            ttl: event.finisher ? 0.26 : 0.18,
            life: event.finisher ? 0.26 : 0.18,
            color: event.finisher ? BLOOD_HEX : INK_HEX,
          });
          break;
        case 'enemyHit':
          if (event.burn) {
            this.splatter(event.pos, 2, FLAME_HEX);
            break;
          }
          this.flashUntil.set(event.id, this.time.now + 90);
          this.splatter(event.pos, event.crit ? 10 : 5, event.crit ? BLOOD_HEX : INK_HEX);
          if (event.crit) this.cameras.main.shake(90, 0.004);
          break;
        case 'heal':
          this.effects.push({ kind: 'ring', pos: this.host.world.player, radius: 0.6, ttl: 0.4, life: 0.4, color: BLOOD_HEX });
          break;
        case 'executed':
          this.host.onToast('executed');
          break;
        case 'enemyDied': {
          const sprite = this.enemySprites.get(event.id);
          if (sprite) {
            this.tweens.add({ targets: sprite, alpha: 0, scaleY: 0.2, duration: 260, onComplete: () => sprite.destroy() });
            this.enemySprites.delete(event.id);
          }
          const key = `splat-${this.splatCount++ % 4}`;
          this.add.image(px(event.pos.x), px(event.pos.y), key).setScale(1 / ART_SCALE).setDepth(0.5).setAlpha(0.85);
          this.splatter(event.pos, 14, INK_HEX);
          break;
        }
        case 'playerHit':
          this.playerFlashUntil = this.time.now + 140;
          this.cameras.main.shake(140, 0.006);
          this.splatter(this.host.world.player, 6, BLOOD_HEX);
          if (event.lightStolen > 0) this.host.onToast('lightStolen');
          break;
        case 'parry':
          this.effects.push({ kind: 'spark', pos: this.host.world.player, ttl: 0.3, life: 0.3 });
          this.cameras.main.shake(80, 0.003);
          this.host.onToast('parry');
          break;
        case 'dodge':
          break;
        case 'special':
          if (event.kind === 'flare') {
            this.effects.push({ kind: 'ring', pos: event.pos, radius: event.radius, ttl: 0.45, life: 0.45, color: FLAME_HEX });
            this.cameras.main.flash(120, 217, 130, 43);
          } else if (event.kind === 'shadowStep') {
            this.splatter(event.pos, 12, INK_HEX);
          } else if (event.kind === 'execution' && event.target) {
            this.effects.push({ kind: 'slash', pos: event.target, ttl: 0.4, life: 0.4 });
            this.cameras.main.shake(160, 0.008);
          }
          break;
        case 'died':
          this.playerFlashUntil = this.time.now + 400;
          break;
      }
    }
    this.host.onEvents(events);
  }

  private splatter(pos: Point, count: number, color: number): void {
    for (let i = 0; i < count; i++) {
      // Purely cosmetic jitter: derived from a counter, not from game randomness.
      const a = (i / count) * Math.PI * 2 + this.splatCount * 1.7 + i * 0.37;
      const speed = 1.5 + ((i * 7) % 5) * 0.6;
      this.effects.push({
        kind: 'drop',
        pos: { ...pos },
        vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
        ttl: 0.35,
        life: 0.35,
        color,
      });
    }
    this.splatCount++;
  }

  // Sync --------------------------------------------------------------------

  private syncAll(dt: number, time = this.time.now): void {
    this.syncPlayer(time);
    this.syncEnemies(time);
    this.syncItems();
    this.syncProjectiles();
    this.syncLight(dt);
    this.drawEffects(dt);
    this.drawEyes();
  }

  private syncPlayer(time: number): void {
    const world = this.host.world;
    this.player.setPosition(px(world.player.x), px(world.player.y));
    // The hero always shows over the darkness, as a silhouette against it.
    this.player.setDepth(4.6);
    if (Math.abs(world.facing.x) > 0.1) this.player.setFlipX(world.facing.x < 0);

    // Pick the frame: attack poses, walking by distance covered, or breathing.
    const moved = Math.hypot(world.player.x - this.lastPlayer.x, world.player.y - this.lastPlayer.y);
    this.lastPlayer = { ...world.player };
    this.walked += moved;
    const action = world.action;
    let frame: string;
    if (action.type === 'attack') frame = action.phase === 'windup' ? 'attack0' : 'attack1';
    else if (action.type === 'special') frame = 'attack0';
    else if (moved > 0.002) frame = `walk${Math.floor(this.walked / 0.32) % 4}`;
    else frame = `idle${Math.floor(time / 600) % 2}`;
    if (this.player.frame.name !== frame) this.player.setFrame(frame);
    let alpha = 1;
    if (world.invisible) alpha = 0.3;
    else if (world.invulnerableTimer > 0) alpha = 0.6;
    this.player.setAlpha(alpha);
    if (time < this.playerFlashUntil) this.player.setTint(BLOOD_HEX).setTintMode(Phaser.TintModes.FILL);
    else this.player.clearTint();
  }

  private syncEnemies(time: number): void {
    for (const enemy of this.host.world.enemies) {
      const sprite = this.enemySprites.get(enemy.id);
      if (!sprite || enemy.state === 'dead') continue;
      let x = px(enemy.pos.x);
      const y = px(enemy.pos.y);
      if (enemy.state === 'windup') x += Math.sin(time / 25) * 1.5;
      const walk = this.enemyWalk.get(enemy.id) ?? { walked: 0, last: { ...enemy.pos } };
      const moved = Math.hypot(enemy.pos.x - walk.last.x, enemy.pos.y - walk.last.y);
      walk.walked += moved;
      walk.last = { ...enemy.pos };
      this.enemyWalk.set(enemy.id, walk);
      const stride = enemy.kind === 'crawler' ? 0.18 : enemy.kind === 'husk' ? 0.45 : 0.3;
      const frame =
        enemy.state === 'windup'
          ? 'windup'
          : moved > 0.001
            ? `move${Math.floor(walk.walked / stride) % 4}`
            : `idle${Math.floor((time + enemy.id * 137) / 700) % 2}`;
      if (sprite.frame.name !== frame) sprite.setFrame(frame);
      // Marked horrors show through the darkness.
      const tile = Math.floor(enemy.pos.y) * this.host.world.level.width + Math.floor(enemy.pos.x);
      const throughDark = enemy.wax > 0 && !this.host.world.visibleNow.has(tile);
      sprite.setPosition(x, y).setDepth(throughDark ? 4.5 : 2 + enemy.pos.y / 1000);
      if (Math.abs(enemy.facing.x) > 0.1) sprite.setFlipX(enemy.facing.x < 0);
      sprite.setRotation(enemy.state === 'stunned' ? Math.sin(time / 80) * 0.25 : 0);
      // Wounded horrors look smudged.
      const wounded = 0.55 + 0.45 * Math.max(0, enemy.health / enemy.def.health);
      const target = enemy.visible ? wounded : 0;
      sprite.setAlpha(Phaser.Math.Linear(sprite.alpha, target, 0.25));
      if (time < (this.flashUntil.get(enemy.id) ?? 0)) sprite.setTint(BLOOD_HEX).setTintMode(Phaser.TintModes.FILL);
      else sprite.clearTint();
    }
  }

  /** Rat eye: nearby items show through the fog for the plunderer. */
  private syncItems(): void {
    const world = this.host.world;
    const sight = world.itemSight;
    if (sight <= 0) return;
    for (const item of world.level.items) {
      const sprite = this.itemSprites.get(item.id);
      if (!sprite) continue;
      const near = Math.hypot(item.x + 0.5 - world.player.x, item.y + 0.5 - world.player.y) <= sight;
      sprite.setDepth(near ? 4.5 : 1).setAlpha(near ? 0.75 : 1);
    }
  }

  private syncProjectiles(): void {
    const alive = new Set<number>();
    for (const p of this.host.world.projectiles) {
      alive.add(p.id);
      let sprite = this.projectileSprites.get(p.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, 'projectile').setScale(1 / ART_SCALE).setDepth(2.4);
        this.projectileSprites.set(p.id, sprite);
      }
      sprite.setPosition(px(p.pos.x), px(p.pos.y) - TILE * 0.3);
      const tile = Math.floor(p.pos.y) * this.host.world.level.width + Math.floor(p.pos.x);
      sprite.setVisible(this.host.world.visibleNow.has(tile));
    }
    for (const [id, sprite] of this.projectileSprites) {
      if (alive.has(id)) continue;
      sprite.destroy();
      this.projectileSprites.delete(id);
    }
  }

  private syncLight(dt: number): void {
    this.flickerTime += dt;
    const t = this.flickerTime;
    const flicker = 1 + Math.sin(t * 9.1) * 0.012 + Math.sin(t * 23.7) * 0.008;
    // One radius for everything: the mask, the cone and its walls all breathe together.
    const radiusTiles = this.host.world.lightRadius * flicker;
    const radius = radiusTiles * TILE;
    const lx = this.player.x;
    const ly = this.player.y - TILE * LIGHT_HEIGHT;
    // The mask is fully dark at LIGHT_EDGE of its half-size: size it so that is the light radius.
    const half = radius / LIGHT_EDGE;
    this.lightMask.setPosition(lx, ly).setScale((half * 2) / LIGHT_MASK_SIZE);

    // Cover everything around the mask with solid darkness.
    const view = this.cameras.main.worldView;
    const pad = TILE * 4;
    const left = view.x - pad;
    const top = view.y - pad;
    const right = view.right + pad;
    const bottom = view.bottom + pad;
    const g = this.darkFrame;
    g.clear();
    g.fillStyle(DARK_HEX, 1);
    // A few pixels of overlap hide the filtered border of the mask texture.
    const inset = 4;
    const x0 = lx - half + inset;
    const x1 = lx + half - inset;
    const y0 = ly - half + inset;
    const y1 = ly + half - inset;
    g.fillRect(left, top, right - left, Math.max(0, y0 - top));
    g.fillRect(left, y1, right - left, Math.max(0, bottom - y1));
    g.fillRect(left, y0, Math.max(0, x0 - left), y1 - y0);
    g.fillRect(x1, y0, Math.max(0, right - x1), y1 - y0);

    this.updateVision(dt, radiusTiles);
  }

  /**
   * What the hero sees: a cone from the hero's body, cut sharply by the walls. Rays stop
   * at the wall they meet; only a wall's front face (seen from below) and columns show
   * inside their tile. Everything else is darkness, and the lit part takes the flame's tint.
   */
  private updateVision(dt: number, reach: number): void {
    const world = this.host.world;
    const level = world.level;
    const origin = { x: world.player.x, y: world.player.y - LIGHT_HEIGHT };

    // The cone turns smoothly toward where the hero faces.
    const target = Math.atan2(world.facing.y, world.facing.x);
    let delta = target - this.visionAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.visionAngle += delta * Math.min(1, dt * 12 || 1);

    // Rays stop exactly where the wall begins. Walls seen from below show their whole
    // front face, and columns their whole shaft, as clean rectangles added afterwards.
    const points: Point[] = [origin];
    const faces = new Map<number, { x: number; y: number; w: number; h: number }>();
    const steps = 96;
    const half = COMBAT.visionCone;
    for (let i = 0; i <= steps; i++) {
      const a = this.visionAngle - half + (2 * half * i) / steps;
      const hit = castWallRay(level, origin, a, reach);
      if (hit.hit) {
        const { tileX: tx, tileY: ty } = hit;
        const key = ty * level.width + tx;
        const column =
          isFloor(level, tx - 1, ty) && isFloor(level, tx + 1, ty) && isFloor(level, tx, ty - 1) && isFloor(level, tx, ty + 1);
        if (column) faces.set(key, { x: tx + 0.17, y: ty - 0.22, w: 0.66, h: 1.22 });
        else if (hit.horizontal && Math.sin(a) < 0 && isFloor(level, tx, ty + 1)) {
          faces.set(key, { x: tx, y: ty + 1 - WALL_FACE, w: 1, h: WALL_FACE });
        }
      }
      points.push({ x: origin.x + Math.cos(a) * hit.enter, y: origin.y + Math.sin(a) * hit.enter });
    }

    const ox = world.player.x - VISION_SPAN / 2;
    const oy = world.player.y - VISION_SPAN / 2;
    const k = VISION_PER_TILE;
    const g = this.visionGfx;
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    points.forEach((p, i) => (i === 0 ? g.moveTo((p.x - ox) * k, (p.y - oy) * k) : g.lineTo((p.x - ox) * k, (p.y - oy) * k)));
    g.closePath();
    g.fillPath();
    for (const f of faces.values()) g.fillRect((f.x - ox) * k, (f.y - oy) * k, f.w * k, f.h * k);
    this.vision.setPosition(px(ox), px(oy));
    this.vision.clear();
    this.vision.fill(DARK_HEX, 1);
    this.vision.erase(g);
    this.vision.render();

    const tint = this.tint;
    tint.clear();
    tint.fillStyle(LIGHT_TINT, 1);
    tint.beginPath();
    points.forEach((p, i) => (i === 0 ? tint.moveTo(px(p.x), px(p.y)) : tint.lineTo(px(p.x), px(p.y))));
    tint.closePath();
    tint.fillPath();
    for (const f of faces.values()) tint.fillRect(px(f.x), px(f.y), px(f.w), px(f.h));
  }

  /** Soft shadows under everyone, and the hero's living flame with rising embers. */
  private drawGroundAndFlame(dt: number): void {
    const world = this.host.world;
    const g = this.ground;
    g.clear();
    g.fillStyle(DARK_HEX, 0.28);
    g.fillEllipse(this.player.x, this.player.y, 22, 7);
    for (const enemy of world.enemies) {
      if (enemy.state === 'dead' || !enemy.visible) continue;
      const w = enemy.kind === 'husk' ? 34 : enemy.kind === 'crawler' ? 30 : 20;
      g.fillEllipse(px(enemy.pos.x), px(enemy.pos.y), w, w * 0.3);
    }

    const f = this.flame;
    f.clear();
    const light = world.survival.light;
    if (light <= 0 || world.invisible) return;
    const anchor = FLAME_ANCHOR[world.classId];
    const flip = this.player.flipX ? -1 : 1;
    const bob = this.player.frame.name === 'idle1' ? 0.7 : this.player.frame.name.startsWith('walk') && Number(this.player.frame.name.slice(4)) % 2 === 1 ? -1 : 0;
    const fx = this.player.x + anchor.x * flip;
    const fy = this.player.y + anchor.y + bob;
    const t = this.time.now / 1000;
    const size = 0.55 + 0.45 * Math.sqrt(light / 100);
    const sway = Math.sin(t * 11) * 1.2 + Math.sin(t * 17.3) * 0.6;
    f.setDepth(this.player.depth + 0.0001);
    f.fillStyle(FLAME_HEX, 0.25);
    f.fillCircle(fx, fy - 2 * size, 7 * size);
    f.fillStyle(FLAME_HEX, 0.95);
    f.fillTriangle(fx - 3.2 * size, fy, fx + 3.2 * size, fy, fx + sway, fy - 10 * size);
    f.fillCircle(fx, fy - 1, 3.2 * size);
    f.fillStyle(0xf6dc9c, 1);
    f.fillTriangle(fx - 1.5 * size, fy, fx + 1.5 * size, fy, fx + sway * 0.6, fy - 6 * size);

    this.emberTimer -= dt;
    if (this.emberTimer <= 0) {
      this.emberTimer = 0.12 + (1 - size) * 0.3;
      const k = (t * 7.3) % 1;
      this.effects.push({
        kind: 'drop',
        pos: { x: fx / TILE, y: (fy - 6 * size) / TILE },
        vel: { x: (k - 0.5) * 0.5, y: -0.9 - k * 0.5 },
        ttl: 0.7,
        life: 0.7,
        color: FLAME_HEX,
      });
    }
  }

  /** Eyes glinting in the dark: pale when a horror only watches, red when it hunts. */
  private drawEyes(): void {
    const g = this.eyes;
    g.clear();
    const now = this.time.now;
    for (const enemy of this.host.world.enemies) {
      if (enemy.state === 'dead' || !enemy.watching) continue;
      // Each one blinks now and then, on its own rhythm.
      if ((now / 1000 + enemy.id * 0.73) % 3.7 < 0.14) continue;
      const flip = enemy.facing.x < 0 ? -1 : 1;
      const x = px(enemy.pos.x);
      const y = px(enemy.pos.y);
      // Drawn a bit larger than in the sprites so they read at a glance in the dark.
      const k = EYE_SCALE;
      const at = (dx: number, dy: number) => ({ x: x + dx * flip * k, y: y + dy - (k - 1) * 2 });
      // Same pale color as in the drawings; each horror has its own eyes.
      switch (enemy.kind) {
        case 'crawler': {
          // Three little eyes in an arc, low to the ground.
          for (const [dx, dy, r] of [
            [-3.5, -7.3, 1.1],
            [-1, -8, 0.9],
            [3.5, -7.3, 1.1],
          ]) {
            const p = at(dx, dy);
            g.fillStyle(EYE_HEX, 0.15);
            g.fillCircle(p.x, p.y, r * 2.4 * k);
            g.fillStyle(EYE_HEX, 1);
            g.fillCircle(p.x, p.y, r * k);
          }
          break;
        }
        case 'husk': {
          // A single eye, high up and off to one side.
          const p = at(-10.5, -39.7);
          g.fillStyle(EYE_HEX, 0.15);
          g.fillCircle(p.x, p.y, 3.4 * k);
          g.fillStyle(EYE_HEX, 1);
          g.fillCircle(p.x, p.y, 1.3 * k);
          break;
        }
        case 'mourner': {
          // Two sorrowful slits, slanting down to the sides.
          g.lineStyle(1.3 * k, EYE_HEX, 1);
          const a = at(-0.6, -40.4);
          const b = at(-2.6, -39.3);
          const c = at(0.6, -40.4);
          const d = at(2.6, -39.3);
          g.lineBetween(a.x, a.y, b.x, b.y);
          g.lineBetween(c.x, c.y, d.x, d.y);
          break;
        }
        case 'snuffer': {
          // Two pinpricks, close together.
          for (const dx of [-1.5, 1.5]) {
            const p = at(dx, -42.3);
            g.fillStyle(EYE_HEX, 1);
            g.fillCircle(p.x, p.y, 0.8 * k);
          }
          break;
        }
      }
    }
  }

  private drawEffects(dt: number): void {
    const g = this.fx;
    const world = this.host.world;
    g.clear();

    // Telegraphs: what each horror is about to do.
    for (const enemy of world.enemies) {
      if (enemy.state !== 'windup' || !enemy.visible) continue;
      this.drawTelegraph(g, enemy);
    }

    this.drawGroundAndFlame(dt);

    // Burning wax: a small flame over each marked horror.
    for (const enemy of world.enemies) {
      if (enemy.state === 'dead' || enemy.wax <= 0) continue;
      const flicker = Math.sin(this.time.now / 60 + enemy.id) * 1.5;
      g.fillStyle(FLAME_HEX, 0.85);
      g.fillEllipse(px(enemy.pos.x), px(enemy.pos.y) - TILE * (EYE_HEIGHT[enemy.kind] + 0.35) + flicker, 5, 8);
    }

    // Running kicks up dust.
    if (world.running && Math.floor(this.time.now / 70) !== this.lastDust) {
      this.lastDust = Math.floor(this.time.now / 70);
      this.effects.push({
        kind: 'drop',
        pos: { x: world.player.x - world.facing.x * 0.3, y: world.player.y + 0.1 },
        vel: { x: -world.facing.x * 0.6, y: -0.3 },
        ttl: 0.4,
        life: 0.4,
        color: 0x6b5f52,
      });
    }

    this.effects = this.effects.filter((e) => {
      e.ttl -= dt;
      if (e.ttl <= 0) return false;
      const k = e.ttl / e.life;
      const x = px(e.pos.x);
      const y = px(e.pos.y);
      switch (e.kind) {
        case 'swing': {
          const facing = e.facing!;
          const angle = Math.atan2(facing.y, facing.x);
          g.lineStyle(e.color === BLOOD_HEX ? 5 : 3, e.color ?? INK_HEX, 0.8 * k);
          g.beginPath();
          g.arc(x, y, px(e.radius!) * (1.05 - 0.25 * k), angle - e.arc! / 2, angle + e.arc! / 2);
          g.strokePath();
          break;
        }
        case 'ring':
          g.lineStyle(4 * k + 1, e.color!, 0.8 * k);
          g.strokeCircle(x, y, px(e.radius!) * (1.1 - 0.4 * k));
          break;
        case 'drop':
          e.pos = { x: e.pos.x + e.vel!.x * dt, y: e.pos.y + e.vel!.y * dt };
          g.fillStyle(e.color!, k);
          g.fillCircle(x, y, 1.5 + 2 * k);
          break;
        case 'slash': {
          // A heavy diagonal cut across the target.
          const len = TILE * 0.9 * (1.2 - 0.2 * k);
          g.lineStyle(6 * k + 1, BLOOD_HEX, k);
          g.lineBetween(x - len, y - TILE * 0.9 - len, x + len, y - TILE * 0.9 + len);
          break;
        }
        case 'spark':
          g.lineStyle(2.5, FLAME_HEX, k);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const r0 = 6 + (1 - k) * 10;
            const r1 = r0 + 8;
            g.lineBetween(x + Math.cos(a) * r0, y - TILE * 0.4 + Math.sin(a) * r0, x + Math.cos(a) * r1, y - TILE * 0.4 + Math.sin(a) * r1);
          }
          break;
      }
      return true;
    });
  }

  private drawTelegraph(g: Phaser.GameObjects.Graphics, enemy: Enemy): void {
    const x = px(enemy.pos.x);
    const y = px(enemy.pos.y);
    const progress = 1 - Math.max(0, enemy.timer) / enemy.def.windup;
    // An exclamation mark in red ink over its head.
    g.lineStyle(3, BLOOD_HEX, 0.9);
    g.lineBetween(x, y - TILE * 1.45, x, y - TILE * 1.15);
    g.fillStyle(BLOOD_HEX, 0.9);
    g.fillCircle(x, y - TILE * 1.02, 2);
    if (enemy.def.ranged) {
      const world = this.host.world;
      g.lineStyle(1.5, BLOOD_HEX, 0.25 + 0.5 * progress);
      g.lineBetween(x, y - TILE * 0.3, px(world.player.x), px(world.player.y) - TILE * 0.3);
      return;
    }
    // The area the blow will cover, filling up as it charges.
    const angle = Math.atan2(enemy.strikeDir.y, enemy.strikeDir.x);
    const half = enemy.kind === 'husk' ? Math.PI / 1.5 : Math.PI / 2.4;
    const reach = px(enemy.def.range + 0.35);
    g.fillStyle(BLOOD_HEX, (enemy.def.parryable ? 0.12 : 0.2) + 0.25 * progress);
    g.slice(x, y, reach * (0.4 + 0.6 * progress), angle - half, angle + half, false);
    g.fillPath();
    if (!enemy.def.parryable) {
      g.lineStyle(2, BLOOD_HEX, 0.7);
      g.beginPath();
      g.arc(x, y, reach, angle - half, angle + half);
      g.strokePath();
    }
  }

  // Helpers -----------------------------------------------------------------

  /** The level art, drawn once per level at high resolution and split into blocks. */
  private addLevelArt(): void {
    const level = this.host.world.level;
    const key = `level-${level.seed}-${level.depth}`;
    if (!this.textures.exists(`${key}-0-0`)) {
      const full = drawLevel(level, TILE * ART_SCALE);
      const w = Math.ceil(full.width / ART_CHUNKS);
      const h = Math.ceil(full.height / ART_CHUNKS);
      for (let cy = 0; cy < ART_CHUNKS; cy++) {
        for (let cx = 0; cx < ART_CHUNKS; cx++) {
          // Two pixels of overlap hide the seams between blocks.
          const cw = Math.min(w + 2, full.width - cx * w);
          const ch = Math.min(h + 2, full.height - cy * h);
          const chunk = document.createElement('canvas');
          chunk.width = cw;
          chunk.height = ch;
          chunk.getContext('2d')!.drawImage(full, cx * w, cy * h, cw, ch, 0, 0, cw, ch);
          this.textures.addCanvas(`${key}-${cx}-${cy}`, chunk);
        }
      }
      full.width = 0;
      full.height = 0;
    }
    const w = (level.width * TILE * ART_SCALE) / ART_CHUNKS;
    const h = (level.height * TILE * ART_SCALE) / ART_CHUNKS;
    for (let cy = 0; cy < ART_CHUNKS; cy++) {
      for (let cx = 0; cx < ART_CHUNKS; cx++) {
        this.add
          .image((Math.ceil(w) * cx) / ART_SCALE, (Math.ceil(h) * cy) / ART_SCALE, `${key}-${cx}-${cy}`)
          .setOrigin(0)
          .setScale(1 / ART_SCALE)
          .setDepth(0);
      }
    }
  }

  private addItemSprite(id: number, kind: string, x: number, y: number): void {
    const sprite = this.add
      .image(px(x + 0.5), px(y + 0.5), `item-${kind}`)
      .setScale(1 / ART_SCALE)
      .setDepth(1);
    this.itemSprites.set(id, sprite);
  }

  private fitZoom(): void {
    const { width, height } = this.scale.gameSize;
    // Show about 11 tiles across the shortest side of the screen.
    const zoom = Phaser.Math.Clamp(Math.min(width, height) / (TILE * VIEW_TILES), 0.75, 6);
    this.cameras.main.setZoom(zoom);
  }

  /** Registers a sprite sheet once, with one named frame per pose. */
  private addSheet(key: string, make: () => SpriteSheet): void {
    if (this.textures.exists(key)) {
      if (!this.sheets.has(key)) this.sheets.set(key, make());
      return;
    }
    const sheet = make();
    this.sheets.set(key, sheet);
    const texture = this.textures.addCanvas(key, sheet.canvas)!;
    sheet.frames.forEach((name, i) => texture.add(name, 0, i * sheet.frameWidth, 0, sheet.frameWidth, sheet.frameHeight));
  }

  private ensureSharedTextures(): void {
    const add = (key: string, make: () => HTMLCanvasElement) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, make());
    };
    const artTile = TILE * ART_SCALE;
    add('light-mask', () => drawLightMask(LIGHT_MASK_SIZE, LIGHT_EDGE));
    for (const classId of ['headsman', 'plunderer', 'candlebearer'] as const) {
      this.addSheet(`hero-${classId}`, () => drawHeroSheet(classId, artTile));
    }
    add('projectile', () => drawProjectile(artTile));
    for (const kind of ['food', 'water', 'oil'] as const) add(`item-${kind}`, () => drawItem(kind, artTile));
    for (const kind of ENEMY_KINDS) this.addSheet(`enemy-${kind}`, () => drawEnemySheet(kind, artTile));
    for (let i = 0; i < 4; i++) add(`splat-${i}`, () => drawSplat(artTile, `splat-${i}`));
  }
}
