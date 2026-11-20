import { ageStage, type Dynasty, type Member } from '../core/dynasty';
import { Rng } from '../core/rng';

const INK = '#211b17';
const PAPER = '#ece2cb';
const PAPER_DARK = '#d9cba9';
const BLOOD = '#8b2a1f';

/**
 * A member's portrait, drawn in ink like a sketch in a family register. The face comes
 * from the dynasty seed and the member, so it never changes; age and some traits show on
 * it (grey hair, scars, an eye patch, burns, a hunched back).
 */
export function drawPortrait(dynasty: Dynasty, member: Member, size = 120): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * 1.2 * dpr);
  c.style.width = `${size}px`;
  c.style.height = `${size * 1.2}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale((size * dpr) / 100, (size * dpr) / 100);
  paint(ctx, dynasty, member);
  return c;
}

function paint(ctx: CanvasRenderingContext2D, dynasty: Dynasty, member: Member): void {
  const rng = Rng.derive(dynasty.seed, 'portrait', member.id);
  const has = (id: string) => member.traits.includes(id);
  const stage = ageStage(dynasty, member);
  const old = stage === 'old';
  const young = stage === 'young';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Background: a hatched oval, like an engraved frame.
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 100, 120);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(50, 58, 46, 56, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = PAPER_DARK;
  ctx.fillRect(0, 0, 100, 120);
  ctx.strokeStyle = 'rgba(33, 27, 23, 0.35)';
  ctx.lineWidth = 0.6;
  for (let k = -120; k < 100; k += 3.2) {
    ctx.beginPath();
    ctx.moveTo(k, 120);
    ctx.lineTo(k + 120, 0);
    ctx.stroke();
  }

  // Build.
  const faceW = rng.range(15, 19) * (young ? 0.92 : 1);
  const faceH = rng.range(20, 24) * (young ? 0.92 : 1);
  const shoulders = rng.range(30, 38) + (has('giant') || has('broadBack') ? 6 : 0) - (has('slight') ? 5 : 0);
  const hunch = has('hunchedBack') ? 6 : 0;
  const cx = 50;
  const cy = 50 + hunch * 0.6 + (young ? 3 : 0);
  const jaw = rng.range(0.55, 1);
  const hairStyle = rng.int(0, 5);
  const grey = old || has('greyHair');
  const beard = !young && rng.chance(0.3);
  const cloak = rng.pick(['hood', 'collar', 'plain'] as const);

  // Shoulders and cloak.
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - shoulders, 122);
  ctx.quadraticCurveTo(cx - shoulders, cy + faceH + 8 + hunch, cx - 8, cy + faceH + 2);
  ctx.lineTo(cx + 8, cy + faceH + 2);
  ctx.quadraticCurveTo(cx + shoulders, cy + faceH + 8 - hunch * 0.5, cx + shoulders, 122);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Folds.
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const x = cx + rng.range(-shoulders * 0.7, shoulders * 0.7);
    ctx.beginPath();
    ctx.moveTo(x, 122);
    ctx.quadraticCurveTo(x + rng.range(-3, 3), cy + faceH + 20, x + rng.range(-4, 4), cy + faceH + 12);
    ctx.stroke();
  }
  if (cloak === 'collar') {
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + faceH + 4);
    ctx.lineTo(cx, cy + faceH + 16);
    ctx.lineTo(cx + 14, cy + faceH + 4);
    ctx.stroke();
  }

  // Neck.
  ctx.lineWidth = 1.4;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy + faceH - 4);
  ctx.lineTo(cx - 7, cy + faceH + 6);
  ctx.lineTo(cx + 7, cy + faceH + 6);
  ctx.lineTo(cx + 7, cy + faceH - 4);
  ctx.fill();
  ctx.stroke();

  // Hood behind the head.
  if (cloak === 'hood') {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 2, faceW + 9, faceH + 9, 0, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineTo(cx + faceW + 12, cy + faceH + 6);
    ctx.lineTo(cx - faceW - 12, cy + faceH + 6);
    ctx.closePath();
    ctx.fill();
  }

  // Long hair falls behind the face.
  if (hairStyle === 2 || hairStyle === 4) {
    ctx.fillStyle = grey ? PAPER : INK;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(cx - faceW - 3, cy - 6);
    ctx.quadraticCurveTo(cx - faceW - 6, cy + faceH + 6, cx - faceW + 2, cy + faceH + (hairStyle === 4 ? 16 : 8));
    ctx.lineTo(cx + faceW - 2, cy + faceH + (hairStyle === 4 ? 16 : 8));
    ctx.quadraticCurveTo(cx + faceW + 6, cy + faceH + 6, cx + faceW + 3, cy - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (grey) hairStrokes(ctx, rng, cx, cy + 4, faceW + 4, faceH);
  }

  // Face.
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(cx - faceW, cy - 4);
  ctx.bezierCurveTo(cx - faceW, cy - faceH * 1.25, cx + faceW, cy - faceH * 1.25, cx + faceW, cy - 4);
  ctx.bezierCurveTo(cx + faceW, cy + faceH * 0.6, cx + faceW * jaw * 0.5, cy + faceH, cx, cy + faceH);
  ctx.bezierCurveTo(cx - faceW * jaw * 0.5, cy + faceH, cx - faceW, cy + faceH * 0.6, cx - faceW, cy - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Shade on one side of the face.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(33, 27, 23, 0.5)';
  ctx.lineWidth = 0.6;
  for (let k = 0; k < 7; k++) {
    const x = cx + faceW - 2 - k * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, cy - 6);
    ctx.lineTo(x - 2, cy + faceH);
    ctx.stroke();
  }
  ctx.restore();

  // Eyes.
  const eyeY = cy - 3 + rng.range(-1.5, 1.5);
  const eyeGap = faceW * rng.range(0.38, 0.5);
  const eyeSize = has('owlEyes') ? 2.6 : rng.range(1.4, 2);
  const slit = has('catEyes');
  ctx.fillStyle = INK;
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    const x = cx + side * eyeGap;
    if (has('oneEyed') && side === 1) {
      // An eye patch and its strap.
      ctx.beginPath();
      ctx.ellipse(x, eyeY, 4.2, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 4, eyeY - 2);
      ctx.lineTo(cx - faceW, eyeY - 8);
      ctx.moveTo(x + 4, eyeY - 1);
      ctx.lineTo(cx + faceW, eyeY - 4);
      ctx.stroke();
      continue;
    }
    ctx.beginPath();
    ctx.ellipse(x, eyeY, eyeSize * 1.8, eyeSize, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    if (slit) ctx.ellipse(x, eyeY, eyeSize * 0.35, eyeSize * 0.95, 0, 0, Math.PI * 2);
    else ctx.arc(x, eyeY, eyeSize * 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Brows.
    const tilt = rng.range(-1.5, 1.5);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - side * 4, eyeY - 4.5 + tilt);
    ctx.lineTo(x + side * 3.5, eyeY - 5.2 - tilt * 0.3);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    if (old || has('tiredEyes') || has('sleepless')) {
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(x, eyeY + 1.5, 3, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      ctx.lineWidth = 1.2;
    }
  }

  // Nose and mouth.
  const noseLen = rng.range(5, 9);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(cx - 0.5, eyeY + 1);
  ctx.quadraticCurveTo(cx + rng.range(1, 3), eyeY + noseLen * 0.6, cx + 1.5, eyeY + noseLen);
  ctx.lineTo(cx - 2, eyeY + noseLen + 0.5);
  ctx.stroke();
  const mouthY = eyeY + noseLen + rng.range(4.5, 6.5);
  const mouthW = rng.range(3.5, 6);
  const mood = rng.range(-1.5, 0.8);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(cx - mouthW, mouthY);
  ctx.quadraticCurveTo(cx, mouthY - mood, cx + mouthW, mouthY);
  ctx.stroke();

  // Age.
  if (old) {
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 7 + i, eyeY - 10 - i * 2);
      ctx.quadraticCurveTo(cx, eyeY - 11 - i * 2, cx + 7 - i, eyeY - 10 - i * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - mouthW - 2, mouthY - 5);
    ctx.lineTo(cx - mouthW - 1, mouthY + 1);
    ctx.moveTo(cx + mouthW + 2, mouthY - 5);
    ctx.lineTo(cx + mouthW + 1, mouthY + 1);
    ctx.stroke();
  }

  // Beard.
  if (beard) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - faceW + 1, cy + 2);
    ctx.bezierCurveTo(cx - faceW, cy + faceH * 0.9, cx - 4, cy + faceH + 5, cx, cy + faceH + 5);
    ctx.bezierCurveTo(cx + 4, cy + faceH + 5, cx + faceW, cy + faceH * 0.9, cx + faceW - 1, cy + 2);
    ctx.quadraticCurveTo(cx, mouthY + 4, cx - faceW + 1, cy + 2);
    ctx.fillStyle = grey ? PAPER : INK;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (grey) {
      ctx.clip();
      hairStrokes(ctx, rng, cx, cy + faceH * 0.6, faceW, faceH * 0.5);
    }
    ctx.restore();
  }

  // Hair on top.
  hairTop(ctx, rng, hairStyle, cx, cy, faceW, faceH, grey);

  // Marks of the trade.
  if (has('scar')) {
    const sx = cx - eyeGap - 2;
    ctx.strokeStyle = BLOOD;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx - 3, eyeY - 7);
    ctx.lineTo(sx + 4, eyeY + 9);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const t = 0.15 + i * 0.22;
      const px = sx - 3 + 7 * t;
      const py = eyeY - 7 + 16 * t;
      ctx.beginPath();
      ctx.moveTo(px - 1.6, py + 0.6);
      ctx.lineTo(px + 1.6, py - 0.6);
      ctx.stroke();
    }
  }
  if (has('burnt')) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx + faceW * 0.5, cy + faceH * 0.35, 6, 5, 0.4, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(139, 42, 31, 0.7)';
    ctx.lineWidth = 0.7;
    for (let k = -10; k < 10; k += 1.5) {
      ctx.beginPath();
      ctx.moveTo(cx + faceW * 0.5 + k, cy + faceH * 0.35 - 6);
      ctx.lineTo(cx + faceW * 0.5 + k + 4, cy + faceH * 0.35 + 6);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  // The fallen and the dead of age keep their portrait, crossed out in the register.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(50, 58, 46, 56, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (member.status !== 'alive') {
    ctx.strokeStyle = member.status === 'fallen' ? BLOOD : INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(18, 18);
    ctx.lineTo(82, 100);
    ctx.stroke();
  }
}

function hairStrokes(ctx: CanvasRenderingContext2D, rng: Rng, cx: number, cy: number, w: number, h: number): void {
  ctx.strokeStyle = 'rgba(33, 27, 23, 0.55)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 18; i++) {
    const x = cx + rng.range(-w, w);
    const y = cy + rng.range(-h * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + rng.range(-2, 2), y + 4, x + rng.range(-1, 1), y + 8);
    ctx.stroke();
  }
}

function hairTop(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  style: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  grey: boolean,
): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.fillStyle = grey ? PAPER : INK;
  const top = cy - h * 0.95;
  if (style === 0) {
    // Shaved: a few strokes of stubble.
    ctx.strokeStyle = 'rgba(33, 27, 23, 0.45)';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 14; i++) {
      const x = cx + rng.range(-w * 0.8, w * 0.8);
      const y = top + rng.range(1, 6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.5, y + 1.6);
      ctx.stroke();
    }
    return;
  }
  ctx.beginPath();
  ctx.moveTo(cx - w - 1, cy - 2);
  ctx.bezierCurveTo(cx - w - 3, top - 8, cx + w + 3, top - 8, cx + w + 1, cy - 2);
  const fringe = style === 3 ? 4 : rng.range(6, 10);
  // A ragged fringe.
  const steps = 7;
  for (let i = steps; i >= 0; i--) {
    const x = cx - w + (2 * w * i) / steps;
    const y = cy - h * 0.55 + (i % 2 === 0 ? 0 : fringe * 0.4) - fringe * 0.3;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (grey) {
    ctx.save();
    ctx.clip();
    hairStrokes(ctx, rng, cx, top + 4, w, 10);
    ctx.restore();
  }
  if (style === 5) {
    // A knot on top.
    ctx.beginPath();
    ctx.ellipse(cx, top - 6, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
