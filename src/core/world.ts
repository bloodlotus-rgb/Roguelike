import { ATTRIBUTE_IDS, critChance, damageMultiplier, maxHealth, parryBonus, quicknessFactor, stealthSight, type Attributes } from './attributes';
import { CLASSES, type ClassDef, type ClassId, type ComboStep, type SpecialDef } from './classes';
import { CONFIG } from './config';
import { floorDistances, generateLevel, isFloor, type ItemKind, type Level, type LevelItem, type Point } from './dungeon';
import { ENEMIES, spawnEnemies, type EnemyDef, type EnemyKind } from './enemies';
import { hasLineOfSight, moveWithCollision, visibleTiles } from './geometry';
import { Rng } from './rng';
import { packTiles, unpackTiles, type DeathCause } from './dynasty';
import { freshSurvival, isDead, lightRadius, tickSurvival, type Survival } from './survival';
import { combineEffects, compatible, TRAIT_CAP, traitDef, type TraitEffects } from './traits';

/** Held state of the controls this frame. Presses and releases are detected by the world. */
export interface ControlInput {
  move: { x: number; y: number };
  attack: boolean;
  dodge: boolean;
  special: boolean;
  /** Where the hero looks, when a camera decides it (first person). Otherwise movement does. */
  aim?: { x: number; y: number };
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
  /** A press during a swing is kept this long and chains the next blow. */
  attackBuffer: 0.45,
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
  nearSight: 0,
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
  /** Seconds of bleeding left (Bloody trait). */
  bleed: number;
  bleedTick: number;
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
  | { type: 'traitGained'; trait: string }
  | { type: 'hardToKill' }
  | { type: 'warning'; pos: Point }
  | { type: 'died'; cause: DeathCause };

/** Options for a new life: the hero's traits and the map the dynasty already knows. */
export interface LifeOptions {
  traits?: string[];
  /** Explored tiles per depth, shared with the dynasty (updated as you explore). */
  explored?: Record<number, string>;
}

/** Counters behind the acquired traits. */
export interface LifeCounters {
  kills: number;
  crawlerKills: number;
  parries: number;
  flares: number;
  spits: number;
  lowLight: number;
  dark: number;
  nearDeaths: number;
  belowTenth: boolean;
}

const freshCounters = (): LifeCounters => ({
  kills: 0,
  crawlerKills: 0,
  parries: 0,
  flares: 0,
  spits: 0,
  lowLight: 0,
  dark: 0,
  nearDeaths: 0,
  belowTenth: false,
});

/** Everything needed to bring a life back exactly where it was. */
export interface WorldSnapshot {
  v: 1;
  seed: string;
  classId: ClassId;
  life: number;
  depth: number;
  traits: string[];
  player: Point;
  facing: Point;
  survival: Survival;
  taken: number[];
  drops: LevelItem[];
  enemies: Array<Omit<Enemy, 'def' | 'roamField'>>;
  specialCharge: number;
  specialCooldown: number;
  comboIndex: number;
  counters: LifeCounters;
  hardToKillUsed: boolean;
  nextId: number;
  time: number;
}

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
  /** The hero's traits; acquired ones are added during the life. */
  traits: string[];
  /** All trait effects added together. */
  fx: TraitEffects & { attrs: Partial<Attributes> };
  counters: LifeCounters = freshCounters();
  /** Seconds since this life began. */
  time = 0;
  /** Tiles walked on this level, for the Pace Counter's map. */
  path = new Set<number>();
  hardToKillUsed = false;
  private hurtBonusReady = false;
  private lastHurtAt = -99;
  private lastCause: DeathCause = { type: 'hunger' };
  private readonly exploredByDepth: Record<number, string>;
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
  /** Seconds a press made during a swing is remembered, to chain the next blow. */
  attackBuffer = 0;
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

