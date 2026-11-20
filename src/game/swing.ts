import { quicknessFactor } from '../core/attributes';
import type { World } from '../core/world';

/**
 * Where the hero is in a blow, as one continuous value, so every renderer can animate
 * it smoothly instead of holding a pose:
 * 0 → 1 winding up, 1 → 2 the strike (the first part of the recovery, fast),
 * 2 → 3 coming back to rest. -1 when not attacking.
 */
export function swingPhase(world: World): number {
  const action = world.action;
  if (action.type === 'special') {
    const special = world.cls.special;
    const windup = special.kind === 'execution' ? special.windup : 0.2;
    return Math.min(1, 1 - action.timer / windup);
  }
  if (action.type !== 'attack') return -1;
  const step = action.step;
  if (action.phase === 'windup') return Math.min(1, Math.max(0, 1 - action.timer / step.windup));
  const total = step.recovery * quicknessFactor(world.cls.attributes);
  const q = Math.min(1, Math.max(0, 1 - action.timer / total));
  // The strike itself takes the first quarter of the recovery; the rest is the return.
  return q < 0.25 ? 1 + q / 0.25 : 2 + (q - 0.25) / 0.75;
}

export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
export const easeIn = (t: number) => t * t;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
