import type { ClassId } from './classes';
import type { EnemyKind } from './enemies';
import { Rng } from './rng';
import { compatible, TRAIT_CAP, TRAITS, traitDef, traitWeight, type TraitDef } from './traits';

/**
 * The dynasty: one family per player, living above one cursed dungeon. Time is counted in
 * deaths: every fall below advances a generation, heirs are born, the living grow old and
 * some die of age. Everything is drawn from the dynasty seed, so it is reproducible.
 */

export type MemberStatus = 'alive' | 'fallen' | 'aged';

export type DeathCause = { type: 'horror'; kind: EnemyKind } | { type: 'hunger' } | { type: 'thirst' };

export interface Member {
  id: number;
  name: string;
  parentId: number | null;
  /** Generation in which they were born. */
  born: number;
  /** Generations they live: 2 or 3. */
  lifespan: number;
  /** Trait ids, oldest first. */
  traits: string[];
  status: MemberStatus;
  classId?: ClassId;
  death?: { generation: number; depth: number; cause: DeathCause; x: number; y: number };
}

export type ChronicleEntry =
  | { type: 'founded'; generation: number }
  | { type: 'fell'; generation: number; memberId: number; depth: number; cause: DeathCause }
  | { type: 'born'; generation: number; memberId: number; parentId: number; inherited: Array<{ trait: string; from: number }> }
  | { type: 'aged'; generation: number; memberId: number; trait: string }
  | { type: 'diedOld'; generation: number; memberId: number }
  | { type: 'acquired'; generation: number; memberId: number; trait: string; depth: number }
  | { type: 'campBuilt'; generation: number; memberId: number; depth: number }
  | { type: 'campLost'; generation: number; depth: number; reason: 'night' | 'time' };

export type WorkKind = 'torch' | 'chalk' | 'barricade' | 'rope' | 'bridge';
export type ChalkSign = 'arrow' | 'danger' | 'water' | 'camp' | 'stairs';

/**
 * Something the family left in the dungeon to make the way easier: a torch on the floor,
 * a chalk mark, a barricade in a doorway, a rope down a pit, a bridge over a chasm. All of
 * it wears away.
 */
export interface Work {
  id: number;
  kind: WorkKind;
  depth: number;
  x: number;
  y: number;
  built: number;
  builder: number;
  /** 100 new, 0 gone (a torch at 0 is burnt out, but stays to be refilled). */
  condition: number;
  /** Chalk: which sign, and for an arrow, its direction in radians. */
  sign?: ChalkSign;
  angle?: number;
  /** Barricade: open or shut. */
  open?: boolean;
  /** Bridge: the chasm tiles it spans. */
  span?: Array<{ x: number; y: number }>;
}

/** A camp pitched by someone of the family: it stays for everyone until it wears away. */
export interface CampSite {
  id: number;
  depth: number;
  /** Tile it stands on. */
  x: number;
  y: number;
  /** Generation it was pitched in, and by whom. */
  built: number;
  builder: number;
  /** 100 new, 0 gone. */
  condition: number;
}

export interface Dynasty {
  seed: string;
  generation: number;
  /** Lives played so far: re-rolls horrors and loot each time. */
  lives: number;
  members: Member[];
  chronicle: ChronicleEntry[];
  /** Explored tiles per depth, as run-length strings (see `packTiles`). */
  explored: Record<number, string>;
  /** Camps the family keeps in the dungeon. */
  camps: CampSite[];
  /** Torches, marks, barricades and ropes the family keeps in the dungeon. */
  works: Work[];
  nextId: number;
}

const FIRST: readonly string[] = [
  'Al', 'Bre', 'Cor', 'Dar', 'El', 'Fen', 'Gor', 'Hal', 'Ir', 'Jor', 'Ka', 'Lio', 'Mor', 'Nes', 'Or',
  'Per', 'Ques', 'Ra', 'Sel', 'Tor', 'Ul', 'Ve', 'Wen', 'Ys', 'Zar', 'Ad', 'Bal', 'Cel', 'Dru', 'Est',
];
const MIDDLE: readonly string[] = ['', '', 'a', 'e', 'i', 'o', 'u', 'el', 'an'];
const LAST: readonly string[] = [
  'nna', 'ric', 'dan', 'mir', 'wen', 'thas', 'bel', 'sa', 'ven', 'doc', 'lis', 'mund', 'rin', 'ta', 'gar',
  'ya', 'ne', 'ros', 'via', 'lan', 'dra', 'nor', 'eth', 'is',
];

