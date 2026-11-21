/**
 * The backpack: a grid of cells where every item has a shape. Items can be turned; what
 * matters more takes up more room. Pure logic, no drawing.
 */

export type ItemKind =
  | 'ration'
  | 'marchRation'
  | 'waterskin'
  | 'oil'
  | 'firewood'
  | 'bandage'
  | 'mushroom'
  | 'horrorMeat'
  | 'campKit'
  | 'torch'
  | 'chalk'
  | 'planks'
  | 'rope';

export interface ItemDef {
  /** Cells across and down, unturned. */
  w: number;
  h: number;
  /** Uses before it is spent (a waterskin's sips). Items without it are used up at once. */
  charges?: number;
  /** Can be used while walking (otherwise you stop for a moment). */
  onTheMove?: boolean;
  /** Only by the fire: eating, drinking, cooking, dressing wounds. */
  campOnly?: boolean;
  /** How many fit in one place, piled up (small things only). */
  stack?: number;
}

export const ITEMS: Record<ItemKind, ItemDef> = {
  ration: { w: 1, h: 1, campOnly: true, stack: 4 },
  marchRation: { w: 1, h: 2, onTheMove: true, stack: 2 },
  waterskin: { w: 1, h: 2, charges: 4, campOnly: true },
  oil: { w: 1, h: 1, stack: 3 },
  firewood: { w: 2, h: 1, campOnly: true, stack: 3 },
  bandage: { w: 1, h: 1, campOnly: true, stack: 4 },
  mushroom: { w: 1, h: 1, campOnly: true },
  horrorMeat: { w: 1, h: 2, campOnly: true },
  campKit: { w: 2, h: 3 },
  torch: { w: 1, h: 2, stack: 2 },
  chalk: { w: 1, h: 1, charges: 5 },
  planks: { w: 1, h: 3 },
  rope: { w: 2, h: 2 },
};

export const ITEM_KINDS = Object.keys(ITEMS) as ItemKind[];

export interface Packed {
  uid: number;
  kind: ItemKind;
  /** Top-left cell. */
  x: number;
  y: number;
  turned: boolean;
  /** Uses left, for items that have them. */
  charges?: number;
  /** A waterskin filled from a drip: drink it boiled. */
  turbid?: boolean;
  /** A mushroom that will make you sick (Wits can tell). */
  poison?: boolean;
  /** How many are piled here (1 when absent). */
  count?: number;
}

export interface Inventory {
  cols: number;
  rows: number;
  items: Packed[];
  nextUid: number;
}

/** The backpack's size. */
export const PACK = { cols: 6, rows: 5 };

export function emptyInventory(cols = PACK.cols, rows = PACK.rows): Inventory {
  return { cols, rows, items: [], nextUid: 1 };
}

/** A backpack from an older save grows to the current size; what is in it stays put. */
export function enlarged(inv: Inventory): Inventory {
  return { ...inv, cols: Math.max(inv.cols, PACK.cols), rows: Math.max(inv.rows, PACK.rows) };
}

/** How many are piled in one place. */
export function countIn(item: Packed): number {
  return item.count ?? 1;
}

