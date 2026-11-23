import { describe, expect, it } from 'vitest';
import { assembleZone, Face, placeOpening, type BlockDef, type ZoneLayout } from './jenga';
import { monumentalAtrium, processionalGallery } from './macros';
import { extractGraph, reachable, region, route, type Traveler } from './spatial';

const walker: Traveler = { modes: ['walk'], width: 0.7, height: 1.8 };

function standalone(def: BlockDef, turn: number): ZoneLayout {
  const size: [number, number, number] = turn % 2 === 0
    ? [...def.size] : [def.size[1], def.size[0], def.size[2]];
  const [width, depth, storeys] = size;
  const cells = new Int32Array(width * depth * storeys).fill(0);
  for (const local of def.voidCells ?? []) {
    const { cell: [x, y, z] } = placeOpening(def, [0, 0, 0], turn, { at: local, face: Face.Up });
    cells[x + y * width + z * width * depth] = -2;
  }
  return {
    spec: { seed: 'fixture', zone: 7, width, depth, storeys, arrival: [0, 0], exit: false },
    cells, arrival: 0, exit: null, exitCell: null,
    blocks: [{ id: 0, def, at: [0, 0, 0], turn, size, openings: [] }],
  };
}

describe('E0-M architectural macro blueprints', () => {
  it.each([0, 1, 2, 3])('atrium rotation %i preserves real floors and a central void', turn => {
    const side = 6, storeys = 4;
    const layout = standalone(monumentalAtrium(side, storeys), turn);
    const graph = extractGraph({ zones: [layout], passages: [] });
    expect(graph.errors).toEqual([]);
    const perimeter = side * side - (side - 2) * (side - 2);
    expect([...layout.cells].filter(id => id === -2)).toHaveLength((side - 2) ** 2 * storeys);
    expect(graph.adjacent.size).toBe(perimeter * storeys);
    expect([...graph.edges.values()].filter(e => e.kind === 'stairs')).toHaveLength(2 * (storeys - 1));
    const start = region(layout, { zone: 7, block: 0, cell: [0, 0, 0] });
    const end = region(layout, { zone: 7, block: 0, cell: [side - 1, side - 1, storeys - 1] });
    expect(route(graph, start, end, walker)).not.toBeNull();
    expect(reachable(graph, start, walker).size).toBe(perimeter * storeys);
    const blocked = new Map<string, 'blocked'>();
    const stair = [...graph.edges.values()].find(e => e.kind === 'stairs')!;
    blocked.set(stair.id, 'blocked');
    expect(route(graph, start, end, walker, blocked)).not.toBeNull();
  });

  it.each([0, 1])('zone-spanning gallery rotation %i has explicit vertical routes', turn => {
    const length = 22, storeys = 4;
    const layout = standalone(processionalGallery(length, storeys), turn);
    const graph = extractGraph({ zones: [layout], passages: [] });
    expect(graph.errors).toEqual([]);
    expect(graph.adjacent.size).toBe(length * storeys);
    expect([...graph.edges.values()].filter(e => e.kind === 'stairs')).toHaveLength(2 * (storeys - 1));
    const start = region(layout, { zone: 7, block: 0, cell: [0, 0, 0] });
    const end = region(layout, { zone: 7, block: 0,
      cell: turn === 0 ? [length - 1, 0, storeys - 1] : [0, length - 1, storeys - 1] });
    expect(route(graph, start, end, walker)).not.toBeNull();
    expect(reachable(graph, start, walker).size).toBe(length * storeys);
  });

  it.each(['estirpe', 'mansion', 'zz'])('reserves macropieces before ordinary rooms for seed %s', seed => {
    const layout = assembleZone({ seed, zone: 0, width: 24, depth: 24,
      storeys: 4, arrival: [12, 12], exit: true });
    const macro = layout.blocks.filter(b => layout.cells[b.at[0] + b.at[1] * 24 + b.at[2] * 24 * 24] === b.id && b.def.kind === 'macro');
    expect(macro).toHaveLength(2);
    const span = macro.find(b => b.def.id.startsWith('processional-'))!;
    expect(span.size[2]).toBe(4);
    expect(Math.max(span.size[0], span.size[1])).toBe(22);
    expect(layout.cells.some(id => id === -2)).toBe(true);
    const graph = extractGraph({ zones: [layout], passages: [] });
    expect(graph.errors).toEqual([]);
    const start = region(layout, { zone: 0, block: layout.arrival, cell: [12, 12, 0] });
    expect(reachable(graph, start, walker).size).toBe(graph.adjacent.size);
  });
});