function makeName(rng: Rng, taken: Set<string>): string {
  for (let i = 0; i < 20; i++) {
    const name = rng.pick(FIRST) + rng.pick(MIDDLE) + rng.pick(LAST);
    if (!taken.has(name)) return name;
  }
  return rng.pick(FIRST) + rng.pick(LAST) + rng.int(2, 9);
}

/** Traits that can appear at birth, by draw weight. */
const BIRTH_POOL: readonly TraitDef[] = TRAITS.filter((t) => t.origin === 'birth' || t.origin === 'defect');

function drawTrait(rng: Rng, held: readonly string[], pool: readonly TraitDef[] = BIRTH_POOL): string | null {
  const options = pool.filter((t) => compatible(t.id, held));
  if (options.length === 0) return null;
  const total = options.reduce((sum, t) => sum + traitWeight(t), 0);
  let roll = rng.next() * total;
  for (const t of options) {
    roll -= traitWeight(t);
    if (roll < 0) return t.id;
  }
  return options[options.length - 1].id;
}

export function memberById(dynasty: Dynasty, id: number): Member {
  const member = dynasty.members.find((m) => m.id === id);
  if (!member) throw new Error(`Unknown member ${id}`);
  return member;
}

export function livingMembers(dynasty: Dynasty): Member[] {
  return dynasty.members.filter((m) => m.status === 'alive');
}

/** 0 young, 1 adult, 2+ old. */
export function ageOf(dynasty: Dynasty, member: Member): number {
  return dynasty.generation - member.born;
}

/** Starts a dynasty: three siblings, children of a founder no one plays. */
export function createDynasty(seed: string): Dynasty {
  const rng = Rng.derive(seed, 'dynasty', 'founding');
  const dynasty: Dynasty = {
    seed,
    generation: 1,
    lives: 0,
    members: [],
    chronicle: [{ type: 'founded', generation: 1 }],
    explored: {},
    camps: [],
    works: [],
    nextId: 1,
  };
  const names = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const name = makeName(rng, names);
    names.add(name);
    const traits: string[] = [];
    const count = rng.int(1, 3);
    for (let k = 0; k < count; k++) {
      const t = drawTrait(rng, traits);
      if (t) traits.push(t);
    }
    dynasty.members.push({ id: dynasty.nextId++, name, parentId: null, born: 1, lifespan: rng.int(2, 3), traits, status: 'alive' });
  }
  return dynasty;
}

/** Ancestors of a member, nearest first, with their distance (1 = parent). */
function lineage(dynasty: Dynasty, member: Member): Array<{ member: Member; distance: number }> {
  const result: Array<{ member: Member; distance: number }> = [];
  let current = member.parentId === null ? null : memberById(dynasty, member.parentId);
  let distance = 1;
  while (current) {
    result.push({ member: current, distance });
    current = current.parentId === null ? null : memberById(dynasty, current.parentId);
    distance++;
  }
  return result;
}

/** Chance that a trait passes from an ancestor at `distance`. */
function inheritChance(def: TraitDef, distance: number): number {
  if (def.origin === 'aging') return 0;
  const base = distance === 1 ? 0.5 : distance === 2 ? 0.25 : 0.12;
  return def.origin === 'acquired' ? base * 0.3 : base;
}

/**
 * The hero who was descending dies. A generation passes: heirs are born, the living age,
 * and those whose time has come die of age. Returns the chronicle of this generation.
 */
