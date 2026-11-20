import { critChance, damageMultiplier, maxHealth, parryBonus, quicknessFactor, stealthSight } from './attributes';
import { CLASSES, type ClassDef, type ClassId } from './classes';
import { CONFIG } from './config';
import { floorDistances, generateLevel, isFloor, type ItemKind, type Level, type LevelItem, type Point } from './dungeon';
import { ENEMIES, spawnEnemies, type EnemyDef, type EnemyKind } from './enemies';
import { hasLineOfSight, moveWithCollision, visibleTiles } from './geometry';
import { Rng } from './rng';
import { consume, freshSurvival, isDead, lightRadius, tickSurvival, type Survival } from './survival';

/** Held state of the controls this frame. Presses and releases are detected by the world. */
export interface ControlInput {
  move: { x: number; y: number };
  attack: boolean;
  dodge: boolean;
}

export const NO_INPUT: ControlInput = { move: { x: 0, y: 0 }, attack: false, dodge: false };

export const COMBAT = {
  /** Holding attack this long triggers the class ability. */
  holdThreshold: 0.28,
  dodge: { distance: 2.2, duration: 0.28, invulnerable: 0.24, cooldown: 0.7 },
  thirstCost: { attack: 0.6, dodge: 1, ability: 1.5 },
  /** Riposte after a parry: guaranteed critical hit within this many seconds. */
  riposteFor: 2,
  critMultiplier: 2,
  /** Aim assist: half-angle of the cone and extra reach in tiles. */
  aimCone: (75 * Math.PI) / 180,
  aimReach: 1.4,
  /** Horrors forget the player after this long without seeing them. */
  forgetAfter: 3,
  /** Unaware horrors see within this half-angle of where they face, and hear within this distance. */
  viewCone: (65 * Math.PI) / 180,
  hearing: 0.9,
  /** Fraction of the light radius within which the flame gives the player away from any side. */
  glow: 0.5,
  dropChance: 0.3,
  projectile: { speed: 6, radius: 0.25, ttl: 3 },
} as const;

export type EnemyState = 'idle' | 'chase' | 'windup' | 'recover' | 'stunned' | 'flee' | 'dead';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  def: EnemyDef;
  pos: Point;
  health: number;
  state: EnemyState;
  /** Seconds left in the current state. */
  timer: number;
  alerted: boolean;
  forgetTimer: number;
  facing: Point;
  /** Direction locked when the attack wind-up starts. */
  strikeDir: Point;
  room: number;
  wanderTarget: Point | null;
  /** Crawlers circle the player at this angle offset. */
  flank: number;
  /** Whether the player can currently see it. */
  visible: boolean;
}

export interface Projectile {
  id: number;
  pos: Point;
  vel: Point;
  damage: number;
  ttl: number;
}

export type PlayerAction =
  | { type: 'none' }
  | { type: 'attack'; phase: 'windup' | 'recovery'; timer: number }
  | { type: 'dodge'; timer: number; dir: Point }
  | { type: 'charge'; timer: number };

export type WorldEvent =
  | { type: 'pickup'; itemId: number; kind: ItemKind }
  | { type: 'revealed'; tiles: number[] }
  | { type: 'attack'; pos: Point; facing: Point; arc: number; range: number }
  | { type: 'enemyHit'; id: number; damage: number; crit: boolean; pos: Point }
  | { type: 'enemyDied'; id: number; kind: EnemyKind; pos: Point }
  | { type: 'playerHit'; damage: number; lightStolen: number }
  | { type: 'parry'; id: number; pos: Point }
  | { type: 'dodge'; dir: Point }
  | { type: 'ability'; kind: ClassDef['ability']['kind']; pos: Point; radius: number }
  | { type: 'drop'; item: LevelItem }
  | { type: 'died' };

const length = (v: Point) => Math.hypot(v.x, v.y);
const normalize = (v: Point): Point => {
  const l = length(v);
  return l > 1e-6 ? { x: v.x / l, y: v.y / l } : { x: 1, y: 0 };
};
const angleBetween = (a: Point, b: Point) => {
  const dot = (a.x * b.x + a.y * b.y) / ((length(a) || 1) * (length(b) || 1));
  return Math.acos(Math.max(-1, Math.min(1, dot)));
};

/**
 * The state of one life inside one level. Pure logic: no rendering, no DOM.
 * Positions are in tile units.
 */