/** Width and height an item takes, turned or not. */
export function footprint(kind: ItemKind, turned: boolean): { w: number; h: number } {
  const def = ITEMS[kind];
  return turned ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

/** Which item occupies a cell, if any. */
export function itemAt(inv: Inventory, x: number, y: number): Packed | undefined {
  return inv.items.find((it) => {
    const { w, h } = footprint(it.kind, it.turned);
    return x >= it.x && x < it.x + w && y >= it.y && y < it.y + h;
  });
}

/** Whether an item fits at a cell, ignoring one item (the one being moved). */
export function fits(inv: Inventory, kind: ItemKind, x: number, y: number, turned: boolean, ignore = -1): boolean {
  const { w, h } = footprint(kind, turned);
  if (x < 0 || y < 0 || x + w > inv.cols || y + h > inv.rows) return false;
  for (let cy = y; cy < y + h; cy++) {
    for (let cx = x; cx < x + w; cx++) {
      const other = itemAt(inv, cx, cy);
      if (other && other.uid !== ignore) return false;
    }
  }
  return true;
}

/** The first free place for an item, scanning rows, trying it upright and then turned. */
export function findSpot(inv: Inventory, kind: ItemKind): { x: number; y: number; turned: boolean } | null {
  for (const turned of [false, true]) {
    for (let y = 0; y < inv.rows; y++) {
      for (let x = 0; x < inv.cols; x++) {
        if (fits(inv, kind, x, y, turned)) return { x, y, turned };
      }
    }
  }
  return null;
}

/** Puts an item wherever it fits. Returns it, or null when there is no room. */
export function addItem(
  inv: Inventory,
  kind: ItemKind,
  charges = ITEMS[kind].charges,
  extra: Pick<Packed, 'turbid' | 'poison'> = {},
): Packed | null {
  // Small things go onto a pile of the same, if there is one with room.
  const max = ITEMS[kind].stack ?? 1;
  if (max > 1 && charges === undefined) {
    const pile = inv.items.find((it) => it.kind === kind && countIn(it) < max);
    if (pile) {
      pile.count = countIn(pile) + 1;
      return pile;
    }
  }
  const spot = findSpot(inv, kind);
  if (!spot) return null;
  const item: Packed = { uid: inv.nextUid++, kind, ...spot, ...extra };
  if (charges !== undefined) item.charges = charges;
  inv.items.push(item);
  return item;
}

/** Takes one out (from the top of a pile, or the item itself). Returns what was taken. */
export function removeItem(inv: Inventory, uid: number): Packed | null {
  const index = inv.items.findIndex((it) => it.uid === uid);
  if (index < 0) return null;
  const item = inv.items[index];
  if (countIn(item) > 1) {
    item.count = countIn(item) - 1;
    return { ...item, count: 1 };
  }
  return inv.items.splice(index, 1)[0];
}

/** Takes out a whole pile at once. */
export function removeStack(inv: Inventory, uid: number): Packed | null {
  const index = inv.items.findIndex((it) => it.uid === uid);
  return index < 0 ? null : inv.items.splice(index, 1)[0];
}

/** Moves (and maybe turns) an item to a cell, if it fits there. */
export function moveItem(inv: Inventory, uid: number, x: number, y: number, turned: boolean): boolean {
  const item = inv.items.find((it) => it.uid === uid);
  if (!item || !fits(inv, item.kind, x, y, turned, uid)) return false;
  item.x = x;
  item.y = y;
  item.turned = turned;
  return true;
}

/** Turns an item in place, or as close to it as it fits. */
export function turnItem(inv: Inventory, uid: number): boolean {
  const item = inv.items.find((it) => it.uid === uid);
  if (!item) return false;
  const turned = !item.turned;
  if (fits(inv, item.kind, item.x, item.y, turned, uid)) return moveItem(inv, uid, item.x, item.y, turned);
  for (let y = 0; y < inv.rows; y++) {
    for (let x = 0; x < inv.cols; x++) {
      if (fits(inv, item.kind, x, y, turned, uid)) return moveItem(inv, uid, x, y, turned);
    }
  }
  return false;
}

export function countOf(inv: Inventory, kind: ItemKind): number {
  return inv.items.filter((it) => it.kind === kind).reduce((n, it) => n + countIn(it), 0);
}

/** What each new life carries down from the mansion (until the shop exists). */
export function starterKit(): Inventory {
  const inv = emptyInventory();
  addItem(inv, 'campKit');
  addItem(inv, 'waterskin');
  addItem(inv, 'firewood');
  addItem(inv, 'ration');
  addItem(inv, 'ration');
  addItem(inv, 'marchRation');
  addItem(inv, 'oil');
  return inv;
}
