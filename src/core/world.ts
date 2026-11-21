import { ATTRIBUTE_IDS, critChance, damageMultiplier, maxHealth, parryBonus, quicknessFactor, stealthSight, type Attributes } from './attributes';
import { CLASSES, type ClassDef, type ClassId, type ComboStep, type SpecialDef } from './classes';
import { CONFIG } from './config';
import { doorwayPartner, flood, floorDistances, isPassable, generateLevel, goldPile, groundHeight, isChasm, isFloor, isSeeThrough, isShallow, waterAt, LEVEL_HEIGHT, onSteps, stairProgress, type Stairwell, type Feature, type Level, type LevelItem, type LootKind, type Point } from './dungeon';
import { addItem, enlarged, ITEMS, removeItem, removeStack, starterKit, type Inventory, type ItemKind, type Packed } from './inventory';
import type { Cost } from './classes';
import { ENEMIES, spawnEnemies, type EnemyDef, type EnemyKind } from './enemies';
import { blocked, hasLineOfSight, moveWithCollision, visibleTiles } from './geometry';
import { Rng } from './rng';
import { covers, packTiles, unpackTiles, type CampSite, type ChalkSign, type DeathCause, type Work } from './dynasty';
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
  dodge: { distance: 2.2, duration: 0.28, invulnerable: 0.24, cooldown: 1.0 },
  run: {
    speedMultiplier: 1.6,
    /** Running is loud: detection range multiplier and hearing distance from any side. */
    detection: 1.5,
    hearing: 3.5,
  },
  /** A press during a swing is kept this long and chains the next blow. */
  attackBuffer: 0.45,
  /** Seconds over which recently lost health stops counting for Bloodthirst. */
  rallyFade: 3,
  /** Riposte after a parry: guaranteed critical hit within this many seconds. */
  riposteFor: 2,
  critMultiplier: 2,
  /** Aim assist: half-angle of the cone and extra reach in tiles. */
  aimCone: (75 * Math.PI) / 180,
  aimReach: 1.4,
  /** Horrors forget the player after this long without seeing them. */
  forgetAfter: 3,
  /** How far a pack hears one of its own find you, in tiles. */
  packRadius: 16,
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
  /** The pack it came with (see `EnemySpawn.pack`). */
  pack?: number;
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
  | { type: 'dodge'; timer: number; dir: Point; leap?: { from: Point; spare: number } }
  | { type: 'special'; timer: number; target: Enemy | null };

export type WorldEvent =
  | { type: 'pickup'; itemId: number; kind: LootKind; amount?: number }
  | { type: 'noRoom'; kind: ItemKind }
  | { type: 'refilled'; skins: number; turbid: boolean }
  | { type: 'found'; kinds: LootKind[]; gold: number; dropped: number }
  | { type: 'used'; kind: ItemKind }
  | { type: 'cantUse'; reason: 'danger' | 'empty' | 'camp' | 'locked' }
  | { type: 'channel'; kind: ItemKind; seconds: number }
  | { type: 'interrupted' }
  | { type: 'nightfall' }
  | { type: 'levelChanged'; depth: number; way: 'down' | 'up' }
  | { type: 'toMansion' }
  | { type: 'dawn' }
  | { type: 'campBuilt'; camp: CampSite }
  | { type: 'cantBuild'; reason: 'danger' | 'corridor' | 'taken' }
  | { type: 'leap' }
  | { type: 'digging'; seconds: number }
  | { type: 'forcing'; seconds: number }
  | { type: 'picking'; seconds: number }
  | { type: 'doorHit'; pos: Point; broke: boolean }
  | { type: 'unlocked'; depth: number }
  | { type: 'campPacked' }
  | { type: 'placeEntered'; id: string }
  | { type: 'dig' }
  | { type: 'splash' }
  | { type: 'roar'; near: number }
  | { type: 'floodRose'; depth: number }
  | { type: 'campLost'; camp: CampSite }
  | { type: 'workBuilt'; work: Work }
  | { type: 'torchFilled' }
  | { type: 'door'; open: boolean; barricade: boolean }
  | { type: 'bashing'; barricade: boolean }
  | { type: 'shutBroken'; barricade: boolean; depth: number }
  | { type: 'campUsed'; kind: ItemKind; sick?: boolean; poisoned?: boolean; nightmares?: boolean }
  | { type: 'needFire' }
  | { type: 'boiled' }
  | { type: 'fireLit' }
  | { type: 'slept'; outcome: 'quiet' | 'noises' | 'attack'; healed: number }
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
  /** What the hero carries down (a starter kit when left out). */
  inventory?: Inventory;
  /** The family's camps, shared with the dynasty (camps pitched now are added to it). */
  camps?: CampSite[];
  /** The family's torches, marks, barricades and ropes, shared with the dynasty. */
  works?: Work[];
  /** How far the floods have spread, by depth, shared with the dynasty. */
  floods?: Record<number, number>;
  /** Who is down there and in which generation, for the camps they pitch. */
  builder?: number;
  generation?: number;
}

/** Things the player asks for between frames; the world carries them out in its update. */
type Command = { type: 'interact' } | { type: 'use'; uid: number; sign?: ChalkSign } | { type: 'drop'; uid: number };

/** What the hero can do where they stand. */
export type Interaction =
  | 'ropeDown'
  | 'ropeUp'
  | 'camp'
  | 'torch'
  | 'openDoor'
  | 'closeDoor'
  | 'fountain'
  | 'drip'
  | 'search'
  | 'clear'
  | 'pool'
  | 'falls'
  | 'unlock'
  | 'force'
  | 'pick'
  | 'bash'
  | 'outpost'
  | null;

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
  /** Acquired traits already earned in this life: each is earned once, even if lost to the cap. */
  earned?: string[];
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
  earned: [],
});

/** What a life left behind on a level it walked: so going back finds it as it was. */
export interface LevelMemory {
  taken: number[];
  searched: number[];
  /** Doors by tile: open, shut or broken, and how much they can still take. */
  doors?: Array<[number, DoorState]>;
  drops: LevelItem[];
  enemies: WorldSnapshot['enemies'];
}

