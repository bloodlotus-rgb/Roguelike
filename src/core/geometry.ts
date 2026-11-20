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
