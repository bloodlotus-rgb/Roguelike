/**
 * Experimental 3D renderer: one dungeon, two cameras.
 *
 * The level is built in 3D from the grid (walls as blocks, floor and ceiling as quads with
 * ink textures). The hero's flame is a spot light shaped like the vision cone, with real
 * shadows, so walls and loot can be half lit. Characters and items are flat cut-outs with
 * the same animated drawings as the top view. The top camera looks down at about 55°; the
 * first-person camera sits at eye height.
 *
 * Pure presentation: it reads the world and never changes it.
 */
import * as THREE from 'three';
import type { Level, Point } from '../core/dungeon';
import { isFloor } from '../core/dungeon';
import { Rng } from '../core/rng';
import type { EnemyKind } from '../core/enemies';
import { COMBAT, type Enemy, type World, type WorldEvent } from '../core/world';
import { drawFloorDecor, drawItem, drawProjectile } from './art';
import { wallColor, wallRelief } from './inkTextures3d';
import { easeInOut, easeOut, swingPhase } from './swing';
import { Effects } from './threeEffects';
import { drawHands, inkTexture } from './firstPerson';
import { drawEnemySheet, drawHeroSheet, ENEMY_SIZE, FLAME_ANCHOR, HERO_SIZE, type SpriteSheet } from './sprites';

export type CameraMode = 'top' | 'first';

const EYE = 1.15;
const WALL_FIRST = 2.2;
/** From above the walls stand tall too; the ones between the camera and the hero fade out. */
const WALL_TOP = 1.6;
const TOP_TILT = (55 * Math.PI) / 180;
/** Tiles visible across the shortest side of the screen in the top view. */
const TOP_TILES = 9.5;
/** In the top view the light hangs above everyone's heads so tall cut-outs are lit whole. */
const FLAME_HEIGHT = 2.3;
const UP = new THREE.Vector3(0, 1, 0);

/** Eye designs per horror: height above the feet and dots (design units, 32 per tile). */
const EYES: Record<EnemyKind, { h: number; dots: Array<[number, number, number]> }> = {
  crawler: { h: 7.5, dots: [[-3.5, 0.3, 1.1], [-1, -0.4, 0.9], [3.5, 0.3, 1.1]] },
  husk: { h: 39.7, dots: [[-10.5, 0, 1.4]] },
  mourner: { h: 39.8, dots: [[-1.6, 0, 0.9], [1.6, 0, 0.9]] },
  snuffer: { h: 42.3, dots: [[-1.5, 0, 0.7], [1.5, 0, 0.7]] },
};

function repeating(texture: THREE.Texture): THREE.Texture & THREE.CanvasTexture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture as THREE.CanvasTexture;
}

function canvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Shared by the wall materials: whether to cut walls away, and where the hero stands. */
const cutaway = { fade: { value: 0 }, player: { value: new THREE.Vector3() } };

/**
 * Our ink look on lit surfaces, plus the cut-away for the top view.
 *
 * Hatching: where the flame's light thins out, diagonal ink lines appear, then cross-
 * hatching, like a hand-shaded drawing. Lines live in world space so they stay put when
 * the camera moves; floors use the ground plane, walls their own face.
 *
 * Cut-away (walls only): walls on the camera's side of the hero (south of them) are cut
 * at knee height, like a scale model, so rooms and corridors stay readable. Shadows are
 * unaffected.
 */
interface InkOptions {
  /** Cut away walls between the camera and the hero (top view). */
  cut?: boolean;
  /**
   * Texture coordinates from the world instead of the mesh, so walls tile seamlessly
   * across blocks: 'box' for block faces, 'column' for round columns.
   */
  worldUv?: 'box' | 'column';
  /** Darken toward the floor, where grime gathers. */
  grime?: boolean;
}

