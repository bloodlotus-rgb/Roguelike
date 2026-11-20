import { CONFIG } from './config';
import type { ItemKind } from './dungeon';

/** Hunger, thirst and light go from 0 to 100. Health is absolute, up to the hero's maximum. */
export interface Survival {
  health: number;
  hunger: number;
  thirst: number;
  light: number;
}

export interface SurvivalModifiers {
  maxHealth: number;
  hungerMultiplier: number;
  thirstMultiplier: number;
}

export const DEFAULT_MODIFIERS: SurvivalModifiers = { maxHealth: 100, hungerMultiplier: 1, thirstMultiplier: 1 };

export function freshSurvival(maxHealth = 100): Survival {
  return { health: maxHealth, hunger: 100, thirst: 100, light: 100 };
}

const clamp = (value: number, max = 100) => Math.max(0, Math.min(max, value));

/** Advances the meters by `dt` seconds. Hunger and thirst at zero drain health. */
export function tickSurvival(state: Survival, dt: number, mods: SurvivalModifiers = DEFAULT_MODIFIERS): Survival {
  const cfg = CONFIG.survival;
  const hunger = clamp(state.hunger - (100 / cfg.hungerDuration) * mods.hungerMultiplier * dt);
  const thirst = clamp(state.thirst - (100 / cfg.thirstDuration) * mods.thirstMultiplier * dt);
  const light = clamp(state.light - (100 / cfg.lightDuration) * dt);
  const deprivations = (hunger === 0 ? 1 : 0) + (thirst === 0 ? 1 : 0);
  const health = clamp(state.health - deprivations * (mods.maxHealth / cfg.starvingDuration) * dt, mods.maxHealth);
  return { health, hunger, thirst, light };
}

export function consume(state: Survival, kind: ItemKind): Survival {
  const amount = CONFIG.survival.restore[kind];
  switch (kind) {
    case 'food':
      return { ...state, hunger: clamp(state.hunger + amount) };
    case 'water':
      return { ...state, thirst: clamp(state.thirst + amount) };
    case 'oil':
      return { ...state, light: clamp(state.light + amount) };
  }
}

export function isDead(state: Survival): boolean {
  return state.health <= 0;
}

/** Visibility radius in tiles for the current light meter. */
export function lightRadius(light: number): number {
  const { minRadius, maxRadius } = CONFIG.light;
  // Ease out: the flame stays strong for a while, then fades fast near the end.
  const t = Math.sqrt(clamp(light) / 100);
  return minRadius + (maxRadius - minRadius) * t;
}
