import { assembleZone, CELL, Face, type ZoneLayout } from './jenga.ts';
import { AREA_WIDTH, STOREYS_PER_ZONE, ZONES_PER_AREA, zoneKey, type Plan } from './plan.ts';
import { Rng } from './rng.ts';

export type Cell = [number, number, number];
export type PassageKind = 'gate' | 'fissure' | 'duct' | 'shaft' | 'watercourse';
export interface Location {
  zone: number;
  block: number;
  cell: Cell;
}
export interface Port extends Location {
  face: Face;
}
export interface Passage {
  kind: PassageKind;
  upper: Port;
  lower: Port;
  key?: ReturnType<typeof zoneKey>;
}
export interface Structure {
  seed: string;
  zones: ZoneLayout[];
  passages: Passage[];
  /** Landing under the mansion and the bottom-storey landing designated as the Origin. */
  entrance: Port;
  origin: Location;
}

export function owner(layout: ZoneLayout, [x, y, z]: Cell): number {
  const { width, depth, storeys } = layout.spec;
  if (x < 0 || y < 0 || z < 0 || x >= width || y >= depth || z >= storeys) return -1;
  return layout.cells[x + width * (y + depth * z)];
}

function port(layout: ZoneLayout, cell: Cell, face: Face): Port {
  return { zone: layout.spec.zone, block: owner(layout, cell), cell, face };
}

/** Reserve slab cuts only where the footprints of two excavatable rooms overlap. */
function reserveSlab(upper: ZoneLayout, lower: ZoneLayout): Passage[] {
  if (!upper.exitCell) throw new Error('Missing exit in zone ' + upper.spec.zone);
  const z = upper.spec.storeys - 1;
  const offset = (lower.spec.width - upper.spec.width) / 2;
  const cuts: Passage[] = [{
    kind: 'gate', key: zoneKey((upper.spec.zone + 1) * STOREYS_PER_ZONE),
    upper: port(upper, [...upper.exitCell, z], Face.Down),
    lower: port(lower, [...lower.spec.arrival, 0], Face.Up),
  }];
  const candidates: Cell[] = [];
  for (let y = 0; y < upper.spec.depth; y++) {
    for (let x = 0; x < upper.spec.width; x++) {
      const cell: Cell = [x, y, z];
      const above = upper.blocks[owner(upper, cell)];
      const below = lower.blocks[owner(lower, [x + offset, y + offset, 0])];
      if (above?.def.openable && below?.def.openable) candidates.push(cell);
    }
  }
  const rng = Rng.derive(upper.spec.seed, 'slab', upper.spec.zone);
  rng.shuffle(candidates);
  const kinds: PassageKind[] = ['fissure', rng.pick(['shaft', 'watercourse', 'duct'] as const)];
  for (const kind of kinds) {
    const cell = candidates.pop();
    if (!cell) break;
    cuts.push({ kind, upper: port(upper, cell, Face.Down),
      lower: port(lower, [cell[0] + offset, cell[1] + offset, 0], Face.Up) });
  }
  return cuts;
}

/** Centre the zones on the same world axes; carry the actual exit into the next zone. */
export function buildStructure(plan: Plan): Structure {
  const zones: ZoneLayout[] = [];
  const passages: Passage[] = [];
  const count = plan.areas.length * ZONES_PER_AREA;
  let previousWidth = 0;
  let arrival: [number, number] = [0, 0];
  for (let zone = 0; zone < count; zone++) {
    const width = AREA_WIDTH[Math.floor(zone / ZONES_PER_AREA)] / CELL;
    const offset = (width - previousWidth) / 2;
    arrival = [arrival[0] + offset, arrival[1] + offset];
    const layout = assembleZone({ seed: plan.seed, zone, width, depth: width,
      storeys: STOREYS_PER_ZONE, arrival, exit: zone + 1 < count });
    if (zone) passages.push(...reserveSlab(zones[zone - 1], layout));
    zones.push(layout);
    previousWidth = width;
    if (layout.exitCell) arrival = layout.exitCell;
    else if (zone + 1 < count) throw new Error('Missing exit in zone ' + zone);
  }
  const last = zones[count - 1];
  const bottom = STOREYS_PER_ZONE - 1;
  const room = last.blocks.find(b => b.def.openable && b.at[2] === bottom && owner(last, b.at) === b.id);
  if (!room) throw new Error('No occupied bottom room for the Origin');
  const entrance = port(zones[0], [...zones[0].spec.arrival, 0], Face.Up);
  const well = zones[0].blocks[entrance.block];
  if (well.id !== zones[0].arrival || !well.openings.some(o => o.joined && o.face === Face.Up &&
      o.cell.every((v, i) => v === entrance.cell[i]))) {
    throw new Error('Mansion entrance lacks its surface hatch');
  }
  return { seed: plan.seed, zones, passages, entrance,
    origin: { zone: last.spec.zone, block: room.id, cell: [...room.at] } };
}
