/**
 * Animated ink sprites, drawn procedurally into sprite sheets.
 *
 * Every frame is redrawn with its own wobble, so the lines "boil" slightly between
 * frames like hand-drawn animation. Coordinates are in design units: one unit is one
 * world unit (a tile is 32), multiplied by `s` for the texture resolution.
 */
import type { ClassId } from '../core/classes';
import type { EnemyKind } from '../core/enemies';
import { Rng } from '../core/rng';

const PAPER = '#ece2cb';
const PAPER_SHADE = '#d6c7a6';
const INK = '#211b17';
const BLOOD = '#8b2a1f';

export interface SpriteSheet {
  canvas: HTMLCanvasElement;
  frameWidth: number;
  frameHeight: number;
  frames: string[];
  /** Origin of each frame, as a fraction of its size (where the feet touch the floor). */
  originX: number;
  originY: number;
}

export const HERO_FRAMES = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'attack0', 'attack1'] as const;
export const ENEMY_FRAMES = ['idle0', 'idle1', 'move0', 'move1', 'move2', 'move3', 'windup'] as const;

/** Heroes are drawn around x = 20 and padded on both sides so swung weapons fit. */
const HERO_PAD = 10;
export const HERO_SIZE = { w: 40 + HERO_PAD * 2, h: 54 };

/** Where each hero holds the flame, in design units relative to the feet (facing right). */
export const FLAME_ANCHOR: Record<ClassId, { x: number; y: number }> = {
  headsman: { x: -10, y: -32 },
  plunderer: { x: -9, y: -19 },
  candlebearer: { x: -9.5, y: -47 },
};

interface Pen {
  ctx: CanvasRenderingContext2D;
  s: number;
  rng: Rng;
}

function sheet(frames: readonly string[], w: number, h: number, s: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * s) * frames.length;
  c.height = Math.ceil(h * s);
  const ctx = c.getContext('2d')!;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return [c, ctx];
}

/** Moves the pen to frame `i` and returns a fresh wobble for it. */
function frame(ctx: CanvasRenderingContext2D, i: number, w: number, s: number, seed: string, padX = 0): Rng {
  ctx.setTransform(1, 0, 0, 1, Math.ceil(w * s) * i + padX * s, 0);
  return new Rng(`${seed}-${i}`);
}

const j = (p: Pen, amount = 0.35) => p.rng.range(-amount, amount);

/** A shaky polyline through the given points (design units). */
function line(p: Pen, points: Array<[number, number]>, width: number, color = INK): void {
  const { ctx, s } = p;
  ctx.strokeStyle = color;
  ctx.lineWidth = width * s;
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    const px = (x + j(p)) * s;
    const py = (y + j(p)) * s;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

/** A filled shape with a shaky outline. */
function shape(p: Pen, points: Array<[number, number]>, fill: string, outline = 1.8, close = true): void {
  const { ctx, s } = p;
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    const px = (x + j(p, 0.25)) * s;
    const py = (y + j(p, 0.25)) * s;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  if (close) ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = outline * p.s;
    ctx.stroke();
  }
}

function ellipse(p: Pen, x: number, y: number, rx: number, ry: number, fill: string, outline = 0, rotation = 0): void {
  const { ctx, s } = p;
  ctx.beginPath();
  ctx.ellipse((x + j(p, 0.2)) * s, (y + j(p, 0.2)) * s, rx * s, ry * s, rotation, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = outline * s;
    ctx.stroke();
  }
}

/** Parallel hatching inside a polygon, for shading. */
function shade(p: Pen, points: Array<[number, number]>, spacing: number, angle = -0.9, width = 0.7): void {
  const { ctx, s } = p;
  ctx.save();
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * s, y * s) : ctx.lineTo(x * s, y * s)));
  ctx.closePath();
  ctx.clip();
  const xs = points.map((q) => q[0]);
  const ys = points.map((q) => q[1]);
  const minX = Math.min(...xs) - 20;
  const maxX = Math.max(...xs) + 20;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let x = minX; x < maxX; x += spacing) {
    line(p, [
      [x, maxY + 2],
      [x + (dx / -dy) * (maxY - minY + 4), minY - 2],
    ], width);
  }
  ctx.restore();
}

/** Turns a point around a pivot. */
function rot(px: number, py: number, cx: number, cy: number, a: number): [number, number] {
  const c = Math.cos(a);
  const sn = Math.sin(a);
  return [cx + (px - cx) * c - (py - cy) * sn, cy + (px - cx) * sn + (py - cy) * c];
}

// Heroes --------------------------------------------------------------------------

