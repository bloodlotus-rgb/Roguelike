import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { consume, freshSurvival, isDead, lightRadius, tickSurvival } from './survival';

describe('survival', () => {
  it('drains hunger, thirst and light over time', () => {
    const s = tickSurvival(freshSurvival(), 10);
    expect(s.hunger).toBeLessThan(100);
    expect(s.thirst).toBeLessThan(100);
    expect(s.light).toBeLessThan(100);
    expect(s.health).toBe(100);
  });

  it('drains health only while starving or dehydrated', () => {
    const starving = { health: 100, hunger: 0, thirst: 50, light: 50 };
    const after = tickSurvival(starving, CONFIG.survival.starvingDuration / 2);
    expect(after.health).toBeCloseTo(50, 0);
    const both = tickSurvival({ ...starving, thirst: 0 }, CONFIG.survival.starvingDuration / 2);
    expect(isDead(both)).toBe(true);
  });

  it('restores the matching meter without going over 100', () => {
    const s = { health: 100, hunger: 80, thirst: 10, light: 0 };
    expect(consume(s, 'food').hunger).toBe(100);
    expect(consume(s, 'water').thirst).toBe(10 + CONFIG.survival.restore.water);
    expect(consume(s, 'oil').light).toBe(CONFIG.survival.restore.oil);
  });

  it('shrinks the light radius as the light runs out', () => {
    expect(lightRadius(100)).toBeCloseTo(CONFIG.light.maxRadius);
    expect(lightRadius(0)).toBeCloseTo(CONFIG.light.minRadius);
    expect(lightRadius(30)).toBeLessThan(lightRadius(60));
  });
});
