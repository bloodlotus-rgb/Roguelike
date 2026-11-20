import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = new Rng('estirpe');
    const b = new Rng('estirpe');
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('diverges for different seeds and derived streams', () => {
    expect(new Rng('a').next()).not.toBe(new Rng('b').next());
    expect(Rng.derive('s', 'level', 1).next()).not.toBe(Rng.derive('s', 'level', 2).next());
  });

  it('keeps int() within bounds', () => {
    const rng = new Rng('bounds');
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      expect(Number.isInteger(n)).toBe(true);
    }
  });
});
