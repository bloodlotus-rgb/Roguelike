import type { BlockDef, Face, Opening } from './jenga.ts';

// Blueprints reserve envelopes; the final voxel meshes are deliberately deferred.
// Every interior connection is explicit and rotates with its host prism.
const E = 0 as Face, S = 1 as Face, W = 2 as Face, N = 3 as Face, Down = 5 as Face;
const cut = (x: number, y: number, z: number, face: Face): Opening => ({ at: [x, y, z], face });

/** A long axial gallery crossing nearly the full width and all floors of one zone. */
export function processionalGallery(length: number, storeys: number): BlockDef {
  if (length < 3 || storeys < 1) throw new Error('Invalid processional gallery dimensions');
  const interior: Opening[] = [];
  const openings: Opening[] = [];
  for (let z = 0; z < storeys; z++) {
    for (let x = 0; x < length - 1; x++) interior.push(cut(x, 0, z, E));
    openings.push(cut(0, 0, z, N), cut(Math.floor(length / 2), 0, z, S), cut(length - 1, 0, z, N));
    if (z < storeys - 1) interior.push(cut(0, 0, z, Down), cut(length - 1, 0, z, Down));
  }
  return { id: `processional-${length}x${storeys}`, kind: 'macro',
    size: [length, 1, storeys], interior, openings, weight: 0, openable: true };
}

/** Multi-storey atrium with perimeter galleries and a continuous empty central volume. */
export function monumentalAtrium(side: number, storeys: number): BlockDef {
  if (side < 4 || storeys < 2) throw new Error('Invalid monumental atrium dimensions');
  const interior: Opening[] = [], openings: Opening[] = [];
  const voidCells: Array<[number, number, number]> = [];
  const rim = (x: number, y: number) => x === 0 || y === 0 || x === side - 1 || y === side - 1;
  for (let z = 0; z < storeys; z++) {
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      if (!rim(x, y)) { voidCells.push([x, y, z]); continue; }
      if (x + 1 < side && rim(x + 1, y)) interior.push(cut(x, y, z, E));
      if (y + 1 < side && rim(x, y + 1)) interior.push(cut(x, y, z, S));
    }
    if (z < storeys - 1) interior.push(cut(0, 0, z, Down), cut(side - 1, side - 1, z, Down));
    if (z === 0 || z === storeys - 1) {
      const mid = Math.floor(side / 2);
      openings.push(cut(0, mid, z, W), cut(side - 1, mid, z, E),
        cut(mid, 0, z, N), cut(mid, side - 1, z, S));
    }
  }
  return { id: `atrium-${side}x${storeys}`, kind: 'macro',
    size: [side, side, storeys], interior, openings, voidCells, weight: 0, openable: true };
}
