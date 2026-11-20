import type { Level, Point } from './dungeon';
import { isFloor } from './dungeon';
import type { Rng } from './rng';

export type EnemyKind = 'crawler' | 'husk' | 'mourner' | 'snuffer';
export const ENEMY_KINDS: readonly EnemyKind[] = ['crawler', 'husk', 'mourner', 'snuffer'];

export interface EnemyDef {
  kind: EnemyKind;
  health: number;
  /** Tiles per second while chasing. */
  speed: number;
  radius: number;
  damage: number;
  /** Melee reach, or preferred firing distance for ranged horrors. */
  range: number;
  windup: number;
  recovery: number;
  /** Base distance in tiles at which it notices the player, before light. */
  detect: number;
  parryable: boolean;
  ranged: boolean;
  /** Only visible up close (see `stealthSight`). */
  stealthy: boolean;
  /** Light taken from the player on a hit. */
  stealsLight: number;
  /** Cost in the spawn budget. Groups pay once. */
  cost: number;
  group: [number, number];
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  crawler: {
    kind: 'crawler',
    health: 18,
    speed: 3.1,
    radius: 0.28,
    damage: 6,
    range: 0.85,
    windup: 0.38,
    recovery: 0.7,
    detect: 3,
    parryable: true,
    ranged: false,
    stealthy: false,
    stealsLight: 0,
    cost: 3,
    group: [3, 5],
  },
  husk: {
    kind: 'husk',
    health: 70,
    speed: 1.4,
    radius: 0.4,
    damage: 26,
    range: 1.25,
    windup: 0.95,
    recovery: 1.2,
    detect: 2.5,
    parryable: false,
    ranged: false,
    stealthy: false,
    stealsLight: 0,
    cost: 2.5,
    group: [1, 1],
  },
  mourner: {
    kind: 'mourner',
    health: 26,
    speed: 2.2,
    radius: 0.3,
    damage: 9,
    range: 4.2,
    windup: 0.6,
    recovery: 1.6,
    detect: 3.5,
    parryable: false,
    ranged: true,
    stealthy: false,
    stealsLight: 0,
    cost: 2,
    group: [1, 1],
  },
  snuffer: {
    kind: 'snuffer',
    health: 24,
    speed: 3,
    radius: 0.28,
    damage: 5,
    range: 0.85,
    windup: 0.3,
    recovery: 0.8,
    detect: 3,
    parryable: true,
    ranged: false,
    stealthy: true,
    stealsLight: 12,
    cost: 2,
    group: [1, 1],
  },
};

export interface EnemySpawn {
  kind: EnemyKind;
  pos: Point;
  /** Index of the room it lives in. */
  room: number;
  /** Roamers wander from room to room instead of staying in theirs. */
  roamer: boolean;
}

/** Spawn weights by depth: deeper levels bring more ranged and stealthy horrors. */
function weights(depth: number): Record<EnemyKind, number> {
  const d = Math.min(depth - 1, 8);
  return {
    crawler: 0.45 - d * 0.02,
    husk: 0.25,
    mourner: 0.15 + d * 0.01,
    snuffer: 0.15 + d * 0.01,
  };
}

function pickKind(rng: Rng, depth: number): EnemyKind {
  const w = weights(depth);
  const total = ENEMY_KINDS.reduce((sum, k) => sum + w[k], 0);
  let roll = rng.next() * total;
  for (const kind of ENEMY_KINDS) {
    roll -= w[kind];
    if (roll < 0) return kind;
  }
  return 'crawler';
}

/** Places horrors in every room except the starting one. Budget grows with depth. */
export function spawnEnemies(level: Level, rng: Rng): EnemySpawn[] {
  const spawns: EnemySpawn[] = [];
  const taken = new Set<string>([`${level.stairs.x},${level.stairs.y}`]);
  let budget = 12 + level.depth * 4;
  const rooms = level.rooms.map((_, i) => i).filter((i) => i !== 0);
  if (rooms.length === 0) return spawns;
  let guard = 0;
  while (budget > 0 && guard++ < 100) {
    const kind = pickKind(rng, level.depth);
    const def = ENEMIES[kind];
    if (def.cost > budget + 1) break;
    budget -= def.cost;
    const roomIndex = rng.pick(rooms);
    const room = level.rooms[roomIndex];
    const count = rng.int(def.group[0], def.group[1]);
    const roamer = def.kind !== 'mourner' && rng.chance(0.3);
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const x = rng.int(room.x, room.x + room.w - 1);
        const y = rng.int(room.y, room.y + room.h - 1);
        const key = `${x},${y}`;
        if (taken.has(key) || !isFloor(level, x, y)) continue;
        taken.add(key);
        spawns.push({ kind, pos: { x: x + 0.5, y: y + 0.5 }, room: roomIndex, roamer });
        break;
      }
    }
  }
  return spawns;
}
