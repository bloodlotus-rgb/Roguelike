/**
 * Small 3D models for the things in a level: fountains, drips, remains, crates, camps,
 * torches and everything that lies on the floor. Built from a few simple shapes, so they
 * catch the flame's light and shadows and take the ink shading like the walls do.
 *
 * Models are one unit = one tile, standing on y = 0, centred on the origin. The renderer
 * supplies the materials, already dressed in ink.
 */
import * as THREE from 'three';
import type { FeatureKind, LootKind } from '../core/dungeon';

export interface ModelMaterials {
  stone: THREE.Material;
  wood: THREE.Material;
  cloth: THREE.Material;
  bone: THREE.Material;
  metal: THREE.Material;
  water: THREE.Material;
  flesh: THREE.Material;
  gold: THREE.Material;
  paper: THREE.Material;
  /** Solid ink (no light): pits, the dark inside of things. */
  ink: THREE.Material;
  /** Back faces in solid ink: a slightly larger shell around a shape draws its outline. */
  hull: THREE.Material;
}

/**
 * Pen outlines: every part gets a shell a little larger than itself, seen from inside, in
 * solid ink. Thin parts get a proportionally thicker shell so their line still shows.
 */
export function outlined(group: THREE.Group, m: ModelMaterials, line = 0.012): THREE.Group {
  for (const mesh of [...group.children]) {
    if (!(mesh instanceof THREE.Mesh) || mesh.material === m.ink) continue;
    mesh.geometry.computeBoundingSphere();
    const r = mesh.geometry.boundingSphere?.radius ?? 0.1;
    const shell = new THREE.Mesh(mesh.geometry, m.hull);
    shell.position.copy(mesh.position);
    shell.rotation.copy(mesh.rotation);
    shell.scale.copy(mesh.scale).multiplyScalar(1 + line / Math.max(0.02, r));
    group.add(shell);
  }
  return group;
}

type Parts = THREE.Group;