interface HeroPose {
  bob: number;
  /** Leg swing from -1 to 1. */
  step: number;
  weapon: 'rest' | 'raise' | 'strike';
}

const HERO_POSES: Record<(typeof HERO_FRAMES)[number], HeroPose> = {
  idle0: { bob: 0, step: 0, weapon: 'rest' },
  idle1: { bob: 0.7, step: 0, weapon: 'rest' },
  walk0: { bob: 0, step: 1, weapon: 'rest' },
  walk1: { bob: -1, step: 0, weapon: 'rest' },
  walk2: { bob: 0, step: -1, weapon: 'rest' },
  walk3: { bob: -1, step: 0, weapon: 'rest' },
  attack0: { bob: 0.5, step: 0.4, weapon: 'raise' },
  attack1: { bob: -0.5, step: -0.5, weapon: 'strike' },
};

function legs(p: Pen, pose: HeroPose, hipY: number, spread: number): void {
  const swing = pose.step * 3;
  line(p, [
    [20 - spread, hipY],
    [20 - spread + swing, 51],
  ], 2.4);
  line(p, [
    [20 + spread, hipY],
    [20 + spread - swing, 51],
  ], 2.4);
  ellipse(p, 20 - spread + swing + 1, 51.5, 2.6, 1.3, INK);
  ellipse(p, 20 + spread - swing + 1, 51.5, 2.6, 1.3, INK);
}

function drawHeadsman(p: Pen, pose: HeroPose): void {
  const b = pose.bob;
  legs(p, pose, 38 + b, 3);
  // Broad cloak with shading on the far side.
  const cloak: Array<[number, number]> = [
    [13, 20 + b],
    [27, 20 + b],
    [31, 42 + b],
    [9, 42 + b],
  ];
  shape(p, cloak, PAPER, 2.2);
  shade(p, [
    [22, 20 + b],
    [27, 20 + b],
    [31, 42 + b],
    [24, 42 + b],
  ], 2.2);
  // Leather apron.
  shape(p, [
    [17, 28 + b],
    [23, 28 + b],
    [24, 41 + b],
    [16, 41 + b],
  ], PAPER_SHADE, 1.2);
  line(p, [
    [13, 27 + b],
    [27, 27 + b],
  ], 1.6);
  // Torch in the off hand.
  line(p, [
    [12, 31 + b],
    [10, 21 + b],
  ], 2);
  ellipse(p, 12, 31 + b, 1.8, 1.8, PAPER, 1.2);
  // Executioner's hood: pointed, black, with eye slits.
  shape(p, [
    [14, 21 + b],
    [17, 11 + b],
    [20, 5 + b],
    [23, 11 + b],
    [26, 21 + b],
  ], INK, 1.2);
  ellipse(p, 18, 13.5 + b, 1.3, 0.6, PAPER);
  ellipse(p, 22, 13.5 + b, 1.3, 0.6, PAPER);
  // The axe, swung around the hand.
  const hand: [number, number] = [27, 30 + b];
  const angle = pose.weapon === 'rest' ? -1.15 : pose.weapon === 'raise' ? -2.1 : 0.7;
  const tip = rot(hand[0] + 22, hand[1], hand[0], hand[1], angle);
  line(p, [hand, tip], 2.4);
  const bladeA = rot(tip[0] - 2, tip[1] - 7, tip[0], tip[1], angle + Math.PI / 2);
  const bladeB = rot(tip[0] - 2, tip[1] + 7, tip[0], tip[1], angle + Math.PI / 2);
  const edge = rot(tip[0] - 9, tip[1], tip[0], tip[1], angle + Math.PI / 2);
  shape(p, [tip, bladeA, edge, bladeB], INK, 1.4);
  line(p, [bladeA, edge, bladeB], 0.9, PAPER);
  ellipse(p, hand[0], hand[1], 2, 2, PAPER, 1.4);
}

