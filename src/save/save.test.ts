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

  it('sets aside saves from before the levels were stacked', () => {
    const old = { ...makeSave(createDynasty('estirpe'), null, 1), version: 4 };
    expect(migrate(JSON.parse(JSON.stringify(old)))).toBeNull();
  });

});
