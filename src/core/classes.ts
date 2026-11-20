import type { Attributes } from './attributes';

export type ClassId = 'headsman' | 'plunderer' | 'candlebearer';
export const CLASS_IDS: readonly ClassId[] = ['headsman', 'plunderer', 'candlebearer'];

/** One blow of a weapon combo. */
export interface ComboStep {
  /** Multiplies the weapon's base damage. */
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
  /** Seconds the blow stuns, if any. */
  stun?: number;
}

export interface WeaponDef {
  damage: number;
  /** The blows in order; the last one is usually the finisher. */
  combo: ComboStep[];
  /** Seconds after a blow in which the next press continues the combo. */
  comboWindow: number;
  /** Hits leave burning wax: the horror stays visible and burns. */
  wax?: { duration: number; damagePerSecond: number };
}

export type SpecialDef =
  | {
      kind: 'execution';
      reach: number;
      windup: number;
      /** Kills outright below this fraction of health, or when stunned. */
      threshold: number;
      /** Weapon damage multiplier when it does not kill. */
      multiplier: number;
    }
  | { kind: 'shadowStep'; distance: number; invisibleFor: number }
  | { kind: 'flare'; lightCost: number; radius: number; damage: number; fearFor: number; waxMultiplier: number };

/** How the special fills up, from 0 to 1. */
export interface ChargeDef {
  kind: 'fury' | 'opportunity' | 'devotion';
  perSecond: number;
  perHitDealt: number;
  perHitTaken: number;
  perBackstab: number;
  perParry: number;
  /** Minimum seconds between two uses. */
  cooldown: number;
}

export type PassiveDef =
  | { kind: 'bloodthirst'; healFraction: number }
  | { kind: 'ratEye'; itemSight: number; dropChance: number }
  | { kind: 'devoutFlame'; lightDrain: number; hesitation: number };

export interface ClassDef {
  id: ClassId;
  attributes: Attributes;
  weapon: WeaponDef;
  special: SpecialDef;
  charge: ChargeDef;
  passive: PassiveDef;
  /** Base parry window in seconds, before agility. */
  parryWindow: number;
  /** Seconds a parried enemy stays stunned. */
  parryStun: number;
  speedMultiplier: number;
  hungerMultiplier: number;
  thirstMultiplier: number;
  /** Damage multiplier when hitting an unaware horror or one from behind. */
  backstabMultiplier: number;
}

const deg = (d: number) => (d * Math.PI) / 180;

export const CLASSES: Record<ClassId, ClassDef> = {
  headsman: {
    id: 'headsman',
    attributes: { str: 14, agi: 8, vig: 14, wit: 8, wil: 11, per: 9 },
    weapon: {
      damage: 16,
      comboWindow: 0.9,
      combo: [
        { damage: 1, range: 1.5, arc: deg(150), windup: 0.24, recovery: 0.42, knockback: 0.6 },
        { damage: 1, range: 1.5, arc: deg(150), windup: 0.24, recovery: 0.42, knockback: 0.6 },
        { damage: 1.7, range: 1.75, arc: deg(60), windup: 0.36, recovery: 0.6, knockback: 0.9, stun: 0.9 },
      ],
    },
    special: { kind: 'execution', reach: 1.9, windup: 0.3, threshold: 0.3, multiplier: 3 },
    charge: { kind: 'fury', perSecond: 0, perHitDealt: 0.12, perHitTaken: 0.2, perBackstab: 0, perParry: 0.15, cooldown: 1 },
    passive: { kind: 'bloodthirst', healFraction: 0.08 },
    parryWindow: 0.16,
    parryStun: 1.6,
    speedMultiplier: 0.95,
    hungerMultiplier: 1.25,
    thirstMultiplier: 1.25,
    backstabMultiplier: 1,
  },
  plunderer: {
    id: 'plunderer',
    attributes: { str: 9, agi: 15, vig: 7, wit: 12, wil: 8, per: 13 },
    weapon: {
      damage: 7,
      comboWindow: 0.55,
      combo: [
        { damage: 1, range: 1.05, arc: deg(80), windup: 0.05, recovery: 0.16, knockback: 0.15 },
        { damage: 1, range: 1.05, arc: deg(80), windup: 0.05, recovery: 0.16, knockback: 0.15 },
        { damage: 1, range: 1.05, arc: deg(80), windup: 0.05, recovery: 0.16, knockback: 0.15 },
        { damage: 1.9, range: 1.15, arc: deg(130), windup: 0.08, recovery: 0.32, knockback: 0.4 },
      ],
    },
    special: { kind: 'shadowStep', distance: 3.5, invisibleFor: 2.5 },
    charge: { kind: 'opportunity', perSecond: 1 / 10, perHitDealt: 0, perHitTaken: 0, perBackstab: 0.35, perParry: 0.35, cooldown: 2 },
    passive: { kind: 'ratEye', itemSight: 4, dropChance: 0.55 },
    parryWindow: 0.24,
    parryStun: 1,
    speedMultiplier: 1.15,
    hungerMultiplier: 1,
    thirstMultiplier: 1,
    backstabMultiplier: 3,
  },
  candlebearer: {
    id: 'candlebearer',
    attributes: { str: 10, agi: 9, vig: 10, wit: 11, wil: 15, per: 11 },
    weapon: {
      damage: 11,
      comboWindow: 0,
      combo: [{ damage: 1, range: 1.25, arc: deg(110), windup: 0.12, recovery: 0.3, knockback: 0.35 }],
      wax: { duration: 6, damagePerSecond: 2.5 },
    },
    special: { kind: 'flare', lightCost: 15, radius: 3, damage: 22, fearFor: 3, waxMultiplier: 2 },
    charge: { kind: 'devotion', perSecond: 1 / 8, perHitDealt: 0, perHitTaken: 0, perBackstab: 0, perParry: 0.1, cooldown: 2 },
    passive: { kind: 'devoutFlame', lightDrain: 0.7, hesitation: 0.7 },
    parryWindow: 0.2,
    parryStun: 1.2,
    speedMultiplier: 1,
    hungerMultiplier: 1,
    thirstMultiplier: 1,
    backstabMultiplier: 1,
  },
};