export interface DoorState {
  state: 'open' | 'shut' | 'broken';
  hp: number;
}

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
  /** `roaming`: on its way to `roamRoom` (its path is rebuilt on restore). */
  enemies: Array<Omit<Enemy, 'def' | 'roamField'> & { roaming?: boolean }>;
  specialCharge: number;
  specialCooldown: number;
  comboIndex: number;
  counters: LifeCounters;
  hardToKillUsed: boolean;
  nextId: number;
  time: number;
  rng: [number, number, number, number];
  inventory?: Inventory;
  gold?: number;

  /** Containers already searched on this level. */
  searched?: number[];
  calm?: number;
  clock?: number;
  /** Levels walked in this life, other than the current one. */
  memory?: Array<[number, LevelMemory]>;
  doors?: Array<[number, DoorState]>;
  fire?: boolean;
  nightmares?: boolean;
  /** This level's explored tiles, packed. */
  explored: string;
  path: number[];
  projectiles: Projectile[];
  /** The hero's action; a special's target is kept by id. */
  action: Omit<PlayerAction, 'target'> & { targetId?: number };
  timers: {
    parry: number;
    riposte: number;
    invulnerable: number;
    invisible: number;
    dodge: number;
    attackBuffer: number;
    combo: number;
    lastHurtAt: number;
    /** Health lost recently, part of which a kill wins back (Bloodthirst). */
    rally?: number;
  };
  running: boolean;
  hurtBonusReady: boolean;
  lastCause: DeathCause;
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
  /** The backpack, the purse, and containers already searched on this level. */
  inventory: Inventory;
  gold = 0;
  searched = new Set<number>();
  /** Seconds since the first dawn of this life. */
  clock = 0;
  /** The fire of the camp at hand is burning (until dawn). */
  campfire = false;
  /** Horror flesh brings bad dreams: the next night heals less. */
  nightmares = false;
  camps: CampSite[];
  works: Work[];
  private readonly builder: number;
  private readonly generation: number;
  /** Seconds without danger nearby; healing starts after a while. */
  calm = 0;
  /** Eating, drinking or filling the lamp: standing still for a moment. */
  channel: { uid: number; timer: number } | null = null;
  /** Digging out a collapse: which, and how long is left. */
  digging: { x: number; y: number; timer: number; pulse: number; kind: 'dig' | 'force' | 'pick' } | null = null;
  /** What is left of locked doors being battered down this life, by tile. */
  private lockHp = new Map<number, number>();

  private commands: Command[] = [];
  /** A floor item that did not fit, so the toast is not repeated every frame. */
  private refused = -1;
  /** Tiles walked on this level, for the Pace Counter's map. */
  path = new Set<number>();
  hardToKillUsed = false;
  private hurtBonusReady = false;
  private lastHurtAt = -99;
  /** Health lost recently; it fades over a few seconds. */
  rally = 0;
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
    this.inventory = options.inventory ? enlarged(JSON.parse(JSON.stringify(options.inventory))) : starterKit();
    this.camps = options.camps ?? [];
    this.works = options.works ?? [];
    this.floods = options.floods ?? {};
    this.builder = options.builder ?? 0;
    this.generation = options.generation ?? 1;
    this.survival = freshSurvival(this.maxHealth);
    this.enterLevel(depth);
  }

  /** Brings a saved life back exactly as it was. */
  static restore(snapshot: WorldSnapshot, options: Omit<LifeOptions, 'traits' | 'inventory'> = {}): World {
    const world = new World(snapshot.seed, snapshot.classId, snapshot.life, snapshot.depth, { ...options, traits: snapshot.traits });
    world.player = { ...snapshot.player };
    world.facing = { ...snapshot.facing };
    world.survival = { ...snapshot.survival };
    world.applyLevel({ taken: snapshot.taken, searched: snapshot.searched ?? [], drops: snapshot.drops, enemies: snapshot.enemies, doors: snapshot.doors });
    world.memory = new Map(snapshot.memory ?? []);
    world.specialCharge = snapshot.specialCharge;
    world.specialCooldown = snapshot.specialCooldown;
    world.comboIndex = snapshot.comboIndex;
    world.counters = { ...snapshot.counters };
    world.hardToKillUsed = snapshot.hardToKillUsed;
    world.nextId = snapshot.nextId;
    world.time = snapshot.time;
    if (snapshot.inventory) world.inventory = JSON.parse(JSON.stringify(snapshot.inventory));
    world.gold = snapshot.gold ?? 0;


    world.calm = snapshot.calm ?? 0;
    world.clock = snapshot.clock ?? 0;
    world.campfire = snapshot.fire ?? false;
    world.nightmares = snapshot.nightmares ?? false;
    world.rng.state = snapshot.rng;
    world.explored = unpackTiles(snapshot.explored, world.level.width * world.level.height);
    world.path = new Set(snapshot.path);
    world.projectiles = snapshot.projectiles.map((p) => ({ ...p, pos: { ...p.pos }, vel: { ...p.vel } }));
    const { targetId, ...action } = snapshot.action;
    world.action = (action.type === 'special' ? { ...action, target: world.enemies.find((e) => e.id === targetId) ?? null } : action) as PlayerAction;
    const t = snapshot.timers;
    world.parryTimer = t.parry;
    world.riposteTimer = t.riposte;
    world.invulnerableTimer = t.invulnerable;
    world.invisibleTimer = t.invisible;
    world.dodgeCooldown = t.dodge;
    world.attackBuffer = t.attackBuffer;
    world.comboTimer = t.combo;
    world.lastHurtAt = t.lastHurtAt;
    world.rally = t.rally ?? 0;
    world.running = snapshot.running;
    world.hurtBonusReady = snapshot.hurtBonusReady;
    world.lastCause = snapshot.lastCause;
    world.lastViewTile = -1;
    return world;
  }

  snapshot(): WorldSnapshot {
    const here = this.captureLevel();
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
      taken: here.taken,
      doors: here.doors,
      drops: here.drops,
      enemies: here.enemies,
      memory: [...this.memory].map(([d, m]) => [d, JSON.parse(JSON.stringify(m))] as [number, LevelMemory]),
      specialCharge: this.specialCharge,
      specialCooldown: this.specialCooldown,
      comboIndex: this.comboIndex,
      counters: { ...this.counters },
      hardToKillUsed: this.hardToKillUsed,
      nextId: this.nextId,
      time: this.time,
      inventory: JSON.parse(JSON.stringify(this.inventory)),
      gold: this.gold,

      searched: here.searched,
      calm: this.calm,
      clock: this.clock,
      fire: this.campfire,
      nightmares: this.nightmares,
      rng: this.rng.state,
      explored: packTiles(this.explored),
      path: [...this.path],
      projectiles: this.projectiles.map((p) => ({ ...p, pos: { ...p.pos }, vel: { ...p.vel } })),
      action:
        this.action.type === 'special'
          ? { type: 'special', timer: this.action.timer, targetId: this.action.target?.id }
          : JSON.parse(JSON.stringify(this.action)),
      timers: {
        parry: this.parryTimer,
        riposte: this.riposteTimer,
        invulnerable: this.invulnerableTimer,
        invisible: this.invisibleTimer,
        dodge: this.dodgeCooldown,
        attackBuffer: this.attackBuffer,
        combo: this.comboTimer,
        lastHurtAt: this.lastHurtAt,
        rally: this.rally,
      },
      running: this.running,
      hurtBonusReady: this.hurtBonusReady,
      lastCause: this.lastCause,
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

  /** On the steps of the stairs down (walking on takes you to the level below). */
  get atStairs(): boolean {
    return onSteps(this.level.down, this.player);
  }

  /**
   * Height of the ground at a point, relative to this level's floor: down the stairs it
   * drops to the floor below, up the stairs from below it rises to the floor above.
   */
  heightAt(p: Point): number {
    const { down, up } = this.level;
    const ground = groundHeight(this.level, p);
    if (ground > 0) return ground;
    if (onSteps(down, p)) return -LEVEL_HEIGHT * Math.min(1, Math.max(0, (stairProgress(down, p) - 0.5) / 3));
    if (onSteps(up, p)) return LEVEL_HEIGHT * (1 - Math.min(1, Math.max(0, (stairProgress(up, p) - 0.5) / 3)));
    return 0;
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
    const night = this.isNight ? CONFIG.time.nightDetection : 1;
    return (def.detect + this.lightRadius * 0.8) * run * night * Math.max(0.3, 1 + (this.fx.detection ?? 0));
  }

  /** Rat eye: distance at which the plunderer sees items in the dark (0 for other classes). */
  get itemSight(): number {
    return this.cls.passive.kind === 'ratEye' ? this.cls.passive.itemSight : 0;
  }

  /** Goes one level down by the stairs, keeping the survival meters and the special charge. */
  descend(): void {
    this.changeLevel('down', this.pointOn(this.level.down, 3.1));
  }

  /** On the steps of the stairs up (walking up takes you to the level above, or out). */
  get atUpStairs(): boolean {
    return onSteps(this.level.up, this.player);
  }

  /**
   * Climbs to the level above by the stairs. From depth 1 the stairs lead out to the
   * mansion: the world stays at depth 1, and the session takes over.
   */
  ascend(): 'mansion' | 'climbed' {
    if (this.depth <= 1) return 'mansion';
    this.changeLevel('up', this.pointOn(this.level.up, 0.9));
    return 'climbed';
  }

  /** A point on a stairwell's centre line, `progress` tiles down from its top tile. */
  private pointOn(sw: Stairwell, progress: number): Point {
    return { x: sw.top.x + 0.5 + sw.dir.x * progress, y: sw.top.y + 0.5 + sw.dir.y * progress };
  }

  /** Horrors on your heels: they come down (or up) the stairs after you, a moment later. */
  private followers: Array<{ enemy: Omit<Enemy, 'def' | 'roamField'>; timer: number }> = [];

  /**
   * Walks from one level to the next by the stairs: the hero keeps their place (the
   * levels are stacked), and horrors hunting close behind follow.
   */
  private changeLevel(way: 'down' | 'up', at: Point): void {
    const chasers = this.enemies.filter((e) => e.state !== 'dead' && e.alerted && dist(e.pos, this.player) < 9);
    this.enemies = this.enemies.filter((e) => !chasers.includes(e));
    this.leaveLevel();
    this.enterLevel(this.depth + (way === 'down' ? 1 : -1), 'stairs', at);
    this.followers = chasers.map(({ def: _def, roamField: _field, ...enemy }, i) => ({ enemy: { ...enemy, pos: { ...enemy.pos } }, timer: 1.5 + i * 0.8 }));
    this.followWay = way;
  }

  private followWay: 'down' | 'up' = 'down';

  /** Followers step off the stairs one by one. */
  private updateFollowers(dt: number): void {
    if (this.followers.length === 0) return;
    for (const f of this.followers) f.timer -= dt;
    const ready = this.followers.filter((f) => f.timer <= 0);
    this.followers = this.followers.filter((f) => f.timer > 0);
    for (const f of ready) {
      // Down the stairs they arrive by the steps from above; up, by the steps going down.
      const pos = this.followWay === 'down' ? this.pointOn(this.level.up, 2.2) : this.pointOn(this.level.down, 1.5);
      this.enemies.push({ ...f.enemy, pos, def: ENEMIES[f.enemy.kind], roamField: null, alerted: true, state: 'chase', forgetTimer: 0 });
    }
  }

  /**
   * Walking on the stairs: near the foot of the last step down, or the top of the first step
   * up (the end walls stop you just short of them), the level changes.
   */
  private checkStairs(events: WorldEvent[]): void {
    const { down, up } = this.level;
    if (onSteps(down, this.player) && stairProgress(down, this.player) > 3.0) {
      this.changeLevel('down', { ...this.player });
      events.push({ type: 'levelChanged', depth: this.depth, way: 'down' });
    } else if (onSteps(up, this.player) && stairProgress(up, this.player) < 1.0) {
      if (this.depth <= 1) {
        events.push({ type: 'toMansion' });
        return;
      }
      this.changeLevel('up', { ...this.player });
      events.push({ type: 'levelChanged', depth: this.depth, way: 'up' });
    }
  }

  /** A night at the mansion: safe sleep, a full belly, full waterskins; below, the night passes. */
  restAtMansion(): WorldEvent[] {
    const events: WorldEvent[] = [];
    this.survival = { ...this.survival, health: this.maxHealth, hunger: 100, thirst: 100 };
    for (const it of this.inventory.items) {
      if (it.kind !== 'waterskin') continue;
      it.charges = ITEMS.waterskin.charges;
      it.turbid = false;
    }
    const cycle = CONFIG.time.day + CONFIG.time.night;
    this.clock = Math.floor(this.clock / cycle) * cycle + cycle;
    this.nightmares = false;
    this.dawn(events, null);
    return events;
  }

  /** Leaves an item (a whole pile) behind for good (at the mansion there is no floor to drop it on). */
  discardItem(uid: number): void {
    removeStack(this.inventory, uid);
  }

  /** Buys from the mansion's shop with the hero's gold. */
  buy(kind: ItemKind): 'bought' | 'gold' | 'room' {
    const price = CONFIG.shop[kind as keyof typeof CONFIG.shop];
    if (price === undefined || this.gold < price) return 'gold';
    if (!addItem(this.inventory, kind)) return 'room';
    this.gold -= price;
    return 'bought';
  }

  /** Back from the mansion: on the stairs down into depth 1, where every life begins. */
  returnFromSurface(): void {
    this.player = this.pointOn(this.level.up, 1.6);
    this.facing = { ...this.level.up.dir };
    this.lastViewTile = -1;
  }

  /** Levels this life has walked, as they were left. */
  private memory = new Map<number, LevelMemory>();
  /** Items generated with the level (the rest were dropped during this life). */
  private baseItems = 0;

  private leaveLevel(): void {
    this.storeExplored();
    this.memory.set(this.depth, this.captureLevel());
  }

  private captureLevel(): LevelMemory {
    return {
      taken: [...this.taken],
      searched: [...this.searched],
      doors: [...this.doorStates].map(([k, v]) => [k, { ...v }] as [number, DoorState]),
      drops: this.level.items.slice(this.baseItems).map((i) => ({ ...i })),
      enemies: this.enemies.map(({ def: _def, roamField, ...rest }) => ({ ...rest, pos: { ...rest.pos }, roaming: roamField !== null })),
    };
  }

  private applyLevel(mem: LevelMemory): void {
    this.taken = new Set(mem.taken);
    this.searched = new Set(mem.searched);
    if (mem.doors) this.doorStates = new Map(mem.doors.map(([k, v]) => [k, { ...v }]));
    this.refreshShut();
    this.level.items.splice(this.baseItems);
    this.level.items.push(...mem.drops.map((i) => ({ ...i })));
    this.enemies = mem.enemies.map(({ roaming, ...e }) => {
      const room = this.level.rooms[e.roamRoom];
      const roamField = roaming && room ? floorDistances(this.level, { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) }) : null;
      return { ...e, pos: { ...e.pos }, def: ENEMIES[e.kind], roamField };
    });
  }

  private enterLevel(depth: number, from: 'above' | 'stairs' | 'ropeDown' | 'ropeUp' = 'above', at?: Point): void {
    this.level = generateLevel(this.seed, depth, this.life);
    // A waterfall's flood is tracked from the first time anyone sees it.
    if (this.level.fall && this.floods[depth] === undefined) this.floods[depth] = 0;
    flood(this.level, this.floods[depth] ?? 0);
    // By stairs you keep your place (the levels are stacked); by rope you arrive at the
    // landing below, or beside the pit above; a life begins on the stairs from the mansion.
    if (from === 'stairs' && at) this.player = { ...at };
    else if (from === 'above') {
      this.player = this.pointOn(this.level.up, 1.6);
      this.facing = { ...this.level.up.dir };
    } else {
      const arrival = from === 'ropeDown' ? this.level.landing : this.besidePit();
      this.player = { x: arrival.x + 0.5, y: arrival.y + 0.5 };
    }
    this.followers = [];
    // The dynasty's map: whatever any ancestor saw here is already known.
    this.explored = unpackTiles(this.exploredByDepth[depth], this.level.width * this.level.height);
    this.visibleNow.clear();
    this.taken.clear();
    this.path.clear();
    this.searched.clear();
    this.channel = null;
    this.digging = null;
    this.lockHp.clear();
    this.projectiles = [];
    this.action = { type: 'none' };
    this.running = false;
    this.lastViewTile = -1;
    this.flowTile = -1;
    this.rng = Rng.derive(this.seed, 'combat', this.life, depth);
    const spawnRng = Rng.derive(this.seed, 'enemies', this.life, depth);
    this.nextId = Math.max(this.nextId, ...this.level.items.map((i) => i.id + 1));
    this.enemies = spawnEnemies(this.level, spawnRng).map((spawn) => ({ ...this.makeEnemy(spawn.kind, spawn.pos, spawn.room, spawn.roamer, spawnRng), pack: spawn.pack }));
    // Tunnel Rat: one more item on every level.
    if (this.fx.extraItem) {
      const extraRng = Rng.derive(this.seed, 'extra', this.life, depth);
      const room = extraRng.pick(this.level.rooms);
      const x = extraRng.int(room.x, room.x + room.w - 1);
      const y = extraRng.int(room.y, room.y + room.h - 1);
      if (isFloor(this.level, x, y)) this.level.items.push({ id: 900 + depth, kind: extraRng.pick<LootKind>(['ration', 'oil', 'gold']), amount: goldPile(extraRng, depth), x, y });
    }
    this.baseItems = this.level.items.length;
    // Doors: some stand open, some shut, as this life finds them.
    const doorRng = Rng.derive(this.seed, 'doorstate', this.life, depth);
    this.doorStates = new Map(
      this.level.doors.map((d) => [d.y * this.level.width + d.x, { state: doorRng.chance(0.5) ? 'open' : 'shut', hp: CONFIG.works.doorHp } as DoorState]),
    );
    // Locked and stuck doors are found shut.
    for (const l of this.level.locks) {
      const door = this.doorStates.get(l.y * this.level.width + l.x);
      if (door && this.lockAt(l.x, l.y)) door.state = 'shut';
    }
    // Double doors: both leaves found the same way.
    for (const d of this.level.doors) {
      const partner = doorwayPartner(this.level, d);
      const a = this.doorStates.get(d.y * this.level.width + d.x)!;
      const b = partner && this.doorStates.get(partner.y * this.level.width + partner.x);
      if (b && partner && (partner.y * this.level.width + partner.x) > d.y * this.level.width + d.x) b.state = a.state;
    }
    this.refreshShut();
    // A level already walked in this life is found as it was left.
    const mem = this.memory?.get(depth);
    if (mem) this.applyLevel(mem);
  }

  update(dt: number, input: ControlInput): WorldEvent[] {
    if (this.dead) return [];
    const events: WorldEvent[] = [];

    this.updateTimers(dt);
    this.runCommands(events);
    this.handleInput(input, events);
    const from = { ...this.player };
    this.movePlayer(dt, input);
    const walked = dist(from, this.player);
    if (walked > 0) this.spend(this.cls.costs.walk, walked);
    this.checkStairs(events);
    if (events.some((e) => e.type === 'toMansion')) return events;
    this.updateFollowers(dt);
    this.updateChannel(dt, input, events);
    this.updateDigging(dt, input, events);
    this.updateAction(dt, events);

    const passive = this.cls.passive;
    const fx = this.fx;
    const before = this.survival;
    this.survival = tickSurvival(this.survival, dt, {
      maxHealth: this.maxHealth,
      hungerMultiplier: this.cls.hungerMultiplier * Math.max(0.2, 1 + (fx.hunger ?? 0)),
      thirstMultiplier: this.cls.thirstMultiplier * Math.max(0.2, 1 + (fx.thirst ?? 0)),
      // In a torch's light the lamp can rest.
      lightMultiplier: this.inTorchLight(this.player)
        ? 0
        : (passive.kind === 'devoutFlame' ? passive.lightDrain : 1) * Math.max(0.2, 1 + (fx.light ?? 0)) * (this.isNight ? CONFIG.time.nightLight : 1),
      starvingMultiplier: Math.max(0.2, 1 + (fx.starvingDrain ?? 0)),
    });
    if (this.survival.health < before.health) this.lastCause = before.hunger <= 0 || this.survival.hunger <= 0 ? { type: 'hunger' } : { type: 'thirst' };
    if (this.running) this.spend(this.cls.costs.run, dt * CONFIG.player.runCost * Math.max(0.2, 1 + (fx.runCost ?? 0)));
    this.healWhenCalm(dt);
    // Healing traits: well fed (Hot Blood), or at death's door (Last Breath).
    let regen = 0;
    if (fx.regenFed && this.survival.hunger > 50) regen += fx.regenFed;
    if (fx.lastBreath && this.hpFraction < 0.2) regen += 0.5;
    if (regen > 0 && this.survival.health > 0) {
      this.survival = { ...this.survival, health: Math.min(this.maxHealth, this.survival.health + regen * dt) };
    }
    this.gainCharge(this.cls.charge.perSecond * (1 + (fx.chargeOverTime ?? 0)) * dt);
    this.time += dt;
    this.tickClock(dt, events);
    this.rally *= Math.exp(-dt / COMBAT.rallyFade);
    if (fx.mapPath) this.path.add(Math.floor(this.player.y) * this.level.width + Math.floor(this.player.x));
    this.wade(events);
    this.noticePlace(events);
    this.roar(dt, events);

    this.pickUp(events);
    const revealed = this.reveal();
    if (revealed.length > 0) events.push({ type: 'revealed', tiles: revealed });

    this.updateEnemies(dt, events);
    this.bashShut(dt, events);
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
      if (this.cls.leapsChasms && this.leapAhead(dir)) {
        this.action.leap = { from: { ...this.player }, spare: 0.4 };
        events.push({ type: 'leap' });
      }
      this.invulnerableTimer = COMBAT.dodge.invulnerable + (this.fx.dodgeInvulnerable ?? 0);
      this.dodgeCooldown = COMBAT.dodge.cooldown * quicknessFactor(this.attrs);
      this.spend(this.cls.costs.dodge);
      this.running = false;
      events.push({ type: 'dodge', dir });
    }
  }

  /**
   * Whether a dodge along `dir` reaches a chasm narrow enough to leap: it starts within
   * the dodge's reach, is at most about a tile across and has floor on the far side.
   */
  private leapAhead(dir: Point): boolean {
    const reach = COMBAT.dodge.distance * (1 + (this.fx.dodgeDistance ?? 0));
    let start = -1;
    for (let t = 0; t <= reach + 1.6; t += 0.05) {
      const x = Math.floor(this.player.x + dir.x * t);
      const y = Math.floor(this.player.y + dir.y * t);
      const chasm = isChasm(this.level, x, y);
      if (start < 0) {
        if (chasm) {
          if (t > reach) return false;
          start = t;
        } else if (!isFloor(this.level, x, y)) return false;
      } else if (!chasm) return isFloor(this.level, x, y) && t - start <= CONFIG.level.leapSpan;
    }
    return false;
  }

  private movePlayer(dt: number, input: ControlInput): void {
    if (this.action.type === 'dodge') {
      const speed = (COMBAT.dodge.distance * (1 + (this.fx.dodgeDistance ?? 0)) * this.thirstPenalty) / COMBAT.dodge.duration;
      this.player = moveWithCollision(
        this.level,
        this.player,
        this.action.dir.x * speed * dt,
        this.action.dir.y * speed * dt,
        CONFIG.player.radius,
        !!this.action.leap,
      );
      return;
    }
    const l = length(input.move);
    if (l < 0.05) return;
    let speed = CONFIG.player.speed * this.cls.speedMultiplier * (1 + (this.fx.walkSpeed ?? 0));
    if (this.running) speed *= COMBAT.run.speedMultiplier * (1 + (this.fx.runSpeed ?? 0)) * this.thirstPenalty;
    if (this.fx.coward && this.hpFraction < 0.3) speed *= 1.2;
    if (this.action.type === 'attack') speed *= 0.35;
    if (this.action.type === 'special') speed *= 0.2;
    if (isShallow(this.level, Math.floor(this.player.x), Math.floor(this.player.y))) speed *= CONFIG.water.wade;
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
        // A leap goes on until both feet are on the far side (or, failing that, back).
        if (action.leap && blocked(this.level, this.player, CONFIG.player.radius)) {
          if (action.leap.spare > 0) {
            action.leap.spare -= 0.03;
            action.timer = 0.03;
            return;
          }
          this.player = action.leap.from;
        }
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
    this.spend(this.cls.costs.attack);
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
    this.batterDoors(step, events);
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
    let damage = base * damageMultiplier(attrs) * this.hungerPenalty;
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
    // Bloodthirst: a kill wins back part of the health lost in the last few seconds, so it
    // rewards fighting back at once, not grinding through every horror at full health.
    if (passive.kind === 'bloodthirst' && this.rally >= 1) {
      const amount = Math.round(this.rally * passive.healFraction);
      this.rally -= amount;
      this.survival = { ...this.survival, health: Math.min(this.maxHealth, this.survival.health + amount) };
      events.push({ type: 'heal', amount });
    }
    const dropChance = (passive.kind === 'ratEye' ? passive.dropChance : COMBAT.dropChance) + (this.fx.dropChance ?? 0);
    if (this.rng.chance(dropChance)) {
      const kind = this.rng.pick<LootKind>(['ration', 'oil', 'gold', 'gold']);
      const item: LevelItem = { id: this.nextId++, kind, x: Math.floor(enemy.pos.x), y: Math.floor(enemy.pos.y) };
      if (kind === 'gold') item.amount = goldPile(this.rng, this.depth);
      if (isPassable(this.level, item.x, item.y)) {
        this.level.items.push(item);
        events.push({ type: 'drop', item });
      }
    }
    // Crawlers and Husks leave flesh that feeds, cooked, at a price.
    if ((enemy.kind === 'crawler' || enemy.kind === 'husk') && this.rng.chance(CONFIG.loot.horrorMeat)) {
      const meat: LevelItem = { id: this.nextId++, kind: 'horrorMeat', x: Math.floor(enemy.pos.x), y: Math.floor(enemy.pos.y) };
      if (isPassable(this.level, meat.x, meat.y)) {
        this.level.items.push(meat);
        events.push({ type: 'drop', item: meat });
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
    this.spend(this.cls.costs.special);
  }

  private gainCharge(amount: number): void {
    if (amount > 0) this.specialCharge = Math.min(1, this.specialCharge + amount);
  }

  /** The body pays for what it does, in hunger and thirst; traits make it cheaper or dearer. */
  private spend([hunger, thirst]: Cost, times = 1): void {
    const fx = this.fx;
    this.survival = {
      ...this.survival,
      hunger: Math.max(0, this.survival.hunger - hunger * times * Math.max(0.2, 1 + (fx.hunger ?? 0))),
      thirst: Math.max(0, this.survival.thirst - thirst * times * Math.max(0.2, 1 + (fx.thirst ?? 0))),
    };
  }

  /** Whether any awake horror is close: no eating, drinking or healing then. */
  get inDanger(): boolean {
    return this.enemies.some((e) => e.state !== 'dead' && e.alerted && dist(e.pos, this.player) < 8);
  }

  /** Out of danger for a while, wounds close slowly, paid for with hunger and thirst. */
  private healWhenCalm(dt: number): void {
    this.calm = this.inDanger ? 0 : this.calm + dt;
    const s = this.survival;
    // At night wounds stay open until you sleep.
    if (this.isNight || this.calm < CONFIG.survival.calmBeforeHealing || s.health >= this.maxHealth || s.hunger <= 0 || s.thirst <= 0) return;
    const amount = Math.min(CONFIG.survival.healPerSecond * dt, this.maxHealth - s.health);
    this.survival = { ...s, health: s.health + amount };
    this.spend(this.cls.costs.heal, amount);
  }

  /** Hungry hands hit softer. */
  private get hungerPenalty(): number {
    return this.survival.hunger < CONFIG.survival.lowMeter ? 0.8 : 1;
  }

  /** A dry throat slows dodging and running. */
  private get thirstPenalty(): number {
    return this.survival.thirst < CONFIG.survival.lowMeter ? 0.85 : 1;
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
    this.rally += Math.min(damage, this.survival.health);
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
    const earned = (this.counters.earned ??= []);
    if (earned.includes(id)) return;
    earned.push(id);
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
    // Scars are for surviving: dropping below a tenth of your health and climbing back.
    const fraction = this.hpFraction;
    if (fraction > 0 && fraction < 0.1) c.belowTenth = true;
    else if (c.belowTenth && fraction > 0.3) {
      c.belowTenth = false;
      c.nearDeaths++;
      this.gainTrait('scar', events);
      if (c.nearDeaths >= 2) this.gainTrait('badLeg', events);
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
      if (dist(this.player, { x: item.x + 0.5, y: item.y + 0.5 }) > CONFIG.player.pickupDistance) {
        if (this.refused === item.id) this.refused = -1;
        continue;
      }
      if (item.kind === 'gold') {
        this.gold += item.amount ?? 0;
      } else if (!addItem(this.inventory, item.kind, item.charges ?? ITEMS[item.kind].charges, { turbid: item.turbid, poison: item.poison })) {
        // No room: it stays on the floor until something is dropped.
        if (this.refused !== item.id) events.push({ type: 'noRoom', kind: item.kind });
        this.refused = item.id;
        continue;
      }
      this.taken.add(item.id);
      events.push({ type: 'pickup', itemId: item.id, kind: item.kind, amount: item.amount });
    }
  }

  // Day, night and camps ---------------------------------------------------------------

  get isNight(): boolean {
    return this.clock % (CONFIG.time.day + CONFIG.time.night) >= CONFIG.time.day;
  }

  /** Day of this life, from 1. */
  get day(): number {
    return Math.floor(this.clock / (CONFIG.time.day + CONFIG.time.night)) + 1;
  }

  /** How far through the day or the night, 0 to 1. */
  get phase(): number {
    const t = this.clock % (CONFIG.time.day + CONFIG.time.night);
    return this.isNight ? (t - CONFIG.time.day) / CONFIG.time.night : t / CONFIG.time.day;
  }

  private tickClock(dt: number, events: WorldEvent[]): void {
    const wasNight = this.isNight;
    this.clock += dt;
    if (!wasNight && this.isNight) this.nightfall(events);
    else if (wasNight && !this.isNight) this.dawn(events, null);
  }

  /** Night falls: hunters come out of the far rooms. */
  private nightfall(events: WorldEvent[]): void {
    const rng = Rng.derive(this.seed, 'nightfall', this.life, this.depth, this.day);
    const far = this.level.rooms
      .map((room, index) => ({ room, index }))
      .filter(({ room }) => dist(this.player, { x: room.x + room.w / 2, y: room.y + room.h / 2 }) > 12);
    if (far.length === 0) return;
    const count = 2 + Math.floor(this.depth / 2);
    for (let i = 0; i < count; i++) {
      const { room, index } = rng.pick(far);
      const pos = { x: rng.int(room.x, room.x + room.w - 1) + 0.5, y: rng.int(room.y, room.y + room.h - 1) + 0.5 };
      // Torchlit rooms are left alone.
      if (!isFloor(this.level, Math.floor(pos.x), Math.floor(pos.y)) || this.inTorchLight(pos)) continue;
      this.enemies.push(this.makeEnemy(rng.pick<EnemyKind>(['crawler', 'crawler', 'husk', 'snuffer']), pos, index, true, rng));
    }
    events.push({ type: 'nightfall' });
  }

  /** Dawn: the fire is out, and empty camps learn whether something came in the night. */
  private dawn(events: WorldEvent[], slept: CampSite | null): void {
    this.campfire = false;
    const rng = Rng.derive(this.seed, 'dawn', this.life, this.day);
    for (const camp of [...this.camps]) {
      if (camp === slept || !rng.chance(CONFIG.camp.emptyAttack)) continue;
      camp.condition -= CONFIG.camp.emptyDamage;
      if (camp.condition <= 0) this.loseCamp(camp, events);
    }
    this.advanceFloods(events);
    // Torches burn down, a day at a time; ropes rot; barricades take a beating some nights.
    for (const w of [...this.works]) {
      if (w.kind === 'torch') w.condition = Math.max(0, w.condition - CONFIG.works.torchBurn);
      if (w.kind === 'rope') {
        w.condition -= CONFIG.works.ropeRot;
        if (w.condition <= 0) this.works.splice(this.works.indexOf(w), 1);
      }
      if (w.kind === 'barricade' && rng.chance(CONFIG.works.nightBarricade)) {
        w.condition -= 30;
        if (w.condition <= 0) {
          this.works.splice(this.works.indexOf(w), 1);
          if (w.depth === this.depth) this.refreshShut();
          events.push({ type: 'shutBroken', barricade: true, depth: w.depth });
        }
      }
    }
    events.push({ type: 'dawn' });
  }

  /** A camp of old within reach (in some locations) that nobody of the family has lit yet. */
  get outpostInReach(): Point | null {
    if (this.campInReach) return null;
    return (
      this.level.outposts.find(
        (p) => dist(this.player, { x: p.x + 0.5, y: p.y + 0.5 }) <= CONFIG.camp.reach && !this.camps.some((c) => c.depth === this.depth && c.x === p.x && c.y === p.y),
      ) ?? null
    );
  }

  /**
   * Lights a camp of old again: it becomes a family camp, with no kit spent. Not with
   * horrors near.
   */
  relightOutpost(): WorldEvent[] {
    const p = this.outpostInReach;
    if (!p) return [];
    if (this.inDanger) return [{ type: 'cantBuild', reason: 'danger' }];
    const camp: CampSite = {
      id: Math.max(0, ...this.camps.map((c) => c.id)) + 1,
      depth: this.depth,
      x: p.x,
      y: p.y,
      built: this.generation,
      builder: this.builder,
      condition: 100,
    };
    this.camps.push(camp);
    return [{ type: 'campBuilt', camp }];
  }

  /**
   * Packs up the camp at hand: the bedroll and the rest go back into the backpack as a camp
   * kit, to pitch again elsewhere (deeper, most likely). Not while horrors are near, and
   * only if the kit fits.
   */
  packCamp(): WorldEvent[] {
    const camp = this.campInReach;
    if (!camp) return [];
    if (this.inDanger) return [{ type: 'cantBuild', reason: 'danger' }];
    if (!addItem(this.inventory, 'campKit')) return [{ type: 'noRoom', kind: 'campKit' }];
    this.camps.splice(this.camps.indexOf(camp), 1);
    this.campfire = false;
    return [{ type: 'campPacked' }];
  }

  private loseCamp(camp: CampSite, events: WorldEvent[]): void {
    const i = this.camps.indexOf(camp);
    if (i >= 0) this.camps.splice(i, 1);
    events.push({ type: 'campLost', camp });
  }

  /** A family camp on this level within reach. */
  get campInReach(): CampSite | null {
    return (
      this.camps.find((c) => c.depth === this.depth && dist(this.player, { x: c.x + 0.5, y: c.y + 0.5 }) <= CONFIG.camp.reach) ?? null
    );
  }

  private roomAt(x: number, y: number): number {
    return this.level.rooms.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  }

  // Works -----------------------------------------------------------------------------

  /** Whether a point lies in the light of a burning torch on this level. */
  inTorchLight(p: Point): boolean {
    const r = CONFIG.works.torchRadius;
    return this.works.some((w) => w.kind === 'torch' && w.depth === this.depth && w.condition > 0 && dist(p, { x: w.x + 0.5, y: w.y + 0.5 }) <= r);
  }

  /** A torch within reach that is not full, when there is oil to fill it. */
  get torchToRefill(): Work | null {
    if (!this.inventory.items.some((it) => it.kind === 'oil')) return null;
    return (
      this.works.find(
        (w) => w.kind === 'torch' && w.depth === this.depth && w.condition < 100 && dist(this.player, { x: w.x + 0.5, y: w.y + 0.5 }) <= CONFIG.works.reach,
      ) ?? null
    );
  }

  private newWork(kind: Work['kind'], extra: Partial<Work> = {}): Work {
    const work: Work = {
      id: Math.max(0, ...this.works.map((w) => w.id)) + 1,
      kind,
      depth: this.depth,
      x: Math.floor(this.player.x),
      y: Math.floor(this.player.y),
      built: this.generation,
      builder: this.builder,
      condition: 100,
      ...extra,
    };
    this.works.push(work);
    return work;
  }

  /** Sets a torch on the floor, or draws a chalk mark, where the hero stands. */
  private placeWork(uid: number, events: WorldEvent[], sign?: ChalkSign): void {
    const item = this.inventory.items.find((it) => it.uid === uid);
    if (!item) return;
    const x = Math.floor(this.player.x);
    const y = Math.floor(this.player.y);
    const here = this.works.filter((w) => w.depth === this.depth && w.x === x && w.y === y);
    if (item.kind === 'torch') {
      if (here.some((w) => w.kind === 'torch') || waterAt(this.level, x, y) !== 0) return void events.push({ type: 'cantBuild', reason: 'taken' });
      removeItem(this.inventory, uid);
      events.push({ type: 'workBuilt', work: this.newWork('torch') });
      return;
    }
    // Chalk: one mark per tile; a new one replaces the old.
    for (const old of here) if (old.kind === 'chalk') this.works.splice(this.works.indexOf(old), 1);
    const angle = Math.atan2(this.facing.y, this.facing.x);
    events.push({ type: 'workBuilt', work: this.newWork('chalk', { sign: sign ?? 'arrow', angle }) });
    item.charges = (item.charges ?? 1) - 1;
    if (item.charges <= 0) removeItem(this.inventory, uid);
  }

  // Doors and barricades -----------------------------------------------------------------

  /** Generated doors on this level, by tile. */
  doorStates = new Map<number, DoorState>();

  private barricadeAt(x: number, y: number): Work | undefined {
    return this.works.find((w) => w.kind === 'barricade' && w.depth === this.depth && covers(w, x, y));
  }

  /** Marks shut doors and barricades in the level, so nothing passes or sees through. */
  private refreshShut(): void {
    this.applyBridges();
    const shut = new Set<number>();
    for (const [tile, door] of this.doorStates) if (door.state === 'shut') shut.add(tile);
    // Nobody walks over the pit, or through a collapse.
    shut.add(this.level.pit.y * this.level.width + this.level.pit.x);
    for (const p of this.rubble) shut.add(p.y * this.level.width + p.x);
    for (const w of this.works) {
      if (w.kind !== 'barricade' || w.depth !== this.depth) continue;
      for (const p of [{ x: w.x, y: w.y }, ...(w.span ?? [])]) {
        const tile = p.y * this.level.width + p.x;
        if (w.open) shut.delete(tile);
        else shut.add(tile);
      }
    }
    this.level.closed = shut;
    // Paths and sight have changed.
    this.flowTile = -1;
    this.lastViewTile = -1;
    for (const e of this.enemies ?? []) e.roamField = null;
  }

  /** The nearest door or barricade within reach (not the one the hero stands in). */
  private doorInReach(): { x: number; y: number; shut: boolean; barricade: Work | undefined } | null {
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);
    let best: { x: number; y: number; shut: boolean; barricade: Work | undefined } | null = null;
    let bestD = 1.25;
    for (const d of this.level.doorways) {
      const barricade = this.barricadeAt(d.x, d.y);
      const door = this.doorStates.get(d.y * this.level.width + d.x);
      if (!barricade && (!door || door.state === 'broken')) continue;
      if (d.x === px && d.y === py) continue;
      const dd = dist(this.player, { x: d.x + 0.5, y: d.y + 0.5 });
      if (dd > bestD) continue;
      bestD = dd;
      best = { x: d.x, y: d.y, barricade, shut: barricade ? !barricade.open : door!.state === 'shut' };
    }
    return best;
  }

  /** Opens or shuts the door at hand. Doors are loud: horrors close by hear it. */
  private toggleDoor(events: WorldEvent[]): void {
    const d = this.doorInReach();
    if (!d) return;
    const tile = d.y * this.level.width + d.x;
    // Nothing can be shut on top of a horror.
    if (d.shut === false && this.enemies.some((e) => e.state !== 'dead' && Math.floor(e.pos.x) === d.x && Math.floor(e.pos.y) === d.y)) return;
    if (d.barricade) d.barricade.open = d.shut;
    else {
      // Both leaves of a double door move together.
      const partner = doorwayPartner(this.level, d);
      for (const t of [tile, ...(partner ? [partner.y * this.level.width + partner.x] : [])]) {
        const door = this.doorStates.get(t);
        if (door && door.state !== 'broken') door.state = d.shut ? 'open' : 'shut';
      }
    }
    this.refreshShut();
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.alerted || dist(e.pos, { x: d.x + 0.5, y: d.y + 0.5 }) > 4) continue;
      e.alerted = true;
      e.forgetTimer = 0;
    }
    events.push({ type: 'door', open: d.shut, barricade: !!d.barricade });
  }

  /** Nails planks across the nearest doorway: a barricade the family keeps. */
  private buildBarricade(uid: number, events: WorldEvent[]): void {
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);
    let target: Point | null = null;
    let bestD = 1.6;
    for (const d of this.level.doorways) {
      if (this.barricadeAt(d.x, d.y) || (d.x === px && d.y === py)) continue;
      const dd = dist(this.player, { x: d.x + 0.5, y: d.y + 0.5 });
      if (dd < bestD) {
        bestD = dd;
        target = d;
      }
    }
    if (!target) return void events.push({ type: 'cantBuild', reason: 'corridor' });
    removeItem(this.inventory, uid);
    // A door there is reinforced: the barricade takes its place. A wide entrance takes
    // planks across both tiles.
    const partner = doorwayPartner(this.level, target);
    for (const p of [target, ...(partner ? [partner] : [])]) {
      const door = this.doorStates.get(p.y * this.level.width + p.x);
      if (door) door.state = 'broken';
    }
    const work = this.newWork('barricade', { x: target.x, y: target.y, open: false, ...(partner ? { span: [{ ...partner }] } : {}) });
    this.refreshShut();
    events.push({ type: 'workBuilt', work });
  }

  // Bridges -----------------------------------------------------------------------------

  /** Lays the family's bridges over their chasms: floor to walk on, drawn as planks. */
  private applyBridges(): void {
    for (const w of this.works) {
      if (w.kind !== 'bridge' || w.depth !== this.depth || w.condition <= 0) continue;
      for (const p of w.span ?? []) {
        const tile = p.y * this.level.width + p.x;
        if (!isChasm(this.level, p.x, p.y)) continue;
        this.level.tiles[tile] = 1;
        if (!this.level.bridges.includes(tile)) this.level.bridges.push(tile);
      }
    }
  }

  /**
   * A chasm the hero stands at the edge of, narrow enough to bridge with planks: the tiles
   * to span, nearest the way the hero faces.
   */
  chasmInReach(): Point[] | null {
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);
    let best: Point[] | null = null;
    let bestScore = -Infinity;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      // Close enough to the edge on that side.
      const edge = dx ? (dx > 0 ? px + 1 - this.player.x : this.player.x - px) : dy > 0 ? py + 1 - this.player.y : this.player.y - py;
      if (edge > CONFIG.works.reach - 0.5) continue;
      const span: Point[] = [];
      let x = px + dx;
      let y = py + dy;
      while (isChasm(this.level, x, y) && span.length <= CONFIG.works.bridgeSpan) {
        span.push({ x, y });
        x += dx;
        y += dy;
      }
      if (span.length === 0 || span.length > CONFIG.works.bridgeSpan || !isFloor(this.level, x, y)) continue;
      const score = dx * this.facing.x + dy * this.facing.y;
      if (score > bestScore) {
        bestScore = score;
        best = span;
      }
    }
    return best;
  }

  /** Lays planks across the chasm at hand: a bridge the family keeps. */
  private buildBridge(uid: number, events: WorldEvent[]): void {
    const span = this.chasmInReach();
    if (!span) return void events.push({ type: 'cantBuild', reason: 'taken' });
    removeItem(this.inventory, uid);
    const work = this.newWork('bridge', { x: span[0].x, y: span[0].y, span: span.map((p) => ({ ...p })) });
    this.refreshShut();
    events.push({ type: 'workBuilt', work });
  }

  // Collapses ------------------------------------------------------------------------------

  private cleared(x: number, y: number): boolean {
    return this.works.some((w) => w.kind === 'cleared' && w.depth === this.depth && w.x === x && w.y === y);
  }

  /** Collapses on this level not yet dug out by the family. */
  get rubble(): Point[] {
    return this.level.rubble.filter((p) => !this.cleared(p.x, p.y));
  }

  /** A collapse right in front of the hero. */
  private rubbleInReach(): Point | null {
    let best: Point | null = null;
    let bestD = CONFIG.works.reach + 0.3;
    for (const p of this.rubble) {
      const d = dist(this.player, { x: p.x + 0.5, y: p.y + 0.5 });
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private startDigging(p: Point, events: WorldEvent[]): void {
    if (this.inDanger) return void events.push({ type: 'cantUse', reason: 'danger' });
    if (this.digging) return;
    this.digging = { x: p.x, y: p.y, timer: CONFIG.works.digTime, pulse: 0, kind: 'dig' };
    events.push({ type: 'digging', seconds: CONFIG.works.digTime });
  }

  // Locked and stuck doors ----------------------------------------------------------------

  /** How a door at a tile is held shut, if it still is (an opened lock stays open for the family). */
  lockAt(x: number, y: number): 'locked' | 'stuck' | null {
    const lock = this.level.locks.find((l) => l.x === x && l.y === y);
    if (!lock) return null;
    if (this.works.some((w) => w.kind === 'unlocked' && w.depth === this.depth && w.x === x && w.y === y)) return null;
    return lock.kind;
  }

  /** The iron grate stuck over the pit, within reach. */
  private grateInReach(): boolean {
    const { pit } = this.level;
    return !!this.lockAt(pit.x, pit.y) && dist(this.player, { x: pit.x + 0.5, y: pit.y + 0.5 }) <= 1.6;
  }

  /** Opens a lock for good: both leaves of the door, for the whole family. */
  private openLock(x: number, y: number, events: WorldEvent[]): void {
    const partner = doorwayPartner(this.level, { x, y });
    for (const p of [{ x, y }, ...(partner ? [partner] : [])]) {
      if (this.lockAt(p.x, p.y)) this.newWork('unlocked', { x: p.x, y: p.y });
      const door = this.doorStates.get(p.y * this.level.width + p.x);
      if (door && door.state !== 'broken') door.state = 'open';
    }
    this.refreshShut();
    events.push({ type: 'unlocked', depth: this.depth });
  }

  /** A key in the backpack that fits the lock of this door, if any. */
  private keyFor(d: Point): Packed | undefined {
    const kind = this.level.locks.find((l) => l.x === d.x && l.y === d.y)?.key;
    return kind ? this.inventory.items.find((it) => it.kind === kind) : undefined;
  }

  /** Picking a lock (the plunderer's trade): slow, but quiet next to forcing it. */
  private startPicking(p: Point, events: WorldEvent[]): void {
    if (this.inDanger) return void events.push({ type: 'cantUse', reason: 'danger' });
    if (this.digging) return;
    this.digging = { x: p.x, y: p.y, timer: CONFIG.works.pickLock, pulse: 0, kind: 'pick' };
    events.push({ type: 'picking', seconds: CONFIG.works.pickLock });
  }

  /**
   * A locked door battered with blows: every swing that reaches it takes some of it, loud
   * enough to carry far; when it gives, the lock is broken for good.
   */
  private batterDoors(step: ComboStep, events: WorldEvent[]): void {
    const { weapon } = this.cls;
    for (const l of this.level.locks) {
      if (l.kind !== 'locked' || !this.lockAt(l.x, l.y)) continue;
      const to = { x: l.x + 0.5 - this.player.x, y: l.y + 0.5 - this.player.y };
      if (length(to) > step.range + 0.6 || angleBetween(this.facing, to) > step.arc / 2) continue;
      const tile = l.y * this.level.width + l.x;
      const partner = doorwayPartner(this.level, l);
      const pairTile = partner ? Math.min(tile, partner.y * this.level.width + partner.x) : tile;
      const hp = (this.lockHp.get(pairTile) ?? CONFIG.works.lockedHp) - weapon.damage * step.damage * damageMultiplier(this.attrs) * this.hungerPenalty;
      this.lockHp.set(pairTile, hp);
      events.push({ type: 'doorHit', pos: { x: l.x + 0.5, y: l.y + 0.5 }, broke: hp <= 0 });
      for (const e of this.enemies) {
        if (e.state === 'dead' || dist(e.pos, this.player) > CONFIG.works.digNoise) continue;
        e.alerted = true;
        e.forgetTimer = 0;
      }
      if (hp <= 0) this.openLock(l.x, l.y, events);
      return;
    }
  }

  /** Forcing a door: like digging, slow and loud, longer for a lock than for a stuck door. */
  private startForcing(p: Point, kind: 'locked' | 'stuck', events: WorldEvent[]): void {
    if (this.inDanger) return void events.push({ type: 'cantUse', reason: 'danger' });
    if (this.digging) return;
    const seconds = kind === 'locked' ? CONFIG.works.forceLocked : CONFIG.works.forceStuck;
    this.digging = { x: p.x, y: p.y, timer: seconds, pulse: 0, kind: 'force' };
    events.push({ type: 'forcing', seconds });
  }

  /**
   * Digging is slow, tiring and loud: every blow of the pick carries down the corridors,
   * and whatever hears it comes. A horror at arm's length, or moving, stops it.
   */
  private updateDigging(dt: number, input: ControlInput, events: WorldEvent[]): void {
    const dig = this.digging;
    if (!dig) return;
    const moving = length(input.move) > 0.15 || input.attack || input.dodge || input.special;
    const close = this.enemies.some((e) => e.state !== 'dead' && dist(e.pos, this.player) < 2.5);
    if (moving || close) {
      this.digging = null;
      events.push({ type: 'interrupted' });
      return;
    }
    this.spend(this.cls.costs.attack, dt);
    dig.pulse -= dt;
    if (dig.pulse <= 0) {
      dig.pulse = 0.8;
      events.push({ type: 'dig' });
      for (const e of this.enemies) {
        if (e.state === 'dead' || dist(e.pos, this.player) > (dig.kind === 'pick' ? CONFIG.works.pickNoise : CONFIG.works.digNoise)) continue;
        e.alerted = true;
        e.forgetTimer = 0;
      }
    }
    dig.timer -= dt;
    if (dig.timer > 0) return;
    this.digging = null;
    if (dig.kind === 'force' || dig.kind === 'pick') return void this.openLock(dig.x, dig.y, events);
    // The whole fall of stones goes, from wall to wall.
    const heap = [{ x: dig.x, y: dig.y }];
    for (let i = 0; i < heap.length; i++) {
      for (const p of this.rubble) {
        if (heap.some((q) => q.x === p.x && q.y === p.y)) continue;
        if (Math.abs(p.x - heap[i].x) + Math.abs(p.y - heap[i].y) === 1) heap.push({ ...p });
      }
    }
    let work: Work | null = null;
    for (const p of heap) work = this.newWork('cleared', { x: p.x, y: p.y });
    this.refreshShut();
    events.push({ type: 'workBuilt', work: work! });
  }

  /** Hunting horrors at a shut door or barricade batter it until it gives. */
  private bashTimer = 0;
  private bashShut(dt: number, events: WorldEvent[]): void {
    const shut = this.level.closed;
    if (!shut || shut.size === 0) return;
    this.bashTimer -= dt;
    for (const tile of [...shut]) {
      const x = tile % this.level.width;
      const y = Math.floor(tile / this.level.width);
      // Only doors and barricades are battered (not the pit, not a collapse).
      if (!this.barricadeAt(x, y) && !this.doorStates.has(tile)) continue;
      const centre = { x: x + 0.5, y: y + 0.5 };
      // Hunting horrors that reach it stay pressed against it, battering.
      const near = this.enemies.filter((e) => e.state !== 'dead' && e.alerted && dist(e.pos, centre) < 1.8);
      for (const e of near) {
        const d = dist(e.pos, centre);
        if (d > 0.95) {
          const k = (d - 0.95) / d;
          e.pos = { x: e.pos.x + (centre.x - e.pos.x) * k, y: e.pos.y + (centre.y - e.pos.y) * k };
        }
      }
      const bashers = near.length;
      if (bashers === 0) continue;
      const barricade = this.barricadeAt(x, y);
      if (this.bashTimer <= 0 && dist(this.player, centre) < 10) {
        events.push({ type: 'bashing', barricade: !!barricade });
        this.bashTimer = 4;
      }
      if (barricade) {
        barricade.condition -= CONFIG.works.bashBarricade * bashers * dt;
        if (barricade.condition <= 0) {
          this.works.splice(this.works.indexOf(barricade), 1);
          events.push({ type: 'shutBroken', barricade: true, depth: this.depth });
          this.refreshShut();
        }
      } else {
        const door = this.doorStates.get(tile);
        if (!door) continue;
        door.hp -= CONFIG.works.bashDoor * bashers * dt;
        if (door.hp <= 0) {
          door.state = 'broken';
          // A double door gives way as one.
          const partner = doorwayPartner(this.level, { x, y });
          const other = partner && this.doorStates.get(partner.y * this.level.width + partner.x);
          if (other) other.state = 'broken';
          events.push({ type: 'shutBroken', barricade: false, depth: this.depth });
          this.refreshShut();
        }
      }
    }
  }

  /** Whether every way into a room is shut: a camp there is far safer at night. */
  private roomSealed(room: number): boolean {
    const r = this.level.rooms[room];
    if (!r) return false;
    const ways = this.level.doorways.filter((d) => d.x >= r.x - 1 && d.x <= r.x + r.w && d.y >= r.y - 1 && d.y <= r.y + r.h);
    return ways.length > 0 && ways.every((d) => this.level.closed?.has(d.y * this.level.width + d.x));
  }

  // Pits and ropes ----------------------------------------------------------------------

  private ropeAt(depth: number): Work | undefined {
    return this.works.find((w) => w.kind === 'rope' && w.depth === depth && w.condition > 0);
  }

  /** A rope within reach: down the pit on this level, or up from the landing to the one above. */
  private ropeHere(way: 'down' | 'up'): boolean {
    const spot = way === 'down' ? this.level.pit : this.level.landing;
    if (!this.ropeAt(way === 'down' ? this.depth : this.depth - 1)) return false;
    if (way === 'up' && this.depth <= 1) return false;
    return dist(this.player, { x: spot.x + 0.5, y: spot.y + 0.5 }) <= 1.5;
  }

  /** A floor tile next to the pit, to stand on after climbing out of it. */
  private besidePit(): Point {
    const { pit } = this.level;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (isFloor(this.level, pit.x + dx, pit.y + dy)) return { x: pit.x + dx, y: pit.y + dy };
    }
    return this.level.start;
  }

  /** Ties a rope at the pit: a shortcut down (and back up) for the whole family. */
  private tieRope(uid: number, events: WorldEvent[]): void {
    const { pit } = this.level;
    if (dist(this.player, { x: pit.x + 0.5, y: pit.y + 0.5 }) > 1.6 || this.ropeAt(this.depth) || this.lockAt(pit.x, pit.y)) {
      return void events.push({ type: 'cantBuild', reason: 'taken' });
    }
    removeItem(this.inventory, uid);
    events.push({ type: 'workBuilt', work: this.newWork('rope', { x: pit.x, y: pit.y }) });
  }

  /** Down the rope to the landing below, or up it to the pit above. */
  climbRope(): 'down' | 'up' | null {
    if (this.ropeHere('down')) {
      this.leaveLevel();
      this.enterLevel(this.depth + 1, 'ropeDown');
      return 'down';
    }
    if (this.ropeHere('up')) {
      this.leaveLevel();
      this.enterLevel(this.depth - 1, 'ropeUp');
      return 'up';
    }
    return null;
  }

  /** Fills the torch at hand with a flask of oil. */
  private refillTorch(events: WorldEvent[]): void {
    const torch = this.torchToRefill;
    const oil = this.inventory.items.find((it) => it.kind === 'oil');
    if (!torch || !oil) return;
    removeItem(this.inventory, oil.uid);
    torch.condition = 100;
    events.push({ type: 'torchFilled' });
  }

  /** Pitches a camp where the hero stands: inside a room, out of danger, one per room. */
  private buildCamp(uid: number, events: WorldEvent[]): void {
    const x = Math.floor(this.player.x);
    const y = Math.floor(this.player.y);
    const room = this.roomAt(x, y);
    if (this.inDanger) return void events.push({ type: 'cantBuild', reason: 'danger' });
    if (room < 0) return void events.push({ type: 'cantBuild', reason: 'corridor' });
    const taken = this.camps.some((c) => c.depth === this.depth && this.roomAt(c.x, c.y) === room);
    const { stairs, start } = this.level;
    const onSomething =
      waterAt(this.level, x, y) !== 0 ||
      (x === stairs.x && y === stairs.y) ||
      (Math.abs(x - start.x) <= 1 && Math.abs(y - start.y) <= 1) ||
      onSteps(this.level.down, this.player) ||
      onSteps(this.level.up, this.player) ||
      this.level.features.some((f) => f.x === x && f.y === y);
    if (taken || onSomething) return void events.push({ type: 'cantBuild', reason: 'taken' });
    removeItem(this.inventory, uid);
    const camp: CampSite = {
      id: Math.max(0, ...this.camps.map((c) => c.id)) + 1,
      depth: this.depth,
      x,
      y,
      built: this.generation,
      builder: this.builder,
      condition: 100,
    };
    this.camps.push(camp);
    events.push({ type: 'campBuilt', camp });
  }

  /** How much more cooking gives, with Wits. */
  private get cookBonus(): number {
    return 1 + Math.max(0, this.attrs.wit - 10) * 0.03;
  }

  /** Whether the hero can tell a poisonous mushroom (Wits). */
  get knowsMushrooms(): boolean {
    return this.attrs.wit >= 12;
  }

  /**
   * By the fire: eat, drink, dress wounds, cook, feed the fire or fill the lamp with an
   * item. Takes effect at once (the camp screen is a pause in the game). Returns what
   * happened.
   */
  campUse(uid: number): WorldEvent[] {
    const events: WorldEvent[] = [];
    const item = this.inventory.items.find((it) => it.uid === uid);
    if (!item || !this.campInReach) return events;
    const s = { ...this.survival };
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    const food = Math.max(0.2, 1 + (this.fx.foodValue ?? 0));
    const cfg = CONFIG.camp;
    const needsFire = item.kind === 'mushroom' || item.kind === 'horrorMeat';
    if (needsFire && !this.campfire) return [{ type: 'needFire' }];
    const used: Extract<WorldEvent, { type: 'campUsed' }> = { type: 'campUsed', kind: item.kind };
    switch (item.kind) {
      case 'ration':
        s.hunger = clamp(s.hunger + CONFIG.use.ration.hunger * food);
        s.health = Math.min(this.maxHealth, s.health + (this.fx.foodHeal ?? 0));
        removeItem(this.inventory, uid);
        break;
      case 'marchRation':
        s.hunger = clamp(s.hunger + CONFIG.use.marchRation.hunger * food);
        s.thirst = clamp(s.thirst + CONFIG.use.marchRation.thirst);
        removeItem(this.inventory, uid);
        break;
      case 'waterskin':
        if (!item.charges) return [{ type: 'cantUse', reason: 'empty' }];
        s.thirst = clamp(s.thirst + CONFIG.use.waterskin.thirst);
        item.charges--;
        // Unboiled drip water may turn your stomach.
        if (item.turbid && this.rng.chance(0.5)) {
          s.hunger = clamp(s.hunger - 10);
          s.health = Math.max(1, s.health - 8);
          used.sick = true;
        }
        if (item.charges === 0) item.turbid = false;
        break;
      case 'bandage':
        s.health = Math.min(this.maxHealth, s.health + cfg.bandage);
        removeItem(this.inventory, uid);
        break;
      case 'mushroom':
        if (item.poison) {
          s.thirst = clamp(s.thirst - 20);
          s.health = Math.max(1, s.health - 10);
          used.poisoned = true;
        } else s.hunger = clamp(s.hunger + cfg.mushroom * this.cookBonus * food);
        removeItem(this.inventory, uid);
        break;
      case 'horrorMeat':
        s.hunger = clamp(s.hunger + cfg.horrorMeat * this.cookBonus * food);
        if (this.rng.chance(cfg.nightmares)) {
          this.nightmares = true;
          used.nightmares = true;
        }
        removeItem(this.inventory, uid);
        break;
      case 'firewood':
        if (this.campfire) return events;
        this.campfire = true;
        removeItem(this.inventory, uid);
        this.survival = s;
        return [{ type: 'fireLit' }];
      case 'oil':
        s.light = clamp(s.light + CONFIG.use.oil.light * Math.max(0.2, 1 + (this.fx.oilValue ?? 0)));
        removeItem(this.inventory, uid);
        break;
      case 'campKit':
        return events;
    }
    this.survival = s;
    events.push(used);
    return events;
  }

  /** Boils a waterskin of drip water over the fire, so it is safe to drink. */
  campBoil(uid: number): WorldEvent[] {
    const item = this.inventory.items.find((it) => it.uid === uid);
    if (!item || item.kind !== 'waterskin' || !item.turbid || !this.campInReach) return [];
    if (!this.campfire) return [{ type: 'needFire' }];
    item.turbid = false;
    return [{ type: 'boiled' }];
  }

  /**
   * Sleeps until dawn. The night is drawn: quiet, noises that spoil the rest, or an attack
   * that wakes you in the dark with horrors at the fire. A fire and Will keep them away.
   */
  sleep(): WorldEvent[] {
    const camp = this.campInReach;
    if (!camp || this.inDanger) return [];
    const events: WorldEvent[] = [];
    const cfg = CONFIG.camp;
    const rng = Rng.derive(this.seed, 'night', this.life, this.depth, this.day, Math.floor(this.clock));
    let attackChance = Math.min(0.6, Math.max(0.03, cfg.attack + (this.campfire ? 0 : cfg.noFire) - (this.attrs.wil - 10) * 0.015));
    // A room with every entrance shut is hard to get into.
    if (this.roomSealed(this.roomAt(camp.x, camp.y))) attackChance *= 0.35;
    const roll = rng.next();
    const outcome = roll < attackChance ? 'attack' : roll < attackChance + cfg.noises ? 'noises' : 'quiet';
    // Rest: whole with a full belly and throat, less on an empty one, bad dreams or a broken night.
    const s = this.survival;
    let rest = Math.min(1, Math.min(s.hunger, s.thirst) / 50);
    if (this.nightmares) rest *= 0.5;
    if (outcome === 'noises') rest *= 0.7;
    if (outcome === 'attack') rest *= 0.4;
    const healed = (this.maxHealth - s.health) * rest;
    this.survival = {
      ...s,
      health: s.health + healed,
      hunger: Math.max(0, s.hunger - cfg.nightHunger * this.cls.hungerMultiplier),
      thirst: Math.max(0, s.thirst - cfg.nightThirst * this.cls.thirstMultiplier),
    };
    this.nightmares = false;
    const cycle = CONFIG.time.day + CONFIG.time.night;
    const dayStart = Math.floor(this.clock / cycle) * cycle;
    if (outcome === 'attack') {
      // Woken in the middle of the night: hold the fire until dawn.
      this.clock = Math.max(this.clock, dayStart + CONFIG.time.day + CONFIG.time.night * 0.35);
      camp.condition -= cfg.attackDamage;
      const room = this.roomAt(camp.x, camp.y);
      const r = this.level.rooms[room];
      const count = rng.int(2, 3) + Math.floor(this.depth / 4);
      for (let i = 0; i < count && r; i++) {
        // They come in along the walls of the room.
        const side = rng.int(0, 3);
        const x = side === 0 ? r.x : side === 1 ? r.x + r.w - 1 : rng.int(r.x, r.x + r.w - 1);
        const y = side === 2 ? r.y : side === 3 ? r.y + r.h - 1 : rng.int(r.y, r.y + r.h - 1);
        if (!isFloor(this.level, x, y)) continue;
        const enemy = this.makeEnemy(rng.pick<EnemyKind>(['crawler', 'crawler', 'husk']), { x: x + 0.5, y: y + 0.5 }, room, false, rng);
        enemy.alerted = true;
        enemy.state = 'chase';
        this.enemies.push(enemy);
      }
      if (camp.condition <= 0) this.loseCamp(camp, events);
    } else {
      this.clock = dayStart + cycle;
      this.dawn(events, camp);
    }
    events.unshift({ type: 'slept', outcome, healed: Math.round(healed) });
    return events;
  }

  private makeEnemy(kind: EnemyKind, pos: Point, room: number, roamer: boolean, rng: Rng): Enemy {
    return {
      id: this.nextId++,
      kind,
      def: ENEMIES[kind],
      pos: { ...pos },
      health: ENEMIES[kind].health,
      state: 'idle',
      timer: rng.range(0, 2),
      alerted: false,
      forgetTimer: 0,
      facing: { x: 1, y: 0 },
      strikeDir: { x: 1, y: 0 },
      room,
      roamer,
      wanderTarget: null,
      roamField: null,
      roamRoom: room,
      flank: rng.range(-1, 1),
      visible: false,
      watching: false,
      wax: 0,
      waxTick: 0,
      bleed: 0,
      bleedTick: 0,
    };
  }

  // Backpack and places ---------------------------------------------------------------

  /** The fountain or unsearched container within reach, if any. */
  private featureInReach(): Feature | null {
    let best: Feature | null = null;
    let bestD: number = CONFIG.loot.reach;
    for (const f of this.level.features) {
      if ((f.kind === 'remains' || f.kind === 'crate') && this.searched.has(f.id)) continue;
      const d = dist(this.player, { x: f.x + 0.5, y: f.y + 0.5 });
      if (d <= bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  /** How far the floods have spread, by depth (shared with the dynasty). */
  floods: Record<number, number>;

  /** The family's dam over the sinkhole on level `depth`, if it holds. */
  private damAt(depth: number): Work | undefined {
    return this.works.find((w) => w.kind === 'dam' && w.depth === depth && w.condition > 0);
  }

  /** Whether water falls in from the level above (no dam up there). */
  get falling(): boolean {
    return !!this.level.fall && !this.damAt(this.depth - 1);
  }

  /** Whether the river here drains down its sinkhole (no dam on it). */
  get draining(): boolean {
    return !!this.level.sink && !this.damAt(this.depth);
  }

  /** The flood on this level, as far as it has spread. */
  get floodLevel(): number {
    return this.level.fall ? (this.floods[this.depth] ?? 0) : 0;
  }

  /** The sinkhole within reach, to dam with planks. */
  private sinkInReach(): boolean {
    const { sink } = this.level;
    return !!sink && !this.damAt(this.depth) && dist(this.player, { x: sink.x + 0.5, y: sink.y + 0.5 }) <= CONFIG.works.reach + 0.9;
  }

  /** Planks across the sinkhole: the river stops falling, and the flood below drains away. */
  private buildDam(uid: number, events: WorldEvent[]): void {
    const sink = this.level.sink!;
    removeItem(this.inventory, uid);
    events.push({ type: 'workBuilt', work: this.newWork('dam', { x: sink.x, y: sink.y }) });
  }

  /**
   * Each dawn the floods rise a little (or drain, where the sinkhole above is dammed), and
   * whatever the water reaches is lost: camps swamped, torches drowned, chalk washed off.
   */
  private advanceFloods(events: WorldEvent[]): void {
    for (const key of Object.keys(this.floods)) {
      const depth = Number(key);
      const before = this.floods[depth];
      const step = this.damAt(depth - 1) ? -CONFIG.water.floodPerDawn : CONFIG.water.floodPerDawn;
      const now = Math.max(0, Math.min(CONFIG.water.floodMax, before + step));
      this.floods[depth] = now;
      if (now === before) continue;
      const level = depth === this.depth ? this.level : generateLevel(this.seed, depth, this.life);
      if (depth === this.depth) {
        // Start again from the dry level and let the water in as far as it reaches now.
        const fresh = generateLevel(this.seed, depth, this.life);
        level.tiles.set(fresh.tiles);
        level.water?.set(fresh.water ?? []);
      }
      flood(level, now);
      if (depth === this.depth) {
        this.refreshShut();
        // Do not leave the hero standing in deep water.
        if (!isFloor(level, Math.floor(this.player.x), Math.floor(this.player.y))) this.player = this.nearestFloor(this.player);
      }
      if (now < before) continue;
      const wet = (x: number, y: number) => waterAt(level, x, y) !== 0;
      for (const camp of [...this.camps]) if (camp.depth === depth && wet(camp.x, camp.y)) this.loseCamp(camp, events);
      for (const w of [...this.works]) {
        if (w.depth !== depth || !wet(w.x, w.y)) continue;
        if (w.kind === 'torch') w.condition = 0;
        if (w.kind === 'chalk') this.works.splice(this.works.indexOf(w), 1);
      }
      events.push({ type: 'floodRose', depth });
    }
  }

  /** The nearest floor tile's centre to `p`. */
  private nearestFloor(p: Point): Point {
    let best = p;
    let bestD = Infinity;
    for (let y = Math.floor(p.y) - 4; y <= Math.floor(p.y) + 4; y++) {
      for (let x = Math.floor(p.x) - 4; x <= Math.floor(p.x) + 4; x++) {
        if (!isFloor(this.level, x, y)) continue;
        const d = dist(p, { x: x + 0.5, y: y + 0.5 });
        if (d < bestD) {
          bestD = d;
          best = { x: x + 0.5, y: y + 0.5 };
        }
      }
    }
    return best;
  }

  /** Water underfoot or right beside the hero: under a waterfall it runs clean, elsewhere turbid. */
  private waterInReach(): 'clean' | 'turbid' | null {
    const fall = this.falling ? this.level.fall : undefined;
    if (fall && dist(this.player, { x: fall.x + 0.5, y: fall.y + 0.5 }) <= 1.7) return 'clean';
    const x = Math.floor(this.player.x);
    const y = Math.floor(this.player.y);
    return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => waterAt(this.level, x + dx, y + dy) !== 0) ? 'turbid' : null;
  }

  /** The roar of falling water, louder the closer (0 far, 1 at its foot). */
  private roarTimer = 0;
  private roar(dt: number, events: WorldEvent[]): void {
    this.roarTimer -= dt;
    if (this.roarTimer > 0) return;
    this.roarTimer = 1.4;
    const spots = [this.draining ? this.level.sink : undefined, this.falling ? this.level.fall : undefined].filter((p): p is Point => !!p);
    if (spots.length === 0) return;
    const d = Math.min(...spots.map((p) => dist(this.player, { x: p.x + 0.5, y: p.y + 0.5 })));
    if (d < CONFIG.water.roarReach) events.push({ type: 'roar', near: 1 - d / CONFIG.water.roarReach });
  }

  /** The location the hero stands in, to say its name on the way in. */
  private placeHere: string | null = null;
  private noticePlace(events: WorldEvent[]): void {
    const { x, y } = this.player;
    const place = this.level.places.find((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
    const id = place?.id ?? null;
    if (id === this.placeHere) return;
    this.placeHere = id;
    if (id) events.push({ type: 'placeEntered', id });
  }

  /** Each step into shallow water splashes, and horrors close by hear it. */
  private wetTile = -1;
  private wade(events: WorldEvent[]): void {
    const x = Math.floor(this.player.x);
    const y = Math.floor(this.player.y);
    const tile = y * this.level.width + x;
    if (tile === this.wetTile) return;
    this.wetTile = tile;
    if (!isShallow(this.level, x, y)) return;
    events.push({ type: 'splash' });
    for (const e of this.enemies) {
      if (e.state === 'dead' || dist(e.pos, this.player) > CONFIG.water.splashNoise) continue;
      e.alerted = true;
      e.forgetTimer = 0;
    }
  }

  /** What the action button does here. */
  get interaction(): Interaction {
    if (this.ropeHere('down')) return 'ropeDown';
    if (this.ropeHere('up')) return 'ropeUp';
    if (this.campInReach) return 'camp';
    if (this.outpostInReach) return 'outpost';
    if (this.torchToRefill) return 'torch';
    const door = this.doorInReach();
    if (door) {
      const lock = door.barricade ? null : this.lockAt(door.x, door.y);
      if (lock === 'stuck') return 'force';
      if (lock === 'locked') return this.keyFor(door) ? 'unlock' : this.cls.picksLocks ? 'pick' : 'bash';
      return door.shut ? 'openDoor' : 'closeDoor';
    }
    if (this.rubbleInReach()) return 'clear';
    if (this.grateInReach()) return 'force';
    const f = this.featureInReach();
    if (!f) {
      const water = this.waterInReach();
      return water === 'clean' ? 'falls' : water ? 'pool' : null;
    }
    return f.kind === 'fountain' || f.kind === 'drip' ? f.kind : 'search';
  }

  /** Use the fountain or search the container at hand (the stairs are the session's business). */
  interact(): void {
    this.commands.push({ type: 'interact' });
  }

  /** Uses an item from the backpack; chalk needs the sign to draw. */
  useItem(uid: number, sign?: ChalkSign): void {
    this.commands.push({ type: 'use', uid, sign });
  }

  /** Drops an item where the hero stands, at once (it is only moving data, like rearranging). */
  dropItem(uid: number): void {
    this.doDrop(uid);
  }

  private runCommands(events: WorldEvent[]): void {
    const commands = this.commands;
    this.commands = [];
    for (const c of commands) {
      if (c.type === 'interact') this.doInteract(events);
      else if (c.type === 'drop') this.doDrop(c.uid);
      else this.startUse(c.uid, events, c.sign);
    }
  }

  private doInteract(events: WorldEvent[]): void {
    if (this.torchToRefill) return this.refillTorch(events);
    const door = this.doorInReach();
    const lock = door && !door.barricade ? this.lockAt(door.x, door.y) : null;
    if (door && lock) {
      if (lock === 'stuck') return this.startForcing(door, 'stuck', events);
      const key = this.keyFor(door);
      if (key) {
        removeItem(this.inventory, key.uid);
        return this.openLock(door.x, door.y, events);
      }
      if (this.cls.picksLocks) return this.startPicking(door, events);
      return void events.push({ type: 'cantUse', reason: 'locked' });
    }
    if (door) return this.toggleDoor(events);
    if (this.grateInReach()) return this.startForcing(this.level.pit, 'stuck', events);
    const rubble = this.rubbleInReach();
    if (rubble) return this.startDigging(rubble, events);
    const f = this.featureInReach();
    if (!f && !this.waterInReach()) return;
    if (!f || f.kind === 'fountain' || f.kind === 'drip') {
      // Drip and standing water are turbid, and mixed with clean water it all turns turbid;
      // a fountain and a waterfall run clean.
      const turbid = f ? f.kind === 'drip' : this.waterInReach() !== 'clean';
      let skins = 0;
      for (const it of this.inventory.items) {
        if (it.kind !== 'waterskin') continue;
        it.charges = ITEMS.waterskin.charges;
        it.turbid = turbid;
        skins++;
      }
      events.push({ type: 'refilled', skins, turbid });
      return;
    }
    this.searched.add(f.id);
    const table = CONFIG.loot[f.kind as 'remains' | 'crate'];
    const rng = Rng.derive(this.seed, 'search', this.life, this.depth, f.id);
    const kinds: LootKind[] = [];
    let gold = 0;
    let dropped = 0;
    const weights = Object.entries(table.table) as Array<[LootKind, number]>;
    const total = weights.reduce((n, [, w]) => n + w, 0);
    for (let i = rng.int(table.min, table.max); i > 0; i--) {
      let roll = rng.next() * total;
      const kind = weights.find(([, w]) => (roll -= w) < 0)?.[0] ?? weights[0][0];
      kinds.push(kind);
      if (kind === 'gold') gold += goldPile(rng, this.depth);
      else if (!addItem(this.inventory, kind)) {
        this.dropAt(kind, f.x, f.y);
        dropped++;
      }
    }
    this.gold += gold;
    events.push({ type: 'found', kinds, gold, dropped });
  }

  /** Leaves an item on the floor, where it stays for this life. */
  private dropAt(kind: LootKind, x: number, y: number, charges?: number, extra: Pick<LevelItem, 'turbid' | 'poison'> = {}): void {
    const id = this.nextId++ + 5000;
    const item: LevelItem = { id, kind, x, y, ...extra };
    if (charges !== undefined) item.charges = charges;
    this.level.items.push(item);
    // Picked up again only after stepping away and back.
    this.refused = id;
  }

  private doDrop(uid: number): void {
    const item = removeItem(this.inventory, uid);
    if (!item) return;
    this.dropAt(item.kind, Math.floor(this.player.x), Math.floor(this.player.y), item.charges, { turbid: item.turbid, poison: item.poison });
  }

  /** Eating, drinking and filling the lamp take a moment standing still; march rations don't. */
  private startUse(uid: number, events: WorldEvent[], sign?: ChalkSign): void {
    const item = this.inventory.items.find((it) => it.uid === uid);
    if (!item) return;
    if (item.kind === 'waterskin' && !item.charges) {
      events.push({ type: 'cantUse', reason: 'empty' });
      return;
    }
    if (ITEMS[item.kind].onTheMove) {
      this.applyItem(uid, events);
      return;
    }
    // Food, water, bandages: only by the fire. A camp kit is pitched where you stand.
    if (item.kind === 'rope') {
      this.tieRope(uid, events);
      return;
    }
    if (item.kind === 'planks') {
      if (this.sinkInReach()) this.buildDam(uid, events);
      else if (this.chasmInReach()) this.buildBridge(uid, events);
      else this.buildBarricade(uid, events);
      return;
    }
    if (item.kind === 'torch' || item.kind === 'chalk') {
      this.placeWork(item.uid, events, sign);
      return;
    }
    if (item.kind === 'campKit') {
      this.buildCamp(uid, events);
      return;
    }
    if (ITEMS[item.kind].campOnly) {
      events.push({ type: 'cantUse', reason: 'camp' });
      return;
    }
    if (item.kind !== 'oil' && this.inDanger) {
      events.push({ type: 'cantUse', reason: 'danger' });
      return;
    }
    this.channel = { uid, timer: CONFIG.use.channel };
    events.push({ type: 'channel', kind: item.kind, seconds: CONFIG.use.channel });
  }

  private updateChannel(dt: number, input: ControlInput, events: WorldEvent[]): void {
    if (!this.channel) return;
    const item = this.inventory.items.find((it) => it.uid === this.channel!.uid);
    const moving = length(input.move) > 0.15 || input.attack || input.dodge || input.special;
    if (!item || moving || (item.kind !== 'oil' && this.inDanger)) {
      this.channel = null;
      if (item) events.push({ type: 'interrupted' });
      return;
    }
    this.channel.timer -= dt;
    if (this.channel.timer > 0) return;
    const uid = this.channel.uid;
    this.channel = null;
    this.applyItem(uid, events);
  }

  private applyItem(uid: number, events: WorldEvent[]): void {
    const item = this.inventory.items.find((it) => it.uid === uid);
    if (!item) return;
    const fx = this.fx;
    const s = { ...this.survival };
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    const food = Math.max(0.2, 1 + (fx.foodValue ?? 0));
    const use = CONFIG.use;
    if (item.kind === 'ration' || item.kind === 'marchRation') {
      const gives = use[item.kind];
      s.hunger = clamp(s.hunger + gives.hunger * food);
      if ('thirst' in gives) s.thirst = clamp(s.thirst + gives.thirst);
      s.health = Math.min(this.maxHealth, s.health + (fx.foodHeal ?? 0));
      removeItem(this.inventory, uid);
    } else if (item.kind === 'waterskin') {
      s.thirst = clamp(s.thirst + use.waterskin.thirst);
      item.charges = Math.max(0, (item.charges ?? 0) - 1);
    } else {
      s.light = clamp(s.light + use.oil.light * Math.max(0.2, 1 + (fx.oilValue ?? 0)));
      removeItem(this.inventory, uid);
    }
    this.survival = s;
    events.push({ type: 'used', kind: item.kind });
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
      // The whole pack comes, wherever it is in the dark nearby.
      if (source.pack !== undefined && other.pack === source.pack && dist(other.pos, source.pos) <= COMBAT.packRadius) {
        other.alerted = true;
        other.forgetTimer = 0;
        continue;
      }
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
    this.hurtPlayer(def.damage * (this.isNight ? CONFIG.time.nightDamage : 1), def.stealsLight, events, { kind: def.kind });
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
      if (p.ttl <= 0 || !isSeeThrough(this.level, Math.floor(p.pos.x), Math.floor(p.pos.y))) return false;
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
    // Horrors hesitate in torchlight.
    if (this.inTorchLight(enemy.pos)) speed *= 0.6;
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
    const wet = (p: Point) => isShallow(this.level, Math.floor(p.x), Math.floor(p.y));
    const inWater = wet(enemy.pos);
    if (inWater) distance *= CONFIG.water.wade;
    const next = moveWithCollision(this.level, enemy.pos, dir.x * distance, dir.y * distance, enemy.def.radius);
    // Crawlers will not set foot in water: they wait at its edge.
    if (enemy.kind === 'crawler' && !inWater && wet(next)) return;
    enemy.pos = next;
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
