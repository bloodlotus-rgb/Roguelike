import { CONFIG } from './config';
import { generateLevel, type ItemKind, type Level, type Point } from './dungeon';
import { moveWithCollision, visibleTiles } from './geometry';
import { consume, freshSurvival, isDead, lightRadius, tickSurvival, type Survival } from './survival';

export type WorldEvent =
  | { type: 'pickup'; itemId: number; kind: ItemKind }
  | { type: 'revealed'; tiles: number[] }
  | { type: 'died' };

/** Movement input: a vector with length up to 1. */
export interface MoveInput {
  x: number;
  y: number;
}

/**
 * The state of one life inside one level. Pure logic: no rendering, no DOM.
 * Positions are in tile units, with the player at the center of its tile on spawn.
 */
export class World {
  readonly seed: string;
  level: Level;
  player: Point;
  survival: Survival;
  /** Tiles ever seen in this level (the map that would be inherited). */
  explored: Uint8Array;
  /** Item ids already picked up in this level. */
  taken = new Set<number>();
  dead = false;
  private lastViewTile = -1;
  private lastRadius = -1;

  constructor(seed: string, depth = 1, survival: Survival = freshSurvival()) {
    this.seed = seed;
    this.level = generateLevel(seed, depth);
    this.player = { x: this.level.start.x + 0.5, y: this.level.start.y + 0.5 };
    this.survival = survival;
    this.explored = new Uint8Array(this.level.width * this.level.height);
  }

  get depth(): number {
    return this.level.depth;
  }

  get lightRadius(): number {
    return lightRadius(this.survival.light);
  }

  /** True when the player stands close enough to the stairs to go down. */
  get atStairs(): boolean {
    const { stairs } = this.level;
    return Math.hypot(this.player.x - (stairs.x + 0.5), this.player.y - (stairs.y + 0.5)) <= CONFIG.player.stairsDistance;
  }

  update(dt: number, input: MoveInput): WorldEvent[] {
    if (this.dead) return [];
    const events: WorldEvent[] = [];

    const length = Math.hypot(input.x, input.y);
    if (length > 0.05) {
      const scale = Math.min(1, length) / length;
      const step = CONFIG.player.speed * dt;
      this.player = moveWithCollision(
        this.level,
        this.player,
        input.x * scale * step,
        input.y * scale * step,
        CONFIG.player.radius,
      );
    }

    this.survival = tickSurvival(this.survival, dt);

    for (const item of this.level.items) {
      if (this.taken.has(item.id)) continue;
      if (Math.hypot(this.player.x - (item.x + 0.5), this.player.y - (item.y + 0.5)) > CONFIG.player.pickupDistance) continue;
      this.taken.add(item.id);
      this.survival = consume(this.survival, item.kind);
      events.push({ type: 'pickup', itemId: item.id, kind: item.kind });
    }

    const revealed = this.reveal();
    if (revealed.length > 0) events.push({ type: 'revealed', tiles: revealed });

    if (isDead(this.survival)) {
      this.dead = true;
      events.push({ type: 'died' });
    }
    return events;
  }

  /** Goes one level down, keeping the survival meters. */
  descend(): void {
    const survival = this.survival;
    this.level = generateLevel(this.seed, this.level.depth + 1);
    this.player = { x: this.level.start.x + 0.5, y: this.level.start.y + 0.5 };
    this.survival = survival;
    this.explored = new Uint8Array(this.level.width * this.level.height);
    this.taken.clear();
    this.lastViewTile = -1;
  }

  /** Marks newly visible tiles as explored and returns them. */
  reveal(): number[] {
    const tileIndex = Math.floor(this.player.y) * this.level.width + Math.floor(this.player.x);
    const radius = Math.round(this.lightRadius * 4) / 4;
    if (tileIndex === this.lastViewTile && radius === this.lastRadius) return [];
    this.lastViewTile = tileIndex;
    this.lastRadius = radius;
    const fresh: number[] = [];
    for (const index of visibleTiles(this.level, this.player, radius)) {
      if (this.explored[index]) continue;
      this.explored[index] = 1;
      fresh.push(index);
    }
    return fresh;
  }
}
