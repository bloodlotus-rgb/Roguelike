import type { Attributes } from './attributes';

export type ClassId = 'headsman' | 'plunderer' | 'candlebearer';
export const CLASS_IDS: readonly ClassId[] = ['headsman', 'plunderer', 'candlebearer'];

export interface WeaponDef {
  damage: number;
  /** Reach in tiles from the player's center. */
  range: number;
  /** Full swing arc in radians. */
  arc: number;
  /** Seconds before the hit lands. */
  windup: number;
  /** Seconds after the hit before acting again (scaled by agility). */
  recovery: number;
  /** Push distance in tiles. */
  knockback: number;
}

export type AbilityDef =
  | {
      kind: 'chargedCleave';
      cooldown: number;
      /** Seconds to reach full charge. */
      chargeTime: number;
      radius: number;
      /** Weapon damage multiplier at no charge and at full charge. */
      minMultiplier: number;
      maxMultiplier: number;
    }
  | { kind: 'shadowStep'; cooldown: number; distance: number; invisibleFor: number }
  | { kind: 'flare'; cooldown: number; lightCost: number; radius: number; damage: number; fearFor: number };

export interface ClassDef {
  id: ClassId;
  attributes: Attributes;
  weapon: WeaponDef;
  ability: AbilityDef;
  /** Base parry window in seconds, before agility. */
  parryWindow: number;
  /** Seconds a parried enemy stays stunned. */
  parryStun: number;
  speedMultiplier: number;
  hungerMultiplier: number;
  thirstMultiplier: number;
  /** Multiplies the distance at which horrors notice the player's light. */
  detectionMultiplier: number;
  /** Damage multiplier when hitting an unaware horror or one from behind. */
  backstabMultiplier: number;
  /** Horrors chasing inside the player's light slow down to this fraction. */
  lightHesitation: number;
}

const deg = (d: number) => (d * Math.PI) / 180;

export const CLASSES: Record<ClassId, ClassDef> = {
  headsman: {
    id: 'headsman',
    attributes: { str: 14, agi: 8, vig: 14, wit: 8, wil: 11, per: 9 },
    weapon: { damage: 16, range: 1.5, arc: deg(150), windup: 0.24, recovery: 0.42, knockback: 0.6 },
    ability: { kind: 'chargedCleave', cooldown: 6, chargeTime: 1, radius: 1.9, minMultiplier: 1.4, maxMultiplier: 3 },
    parryWindow: 0.16,
    parryStun: 1.6,
    speedMultiplier: 0.95,
    hungerMultiplier: 1.25,
    thirstMultiplier: 1.25,
    detectionMultiplier: 1,
    backstabMultiplier: 1,
    lightHesitation: 1,
  },
  plunderer: {
    id: 'plunderer',
    attributes: { str: 9, agi: 15, vig: 7, wit: 12, wil: 8, per: 13 },
    weapon: { damage: 7, range: 1.05, arc: deg(80), windup: 0.05, recovery: 0.16, knockback: 0.15 },
    ability: { kind: 'shadowStep', cooldown: 8, distance: 3.5, invisibleFor: 2.5 },
    parryWindow: 0.24,
    parryStun: 1,
    speedMultiplier: 1.15,
    hungerMultiplier: 1,
    thirstMultiplier: 1,
    detectionMultiplier: 1,
    backstabMultiplier: 3,
    lightHesitation: 1,
  },
  candlebearer: {
    id: 'candlebearer',
    attributes: { str: 10, agi: 9, vig: 10, wit: 11, wil: 15, per: 11 },
    weapon: { damage: 11, range: 1.25, arc: deg(110), windup: 0.12, recovery: 0.3, knockback: 0.35 },
    ability: { kind: 'flare', cooldown: 7, lightCost: 15, radius: 3, damage: 22, fearFor: 3 },
    parryWindow: 0.2,
    parryStun: 1.2,
    speedMultiplier: 1,
    hungerMultiplier: 1,
    thirstMultiplier: 1,
    detectionMultiplier: 0.7,
    backstabMultiplier: 1,
    lightHesitation: 0.7,
  },
};