function drawPlunderer(p: Pen, pose: HeroPose): void {
  const b = pose.bob;
  legs(p, pose, 37 + b, 2.6);
  // Slim, ragged cloak.
  const hem: Array<[number, number]> = [];
  for (let x = 28; x >= 12; x -= 2) hem.push([x, 41 + b + (x % 4 === 0 ? 2 : 0)]);
  shape(p, [[15, 20 + b], [25, 20 + b], ...hem], PAPER, 2);
  shade(p, [
    [21, 20 + b],
    [25, 20 + b],
    [28, 42 + b],
    [22, 42 + b],
  ], 2.6);
  // Belt, satchel and the little lantern hanging from it.
  line(p, [
    [14, 30 + b],
    [26, 30 + b],
  ], 1.4);
  shape(p, [
    [22, 30 + b],
    [27, 30 + b],
    [27, 35 + b],
    [22, 35 + b],
  ], PAPER_SHADE, 1.2);
  line(p, [
    [12, 30 + b],
    [11, 32 + b],
  ], 1);
  shape(p, [
    [9.5, 32 + b],
    [12.5, 32 + b],
    [12.5, 37 + b],
    [9.5, 37 + b],
  ], 'rgba(236, 226, 203, 0.4)', 1.1);
  // Hood and scarf over the face.
  ellipse(p, 20, 13 + b, 6, 6.5, INK);
  shape(p, [
    [15, 15 + b],
    [25, 15 + b],
    [24, 19 + b],
    [16, 19 + b],
  ], PAPER_SHADE, 1);
  ellipse(p, 18, 12.5 + b, 0.9, 0.7, PAPER);
  ellipse(p, 22, 12.5 + b, 0.9, 0.7, PAPER);
  // Two daggers.
  const daggers: Array<[[number, number], number]> =
    pose.weapon === 'rest'
      ? [
          [[26, 32 + b], 1.3],
          [[14, 32 + b], 1.9],
        ]
      : pose.weapon === 'raise'
        ? [
            [[25, 25 + b], -0.6],
            [[16, 26 + b], -2.4],
          ]
        : [
            [[30, 27 + b], 0.05],
            [[18, 30 + b], 0.6],
          ];
  for (const [hand, angle] of daggers) {
    const tip = rot(hand[0] + 9, hand[1], hand[0], hand[1], angle);
    line(p, [hand, tip], 1.6);
    line(p, [rot(hand[0] + 1.5, hand[1] - 2, hand[0], hand[1], angle), rot(hand[0] + 1.5, hand[1] + 2, hand[0], hand[1], angle)], 1.4);
    ellipse(p, hand[0], hand[1], 1.6, 1.6, PAPER, 1.2);
  }
}

function drawCandlebearer(p: Pen, pose: HeroPose): void {
  const b = pose.bob;
  // Feet peeking under a long robe.
  const swing = pose.step * 2.5;
  ellipse(p, 17 + swing, 51.5, 2.6, 1.3, INK);
  ellipse(p, 23 - swing, 51.5, 2.6, 1.3, INK);
  const robe: Array<[number, number]> = [
    [14, 19 + b],
    [26, 19 + b],
    [31, 50],
    [9, 50],
  ];
  shape(p, robe, PAPER, 2);
  shade(p, [
    [21, 19 + b],
    [26, 19 + b],
    [31, 50],
    [23, 50],
  ], 2.4);
  line(p, [
    [16, 30 + b],
    [20, 31 + b],
    [24, 30 + b],
  ], 1.3);
  line(p, [
    [20, 31 + b],
    [19, 38 + b],
  ], 1);
  // The taper on a tall staff: the source of his light.
  line(p, [
    [11, 46 + b],
    [10.5, 10 + b],
  ], 1.8);
  shape(p, [
    [9.3, 10 + b],
    [11.7, 10 + b],
    [11.7, 5.5 + b],
    [9.3, 5.5 + b],
  ], PAPER, 1);
  ellipse(p, 11, 27 + b, 1.8, 1.8, PAPER, 1.2);
  // Cowl with a dark opening.
  ellipse(p, 20, 13 + b, 6.2, 6.5, PAPER, 1.8);
  ellipse(p, 20.5, 14 + b, 3.8, 4.2, INK);
  // Mace.
  const hand: [number, number] = [28, 30 + b];
  const angle = pose.weapon === 'rest' ? 1.2 : pose.weapon === 'raise' ? -1.9 : 0.1;
  const head = rot(hand[0] + 11, hand[1], hand[0], hand[1], angle);
  line(p, [hand, head], 2);
  ellipse(p, head[0], head[1], 3.2, 3.2, INK);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    line(p, [
      [head[0] + Math.cos(a) * 3, head[1] + Math.sin(a) * 3],
      [head[0] + Math.cos(a) * 5, head[1] + Math.sin(a) * 5],
    ], 1.2);
  }
  ellipse(p, hand[0], hand[1], 1.8, 1.8, PAPER, 1.2);
}

