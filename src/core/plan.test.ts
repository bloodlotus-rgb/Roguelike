import { describe, expect, it } from 'vitest';
import { AREAS, isZoneEnd, makePlan, MAX_DEPTH, placeOf, planOf, zoneIndex, zoneKey, zoneName, ZONES_PER_AREA } from './plan';

describe('the plan of the building', () => {
  it('five areas by age: the cellars first, the root last, three drawn between', () => {
    for (const seed of ['a', 'b', 'estirpe', 'ashen-crypt-417', 'zz']) {
      const plan = makePlan(seed);
      expect(plan.areas).toHaveLength(AREAS);
      expect(plan.areas[0].id).toBe('cellars');
      expect(plan.areas[AREAS - 1].id).toBe('root');
      for (let i = 1; i < AREAS; i++) expect(plan.areas[i].age).toBeGreaterThan(plan.areas[i - 1].age);
      expect(new Set(plan.areas.map((a) => a.id)).size).toBe(AREAS);
    }
    // The same seed, the same plan; other seeds, other eras.
    expect(makePlan('estirpe')).toEqual(makePlan('estirpe'));
    const middles = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((s) => makePlan(s).areas.slice(1, -1).map((a) => a.id).join()));
    expect(middles.size).toBeGreaterThan(1);
  });

  it('storeys group into zones of four, zones into areas of five, a hundred storeys in all', () => {
    const plan = planOf('estirpe');
    expect(MAX_DEPTH).toBe(100);
    expect(placeOf(plan, 1)).toMatchObject({ area: 0, zone: 0, storey: 1 });
    expect(placeOf(plan, 4)).toMatchObject({ zone: 0, storey: 4 });
    expect(placeOf(plan, 5)).toMatchObject({ zone: 1, storey: 1 });
    expect(placeOf(plan, 21)).toMatchObject({ area: 1, zone: 5, zoneInArea: 0 });
    expect(placeOf(plan, 100)).toMatchObject({ area: 4, zone: 24, storey: 4 });
    expect(isZoneEnd(4) && isZoneEnd(8) && !isZoneEnd(5)).toBe(true);
    expect(zoneIndex(9)).toBe(2);
    expect(ZONES_PER_AREA * AREAS * 4).toBe(MAX_DEPTH);
  });

  it('keys by area, and zones named by their era', () => {
    expect(zoneKey(4)).toBe('keyIron');
    expect(zoneKey(40)).toBe('keyIron');
    expect(zoneKey(44)).toBe('keyBronze');
    expect(zoneKey(64)).toBe('keyBone');
    expect(zoneName(planOf('estirpe'), 1, 'es')).toBe('Bodegas I');
    expect(zoneName(planOf('estirpe'), 6, 'en')).toBe('Cellars II');
  });
});