export class World {
  readonly seed: string;
  readonly classId: ClassId;
  readonly cls: ClassDef;
  /** Which life of the dynasty this is: monsters and loot are re-rolled per life. */
  readonly life: number;
  readonly maxHealth: number;
  level!: Level;
  player!: Point;
  facing: Point = { x: 1, y: 0 };
  survival: Survival;
  explored!: Uint8Array;
  /** Tiles the player sees right now. */
  visibleNow = new Set<number>();
  taken = new Set<number>();
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  dead = false;
  action: PlayerAction = { type: 'none' };
  /** Seconds left in which an incoming melee hit gets parried. */
  parryTimer = 0;
  riposteTimer = 0;
  invulnerableTimer = 0;
  invisibleTimer = 0;
  dodgeCooldown = 0;
  abilityCooldown = 0;
  /** Seconds the attack button has been held, or -1 when it is not being tracked. */
  pressTime = -1;
  private prevAttack = false;
  private prevDodge = false;
  private rng!: Rng;
  private nextId = 1;
  private flow: Int32Array | null = null;
  private flowTile = -1;
  private lastViewTile = -1;
  private lastRadius = -1;

  constructor(seed: string, classId: ClassId = 'headsman', life = 0, depth = 1) {
    this.seed = seed;
    this.classId = classId;
    this.cls = CLASSES[classId];
    this.life = life;
    this.maxHealth = maxHealth(this.cls.attributes);
    this.survival = freshSurvival(this.maxHealth);
    this.enterLevel(depth);
  }

  get depth(): number {
    return this.level.depth;
  }

  get lightRadius(): number {
    return lightRadius(this.survival.light);
  }

  get invisible(): boolean {
    return this.invisibleTimer > 0;
  }

  /** Charge of the headsman's cleave from 0 to 1, or -1 when not charging. */
  get charge(): number {
    if (this.action.type !== 'charge') return -1;
    const ability = this.cls.ability;
    return ability.kind === 'chargedCleave' ? Math.min(1, this.action.timer / ability.chargeTime) : 0;
  }

  /** True when the player stands close enough to the stairs to go down. */
  get atStairs(): boolean {
    const { stairs } = this.level;
    return Math.hypot(this.player.x - (stairs.x + 0.5), this.player.y - (stairs.y + 0.5)) <= CONFIG.player.stairsDistance;
  }

  /** Distance at which horrors notice the player. */
  detectionRange(def: EnemyDef): number {
    return def.detect + this.lightRadius * 0.8 * this.cls.detectionMultiplier;
  }

  /** Goes one level down, keeping the survival meters. */
  descend(): void {
    this.enterLevel(this.level.depth + 1);
  }

  private enterLevel(depth: number): void {
    this.level = generateLevel(this.seed, depth, this.life);
    this.player = { x: this.level.start.x + 0.5, y: this.level.start.y + 0.5 };
    this.explored = new Uint8Array(this.level.width * this.level.height);
    this.visibleNow.clear();
    this.taken.clear();
    this.projectiles = [];
    this.action = { type: 'none' };
    this.pressTime = -1;
    this.lastViewTile = -1;
    this.flowTile = -1;
    this.rng = Rng.derive(this.seed, 'combat', this.life, depth);
    const spawnRng = Rng.derive(this.seed, 'enemies', this.life, depth);
    this.enemies = spawnEnemies(this.level, spawnRng).map((spawn) => ({
      id: this.nextId++,
      kind: spawn.kind,
      def: ENEMIES[spawn.kind],
      pos: { ...spawn.pos },
      health: ENEMIES[spawn.kind].health,
      state: 'idle',
      timer: spawnRng.range(0, 2),
      alerted: false,
      forgetTimer: 0,
      facing: { x: 1, y: 0 },
      strikeDir: { x: 1, y: 0 },
      room: spawn.room,
      wanderTarget: null,
      flank: spawnRng.range(-1, 1),
      visible: false,
    }));
    this.nextId = Math.max(this.nextId, ...this.level.items.map((i) => i.id + 1));
  }

