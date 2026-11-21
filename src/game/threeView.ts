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
import { CONFIG } from '../core/config';
import { generateLevel, isFloor, isVoid, LEVEL_HEIGHT, type Stairwell } from '../core/dungeon';
import { Rng } from '../core/rng';
import type { EnemyKind } from '../core/enemies';
import { COMBAT, type Enemy, type World, type WorldEvent } from '../core/world';
import { drawChalk, drawFloorDecor, drawProjectile } from './art';
import { SPAN_X, SPAN_Y, stoneColor, wallColor, wallRelief } from './inkTextures3d';
import { InkPost } from './inkPost';
import { BRICK_DEPTH, layBricks } from './masonry';
import { campModel, featureModel, lootModel, outlined, torchModel, TORCH_FLAME, type ModelMaterials } from './models3d';
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
/** The flame's strength (with inverse-square falloff it lights a few tiles brightly). */
const FLAME_POWER = 14;
/** `?post=0` turns the drawing-on-paper pass off. */
const POST = typeof window !== 'undefined' && new URL(window.location.href).searchParams.get('post') !== '0';
const UP = new THREE.Vector3(0, 1, 0);
/** `?walls=flat` brings back the painted walls instead of real bricks. */
const FLAT_WALLS = typeof window !== 'undefined' && new URL(window.location.href).searchParams.get('walls') === 'flat';

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
const cutaway = {
  fade: { value: 0 },
  player: { value: new THREE.Vector3() },
  night: { value: 0 },
  /** Space between hatch lines on screen, in device pixels. */
  lineSpacing: { value: 7 },
  /** How far the flame lights across the floor plan; nothing past it gets light. */
  reach: { value: 7 },
};
/** Hatch lines per tile at the coarsest level of detail used up close. */
const HATCH_BASE = 7;
/** Radius of the plunderer's sight in the dark, in tiles. */
const NIGHT_RADIUS = 6.5;

/**
 * Our ink look on lit surfaces, plus the cut-away for the top view.
 *
 * Hatching is the only shading: lit surfaces keep the full tone of the paper, warmed by the
 * flame, and wherever light thins out, ink lines appear, then cross-hatching, then a third
 * pass, and finally the lines thicken until they close into solid ink, like a drawing
 * shaded by hand. Lines live in world space so they stay put when the camera moves; floors
 * use the ground plane, walls their own face. Back faces, only seen where the cut-away
 * slices a wall open, are solid ink, like the cut walls in an architect's section.
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
  /**
   * Pen outlines along the edges of each block (for unit boxes): a line of constant width
   * on screen wherever a face ends, so every brick is drawn, not just shaded.
   */
  outline?: boolean;
  /** Solid ink whatever the light or the side (outline shells). */
  solid?: boolean;
  /**
   * Multiplies the light this surface gets: for the level below, seen through a hole, so a
   * flame a storey up still shows it (only within the flame's reach).
   */
  boost?: number;
}

