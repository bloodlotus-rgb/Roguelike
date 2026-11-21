/** Tuning values for the prototype. Times are in seconds, meters go from 0 to 100. */
export const CONFIG = {
  level: {
    // Extensive floor plans: about two and a half times the area of the first levels.
    width: 100,
    height: 76,
    roomAttempts: 420,
    minRooms: 16,
    maxRooms: 30,
    roomMinSize: 4,
    roomMaxSize: 12,
    extraConnections: 7,
    /** Horrors per level, as a multiple of the base budget (hordes in the bigger levels). */
    hordeScale: 2.4,
    /** Chance a level has a gallery (a double-height room over a hall below). */
    galleryChance: 0.5,
    /** Share of passages that are winding natural tunnels instead of straight corridors. */
    tunnelChance: 0.35,
    /** Chance a plain room gets a raised terrace along one wall. */
    terraceChance: 0.35,
    /** Chance a plain room is cut by a chasm, and that a chasm which can be walked around still has a bridge. */
    chasmChance: 0.2,
    bridgeChance: 0.4,
    /** Chance a plain room holds a pool. */
    poolChance: 0.18,
    /** Chance a level has an underground river crossing it. */
    riverChance: 0.35,
    /** Chance a river drains down a sinkhole and falls to the level below. */
    waterfallChance: 0.5,
    /** Chance a level has a collapse or two in its corridors. */
    rubbleChance: 0.6,
    /** Widest stretch of chasm a leap carries over, in tiles. */
    leapSpan: 1.5,
  },
  items: {
    // Scaled to the bigger levels: about as much per room as before.
    ration: { min: 2, max: 4 },
    oil: { min: 2, max: 4 },
    gold: { min: 5, max: 9 },
    marchRationChance: 0.5,
    mushroom: { min: 2, max: 5 },
    mushroomPoison: 0.35,
  },
  features: {
    fountain: { min: 2, max: 4 },
    drip: { min: 2, max: 6 },
    /** Share of room entrances that have a door. */
    doorChance: 0.4,
    remains: { min: 4, max: 8 },
    crate: { min: 6, max: 10 },
  },
  player: {
    /** Tiles per second: a slow, careful advance. */
    speed: 3.0,
    /** Running tires more than it used to: a burst, not a way of moving. */
    runCost: 1.6,
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
    // Fewer finds, and more of them worth carrying: less loose food, more of what opens the way.
    remains: {
      min: 1,
      max: 2,
      table: { ration: 12, oil: 20, gold: 18, marchRation: 10, waterskin: 6, bandage: 10, campKit: 6, firewood: 4, rope: 5, torch: 9 },
    },
    crate: { min: 0, max: 2, table: { ration: 14, oil: 18, gold: 12, firewood: 12, bandage: 8, planks: 12, torch: 10, chalk: 5, rope: 4 } },
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
  water: {
    /** Speed in shallow water, as a share of the usual. */
    wade: 0.6,
    /** How far a splash is heard, in tiles. */
    splashNoise: 4.5,
    /** How far the roar of a waterfall is heard, in tiles. */
    roarReach: 10,
    /** How far a flood reaches at most (tiles from the pool), and how much it rises each dawn and each generation. */
    floodMax: 16,
    floodPerDawn: 1,
    floodPerGeneration: 3,
    /** How far the shallow water must have spread before the pool's room goes deep. */
    floodDeepLag: 8,
  },
  works: {
    /** Tiles a torch lights; inside it the lamp rests and horrors hesitate. */
    torchRadius: 3,
    /** Condition a torch loses each dawn (about three days on a full load). */
    torchBurn: 34,
    reach: 1.2,
    /** Widest chasm a load of planks spans, in tiles. */
    bridgeSpan: 2,
    /** Seconds of digging to clear a collapse, and how far the noise carries (tiles). */
    digTime: 6,
    digNoise: 9,
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
