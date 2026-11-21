import { isBridge, isChasm, isDeep, isFloor, isShallow, isVoid } from '../core/dungeon';
import type { World } from '../core/world';

const PAPER = '#ece2cb';
const PAPER_DARK = '#d9cba9';
const INK = '#211b17';
const BLOOD = '#8b2a1f';

/** What the dynasty knows besides the tiles: where its heroes fell on this level. */
export interface MapExtras {
  deaths?: Array<{ x: number; y: number; name: string }>;
}

/** Where the map looks: the tile at its centre and how many pixels a tile takes. */
export interface MapView {
  cx: number;
  cy: number;
  zoom: number;
}

export const MAP_ZOOM = { min: 5, max: 48, start: 22 };

/** Marks of the map, shared by the map and its legend. */
export type MapMark = 'hero' | 'down' | 'up' | 'camp' | 'fountain' | 'pit' | 'rubble' | 'bridge' | 'chasm' | 'death' | 'shallow' | 'deep' | 'waterfall';

/** Draws one mark centred on (x, y), `r` pixels across from the centre. */
export function drawMark(ctx: CanvasRenderingContext2D, mark: MapMark, x: number, y: number, r: number, angle = -Math.PI / 2): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.2, r / 4);
  switch (mark) {
    case 'hero': {
      // An arrow pointing where the hero faces, in a ring.
      ctx.fillStyle = 'rgba(139, 42, 31, 0.18)';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = BLOOD;
      ctx.beginPath();
      ctx.moveTo(r * 1.15, 0);
      ctx.lineTo(-r * 0.8, r * 0.8);
      ctx.lineTo(-r * 0.35, 0);
      ctx.lineTo(-r * 0.8, -r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = Math.max(1.2, r / 5);
      ctx.stroke();
      break;
    }
    case 'down':
    case 'up': {
      // A square of ink with steps, and a triangle saying which way.
      ctx.fillStyle = mark === 'down' ? INK : PAPER;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.strokeRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = mark === 'down' ? PAPER : INK;
      ctx.beginPath();
      const s = mark === 'down' ? 1 : -1;
      ctx.moveTo(x - r * 0.6, y - r * 0.35 * s);
      ctx.lineTo(x + r * 0.6, y - r * 0.35 * s);
      ctx.lineTo(x, y + r * 0.55 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'camp':
      ctx.fillStyle = '#d9822b';
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.9, y + r * 0.7);
      ctx.lineTo(x - r * 0.9, y + r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'fountain':
      ctx.fillStyle = '#7d93a3';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'pit':
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'rubble':
      ctx.fillStyle = PAPER_DARK;
      for (const [fx, fy, fr] of [[-0.4, 0.25, 0.42], [0.38, 0.22, 0.45], [0, -0.35, 0.42]]) {
        ctx.beginPath();
        ctx.arc(x + fx * r, y + fy * r, fr * r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    case 'bridge':
      ctx.fillStyle = '#b48a5a';
      ctx.fillRect(x - r, y - r * 0.55, r * 2, r * 1.1);
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(x + i * r * 0.5, y - r * 0.55);
        ctx.lineTo(x + i * r * 0.5, y + r * 0.55);
      }
      ctx.stroke();
      ctx.strokeRect(x - r, y - r * 0.55, r * 2, r * 1.1);
      break;
    case 'chasm':
      ctx.fillStyle = 'rgba(20, 16, 13, 0.9)';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      break;
    case 'shallow':
      ctx.fillStyle = PAPER_DARK;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = 'rgba(125, 147, 163, 0.45)';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      break;
    case 'waterfall':
      ctx.fillStyle = '#7d93a3';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = Math.max(1, r / 5);
      ctx.beginPath();
      for (const dx of [-0.35, 0, 0.35]) {
        ctx.moveTo(x + dx * r, y - r * 0.55);
        ctx.lineTo(x + dx * r, y + r * 0.55);
      }
      ctx.stroke();
      break;
    case 'deep':
      ctx.fillStyle = 'rgba(70, 92, 108, 0.85)';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      break;
    case 'death':
      ctx.strokeStyle = BLOOD;
      ctx.lineWidth = Math.max(1.5, r / 3);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, y - r * 0.8);
      ctx.lineTo(x + r * 0.8, y + r * 0.8);
      ctx.moveTo(x + r * 0.8, y - r * 0.8);
      ctx.lineTo(x - r * 0.8, y + r * 0.8);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** A place worth finding, with what the map knows about where it is. */
interface Landmark {
  mark: MapMark;
  x: number;
  y: number;
  label?: string;
}

/**
 * The hero's map: only what has been seen, drawn like a sketch on paper, looking at
 * `view`. Landmarks out of sight get an arrow on the edge pointing their way.
 */
export function drawMap(canvas: HTMLCanvasElement, world: World, extras: MapExtras = {}, view?: MapView, labels: Partial<Record<MapMark, string>> = {}): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = rect.width;
  const H = rect.height;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const { level, explored, fx } = world;
  const v = view ?? { cx: world.player.x, cy: world.player.y, zoom: MAP_ZOOM.start };
  const size = v.zoom;
  const offX = W / 2 - v.cx * size;
  const offY = H / 2 - v.cy * size;
  const minX = Math.max(0, Math.floor(-offX / size) - 1);
  const minY = Math.max(0, Math.floor(-offY / size) - 1);
  const maxX = Math.min(level.width - 1, Math.ceil((W - offX) / size) + 1);
  const maxY = Math.min(level.height - 1, Math.ceil((H - offY) / size) + 1);
  const at = (x: number, y: number) => ({ x: offX + x * size, y: offY + y * size });
  const seen = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < level.width && y < level.height && explored[y * level.width + x] === 1;

  // Explored floor, slightly darker than the page.
  ctx.fillStyle = PAPER_DARK;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!seen(x, y) || !isFloor(level, x, y)) continue;
      const p = at(x, y);
      ctx.fillRect(p.x, p.y, size + 0.5, size + 0.5);
      if (isShallow(level, x, y)) {
        ctx.fillStyle = 'rgba(125, 147, 163, 0.45)';
        ctx.fillRect(p.x, p.y, size + 0.5, size + 0.5);
        ctx.fillStyle = PAPER_DARK;
      }
    }
  }
  // Bridges: planks across the drop.
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(0.6, size / 12);
  for (const tile of level.bridges) {
    const x = tile % level.width;
    const y = Math.floor(tile / level.width);
    if (!seen(x, y)) continue;
    const p = at(x, y);
    const alongX = isChasm(level, x, y - 1) || isChasm(level, x, y + 1) || isBridge(level, x, y - 1) || isBridge(level, x, y + 1);
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      if (alongX) {
        ctx.moveTo(p.x + (i / 4) * size, p.y + size * 0.1);
        ctx.lineTo(p.x + (i / 4) * size, p.y + size * 0.9);
      } else {
        ctx.moveTo(p.x + size * 0.1, p.y + (i / 4) * size);
        ctx.lineTo(p.x + size * 0.9, p.y + (i / 4) * size);
      }
    }
    ctx.stroke();
  }

  // Walls: hatched where they touch a seen floor, outlined along the floor.
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  for (let y = minY - 1; y <= maxY + 1; y++) {
    for (let x = minX - 1; x <= maxX + 1; x++) {
      if (isFloor(level, x, y)) continue;
      // Open air over the level below: drawn as a drop, not a wall.
      // Deep water: a dark blue to walk around.
      if (isDeep(level, x, y)) {
        if (!seen(x, y)) continue;
        const v = at(x, y);
        ctx.fillStyle = 'rgba(70, 92, 108, 0.85)';
        ctx.fillRect(v.x, v.y, size + 0.5, size + 0.5);
        continue;
      }
      // A chasm: solid ink, no bottom.
      if (isChasm(level, x, y)) {
        if (!seen(x, y)) continue;
        const v = at(x, y);
        ctx.fillStyle = 'rgba(20, 16, 13, 0.9)';
        ctx.fillRect(v.x, v.y, size + 0.5, size + 0.5);
        continue;
      }
      if (isVoid(level, x, y)) {
        if (!seen(x, y)) continue;
        const v = at(x, y);
        ctx.fillStyle = 'rgba(33, 27, 23, 0.55)';
        ctx.fillRect(v.x, v.y, size + 0.5, size + 0.5);
        continue;
      }
      const touches = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => seen(x + dx, y + dy) && isFloor(level, x + dx, y + dy));
      if (!touches) continue;
      const p = at(x, y);
      ctx.lineWidth = Math.max(0.6, size / 14);
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(p.x + (i / 4) * size, p.y + size);
        ctx.lineTo(p.x + size, p.y + (i / 4) * size);
        ctx.stroke();
      }
      ctx.lineWidth = Math.max(1, size / 7);
      ctx.beginPath();
      if (seen(x, y + 1) && isFloor(level, x, y + 1)) {
        ctx.moveTo(p.x, p.y + size);
        ctx.lineTo(p.x + size, p.y + size);
      }
      if (seen(x, y - 1) && isFloor(level, x, y - 1)) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + size, p.y);
      }
      if (seen(x + 1, y) && isFloor(level, x + 1, y)) {
        ctx.moveTo(p.x + size, p.y);
        ctx.lineTo(p.x + size, p.y + size);
      }
      if (seen(x - 1, y) && isFloor(level, x - 1, y)) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + size);
      }
      ctx.stroke();
    }
  }

  // Pace Counter: the way the hero walked on this level.
  if (fx.mapPath) {
    ctx.fillStyle = 'rgba(139, 42, 31, 0.35)';
    for (const tile of world.path) {
      const p = at((tile % level.width) + 0.5, Math.floor(tile / level.width) + 0.5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, size * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Items: those seen (Retentive), and food that can be smelled nearby (Hound Nose).
  if (fx.mapItems || fx.mapFood) {
    for (const item of level.items) {
      if (world.taken.has(item.id)) continue;
      const near = Math.hypot(item.x + 0.5 - world.player.x, item.y + 0.5 - world.player.y) < 10;
      const show = (fx.mapItems && seen(item.x, item.y)) || (fx.mapFood && (item.kind === 'ration' || item.kind === 'marchRation') && near);
      if (!show) continue;
      const p = at(item.x + 0.5, item.y + 0.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, size / 10);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, size * 0.22), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Marks are never smaller than a fingertip can tell apart.
  const markR = Math.max(5, size * 0.4);

  // Fountains, once seen: water is geography.
  for (const f of level.features) {
    if (f.kind !== 'fountain' || !seen(f.x, f.y)) continue;
    const p = at(f.x + 0.5, f.y + 0.5);
    drawMark(ctx, 'fountain', p.x, p.y, markR);
  }

  const landmarks: Landmark[] = [];
  // Waterfalls, once seen: down a sinkhole here, or in from the level above.
  for (const p of [level.sink, level.fall]) {
    if (!p || !seen(p.x, p.y)) continue;
    const c = at(p.x + 0.5, p.y + 0.5);
    drawMark(ctx, 'waterfall', c.x, c.y, markR);
    landmarks.push({ mark: 'waterfall', x: p.x + 0.5, y: p.y + 0.5 });
  }

  // The family's camps on this level: known to all, seen or not.
  for (const camp of world.camps) {
    if (camp.depth !== world.depth) continue;
    const p = at(camp.x + 0.5, camp.y + 0.5);
    drawMark(ctx, 'camp', p.x, p.y, markR * 1.1);
    landmarks.push({ mark: 'camp', x: camp.x + 0.5, y: camp.y + 0.5 });
  }

  // The pit, once seen, and its rope; a rope down from above at the landing.
  if (seen(level.pit.x, level.pit.y)) {
    const p = at(level.pit.x + 0.5, level.pit.y + 0.5);
    drawMark(ctx, 'pit', p.x, p.y, markR);
    landmarks.push({ mark: 'pit', x: level.pit.x + 0.5, y: level.pit.y + 0.5 });
    if (world.works.some((w) => w.kind === 'rope' && w.depth === world.depth)) {
      ctx.strokeStyle = '#b48a5a';
      ctx.lineWidth = Math.max(1.5, size / 8);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - size * 0.8);
      ctx.stroke();
    }
  }
  if (world.depth > 1 && world.works.some((w) => w.kind === 'rope' && w.depth === world.depth - 1)) {
    const p = at(level.landing.x + 0.5, level.landing.y + 0.5);
    ctx.strokeStyle = '#b48a5a';
    ctx.lineWidth = Math.max(1.5, size / 8);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + size * 0.4);
    ctx.lineTo(p.x, p.y - size * 0.6);
    ctx.stroke();
  }

  // Doors and barricades in seen doorways.
  for (const d of level.doorways) {
    if (!seen(d.x, d.y)) continue;
    const tile = d.y * level.width + d.x;
    const barricade = world.works.some((w) => w.kind === 'barricade' && w.depth === world.depth && w.x === d.x && w.y === d.y);
    const door = world.doorStates.get(tile);
    if (!barricade && (!door || door.state === 'broken')) continue;
    const shut = level.closed?.has(tile) ?? false;
    const p = at(d.x, d.y);
    const acrossX = !isFloor(level, d.x - 1, d.y) && !isFloor(level, d.x + 1, d.y);
    ctx.strokeStyle = barricade ? BLOOD : INK;
    ctx.lineWidth = Math.max(1.5, size / (shut ? 4 : 9));
    ctx.beginPath();
    if (acrossX) {
      ctx.moveTo(p.x, p.y + size / 2);
      ctx.lineTo(p.x + size, p.y + size / 2);
    } else {
      ctx.moveTo(p.x + size / 2, p.y);
      ctx.lineTo(p.x + size / 2, p.y + size);
    }
    ctx.stroke();
  }

  // Collapses: a heap of stones across the corridor.
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER_DARK;
  ctx.lineWidth = Math.max(0.8, size / 12);
  for (const s of world.rubble) {
    if (!seen(s.x, s.y)) continue;
    const p = at(s.x, s.y);
    for (const [fx, fy, fr] of [[0.3, 0.62, 0.2], [0.68, 0.6, 0.22], [0.5, 0.32, 0.2]]) {
      ctx.beginPath();
      ctx.arc(p.x + fx * size, p.y + fy * size, fr * size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // The family's torches and chalk marks on this level.
  for (const w of world.works) {
    if (w.depth !== world.depth) continue;
    const p = at(w.x + 0.5, w.y + 0.5);
    const r = Math.max(3, size * 0.32);
    ctx.lineWidth = Math.max(1, size / 10);
    if (w.kind === 'torch') {
      ctx.fillStyle = w.condition > 0 ? '#d9822b' : PAPER_DARK;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (w.kind === 'chalk') {
      ctx.strokeStyle = BLOOD;
      ctx.beginPath();
      if (w.sign === 'arrow') {
        const a = w.angle ?? 0;
        ctx.moveTo(p.x - Math.cos(a) * r, p.y - Math.sin(a) * r);
        ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
        ctx.lineTo(p.x + Math.cos(a + 2.5) * r * 0.6, p.y + Math.sin(a + 2.5) * r * 0.6);
      } else {
        ctx.font = `bold ${Math.max(9, size * 0.6)}px Georgia, serif`;
        ctx.fillStyle = BLOOD;
        ctx.textAlign = 'center';
        ctx.fillText(w.sign === 'danger' ? '!' : w.sign === 'water' ? '~' : w.sign === 'camp' ? '^' : '=', p.x, p.y + r * 0.5);
      }
      ctx.stroke();
    }
  }

  // Drips, once seen: turbid water.
  for (const f of level.features) {
    if (f.kind !== 'drip' || !seen(f.x, f.y)) continue;
    const p = at(f.x + 0.5, f.y + 0.5);
    ctx.strokeStyle = '#5d6f7d';
    ctx.lineWidth = Math.max(1, size / 10);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2.5, size * 0.25), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Where the family's heroes fell: a cross and a name.
  for (const death of extras.deaths ?? []) {
    const p = at(death.x, death.y);
    drawMark(ctx, 'death', p.x, p.y, markR);
    ctx.fillStyle = INK;
    ctx.font = `italic ${Math.max(10, Math.min(14, size * 0.7))}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText(death.name, p.x, p.y - markR - 3);
  }

  // The flights of steps, down and up, as hatched strips once seen.
  for (const [sw, way] of [[level.down, 'down'], [level.up, 'up']] as const) {
    sw.steps.forEach((step, i) => {
      if (!seen(step.x, step.y) && !(way === 'down' && fx.mapStairs)) return;
      const p = at(step.x, step.y);
      ctx.fillStyle = way === 'down' ? `rgba(33, 27, 23, ${0.35 + i * 0.2})` : `rgba(33, 27, 23, ${0.75 - i * 0.2})`;
      ctx.fillRect(p.x + 1, p.y + 1, size - 2, size - 2);
    });
  }

  // The stairs, down and up, once found (Rune Readers know the way down from the start).
  const mid = (sw: typeof level.down) => ({ x: sw.steps[1].x + 0.5, y: sw.steps[1].y + 0.5 });
  const stairs: Array<[MapMark, typeof level.down, boolean]> = [
    ['down', level.down, level.down.steps.some((p) => seen(p.x, p.y)) || !!fx.mapStairs],
    ['up', level.up, level.up.steps.some((p) => seen(p.x, p.y))],
  ];
  ctx.font = `italic ${Math.max(11, Math.min(15, size * 0.6))}px Georgia, serif`;
  ctx.textAlign = 'center';
  for (const [mark, sw, known] of stairs) {
    if (!known) continue;
    const c = mid(sw);
    const p = at(c.x, c.y);
    drawMark(ctx, mark, p.x, p.y, markR * 1.15);
    if (labels[mark]) {
      ctx.fillStyle = INK;
      ctx.fillText(labels[mark]!, p.x, p.y - markR * 1.15 - 4);
    }
    landmarks.push({ mark, x: c.x, y: c.y, label: labels[mark] });
  }

  // The hero: an arrow pointing where they face.
  const hero = at(world.player.x, world.player.y);
  drawMark(ctx, 'hero', hero.x, hero.y, Math.max(7, size * 0.45), Math.atan2(world.facing.y, world.facing.x));

  // Landmarks off the page: an arrow on the edge pointing their way.
  const margin = 20;
  for (const l of landmarks) {
    const p = at(l.x, l.y);
    if (p.x >= margin && p.x <= W - margin && p.y >= margin && p.y <= H - margin) continue;
    const dx = p.x - W / 2;
    const dy = p.y - H / 2;
    const k = Math.min((W / 2 - margin) / Math.max(1e-6, Math.abs(dx)), (H / 2 - margin) / Math.max(1e-6, Math.abs(dy)));
    const ex = W / 2 + dx * k;
    const ey = H / 2 + dy * k;
    const a = Math.atan2(dy, dx);
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ex, ey, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(a) * 19, ey + Math.sin(a) * 19);
    ctx.lineTo(ex + Math.cos(a + 0.5) * 13, ey + Math.sin(a + 0.5) * 13);
    ctx.lineTo(ex + Math.cos(a - 0.5) * 13, ey + Math.sin(a - 0.5) * 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawMark(ctx, l.mark, ex, ey, 7);
  }
}