  constructor(seed: string, classId: ClassId = 'headsman', life = 0, depth = 1, options: LifeOptions = {}) {
    this.seed = seed;
    this.classId = classId;
    this.cls = CLASSES[classId];
    this.life = life;
    this.traits = [...(options.traits ?? [])];
    this.fx = combineEffects(this.traits);
    this.exploredByDepth = options.explored ?? {};
    this.survival = freshSurvival(this.maxHealth);
    this.enterLevel(depth);
  }

  /** Brings a saved life back exactly as it was. */
  static restore(snapshot: WorldSnapshot, explored: Record<number, string> = {}): World {
    const world = new World(snapshot.seed, snapshot.classId, snapshot.life, snapshot.depth, { traits: snapshot.traits, explored });
    world.player = { ...snapshot.player };
    world.facing = { ...snapshot.facing };
    world.survival = { ...snapshot.survival };
    world.taken = new Set(snapshot.taken);
    world.level.items.push(...snapshot.drops);
    world.enemies = snapshot.enemies.map((e) => ({ ...e, def: ENEMIES[e.kind], roamField: null, wanderTarget: e.wanderTarget }));
    world.specialCharge = snapshot.specialCharge;
    world.specialCooldown = snapshot.specialCooldown;
    world.comboIndex = snapshot.comboIndex;
    world.counters = { ...snapshot.counters };
    world.hardToKillUsed = snapshot.hardToKillUsed;
    world.nextId = snapshot.nextId;
    world.time = snapshot.time;
    world.lastViewTile = -1;
    return world;
  }

  snapshot(): WorldSnapshot {
    const generated = generateLevel(this.seed, this.depth, this.life).items.length;
    return {
      v: 1,
      seed: this.seed,
      classId: this.classId,
      life: this.life,
      depth: this.depth,
      traits: [...this.traits],
      player: { ...this.player },
      facing: { ...this.facing },
      survival: { ...this.survival },
      taken: [...this.taken],
      drops: this.level.items.slice(generated).map((i) => ({ ...i })),
      enemies: this.enemies.map(({ def: _def, roamField: _field, ...rest }) => ({ ...rest, pos: { ...rest.pos } })),
      specialCharge: this.specialCharge,
      specialCooldown: this.specialCooldown,
      comboIndex: this.comboIndex,
      counters: { ...this.counters },
      hardToKillUsed: this.hardToKillUsed,
      nextId: this.nextId,
      time: this.time,
    };
  }

  /** Writes this level's explored tiles back into the dynasty's map. */
  storeExplored(): void {
    const known = unpackTiles(this.exploredByDepth[this.depth], this.explored.length);
    for (let i = 0; i < known.length; i++) if (this.explored[i]) known[i] = 1;
    this.exploredByDepth[this.depth] = packTiles(known);
  }

  /** Class attributes plus traits, plus traits that only work in certain moments. */
  get attrs(): Attributes {
    const base = this.cls.attributes;
    const result = { ...base };
    for (const id of ATTRIBUTE_IDS) result[id] += this.fx.attrs[id] ?? 0;
    if (this.fx.fastingStrength && this.survival && this.survival.hunger < 25) result.str += 2;
    if (this.fx.lastBreath && this.survival && this.survival.health < this.baseMaxHealth() * 0.2) result.wil += 3;
    return result;
  }

  private baseMaxHealth(): number {
    const attrs = { ...this.cls.attributes };
    for (const id of ATTRIBUTE_IDS) attrs[id] += this.fx.attrs[id] ?? 0;
    return maxHealth(attrs) + (this.fx.maxHealth ?? 0);
  }

  get maxHealth(): number {
    return this.baseMaxHealth();
  }

  /** Half-angle of the hero's vision cone, in radians. */
  get visionCone(): number {
    return Math.max(0.35, COMBAT.visionCone + ((this.fx.visionCone ?? 0) * Math.PI) / 180);
  }

  private get parryWindow(): number {
    return Math.max(0.05, this.cls.parryWindow + parryBonus(this.attrs) + (this.fx.parryWindow ?? 0));
  }