export function recordDeath(
  dynasty: Dynasty,
  memberId: number,
  info: { depth: number; cause: DeathCause; x: number; y: number },
): ChronicleEntry[] {
  const fallen = memberById(dynasty, memberId);
  const entries: ChronicleEntry[] = [];
  const generation = dynasty.generation;
  fallen.status = 'fallen';
  fallen.death = { generation, ...info };
  entries.push({ type: 'fell', generation, memberId, depth: info.depth, cause: info.cause });

  dynasty.generation++;
  dynasty.lives++;
  const next = dynasty.generation;
  const rng = Rng.derive(dynasty.seed, 'dynasty', next);
  const names = new Set(dynasty.members.map((m) => m.name));

  // The living grow older; some gain the marks of age, some die of it.
  for (const member of livingMembers(dynasty)) {
    const age = next - member.born;
    if (age >= member.lifespan) {
      member.status = 'aged';
      entries.push({ type: 'diedOld', generation: next, memberId: member.id });
      continue;
    }
    if (rng.chance(age >= 2 ? 0.7 : 0.35)) {
      const t = drawTrait(rng, member.traits, TRAITS.filter((d) => d.origin === 'aging'));
      if (t) {
        addTrait(member, t);
        entries.push({ type: 'aged', generation: next, memberId: member.id, trait: t });
      }
    }
  }

  // Heirs of the fallen.
  const heirs = rng.int(1, 4);
  for (let i = 0; i < heirs; i++) {
    const name = makeName(rng, names);
    names.add(name);
    const child: Member = { id: dynasty.nextId++, name, parentId: fallen.id, born: next, lifespan: rng.int(2, 3), traits: [], status: 'alive' };
    dynasty.members.push(child);
    const inherited: Array<{ trait: string; from: number }> = [];
    for (const { member: ancestor, distance } of lineage(dynasty, child)) {
      for (const t of ancestor.traits) {
        if (child.traits.length >= TRAIT_CAP) break;
        if (!compatible(t, child.traits)) continue;
        if (!rng.chance(inheritChance(traitDef(t), distance))) continue;
        child.traits.push(t);
        inherited.push({ trait: t, from: ancestor.id });
      }
    }
    const fresh = rng.int(1, 2);
    for (let k = 0; k < fresh && child.traits.length < TRAIT_CAP; k++) {
      const t = drawTrait(rng, child.traits);
      if (t) child.traits.push(t);
    }
    entries.push({ type: 'born', generation: next, memberId: child.id, parentId: fallen.id, inherited });
  }

  // Old camps fall apart: the longer a camp has stood, the likelier it is gone.
  dynasty.camps = (dynasty.camps ?? []).filter((camp) => {
    const age = next - camp.built;
    if (!rng.chance(Math.min(0.6, 0.1 * age))) return true;
    entries.push({ type: 'campLost', generation: next, depth: camp.depth, reason: 'time' });
    return false;
  });

  // Works wear with the years: chalk fades, ropes rot, torches burn down, barricades sag.
  const yearly: Record<WorkKind, number> = { chalk: 34, rope: 20, torch: 50, barricade: 15, bridge: 12 };
  dynasty.works = (dynasty.works ?? []).filter((w) => {
    w.condition -= yearly[w.kind];
    return w.condition > 0 || w.kind === 'torch';
  });

  dynasty.chronicle.push(...entries);
  return entries;
}

/** Adds a trait, dropping the oldest non-aging one when over the cap. Returns false if it cannot be held. */
export function addTrait(member: Member, id: string): boolean {
  if (!compatible(id, member.traits)) return false;
  member.traits.push(id);
  while (member.traits.length > TRAIT_CAP) {
    const index = member.traits.findIndex((t) => traitDef(t).origin !== 'aging');
    member.traits.splice(index >= 0 ? index : 0, 1);
  }
  return true;
}

/** Explored tiles as a compact string: alternating run lengths of 0s and 1s. */
export function packTiles(tiles: Uint8Array): string {
  const runs: number[] = [];
  let current = 0;
  let run = 0;
  for (const value of tiles) {
    const bit = value ? 1 : 0;
    if (bit === current) run++;
    else {
      runs.push(run);
      current = bit;
      run = 1;
    }
  }
  runs.push(run);
  return runs.join('.');
}

export function unpackTiles(packed: string | undefined, size: number): Uint8Array {
  const tiles = new Uint8Array(size);
  if (!packed) return tiles;
  let index = 0;
  let bit = 0;
  for (const part of packed.split('.')) {
    const run = Number(part);
    if (bit) tiles.fill(1, index, Math.min(size, index + run));
    index += run;
    bit = 1 - bit;
  }
  return tiles;
}

/** A trait earned during a life: it joins the member's traits and the chronicle. */
export function recordAcquired(dynasty: Dynasty, memberId: number, trait: string, depth: number): void {
  const member = memberById(dynasty, memberId);
  if (member.traits.includes(trait)) return;
  if (!addTrait(member, trait)) return;
  dynasty.chronicle.push({ type: 'acquired', generation: dynasty.generation, memberId, trait, depth });
}

export type AgeStage = 'young' | 'adult' | 'old';

/** Young in the generation they were born, old in their last one. */
export function ageStage(dynasty: Dynasty, member: Member): AgeStage {
  const age = ageOf(dynasty, member);
  if (age === 0) return 'young';
  return age >= member.lifespan - 1 ? 'old' : 'adult';
}

/** Ancestors of a member, parent first. */
export function ancestorsOf(dynasty: Dynasty, member: Member): Member[] {
  return lineage(dynasty, member).map((l) => l.member);
}