function inkMaterial(material: THREE.MeshLambertMaterial, options: InkOptions = {}): THREE.MeshLambertMaterial {
  const { cut = false, worldUv, grime = false, outline = false, solid = false, boost = 1 } = options;
  const uvCode =
    worldUv === 'box'
      ? `bool inkAlongZ = abs(vInkNormal.x) > 0.5;
         // Each straight run of wall starts somewhere else in the masonry, so the pattern
         // never visibly repeats from one wall to the next.
         float inkLine = floor((inkAlongZ ? vInkPos.x : vInkPos.z) + 0.5) + (inkAlongZ ? 0.0 : 517.0);
         float inkHash = fract(sin(inkLine * 12.9898) * 43758.5453);
         vec2 inkShift = vec2(inkHash, fract(inkHash * 7.13));
         vec2 inkUv = abs(vInkNormal.y) > 0.5
            ? vInkPos.xz
            : vec2(inkAlongZ ? vInkPos.z : vInkPos.x, vInkPos.y) / vec2(${SPAN_X.toFixed(1)}, ${SPAN_Y.toFixed(1)}) + inkShift;`
      : worldUv === 'column'
        ? `vec3 inkCenter = vec3(0.0);
           #ifdef USE_INSTANCING
             inkCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
           #endif
           // Once around the column is once across the texture, so there is no seam.
           vec2 inkUv = vec2(atan(vInkPos.z - inkCenter.z, vInkPos.x - inkCenter.x) / 6.28318, vInkPos.y / ${SPAN_Y.toFixed(1)});`
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
    shader.uniforms.uNight = cutaway.night;
    shader.uniforms.uLineSpacing = cutaway.lineSpacing;
    shader.uniforms.uReach = cutaway.reach;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vInkPos;\nvarying vec3 vInkNormal;\nvarying vec3 vInkLocal;\nvarying vec3 vInkLocalNormal;')
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
        vInkLocal = transformed;
        vInkLocalNormal = objectNormal;
        ${uvAssign}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_fragment_begin>', LIGHTS_WITH_INK_SHADOW)
      .replace(
        '#include <common>',
        '#include <common>\n' + INK_NOISE + '\nuniform float uFade;\nuniform float uNight;\nuniform float uLineSpacing;\nuniform float uReach;\nuniform vec3 uPlayer;\nvarying vec3 vInkPos;\nvarying vec3 vInkNormal;\nvarying vec3 vInkLocal;\nvarying vec3 vInkLocalNormal;',
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
        `if (${solid ? 'true' : '!gl_FrontFacing'}) {
          outgoingLight = vec3(0.0);
        } else {
          vec3 irradiance = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
          // Lambert multiplies by the paper's color and divides by pi; undo both to get the
          // light alone, so 1.0 means fully lit.
          vec3 lightRgb = irradiance / max(diffuseColor.rgb, vec3(0.02)) * 3.14159;
          // The flame reaches a storey down through holes, but across the plan never past
          // its radius: what lies beyond stays dark.
          float lit = dot(lightRgb, vec3(0.3333)) * ${boost.toFixed(2)};
          // The last stretch of the reach fades out gently, as hatching closing into ink.
          float edgeFade = 1.0 - smoothstep(uReach * 0.6, uReach, distance(vInkPos.xz, uPlayer.xz));
          lit *= edgeFade * edgeFade * (3.0 - 2.0 * edgeFade);
          // The flame's tint without its strength: the paper keeps one tone, ink does the rest.
          vec3 tint = lightRgb / max(max(lightRgb.r, max(lightRgb.g, lightRgb.b)), 1e-4);
          vec3 paper = diffuseColor.rgb * tint;
          vec3 n = normalize(vInkNormal);
          vec2 hp = abs(n.y) > 0.5 ? vInkPos.xz : vec2(abs(n.x) > 0.5 ? vInkPos.z : vInkPos.x, vInkPos.y);
          hp *= 7.0;
          float d1 = abs(fract(hp.x + hp.y) - 0.5);
          float d2 = abs(fract(hp.x - hp.y) - 0.5);
          float d3 = abs(fract(hp.x * 1.3 + 0.25) - 0.5);
          float aa = clamp(fwidth(hp.x + hp.y) * 0.6, 0.002, 0.2);
          // A tonal ladder with clear steps: clean paper, loose hatching, cross-hatching, a
          // third pass, then solid ink. The ink's edge wanders a little, like a brush.
          float wobble = inkNoise(vInkPos.xz * 3.1 + vInkPos.y * 2.3) - 0.5;
          float tone = clamp(1.0 - lit * 1.5 + wobble * 0.08, 0.0, 1.0);
          // Cast shadows inside the light are solid ink with a short hatched rim: the
          // light fading with distance is drawn with lines, what blocks it with a brush.
          float shadowed = 1.0 - smoothstep(0.25, 0.75, inkShadow + wobble * 0.25);
          float rim = smoothstep(0.08, 0.35, shadowed) * (1.0 - smoothstep(0.65, 0.92, shadowed));
          tone = max(tone, mix(tone, 0.6, rim));
          // Five steps of tone: four passes of fine lines, each at its own angle, coming in one
          // after another; then all of them thicken together until they close into solid
          // ink, with no step between the last lines and the dark.
          float closing = smoothstep(0.68, 0.985, tone) * 0.44;
          float w1 = smoothstep(0.1, 0.16, tone) * 0.055 + closing;
          float w2 = smoothstep(0.27, 0.33, tone) * 0.055 + closing;
          float w3 = smoothstep(0.43, 0.49, tone) * 0.06 + closing;
          float w4 = smoothstep(0.57, 0.63, tone) * 0.06 + closing;
          // Like a hand on paper, lines keep about the same spacing on the page wherever
          // they are: a near surface takes up more of the page and so gets more lines, a far
          // one fewer. Density changes in steps of two, the new lines growing in between the
          // old ones, so nothing jumps or swims.
          vec2 pw = hp / 7.0;
          float worldPerPixel = max(length(fwidth(pw)), 1e-5);
          float level = clamp(log2(1.0 / (uLineSpacing * worldPerPixel * ${HATCH_BASE.toFixed(1)})), -2.0, 3.0);
          float lod = floor(level);
          float grow = level - lod;
          float freq = ${HATCH_BASE.toFixed(1)} * exp2(lod + 1.0);
          // Drawn by hand: each line wavers, presses harder or lighter, and the pen lifts now
          // and then, less so as the shade deepens and the lines close up.
          float lift = 1.0 - smoothstep(0.5, 0.75, tone);
          float ink = max(
            inkPen(pw.x + pw.y, pw.x - pw.y, freq, grow, w1, 0.0, lift),
            inkPen(pw.x - pw.y, pw.x + pw.y, freq, grow, w2, 17.0, lift));
          ink = max(ink, inkPen(pw.x * 1.3, pw.y, freq, grow, w3, 41.0, lift * 0.5));
          ink = max(ink, inkPen(pw.y * 1.15 + pw.x * 0.3, pw.x, freq, grow, w4, 73.0, lift * 0.3));
          ink = max(ink, step(0.985, tone));
          ink = max(ink, smoothstep(0.82, 0.92, shadowed));
          float edge = 0.0;
          ${
            outline
              ? `{
            vec3 ln = abs(vInkLocalNormal);
            vec2 c = ln.x > 0.5 ? vInkLocal.yz : ln.y > 0.5 ? vInkLocal.xz : vInkLocal.xy;
            vec2 px = (0.5 - abs(c)) / max(fwidth(c), vec2(1e-5));
            edge = 1.0 - smoothstep(0.7, 1.7, min(px.x, px.y));
          }`
              : ''
          }
          ink = max(ink, edge * step(0.02, lit));
          outgoingLight = mix(paper, vec3(0.0), ink);
          if (uNight > 0.5) {
            // Sight in the dark: everything black, the drawing's own lines and the
            // shading hatches traced in white, fading out with distance.
            float far = distance(vInkPos.xz, uPlayer.xz);
            float fade = 1.0 - smoothstep(${(NIGHT_RADIUS * 0.55).toFixed(2)}, ${NIGHT_RADIUS.toFixed(2)}, far);
            // From above, a clearing of darkness around the hero so their chalk figure stands out.
            if (uFade > 0.5) fade *= smoothstep(0.5, 1.15, distance(vInkPos.xz, uPlayer.xz + vec2(0.0, -0.35)));
            // Contours: where the drawing changes tone sharply, and where surfaces fold.
            float texel = dot(diffuseColor.rgb, vec3(0.3333));
            float lines = smoothstep(0.08, 0.2, fwidth(texel));
            lines = max(lines, smoothstep(0.25, 0.7, length(fwidth(n))));
            lines = max(lines, edge);
            vec3 toHero = normalize(vec3(uPlayer.x, 1.3, uPlayer.z) - vInkPos);
            float facing = clamp(dot(n, toHero), 0.0, 1.0);
            float shadeTone = 1.0 - facing;
            float hatch = max(step(d1, smoothstep(0.25, 1.0, shadeTone) * 0.2), step(d2, smoothstep(0.65, 1.0, shadeTone) * 0.14));
            // Ceilings stay quieter so the eye goes to walls and floor.
            float chalk = max(lines, hatch * (n.y < -0.5 ? 0.25 : 0.55)) * fade;
            outgoingLight = vec3(0.84, 0.87, 0.92) * chalk;
          }
        }
        #include <opaque_fragment>`,
      );
  };
  return material;
}

/**
 * The walls as one mesh: a face wherever a wall tile looks onto a floor tile, plus a cap
 * on every wall tile. Faces between two walls are never built, so nothing inside a wall
 * can catch the light when the cut-away opens it. One unit tall; scaled to the view.
 * Groups: 0 the sides, 1 the caps.
 */
function wallGeometry(level: Level, tiles: Array<[number, number]>, inset = 0): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let n = 0;
  const quad = (corners: number[][], normal: number[]) => {
    for (const c of corners) positions.push(c[0], c[1], c[2]);
    for (let i = 0; i < 4; i++) normals.push(normal[0], normal[1], normal[2]);
    indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    n += 4;
  };
  for (const [x, y] of tiles) {
    // Corners listed counter-clockwise as seen from the floor side.
    // The faces sit back by `inset`, behind the bricks laid on them.
    const e = inset;
    const xp = x + 1 - e;
    const xm = x + e;
    const zp = y + 1 - e;
    const zm = y + e;
    if (isFloor(level, x + 1, y)) quad([[xp, 0, y + 1], [xp, 0, y], [xp, 1, y], [xp, 1, y + 1]], [1, 0, 0]);
    if (isFloor(level, x - 1, y)) quad([[xm, 0, y], [xm, 0, y + 1], [xm, 1, y + 1], [xm, 1, y]], [-1, 0, 0]);
    if (isFloor(level, x, y + 1)) quad([[x, 0, zp], [x + 1, 0, zp], [x + 1, 1, zp], [x, 1, zp]], [0, 0, 1]);
    if (isFloor(level, x, y - 1)) quad([[x + 1, 0, zm], [x, 0, zm], [x, 1, zm], [x + 1, 1, zm]], [0, 0, -1]);
  }
  const sideIndices = indices.length;
  for (const [x, y] of tiles) quad([[x, 1, y + 1], [x + 1, 1, y + 1], [x + 1, 1, y], [x, 1, y]], [0, 1, 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  // Texture coordinates come from the world in the shader; the attribute just has to exist.
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((positions.length / 3) * 2).fill(0), 2));
  g.setIndex(indices);
  g.addGroup(0, sideIndices, 0);
  g.addGroup(sideIndices, indices.length - sideIndices, 1);
  return g;
}

