/**
 * A look at the jenga (for development): `?jenga=view&zone=N` draws how zone N of the
 * seed's building is put together, storey by storey: each cell coloured by the piece that
 * holds it, the doors between pieces as notches, the arrival and the way out marked.
 */
import { assembleZone, CELL, Face, type BlockKind } from '../core/jenga';
import { AREA_WIDTH, planOf, ZONES_PER_AREA } from '../core/plan';

const COLOURS: Record<BlockKind, string> = {
  corridor: '#b9a57e',
  room: '#d8c49a',
  hall: '#e9d9b0',
  vertical: '#7d93a3',
  well: '#c0392b',
  tunnel: '#8a7a60',
  complex: '#a98fbf',
};

export function showJenga(seed: string, zone: number): void {
  const area = Math.min(AREA_WIDTH.length - 1, Math.floor(zone / ZONES_PER_AREA));
  const cells = AREA_WIDTH[area] / CELL;
  const layout = assembleZone({ seed, zone, width: cells, depth: cells, storeys: 4, arrival: [Math.floor(cells / 2), Math.floor(cells / 2)], exit: true });
  const plan = planOf(seed);
  const px = Math.max(3, Math.floor(Math.min(window.innerWidth / 2 - 24, 520) / cells));
  const size = cells * px;
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;background:#1b1712;color:#e9dcc0;font:14px Georgia,serif;padding:12px;overflow:auto';
  const title = document.createElement('div');
  title.textContent = `${seed} · ${plan.areas[area].name.es} · zona ${zone + 1} · ${cells}×${cells} celdas × 4 pisos · ${layout.blocks.length} piezas`;
  title.style.margin = '0 0 8px';
  document.body.appendChild(title);
  const canvas = document.createElement('canvas');
  canvas.width = size * 2 + 16;
  canvas.height = size * 2 + 40;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  for (let z = 0; z < 4; z++) {
    const ox = (z % 2) * (size + 16);
    const oy = Math.floor(z / 2) * (size + 20) + 14;
    ctx.fillStyle = '#e9dcc0';
    ctx.fillText(`piso ${z + 1}`, ox, oy - 3);
    ctx.fillStyle = '#0d0b08';
    ctx.fillRect(ox, oy, size, size);
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const id = layout.cells[x + y * cells + z * cells * cells];
        if (id < 0) continue;
        const b = layout.blocks[id];
        ctx.fillStyle = id === layout.arrival || id === layout.exit ? COLOURS.well : COLOURS[b.def.kind];
        // Pieces read as one: a gap only where a cell meets another piece.
        const gap = (dx: number, dy: number) => (layout.cells[x + dx + (y + dy) * cells + z * cells * cells] === id && x + dx >= 0 && x + dx < cells && y + dy >= 0 && y + dy < cells ? 0 : 1);
        ctx.fillRect(ox + x * px + gap(-1, 0), oy + y * px + gap(0, -1), px - gap(-1, 0) - gap(1, 0), px - gap(0, -1) - gap(0, 1));
      }
    }
    // Doors: a light bar across the shared edge.
    ctx.fillStyle = '#fff6dc';
    for (const b of layout.blocks) {
      for (const op of b.openings) {
        if (op.cell[2] !== z || op.face > Face.N) continue;
        const cx = ox + op.cell[0] * px + px / 2;
        const cy = oy + op.cell[1] * px + px / 2;
        const half = px / 2;
        const w = Math.max(2, px / 3);
        if (op.face === Face.E) ctx.fillRect(cx + half - 1, cy - w / 2, 2, w);
        if (op.face === Face.W) ctx.fillRect(cx - half - 1, cy - w / 2, 2, w);
        if (op.face === Face.S) ctx.fillRect(cx - w / 2, cy + half - 1, w, 2);
        if (op.face === Face.N) ctx.fillRect(cx - w / 2, cy - half - 1, w, 2);
      }
    }
  }
  const legend = document.createElement('div');
  legend.style.marginTop = '8px';
  legend.innerHTML = (Object.keys(COLOURS) as BlockKind[]).map((k) => `<span style="display:inline-block;width:12px;height:12px;background:${COLOURS[k]};margin:0 4px 0 12px"></span>${k}`).join('');
  document.body.appendChild(legend);
}
