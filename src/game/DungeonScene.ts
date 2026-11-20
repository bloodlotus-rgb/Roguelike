import Phaser from 'phaser';
import type { Point } from '../core/dungeon';
import type { EnemyKind } from '../core/enemies';
import { NO_INPUT, type ControlInput, type Enemy, type World, type WorldEvent } from '../core/world';
import type { StringKey } from '../i18n/i18n';
import {
  drawBrush,
  drawEnemy,
  drawItem,
  drawLevel,
  drawLightMask,
  drawDarkness,
  drawPlayer,
  drawProjectile,
  drawSplat,
  DARK,
} from './art';
import { isFloor } from '../core/dungeon';

/** World units per tile. */
export const TILE = 32;
/** The art is drawn at a higher resolution so ink lines stay crisp when zoomed in. */
const ART_SCALE = 1.5;
/** The fog is soft, so it can live in a low-resolution texture. */
const FOG_PER_TILE = 12;
const LIGHT_MASK_SIZE = 1024;
const LIGHT_HOLE = 0.06;
/** Shadows are soft enough for a low-resolution texture too. */
const SHADOW_PER_TILE = 16;
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
  private fog!: Phaser.GameObjects.RenderTexture;
  private lightMask!: Phaser.GameObjects.Image;
  private shadows!: Phaser.GameObjects.RenderTexture;
  private shadowGfx!: Phaser.GameObjects.Graphics;
  private shadowKey = '';
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

    // Level art.
    const levelKey = `level-${level.seed}-${level.depth}`;
    if (!this.textures.exists(levelKey)) this.textures.addCanvas(levelKey, drawLevel(level, TILE * ART_SCALE));
    this.add.image(0, 0, levelKey).setOrigin(0).setScale(1 / ART_SCALE).setDepth(0);

    for (const item of level.items) {
      if (!world.taken.has(item.id)) this.addItemSprite(item.id, item.kind, item.x, item.y);
    }

    for (const enemy of world.enemies) {
      if (enemy.state === 'dead') continue;
      const sprite = this.add
        .image(px(enemy.pos.x), px(enemy.pos.y), `enemy-${enemy.kind}`)
        .setOrigin(0.5, 0.85)
        .setScale(1 / ART_SCALE)
        .setAlpha(0);
      this.enemySprites.set(enemy.id, sprite);
    }

    this.player = this.add.image(0, 0, 'player').setOrigin(0.5, 0.85).setScale(1 / ART_SCALE);
    this.fx = this.add.graphics().setDepth(2.6);

    // Fog: paper over everything not yet seen.
    const fogScale = TILE / FOG_PER_TILE;
    this.fog = this.add
      .renderTexture(0, 0, level.width * FOG_PER_TILE, level.height * FOG_PER_TILE)
      .setOrigin(0)
      .setScale(fogScale)
      .setDepth(3);
    this.fog.repeat('darkness', undefined, 0, 0, this.fog.width, this.fog.height);
    const explored: number[] = [];
    world.explored.forEach((seen, index) => {
      if (seen) explored.push(index);
    });
    this.eraseFog(explored);

    // Shadows cast by walls and columns inside the light.
    this.shadows = this.add
      .renderTexture(0, 0, level.width * SHADOW_PER_TILE, level.height * SHADOW_PER_TILE)
      .setOrigin(0)
      .setScale(TILE / SHADOW_PER_TILE)
      .setDepth(3.9)
      .setAlpha(0.8);
    this.shadowGfx = this.make.graphics({}, false);
    this.shadowKey = '';

    this.lightMask = this.add.image(0, 0, 'light-mask').setDepth(4);

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
          this.eraseFog(event.tiles);
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
  }

  private syncPlayer(time: number): void {
    const world = this.host.world;
    this.player.setPosition(px(world.player.x), px(world.player.y));
    this.player.setDepth(2 + world.player.y / 1000);
    if (Math.abs(world.facing.x) > 0.1) this.player.setFlipX(world.facing.x < 0);
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
      // Marked horrors show through the fog.
      const tile = Math.floor(enemy.pos.y) * this.host.world.level.width + Math.floor(enemy.pos.x);
      const throughFog = enemy.wax > 0 && !this.host.world.visibleNow.has(tile);
      sprite.setPosition(x, y).setDepth(throughFog ? 3.5 : 2 + enemy.pos.y / 1000);
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
      sprite.setDepth(near ? 3.5 : 1).setAlpha(near ? 0.85 : 1);
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
    const radius = this.host.world.lightRadius * TILE * flicker;
    const scale = radius / ((LIGHT_MASK_SIZE / 2) * LIGHT_HOLE);
    // The ragged edge crawls slowly.
    this.lightMask
      .setPosition(this.player.x, this.player.y - TILE * 0.3)
      .setScale(scale)
      .setRotation(t * 0.07);
    this.updateShadows();
  }

  /**
   * Each wall tile next to the floor casts a shadow away from the flame, starting at its
   * far side so the wall itself stays lit. Redrawn only when the light moves.
   */
  private updateShadows(): void {
    const world = this.host.world;
    const lx = world.player.x;
    const ly = world.player.y - 0.3;
    const radius = world.lightRadius;
    const key = `${lx.toFixed(2)},${ly.toFixed(2)},${radius.toFixed(1)}`;
    if (key === this.shadowKey) return;
    this.shadowKey = key;

    const level = world.level;
    const g = this.shadowGfx;
    g.clear();
    g.fillStyle(DARK_HEX, 1);
    const k = SHADOW_PER_TILE;
    const reach = radius + 1.5;
    const project = (x: number, y: number) => {
      const dx = x - lx;
      const dy = y - ly;
      const d = Math.hypot(dx, dy) || 1e-6;
      const extra = Math.max(0, reach - d);
      return { x: (x + (dx / d) * extra) * k, y: (y + (dy / d) * extra) * k };
    };
    const r = Math.ceil(reach);
    for (let ty = Math.floor(ly) - r; ty <= Math.floor(ly) + r; ty++) {
      for (let tx = Math.floor(lx) - r; tx <= Math.floor(lx) + r; tx++) {
        if (isFloor(level, tx, ty)) continue;
        const nearFloor =
          isFloor(level, tx - 1, ty) || isFloor(level, tx + 1, ty) || isFloor(level, tx, ty - 1) || isFloor(level, tx, ty + 1);
        if (!nearFloor) continue;
        // Back-facing edges: the ones whose outward normal points away from the light.
        const edges: Array<[number, number, number, number]> = [];
        if (ly < ty) edges.push([tx, ty + 1, tx + 1, ty + 1]);
        if (ly > ty + 1) edges.push([tx, ty, tx + 1, ty]);
        if (lx < tx) edges.push([tx + 1, ty, tx + 1, ty + 1]);
        if (lx > tx + 1) edges.push([tx, ty, tx, ty + 1]);
        for (const [x1, y1, x2, y2] of edges) {
          const a = project(x1, y1);
          const b = project(x2, y2);
          g.beginPath();
          g.moveTo(x1 * k, y1 * k);
          g.lineTo(x2 * k, y2 * k);
          g.lineTo(b.x, b.y);
          g.lineTo(a.x, a.y);
          g.closePath();
          g.fillPath();
        }
      }
    }
    this.shadows.clear();
    this.shadows.draw(g);
    this.shadows.render();
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

    // Burning wax: a small flame over each marked horror.
    for (const enemy of world.enemies) {
      if (enemy.state === 'dead' || enemy.wax <= 0) continue;
      const flicker = Math.sin(this.time.now / 60 + enemy.id) * 1.5;
      g.fillStyle(FLAME_HEX, 0.85);
      g.fillEllipse(px(enemy.pos.x), px(enemy.pos.y) - TILE * 1.15 + flicker, 5, 8);
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

  private addItemSprite(id: number, kind: string, x: number, y: number): void {
    const sprite = this.add
      .image(px(x + 0.5), px(y + 0.5), `item-${kind}`)
      .setScale(1 / ART_SCALE)
      .setDepth(1);
    this.itemSprites.set(id, sprite);
  }

  private eraseFog(tiles: number[]): void {
    if (tiles.length === 0) return;
    const width = this.host.world.level.width;
    for (const index of tiles) {
      const x = ((index % width) + 0.5) * FOG_PER_TILE;
      const y = (Math.floor(index / width) + 0.5) * FOG_PER_TILE;
      this.fog.erase('brush', x, y);
    }
    this.fog.render();
  }

  private fitZoom(): void {
    const { width, height } = this.scale.gameSize;
    // Show about 11 tiles across the shortest side of the screen.
    const zoom = Phaser.Math.Clamp(Math.min(width, height) / (TILE * VIEW_TILES), 0.75, 6);
    this.cameras.main.setZoom(zoom);
  }

  private ensureSharedTextures(): void {
    const seed = this.host.world.seed;
    const add = (key: string, make: () => HTMLCanvasElement) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, make());
    };
    const artTile = TILE * ART_SCALE;
    add('darkness', () => drawDarkness(256, seed));
    add('brush', () => drawBrush(FOG_PER_TILE * 2.6));
    add('light-mask', () => drawLightMask(LIGHT_MASK_SIZE, LIGHT_HOLE, 0.8));
    add('player', () => drawPlayer(artTile));
    add('projectile', () => drawProjectile(artTile));
    for (const kind of ['food', 'water', 'oil'] as const) add(`item-${kind}`, () => drawItem(kind, artTile));
    for (const kind of ENEMY_KINDS) add(`enemy-${kind}`, () => drawEnemy(kind, artTile));
    for (let i = 0; i < 4; i++) add(`splat-${i}`, () => drawSplat(artTile, `splat-${i}`));
  }
}