/**
 * three's light loop, changed so the flame's shadow is not multiplied into the light but
 * kept apart in `inkShadow` (1 lit, 0 in shadow): the ink shader draws cast shadows as
 * solid ink and the light's falloff as hatching.
 */
const LIGHTS_WITH_INK_SHADOW = (() => {
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  const line = `directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;`;
  if (!chunk.includes(line)) throw new Error('three.js light chunk changed: update the ink shadow hook');
  const replaced = chunk.replace(
    line,
    `inkShadow = min(inkShadow, ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0);`,
  );
  return `float inkShadow = 1.0;\n${replaced}`;
})();

/** Solid ink seen from inside a slightly larger shell: an outline around a shape. */
function hullMaterial(): THREE.MeshLambertMaterial {
  return inkMaterial(new THREE.MeshLambertMaterial({ side: THREE.BackSide }), { cut: true, solid: true });
}

/** Smooth value noise, for edges of ink that wander like a brush. */
const INK_NOISE = `
float inkHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float inkNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(inkHash(i), inkHash(i + vec2(1.0, 0.0)), u.x), mix(inkHash(i + vec2(0.0, 1.0)), inkHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// One family of pen lines across 'u' (world units), 'freq' lines per unit, where every
// other line is new at this level of detail and drawn at 'grow' of its width. 'along'
// runs down each line. Each line keeps its own waver, pressure and pen lifts at every
// level, keyed to where it lies in the world; 'lift' scales how often the pen lifts.
float inkPen(float u, float along, float freq, float grow, float width, float seed, float lift) {
  if (width <= 0.001) return 0.0;
  float x = u * freq;
  float id = floor(x + 0.5);
  float key = id / freq;
  float waver = (inkNoise(vec2(along * 4.0, key * 23.0 + seed)) - 0.5) * 0.3;
  float d = abs(x + waver - id);
  float w = width * (0.65 + 0.7 * inkNoise(vec2(along * 7.0, key * 9.0 + seed + 7.0)));
  w *= mix(1.0, grow, mod(id, 2.0));
  float aa = clamp(fwidth(x) * 0.6, 0.002, 0.25);
  float line = (1.0 - smoothstep(w - aa, w + aa, d)) * step(0.001, w);
  float gap = step(inkNoise(vec2(along * 3.5, key * 31.0 + seed + 3.0)), 0.22 * lift);
  return line * (1.0 - gap);
}`;

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
  place(pos: Point, camera: THREE.Camera, flip: boolean, mode: CameraMode, height = 0): void {
    this.mesh.position.set(pos.x, height, pos.y);
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
    if (cutaway.night.value > 0.5) {
      // Seen in the dark: pale and cold, like the chalk lines around them.
      material.color.setRGB(b * 0.62 * (1 + red * 0.3), b * 0.66 * (1 - red * 0.5), b * 0.74 * (1 - red * 0.5));
      return;
    }
    material.color.setRGB(b * (1 - red * 0.2), b * 0.86 * (1 - red * 0.75), b * 0.66 * (1 - red * 0.8));
  }
}

/** A drawing redrawn in chalk: its ink lines turn white and its paper turns black. */
function chalkCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, c.width, c.height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 255 - (d[i] + d[i + 1] + d[i + 2]) / 3;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return c;
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

