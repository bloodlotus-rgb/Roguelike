/** The six attributes. Physical: str, agi, vig. Mental: wit, wil, per. 10 is average. */
export type AttributeId = 'str' | 'agi' | 'vig' | 'wit' | 'wil' | 'per';
export type Attributes = Record<AttributeId, number>;

export const ATTRIBUTE_IDS: readonly AttributeId[] = ['str', 'agi', 'vig', 'wit', 'wil', 'per'];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Vigor: maximum health. */
export function maxHealth(a: Attributes): number {
  return 40 + a.vig * 6;
}

/** Strength: melee damage multiplier. */
export function damageMultiplier(a: Attributes): number {
  return Math.max(0.5, 1 + (a.str - 10) * 0.06);
}

/** Agility: multiplier for attack recovery and dodge cooldown (lower is faster). */
export function quicknessFactor(a: Attributes): number {
  return clamp(1 - (a.agi - 10) * 0.03, 0.6, 1.3);
}

/** Agility: extra seconds added to the parry window. */
export function parryBonus(a: Attributes): number {
  return clamp((a.agi - 10) * 0.01, -0.05, 0.08);
}

/** Perception: chance of a critical hit. */
export function critChance(a: Attributes): number {
  return clamp(0.05 + (a.per - 10) * 0.02, 0, 0.4);
}

/** Perception: base distance in tiles at which stealthy horrors become visible. */
export function stealthSight(a: Attributes): number {
  return Math.max(0.8, 1.5 + (a.per - 10) * 0.25);
}