function inkMaterial(material: THREE.MeshLambertMaterial, options: InkOptions = {}): THREE.MeshLambertMaterial {
  const { cut = false, worldUv, grime = false } = options;
  const uvCode =
    worldUv === 'box'
      ? `vec2 inkUv = abs(vInkNormal.y) > 0.5 ? vInkPos.xz : vec2(abs(vInkNormal.x) > 0.5 ? vInkPos.z : vInkPos.x, vInkPos.y);`
      : worldUv === 'column'
        ? `vec3 inkCenter = vec3(0.0);
           #ifdef USE_INSTANCING
             inkCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
           #endif
           vec2 inkUv = vec2(atan(vInkPos.z - inkCenter.z, vInkPos.x - inkCenter.x) * 0.36, vInkPos.y);`
        : '';
  const uvAssign = worldUv
    ? `${uvCode}
        inkUv.y = -inkUv.y;
        #ifdef USE_MAP
          vMapUv = inkUv;
        #endif
        #ifdef USE_BUMPMAP
          vBumpMapUv = inkUv;
        #endif`
    : '';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFade = cutaway.fade;
    shader.uniforms.uPlayer = cutaway.player;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vInkPos;\nvarying vec3 vInkNormal;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 inkWorld = vec4(transformed, 1.0);
        mat3 inkBasis = mat3(1.0);
        #ifdef USE_INSTANCING
          inkWorld = instanceMatrix * inkWorld;
          inkBasis = mat3(instanceMatrix);
        #endif
        vInkPos = (modelMatrix * inkWorld).xyz;
        vInkNormal = normalize(mat3(modelMatrix) * inkBasis * objectNormal);
        ${uvAssign}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uFade;\nuniform vec3 uPlayer;\nvarying vec3 vInkPos;\nvarying vec3 vInkNormal;',
      )
      .replace(
        '#include <map_fragment>',
        grime
          ? `#include <map_fragment>
        diffuseColor.rgb *= 1.0 - 0.45 * smoothstep(0.7, 0.0, vInkPos.y);`
          : '#include <map_fragment>',
      )
      .replace(
        '#include <clipping_planes_fragment>',
        cut
          ? `#include <clipping_planes_fragment>
        if (uFade > 0.5) {
          float south = vInkPos.z - uPlayer.z;
          float side = abs(vInkPos.x - uPlayer.x);
          if (south > -0.15 && vInkPos.y > 0.3 && side < 7.0) discard;
        }`
          : '#include <clipping_planes_fragment>',
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 irradiance = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
          float base = max(dot(diffuseColor.rgb, vec3(0.3333)), 0.05);
          // Lambert divides by pi; undo it so 1.0 means fully lit.
          float lit = dot(irradiance, vec3(0.3333)) / base * 3.14159;
          vec3 n = normalize(vInkNormal);
          vec2 hp = abs(n.y) > 0.5 ? vInkPos.xz : vec2(abs(n.x) > 0.5 ? vInkPos.z : vInkPos.x, vInkPos.y);
          hp *= 7.0;
          float d1 = abs(fract(hp.x + hp.y) - 0.5);
          float d2 = abs(fract(hp.x - hp.y) - 0.5);
          float tone = clamp(1.0 - lit, 0.0, 1.0);
          float ink = max(step(d1, smoothstep(0.35, 1.0, tone) * 0.22), step(d2, smoothstep(0.7, 1.0, tone) * 0.16));
          ink *= step(0.015, lit);
          outgoingLight = mix(outgoingLight, outgoingLight * 0.2, ink);
        }
        #include <opaque_fragment>`,
      );
  };
  return material;
}

/** A flat cut-out standing on the floor, facing the camera, lit like the floor under it. */
class Cutout {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
  private readonly uv: THREE.BufferAttribute;
  private frameIndex = -1;
  private flipped = false;

  constructor(
    private readonly sheet: SpriteSheet,
    material: THREE.Material,
    heightTiles: number,
  ) {
    const aspect = sheet.frameWidth / sheet.frameHeight;
    const h = heightTiles;
    const w = h * aspect;
    const geometry = new THREE.PlaneGeometry(w, h);
    // Feet at the origin.
    geometry.translate((0.5 - sheet.originX) * w, -(h / 2 - sheet.originY * h), 0);
    this.uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.setFrame(0);
  }

  /** Picks the frame; flipping mirrors the texture, so the lit front face stays in front. */
  setFrame(index: number, flip = this.flipped): void {
    if (index === this.frameIndex && flip === this.flipped) return;
    this.frameIndex = index;
    this.flipped = flip;
    const n = this.sheet.frames.length;
    let u0 = index / n;
    let u1 = (index + 1) / n;
    if (flip) [u0, u1] = [u1, u0];
    // PlaneGeometry corners: top-left, top-right, bottom-left, bottom-right.
    this.uv.setXY(0, u0, 1);
    this.uv.setXY(1, u1, 1);
    this.uv.setXY(2, u0, 0);
    this.uv.setXY(3, u1, 0);
    this.uv.needsUpdate = true;
  }

  /**
   * From above the cut-out stands upright, turned toward the camera and stretched so it
   * keeps its drawn proportions; in first person it simply faces the camera.
   */
  place(pos: Point, camera: THREE.Camera, flip: boolean, mode: CameraMode): void {
    this.mesh.position.set(pos.x, 0, pos.y);
    if (mode === 'top') {
      this.mesh.rotation.set(0, Math.atan2(camera.position.x - pos.x, camera.position.z - pos.y), 0);
      this.mesh.scale.set(1, 1 / Math.cos(TOP_TILT), 1);
    } else {
      this.mesh.quaternion.copy(camera.quaternion);
      this.mesh.scale.set(1, 1, 1);
    }
    if (flip !== this.flipped) this.setFrame(this.frameIndex, flip);
  }

  /** Brightness from the game's own rule of sight, warmed by the flame. */
  shade(material: THREE.MeshBasicMaterial, brightness: number, red = 0): void {
    const b = Math.max(0, Math.min(1, brightness));
    material.color.setRGB(b * (1 - red * 0.2), b * 0.86 * (1 - red * 0.75), b * 0.66 * (1 - red * 0.8));
  }
}

