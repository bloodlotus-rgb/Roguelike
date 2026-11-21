/** Tuning values for the prototype. Times are in seconds, meters go from 0 to 100. */
export const CONFIG = {
  level: {
    width: 64,
    height: 48,
    roomAttempts: 140,
    minRooms: 7,
    maxRooms: 13,
    roomMinSize: 4,
    roomMaxSize: 10,
    extraConnections: 3,
    /** Chance a level has a gallery (a double-height room over a hall below). */
    galleryChance: 0.5,
    /** Share of passages that are winding natural tunnels instead of straight corridors. */
    tunnelChance: 0.35,
    /** Chance a plain room gets a raised terrace along one wall. */
    terraceChance: 0.35,
    /** Chance a plain room is cut by a chasm, and that a chasm which can be walked around still has a bridge. */
    chasmChance: 0.2,
    bridgeChance: 0.4,
    /** Widest stretch of chasm a leap carries over, in tiles. */
    leapSpan: 1.5,
  },
  items: {
    ration: { min: 2, max: 3 },
    oil: { min: 1, max: 2 },
    gold: { min: 3, max: 5 },
    marchRationChance: 0.3,
    mushroom: { min: 1, max: 3 },
    mushroomPoison: 0.35,
  },
  features: {
    fountain: { min: 1, max: 2 },
    drip: { min: 1, max: 3 },
    /** Share of room entrances that have a door. */
    doorChance: 0.4,
    remains: { min: 2, max: 4 },
    crate: { min: 3, max: 5 },
  },
  player: {
    /** Tiles per second. */
    speed: 3.6,
    /** Collision radius in tiles. */
    radius: 0.3,
    /** Distance in tiles to pick up an item. */
    pickupDistance: 0.6,
    /** Distance in tiles to use the stairs. */
    stairsDistance: 0.8,
  },
  survival: {
    /** Seconds for a full meter to empty standing still; doing things costs on top. */
    hungerDuration: 1800,
    thirstDuration: 1500,
    lightDuration: 210,
    /** Seconds to lose all health while starving or dehydrated (each one counts). */
    starvingDuration: 40,
    /** Out of combat: seconds of calm before healing starts, and health per second. */
    calmBeforeHealing: 5,
    healPerSecond: 2,
    /** Below this, an empty-ish meter already weighs on the body. */
    lowMeter: 25,
  },
  /** What using each item gives. */
  use: {
    ration: { hunger: 35 },
    marchRation: { hunger: 25, thirst: 10 },
    waterskin: { thirst: 25 },
    oil: { light: 50 },
    /** Seconds standing still to eat, drink or fill the lamp. */
    channel: 1.5,
  },
  loot: {
    /** Searching a container: how many things, and what (weights). */
    remains: {
      min: 1,
      max: 3,
      table: { ration: 25, oil: 18, gold: 15, marchRation: 8, waterskin: 7, bandage: 10, campKit: 7, firewood: 10 },
    },
    crate: { min: 0, max: 2, table: { ration: 30, oil: 16, gold: 10, firewood: 20, bandage: 8, planks: 8, torch: 5, chalk: 3 } },
    /** Chance that a slain Crawler or Husk leaves flesh worth eating (if cooked). */
    horrorMeat: 0.2,
    /** Reach of fountains and containers, in tiles. */
    reach: 1.1,
  },
  /** The mansion's shop: price in gold of what it sells. */
  shop: {
    ration: 4,
    marchRation: 12,
    waterskin: 10,
    oil: 5,
    firewood: 3,
    bandage: 6,
    campKit: 25,
    torch: 6,
    chalk: 3,
    planks: 5,
    rope: 15,
  },
  works: {
    /** Tiles a torch lights; inside it the lamp rests and horrors hesitate. */
    torchRadius: 3,
    /** Condition a torch loses each dawn (about three days on a full load). */
    torchBurn: 34,
    reach: 1.2,
    /** Widest chasm a load of planks spans, in tiles. */
    bridgeSpan: 2,
    /** A plain door's strength, and how fast hunting horrors batter doors and barricades. */
    doorHp: 60,
    bashDoor: 20,
    bashBarricade: 8,
    /** Condition a rope loses each dawn. */
    ropeRot: 4,
    /** Chance a barricade is battered on any night. */
    nightBarricade: 0.1,
  },
  /** A day below ground: long enough to explore, then a short, dangerous night. */
  time: {
    day: 420,
    night: 150,
    /** At night the flame burns faster and horrors hit harder and see farther. */
    nightLight: 1.4,
    nightDamage: 1.2,
    nightDetection: 1.25,
  },
  camp: {
    reach: 1.3,
    /** Chances for a night in camp, before fire and Will. */
    attack: 0.18,
    noFire: 0.22,
    noises: 0.25,
    /** What a night costs the body. */
    nightHunger: 10,
    nightThirst: 12,
    /** Damage to a camp when attacked, and the chance an empty camp is attacked at dawn. */
    attackDamage: 20,
    emptyAttack: 0.08,
    emptyDamage: 40,
    bandage: 30,
    mushroom: 20,
    horrorMeat: 50,
    nightmares: 0.3,
  },
  light: {
    /** Visibility radius in tiles with an empty and with a full light meter. */
    minRadius: 1.6,
    maxRadius: 7,
  },
} as const;