/** A warm radial glow, fading to nothing at the edge. */
function haloCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 190, 110, 0.35)');
  g.addColorStop(0.35, 'rgba(255, 160, 80, 0.12)');
  g.addColorStop(1, 'rgba(255, 140, 60, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

/** A small chalk-white glint: something lies there in the dark. */
function glintCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = 'rgba(236, 232, 222, 0.85)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(16, 6);
  ctx.lineTo(16, 26);
  ctx.moveTo(6, 16);
  ctx.lineTo(26, 16);
  ctx.stroke();
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
  private walls: THREE.Mesh | null = null;
  /** Real bricks, one instanced mesh per block of the level so unseen ones are skipped. */
  private bricks: THREE.InstancedMesh[] = [];
  private brickMaterial: THREE.MeshLambertMaterial | null = null;
  private readonly stone = repeating(canvasTexture(stoneColor(256)));
  private wallTiles: Array<[number, number]> = [];
  private columns: THREE.InstancedMesh | null = null;
  /** The columns' outline: a slightly larger shell seen from inside, drawn in solid ink. */
  private columnHull: THREE.InstancedMesh | null = null;
  private columnTiles: Array<[number, number]> = [];
  private readonly effects: Effects;
  private lastNow = 0;
  private ceiling: THREE.Mesh | null = null;
  private readonly textures: Record<'wall' | 'floor' | 'ceiling' | 'stairs', THREE.CanvasTexture>;
  private readonly wallRelief = repeating(new THREE.CanvasTexture(wallRelief(512)));
  private readonly enemySheets = new Map<EnemyKind, { sheet: SpriteSheet; texture: THREE.CanvasTexture }>();
  private readonly projectileTexture: { sheet: SpriteSheet; texture: THREE.CanvasTexture };
  private readonly eyeMaterials = new Map<EnemyKind, THREE.SpriteMaterial>();
  private hero: Cutout | null = null;
  /** The hero's drawing as it is, and inverted (white lines on black) for sight in the dark. */
  private heroMaps: { day: THREE.Texture; night: THREE.Texture } | null = null;
  private heroClass = '';
  private flame: THREE.Sprite;
  private readonly enemies = new Map<number, { cutout: Cutout; material: THREE.MeshBasicMaterial; eyes: THREE.Sprite }>();
  private readonly items = new Map<number, { obj: THREE.Object3D; glint: THREE.Sprite }>();
  /** Materials for the small 3D models, dressed in ink. */
  private readonly mats: ModelMaterials;
  /** The drawing-on-paper pass over each frame (off with ?post=0). */
  private readonly post: InkPost | null = POST ? new InkPost() : null;
  private readonly haloMaterial: THREE.SpriteMaterial;
  private readonly flameMaterial: THREE.SpriteMaterial;
  private readonly glintMaterial: THREE.SpriteMaterial;
  /** Fountains, remains and crates; a container's drawing changes once searched. */
  private readonly features = new Map<number, { obj: THREE.Object3D; key: string }>();
  private readonly camps = new Map<number, { obj: THREE.Object3D; flame: THREE.Sprite }>();
  private readonly campLight: THREE.PointLight;
  /** Torches and chalk marks: cut-outs and floor decals, and a few lights for the nearest torches. */
  private readonly works = new Map<number, { obj: THREE.Object3D; key: string; flame?: THREE.Sprite }>();
  private readonly torchLights: THREE.PointLight[] = [];
  private readonly chalkTextures = new Map<string, THREE.Texture>();
  /** Doors and barricades, rebuilt when their state changes. */
  private doors = new Map<number, { obj: THREE.Object3D; key: string }>();
  /** Painted masonry for walls below the floor (the stairs' shaft, the level below). */
  private get paintedWall(): THREE.Material {
    this.painted ??= inkMaterial(new THREE.MeshLambertMaterial({ map: this.textures.wall, bumpMap: this.wallRelief, bumpScale: 3 }), {
      worldUv: 'box',
      grime: true,
    });
    return this.painted;
  }
  private painted: THREE.Material | null = null;
  /** The same, for the level below, lit through the holes. */
  private get belowWall(): THREE.Material {
    this.paintedBelow ??= inkMaterial(new THREE.MeshLambertMaterial({ map: this.textures.wall, bumpMap: this.wallRelief, bumpScale: 3 }), {
      worldUv: 'box',
      grime: true,
      boost: 4,
    });
    return this.paintedBelow;
  }
  private paintedBelow: THREE.Material | null = null;
  private readonly woodMaterial = inkMaterial(new THREE.MeshLambertMaterial({ color: 0x9a7448 }), { cut: true, outline: true });
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
    // A real flame: light falls with the square of the distance (decay 2).
    this.light = new THREE.SpotLight(0xffd6a0, FLAME_POWER, 8, COMBAT.visionCone, 0.06, 2);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
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
    // The camp fire, when burning, lights the room around it.
    this.campLight = new THREE.PointLight(0xffb070, 0, 5, 1.6);
    this.shadowed(this.campLight, 5);
    this.scene.add(this.campLight);
    for (const sign of ['arrow', 'danger', 'water', 'camp', 'stairs'] as const) this.chalkTextures.set(sign, canvasTexture(drawChalk(sign, 96)));
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xffb070, 0, CONFIG.works.torchRadius + 1, 1.6);
      // The nearest torch throws real shadows; the others only light (shadows cost six renders each).
      if (i === 0) this.shadowed(light, CONFIG.works.torchRadius + 1.5);
      this.torchLights.push(light);
      this.scene.add(light);
    }
    const projectile = sheetFromCanvas(drawProjectile(64));
    this.projectileTexture = { sheet: { ...projectile, originY: 0.5 }, texture: canvasTexture(projectile.canvas) };
    const ink = (color: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) =>
      inkMaterial(new THREE.MeshLambertMaterial({ color, ...extra }), { cut: true });
    this.mats = {
      stone: ink(0xcdbf9f, { flatShading: true }),
      wood: ink(0xa5784a),
      cloth: ink(0x9c8a68),
      bone: ink(0xe6dcc4),
      metal: ink(0x6f6a62),
      water: ink(0x7d93a3),
      flesh: ink(0x7a4a40),
      gold: ink(0xd8b25a),
      paper: ink(0xece2cb),
      ink: new THREE.MeshBasicMaterial({ color: 0x000000 }),
      hull: hullMaterial(),
    };
    const flameTexture = canvasTexture(flameCanvas());
    this.flameMaterial = new THREE.SpriteMaterial({ map: flameTexture, transparent: true, depthWrite: false });
    this.glintMaterial = new THREE.SpriteMaterial({ map: canvasTexture(glintCanvas()), transparent: true, depthWrite: false, depthTest: false });
    this.flame = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: flameTexture, transparent: true, depthWrite: false, depthTest: false }),
    );
    this.flame.renderOrder = 11;
    // Every flame has a soft halo around it.
    this.haloMaterial = new THREE.SpriteMaterial({
      map: canvasTexture(haloCanvas()),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.flame.add(this.halo(3.2));
    this.scene.add(this.flame);
  }

  /** A soft glow around a flame, scaled relative to it. */
  private halo(scale: number): THREE.Sprite {
    const halo = new THREE.Sprite(this.haloMaterial);
    halo.scale.set(scale, scale, 1);
    halo.renderOrder = 10;
    return halo;
  }

  /** Gives a point light soft, cheap shadows within its reach. */
  private shadowed(light: THREE.PointLight, reach: number): void {
    light.castShadow = true;
    light.shadow.mapSize.set(256, 256);
    light.shadow.camera.near = 0.05;
    light.shadow.camera.far = reach;
    light.shadow.bias = -0.004;
    light.shadow.radius = 2;
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
    this.syncFeatures(world);
    this.syncCamps(world, now);
    this.syncWorks(world, now);
    this.syncDoors(world);
    this.syncProjectiles(world);
    if (this.post) this.post.render(this.renderer, this.scene, this.camera, now);
    else this.renderer.render(this.scene, this.camera);
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
    for (const f of this.features.values()) this.scene.remove(f.obj);
    this.features.clear();
    for (const c of this.camps.values()) {
      this.scene.remove(c.obj);
      this.scene.remove(c.flame);
    }
    this.camps.clear();
    for (const it of this.items.values()) {
      this.scene.remove(it.obj);
      this.scene.remove(it.glint);
    }
    this.items.clear();
    for (const w of this.works.values()) {
      this.scene.remove(w.obj);
      if (w.flame) this.scene.remove(w.flame);
    }
    this.works.clear();
    for (const d of this.doors.values()) this.scene.remove(d.obj);
    this.doors.clear();
    for (const c of this.projectiles.values()) this.scene.remove(c.mesh);
    this.projectiles.clear();
    for (const e of this.enemies.values()) {
      this.scene.remove(e.cutout.mesh);
      this.scene.remove(e.eyes);
    }
    this.enemies.clear();

    // Floor and ceiling quads, one per floor tile.
    const floor = this.tileQuads(level, 0, true);
    const floorMesh = new THREE.Mesh(floor, inkMaterial(new THREE.MeshLambertMaterial({ map: this.textures.floor })));
    floorMesh.receiveShadow = true;
    // The floor is a slab: it shades the level below, which shows only through the holes.
    floorMesh.castShadow = true;
    this.levelGroup.add(floorMesh);
    // Real stairs: down into a shaft cut in the floor, and up toward the level above.
    this.levelGroup.add(this.stairsMesh(level.down, 'down'));
    this.levelGroup.add(this.stairsMesh(level.up, 'up'));
    this.levelGroup.add(this.belowMesh(level));
    if (level.gallery) this.levelGroup.add(this.railingMesh(level));
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
        if (isFloor(level, x, y) || isVoid(level, x, y)) continue;
        let touches = false;
        for (let dy = -1; dy <= 1 && !touches; dy++) for (let dx = -1; dx <= 1; dx++) if (isFloor(level, x + dx, y + dy)) touches = true;
        if (!touches) continue;
        const column = isFloor(level, x - 1, y) && isFloor(level, x + 1, y) && isFloor(level, x, y - 1) && isFloor(level, x, y + 1);
        (column ? this.columnTiles : this.wallTiles).push([x, y]);
      }
    }
    // Behind the bricks, a bed of dark mortar. Both sides are drawn so a wall sliced by the
    // cut-away shows a solid ink section; shadows still come from the back faces.
    const side = FLAT_WALLS
      ? inkMaterial(
          new THREE.MeshLambertMaterial({
            map: this.textures.wall,
            bumpMap: this.wallRelief,
            bumpScale: 3,
            side: THREE.DoubleSide,
            shadowSide: THREE.BackSide,
          }),
          { cut: true, worldUv: 'box', grime: true },
        )
      : inkMaterial(new THREE.MeshLambertMaterial({ color: 0x6b5d4d, side: THREE.DoubleSide, shadowSide: THREE.BackSide }), {
          cut: true,
          grime: true,
        });
    this.brickMaterial = inkMaterial(new THREE.MeshLambertMaterial({ map: this.stone }), {
      cut: true,
      worldUv: 'box',
      grime: true,
      outline: true,
    });
    const top = inkMaterial(
      new THREE.MeshLambertMaterial({ map: this.textures.ceiling, side: THREE.DoubleSide, shadowSide: THREE.BackSide }),
      { cut: true, worldUv: 'box' },
    );
    const shaft = inkMaterial(
      new THREE.MeshLambertMaterial({ map: this.textures.wall, bumpMap: this.wallRelief, bumpScale: 3 }),
      { cut: true, worldUv: 'column', grime: true },
    );
    // One mesh with only the faces that look onto a floor, so no inner faces exist.
    this.walls = new THREE.Mesh(wallGeometry(level, this.wallTiles, FLAT_WALLS ? 0 : BRICK_DEPTH), [side, top]);
    this.walls.castShadow = true;
    this.walls.receiveShadow = true;
    this.levelGroup.add(this.walls);
    // Lone wall tiles inside halls are round columns.
    this.columns = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.33, 0.36, 1, 18), [shaft, top, top], this.columnTiles.length);
    this.columns.castShadow = true;
    this.columns.receiveShadow = true;
    this.levelGroup.add(this.columns);
    this.columnHull = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.33, 0.36, 1, 18, 1, true), hullMaterial(), this.columnTiles.length);
    this.levelGroup.add(this.columnHull);
    this.applyWallHeight();

    // Decoration painted on the floor: ink at the foot of the walls, bones, rubble, stains.
    const decorTexture = new THREE.CanvasTexture(drawFloorDecor(level, 32));
    decorTexture.colorSpace = THREE.SRGBColorSpace;
    decorTexture.anisotropy = 8;
    const decor = new THREE.Mesh(
      new THREE.PlaneGeometry(level.width, level.height),
      inkMaterial(new THREE.MeshLambertMaterial({ map: decorTexture, transparent: true, depthWrite: false })),
    );
    decor.rotation.x = -Math.PI / 2;
    decor.position.set(level.width / 2, 0.004, level.height / 2);
    decor.receiveShadow = true;
    this.levelGroup.add(decor);
    this.buildDebris(level);
    // The pit: a hole of solid ink with a ragged rim.
    // The pit is a real hole: the edges of the floor slab around it.
    const slab = new THREE.Group();
    for (const [dx, dz, w, d] of [[0, -0.5, 1, 0.08], [0, 0.5, 1, 0.08], [-0.5, 0, 0.08, 1], [0.5, 0, 0.08, 1]] as const) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), this.mats.stone);
      edge.position.set(level.pit.x + 0.5 + dx, -0.15, level.pit.y + 0.5 + dz);
      edge.castShadow = true;
      edge.receiveShadow = true;
      slab.add(edge);
    }
    this.levelGroup.add(slab);

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
    const hull = hullMaterial();
    const grow = new THREE.Matrix4();
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, list: THREE.Matrix4[], outline = 0) => {
      if (list.length === 0) return;
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.levelGroup.add(mesh);
      // A pen outline: the same shape a little larger, seen from inside, in solid ink.
      if (outline > 0) {
        const shell = new THREE.InstancedMesh(geometry, hull, list.length);
        grow.makeScale(1 + outline, 1 + outline, 1 + outline);
        list.forEach((m, i) => shell.setMatrixAt(i, m.clone().multiply(grow)));
        this.levelGroup.add(shell);
      }
    };
    add(new THREE.IcosahedronGeometry(1, 0), stone, rocks, 0.22);
    add(new THREE.CylinderGeometry(1, 0.8, 1, 6), bone, bones);
    add(new THREE.SphereGeometry(1, 10, 8), bone, skulls, 0.14);
  }

  private applyWallHeight(): void {
    if (!this.walls) return;
    const h = this.mode === 'first' ? WALL_FIRST : WALL_TOP;
    const m = new THREE.Matrix4();
    // The wall mesh is built one unit tall; scaling it keeps the world-space bricks intact.
    this.walls.scale.set(1, h, 1);
    this.layBricks(h);
    if (this.columns) {
      this.columnTiles.forEach(([x, y], i) => {
        m.makeScale(1, h, 1);
        m.setPosition(x + 0.5, h / 2, y + 0.5);
        this.columns!.setMatrixAt(i, m);
        // The outline shell: a touch wider, same height.
        m.makeScale(1.08, h, 1.08);
        m.setPosition(x + 0.5, h / 2, y + 0.5);
        this.columnHull?.setMatrixAt(i, m);
      });
      if (this.columnHull) {
        this.columnHull.instanceMatrix.needsUpdate = true;
        this.columnHull.computeBoundingSphere();
      }
      this.columns.instanceMatrix.needsUpdate = true;
      this.columns.computeBoundingSphere();
    }
    if (this.ceiling) this.ceiling.visible = this.mode === 'first';
  }

  /** Lays the bricks for the current wall height, in blocks of the level. */
  private layBricks(height: number): void {
    for (const mesh of this.bricks) {
      this.levelGroup.remove(mesh);
      mesh.dispose();
    }
    this.bricks = [];
    const level = this.level;
    if (!level || !this.brickMaterial || FLAT_WALLS) return;
    const columns = new Set(this.columnTiles.map(([x, y]) => y * level.width + x));
    const all = layBricks(level, height, (x, y) => columns.has(y * level.width + x));
    const CHUNK = 12;
    const chunks = new Map<number, typeof all>();
    for (const b of all) {
      const key = Math.floor(b.z / CHUNK) * 1000 + Math.floor(b.x / CHUNK);
      let list = chunks.get(key);
      if (!list) chunks.set(key, (list = []));
      list.push(b);
    }
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const color = new THREE.Color();
    for (const list of chunks.values()) {
      const mesh = new THREE.InstancedMesh(geometry, this.brickMaterial, list.length);
      list.forEach((b, i) => {
        e.set(0, b.yaw, b.roll);
        m.compose(p.set(b.x, b.y, b.z), q.setFromEuler(e), sc.set(b.sx, b.sy, b.sz));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, color.setScalar(b.tone));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.bricks.push(mesh);
      this.levelGroup.add(mesh);
    }
  }

  /**
   * A flight of six steps (two per tile). Going down, the steps sink into a shaft walled
   * below the floor; going up, they rise as a solid flight toward the level above.
   */
  private stairsMesh(sw: Stairwell, way: 'down' | 'up'): THREE.Group {
    const g = new THREE.Group();
    const across = { x: -sw.dir.y, y: sw.dir.x };
    const along = (p: number, side = 0) => ({ x: sw.top.x + 0.5 + sw.dir.x * p + across.x * side, z: sw.top.y + 0.5 + sw.dir.y * p + across.y * side });
    const alongX = sw.dir.x !== 0;
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, material: THREE.Material = this.mats.stone) => {
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    };
    for (let i = 0; i < 6; i++) {
      const p = 0.75 + 0.5 * i;
      // Ground height at the middle of this step, falling (or rising) evenly over three tiles.
      const t = (p - 0.5) / 3;
      const top = way === 'down' ? -LEVEL_HEIGHT * (t + 1 / 12) : LEVEL_HEIGHT * (1 - t + 1 / 12);
      const bottom = way === 'down' ? -LEVEL_HEIGHT : 0;
      const h = Math.max(0.05, top - bottom);
      const c = along(p);
      add(new THREE.BoxGeometry(alongX ? 0.5 : 0.96, h, alongX ? 0.96 : 0.5), c.x, bottom + h / 2, c.z);
    }
    if (way === 'down') {
      // The shaft below the floor: its two sides and the end wall, in dark stone.
      for (const side of [-1, 1]) {
        for (let k = 1; k <= 3; k++) {
          const c = along(k, side);
          add(new THREE.BoxGeometry(1, LEVEL_HEIGHT, 1), c.x, -LEVEL_HEIGHT / 2, c.z, this.paintedWall);
        }
      }
      const end = along(4);
      add(new THREE.BoxGeometry(1, LEVEL_HEIGHT, 1), end.x, -LEVEL_HEIGHT / 2, end.z, this.paintedWall);
    }
    return outlined(g, this.mats);
  }

  /** A wooden railing along the edge of a gallery's walkway, over the void. */
  private railingMesh(level: Level): THREE.Group {
    const g = new THREE.Group();
    const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mats.wood);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    };
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (!isVoid(level, x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!isFloor(level, x + dx, y + dy)) continue;
          // The rail runs along the shared edge, on the walkway side.
          const ex = x + 0.5 + dx * 0.46;
          const ez = y + 0.5 + dy * 0.46;
          const alongX = dy !== 0;
          add(alongX ? 1 : 0.06, 0.06, alongX ? 0.06 : 1, ex, 0.62, ez);
          add(0.07, 0.62, 0.07, ex - (alongX ? 0.45 : 0), 0.31, ez - (alongX ? 0 : 0.45));
          // The edge of the floor slab.
          add(alongX ? 1 : 0.08, 0.3, alongX ? 0.08 : 1, x + 0.5 + dx * 0.54, -0.15, y + 0.5 + dy * 0.54);
        }
      }
    }
    return outlined(g, this.mats);
  }

  /**
   * The level below, as far as it shows through the holes in this floor (the stairs down
   * and the pit): its floor and walls around them, one storey down, lit only by what
   * light gets through.
   */
  private belowMesh(level: Level): THREE.Group {
    const g = new THREE.Group();
    const below = generateLevel(level.seed, level.depth + 1, 0);
    const holes = [...level.down.steps, level.pit];
    const g0 = level.gallery;
    if (g0) for (let y = g0.y + 1; y < g0.y + g0.h - 1; y++) for (let x = g0.x + 1; x < g0.x + g0.w - 1; x++) holes.push({ x, y });
    const near = (x: number, y: number) => holes.some((h) => Math.abs(h.x - x) <= 4 && Math.abs(h.y - y) <= 4);
    const onLowerSteps = (x: number, y: number) => below.up.steps.some((p) => p.x === x && p.y === y);
    const positions: number[] = [];
    const indices: number[] = [];
    const walls: Array<[number, number]> = [];
    let n = 0;
    for (let y = 0; y < below.height; y++) {
      for (let x = 0; x < below.width; x++) {
        if (!near(x, y)) continue;
        if (isFloor(below, x, y)) {
          if (onLowerSteps(x, y)) continue;
          positions.push(x, -LEVEL_HEIGHT, y, x + 1, -LEVEL_HEIGHT, y, x + 1, -LEVEL_HEIGHT, y + 1, x, -LEVEL_HEIGHT, y + 1);
          indices.push(n, n + 2, n + 1, n, n + 3, n + 2);
          n += 4;
        } else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isFloor(below, x + dx, y + dy))) walls.push([x, y]);
      }
    }
    if (n > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(positions.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((positions.length / 3) * 2).fill(0), 2));
      geo.setIndex(indices);
      const floor = new THREE.Mesh(geo, inkMaterial(new THREE.MeshLambertMaterial({ map: this.textures.floor }), { boost: 4 }));
      // Seen only through the holes: no shadow test, the hole itself is the shadow's edge.
      floor.receiveShadow = false;
      g.add(floor);
    }
    if (walls.length > 0) {
      const mesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, LEVEL_HEIGHT, 1),
        this.belowWall,
        walls.length,
      );
      const m = new THREE.Matrix4();
      walls.forEach(([x, y], i) => mesh.setMatrixAt(i, m.makeTranslation(x + 0.5, -LEVEL_HEIGHT / 2, y + 0.5)));
      mesh.receiveShadow = false;
      mesh.castShadow = true;
      g.add(mesh);
    }
    return g;
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
        // The stairs down and the pit open holes in the floor; the stairs up rise through
        // the ceiling.
        const hole = (sw: Stairwell) => sw.steps.some((p) => p.x === tx && p.y === ty);
        if (up && (hole(level.down) || (tx === level.pit.x && ty === level.pit.y))) continue;
        if (!up && hole(level.up)) continue;
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
    const ratio = this.mode === 'first' ? Math.min(dpr, (portrait ? 760 : 1400) / w) : dpr;
    this.renderer.setPixelRatio(ratio);
    // Hatch lines about 6 CSS pixels apart, whatever the screen.
    // Fine lines, about four and a half CSS pixels apart.
    cutaway.lineSpacing.value = 4.5 * ratio;
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
    // The plunderer's shadow step snuffs the light, but lets them see the world in chalk;
    // so do Dark Dwellers once their oil runs out.
    const shadowStep = world.invisible && world.cls.special.kind === 'shadowStep';
    cutaway.night.value = shadowStep || (world.fx.darkSight && world.survival.light <= 0) ? 1 : 0;
    cutaway.player.value.set(p.x, 0, p.y);
    if (this.mode === 'first') {
      const eye = EYE + world.heightAt(p);
      this.camera.position.set(p.x, eye, p.y);
      this.camera.lookAt(p.x + Math.cos(fpAngle), eye, p.y + Math.sin(fpAngle));
      return;
    }
    // Distance so that about TOP_TILES fit across the shortest side.
    const vfov = (this.camera.fov * Math.PI) / 180;
    const across = this.camera.aspect < 1 ? TOP_TILES / this.camera.aspect : TOP_TILES;
    const distance = across / 2 / Math.tan(vfov / 2);
    // Follow smoothly, but never fall more than a couple of tiles behind.
    const goal = new THREE.Vector3(p.x, 0.5 + world.heightAt(p), p.y);
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
    // The flame breathes in strength, never in reach: the edge of the light holds still.
    const radius = world.lightRadius;
    const height = this.mode === 'first' ? EYE - 0.05 : FLAME_HEIGHT;
    const swayX = Math.sin(t * 2.9) * 0.04 + Math.sin(t * 7.7) * 0.02;
    const swayZ = Math.cos(t * 3.3) * 0.04 + Math.sin(t * 6.1) * 0.02;
    // Start the cone a little behind the hero so the floor at their feet is lit too.
    const back = this.mode === 'first' ? 0 : 0.35;
    this.light.position.set(
      p.x - Math.cos(this.lightAngle) * back + swayX,
      height + world.heightAt(p) + Math.sin(t * 5.1) * 0.03,
      p.y - Math.sin(this.lightAngle) * back + swayZ,
    );
    this.light.target.position.set(p.x + Math.cos(this.lightAngle) * 3, 0.2 + world.heightAt(p) * 0.7, p.y + Math.sin(this.lightAngle) * 3);
    this.light.distance = radius + back + LEVEL_HEIGHT * 1.6;
    cutaway.reach.value = radius + back;
    this.light.angle = world.visionCone;
    this.light.intensity = world.survival.light > 0 && !world.invisible ? FLAME_POWER * flicker : 0;
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
    const day = canvasTexture(sheet.canvas);
    this.heroMaps = { day, night: canvasTexture(chalkCanvas(sheet.canvas)) };
    const material = new THREE.MeshBasicMaterial({ map: day, alphaTest: 0.5, depthTest: false, transparent: true });
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
    hero.place({ x: world.player.x + world.facing.x * lunge, y: world.player.y + world.facing.y * lunge }, this.camera, flip, this.mode, world.heightAt(world.player));
    hero.setFrame(Math.max(0, this.heroSheetFrames().indexOf(frame)));
    const heroMaterial = hero.mesh.material as THREE.MeshBasicMaterial;
    const night = cutaway.night.value > 0.5;
    // Unseen but never lost: faded in the light, a chalk figure in the dark. The alpha cut
    // follows the opacity, or a faded hero would be cut away whole.
    heroMaterial.opacity = night ? 1 : world.invisible ? 0.45 : 1;
    heroMaterial.alphaTest = 0.5 * heroMaterial.opacity;
    if (now < this.effects.heroFlashUntil) heroMaterial.color.setRGB(1, 0.35, 0.3);
    else if (night) heroMaterial.color.setRGB(0.84, 0.87, 0.92);
    else heroMaterial.color.setRGB(1, 1, 1);
    heroMaterial.map = night ? this.heroMaps!.night : this.heroMaps!.day;
    // The flame at the hero's hand.
    const anchor = FLAME_ANCHOR[world.classId];
    const side = flip ? -1 : 1;
    const offset = right.clone().multiplyScalar((anchor.x / 32) * side);
    const up = new THREE.Vector3(0, (-anchor.y / 32) / Math.cos(TOP_TILT), 0);
    this.flame.position.set(world.player.x, world.heightAt(world.player), world.player.y).add(offset).add(up);
    const s = 0.35 + 0.05 * Math.sin(now / 60);
    this.flame.scale.set(s * 0.66, s, 1);
  }

  /** How lit something is at distance `d` from the flame, like the first-person raycaster. */
  private falloff(world: World, d: number): number {
    // The same curve as the light on the walls: inverse square from a flame overhead, faded
    // over the last stretch of the reach.
    const R = world.lightRadius + 0.35;
    if (d >= R) return 0;
    const h = this.mode === 'first' ? 0.6 : FLAME_HEIGHT;
    const light = Math.min(1, ((FLAME_POWER / Math.PI) * 1.2) / (d * d + h * h)) ** 0.6;
    const t = Math.min(1, Math.max(0, (d - R * 0.6) / (R * 0.4)));
    const fade = 1 - t * t * (3 - 2 * t);
    return light * fade;
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
      entry.cutout.place(enemy.pos, this.camera, flip, this.mode, world.heightAt(enemy.pos));
      entry.cutout.setFrame(ENEMY_FRAMES_INDEX[this.enemyFrame(enemy, now)]);
      // Lit only where the hero sees it; telegraphs and hits turn it red.
      const d = Math.hypot(enemy.pos.x - world.player.x, enemy.pos.y - world.player.y);
      const brightness = enemy.visible ? Math.max(this.falloff(world, d), enemy.wax > 0 ? 0.6 : 0) : 0;
      const flash = now < (this.flashUntil.get(enemy.id) ?? 0);
      entry.cutout.shade(entry.material, brightness, flash ? 1 : enemy.state === 'windup' ? 0.6 : 0);
      // Eyes in the dark, at the height of the drawn eyes.
      entry.eyes.visible = enemy.watching;
      if (enemy.watching) {
        entry.eyes.position.set(enemy.pos.x, EYES[enemy.kind].h / 32 + world.heightAt(enemy.pos), enemy.pos.y);
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
      let entry = this.items.get(item.id);
      if (!entry) {
        const obj = outlined(lootModel(item.kind, this.mats), this.mats, 0.008);
        obj.position.set(item.x + 0.5, 0, item.y + 0.5);
        // A touch larger than life, so it reads from above.
        obj.scale.setScalar(1.7);
        // Each lies at its own angle.
        obj.rotation.y = ((item.id * 2654435761) % 1000) / 1000 * Math.PI * 2;
        this.scene.add(obj);
        const glint = new THREE.Sprite(this.glintMaterial);
        glint.scale.set(0.3, 0.3, 1);
        glint.position.set(item.x + 0.5, 0.35, item.y + 0.5);
        this.scene.add(glint);
        entry = { obj, glint };
        this.items.set(item.id, entry);
      }
      // Rat eye: nearby things glint in the dark for the plunderer.
      const tile = item.y * world.level.width + item.x;
      const d = Math.hypot(item.x + 0.5 - world.player.x, item.y + 0.5 - world.player.y);
      entry.glint.visible = world.itemSight > 0 && d <= world.itemSight && !world.visibleNow.has(tile);
    }
    for (const [id, entry] of this.items) {
      if (seen.has(id)) continue;
      this.scene.remove(entry.obj);
      this.scene.remove(entry.glint);
      this.items.delete(id);
    }
  }

  private syncFeatures(world: World): void {
    for (const f of world.level.features) {
      const key = `${f.kind}-${f.kind !== 'fountain' && f.kind !== 'drip' && world.searched.has(f.id)}`;
      let entry = this.features.get(f.id);
      if (entry && entry.key === key) continue;
      if (entry) this.scene.remove(entry.obj);
      const obj = outlined(featureModel(f.kind, this.mats, key.endsWith('true')), this.mats);
      obj.position.set(f.x + 0.5, 0, f.y + 0.5);
      obj.scale.setScalar(1.25);
      obj.rotation.y = ((f.id * 40503) % 360) * (Math.PI / 180);
      this.scene.add(obj);
      entry = { obj, key };
      this.features.set(f.id, entry);
    }
  }

  /** A door hangs across a doorway, or stands open against its wall; a barricade is planks. */
  private syncDoors(world: World): void {
    const level = world.level;
    const seen = new Set<number>();
    const H = 1.5;
    for (const d of level.doorways) {
      const tile = d.y * level.width + d.x;
      const barricade = world.works.find((w) => w.kind === 'barricade' && w.depth === world.depth && w.x === d.x && w.y === d.y);
      const door = world.doorStates.get(tile);
      if (!barricade && (!door || door.state === 'broken')) continue;
      seen.add(tile);
      const shut = level.closed?.has(tile) ?? false;
      const key = `${barricade ? 'b' : 'd'}-${shut}`;
      const entry = this.doors.get(tile);
      if (entry && entry.key === key) continue;
      if (entry) this.scene.remove(entry.obj);
      // Walls on the left and right: the passage runs north–south and the door spans x.
      const acrossX = !isFloor(level, d.x - 1, d.y) && !isFloor(level, d.x + 1, d.y);
      const group = new THREE.Group();
      group.position.set(d.x + 0.5, 0, d.y + 0.5);
      if (!acrossX) group.rotation.y = Math.PI / 2;
      const box = (w: number, h: number, depth: number, x: number, y: number, z: number, rz = 0) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), this.woodMaterial);
        mesh.position.set(x, y, z);
        mesh.rotation.z = rz;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      };
      if (barricade) {
        if (shut) {
          box(1, 0.16, 0.08, 0, 0.45, 0, 0.12);
          box(1, 0.16, 0.08, 0, 0.9, 0.02, -0.15);
          box(1, 0.16, 0.08, 0, 1.3, 0, 0.08);
        } else {
          // Opened: the planks lean against the wall.
          box(0.08, 1.2, 0.16, -0.45, 0.6, 0.2, 0.15);
        }
      } else if (shut) box(0.98, H, 0.1, 0, H / 2, 0);
      else box(0.1, H, 0.9, -0.44, H / 2, 0);
      this.scene.add(group);
      this.doors.set(tile, { obj: group, key });
    }
    for (const [tile, entry] of this.doors) {
      if (seen.has(tile)) continue;
      this.scene.remove(entry.obj);
      this.doors.delete(tile);
    }
  }

  private ropeMeshes: THREE.Mesh[] = [];

  /** A rope tied at this level's pit, and one hanging at the landing from the level above. */
  private syncRopes(world: World): void {
    for (const m of this.ropeMeshes) this.scene.remove(m);
    this.ropeMeshes = [];
    const material = this.woodMaterial;
    const ropeAt = (depth: number) => world.works.some((w) => w.kind === 'rope' && w.depth === depth && w.condition > 0);
    const hang = (x: number, y: number, top: number) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, top, 6), material);
      mesh.position.set(x + 0.5, top / 2 - 0.05, y + 0.5);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.ropeMeshes.push(mesh);
    };
    if (ropeAt(world.depth)) hang(world.level.pit.x, world.level.pit.y, 0.5);
    if (world.depth > 1 && ropeAt(world.depth - 1)) hang(world.level.landing.x, world.level.landing.y, 3);
  }

  private ropeKey = '';

  private syncWorks(world: World, now: number): void {
    const ropeKey = `${world.depth}:${world.works.filter((w) => w.kind === 'rope').map((w) => `${w.depth}-${w.condition > 0}`).join(',')}`;
    if (ropeKey !== this.ropeKey) {
      this.ropeKey = ropeKey;
      this.syncRopes(world);
    }
    const seen = new Set<number>();
    const lit: Array<{ x: number; y: number; d: number }> = [];
    for (const w of world.works) {
      if (w.depth !== world.depth || (w.kind !== 'torch' && w.kind !== 'chalk')) continue;
      seen.add(w.id);
      const burning = w.kind === 'torch' && w.condition > 0;
      const key = w.kind === 'torch' ? `torch-${burning}` : `chalk-${w.sign}`;
      let entry = this.works.get(w.id);
      if (!entry || entry.key !== key) {
        if (entry) this.scene.remove(entry.obj);
        if (entry?.flame) this.scene.remove(entry.flame);
        if (w.kind === 'torch') {
          const obj = outlined(torchModel(this.mats), this.mats);
          obj.position.set(w.x + 0.5, 0, w.y + 0.5);
          const flame = new THREE.Sprite(this.flameMaterial);
        flame.add(this.halo(3.4));
          flame.add(this.halo(3));
          flame.position.set(w.x + 0.5, TORCH_FLAME, w.y + 0.5);
          flame.visible = burning;
          this.scene.add(flame);
          entry = { obj, key, flame };
        } else {
          // Chalk lies on the floor, lit like it.
          const decal = new THREE.Mesh(
            new THREE.PlaneGeometry(0.8, 0.8),
            inkMaterial(new THREE.MeshLambertMaterial({ map: this.chalkTextures.get(w.sign ?? 'arrow')!, transparent: true, depthWrite: false })),
          );
          decal.rotation.set(-Math.PI / 2, 0, -(w.angle ?? 0));
          decal.position.set(w.x + 0.5, 0.006, w.y + 0.5);
          decal.receiveShadow = true;
          entry = { obj: decal, key };
        }
        this.scene.add(entry.obj);
        this.works.set(w.id, entry);
      }
      if (entry.flame && burning) {
        const d = Math.hypot(w.x + 0.5 - world.player.x, w.y + 0.5 - world.player.y);
        const flicker = 1 + Math.sin(now / 80 + w.id) * 0.08;
        entry.flame.scale.set(0.22 * flicker, 0.32 * flicker, 1);
        lit.push({ x: w.x + 0.5, y: w.y + 0.5, d });
      }
    }
    for (const [id, entry] of this.works) {
      if (seen.has(id)) continue;
      this.scene.remove(entry.obj);
      if (entry.flame) this.scene.remove(entry.flame);
      this.works.delete(id);
    }
    // The nearest burning torches get a real light.
    lit.sort((a, b) => a.d - b.d);
    this.torchLights.forEach((light, i) => {
      const torch = lit[i];
      if (!torch || torch.d > 14) {
        light.intensity = 0;
        return;
      }
      const flicker = 1 + Math.sin(now / 80 + i * 2) * 0.07 + Math.sin(now / 31 + i) * 0.05;
      light.position.set(torch.x, TORCH_FLAME, torch.y);
      light.intensity = 2.4 * flicker;
    });
  }

  private syncCamps(world: World, now: number): void {
    const here = world.campInReach;
    const seen = new Set<number>();
    this.campLight.intensity = 0;
    for (const camp of world.camps) {
      if (camp.depth !== world.depth) continue;
      seen.add(camp.id);
      const lit = here === camp && world.campfire;
      let entry = this.camps.get(camp.id);
      if (!entry) {
        const obj = outlined(campModel(this.mats), this.mats);
        obj.position.set(camp.x + 0.5, 0, camp.y + 0.5);
        obj.scale.setScalar(1.4);
        this.scene.add(obj);
        const flame = new THREE.Sprite(this.flameMaterial);
        flame.position.set(camp.x + 0.78, 0.26, camp.y + 0.57);
        this.scene.add(flame);
        entry = { obj, flame };
        this.camps.set(camp.id, entry);
      }
      entry.flame.visible = lit;
      if (lit) {
        const flicker = 1 + Math.sin(now / 90) * 0.08 + Math.sin(now / 37) * 0.05;
        entry.flame.scale.set(0.32 * flicker, 0.42 * flicker, 1);
        this.campLight.position.set(camp.x + 0.7, 0.55, camp.y + 0.55);
        this.campLight.intensity = 3 * flicker;
      }
    }
    for (const [id, entry] of this.camps) {
      if (seen.has(id)) continue;
      this.scene.remove(entry.obj);
      this.scene.remove(entry.flame);
      this.camps.delete(id);
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