function part(group: Parts, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** Fixed places of a level. `spent`: a searched container. */
export function featureModel(kind: FeatureKind, m: ModelMaterials, spent = false): Parts {
  const g = new THREE.Group();
  if (kind === 'fountain') {
    // A round stone basin on a foot, a spout rising from it, still water inside.
    part(g, cyl(0.28, 0.32, 0.16, 14), m.stone, 0, 0.08);
    const basin = new THREE.LatheGeometry(
      [new THREE.Vector2(0.18, 0), new THREE.Vector2(0.4, 0.04), new THREE.Vector2(0.44, 0.22), new THREE.Vector2(0.38, 0.24), new THREE.Vector2(0.34, 0.06), new THREE.Vector2(0, 0.06)],
      16,
    );
    part(g, basin, m.stone, 0, 0.14);
    part(g, cyl(0.34, 0.34, 0.02, 16), m.water, 0, 0.33);
    part(g, cyl(0.06, 0.08, 0.5, 8), m.stone, 0, 0.55);
    part(g, box(0.18, 0.06, 0.06), m.stone, 0.07, 0.78);
  } else if (kind === 'drip') {
    // A dark puddle under a little column of mineral; drops on the way down.
    part(g, cyl(0.36, 0.38, 0.015, 14), m.water, 0, 0.008);
    part(g, new THREE.ConeGeometry(0.08, 0.22, 7), m.stone, 0.12, 0.11, -0.08);
    for (const y of [0.45, 0.75, 1.05]) part(g, new THREE.SphereGeometry(0.025, 6, 5), m.water, -0.05, y, 0.04);
  } else if (kind === 'crate') {
    part(g, box(0.56, 0.42, 0.46), m.wood, 0, 0.21);
    // Slats and a cross brace on the side facing out.
    for (const y of [0.12, 0.3]) part(g, box(0.6, 0.05, 0.5), m.wood, 0, y);
    if (spent) {
      part(g, box(0.5, 0.02, 0.4), m.ink, 0, 0.425);
      part(g, box(0.6, 0.04, 0.5), m.wood, 0.42, 0.24, 0, 0, 0.3, 1.2);
    } else part(g, box(0.62, 0.05, 0.52), m.wood, 0, 0.44);
  } else {
    // An explorer's remains: a skull, ribs and long bones, and (until searched) a pack.
    part(g, new THREE.SphereGeometry(0.1, 10, 8), m.bone, -0.16, 0.09, 0.05);
    part(g, box(0.06, 0.04, 0.05), m.ink, -0.13, 0.1, 0.13);
    for (let i = 0; i < 4; i++) part(g, new THREE.TorusGeometry(0.08, 0.012, 5, 10, Math.PI), m.bone, 0.02 + i * 0.05, 0.03, -0.02, Math.PI / 2, 0, 0);
    part(g, cyl(0.018, 0.018, 0.38, 6), m.bone, 0.12, 0.02, 0.16, 0, 0.6, Math.PI / 2);
    part(g, cyl(0.018, 0.018, 0.34, 6), m.bone, 0.05, 0.02, 0.24, 0, -0.3, Math.PI / 2);
    if (!spent) {
      part(g, box(0.24, 0.2, 0.14), m.cloth, 0.22, 0.1, -0.18, 0, 0.4, 0.1);
      part(g, new THREE.TorusGeometry(0.06, 0.012, 5, 10, Math.PI), m.cloth, 0.22, 0.2, -0.18, 0, 0.4, 0);
    }
  }
  return g;
}

/** A family camp: a bedroll, a ring of stones and crossed logs. The flame is drawn apart. */
export function campModel(m: ModelMaterials): Parts {
  const g = new THREE.Group();
  part(g, box(0.3, 0.06, 0.62), m.cloth, -0.24, 0.03, 0.05);
  part(g, cyl(0.07, 0.07, 0.3, 10), m.cloth, -0.24, 0.08, -0.25, 0, 0, Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    part(g, new THREE.IcosahedronGeometry(0.05, 0), m.stone, 0.2 + Math.cos(a) * 0.15, 0.035, 0.05 + Math.sin(a) * 0.15, a, a * 2, 0);
  }
  part(g, cyl(0.025, 0.025, 0.28, 6), m.wood, 0.2, 0.05, 0.05, 0, 0.6, Math.PI / 2.4);
  part(g, cyl(0.025, 0.025, 0.28, 6), m.wood, 0.2, 0.05, 0.05, 0, -0.6, -Math.PI / 2.4);
  return g;
}

/** A torch on its stand. The flame is drawn apart. Returns the model and the flame's height. */
export function torchModel(m: ModelMaterials): Parts {
  const g = new THREE.Group();
  part(g, cyl(0.1, 0.13, 0.05, 8), m.stone, 0, 0.025);
  part(g, cyl(0.025, 0.03, 0.9, 6), m.wood, 0, 0.47);
  part(g, cyl(0.06, 0.04, 0.12, 8), m.metal, 0, 0.96);
  return g;
}

/**
 * One tile of bridge over a chasm, walked along x: planks across two beams. An old bridge
 * of the dungeon has posts and a rope rail; one the family laid is just planks, unevenly
 * cut. `seed` varies the planks from tile to tile.
 */
export function bridgeModel(m: ModelMaterials, old: boolean, seed: number): Parts {
  const g = new THREE.Group();
  const wobble = (k: number) => Math.sin(seed * 12.9898 + k * 78.233) * 0.5;
  for (const z of [-0.36, 0.36]) part(g, box(1.02, 0.08, 0.08), m.wood, 0, -0.07, z);
  for (let i = 0; i < 6; i++) {
    const len = old ? 0.96 : 0.84 + wobble(i) * 0.14;
    part(g, box(0.15, 0.04, len), m.wood, -0.42 + i * 0.168, -0.01, old ? 0 : wobble(i + 9) * 0.05, 0, old ? 0 : wobble(i + 3) * 0.12, 0);
  }
  if (old) {
    for (const z of [-0.47, 0.47]) {
      part(g, cyl(0.03, 0.035, 0.72, 6), m.wood, -0.44, 0.31, z);
      part(g, cyl(0.012, 0.012, 1.02, 5), m.cloth, 0, 0.6, z, 0, 0, Math.PI / 2);
    }
  }
  return g;
}

/**
 * A collapse filling a corridor: a mound of fallen blocks up to the ceiling's height, with
 * a broken beam through it. `seed` shapes the pile.
 */
export function rubbleModel(m: ModelMaterials, seed: number): Parts {
  const g = new THREE.Group();
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  // A steep heap, wide at the foot, nearly to the ceiling.
  const layers = [9, 7, 5, 3];
  layers.forEach((count, layer) => {
    for (let i = 0; i < count; i++) {
      const size = 0.2 + r() * 0.14 - layer * 0.025;
      const spread = 0.4 - layer * 0.08;
      part(g, new THREE.IcosahedronGeometry(size, 0), m.stone, (r() - 0.5) * 2 * spread, 0.15 + layer * 0.36 + r() * 0.08, (r() - 0.5) * 2 * spread, r() * 3, r() * 3, r() * 3);
    }
  });
  part(g, box(1.1, 0.09, 0.11), m.wood, 0.05, 0.75, 0.08, 0.3, 0.5, 0.55);
  // Grit spilling out on both sides.
  for (let i = 0; i < 10; i++) part(g, new THREE.IcosahedronGeometry(0.04 + r() * 0.04, 0), m.stone, (r() - 0.5) * 1.1, 0.03, (r() - 0.5) * 1.1);
  return g;
}

/** Height of a standing torch's flame. */
export const TORCH_FLAME = 1.08;

/** What lies on the floor, small and close to the ground. */
export function lootModel(kind: LootKind, m: ModelMaterials): Parts {
  const g = new THREE.Group();
  switch (kind) {
    case 'ration':
      part(g, box(0.2, 0.08, 0.14), m.cloth, 0, 0.04, 0, 0, 0.3);
      part(g, box(0.21, 0.02, 0.04), m.wood, 0, 0.08, 0, 0, 0.3);
      break;
    case 'marchRation':
      part(g, box(0.26, 0.1, 0.16), m.cloth, 0, 0.05, 0, 0, -0.4);
      part(g, box(0.04, 0.11, 0.17), m.wood, 0, 0.055, 0, 0, -0.4);
      break;
    case 'waterskin':
      part(g, new THREE.SphereGeometry(0.12, 10, 8), m.cloth, 0, 0.09, 0).scale.set(1, 0.7, 1.3);
      part(g, cyl(0.03, 0.04, 0.08, 6), m.wood, 0, 0.12, 0.17, Math.PI / 2.5);
      break;
    case 'oil':
      part(g, new THREE.SphereGeometry(0.09, 10, 8), m.metal, 0, 0.09, 0);
      part(g, cyl(0.03, 0.04, 0.1, 8), m.metal, 0, 0.2, 0);
      break;
    case 'gold':
      for (const [x, z, y] of [[0, 0, 0.012], [0.08, 0.04, 0.012], [0.03, -0.06, 0.012], [0.04, 0.01, 0.034]]) {
        part(g, cyl(0.05, 0.05, 0.02, 12), m.gold, x, y, z);
      }
      break;
    case 'firewood':
      part(g, cyl(0.04, 0.045, 0.34, 7), m.wood, 0, 0.045, 0, 0, 0.3, Math.PI / 2);
      part(g, cyl(0.04, 0.045, 0.32, 7), m.wood, 0.02, 0.12, 0.02, 0, -0.2, Math.PI / 2);
      break;
    case 'bandage':
      part(g, cyl(0.07, 0.07, 0.08, 12), m.paper, 0, 0.04, 0, 0, 0, 0);
      break;
    case 'mushroom':
      for (const [x, z, h] of [[0, 0, 0.12], [0.08, 0.05, 0.08]]) {
        part(g, cyl(0.018, 0.022, h, 6), m.paper, x, h / 2, z);
        part(g, new THREE.SphereGeometry(0.05, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), m.flesh, x, h, z);
      }
      break;
    case 'horrorMeat':
      part(g, new THREE.IcosahedronGeometry(0.11, 1), m.flesh, 0, 0.07, 0).scale.set(1.3, 0.6, 1);
      break;
    case 'campKit':
      part(g, cyl(0.08, 0.08, 0.36, 10), m.cloth, 0, 0.08, 0, 0, 0.4, Math.PI / 2);
      for (const z of [-0.05, 0.05]) part(g, cyl(0.012, 0.012, 0.4, 5), m.wood, 0, 0.17, z, 0, 0.4, Math.PI / 2);
      break;
    case 'torch':
      part(g, cyl(0.025, 0.03, 0.4, 6), m.wood, 0, 0.03, 0, 0, 0.5, Math.PI / 2);
      part(g, cyl(0.045, 0.035, 0.08, 7), m.metal, 0.17, 0.035, -0.1, 0, 0.5, Math.PI / 2);
      break;
    case 'chalk':
      part(g, box(0.1, 0.04, 0.04), m.paper, 0, 0.02, 0, 0, 0.7);
      break;
    case 'planks':
      for (const [y, a] of [[0.015, 0.1], [0.045, -0.15], [0.075, 0.05]]) part(g, box(0.5, 0.03, 0.09), m.wood, 0, y, 0, 0, a);
      break;
    case 'rope':
      for (const [r, y] of [[0.12, 0.015], [0.09, 0.04], [0.06, 0.065]]) {
        part(g, new THREE.TorusGeometry(r, 0.02, 5, 14), m.wood, 0, y, 0, Math.PI / 2);
      }
      break;
    case 'key':
      // A big iron key: a ring, a shank and a bit with teeth, lying flat.
      part(g, new THREE.TorusGeometry(0.06, 0.016, 6, 14), m.metal, -0.12, 0.016, 0, Math.PI / 2);
      part(g, cyl(0.014, 0.014, 0.2, 6), m.metal, 0.02, 0.016, 0, 0, 0, Math.PI / 2);
      part(g, box(0.04, 0.02, 0.06), m.metal, 0.11, 0.016, 0.03);
      part(g, box(0.02, 0.02, 0.04), m.metal, 0.08, 0.016, 0.03);
      break;
  }
  return g;
}