  private get hpFraction(): number {
    return this.survival.health / this.maxHealth;
  }

  get depth(): number {
    return this.level.depth;
  }

  get lightRadius(): number {
    const base = lightRadius(this.survival.light) * (1 + (this.fx.lightRadius ?? 0));
    // Cat eyes and the like: seeing farther the dimmer the flame gets.
    return base + (this.fx.minLight ?? 0) * (1 - Math.sqrt(Math.max(0, this.survival.light) / 100));
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
    return this.cls.special.kind !== 'flare' || this.survival.light >= this.flareCost;
  }

  private get flareCost(): number {
    const special = this.cls.special;
    return special.kind === 'flare' ? Math.max(5, special.lightCost + (this.fx.flareCost ?? 0)) : 0;
  }

  /** Distance at which horrors notice the player. */
  detectionRange(def: EnemyDef): number {
    const run = this.running ? 1 + (COMBAT.run.detection - 1) * (1 + (this.fx.runNoise ?? 0)) : 1;
    return (def.detect + this.lightRadius * 0.8) * run * Math.max(0.3, 1 + (this.fx.detection ?? 0));
  }

  /** Rat eye: distance at which the plunderer sees items in the dark (0 for other classes). */
  get itemSight(): number {
    return this.cls.passive.kind === 'ratEye' ? this.cls.passive.itemSight : 0;
  }

  /** Goes one level down, keeping the survival meters and the special charge. */
  descend(): void {
    this.storeExplored();
    this.enterLevel(this.level.depth + 1);
  }

