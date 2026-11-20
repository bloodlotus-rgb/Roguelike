import type { Dynasty } from '../core/dynasty';
import type { WorldSnapshot } from '../core/world';

/**
 * What is kept between sessions: the dynasty, and the life being played if there is one.
 * There is a single save and it is overwritten continuously: nothing can be undone.
 */
export const SAVE_VERSION = 1;

export interface CurrentLife {
  memberId: number;
  /** Where this life's part of the chronicle begins, to tell it when the life ends. */
  chronicleFrom?: number;
  world: WorldSnapshot;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  savedAt: number;
  dynasty: Dynasty;
  life: CurrentLife | null;
}

export function makeSave(dynasty: Dynasty, life: CurrentLife | null, now: number): SaveData {
  return { version: SAVE_VERSION, savedAt: now, dynasty, life };
}

/**
 * Migrations, one per version step: each takes the data of version N and returns N + 1.
 * Empty for now; the first change to the format adds `1: (data) => ...`.
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Brings stored data up to the current version, or returns null if it cannot be read. */
export function migrate(raw: unknown): SaveData | null {
  if (!isObject(raw) || typeof raw.version !== 'number') return null;
  let data = raw;
  let version = raw.version;
  if (version > SAVE_VERSION) return null;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return null;
    data = step(data);
    version++;
    data.version = version;
  }
  return isValid(data) ? (data as unknown as SaveData) : null;
}

function isValid(data: Record<string, unknown>): boolean {
  const d = data.dynasty;
  if (!isObject(d)) return false;
  if (typeof d.seed !== 'string' || typeof d.generation !== 'number' || typeof d.lives !== 'number') return false;
  if (!Array.isArray(d.members) || !Array.isArray(d.chronicle) || !isObject(d.explored) || typeof d.nextId !== 'number') return false;
  if (!d.members.every((m) => isObject(m) && typeof m.id === 'number' && typeof m.name === 'string' && Array.isArray(m.traits))) return false;
  if (!d.members.some((m) => isObject(m) && m.status === 'alive')) return false;
  const life = data.life;
  if (life === null) return true;
  if (!isObject(life) || typeof life.memberId !== 'number' || !isObject(life.world)) return false;
  const w = life.world;
  return w.v === 1 && typeof w.seed === 'string' && typeof w.depth === 'number' && isObject(w.player) && isObject(w.survival);
}
