import { describe, expect, it } from 'vitest';
import { addItem, countOf, emptyInventory, enlarged, findSpot, fits, itemAt, moveItem, removeItem, removeStack, starterKit, turnItem } from './inventory';

describe('backpack', () => {
  it('places items where they fit and refuses when full', () => {
    const inv = emptyInventory(2, 2);
    expect(addItem(inv, 'waterskin')).not.toBeNull();
    expect(addItem(inv, 'waterskin')).not.toBeNull();
    expect(addItem(inv, 'ration')).toBeNull();
    expect(inv.items.length).toBe(2);
  });

  it('turns an item to make it fit', () => {
    const inv = emptyInventory(2, 1);
    const skin = addItem(inv, 'waterskin');
    expect(skin?.turned).toBe(true);
    expect(itemAt(inv, 1, 0)?.uid).toBe(skin?.uid);
  });

  it('moves and turns items without overlapping others', () => {
    const inv = emptyInventory(3, 2);
    const a = addItem(inv, 'waterskin')!;
    const b = addItem(inv, 'ration')!;
    expect(fits(inv, 'ration', a.x, a.y, false)).toBe(false);
    expect(moveItem(inv, b.uid, 2, 1, false)).toBe(true);
    expect(turnItem(inv, a.uid)).toBe(true);
    expect(a.turned).toBe(true);
    expect(removeItem(inv, b.uid)?.kind).toBe('ration');
    expect(findSpot(inv, 'waterskin')).not.toBeNull();
  });

  it('waterskins keep their sips', () => {
    const inv = starterKit();
    const skin = inv.items.find((it) => it.kind === 'waterskin');
    expect(skin?.charges).toBe(4);
    // The two rations share one pile.
    expect(inv.items.length).toBe(6);
    expect(countOf(inv, 'ration')).toBe(2);
  });

  it('small things pile up in one place, up to a limit, and come off one at a time', () => {
    const inv = emptyInventory();
    for (let i = 0; i < 5; i++) addItem(inv, 'ration');
    const piles = inv.items.filter((it) => it.kind === 'ration');
    expect(piles.map((p) => p.count ?? 1).sort()).toEqual([1, 4]);
    const big = piles.find((p) => p.count === 4)!;
    expect(removeItem(inv, big.uid)?.count).toBe(1);
    expect(big.count).toBe(3);
    expect(removeStack(inv, big.uid)?.count).toBe(3);
    expect(countOf(inv, 'ration')).toBe(1);
    // Waterskins and planks never pile.
    addItem(inv, 'waterskin');
    addItem(inv, 'waterskin');
    expect(inv.items.filter((it) => it.kind === 'waterskin').length).toBe(2);
  });

  it('a backpack from an older save grows to the current size', () => {
    const old = { cols: 5, rows: 4, items: [], nextUid: 1 };
    expect(enlarged(old)).toMatchObject({ cols: 6, rows: 5 });
  });
});
