import { describe, it, expect } from 'vitest';
import { assembleZone, BASIC_BLOCKS, type ZoneLayout } from './jenga';
import { extractGraph, route, type State, type Traveler } from './spatial';

const walker: Traveler = { modes: ['walk'], width: 0.7, height: 1.8 };

describe('compound partitions', () => {
  for (const id of ['wing', 'cloister']) {
    it.each([0, 1, 2, 3])('realizes ' + id + ' at rotation %i', turn => {
      const def = BASIC_BLOCKS.find(b => b.id === id)!;
      const [w, d] = def.size;
      const [width, depth] = turn % 2 === 0 ? [w, d] : [d, w];
      const layout: ZoneLayout = {
        spec: { seed: 'fixture', zone: 7, width, depth, storeys: 1, arrival: [0, 0], exit: false },
        cells: new Int32Array(width * depth), arrival: 0, exitCell: null, exit: null,
        blocks: [{ id: 0, def, at: [0, 0, 0], size: [width, depth, 1], turn, openings: [] }],
      };
      const graph = extractGraph({ zones: [layout], passages: [] });
      expect(graph.errors).toEqual([]);
      expect(graph.adjacent.size).toBe(width * depth);
      const leaves = [...graph.adjacent.values()].filter(edges => edges.length === 1);
      expect(leaves.length).toBe(id === 'wing' ? 3 : 1);
      // Each room (or court) has just its declared doorway, even against an occupied neighbour.
      for (const [door] of leaves) {
        expect(route(graph, door.from, door.to, walker, new Map([[door.id, 'blocked']]))).toBeNull();
      }
      const detours = [...graph.edges.values()].map(edge =>
        route(graph, edge.from, edge.to, walker, new Map([[edge.id, 'blocked']])));
      expect(detours.filter(Boolean).map(path => path!.length))
        .toEqual(id === 'wing' ? [] : Array(8).fill(7));
    });
  }
});

it.each(['estirpe', 'mansion', 'zz'])('retains a physical passage around a blocked corridor in %s', seed => {
  const layout = assembleZone({ seed, zone: 0, width: 24, depth: 24, storeys: 4, arrival: [12, 12], exit: true });
  const graph = extractGraph({ zones: [layout], passages: [] });
  expect(graph.errors).toEqual([]);
  const isPassage = (id: number) => ['corridor', 'tunnel'].includes(layout.blocks[id].def.kind);
  const sealed = new Map<string, State>();
  const candidates = [];
  for (const edge of graph.edges.values()) {
    if (isPassage(edge.a.block) && isPassage(edge.b.block)) candidates.push(edge);
    else sealed.set(edge.id, 'blocked');
  }
  const ring = candidates.find(edge => {
    sealed.set(edge.id, 'blocked');
    const path = route(graph, edge.from, edge.to, walker, sealed);
    sealed.delete(edge.id);
    return path && path.length >= 3 && path.every(step => step.id !== edge.id);
  });
  expect(ring).toBeDefined();
});
