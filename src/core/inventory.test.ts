import { describe, expect, it } from 'vitest';
import { addItem, emptyInventory, findSpot, fits, itemAt, moveItem, removeItem, starterKit, turnItem } from './inventory';

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
    expect(inv.items.length).toBe(7);
  });
});