export function drawHeroSheet(classId: ClassId, tile: number): SpriteSheet {
  const s = tile / 32;
  const { w, h } = HERO_SIZE;
  const [canvas, ctx] = sheet(HERO_FRAMES, w, h, s);
  const draw = { headsman: drawHeadsman, plunderer: drawPlunderer, candlebearer: drawCandlebearer }[classId];
  HERO_FRAMES.forEach((name, i) => {
    const rng = frame(ctx, i, w, s, `hero-${classId}`, HERO_PAD);
    draw({ ctx, s, rng }, HERO_POSES[name]);
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas, frameWidth: Math.ceil(w * s), frameHeight: Math.ceil(h * s), frames: [...HERO_FRAMES], originX: 0.5, originY: 52 / 54 };
}

// Horrors -------------------------------------------------------------------------

interface EnemyPose {
  phase: number;
  moving: boolean;
  windup: boolean;
  breath: number;
}

const ENEMY_POSES: Record<(typeof ENEMY_FRAMES)[number], EnemyPose> = {
  idle0: { phase: 0, moving: false, windup: false, breath: 0 },
  idle1: { phase: 0, moving: false, windup: false, breath: 1 },
  move0: { phase: 0, moving: true, windup: false, breath: 0 },
  move1: { phase: Math.PI / 2, moving: true, windup: false, breath: 0.5 },
  move2: { phase: Math.PI, moving: true, windup: false, breath: 0 },
  move3: { phase: (3 * Math.PI) / 2, moving: true, windup: false, breath: 0.5 },
  windup: { phase: 0, moving: false, windup: true, breath: 0 },
};

export const ENEMY_SIZE: Record<EnemyKind, { w: number; h: number; originY: number }> = {
  crawler: { w: 40, h: 28, originY: 0.78 },
  husk: { w: 48, h: 56, originY: 0.95 },
  mourner: { w: 34, h: 54, originY: 0.95 },
  snuffer: { w: 36, h: 54, originY: 0.95 },
};

function drawCrawler(p: Pen, pose: EnemyPose): void {
  const lift = pose.windup ? -3 : 0;
  const cy = 15 + lift;
  // Six legs scuttling in alternating pairs.
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const k = i % 3;
    const swing = pose.moving ? Math.sin(pose.phase + k * 2.1 + (side > 0 ? Math.PI : 0)) * 3 : 0;
    const spread = pose.windup ? 3 : 0;
    const knee: [number, number] = [20 + side * (9 + k * 1.5 + spread), cy - 4 + k * 2 + swing * 0.4];
    const foot: [number, number] = [20 + side * (14 + k * 2 + spread), 24 + k * 0.5 + swing];
    line(p, [[20 + side * 4, cy - 1 + k * 2], knee, foot], 1.5);
  }
  ellipse(p, 20, cy, 8.5, 6.2 + pose.breath * 0.3, INK);
  // Pale back markings and eyes.
  line(p, [
    [16, cy - 3],
    [20, cy - 4.5],
    [24, cy - 3],
  ], 0.8, PAPER_SHADE);
  ellipse(p, 16.5, cy - 0.5, 1.1, 1, PAPER);
  ellipse(p, 19, cy - 1.2, 0.9, 0.8, PAPER);
  ellipse(p, 23.5, cy - 0.5, 1.1, 1, PAPER);
  if (pose.windup) {
    // Mandibles open.
    line(p, [
      [17, cy + 4],
      [15, cy + 8],
    ], 1.4, BLOOD);
    line(p, [
      [23, cy + 4],
      [25, cy + 8],
    ], 1.4, BLOOD);
  }
}

function drawHusk(p: Pen, pose: EnemyPose): void {
  const sway = pose.moving ? Math.sin(pose.phase) * 1.6 : 0;
  const stepL = pose.moving ? Math.max(0, Math.sin(pose.phase)) * 2 : 0;
  const stepR = pose.moving ? Math.max(0, -Math.sin(pose.phase)) * 2 : 0;
  const b = pose.breath * 0.6;
  // Thick legs.
  line(p, [
    [17 + sway, 40],
    [16, 53 - stepL],
  ], 4);
  line(p, [
    [28 + sway, 40],
    [29, 53 - stepR],
  ], 4);
  // Hunched mass.
  const body: Array<[number, number]> = [
    [10 + sway, 44],
    [6 + sway, 30 + b],
    [11 + sway, 17 + b],
    [22 + sway, 13 + b],
    [33 + sway, 18 + b],
    [37 + sway, 31],
    [34 + sway, 44],
  ];
  shape(p, body, PAPER, 2.6);
  shade(p, [
    [24 + sway, 13],
    [33 + sway, 18],
    [37 + sway, 31],
    [34 + sway, 44],
    [26 + sway, 44],
  ], 1.8);
  // Stitched seams across the body.
  for (let i = 0; i < 3; i++) {
    const y = 24 + i * 6 + b;
    line(p, [
      [11 + sway, y],
      [32 + sway, y + 1],
    ], 0.9);
    for (let x = 13; x < 31; x += 3) line(p, [[x + sway, y - 1], [x + sway + 0.5, y + 1.5]], 0.7);
  }
  // Small sunken head.
  ellipse(p, 15 + sway, 14 + b, 5, 5, INK);
  ellipse(p, 13.5 + sway, 13.5 + b, 0.9, 0.9, PAPER);
  // The huge arm, raised high when it is about to smash.
  const shoulder: [number, number] = [33 + sway, 21 + b];
  const fist: [number, number] = pose.windup ? [36 + sway, 6] : [39 + sway, 38];
  line(p, [shoulder, fist], 5.5);
  ellipse(p, fist[0], fist[1], 4.5, 4.5, INK);
}

