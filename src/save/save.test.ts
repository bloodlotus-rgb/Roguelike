import { describe, expect, it } from 'vitest';
import { createDynasty } from '../core/dynasty';
import { World } from '../core/world';
import { makeSave, migrate, SAVE_VERSION } from './save';

describe('save data', () => {
  it('survives a round trip through JSON', () => {
    const dynasty = createDynasty('estirpe');
    const world = new World('estirpe', 'headsman', 0, 1, { traits: dynasty.members[0].traits, explored: dynasty.explored });
    const data = makeSave(dynasty, { memberId: 1, world: world.snapshot() }, 1);
    const back = migrate(JSON.parse(JSON.stringify(data)));
    expect(back).toEqual(data);
    expect(back?.version).toBe(SAVE_VERSION);
  });

  it('a dynasty between lives has no current life', () => {
    const data = makeSave(createDynasty('estirpe'), null, 1);
    expect(migrate(JSON.parse(JSON.stringify(data)))?.life).toBeNull();
  });

  it('rejects what it cannot read', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ version: SAVE_VERSION + 1 })).toBeNull();
    expect(migrate({ version: SAVE_VERSION, dynasty: { seed: 3 } })).toBeNull();
    const noOneAlive = makeSave(createDynasty('estirpe'), null, 1);
    noOneAlive.dynasty.members.forEach((m) => (m.status = 'fallen'));
    expect(migrate(JSON.parse(JSON.stringify(noOneAlive)))).toBeNull();
  });

  it('brings a version 1 save with a life in progress up to date', () => {
    const dynasty = createDynasty('estirpe');
    const world = new World('estirpe', 'headsman', 0, 1).snapshot() as unknown as Record<string, unknown>;
    delete world.inventory;
    delete world.gold;
    world.drops = [{ id: 1001, kind: 'water', x: 3, y: 3 }, { id: 1002, kind: 'food', x: 4, y: 4 }];
    world.taken = [0, 1];
    const old = { version: 1, savedAt: 1, dynasty, life: { memberId: 1, world } };
    const data = migrate(JSON.parse(JSON.stringify(old)))!;
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.life!.world.drops).toEqual([{ id: 1002, kind: 'ration', x: 4, y: 4 }]);
    const restored = World.restore(data.life!.world);
    expect(restored.inventory.items.length).toBeGreaterThan(0);
    expect(restored.gold).toBe(0);
  });
});