function sheetFromCanvas(canvas: HTMLCanvasElement): SpriteSheet {
  return { canvas, frameWidth: canvas.width, frameHeight: canvas.height, frames: ['only'], originX: 0.5, originY: 0.9 };
}

function eyesCanvas(kind: EnemyKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ece2cb';
  ctx.strokeStyle = '#ece2cb';
  const scale = 3;
  for (const [dx, dy, r] of EYES[kind].dots) {
    const x = 32 + dx * scale;
    const y = 16 + dy * scale;
    if (kind === 'mourner') {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + (dx < 0 ? 3 : -3), y - 1);
      ctx.lineTo(x + (dx < 0 ? -4 : 4), y + 3);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

function flameCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 48;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 34, 0, 16, 34, 16);
  g.addColorStop(0, 'rgba(255, 210, 140, 0.6)');
  g.addColorStop(1, 'rgba(255, 190, 110, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 48);
  ctx.fillStyle = '#d9822b';
  ctx.beginPath();
  ctx.moveTo(10, 40);
  ctx.quadraticCurveTo(16, 6, 22, 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f6dc9c';
  ctx.beginPath();
  ctx.moveTo(13, 40);
  ctx.quadraticCurveTo(16, 20, 19, 40);
  ctx.closePath();
  ctx.fill();
  return c;
}

export class ThreeView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 80);
  private readonly light: THREE.SpotLight;
  private readonly hands: HTMLCanvasElement;
  private readonly handsCtx: CanvasRenderingContext2D;
  private mode: CameraMode = 'top';
  private level: Level | null = null;
  private levelGroup = new THREE.Group();
  private walls: THREE.InstancedMesh | null = null;
  private wallTiles: Array<[number, number]> = [];
  private columns: THREE.InstancedMesh | null = null;
  private columnTiles: Array<[number, number]> = [];
  private readonly effects: Effects;
  private lastNow = 0;
  private ceiling: THREE.Mesh | null = null;
  private readonly textures: Record<'wall' | 'floor' | 'ceiling' | 'stairs', THREE.CanvasTexture>;
  private readonly wallRelief = repeating(new THREE.CanvasTexture(wallRelief(512)));
  private readonly enemySheets = new Map<EnemyKind, { sheet: SpriteSheet; texture: THREE.CanvasTexture }>();
  private readonly itemTextures = new Map<string, { sheet: SpriteSheet; texture: THREE.CanvasTexture }>();
  private readonly projectileTexture: { sheet: SpriteSheet; texture: THREE.CanvasTexture };
  private readonly eyeMaterials = new Map<EnemyKind, THREE.SpriteMaterial>();
  private hero: Cutout | null = null;
  private heroClass = '';
  private flame: THREE.Sprite;
  private readonly enemies = new Map<number, { cutout: Cutout; material: THREE.MeshBasicMaterial; eyes: THREE.Sprite }>();
  private readonly items = new Map<number, Cutout>();
  private readonly projectiles = new Map<number, Cutout>();
  private readonly walks = new Map<number, { walked: number; last: Point }>();
  private readonly flashUntil = new Map<number, number>();
  private lightAngle = 0;
  private cameraTarget = new THREE.Vector3();
  private walked = 0;
  private lastPos: Point = { x: 0, y: 0 };
  private width = 0;
  private height = 0;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    // Pure black: unlit geometry is black too, so nothing outside the light shows a silhouette.
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'three-canvas';
    container.appendChild(this.renderer.domElement);
    this.hands = document.createElement('canvas');
    this.hands.className = 'three-hands';
    container.appendChild(this.hands);
    this.handsCtx = this.hands.getContext('2d')!;

    this.scene.add(this.levelGroup);
    this.effects = new Effects(this.scene);
    this.light = new THREE.SpotLight(0xffd6a0, 6, 8, COMBAT.visionCone, 0.06, 1.4);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.bias = -0.0008;
    this.light.shadow.camera.near = 0.1;
    this.scene.add(this.light);
    this.scene.add(this.light.target);

    this.textures = {
      wall: repeating(canvasTexture(wallColor(512))),
      floor: canvasTexture(inkTexture('floor', 256)),
      ceiling: canvasTexture(inkTexture('ceiling', 256)),
      stairs: canvasTexture(inkTexture('stairs', 256)),
    };
    for (const kind of ['crawler', 'husk', 'mourner', 'snuffer'] as const) {
      const sheet = drawEnemySheet(kind, 64);
      this.enemySheets.set(kind, { sheet, texture: canvasTexture(sheet.canvas) });
      const eyes = canvasTexture(eyesCanvas(kind));
      this.eyeMaterials.set(kind, new THREE.SpriteMaterial({ map: eyes, transparent: true, depthWrite: false }));
    }
    for (const kind of ['food', 'water', 'oil'] as const) {
      const sheet = sheetFromCanvas(drawItem(kind, 64));
      this.itemTextures.set(kind, { sheet, texture: canvasTexture(sheet.canvas) });
    }
    const projectile = sheetFromCanvas(drawProjectile(64));
    this.projectileTexture = { sheet: { ...projectile, originY: 0.5 }, texture: canvasTexture(projectile.canvas) };
    this.flame = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: canvasTexture(flameCanvas()), transparent: true, depthWrite: false, depthTest: false }),
    );
    this.flame.renderOrder = 11;
    this.scene.add(this.flame);
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    this.applyWallHeight();
    this.width = 0; // Force a resize: the resolution differs per mode.
  }

  render(world: World, events: WorldEvent[], fpAngle: number, now: number): void {
    if (world.level !== this.level) this.buildLevel(world.level);
    this.ensureHero(world);
    this.resize();
    for (const e of events) {
      if (e.type === 'enemyHit' && !e.burn) this.flashUntil.set(e.id, now + 90);
    }
    const moved = Math.hypot(world.player.x - this.lastPos.x, world.player.y - this.lastPos.y);
    this.lastPos = { ...world.player };
    this.walked += moved;

    const dt = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 0;
    this.lastNow = now;
    this.effects.onEvents(world, events, now, this.mode);

    this.placeCamera(world, fpAngle);
    this.placeLight(world, now, fpAngle);
    this.syncHero(world, now, moved);
    this.effects.update(world, dt, this.camera, this.flame.visible ? this.flame.position : null, this.mode);
    this.syncEnemies(world, now);
    this.syncItems(world);
    this.syncProjectiles(world);
    this.renderer.render(this.scene, this.camera);
    this.drawHandsOverlay(world, now, moved > 0.002);
  }

  // Level -----------------------------------------------------------------------

  private buildLevel(level: Level): void {
    this.level = level;
    this.scene.remove(this.levelGroup);
    this.levelGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    for (const map of [this.items, this.projectiles]) {
      for (const c of map.values()) this.scene.remove(c.mesh);
      map.clear();
    }
    for (const e of this.enemies.values()) {
      this.scene.remove(e.cutout.mesh);
      this.scene.remove(e.eyes);
    }
    this.enemies.clear();

    // Floor and ceiling quads, one per floor tile.
    const floor = this.tileQuads(level, 0, true);
    const floorMesh = new THREE.Mesh(floor, inkMaterial(new THREE.MeshLambertMaterial({ map: this.textures.floor })));
    floorMesh.receiveShadow = true;
    this.levelGroup.add(floorMesh);
    const stairs = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), inkMaterial(new THREE.MeshLambertMaterial({ map: this.textures.stairs })));
    stairs.rotation.x = -Math.PI / 2;
    stairs.position.set(level.stairs.x + 0.5, 0.002, level.stairs.y + 0.5);
    stairs.receiveShadow = true;
    this.levelGroup.add(stairs);
    this.ceiling = new THREE.Mesh(
      this.tileQuads(level, WALL_FIRST, false),
      inkMaterial(new THREE.MeshLambertMaterial({ map: this.textures.ceiling })),
    );
    this.levelGroup.add(this.ceiling);

    // Walls: only the blocks that touch a floor tile.
    this.wallTiles = [];
    this.columnTiles = [];
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (isFloor(level, x, y)) continue;
        let touches = false;
        for (let dy = -1; dy <= 1 && !touches; dy++) for (let dx = -1; dx <= 1; dx++) if (isFloor(level, x + dx, y + dy)) touches = true;
        if (!touches) continue;
        const column = isFloor(level, x - 1, y) && isFloor(level, x + 1, y) && isFloor(level, x, y - 1) && isFloor(level, x, y + 1);
        (column ? this.columnTiles : this.wallTiles).push([x, y]);
      }
    }
    const wallMaterial = () =>
      new THREE.MeshLambertMaterial({ map: this.textures.wall, bumpMap: this.wallRelief, bumpScale: 3 });
    const side = inkMaterial(wallMaterial(), { cut: true, worldUv: 'box', grime: true });
    const top = inkMaterial(new THREE.MeshLambertMaterial({ map: this.textures.ceiling }), { cut: true, worldUv: 'box' });
    const shaft = inkMaterial(wallMaterial(), { cut: true, worldUv: 'column', grime: true });
    // Box faces: +x, -x, +y (top), -y, +z, -z.
    this.walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [side, side, top, top, side, side], this.wallTiles.length);
    this.walls.castShadow = true;
    this.walls.receiveShadow = true;
    this.levelGroup.add(this.walls);
    // Lone wall tiles inside halls are round columns.
    this.columns = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.33, 0.36, 1, 18), [shaft, top, top], this.columnTiles.length);
    this.columns.castShadow = true;
    this.columns.receiveShadow = true;
    this.levelGroup.add(this.columns);
    this.applyWallHeight();

    // Decoration painted on the floor: ink at the foot of the walls, bones, rubble, stains.
    const decorTexture = new THREE.CanvasTexture(drawFloorDecor(level, 32));
    decorTexture.colorSpace = THREE.SRGBColorSpace;
    decorTexture.anisotropy = 8;
    const decor = new THREE.Mesh(
      new THREE.PlaneGeometry(level.width, level.height),
      new THREE.MeshLambertMaterial({ map: decorTexture, transparent: true, depthWrite: false }),
    );
    decor.rotation.x = -Math.PI / 2;
    decor.position.set(level.width / 2, 0.004, level.height / 2);
    decor.receiveShadow = true;
    this.levelGroup.add(decor);
    this.buildDebris(level);
    this.effects.reset();
  }

  /**
   * Rubble, bones and skulls with real volume, so the flame throws their shadows and the
   * hatching shades them. Placement comes from the level seed, on its own stream.
   */
  private buildDebris(level: Level): void {
    const rng = Rng.derive(level.seed, 'debris', level.depth);
    const rocks: THREE.Matrix4[] = [];
    const bones: THREE.Matrix4[] = [];
    const skulls: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const start = level.start;
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (!isFloor(level, x, y)) continue;
        if (Math.abs(x - start.x) + Math.abs(y - start.y) < 2) continue;
        if (x === level.stairs.x && y === level.stairs.y) continue;
        const nearWall = !isFloor(level, x - 1, y) || !isFloor(level, x + 1, y) || !isFloor(level, x, y - 1) || !isFloor(level, x, y + 1);
        // Rubble gathers against the walls.
        if (rng.chance(nearWall ? 0.16 : 0.05)) {
          const count = rng.int(3, 7);
          const cx = x + rng.range(0.2, 0.8);
          const cz = y + rng.range(0.2, 0.8);
          for (let i = 0; i < count; i++) {
            const size = rng.range(0.03, 0.1);
            e.set(rng.range(0, Math.PI), rng.range(0, Math.PI), rng.range(0, Math.PI));
            v.set(cx + rng.range(-0.22, 0.22), size * 0.6, cz + rng.range(-0.22, 0.22));
            sc.set(size, size * rng.range(0.6, 1), size);
            rocks.push(new THREE.Matrix4().compose(v, q.setFromEuler(e), sc));
          }
        }
        if (rng.chance(0.04)) {
          for (let i = 0; i < rng.int(1, 3); i++) {
            e.set(Math.PI / 2, rng.range(0, Math.PI), 0, 'YXZ');
            v.set(x + rng.range(0.2, 0.8), 0.02, y + rng.range(0.2, 0.8));
            sc.set(0.02, rng.range(0.14, 0.26), 0.02);
            bones.push(new THREE.Matrix4().compose(v, q.setFromEuler(e), sc));
          }
        }
        if (rng.chance(0.012)) {
          e.set(rng.range(-0.3, 0.3), rng.range(0, Math.PI * 2), 0);
          v.set(x + rng.range(0.25, 0.75), 0.055, y + rng.range(0.25, 0.75));
          sc.set(0.075, 0.065, 0.085);
          skulls.push(new THREE.Matrix4().compose(v, q.setFromEuler(e), sc));
        }
      }
    }
    const stone = inkMaterial(new THREE.MeshLambertMaterial({ color: 0xcdbf9f, flatShading: true }));
    const bone = inkMaterial(new THREE.MeshLambertMaterial({ color: 0xe6dcc4 }));
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, list: THREE.Matrix4[]) => {
      if (list.length === 0) return;
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.levelGroup.add(mesh);
    };
    add(new THREE.IcosahedronGeometry(1, 0), stone, rocks);
    add(new THREE.CylinderGeometry(1, 0.8, 1, 6), bone, bones);
    add(new THREE.SphereGeometry(1, 10, 8), bone, skulls);
  }

  private applyWallHeight(): void {
    if (!this.walls) return;
    const h = this.mode === 'first' ? WALL_FIRST : WALL_TOP;
    const m = new THREE.Matrix4();
    this.wallTiles.forEach(([x, y], i) => {
      m.makeScale(1, h, 1);
      m.setPosition(x + 0.5, h / 2, y + 0.5);
      this.walls!.setMatrixAt(i, m);
    });
    this.walls.instanceMatrix.needsUpdate = true;
    this.walls.computeBoundingSphere();
    if (this.columns) {
      this.columnTiles.forEach(([x, y], i) => {
        m.makeScale(1, h, 1);
        m.setPosition(x + 0.5, h / 2, y + 0.5);
        this.columns!.setMatrixAt(i, m);
      });
      this.columns.instanceMatrix.needsUpdate = true;
      this.columns.computeBoundingSphere();
    }
    if (this.ceiling) this.ceiling.visible = this.mode === 'first';
  }

  /** One textured quad per floor tile, at height `y`, facing up (floor) or down (ceiling). */
  private tileQuads(level: Level, y: number, up: boolean): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let n = 0;
    for (let ty = 0; ty < level.height; ty++) {
      for (let tx = 0; tx < level.width; tx++) {
        if (!isFloor(level, tx, ty)) continue;
        positions.push(tx, y, ty, tx + 1, y, ty, tx + 1, y, ty + 1, tx, y, ty + 1);
        for (let i = 0; i < 4; i++) normals.push(0, up ? 1 : -1, 0);
        uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
        if (up) indices.push(n, n + 2, n + 1, n, n + 3, n + 2);
        else indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
        n += 4;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    return g;
  }

  // Camera and light ----------------------------------------------------------------

  /** Resolution: crisp low-res pixels in first person, full resolution from above. */
  private resize(): void {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    const portrait = w < h;
    // First person renders a little below full resolution, which keeps it light and soft.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ratio = this.mode === 'first' ? Math.min(dpr, (portrait ? 520 : 960) / w) : dpr;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, true);
    this.renderer.domElement.classList.toggle('pixelated', false);
    this.hands.width = Math.round(w * (this.mode === 'first' ? ratio : 0.5));
    this.hands.height = Math.round(h * (this.mode === 'first' ? ratio : 0.5));
    this.camera.aspect = w / h;
    if (this.mode === 'first') {
      // Portrait keeps a fixed horizontal field of view; wide screens use their width.
      const hfov = (62 * Math.PI) / 180;
      this.camera.fov = portrait ? (2 * Math.atan(Math.tan(hfov / 2) / this.camera.aspect) * 180) / Math.PI : 62;
    } else {
      this.camera.fov = 40;
    }
    this.camera.updateProjectionMatrix();
  }

  private placeCamera(world: World, fpAngle: number): void {
    this.positionCamera(world, fpAngle);
    // Shake on heavy blows.
    const shake = this.effects.shake;
    if (shake > 0) {
      const t = performance.now() / 1000;
      this.camera.position.x += Math.sin(t * 71) * shake;
      this.camera.position.y += Math.sin(t * 53) * shake * 0.6;
      this.camera.position.z += Math.cos(t * 67) * shake;
    }
  }

  private positionCamera(world: World, fpAngle: number): void {
    const p = world.player;
    cutaway.fade.value = this.mode === 'top' ? 1 : 0;
    cutaway.player.value.set(p.x, 0, p.y);
    if (this.mode === 'first') {
      this.camera.position.set(p.x, EYE, p.y);
      this.camera.lookAt(p.x + Math.cos(fpAngle), EYE, p.y + Math.sin(fpAngle));
      return;
    }
    // Distance so that about TOP_TILES fit across the shortest side.
    const vfov = (this.camera.fov * Math.PI) / 180;
    const across = this.camera.aspect < 1 ? TOP_TILES / this.camera.aspect : TOP_TILES;
    const distance = across / 2 / Math.tan(vfov / 2);
    // Follow smoothly, but never fall more than a couple of tiles behind.
    const goal = new THREE.Vector3(p.x, 0.5, p.y);
    if (this.cameraTarget.lengthSq() === 0 || this.cameraTarget.distanceTo(goal) > 2) this.cameraTarget.copy(goal);
    else this.cameraTarget.lerp(goal, 0.2);
    const t = this.cameraTarget;
    this.camera.position.set(t.x, t.y + Math.sin(TOP_TILT) * distance, t.z + Math.cos(TOP_TILT) * distance);
    this.camera.up.copy(UP);
    this.camera.lookAt(t);
  }

  private placeLight(world: World, now: number, fpAngle: number): void {
    const p = world.player;
    const target = this.mode === 'first' ? fpAngle : Math.atan2(world.facing.y, world.facing.x);
    let delta = target - this.lightAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.lightAngle += this.mode === 'first' ? delta : delta * 0.2;
    // A living flame: brightness, reach and color waver on several rhythms at once, the
    // flame itself sways a little (so shadows dance), and it gutters when oil runs low.
    const t = now / 1000;
    const wave = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 13.1 + 1.3) * 0.3 + Math.sin(t * 23.7 + 2.1) * 0.2;
    const gust = Math.max(0, Math.sin(t * 1.7) * Math.sin(t * 0.63)) * Math.sin(t * 31) * 0.5;
    const low = world.survival.light < 20 ? 1 - world.survival.light / 20 : 0;
    const flicker = 1 + wave * (0.05 + low * 0.12) + gust * 0.08;
    const radius = world.lightRadius * (1 + wave * 0.025);
    const height = this.mode === 'first' ? EYE - 0.05 : FLAME_HEIGHT;
    const swayX = Math.sin(t * 2.9) * 0.04 + Math.sin(t * 7.7) * 0.02;
    const swayZ = Math.cos(t * 3.3) * 0.04 + Math.sin(t * 6.1) * 0.02;
    // Start the cone a little behind the hero so the floor at their feet is lit too.
    const back = this.mode === 'first' ? 0 : 0.35;
    this.light.position.set(
      p.x - Math.cos(this.lightAngle) * back + swayX,
      height + Math.sin(t * 5.1) * 0.03,
      p.y - Math.sin(this.lightAngle) * back + swayZ,
    );
    this.light.target.position.set(p.x + Math.cos(this.lightAngle) * 3, 0.2, p.y + Math.sin(this.lightAngle) * 3);
    this.light.distance = radius + back;
    this.light.intensity = world.survival.light > 0 && !world.invisible ? 6 * flicker : 0;
    // Warmer and redder when it dips.
    this.light.color.setRGB(1, 0.8 + 0.06 * wave, 0.56 + 0.1 * wave - low * 0.12);
    this.light.shadow.camera.far = radius + 2;
  }

  // Characters ----------------------------------------------------------------------

  private ensureHero(world: World): void {
    if (this.hero && this.heroClass === world.classId) return;
    if (this.hero) this.scene.remove(this.hero.mesh);
    const sheet = drawHeroSheet(world.classId, 64);
    // The hero is always shown over the darkness.
    const material = new THREE.MeshBasicMaterial({ map: canvasTexture(sheet.canvas), alphaTest: 0.5, depthTest: false, transparent: true });
    this.hero = new Cutout(sheet, material, HERO_SIZE.h / 32);
    this.hero.mesh.renderOrder = 10;
    this.heroClass = world.classId;
    this.scene.add(this.hero.mesh);
  }

  private syncHero(world: World, now: number, moved: number): void {
    const hero = this.hero!;
    hero.mesh.visible = this.mode === 'top';
    this.flame.visible = this.mode === 'top' && world.survival.light > 0 && !world.invisible;
    if (this.mode !== 'top') return;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const flip = world.facing.x * right.x + world.facing.y * right.z < 0;
    // The blow as one motion: lean back while winding up, lunge into the strike, settle
    // back to rest early instead of freezing on the last pose.
    const swing = swingPhase(world);
    let lunge = 0;
    let frame: string;
    if (swing >= 0 && swing < 1) {
      frame = 'attack0';
      lunge = -0.08 * easeOut(swing);
    } else if (swing >= 1 && swing < 2) {
      frame = 'attack1';
      lunge = -0.08 + 0.3 * easeOut(swing - 1);
    } else if (swing >= 2) {
      const back = swing - 2;
      frame = back < 0.35 ? 'attack1' : `idle${Math.floor(now / 600) % 2}`;
      lunge = 0.22 * (1 - easeInOut(back));
    } else if (moved > 0.002) frame = `walk${Math.floor(this.walked / 0.32) % 4}`;
    else frame = `idle${Math.floor(now / 600) % 2}`;
    hero.place({ x: world.player.x + world.facing.x * lunge, y: world.player.y + world.facing.y * lunge }, this.camera, flip, this.mode);
    hero.setFrame(Math.max(0, this.heroSheetFrames().indexOf(frame)));
    const heroMaterial = hero.mesh.material as THREE.MeshBasicMaterial;
    heroMaterial.opacity = world.invisible ? 0.35 : 1;
    if (now < this.effects.heroFlashUntil) heroMaterial.color.setRGB(1, 0.35, 0.3);
    else heroMaterial.color.setRGB(1, 1, 1);
    // The flame at the hero's hand.
    const anchor = FLAME_ANCHOR[world.classId];
    const side = flip ? -1 : 1;
    const offset = right.clone().multiplyScalar((anchor.x / 32) * side);
    const up = new THREE.Vector3(0, (-anchor.y / 32) / Math.cos(TOP_TILT), 0);
    this.flame.position.set(world.player.x, 0, world.player.y).add(offset).add(up);
    const s = 0.35 + 0.05 * Math.sin(now / 60);
    this.flame.scale.set(s * 0.66, s, 1);
  }

  /** How lit something is at distance `d` from the flame, like the first-person raycaster. */
  private falloff(world: World, d: number): number {
    const R = world.lightRadius;
    if (d >= R) return 0;
    return Math.min(1, (1 - d / R) * 1.4) ** 1.2;
  }

  private heroSheetFrames(): string[] {
    return ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'attack0', 'attack1'];
  }

  private syncEnemies(world: World, now: number): void {
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const seen = new Set<number>();
    for (const enemy of world.enemies) {
      if (enemy.state === 'dead') continue;
      seen.add(enemy.id);
      let entry = this.enemies.get(enemy.id);
      if (!entry) {
        const { sheet, texture } = this.enemySheets.get(enemy.kind)!;
        const material = new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide });
        const cutout = new Cutout(sheet, material, ENEMY_SIZE[enemy.kind].h / 32);
        const eyes = new THREE.Sprite(this.eyeMaterials.get(enemy.kind)!);
        eyes.scale.set(0.5, 0.25, 1);
        this.scene.add(cutout.mesh);
        this.scene.add(eyes);
        entry = { cutout, material, eyes };
        this.enemies.set(enemy.id, entry);
      }
      const flip = enemy.facing.x * right.x + enemy.facing.y * right.z < 0;
      entry.cutout.place(enemy.pos, this.camera, flip, this.mode);
      entry.cutout.setFrame(ENEMY_FRAMES_INDEX[this.enemyFrame(enemy, now)]);
      // Lit only where the hero sees it; telegraphs and hits turn it red.
      const d = Math.hypot(enemy.pos.x - world.player.x, enemy.pos.y - world.player.y);
      const brightness = enemy.visible ? Math.max(this.falloff(world, d), enemy.wax > 0 ? 0.6 : 0) : 0;
      const flash = now < (this.flashUntil.get(enemy.id) ?? 0);
      entry.cutout.shade(entry.material, brightness, flash ? 1 : enemy.state === 'windup' ? 0.6 : 0);
      // Eyes in the dark, at the height of the drawn eyes.
      entry.eyes.visible = enemy.watching;
      if (enemy.watching) {
        entry.eyes.position.set(enemy.pos.x, EYES[enemy.kind].h / 32, enemy.pos.y);
      }
    }
    for (const [id, entry] of this.enemies) {
      if (seen.has(id)) continue;
      this.scene.remove(entry.cutout.mesh);
      this.scene.remove(entry.eyes);
      this.enemies.delete(id);
    }
  }

  private enemyFrame(enemy: Enemy, now: number): string {
    const walk = this.walks.get(enemy.id) ?? { walked: 0, last: { ...enemy.pos } };
    const moved = Math.hypot(enemy.pos.x - walk.last.x, enemy.pos.y - walk.last.y);
    walk.walked += moved;
    walk.last = { ...enemy.pos };
    this.walks.set(enemy.id, walk);
    if (enemy.state === 'windup') return 'windup';
    const stride = enemy.kind === 'crawler' ? 0.18 : enemy.kind === 'husk' ? 0.45 : 0.3;
    if (moved > 0.001) return `move${Math.floor(walk.walked / stride) % 4}`;
    return `idle${Math.floor((now + enemy.id * 137) / 700) % 2}`;
  }

  private syncItems(world: World): void {
    const seen = new Set<number>();
    for (const item of world.level.items) {
      if (world.taken.has(item.id)) continue;
      seen.add(item.id);
      let cutout = this.items.get(item.id);
      if (!cutout) {
        const { sheet, texture } = this.itemTextures.get(item.kind)!;
        cutout = new Cutout(sheet, new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide }), 0.6);
        this.scene.add(cutout.mesh);
        this.items.set(item.id, cutout);
      }
      cutout.place({ x: item.x + 0.5, y: item.y + 0.5 }, this.camera, false, this.mode);
      const tile = item.y * world.level.width + item.x;
      const d = Math.hypot(item.x + 0.5 - world.player.x, item.y + 0.5 - world.player.y);
      let brightness = world.visibleNow.has(tile) ? this.falloff(world, d) : 0;
      if (world.itemSight > 0 && d <= world.itemSight) brightness = Math.max(brightness, 0.55);
      cutout.shade(cutout.mesh.material as THREE.MeshBasicMaterial, brightness);
    }
    for (const [id, cutout] of this.items) {
      if (seen.has(id)) continue;
      this.scene.remove(cutout.mesh);
      this.items.delete(id);
    }
  }

  private syncProjectiles(world: World): void {
    const seen = new Set<number>();
    for (const p of world.projectiles) {
      seen.add(p.id);
      let cutout = this.projectiles.get(p.id);
      if (!cutout) {
        const material = new THREE.MeshBasicMaterial({ map: this.projectileTexture.texture, alphaTest: 0.5 });
        cutout = new Cutout(this.projectileTexture.sheet, material, 0.35);
        this.scene.add(cutout.mesh);
        this.projectiles.set(p.id, cutout);
      }
      cutout.place(p.pos, this.camera, false, this.mode);
      cutout.mesh.position.y = 0.7;
      const tile = Math.floor(p.pos.y) * world.level.width + Math.floor(p.pos.x);
      cutout.mesh.visible = world.visibleNow.has(tile);
    }
    for (const [id, cutout] of this.projectiles) {
      if (seen.has(id)) continue;
      this.scene.remove(cutout.mesh);
      this.projectiles.delete(id);
    }
  }

  private drawHandsOverlay(world: World, now: number, walking: boolean): void {
    const ctx = this.handsCtx;
    ctx.clearRect(0, 0, this.hands.width, this.hands.height);
    this.hands.style.display = this.mode === 'first' ? 'block' : 'none';
    if (this.mode !== 'first') return;
    drawHands(ctx, this.hands.width, this.hands.height, world, now, this.walked, walking);
  }
}

const ENEMY_FRAMES_INDEX: Record<string, number> = {
  idle0: 0,
  idle1: 1,
  move0: 2,
  move1: 3,
  move2: 4,
  move3: 5,
  windup: 6,
};
