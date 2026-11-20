import Phaser from 'phaser';
import type { World, WorldEvent } from '../core/world';
import type { StringKey } from '../i18n/i18n';
import { drawBrush, drawItem, drawLevel, drawLightMask, drawPaper, drawPlayer, PAPER } from './art';

/** World units per tile. */
export const TILE = 32;
/** The level art is drawn at a higher resolution so ink lines stay crisp when zoomed in. */
const ART_SCALE = 1.5;
/** The fog is soft, so it can live in a low-resolution texture. */
const FOG_PER_TILE = 12;
const LIGHT_MASK_SIZE = 1024;
const LIGHT_HOLE = 0.06;

export interface SceneHost {
  world: World;
  readonly moveVector: { x: number; y: number };
  readonly paused: boolean;
  onEvents(events: WorldEvent[]): void;
  onToast(key: StringKey): void;
}

const PICKUP_TOAST: Record<string, StringKey> = {
  food: 'pickupFood',
  water: 'pickupWater',
  oil: 'pickupOil',
};

export class DungeonScene extends Phaser.Scene {
  private host!: SceneHost;
  private player!: Phaser.GameObjects.Image;
  private fog!: Phaser.GameObjects.RenderTexture;
  private lightMask!: Phaser.GameObjects.Image;
  private itemSprites = new Map<number, Phaser.GameObjects.Image>();
  private levelKey = '';
  private flickerTime = 0;

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

    // Level art.
    this.levelKey = `level-${level.seed}-${level.depth}`;
    if (!this.textures.exists(this.levelKey)) {
      this.textures.addCanvas(this.levelKey, drawLevel(level, TILE * ART_SCALE));
    }
    this.add.image(0, 0, this.levelKey).setOrigin(0).setScale(1 / ART_SCALE).setDepth(0);

    // Items.
    this.itemSprites.clear();
    for (const item of level.items) {
      if (world.taken.has(item.id)) continue;
      const sprite = this.add
        .image((item.x + 0.5) * TILE, (item.y + 0.5) * TILE, `item-${item.kind}`)
        .setScale(1 / ART_SCALE)
        .setDepth(1);
      this.itemSprites.set(item.id, sprite);
    }

    // Player.
    this.player = this.add.image(0, 0, 'player').setOrigin(0.5, 0.85).setScale(1 / ART_SCALE).setDepth(2);
    this.syncPlayer();

    // Fog: paper over everything not yet seen.
    const fogScale = TILE / FOG_PER_TILE;
    this.fog = this.add
      .renderTexture(0, 0, level.width * FOG_PER_TILE, level.height * FOG_PER_TILE)
      .setOrigin(0)
      .setScale(fogScale)
      .setDepth(3);
    this.fog.repeat('paper', undefined, 0, 0, this.fog.width, this.fog.height);
    const explored: number[] = [];
    world.explored.forEach((seen, index) => {
      if (seen) explored.push(index);
    });
    this.eraseFog(explored);

    // Light around the player.
    this.lightMask = this.add.image(0, 0, 'light-mask').setDepth(4);

    // Camera.
    const camera = this.cameras.main;
    camera.setBackgroundColor(PAPER);
    camera.setBounds(-TILE * 4, -TILE * 4, (level.width + 8) * TILE, (level.height + 8) * TILE);
    camera.startFollow(this.player, false, 0.15, 0.15);
    this.fitZoom();
    this.scale.on('resize', this.fitZoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fitZoom, this));

    this.handleEvents(world.update(0, { x: 0, y: 0 }));
    this.syncLight(0);
  }

  update(_time: number, deltaMs: number): void {
    if (this.host.paused) return;
    const world = this.host.world;
    if (world.dead) return;
    const dt = Math.min(deltaMs / 1000, 0.1);
    const move = this.host.moveVector;
    this.handleEvents(world.update(dt, move));
    if (Math.abs(move.x) > 0.1) this.player.setFlipX(move.x < 0);
    this.syncPlayer();
    this.syncLight(dt);
  }

  private handleEvents(events: WorldEvent[]): void {
    for (const event of events) {
      if (event.type === 'revealed') this.eraseFog(event.tiles);
      if (event.type === 'pickup') {
        this.itemSprites.get(event.itemId)?.destroy();
        this.itemSprites.delete(event.itemId);
        this.host.onToast(PICKUP_TOAST[event.kind]);
      }
    }
    this.host.onEvents(events);
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

  private syncPlayer(): void {
    const { x, y } = this.host.world.player;
    this.player.setPosition(x * TILE, y * TILE);
  }

  private syncLight(dt: number): void {
    this.flickerTime += dt;
    const t = this.flickerTime;
    const flicker = 1 + Math.sin(t * 9.1) * 0.012 + Math.sin(t * 23.7) * 0.008;
    const radius = this.host.world.lightRadius * TILE * flicker;
    const scale = radius / ((LIGHT_MASK_SIZE / 2) * LIGHT_HOLE);
    this.lightMask.setPosition(this.player.x, this.player.y - TILE * 0.3).setScale(scale);
  }

  private fitZoom(): void {
    const { width, height } = this.scale.gameSize;
    // Show about 11 tiles across the shortest side of the screen.
    const zoom = Phaser.Math.Clamp(Math.min(width, height) / (TILE * 11), 0.75, 6);
    this.cameras.main.setZoom(zoom);
  }

  private ensureSharedTextures(): void {
    const seed = this.host.world.seed;
    if (!this.textures.exists('paper')) this.textures.addCanvas('paper', drawPaper(256, seed));
    if (!this.textures.exists('brush')) this.textures.addCanvas('brush', drawBrush(FOG_PER_TILE * 2.6));
    if (!this.textures.exists('light-mask')) {
      this.textures.addCanvas('light-mask', drawLightMask(LIGHT_MASK_SIZE, LIGHT_HOLE, 0.68));
    }
    if (!this.textures.exists('player')) this.textures.addCanvas('player', drawPlayer(TILE * ART_SCALE));
    for (const kind of ['food', 'water', 'oil'] as const) {
      const key = `item-${kind}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, drawItem(kind, TILE * ART_SCALE));
    }
  }
}
