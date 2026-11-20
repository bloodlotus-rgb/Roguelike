import { describe, expect, it } from 'vitest';
import { combineEffects, compatible, TRAITS, TRAIT_BY_ID } from './traits';

describe('trait catalog', () => {
  it('has the hundred traits, numbered and unique', () => {
    expect(TRAITS).toHaveLength(100);
    expect(new Set(TRAITS.map((t) => t.id)).size).toBe(100);
    expect(TRAITS.map((t) => t.n)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it('has text in both languages for every trait', () => {
    for (const t of TRAITS) {
      for (const field of [t.name, t.life, t.boss]) {
        expect(field.es.length).toBeGreaterThan(0);
        expect(field.en.length).toBeGreaterThan(0);
      }
      if (t.origin === 'acquired') expect(t.earn).toBeDefined();
    }
  });

  it('only excludes traits that exist', () => {
    for (const t of TRAITS) for (const other of t.excludes ?? []) expect(TRAIT_BY_ID[other]).toBeDefined();
  });

  it('keeps opposites apart', () => {
    expect(compatible('ironStomach', ['smallStomach'])).toBe(false);
    expect(compatible('smallStomach', ['ironStomach'])).toBe(false);
    expect(compatible('ironStomach', ['camel'])).toBe(true);
    expect(compatible('camel', ['camel'])).toBe(false);
  });

  it('adds effects together', () => {
    const total = combineEffects(['smithArms', 'broadBack', 'giant', 'ironStomach', 'survivor']);
    expect(total.attrs.str).toBe(6);
    expect(total.attrs.agi).toBe(-1);
    expect(total.hunger).toBeCloseTo(-0.3);
  });
});