  update(dt: number, input: ControlInput): WorldEvent[] {
    if (this.dead) return [];
    const events: WorldEvent[] = [];

    this.updateTimers(dt);
    this.handleInput(dt, input, events);
    this.movePlayer(dt, input);
    this.updateAction(dt, events);

    this.survival = tickSurvival(this.survival, dt, {
      maxHealth: this.maxHealth,
      hungerMultiplier: this.cls.hungerMultiplier,
      thirstMultiplier: this.cls.thirstMultiplier,
    });

    this.pickUp(events);
    const revealed = this.reveal();
    if (revealed.length > 0) events.push({ type: 'revealed', tiles: revealed });

    this.updateEnemies(dt, events);
    this.updateProjectiles(dt, events);

    if (isDead(this.survival)) {
      this.dead = true;
      events.push({ type: 'died' });
    }
    return events;
  }

  // Player ------------------------------------------------------------------

  private updateTimers(dt: number): void {
    this.parryTimer = Math.max(0, this.parryTimer - dt);
    this.riposteTimer = Math.max(0, this.riposteTimer - dt);
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    this.invisibleTimer = Math.max(0, this.invisibleTimer - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
  }

  private handleInput(dt: number, input: ControlInput, events: WorldEvent[]): void {
    const attackPressed = input.attack && !this.prevAttack;
    const attackReleased = !input.attack && this.prevAttack;
    const dodgePressed = input.dodge && !this.prevDodge;
    this.prevAttack = input.attack;
    this.prevDodge = input.dodge;

    const moveLength = length(input.move);
    if (moveLength > 0.2 && this.action.type !== 'dodge') this.facing = normalize(input.move);

    if (attackPressed && this.action.type === 'none') {
      // A press always opens the parry window; tap or hold is decided later.
      this.parryTimer = this.cls.parryWindow + parryBonus(this.cls.attributes);
      this.pressTime = 0;
    }

    if (this.pressTime >= 0) {
      this.pressTime += dt;
      if (attackReleased) {
        this.pressTime = -1;
        if (this.action.type === 'none') this.startAttack(events);
      } else if (this.pressTime >= COMBAT.holdThreshold && this.abilityReady) {
        // If the ability is not ready, keep holding: releasing still attacks.
        this.pressTime = -1;
        this.startAbility(events);
      }
    } else if (attackReleased && this.action.type === 'charge') {
      this.releaseCleave(events);
    }

    if (dodgePressed && this.dodgeCooldown <= 0 && (this.action.type === 'none' || this.action.type === 'attack')) {
      const dir = moveLength > 0.2 ? normalize(input.move) : this.facing;
      this.action = { type: 'dodge', timer: COMBAT.dodge.duration, dir };
      this.invulnerableTimer = COMBAT.dodge.invulnerable;
      this.dodgeCooldown = COMBAT.dodge.cooldown * quicknessFactor(this.cls.attributes);
      this.pressTime = -1;
      this.spendThirst(COMBAT.thirstCost.dodge);
      events.push({ type: 'dodge', dir });
    }
  }

  private movePlayer(dt: number, input: ControlInput): void {
    if (this.action.type === 'dodge') {
      const speed = COMBAT.dodge.distance / COMBAT.dodge.duration;
      this.player = moveWithCollision(
        this.level,
        this.player,
        this.action.dir.x * speed * dt,
        this.action.dir.y * speed * dt,
        CONFIG.player.radius,
      );
      return;
    }
    const l = length(input.move);
    if (l < 0.05) return;
    let speed = CONFIG.player.speed * this.cls.speedMultiplier;
    if (this.action.type === 'attack') speed *= 0.35;
    if (this.action.type === 'charge') speed *= 0.5;
    const scale = (Math.min(1, l) / l) * speed * dt;
    this.player = moveWithCollision(this.level, this.player, input.move.x * scale, input.move.y * scale, CONFIG.player.radius);
  }

  private updateAction(dt: number, events: WorldEvent[]): void {
    const action = this.action;
    if (action.type === 'none') return;
    // The charge counts up; everything else counts down.
    action.timer += action.type === 'charge' ? dt : -dt;
    if (action.type === 'dodge' && action.timer <= 0) this.action = { type: 'none' };
    if (action.type === 'attack' && action.timer <= 0) {
      if (action.phase === 'windup') {
        this.resolveAttack(events);
        this.action = {
          type: 'attack',
          phase: 'recovery',
          timer: this.cls.weapon.recovery * quicknessFactor(this.cls.attributes),
        };
      } else {
        this.action = { type: 'none' };
      }
    }
  }

  private startAttack(events: WorldEvent[]): void {
    this.aim();
    this.action = { type: 'attack', phase: 'windup', timer: this.cls.weapon.windup };
    this.spendThirst(COMBAT.thirstCost.attack);
    const { arc, range } = this.cls.weapon;
    events.push({ type: 'attack', pos: { ...this.player }, facing: { ...this.facing }, arc, range });
  }

  /** Turns toward the best target: inside the facing cone first, else the closest in reach. */
  private aim(): void {
    const reach = this.cls.weapon.range + COMBAT.aimReach;
    let best: Enemy | null = null;
    let bestScore = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead' || !enemy.visible) continue;
      const to = { x: enemy.pos.x - this.player.x, y: enemy.pos.y - this.player.y };
      const d = length(to);
      if (d > reach) continue;
      const inCone = angleBetween(this.facing, to) <= COMBAT.aimCone;
      const score = d + (inCone ? 0 : 3);
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    }
    if (best) this.facing = normalize({ x: best.pos.x - this.player.x, y: best.pos.y - this.player.y });
  }

