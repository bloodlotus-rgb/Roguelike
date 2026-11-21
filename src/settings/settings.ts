/**
 * The player's settings: how the game looks, sounds and is played on this device. Kept in
 * local storage (they belong to the device, not to the family), with a schema version.
 * Everything here is a preference: a missing or broken store just gives the defaults.
 */

export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high', 'ultra'];
export type ButtonSize = 'small' | 'normal' | 'large';
export type Hand = 'right' | 'left';

/** Actions that can be bound to keys on a computer. */
export type Action = 'up' | 'down' | 'left' | 'right' | 'attack' | 'dodge' | 'special' | 'interact' | 'map' | 'view' | 'pause';
export const ACTIONS: readonly Action[] = ['up', 'down', 'left', 'right', 'attack', 'dodge', 'special', 'interact', 'map', 'view', 'pause'];

export const DEFAULT_KEYS: Record<Action, string[]> = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['Space', 'KeyJ'],
  dodge: ['ShiftLeft', 'ShiftRight', 'KeyK'],
  special: ['KeyQ', 'KeyL'],
  interact: ['KeyE', 'Enter'],
  map: ['KeyM'],
  view: ['KeyV'],
  pause: ['Escape', 'KeyP'],
};

export interface Settings {
  version: 1;
  /** First-person horizontal field of view, in degrees. */
  fov: number;
  quality: Quality;
  /** Volumes, 0 to 1. */
  volume: { master: number; effects: number; ambient: number };
  /** Which hand holds the action buttons (the stick goes on the other side). */
  hand: Hand;
  buttons: ButtonSize;
  /** First-person turning speed, as a multiple of the usual. */
  turn: number;
  /** Text size, as a multiple of the usual. */
  text: number;
  contrast: boolean;
  shake: boolean;
  flashes: boolean;
  keys: Record<Action, string[]>;
}

export const DEFAULTS: Settings = {
  version: 1,
  fov: 62,
  quality: 'high',
  volume: { master: 0.8, effects: 1, ambient: 1 },
  hand: 'right',
  buttons: 'normal',
  turn: 1,
  text: 1,
  contrast: false,
  shake: true,
  flashes: true,
  keys: DEFAULT_KEYS,
};

const KEY = 'estirpe.settings';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Reads stored settings over the defaults, dropping anything that does not fit. */
export function parseSettings(raw: unknown): Settings {
  const s = clone(DEFAULTS);
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Partial<Settings>;
  const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback);
  s.fov = num(r.fov, 50, 100, s.fov);
  if (QUALITIES.includes(r.quality as Quality)) s.quality = r.quality as Quality;
  if (r.volume) {
    s.volume.master = num(r.volume.master, 0, 1, s.volume.master);
    s.volume.effects = num(r.volume.effects, 0, 1, s.volume.effects);
    s.volume.ambient = num(r.volume.ambient, 0, 1, s.volume.ambient);
  }
  if (r.hand === 'left' || r.hand === 'right') s.hand = r.hand;
  if (r.buttons === 'small' || r.buttons === 'normal' || r.buttons === 'large') s.buttons = r.buttons;
  s.turn = num(r.turn, 0.4, 2.5, s.turn);
  s.text = num(r.text, 0.85, 1.5, s.text);
  for (const k of ['contrast', 'shake', 'flashes'] as const) if (typeof r[k] === 'boolean') s[k] = r[k] as boolean;
  if (r.keys && typeof r.keys === 'object') {
    for (const a of ACTIONS) {
      const list = (r.keys as Record<string, unknown>)[a];
      if (Array.isArray(list) && list.every((k) => typeof k === 'string') && list.length > 0) s.keys[a] = list as string[];
    }
  }
  return s;
}

let current: Settings = (() => {
  try {
    const stored = localStorage.getItem(KEY);
    const s = parseSettings(stored ? JSON.parse(stored) : null);
    // Older separate preference: sound off.
    if (!stored && localStorage.getItem('estirpe.muted') === '1') s.volume.master = 0;
    return s;
  } catch {
    return clone(DEFAULTS);
  }
})();
const listeners = new Set<(s: Settings) => void>();

export function settings(): Settings {
  return current;
}

/** Changes some settings, saves them and tells whoever listens. */
export function updateSettings(change: (s: Settings) => void): void {
  const next = clone(current);
  change(next);
  current = parseSettings(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not remembered beyond this session.
  }
  for (const l of listeners) l(current);
}

export function onSettings(listener: (s: Settings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The action bound to a key, if any. */
export function actionFor(code: string): Action | null {
  for (const a of ACTIONS) if (current.keys[a].includes(code)) return a;
  return null;
}

export function keysFor(action: Action): string[] {
  return current.keys[action];
}

/**
 * Whether this device can take the most demanding effects: WebGL 2 with float render
 * targets, and a machine that is not obviously small.
 */
export function supportsUltra(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return false;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    return memory >= 4 && (navigator.hardwareConcurrency ?? 4) >= 4;
  } catch {
    return false;
  }
}

/** What a quality level means for the renderer. */
export function qualityProfile(q: Quality = current.quality): { scale: number; shadow: number; post: boolean; advanced: boolean } {
  switch (q) {
    case 'low':
      return { scale: 0.6, shadow: 512, post: false, advanced: false };
    case 'medium':
      return { scale: 0.8, shadow: 1024, post: true, advanced: false };
    case 'high':
      return { scale: 1, shadow: 2048, post: true, advanced: false };
    case 'ultra':
      return { scale: 1.25, shadow: 4096, post: true, advanced: true };
  }
}
