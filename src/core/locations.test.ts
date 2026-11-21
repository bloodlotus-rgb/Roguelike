import { describe, expect, it } from 'vitest';
import { checkLocation, connectorsOf, LOCATIONS } from './locations';

describe('locations', () => {
  it('every plan is well drawn: rectangular, closed, reachable from its connectors', () => {
    for (const def of LOCATIONS) expect(checkLocation(def)).toEqual([]);
  });

  it('ids are unique and connectors come two tiles wide', () => {
    expect(new Set(LOCATIONS.map((d) => d.id)).size).toBe(LOCATIONS.length);
    for (const def of LOCATIONS) for (const c of connectorsOf(def.plan)) expect(c.cells).toHaveLength(2);
  });

  it('catches a broken plan', () => {
    const broken = { id: 'x', name: { es: '', en: '' }, depths: [1, 1] as [number, number], weight: 1, plan: ['#####', '#.#.#', '##+##'] };
    expect(checkLocation(broken).length).toBeGreaterThan(0);
  });
});