function drawMourner(p: Pen, pose: EnemyPose): void {
  const sway = Math.sin(pose.phase) * (pose.moving ? 1.5 : 0.6) + pose.breath * 0.4;
  // Veil and robe, with a hem that ripples as it glides.
  const hem: Array<[number, number]> = [];
  for (let i = 0; i <= 8; i++) {
    const x = 28 - i * 2.75;
    hem.push([x, 52 + Math.sin(pose.phase * 2 + i) * (pose.moving ? 1.6 : 0.6)]);
  }
  shape(p, [[17 + sway, 3], [24 + sway * 0.6, 14], ...hem, [10 + sway * 0.6, 14]], PAPER, 2);
  for (const x of [12, 15.5, 19, 22.5]) {
    line(p, [
      [x + sway * 0.7, 16],
      [x + sway * 0.2 + j(p, 1), 50],
    ], 0.8);
  }
  // Dark face behind the veil, pale sorrowful eyes, and ink running from them.
  ellipse(p, 17 + sway * 0.8, 12, 3.8, 4.6, INK);
  line(p, [
    [16.4 + sway * 0.8, 11.6],
    [14.4 + sway * 0.8, 12.7],
  ], 1.1, PAPER);
  line(p, [
    [17.6 + sway * 0.8, 11.6],
    [19.6 + sway * 0.8, 12.7],
  ], 1.1, PAPER);
  line(p, [
    [15.5 + sway, 15],
    [15 + sway, 22],
  ], 1.1);
  line(p, [
    [18.5 + sway, 15],
    [19 + sway, 21],
  ], 1.1);
  if (pose.windup) {
    // Arms open, head thrown back.
    line(p, [
      [12 + sway, 20],
      [3, 14],
    ], 1.6);
    line(p, [
      [22 + sway, 20],
      [31, 14],
    ], 1.6);
    ellipse(p, 17 + sway, 17, 1.6, 2.2, BLOOD);
  }
}

function drawSnuffer(p: Pen, pose: EnemyPose): void {
  const lean = pose.moving ? 2.5 : 0;
  const twitch = Math.sin(pose.phase * 3) * 0.8;
  // A thin smear of shadow.
  shape(p, [
    [18 + lean, 4],
    [23 + lean * 0.5, 18],
    [21, 51],
    [15, 51],
    [13 + lean * 0.5, 18],
  ], 'rgba(33, 27, 23, 0.85)', 0);
  // Long arms and longer fingers.
  for (const side of [-1, 1]) {
    const reach = pose.windup ? 8 : 0;
    const shoulder: [number, number] = [18 + lean + side * 3, 16];
    const hand: [number, number] = [18 + lean + side * (11 + reach * 0.5), 30 - reach];
    line(p, [shoulder, hand], 1.3);
    for (let f = -1; f <= 1; f++) {
      line(p, [hand, [hand[0] + side * (3 + Math.abs(f)) + twitch, hand[1] + 5 + f * 1.5 - reach * 0.4]], 0.8);
    }
  }
  ellipse(p, 16.5 + lean, 9, 0.9, 0.9, PAPER);
  ellipse(p, 19.5 + lean, 9, 0.9, 0.9, PAPER);
}

export function drawEnemySheet(kind: EnemyKind, tile: number): SpriteSheet {
  const s = tile / 32;
  const { w, h, originY } = ENEMY_SIZE[kind];
  const [canvas, ctx] = sheet(ENEMY_FRAMES, w, h, s);
  const draw = { crawler: drawCrawler, husk: drawHusk, mourner: drawMourner, snuffer: drawSnuffer }[kind];
  ENEMY_FRAMES.forEach((name, i) => {
    const rng = frame(ctx, i, w, s, `enemy-${kind}`);
    draw({ ctx, s, rng }, ENEMY_POSES[name]);
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas, frameWidth: Math.ceil(w * s), frameHeight: Math.ceil(h * s), frames: [...ENEMY_FRAMES], originX: 0.5, originY };
}
