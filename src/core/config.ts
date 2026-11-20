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
  },
  items: {
    ration: { min: 2, max: 3 },
    oil: { min: 1, max: 2 },
    gold: { min: 3, max: 5 },
    marchRationChance: 0.3,
  },
  features: {
    fountain: { min: 1, max: 2 },
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
    remains: { min: 1, max: 3, table: { ration: 35, oil: 25, gold: 20, marchRation: 10, waterskin: 10 } },
    crate: { min: 0, max: 2, table: { ration: 50, oil: 30, gold: 20 } },
    /** Reach of fountains and containers, in tiles. */
    reach: 1.1,
  },
  light: {
    /** Visibility radius in tiles with an empty and with a full light meter. */
    minRadius: 1.6,
    maxRadius: 7,
  },
} as const;
