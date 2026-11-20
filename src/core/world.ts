import { critChance, damageMultiplier, maxHealth, parryBonus, quicknessFactor, stealthSight } from './attributes';
import { CLASSES, type ClassDef, type ClassId, type ComboStep, type SpecialDef } from './classes';
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
  special: boolean;
}

export const NO_INPUT: ControlInput = { move: { x: 0, y: 0 }, attack: false, dodge: false, special: false };

export const COMBAT = {
  dodge: { distance: 2.2, duration: 0.28, invulnerable: 0.24, cooldown: 0.7 },
  run: {
    speedMultiplier: 1.6,
    /** Meter points per second while running. */
    thirstPerSecond: 1.2,
    hungerPerSecond: 0.6,
    /** Running is loud: detection range multiplier and hearing distance from any side. */
    detection: 1.5,
    hearing: 3.5,
  },
  thirstCost: { attack: 0.6, dodge: 1, special: 1.5 },
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
  /** The hero sees only ahead: half-angle of the vision cone, and how close is seen all around. */
  visionCone: (58 * Math.PI) / 180,
  nearSight: 1.4,
  /** Unseen horrors within this many tiles that look at the player show their eyes. */
  eyesRange: 9,
  /** A horror that notices the player warns the others within this many tiles. */
  alertRadius: 4,
  dropChance: 0.3,
  projectile: { speed: 6, radius: 0.25, ttl: 3 },
  /** Wax burns in ticks of this many seconds. */
  waxTick: 0.5,
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
  roamer: boolean;
  wanderTarget: Point | null;
  /** Roamers: distance field toward the room they are walking to. */
  roamField: Int32Array | null;
  roamRoom: number;
  /** Crawlers circle the player at this angle offset. */
  flank: number;
  /** Whether the player can currently see it. */
  visible: boolean;
  /** Unseen but looking at the player from the dark: its eyes glint. */
  watching: boolean;
  /** Seconds of burning wax left. */
  wax: number;
  waxTick: number;
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
  | { type: 'attack'; phase: 'windup' | 'recovery'; timer: number; step: ComboStep }
  | { type: 'dodge'; timer: number; dir: Point }
  | { type: 'special'; timer: number; target: Enemy | null };

export type WorldEvent =
  | { type: 'pickup'; itemId: number; kind: ItemKind }
  | { type: 'revealed'; tiles: number[] }
  | { type: 'attack'; pos: Point; facing: Point; arc: number; range: number; finisher: boolean }
  | { type: 'enemyHit'; id: number; damage: number; crit: boolean; burn: boolean; pos: Point }
  | { type: 'enemyDied'; id: number; kind: EnemyKind; pos: Point }
  | { type: 'playerHit'; damage: number; lightStolen: number }
  | { type: 'parry'; id: number; pos: Point }
  | { type: 'dodge'; dir: Point }
  | { type: 'special'; kind: SpecialDef['kind']; pos: Point; radius: number; target?: Point }
  | { type: 'heal'; amount: number }
  | { type: 'executed'; pos: Point }
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
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

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
  running = false;
  /** Seconds left in which an incoming melee hit gets parried. */
  parryTimer = 0;
  riposteTimer = 0;
  invulnerableTimer = 0;
  invisibleTimer = 0;
  dodgeCooldown = 0;
  /** Special meter from 0 to 1, and minimum seconds left before the next use. */
  specialCharge = 0;
  specialCooldown = 0;
  /** Position in the weapon combo and seconds left to continue it. */
  comboIndex = 0;
  comboTimer = 0;
  private prev = { attack: false, dodge: false, special: false };
  private rng!: Rng;
  private nextId = 1;
  private flow: Int32Array | null = null;
  private flowTile = -1;
  private lastViewTile = -1;
  private lastRadius = -1;
  private lastFacing = 999;

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

  /** True when the player stands close enough to the stairs to go down. */
  get atStairs(): boolean {
    const { stairs } = this.level;
    return dist(this.player, { x: stairs.x + 0.5, y: stairs.y + 0.5 }) <= CONFIG.player.stairsDistance;
  }

  /** The special can be used right now. */
  get specialReady(): boolean {
    if (this.specialCharge < 1 || this.specialCooldown > 0) return false;
    if (this.action.type !== 'none' && !(this.action.type === 'attack' && this.action.phase === 'recovery')) return false;
    const special = this.cls.special;
    return special.kind !== 'flare' || this.survival.light >= special.lightCost;
  }

  /** Distance at which horrors notice the player. */
  detectionRange(def: EnemyDef): number {
    const run = this.running ? COMBAT.run.detection : 1;
    return (def.detect + this.lightRadius * 0.8) * run;
  }

  /** Rat eye: distance at which the plunderer sees items in the dark (0 for other classes). */
  get itemSight(): number {
    return this.cls.passive.kind === 'ratEye' ? this.cls.passive.itemSight : 0;
  }

  /** Goes one level down, keeping the survival meters and the special charge. */
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
    this.running = false;
    this.lastViewTile = -1;
    this.flowTile = -1;
    this.rng = Rng.derive(this.seed, 'combat', this.life, depth);
    const spawnRng = Rng.derive(this.seed, 'enemies', this.life, depth);
    this.nextId = Math.max(this.nextId, ...this.level.items.map((i) => i.id + 1));
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
      roamer: spawn.roamer,
      wanderTarget: null,
      roamField: null,
      roamRoom: spawn.room,
      flank: spawnRng.range(-1, 1),
      visible: false,
      watching: false,
      wax: 0,
      waxTick: 0,
    }));
  }

  update(dt: number, input: ControlInput): WorldEvent[] {
    if (this.dead) return [];
    const events: WorldEvent[] = [];

    this.updateTimers(dt);
    this.handleInput(input, events);
    this.movePlayer(dt, input);
    this.updateAction(dt, events);

    const passive = this.cls.passive;
    this.survival = tickSurvival(this.survival, dt, {
      maxHealth: this.maxHealth,
      hungerMultiplier: this.cls.hungerMultiplier,
      thirstMultiplier: this.cls.thirstMultiplier,
      lightMultiplier: passive.kind === 'devoutFlame' ? passive.lightDrain : 1,
    });
    if (this.running) {
      this.survival = {
        ...this.survival,
        thirst: Math.max(0, this.survival.thirst - COMBAT.run.thirstPerSecond * dt),
        hunger: Math.max(0, this.survival.hunger - COMBAT.run.hungerPerSecond * dt),
      };
    }
    this.gainCharge(this.cls.charge.perSecond * dt);

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
    this.specialCooldown = Math.max(0, this.specialCooldown - dt);
    if (this.action.type === 'none') this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0 && this.action.type === 'none') this.comboIndex = 0;
  }

  private handleInput(input: ControlInput, events: WorldEvent[]): void {
    const attackPressed = input.attack && !this.prev.attack;
    const dodgePressed = input.dodge && !this.prev.dodge;
    const specialPressed = input.special && !this.prev.special;
    this.prev = { attack: input.attack, dodge: input.dodge, special: input.special };

    const moving = length(input.move) > 0.2;
    if (moving && this.action.type !== 'dodge') this.facing = normalize(input.move);

    // Holding dodge runs once the roll is over; letting go or acting stops it.
    this.running = input.dodge && moving && this.action.type === 'none' && !dodgePressed;

    const free = this.action.type === 'none';
    const recovering = this.action.type === 'attack' && this.action.phase === 'recovery';

    if (attackPressed && free) {
      // Every press opens the parry window, and swings.
      this.parryTimer = this.cls.parryWindow + parryBonus(this.cls.attributes);
      this.startAttack(events);
    }

    if (specialPressed && (free || recovering) && this.specialReady) this.startSpecial(events);

    if (dodgePressed && this.dodgeCooldown <= 0 && (free || this.action.type === 'attack')) {
      const dir = moving ? normalize(input.move) : this.facing;
      this.action = { type: 'dodge', timer: COMBAT.dodge.duration, dir };
      this.invulnerableTimer = COMBAT.dodge.invulnerable;
      this.dodgeCooldown = COMBAT.dodge.cooldown * quicknessFactor(this.cls.attributes);
      this.spendThirst(COMBAT.thirstCost.dodge);
      this.running = false;
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
    if (this.running) speed *= COMBAT.run.speedMultiplier;
    if (this.action.type === 'attack') speed *= 0.35;
    if (this.action.type === 'special') speed *= 0.2;
    const scale = (Math.min(1, l) / l) * speed * dt;
    this.player = moveWithCollision(this.level, this.player, input.move.x * scale, input.move.y * scale, CONFIG.player.radius);
  }

  private updateAction(dt: number, events: WorldEvent[]): void {
    const action = this.action;
    if (action.type === 'none') return;
    action.timer -= dt;
    if (action.timer > 0) return;
    switch (action.type) {
      case 'dodge':
        this.action = { type: 'none' };
        return;
      case 'attack':
        if (action.phase === 'windup') {
          this.resolveAttack(action.step, events);
          this.action = {
            type: 'attack',
            phase: 'recovery',
            timer: action.step.recovery * quicknessFactor(this.cls.attributes),
            step: action.step,
          };
        } else {
          this.action = { type: 'none' };
        }
        return;
      case 'special':
        this.resolveExecution(action.target, events);
        this.action = { type: 'none' };
        return;
    }
  }

  private startAttack(events: WorldEvent[]): void {
    const combo = this.cls.weapon.combo;
    const index = this.comboTimer > 0 ? this.comboIndex % combo.length : 0;
    const step = combo[index];
    this.comboIndex = index + 1;
    this.comboTimer = this.cls.weapon.comboWindow;
    if (this.comboIndex >= combo.length) this.comboIndex = 0;
    this.aim(step.range);
    this.action = { type: 'attack', phase: 'windup', timer: step.windup, step };
    this.running = false;
    this.spendThirst(COMBAT.thirstCost.attack);
    const finisher = combo.length > 1 && index === combo.length - 1;
    events.push({ type: 'attack', pos: { ...this.player }, facing: { ...this.facing }, arc: step.arc, range: step.range, finisher });
  }

  /** Turns toward the best target: inside the facing cone first, else the closest in reach. */
  private aim(range: number): Enemy | null {
    const reach = range + COMBAT.aimReach;
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
    return best;
  }

  private resolveAttack(step: ComboStep, events: WorldEvent[]): void {
    const { weapon } = this.cls;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      const to = { x: enemy.pos.x - this.player.x, y: enemy.pos.y - this.player.y };
      if (length(to) > step.range + enemy.def.radius) continue;
      if (angleBetween(this.facing, to) > step.arc / 2) continue;
      if (!hasLineOfSight(this.level, this.player, enemy.pos)) continue;
      this.damageEnemy(enemy, weapon.damage * step.damage, step.knockback, events);
      if (enemy.health <= 0) continue;
      if (step.stun) {
        enemy.state = 'stunned';
        enemy.timer = step.stun;
      }
      if (weapon.wax) {
        enemy.wax = weapon.wax.duration;
        enemy.waxTick = COMBAT.waxTick;
      }
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
        this.gainCharge(this.cls.charge.perBackstab);
      }
    }
    this.gainCharge(this.cls.charge.perHitDealt);
    this.applyDamage(enemy, Math.round(damage), crit, false, events);
    if (knockback > 0 && enemy.health > 0) {
      const dir = normalize({ x: enemy.pos.x - this.player.x, y: enemy.pos.y - this.player.y });
      enemy.pos = moveWithCollision(this.level, enemy.pos, dir.x * knockback, dir.y * knockback, enemy.def.radius);
    }
  }

  /** Lowers a horror's health, handling death, drops and the bloodthirst passive. */
  private applyDamage(enemy: Enemy, damage: number, crit: boolean, burn: boolean, events: WorldEvent[]): void {
    enemy.health -= damage;
    events.push({ type: 'enemyHit', id: enemy.id, damage, crit, burn, pos: { ...enemy.pos } });
    if (!burn) {
      enemy.alerted = true;
      enemy.forgetTimer = 0;
      if (enemy.state === 'idle') enemy.state = 'chase';
    }
    if (enemy.health > 0) return;
    enemy.state = 'dead';
    enemy.wax = 0;
    events.push({ type: 'enemyDied', id: enemy.id, kind: enemy.kind, pos: { ...enemy.pos } });
    const passive = this.cls.passive;
    if (passive.kind === 'bloodthirst') {
      const amount = Math.round(this.maxHealth * passive.healFraction);
      this.survival = { ...this.survival, health: Math.min(this.maxHealth, this.survival.health + amount) };
      events.push({ type: 'heal', amount });
    }
    const dropChance = passive.kind === 'ratEye' ? passive.dropChance : COMBAT.dropChance;
    if (this.rng.chance(dropChance)) {
      const kind = this.rng.pick<ItemKind>(['food', 'water', 'oil']);
      const item: LevelItem = { id: this.nextId++, kind, x: Math.floor(enemy.pos.x), y: Math.floor(enemy.pos.y) };
      if (isFloor(this.level, item.x, item.y)) {
        this.level.items.push(item);
        events.push({ type: 'drop', item });
      }
    }
  }

  private startSpecial(events: WorldEvent[]): void {
    const special = this.cls.special;
    switch (special.kind) {
      case 'execution': {
        const target = this.aim(special.reach);
        if (!target) return; // Nothing to execute: keep the charge.
        this.action = { type: 'special', timer: special.windup, target };
        this.consumeSpecial();
        events.push({ type: 'special', kind: 'execution', pos: { ...this.player }, radius: 0, target: { ...target.pos } });
        return;
      }
      case 'shadowStep': {
        const dir = this.facing;
        this.player = moveWithCollision(this.level, this.player, dir.x * special.distance, dir.y * special.distance, CONFIG.player.radius);
        this.invisibleTimer = special.invisibleFor;
        this.invulnerableTimer = 0.3;
        this.action = { type: 'none' };
        for (const enemy of this.enemies) {
          if (enemy.state === 'dead') continue;
          enemy.alerted = false;
          if (enemy.state === 'chase') enemy.state = 'idle';
        }
        this.consumeSpecial();
        events.push({ type: 'special', kind: 'shadowStep', pos: { ...this.player }, radius: 0 });
        return;
      }
      case 'flare': {
        this.survival = { ...this.survival, light: this.survival.light - special.lightCost };
        this.action = { type: 'none' };
        for (const enemy of this.enemies) {
          if (enemy.state === 'dead') continue;
          if (dist(enemy.pos, this.player) > special.radius) continue;
          const multiplier = enemy.wax > 0 ? special.waxMultiplier : 1;
          this.damageEnemy(enemy, special.damage * multiplier, 0.8, events, false);
          if (enemy.health > 0) {
            enemy.state = 'flee';
            enemy.timer = special.fearFor;
          }
        }
        this.consumeSpecial();
        events.push({ type: 'special', kind: 'flare', pos: { ...this.player }, radius: special.radius });
        return;
      }
    }
  }

  private resolveExecution(target: Enemy | null, events: WorldEvent[]): void {
    const special = this.cls.special;
    if (special.kind !== 'execution' || !target || target.state === 'dead') return;
    if (dist(target.pos, this.player) > special.reach + target.def.radius + 0.4) return;
    const executes = target.state === 'stunned' || target.health <= target.def.health * special.threshold;
    if (executes) {
      events.push({ type: 'executed', pos: { ...target.pos } });
      this.applyDamage(target, target.health, true, false, events);
    } else {
      this.damageEnemy(target, this.cls.weapon.damage * special.multiplier, 1, events, false);
    }
  }

  private consumeSpecial(): void {
    this.specialCharge = 0;
    this.specialCooldown = this.cls.charge.cooldown;
    this.running = false;
    this.spendThirst(COMBAT.thirstCost.special);
  }

  private gainCharge(amount: number): void {
    if (amount > 0) this.specialCharge = Math.min(1, this.specialCharge + amount);
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
    this.gainCharge(this.cls.charge.perHitTaken);
    events.push({ type: 'playerHit', damage, lightStolen });
  }

  private pickUp(events: WorldEvent[]): void {
    for (const item of this.level.items) {
      if (this.taken.has(item.id)) continue;
      if (dist(this.player, { x: item.x + 0.5, y: item.y + 0.5 }) > CONFIG.player.pickupDistance) continue;
      this.taken.add(item.id);
      this.survival = consume(this.survival, item.kind);
      events.push({ type: 'pickup', itemId: item.id, kind: item.kind });
    }
  }

  /** Marks newly visible tiles as explored and returns them. */
  reveal(): number[] {
    const tileIndex = Math.floor(this.player.y) * this.level.width + Math.floor(this.player.x);
    const radius = Math.round(this.lightRadius * 4) / 4;
    const facing = Math.round(Math.atan2(this.facing.y, this.facing.x) / 0.06);
    if (tileIndex === this.lastViewTile && radius === this.lastRadius && facing === this.lastFacing) return [];
    this.lastViewTile = tileIndex;
    this.lastRadius = radius;
    this.lastFacing = facing;
    const { width } = this.level;
    // In line of sight and lit, and either ahead of the hero or right next to them.
    this.visibleNow = new Set(
      visibleTiles(this.level, this.player, radius).filter((index) => {
        const to = { x: (index % width) + 0.5 - this.player.x, y: Math.floor(index / width) + 0.5 - this.player.y };
        const d = length(to);
        if (d <= COMBAT.nearSight + 0.5) return true;
        // Count a tile as seen if any part of it falls inside the cone.
        return angleBetween(this.facing, to) <= COMBAT.visionCone + Math.atan(0.7 / d);
      }),
    );
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
      this.burn(enemy, dt, events);
      if (enemy.health <= 0) continue;
      const d = dist(enemy.pos, this.player);
      const tile = Math.floor(enemy.pos.y) * this.level.width + Math.floor(enemy.pos.x);
      const seen = this.visibleNow.has(tile) && (!enemy.def.stealthy || d <= sight);
      // Burning wax keeps a horror visible even outside the light.
      enemy.visible = seen || enemy.wax > 0;
      enemy.watching = !enemy.visible && this.isWatching(enemy, d, sight);
      this.perceive(enemy, dt, d);
      this.think(enemy, dt, d, events);
    }
    this.separate();
  }

  /**
   * Eyes in the dark: a horror out of sight but close, facing the player (or hunting
   * them) with a clear line between them. Stealthy ones only show up very close.
   */
  private isWatching(enemy: Enemy, d: number, sight: number): boolean {
    if (d > COMBAT.eyesRange) return false;
    if (enemy.def.stealthy && d > sight * 1.8) return false;
    const toPlayer = { x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y };
    if (!enemy.alerted && angleBetween(enemy.facing, toPlayer) > COMBAT.viewCone) return false;
    return hasLineOfSight(this.level, enemy.pos, this.player);
  }

  private burn(enemy: Enemy, dt: number, events: WorldEvent[]): void {
    const wax = this.cls.weapon.wax;
    if (enemy.wax <= 0 || !wax) return;
    enemy.wax -= dt;
    enemy.waxTick -= dt;
    if (enemy.waxTick > 0) return;
    enemy.waxTick += COMBAT.waxTick;
    this.applyDamage(enemy, Math.max(1, Math.round(wax.damagePerSecond * COMBAT.waxTick)), false, true, events);
  }

  private perceive(enemy: Enemy, dt: number, d: number): void {
    if (this.invisible) {
      enemy.alerted = false;
      return;
    }
    const range = this.detectionRange(enemy.def);
    // Unaware horrors only see ahead of them, but they notice anyone right next to them,
    // the glow of a flame that is close enough, and the noise of running.
    const toPlayer = { x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y };
    const glow = this.lightRadius * COMBAT.glow;
    const hearing = this.running ? COMBAT.run.hearing : COMBAT.hearing;
    const inView = enemy.alerted || d <= Math.max(hearing, glow) || angleBetween(enemy.facing, toPlayer) <= COMBAT.viewCone;
    const sees = inView && d <= range * (enemy.alerted ? 1.6 : 1) && hasLineOfSight(this.level, enemy.pos, this.player);
    if (sees) {
      if (!enemy.alerted) this.alertNearby(enemy);
      enemy.alerted = true;
      enemy.forgetTimer = 0;
    } else if (enemy.alerted) {
      enemy.forgetTimer += dt;
      if (enemy.forgetTimer > COMBAT.forgetAfter) enemy.alerted = false;
    }
  }

  private alertNearby(source: Enemy): void {
    for (const other of this.enemies) {
      if (other === source || other.state === 'dead' || other.alerted) continue;
      if (dist(other.pos, source.pos) > COMBAT.alertRadius) continue;
      if (!hasLineOfSight(this.level, other.pos, source.pos)) continue;
      other.alerted = true;
      other.forgetTimer = 0;
    }
  }

  private think(enemy: Enemy, dt: number, d: number, events: WorldEvent[]): void {
    const def = enemy.def;
    enemy.timer -= dt;
    const toPlayer = normalize({ x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y });

    switch (enemy.state) {
      case 'idle':
        if (enemy.alerted) {
          enemy.state = 'chase';
          return;
        }
        if (enemy.roamer) this.roam(enemy, dt);
        else this.wander(enemy, dt);
        return;
      case 'stunned':
      case 'recover':
        if (enemy.timer <= 0) enemy.state = enemy.alerted ? 'chase' : 'idle';
        return;
      case 'flee': {
        this.step(enemy, { x: -toPlayer.x, y: -toPlayer.y }, def.speed * 0.9 * dt);
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
          if (d < 2.3) {
            enemy.state = 'flee';
            enemy.timer = 0.8;
            return;
          }
          if (d <= def.range + 1 && sees) {
            this.beginWindup(enemy, toPlayer);
            return;
          }
          this.chaseStep(enemy, dt, d, sees);
          return;
        }
        if (d <= def.range + 0.1 && sees) {
          this.beginWindup(enemy, toPlayer);
          return;
        }
        this.chaseStep(enemy, dt, d, sees);
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
    if (length(to) > def.range + 0.35 || angleBetween(enemy.strikeDir, to) > arc) return;
    if (this.invulnerableTimer > 0) return;
    if (def.parryable && this.parryTimer > 0) {
      enemy.state = 'stunned';
      enemy.timer = this.cls.parryStun;
      this.riposteTimer = COMBAT.riposteFor;
      this.parryTimer = 0;
      this.gainCharge(this.cls.charge.perParry);
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
      if (dist(p.pos, this.player) > COMBAT.projectile.radius + CONFIG.player.radius) return true;
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
    if (length(to) < 0.2 || enemy.timer < -6) {
      enemy.wanderTarget = null;
      enemy.timer = this.rng.range(1, 3.5);
      return;
    }
    enemy.facing = normalize(to);
    this.step(enemy, enemy.facing, enemy.def.speed * 0.35 * dt);
  }

  /** Roamers walk from room to room along the floor. */
  private roam(enemy: Enemy, dt: number): void {
    if (enemy.timer > 0 && !enemy.roamField) return;
    if (!enemy.roamField) {
      const rooms = this.level.rooms;
      if (rooms.length < 2) return;
      let next = this.rng.int(0, rooms.length - 1);
      if (next === enemy.room) next = (next + 1) % rooms.length;
      const r = rooms[next];
      const center = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
      enemy.roamRoom = next;
      enemy.roamField = floorDistances(this.level, center);
    }
    const dir = this.fieldDirection(enemy.roamField, enemy.pos);
    if (!dir) {
      enemy.room = enemy.roamRoom;
      enemy.roamField = null;
      enemy.timer = this.rng.range(2, 5);
      return;
    }
    enemy.facing = normalize(dir);
    this.step(enemy, enemy.facing, enemy.def.speed * 0.4 * dt);
  }

  private chaseStep(enemy: Enemy, dt: number, d: number, sees: boolean): void {
    let speed = enemy.def.speed;
    const passive = this.cls.passive;
    if (passive.kind === 'devoutFlame' && d <= this.lightRadius) speed *= passive.hesitation;
    let dir: Point;
    if (sees && d < 7) {
      dir = { x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y };
      if (enemy.kind === 'crawler' && d > 1.4) {
        // Circle around to come from the sides.
        const perp = { x: -dir.y, y: dir.x };
        dir = { x: dir.x + perp.x * enemy.flank * 0.8, y: dir.y + perp.y * enemy.flank * 0.8 };
      }
    } else {
      dir = (this.flow && this.fieldDirection(this.flow, enemy.pos)) ?? { x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y };
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

  /** Direction toward the neighbor tile closer to the field's origin, or null when already there. */
  private fieldDirection(field: Int32Array, pos: Point): Point | null {
    const { width } = this.level;
    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);
    const here = field[y * width + x];
    if (here <= 0) return null;
    let best: Point | null = null;
    let bestValue = here;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const value = field[(y + dy) * width + (x + dx)];
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
