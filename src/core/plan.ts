/**
 * The plan of the building (Ed2), decided all at once from the seed: its areas (eras of
 * the building, oldest deepest), the zones of each area (layers sealed from each other by
 * a slab of rock, crossed only by their passages), the storeys of each zone, and how wide
 * the building is at each depth (wider and wider down, like roots).
 *
 * A storey is what the game still calls a depth (1 at the top). Pure data, deterministic.
 */
import type { KeyKind } from './inventory';
import { Rng } from './rng';

export const STOREYS_PER_ZONE = 4;
export const ZONES_PER_AREA = 5;
export const AREAS = 5;
/** The deepest storey: under it, nothing. */
export const MAX_DEPTH = AREAS * ZONES_PER_AREA * STOREYS_PER_ZONE;
/** The rock between two zones, over the slab every storey already has. */
export const ZONE_SLAB = 1;

export type EraId = 'cellars' | 'crypt' | 'cisterns' | 'foundry' | 'library' | 'mines' | 'city' | 'cathedral' | 'caves' | 'root';

export interface Era {
  id: EraId;
  name: { es: string; en: string };
  /** How old: the older, the deeper. */
  age: number;
}

/** The eras the building can be made of, youngest first. */
export const ERAS: Era[] = [
  { id: 'cellars', name: { es: 'Bodegas', en: 'Cellars' }, age: 1 },
  { id: 'crypt', name: { es: 'Cripta', en: 'Crypt' }, age: 2 },
  { id: 'cisterns', name: { es: 'Cisternas', en: 'Cisterns' }, age: 3 },
  { id: 'foundry', name: { es: 'Fundición', en: 'Foundry' }, age: 4 },
  { id: 'library', name: { es: 'Biblioteca hundida', en: 'Sunken library' }, age: 5 },
  { id: 'mines', name: { es: 'Minas', en: 'Mines' }, age: 6 },
  { id: 'city', name: { es: 'Ciudad enterrada', en: 'Buried city' }, age: 7 },
  { id: 'cathedral', name: { es: 'Catedral invertida', en: 'Inverted cathedral' }, age: 8 },
  { id: 'caves', name: { es: 'Cuevas vivas', en: 'Living caves' }, age: 9 },
  { id: 'root', name: { es: 'La raíz', en: 'The root' }, age: 10 },
];

/** How wide each area is (tiles a side): the building widens as it goes down. */
export const AREA_WIDTH = [144, 240, 336, 480, 672];

export interface Plan {
  seed: string;
  /** The era of each area, from the top. */
  areas: Era[];
}

/**
 * The plan of a building. The cellars of the mansion are always first and the root of
 * the curse always last; the three between are drawn from the rest and laid by age.
 */
export function makePlan(seed: string): Plan {
  const rng = Rng.derive(seed, 'plan');
  const middle = ERAS.filter((e) => e.id !== 'cellars' && e.id !== 'root');
  const drawn: Era[] = [];
  while (drawn.length < AREAS - 2) {
    const e = rng.pick(middle.filter((m) => !drawn.includes(m)));
    drawn.push(e);
  }
  drawn.sort((a, b) => a.age - b.age);
  return { seed, areas: [ERAS[0], ...drawn, ERAS[ERAS.length - 1]] };
}

const plans = new Map<string, Plan>();

/** The plan of a seed (made once). */
export function planOf(seed: string): Plan {
  let plan = plans.get(seed);
  if (!plan) {
    plan = makePlan(seed);
    plans.set(seed, plan);
  }
  return plan;
}

export interface Place {
  /** 0-based: which area, which zone in the whole building, which zone in its area. */
  area: number;
  zone: number;
  zoneInArea: number;
  /** 1-based: which storey of its zone. */
  storey: number;
  era: Era;
}

/** Where a depth (storey) lies in the plan. */
export function placeOf(plan: Plan, depth: number): Place {
  const d = Math.max(1, Math.min(MAX_DEPTH, depth));
  const zone = Math.floor((d - 1) / STOREYS_PER_ZONE);
  const area = Math.floor(zone / ZONES_PER_AREA);
  return { area, zone, zoneInArea: zone % ZONES_PER_AREA, storey: ((d - 1) % STOREYS_PER_ZONE) + 1, era: plan.areas[area] };
}

/** How many zones are crossed going down to a depth (each adds its slab). */
export function zoneIndex(depth: number): number {
  return Math.floor((Math.max(1, depth) - 1) / STOREYS_PER_ZONE);
}

/** The last storey of its zone: its way down is the zone's passage, locked. */
export function isZoneEnd(depth: number): boolean {
  return depth % STOREYS_PER_ZONE === 0;
}

/** The key the passage out of a zone takes: iron above, bronze in the middle, bone deep. */
export function zoneKey(depth: number): KeyKind {
  const area = Math.floor(zoneIndex(depth) / ZONES_PER_AREA);
  return area <= 1 ? 'keyIron' : area === 2 ? 'keyBronze' : 'keyBone';
}

/** The name of a zone: its era and its number in the area (I to V). */
export function zoneName(plan: Plan, depth: number, lang: 'es' | 'en'): string {
  const p = placeOf(plan, depth);
  return `${p.era.name[lang]} ${['I', 'II', 'III', 'IV', 'V'][p.zoneInArea]}`;
}