  private resolveAttack(events: WorldEvent[]): void {
    const { weapon } = this.cls;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      const to = { x: enemy.pos.x - this.player.x, y: enemy.pos.y - this.player.y };
      if (length(to) > weapon.range + enemy.def.radius) continue;
      if (angleBetween(this.facing, to) > weapon.arc / 2) continue;
      if (!hasLineOfSight(this.level, this.player, enemy.pos)) continue;
      this.damageEnemy(enemy, weapon.damage, weapon.knockback, events);
    }
  }

  private damageEnemy(enemy: Enemy, base: number, knockback: number, events: WorldEvent[], canCrit = true): void {
    const attrs = this.cls.attributes;
    let damage = base * damageMultiplier(attrs);
    let crit = false;
    if (canCrit && (this.riposteTimer > 0 || this.rng.chance(critChance(attrs)))) {
      crit = true;
      damage *= COMBAT.critMultiplier;
      this.riposteTimer = 0;
    }
    if (this.cls.backstabMultiplier > 1) {
      const fromPlayer = { x: enemy.pos.x - this.player.x, y: enemy.pos.y - this.player.y };
      const behind = angleBetween(enemy.facing, fromPlayer) < Math.PI / 2.5;
      if (!enemy.alerted || behind) {
        damage *= this.cls.backstabMultiplier;
        crit = true;
      }
    }
    damage = Math.round(damage);
    enemy.health -= damage;
    enemy.alerted = true;
    enemy.forgetTimer = 0;
    events.push({ type: 'enemyHit', id: enemy.id, damage, crit, pos: { ...enemy.pos } });
    if (knockback > 0) {
      const dir = normalize({ x: enemy.pos.x - this.player.x, y: enemy.pos.y - this.player.y });
      enemy.pos = moveWithCollision(this.level, enemy.pos, dir.x * knockback, dir.y * knockback, enemy.def.radius);
    }
    if (enemy.health <= 0) {
      enemy.state = 'dead';
      events.push({ type: 'enemyDied', id: enemy.id, kind: enemy.kind, pos: { ...enemy.pos } });
      if (this.rng.chance(COMBAT.dropChance)) {
        const kind = this.rng.pick<ItemKind>(['food', 'water', 'oil']);
        const item: LevelItem = { id: this.nextId++, kind, x: Math.floor(enemy.pos.x), y: Math.floor(enemy.pos.y) };
        if (isFloor(this.level, item.x, item.y)) {
          this.level.items.push(item);
          events.push({ type: 'drop', item });
        }
      }
    } else if (enemy.state === 'idle') {
      enemy.state = 'chase';
    }
  }

  /** The class ability can be used right now. */
  get abilityReady(): boolean {
    if (this.abilityCooldown > 0 || this.action.type !== 'none') return false;
    const ability = this.cls.ability;
    return ability.kind !== 'flare' || this.survival.light >= ability.lightCost;
  }

  private startAbility(events: WorldEvent[]): void {
    const ability = this.cls.ability;
    switch (ability.kind) {
      case 'chargedCleave':
        this.action = { type: 'charge', timer: 0 };
        return;
      case 'shadowStep': {
        const dir = this.facing;
        this.player = moveWithCollision(
          this.level,
          this.player,
          dir.x * ability.distance,
          dir.y * ability.distance,
          CONFIG.player.radius,
        );
        this.invisibleTimer = ability.invisibleFor;
        this.invulnerableTimer = 0.3;
        for (const enemy of this.enemies) {
          if (enemy.state === 'dead') continue;
          enemy.alerted = false;
          if (enemy.state === 'chase') enemy.state = 'idle';
        }
        this.finishAbility(events, 0);
        return;
      }
      case 'flare': {
        this.survival = { ...this.survival, light: this.survival.light - ability.lightCost };
        for (const enemy of this.enemies) {
          if (enemy.state === 'dead') continue;
          if (Math.hypot(enemy.pos.x - this.player.x, enemy.pos.y - this.player.y) > ability.radius) continue;
          this.damageEnemy(enemy, ability.damage, 0.8, events, false);
          if (enemy.health > 0) {
            enemy.state = 'flee';
            enemy.timer = ability.fearFor;
          }
        }
        this.finishAbility(events, ability.radius);
        return;
      }
    }
  }

  private releaseCleave(events: WorldEvent[]): void {
    const ability = this.cls.ability;
    if (ability.kind !== 'chargedCleave') return;
    const t = this.charge;
    const multiplier = ability.minMultiplier + (ability.maxMultiplier - ability.minMultiplier) * t;
    this.action = { type: 'none' };
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      if (Math.hypot(enemy.pos.x - this.player.x, enemy.pos.y - this.player.y) > ability.radius + enemy.def.radius) continue;
      if (!hasLineOfSight(this.level, this.player, enemy.pos)) continue;
      this.damageEnemy(enemy, this.cls.weapon.damage * multiplier, 1 + t, events);
    }
    this.finishAbility(events, ability.radius);
  }

  private finishAbility(events: WorldEvent[], radius: number): void {
    this.abilityCooldown = this.cls.ability.cooldown;
    this.spendThirst(COMBAT.thirstCost.ability);
    events.push({ type: 'ability', kind: this.cls.ability.kind, pos: { ...this.player }, radius });
  }

  private spendThirst(amount: number): void {
    this.survival = { ...this.survival, thirst: Math.max(0, this.survival.thirst - amount) };
  }

  private hurtPlayer(damage: number, lightStolen: number, events: WorldEvent[]): void {
    this.survival = {
      ...this.survival,
      health: Math.max(0, this.survival.health - damage),
      light: Math.max(0, this.survival.light - lightStolen),
    };
    if (this.action.type === 'charge') this.action = { type: 'none' };
    events.push({ type: 'playerHit', damage, lightStolen });
  }

  private pickUp(events: WorldEvent[]): void {
    for (const item of this.level.items) {
      if (this.taken.has(item.id)) continue;
      if (Math.hypot(this.player.x - (item.x + 0.5), this.player.y - (item.y + 0.5)) > CONFIG.player.pickupDistance) continue;
      this.taken.add(item.id);
      this.survival = consume(this.survival, item.kind);
      events.push({ type: 'pickup', itemId: item.id, kind: item.kind });
    }
  }

  /** Marks newly visible tiles as explored and returns them. */
  reveal(): number[] {
    const tileIndex = Math.floor(this.player.y) * this.level.width + Math.floor(this.player.x);
    const radius = Math.round(this.lightRadius * 4) / 4;
    if (tileIndex === this.lastViewTile && radius === this.lastRadius) return [];
    this.lastViewTile = tileIndex;
    this.lastRadius = radius;
    this.visibleNow = new Set(visibleTiles(this.level, this.player, radius));
    const fresh: number[] = [];
    for (const index of this.visibleNow) {
      if (this.explored[index]) continue;
      this.explored[index] = 1;
      fresh.push(index);
    }
    return fresh;
  }

  // Horrors -----------------------------------------------------------------

  private updateEnemies(dt: number, events: WorldEvent[]): void {
    this.updateFlow();
    const sight = stealthSight(this.cls.attributes) + this.lightRadius * 0.35;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      const dist = Math.hypot(enemy.pos.x - this.player.x, enemy.pos.y - this.player.y);
      const tile = Math.floor(enemy.pos.y) * this.level.width + Math.floor(enemy.pos.x);
      enemy.visible = this.visibleNow.has(tile) && (!enemy.def.stealthy || dist <= sight);
      this.perceive(enemy, dt, dist);
      this.think(enemy, dt, dist, events);
    }
    this.separate();
  }

  private perceive(enemy: Enemy, dt: number, dist: number): void {
    if (this.invisible) {
      enemy.alerted = false;
      return;
    }
    const range = this.detectionRange(enemy.def);
    // Unaware horrors only see ahead of them, but they notice anyone right next to them
    // and the glow of a flame that is close enough, whichever way they face.
    const toPlayer = { x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y };
    const glow = this.lightRadius * COMBAT.glow * this.cls.detectionMultiplier;
    const inView =
      enemy.alerted ||
      dist <= Math.max(COMBAT.hearing, glow) ||
      angleBetween(enemy.facing, toPlayer) <= COMBAT.viewCone;
    const sees = inView && dist <= range * (enemy.alerted ? 1.6 : 1) && hasLineOfSight(this.level, enemy.pos, this.player);
    if (sees) {
      enemy.alerted = true;
      enemy.forgetTimer = 0;
    } else if (enemy.alerted) {
      enemy.forgetTimer += dt;
      if (enemy.forgetTimer > COMBAT.forgetAfter) enemy.alerted = false;
    }
  }

  private think(enemy: Enemy, dt: number, dist: number, events: WorldEvent[]): void {
    const def = enemy.def;
    enemy.timer -= dt;
    const toPlayer = normalize({ x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y });

    switch (enemy.state) {
      case 'idle':
        if (enemy.alerted) {
          enemy.state = 'chase';
          return;
        }
        this.wander(enemy, dt);
        return;
      case 'stunned':
      case 'recover':
        if (enemy.timer <= 0) enemy.state = enemy.alerted ? 'chase' : 'idle';
        return;
      case 'flee': {
        const away = { x: -toPlayer.x, y: -toPlayer.y };
        this.step(enemy, away, def.speed * 0.9 * dt);
        if (enemy.timer <= 0) enemy.state = enemy.alerted ? 'chase' : 'idle';
        return;
      }
      case 'windup':
        if (enemy.timer > 0) return;
        if (def.ranged) this.fire(enemy);
        else this.strike(enemy, events);
        // A parry leaves it stunned instead of recovering.
        if (enemy.state === 'windup') {
          enemy.state = 'recover';
          enemy.timer = def.recovery;
        }
        return;
      case 'chase': {
        if (!enemy.alerted) {
          enemy.state = 'idle';
          return;
        }
        enemy.facing = toPlayer;
        const sees = hasLineOfSight(this.level, enemy.pos, this.player);
        if (def.ranged) {
          if (dist < 2.3) {
            enemy.state = 'flee';
            enemy.timer = 0.8;
            return;
          }
          if (dist <= def.range + 1 && sees) {
            this.beginWindup(enemy, toPlayer);
            return;
          }
          this.chaseStep(enemy, dt, dist, sees);
          return;
        }
        if (dist <= def.range + 0.1 && sees) {
          this.beginWindup(enemy, toPlayer);
          return;
        }
        this.chaseStep(enemy, dt, dist, sees);
        return;
      }
    }
  }

  private beginWindup(enemy: Enemy, dir: Point): void {
    enemy.state = 'windup';
    enemy.timer = enemy.def.windup;
    enemy.strikeDir = dir;
    enemy.facing = dir;
  }

  private strike(enemy: Enemy, events: WorldEvent[]): void {
    const def = enemy.def;
    const to = { x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y };
    const arc = def.kind === 'husk' ? Math.PI / 1.5 : Math.PI / 2.4;
    const reach = def.range + 0.35;
    if (length(to) > reach || angleBetween(enemy.strikeDir, to) > arc) return;
    if (this.invulnerableTimer > 0) return;
    if (def.parryable && this.parryTimer > 0) {
      enemy.state = 'stunned';
      enemy.timer = this.cls.parryStun;
      this.riposteTimer = COMBAT.riposteFor;
      this.parryTimer = 0;
      events.push({ type: 'parry', id: enemy.id, pos: { ...enemy.pos } });
      return;
    }
    this.hurtPlayer(def.damage, def.stealsLight, events);
  }

  private fire(enemy: Enemy): void {
    const dir = normalize({ x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y });
    this.projectiles.push({
      id: this.nextId++,
      pos: { x: enemy.pos.x + dir.x * 0.4, y: enemy.pos.y + dir.y * 0.4 },
      vel: { x: dir.x * COMBAT.projectile.speed, y: dir.y * COMBAT.projectile.speed },
      damage: enemy.def.damage,
      ttl: COMBAT.projectile.ttl,
    });
  }

  private updateProjectiles(dt: number, events: WorldEvent[]): void {
    this.projectiles = this.projectiles.filter((p) => {
      p.ttl -= dt;
      p.pos = { x: p.pos.x + p.vel.x * dt, y: p.pos.y + p.vel.y * dt };
      if (p.ttl <= 0 || !isFloor(this.level, Math.floor(p.pos.x), Math.floor(p.pos.y))) return false;
      const hit = Math.hypot(p.pos.x - this.player.x, p.pos.y - this.player.y) <= COMBAT.projectile.radius + CONFIG.player.radius;
      if (!hit) return true;
      if (this.invulnerableTimer > 0) return true;
      this.hurtPlayer(p.damage, 0, events);
      return false;
    });
  }

  private wander(enemy: Enemy, dt: number): void {
    if (enemy.timer > 0 && !enemy.wanderTarget) return;
    const room = this.level.rooms[enemy.room];
    if (!enemy.wanderTarget) {
      enemy.wanderTarget = {
        x: this.rng.range(room.x + 0.5, room.x + room.w - 0.5),
        y: this.rng.range(room.y + 0.5, room.y + room.h - 0.5),
      };
    }
    const to = { x: enemy.wanderTarget.x - enemy.pos.x, y: enemy.wanderTarget.y - enemy.pos.y };
    if (length(to) < 0.2) {
      enemy.wanderTarget = null;
      enemy.timer = this.rng.range(1, 3.5);
      return;
    }
    enemy.facing = normalize(to);
    this.step(enemy, enemy.facing, enemy.def.speed * 0.35 * dt);
  }

  private chaseStep(enemy: Enemy, dt: number, dist: number, sees: boolean): void {
    let speed = enemy.def.speed;
    if (this.cls.lightHesitation < 1 && dist <= this.lightRadius) speed *= this.cls.lightHesitation;
    let dir: Point;
    if (sees && dist < 7) {
      dir = { x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y };
      if (enemy.kind === 'crawler' && dist > 1.4) {
        // Circle around to come from the sides.
        const perp = { x: -dir.y, y: dir.x };
        dir = { x: dir.x + perp.x * enemy.flank * 0.8, y: dir.y + perp.y * enemy.flank * 0.8 };
      }
    } else {
      dir = this.flowDirection(enemy.pos) ?? { x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y };
    }
    this.step(enemy, normalize(dir), speed * dt);
  }

  private step(enemy: Enemy, dir: Point, distance: number): void {
    enemy.pos = moveWithCollision(this.level, enemy.pos, dir.x * distance, dir.y * distance, enemy.def.radius);
  }

  /** Distances to the player over the floor, recomputed when the player changes tile. */
  private updateFlow(): void {
    const tile = Math.floor(this.player.y) * this.level.width + Math.floor(this.player.x);
    if (tile === this.flowTile && this.flow) return;
    this.flowTile = tile;
    this.flow = floorDistances(this.level, { x: Math.floor(this.player.x), y: Math.floor(this.player.y) });
  }

  private flowDirection(pos: Point): Point | null {
    if (!this.flow) return null;
    const { width } = this.level;
    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);
    const here = this.flow[y * width + x];
    if (here < 0) return null;
    let best: Point | null = null;
    let bestValue = here;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const value = this.flow[(y + dy) * width + (x + dx)];
      if (value >= 0 && value < bestValue) {
        bestValue = value;
        best = { x: x + dx + 0.5 - pos.x, y: y + dy + 0.5 - pos.y };
      }
    }
    return best;
  }

  /** Keeps horrors from stacking on each other or on the player. */
  private separate(): void {
    const alive = this.enemies.filter((e) => e.state !== 'dead');
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i];
      for (let j = i + 1; j < alive.length; j++) {
        const b = alive[j];
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const d = Math.hypot(dx, dy);
        const min = a.def.radius + b.def.radius;
        if (d >= min || d < 1e-6) continue;
        const push = (min - d) / 2;
        a.pos = moveWithCollision(this.level, a.pos, (-dx / d) * push, (-dy / d) * push, a.def.radius);
        b.pos = moveWithCollision(this.level, b.pos, (dx / d) * push, (dy / d) * push, b.def.radius);
      }
      const dx = a.pos.x - this.player.x;
      const dy = a.pos.y - this.player.y;
      const d = Math.hypot(dx, dy);
      const min = a.def.radius + CONFIG.player.radius;
      if (d < min && d > 1e-6) {
        a.pos = moveWithCollision(this.level, a.pos, (dx / d) * (min - d), (dy / d) * (min - d), a.def.radius);
      }
    }
  }
}
