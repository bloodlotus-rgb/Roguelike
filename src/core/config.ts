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
    food: { min: 2, max: 4 },
    water: { min: 2, max: 4 },
    oil: { min: 1, max: 3 },
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
    /** Seconds for a full meter to empty. */
    hungerDuration: 360,
    thirstDuration: 240,
    lightDuration: 210,
    /** Seconds to lose all health while starving or dehydrated (each one counts). */
    starvingDuration: 40,
    restore: { food: 40, water: 45, oil: 50 },
  },
  light: {
    /** Visibility radius in tiles with an empty and with a full light meter. */
    minRadius: 1.6,
    maxRadius: 7,
  },
} as const;
