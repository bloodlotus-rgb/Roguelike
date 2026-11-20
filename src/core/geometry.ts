import { isFloor, type Level, type Point } from './dungeon';

/**
 * Moves a circle of `radius` (in tiles) by `dx`, `dy`, sliding along walls.
 * Positions are in tile units; tile (x, y) spans [x, x + 1).
 */
export function moveWithCollision(level: Level, pos: Point, dx: number, dy: number, radius: number): Point {
  // Sub-step so fast moves never tunnel through a wall corner.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (radius * 0.9)));
  let x = pos.x;
  let y = pos.y;
  for (let i = 0; i < steps; i++) {
    const nx = x + dx / steps;
    if (!collides(level, nx, y, radius)) x = nx;
    const ny = y + dy / steps;
    if (!collides(level, x, ny, radius)) y = ny;
  }
  return { x, y };
}

function collides(level: Level, cx: number, cy: number, radius: number): boolean {
  const minX = Math.floor(cx - radius);
  const maxX = Math.floor(cx + radius);
  const minY = Math.floor(cy - radius);
  const maxY = Math.floor(cy + radius);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (isFloor(level, tx, ty)) continue;
      // Closest point of the wall tile to the circle center.
      const px = Math.max(tx, Math.min(cx, tx + 1));
      const py = Math.max(ty, Math.min(cy, ty + 1));
      if ((px - cx) ** 2 + (py - cy) ** 2 < radius * radius) return true;
    }
  }
  return false;
}

/**
 * Tiles visible from `origin` (tile coordinates of the viewer) within `radius` tiles.
 * Walls are visible but block the view behind them. Returns indices `y * width + x`.
 */
export function visibleTiles(level: Level, origin: Point, radius: number): number[] {
  const { width, height } = level;
  const ox = Math.floor(origin.x);
  const oy = Math.floor(origin.y);
  const seen = new Set<number>();
  const r = Math.ceil(radius);
  const radiusSq = radius * radius;
  // Cast a ray to every tile on the border of the square around the viewer.
  const targets: Array<[number, number]> = [];
  for (let i = -r; i <= r; i++) {
    targets.push([ox + i, oy - r], [ox + i, oy + r], [ox - r, oy + i], [ox + r, oy + i]);
  }
  for (const [tx, ty] of targets) {
    castRay(ox, oy, tx, ty, (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      if ((x - ox) ** 2 + (y - oy) ** 2 > radiusSq) return false;
      seen.add(y * width + x);
      return isFloor(level, x, y);
    });
  }
  return [...seen];
}

/** True when every tile on the straight line between two points is floor. */
export function hasLineOfSight(level: Level, a: Point, b: Point): boolean {
  let clear = true;
  const x1 = Math.floor(b.x);
  const y1 = Math.floor(b.y);
  castRay(Math.floor(a.x), Math.floor(a.y), x1, y1, (x, y) => {
    if (!isFloor(level, x, y)) {
      clear = false;
      return false;
    }
    return true;
  });
  return clear;
}

/** Bresenham walk from (x0, y0) to (x1, y1); stops when `visit` returns false. */
function castRay(x0: number, y0: number, x1: number, y1: number, visit: (x: number, y: number) => boolean): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    if (!visit(x, y)) return;
    if (x === x1 && y === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export interface WallHit {
  /** Distance at which the ray enters the first wall tile, or the maximum distance. */
  enter: number;
  /** Distance at which it leaves that tile. */
  exit: number;
  /** The wall tile hit, and whether it was entered through its top or bottom side. */
  tileX: number;
  tileY: number;
  horizontal: boolean;
  hit: boolean;
}

/**
 * Walks a ray from `origin` at `angle` through the grid (DDA) up to `maxDistance` and
 * reports the first wall tile it meets.
 */
export function castWallRay(level: Level, origin: Point, angle: number, maxDistance: number): WallHit {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let tx = Math.floor(origin.x);
  let ty = Math.floor(origin.y);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const deltaX = Math.abs(1 / (dx || 1e-9));
  const deltaY = Math.abs(1 / (dy || 1e-9));
  let sideX = (dx > 0 ? tx + 1 - origin.x : origin.x - tx) * deltaX;
  let sideY = (dy > 0 ? ty + 1 - origin.y : origin.y - ty) * deltaY;
  for (;;) {
    let distance: number;
    let horizontal: boolean;
    if (sideX < sideY) {
      distance = sideX;
      sideX += deltaX;
      tx += stepX;
      horizontal = false;
    } else {
      distance = sideY;
      sideY += deltaY;
      ty += stepY;
      horizontal = true;
    }
    if (distance >= maxDistance) {
      return { enter: maxDistance, exit: maxDistance, tileX: tx, tileY: ty, horizontal, hit: false };
    }
    if (!isFloor(level, tx, ty)) {
      return { enter: distance, exit: Math.min(sideX, sideY), tileX: tx, tileY: ty, horizontal, hit: true };
    }
  }
}