  private enterLevel(depth: number): void {
    this.level = generateLevel(this.seed, depth, this.life);
    this.player = { x: this.level.start.x + 0.5, y: this.level.start.y + 0.5 };
    // The dynasty's map: whatever any ancestor saw here is already known.
    this.explored = unpackTiles(this.exploredByDepth[depth], this.level.width * this.level.height);
    this.visibleNow.clear();
    this.taken.clear();
    this.path.clear();
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
      bleed: 0,
      bleedTick: 0,
    }));
    // Tunnel Rat: one more item on every level.
    if (this.fx.extraItem) {
      const extraRng = Rng.derive(this.seed, 'extra', this.life, depth);
      const room = extraRng.pick(this.level.rooms);
      const x = extraRng.int(room.x, room.x + room.w - 1);
      const y = extraRng.int(room.y, room.y + room.h - 1);
      if (isFloor(this.level, x, y)) this.level.items.push({ id: 900 + depth, kind: extraRng.pick<ItemKind>(['food', 'water', 'oil']), x, y });
    }
  }

  update(dt: number, input: ControlInput): WorldEvent[] {
    if (this.dead) return [];
    const events: WorldEvent[] = [];

    this.updateTimers(dt);
    this.handleInput(input, events);
    this.movePlayer(dt, input);
    this.updateAction(dt, events);

    const passive = this.cls.passive;
    const fx = this.fx;
    const before = this.survival;
    this.survival = tickSurvival(this.survival, dt, {
      maxHealth: this.maxHealth,
      hungerMultiplier: this.cls.hungerMultiplier * Math.max(0.2, 1 + (fx.hunger ?? 0)),
      thirstMultiplier: this.cls.thirstMultiplier * Math.max(0.2, 1 + (fx.thirst ?? 0)),
      lightMultiplier: (passive.kind === 'devoutFlame' ? passive.lightDrain : 1) * Math.max(0.2, 1 + (fx.light ?? 0)),
      starvingMultiplier: Math.max(0.2, 1 + (fx.starvingDrain ?? 0)),
    });
    if (this.survival.health < before.health) this.lastCause = before.hunger <= 0 || this.survival.hunger <= 0 ? { type: 'hunger' } : { type: 'thirst' };
    if (this.running) {
      const cost = Math.max(0.2, 1 + (fx.runCost ?? 0));
      this.survival = {
        ...this.survival,
        thirst: Math.max(0, this.survival.thirst - COMBAT.run.thirstPerSecond * cost * dt),
        hunger: Math.max(0, this.survival.hunger - COMBAT.run.hungerPerSecond * cost * dt),
      };
    }
    // Healing traits: well fed (Hot Blood), or at death's door (Last Breath).
    let regen = 0;
    if (fx.regenFed && this.survival.hunger > 50) regen += fx.regenFed;
    if (fx.lastBreath && this.hpFraction < 0.2) regen += 0.5;
    if (regen > 0 && this.survival.health > 0) {
      this.survival = { ...this.survival, health: Math.min(this.maxHealth, this.survival.health + regen * dt) };
    }
    this.gainCharge(this.cls.charge.perSecond * (1 + (fx.chargeOverTime ?? 0)) * dt);
    this.time += dt;
    if (fx.mapPath) this.path.add(Math.floor(this.player.y) * this.level.width + Math.floor(this.player.x));

    this.pickUp(events);
    const revealed = this.reveal();
    if (revealed.length > 0) events.push({ type: 'revealed', tiles: revealed });

    this.updateEnemies(dt, events);
    this.updateProjectiles(dt, events);

    this.checkAcquired(dt, events);
    if (isDead(this.survival) && this.fx.hardToKill && !this.hardToKillUsed) {
      // Hard to Kill: once per life, the blow that should have killed leaves 1 health.
      this.hardToKillUsed = true;
      this.survival = { ...this.survival, health: 1 };
      events.push({ type: 'hardToKill' });
    }
    if (isDead(this.survival)) {
      this.dead = true;
      events.push({ type: 'died', cause: this.lastCause });
    }
    return events;
  }

  // Player ------------------------------------------------------------------

  private updateTimers(dt: number): void {
    this.parryTimer = Math.max(0, this.parryTimer - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
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
    // While a blow or a special is under way, keep the direction the aim assist chose.
    const committed = this.action.type === 'attack' || this.action.type === 'special' || this.action.type === 'dodge';
    if (input.aim && length(input.aim) > 0) {
      if (!committed) this.facing = normalize(input.aim);
    } else if (moving && this.action.type !== 'dodge') {
      this.facing = normalize(input.move);
    }

    // Holding dodge runs once the roll is over; letting go or acting stops it.
    this.running = input.dodge && moving && this.action.type === 'none' && !dodgePressed;

    const free = this.action.type === 'none';
    const recovering = this.action.type === 'attack' && this.action.phase === 'recovery';

    if (attackPressed && free) {
      // Every press opens the parry window, and swings.
      this.parryTimer = this.parryWindow;
      this.startAttack(events);
    } else if (attackPressed && this.action.type === 'attack') {
      // Pressed while still swinging: remember it and chain the next blow right away.
      this.attackBuffer = COMBAT.attackBuffer;
    }

    if (specialPressed && (free || recovering) && this.specialReady) this.startSpecial(events);

    if (dodgePressed && this.dodgeCooldown <= 0 && (free || this.action.type === 'attack')) {
      const dir = moving ? normalize(input.move) : this.facing;
      this.action = { type: 'dodge', timer: COMBAT.dodge.duration, dir };
      this.invulnerableTimer = COMBAT.dodge.invulnerable + (this.fx.dodgeInvulnerable ?? 0);
      this.dodgeCooldown = COMBAT.dodge.cooldown * quicknessFactor(this.attrs);
      this.spendThirst(COMBAT.thirstCost.dodge);
      this.running = false;
      events.push({ type: 'dodge', dir });
    }
  }

  private movePlayer(dt: number, input: ControlInput): void {
    if (this.action.type === 'dodge') {
      const speed = (COMBAT.dodge.distance * (1 + (this.fx.dodgeDistance ?? 0))) / COMBAT.dodge.duration;
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
    let speed = CONFIG.player.speed * this.cls.speedMultiplier * (1 + (this.fx.walkSpeed ?? 0));
    if (this.running) speed *= COMBAT.run.speedMultiplier * (1 + (this.fx.runSpeed ?? 0));
    if (this.fx.coward && this.hpFraction < 0.3) speed *= 1.2;
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
            timer: action.step.recovery * quicknessFactor(this.attrs) * Math.max(0.5, 1 + (this.fx.comboSpeed ?? 0)),
            step: action.step,
          };
        } else {
          this.action = { type: 'none' };
          if (this.attackBuffer > 0) {
            this.attackBuffer = 0;
            this.parryTimer = this.parryWindow;
            this.startAttack(events);
          }
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
    this.comboTimer = this.cls.weapon.comboWindow * (1 + (this.fx.comboWindow ?? 0));
    if (this.comboIndex >= combo.length) this.comboIndex = 0;
    this.aim(step.range);
    this.action = { type: 'attack', phase: 'windup', timer: step.windup, step };
    this.running = false;
    this.spendThirst(COMBAT.thirstCost.attack);
    // War Cry: nearby Crawlers may scatter.
    if (this.fx.warCry) {
      for (const enemy of this.enemies) {
        if (enemy.kind !== 'crawler' || enemy.state === 'dead' || dist(enemy.pos, this.player) > 3) continue;
        if (this.rng.chance(0.25)) {
          enemy.state = 'flee';
          enemy.timer = 1;
        }
      }
    }
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
      this.damageEnemy(enemy, weapon.damage * step.damage, step.knockback * (1 + (this.fx.knockback ?? 0)), events);
      if (enemy.health <= 0) continue;
      if (this.fx.bleed) {
        enemy.bleed = 4;
        enemy.bleedTick = COMBAT.waxTick;
      }
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
    const attrs = this.attrs;
    const fx = this.fx;
    let damage = base * damageMultiplier(attrs);
    let crit = false;
    if (canCrit && this.riposteTimer > 0) {
      crit = true;
      damage *= fx.riposte ?? COMBAT.critMultiplier;
      this.riposteTimer = 0;
    } else if (canCrit && this.rng.chance(critChance(attrs) + (fx.crit ?? 0))) {
      crit = true;
      damage *= COMBAT.critMultiplier;
    }
    if (!enemy.alerted) damage *= 1 + (fx.unseenDamage ?? 0);
    if (enemy.health < enemy.def.health * 0.3) damage *= 1 + (fx.finisherDamage ?? 0);
    if (fx.crawlerBane && enemy.kind === 'crawler') damage *= 1.3;
    if (fx.coward && this.hpFraction < 0.3) damage *= 0.85;
    if (this.hurtBonusReady && fx.hurtBonus) {
      damage *= 1 + fx.hurtBonus;
      this.hurtBonusReady = false;
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
    this.gainCharge(this.cls.charge.perHitDealt * (1 + (fx.chargePerHit ?? 0)));
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
    enemy.bleed = 0;
    events.push({ type: 'enemyDied', id: enemy.id, kind: enemy.kind, pos: { ...enemy.pos } });
    this.counters.kills++;
    if (enemy.kind === 'crawler') this.counters.crawlerKills++;
    if (this.fx.killThirst) this.survival = { ...this.survival, thirst: Math.min(100, this.survival.thirst + this.fx.killThirst) };
    const passive = this.cls.passive;
    if (passive.kind === 'bloodthirst') {
      const amount = Math.round(this.maxHealth * passive.healFraction);
      this.survival = { ...this.survival, health: Math.min(this.maxHealth, this.survival.health + amount) };
      events.push({ type: 'heal', amount });
    }
    const dropChance = (passive.kind === 'ratEye' ? passive.dropChance : COMBAT.dropChance) + (this.fx.dropChance ?? 0);
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
        this.survival = { ...this.survival, light: this.survival.light - this.flareCost };
        this.counters.flares++;
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

  private hurtPlayer(base: number, lightStolen: number, events: WorldEvent[], source: { kind: EnemyKind; projectile?: boolean }): void {
    const fx = this.fx;
    let damage = base * Math.max(0.2, 1 + (fx.damageTaken ?? 0));
    if (source.kind === 'crawler') damage *= Math.max(0.2, 1 + (fx.crawlerDamage ?? 0));
    if (source.projectile) {
      damage *= Math.max(0.2, 1 + (fx.projectileDamage ?? 0));
      this.counters.spits++;
    }
    // Shield of Faith: the first blow after a quiet while is halved.
    if (fx.firstHitHalved && this.time - this.lastHurtAt > 6) damage *= 0.5;
    this.lastHurtAt = this.time;
    damage = Math.round(damage);
    this.survival = {
      ...this.survival,
      health: Math.max(0, this.survival.health - damage),
      light: Math.max(0, this.survival.light - lightStolen),
    };
    this.lastCause = { type: 'horror', kind: source.kind };
    this.hurtBonusReady = true;
    this.gainCharge(this.cls.charge.perHitTaken);
    events.push({ type: 'playerHit', damage, lightStolen });
    // One-Eyed: a Husk's blow when already badly hurt.
    if (source.kind === 'husk' && this.survival.health > 0 && this.hpFraction < 0.3) this.gainTrait('oneEyed', events);
  }

  /** Grants an acquired trait once, within the trait cap. */
  private gainTrait(id: string, events: WorldEvent[]): void {
    if (this.traits.includes(id) || !compatible(id, this.traits)) return;
    this.traits.push(id);
    while (this.traits.length > TRAIT_CAP) {
      const index = this.traits.findIndex((t) => traitDef(t).origin !== 'aging');
      this.traits.splice(index >= 0 ? index : 0, 1);
    }
    this.fx = combineEffects(this.traits);
    events.push({ type: 'traitGained', trait: id });
  }

  /** Watches what happens in this life and grants the acquired traits it earns. */
  private checkAcquired(dt: number, events: WorldEvent[]): void {
    const c = this.counters;
    if (this.survival.light < 25) c.lowLight += dt;
    if (this.survival.light <= 0) c.dark += dt;
    const fraction = this.hpFraction;
    if (fraction > 0 && fraction < 0.1 && !c.belowTenth) {
      c.belowTenth = true;
      c.nearDeaths++;
      this.gainTrait('scar', events);
      if (c.nearDeaths >= 2) this.gainTrait('badLeg', events);
    } else if (fraction > 0.3) {
      c.belowTenth = false;
    }
    if (c.kills >= 20) this.gainTrait('hardened', events);
    if (c.crawlerKills >= 15) this.gainTrait('crawlerBane', events);
    if (c.parries >= 10) this.gainTrait('reflexes', events);
    if (c.flares >= 10) this.gainTrait('burnt', events);
    if (c.spits >= 10) this.gainTrait('inkDrinker', events);
    if (c.lowLight >= 180) this.gainTrait('gloomAdjusted', events);
    if (c.dark >= 60 && this.survival.health > 0) this.gainTrait('darkDweller', events);
    if (this.depth >= 5) this.gainTrait('survivor', events);
    if (this.depth >= 10) this.gainTrait('cursebound', events);
  }

  private pickUp(events: WorldEvent[]): void {
    for (const item of this.level.items) {
      if (this.taken.has(item.id)) continue;
      if (dist(this.player, { x: item.x + 0.5, y: item.y + 0.5 }) > CONFIG.player.pickupDistance) continue;
      this.taken.add(item.id);
      this.consume(item.kind);
      events.push({ type: 'pickup', itemId: item.id, kind: item.kind });
    }
  }

  private consume(kind: ItemKind): void {
    const fx = this.fx;
    const s = this.survival;
    const amount = CONFIG.survival.restore[kind];
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    if (kind === 'food') {
      const health = Math.min(this.maxHealth, s.health + (fx.foodHeal ?? 0));
      this.survival = { ...s, health, hunger: clamp(s.hunger + amount * Math.max(0.2, 1 + (fx.foodValue ?? 0))) };
    } else if (kind === 'water') {
      this.survival = { ...s, thirst: clamp(s.thirst + amount) };
    } else {
      this.survival = { ...s, light: clamp(s.light + amount * Math.max(0.2, 1 + (fx.oilValue ?? 0))) };
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
        return angleBetween(this.facing, to) <= this.visionCone + Math.atan(0.7 / d);
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
    const sight = stealthSight(this.attrs) + this.lightRadius * 0.35 + (this.fx.snufferSight ?? 0);
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      this.burn(enemy, dt, events);
      this.bleedOut(enemy, dt, events);
      if (enemy.health <= 0) continue;
      const d = dist(enemy.pos, this.player);
      const tile = Math.floor(enemy.pos.y) * this.level.width + Math.floor(enemy.pos.x);
      const seen = this.visibleNow.has(tile) && (!enemy.def.stealthy || this.fx.snufferAlwaysVisible || d <= sight);
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
    if (d > COMBAT.eyesRange + (this.fx.eyesRange ?? 0)) return false;
    if (enemy.def.stealthy && d > sight * 1.8) return false;
    const toPlayer = { x: this.player.x - enemy.pos.x, y: this.player.y - enemy.pos.y };
    // Ember Pupils: every pair of eyes shows, looking or not.
    if (!this.fx.allEyes && !enemy.alerted && angleBetween(enemy.facing, toPlayer) > COMBAT.viewCone) return false;
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

  private bleedOut(enemy: Enemy, dt: number, events: WorldEvent[]): void {
    if (enemy.bleed <= 0) return;
    enemy.bleed -= dt;
    enemy.bleedTick -= dt;
    if (enemy.bleedTick > 0) return;
    enemy.bleedTick += COMBAT.waxTick;
    this.applyDamage(enemy, 1, false, true, events);
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
    const hearing = this.running ? COMBAT.run.hearing * Math.max(0.2, 1 + (this.fx.runNoise ?? 0)) : COMBAT.hearing;
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
      if (dist(other.pos, source.pos) > COMBAT.alertRadius * Math.max(0.2, 1 + (this.fx.alertRadius ?? 0))) continue;
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
            this.beginWindup(enemy, toPlayer, events);
            return;
          }
          this.chaseStep(enemy, dt, d, sees);
          return;
        }
        if (d <= def.range + 0.1 && sees) {
          this.beginWindup(enemy, toPlayer, events);
          return;
        }
        this.chaseStep(enemy, dt, d, sees);
        return;
      }
    }
  }

  private beginWindup(enemy: Enemy, dir: Point, events: WorldEvent[]): void {
    enemy.state = 'windup';
    enemy.timer = enemy.def.windup;
    enemy.strikeDir = dir;
    enemy.facing = dir;
    // Sixth Sense: a warning when the blow comes from behind.
    if (this.fx.sixthSense) {
      const toEnemy = { x: enemy.pos.x - this.player.x, y: enemy.pos.y - this.player.y };
      if (angleBetween(this.facing, toEnemy) > Math.PI * 0.55) events.push({ type: 'warning', pos: { ...enemy.pos } });
    }
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
      this.counters.parries++;
      events.push({ type: 'parry', id: enemy.id, pos: { ...enemy.pos } });
      return;
    }
    this.hurtPlayer(def.damage, def.stealsLight, events, { kind: def.kind });
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
      // Steady Hand: spit cannot reach you as a blow begins.
      if (this.fx.steadyHand && this.action.type === 'attack' && this.action.phase === 'windup') return false;
      this.hurtPlayer(p.damage, 0, events, { kind: 'mourner', projectile: true });
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
