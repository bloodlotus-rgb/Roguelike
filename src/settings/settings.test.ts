import { describe, expect, it } from 'vitest';
import { DEFAULTS, parseSettings } from './settings';

describe('settings', () => {
  it('falls back to the defaults for anything missing or broken', () => {
    expect(parseSettings(null)).toEqual(DEFAULTS);
    expect(parseSettings({ fov: 'wide', quality: 'insane', volume: { master: 7 } })).toEqual({ ...DEFAULTS, volume: { ...DEFAULTS.volume, master: 1 } });
  });

  it('keeps valid choices and clamps numbers to their range', () => {
    const s = parseSettings({ fov: 140, quality: 'low', hand: 'left', turn: 0.1, keys: { attack: ['KeyX'] } });
    expect(s.fov).toBe(100);
    expect(s.quality).toBe('low');
    expect(s.hand).toBe('left');
    expect(s.turn).toBe(0.4);
    expect(s.keys.attack).toEqual(['KeyX']);
    expect(s.keys.dodge).toEqual(DEFAULTS.keys.dodge);
  });
});
