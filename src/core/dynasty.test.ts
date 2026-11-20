import { describe, expect, it } from 'vitest';
import { addTrait, ageOf, ageStage, createDynasty, livingMembers, memberById, packTiles, recordAcquired, recordDeath, unpackTiles } from './dynasty';
import { TRAIT_CAP, traitDef } from './traits';

const death = { depth: 3, cause: { type: 'horror' as const, kind: 'husk' as const }, x: 10, y: 12 };

describe('dynasty', () => {
  it('starts with three living siblings, the same for the same seed', () => {
    const a = createDynasty('estirpe');
    const b = createDynasty('estirpe');
    expect(livingMembers(a)).toHaveLength(3);
    expect(a).toEqual(b);
    expect(createDynasty('otra').members.map((m) => m.name)).not.toEqual(a.members.map((m) => m.name));
  });

  it('records a death: heirs are born and a generation passes', () => {
    const dynasty = createDynasty('estirpe');
    const hero = dynasty.members[0];
    const entries = recordDeath(dynasty, hero.id, death);
    expect(hero.status).toBe('fallen');
    expect(dynasty.generation).toBe(2);
    const heirs = dynasty.members.filter((m) => m.parentId === hero.id);
    expect(heirs.length).toBeGreaterThanOrEqual(1);
    expect(heirs.length).toBeLessThanOrEqual(4);
    expect(entries.filter((e) => e.type === 'born')).toHaveLength(heirs.length);
    expect(entries[0]).toMatchObject({ type: 'fell', memberId: hero.id, depth: 3 });
  });

  it('never runs out of living members, and the old die of age', () => {
    const dynasty = createDynasty('estirpe');
    for (let i = 0; i < 30; i++) {
      const living = livingMembers(dynasty);
      expect(living.length).toBeGreaterThan(0);
      recordDeath(dynasty, living[0].id, death);
      for (const m of livingMembers(dynasty)) expect(ageOf(dynasty, m)).toBeLessThan(m.lifespan);
    }
    expect(dynasty.chronicle.some((e) => e.type === 'diedOld')).toBe(true);
    expect(dynasty.chronicle.some((e) => e.type === 'aged')).toBe(true);
  });

  it('keeps every member within the trait cap and without opposite traits', () => {
    const dynasty = createDynasty('estirpe');
    for (let i = 0; i < 40; i++) recordDeath(dynasty, livingMembers(dynasty)[0].id, death);
    for (const m of dynasty.members) {
      expect(m.traits.length).toBeLessThanOrEqual(TRAIT_CAP);
      expect(new Set(m.traits).size).toBe(m.traits.length);
      for (const t of m.traits) for (const other of traitDef(t).excludes ?? []) expect(m.traits).not.toContain(other);
    }
  });

  it('passes traits down the line, never the marks of age', () => {
    const dynasty = createDynasty('estirpe');
    let inherited = 0;
    for (let i = 0; i < 40; i++) {
      const entries = recordDeath(dynasty, livingMembers(dynasty)[0].id, death);
      for (const e of entries) {
        if (e.type !== 'born') continue;
        inherited += e.inherited.length;
        for (const { trait, from } of e.inherited) {
          expect(traitDef(trait).origin).not.toBe('aging');
          expect(memberById(dynasty, from).traits).toContain(trait);
        }
      }
    }
    expect(inherited).toBeGreaterThan(0);
  });

  it('drops the oldest trait over the cap, keeping marks of age', () => {
    const m = { id: 1, name: 'x', parentId: null, born: 1, lifespan: 2, traits: ['greyHair', 'smithArms', 'camel', 'devout', 'serene'], status: 'alive' as const };
    expect(addTrait(m, 'scar')).toBe(true);
    expect(m.traits).toEqual(['greyHair', 'camel', 'devout', 'serene', 'scar']);
  });

  it('packs explored tiles compactly and back', () => {
    const tiles = new Uint8Array(100);
    tiles.fill(1, 10, 30);
    tiles.fill(1, 50, 51);
    tiles[99] = 1;
    expect(unpackTiles(packTiles(tiles), 100)).toEqual(tiles);
    expect(unpackTiles(undefined, 5)).toEqual(new Uint8Array(5));
  });
});

describe('acquired traits and ages', () => {
  it('an acquired trait joins the member and the chronicle once', () => {
    const d = createDynasty('estirpe');
    const m = d.members[0];
    recordAcquired(d, m.id, 'scar', 3);
    recordAcquired(d, m.id, 'scar', 4);
    expect(m.traits.filter((t) => t === 'scar').length).toBe(1);
    expect(d.chronicle.filter((e) => e.type === 'acquired').length).toBe(1);
  });

  it('members are young, then adult, then old', () => {
    const d = createDynasty('estirpe');
    const m = d.members[0];
    m.lifespan = 3;
    expect(ageStage(d, m)).toBe('young');
    d.generation = 2;
    expect(ageStage(d, m)).toBe('adult');
    d.generation = 3;
    expect(ageStage(d, m)).toBe('old');
  });
});
