import { describe, expect, it } from 'vitest';
import { assembleZone, Face, STEP, opposite } from './jenga';
import { makePlan, ZONE_SLAB } from './plan';
import { buildStructure, owner } from './structure';
import { anchor, canCross, extractGraph, reachable, region, route, type Traveler } from './spatial';

const player: Traveler = { modes: ['walk'], width: 0.7, height: 1.8, keys: ['keyIron', 'keyBronze', 'keyBone'] };
const small: Traveler = { modes: ['crawl', 'squeeze'], width: 0.14, height: 0.2 };

function local(seed: string) {
  return assembleZone({ seed, zone: 0, width: 24, depth: 24, storeys: 4, arrival: [12, 12], exit: true });
}

describe('physical extraction', () => {
  it('repeats regions, apertures and routes, and varies with the seed', () => {
    function sample(seed: string) {
      const layout = local(seed);
      const graph = extractGraph({ zones: [layout], passages: [] });
      expect(graph.errors).toEqual([]);
      const start = '0/' + layout.arrival + '/0';
      const end = '0/' + layout.exit + '/3';
      return { areas: [...graph.adjacent.keys()], edges: [...graph.edges.values()], path: route(graph, start, end, player) };
    }
    const a = sample('estirpe');
    expect(a.path?.some(e => e.kind === 'stairs')).toBe(true);
    expect(sample('estirpe')).toEqual(a);
    expect(sample('mansion').edges).not.toEqual(a.edges);
  });

  it('rejects a lost reciprocal opening even when both rooms are occupied', () => {
    const layout = local('zz');
    const extract = () => extractGraph({ zones: [layout], passages: [] });
    const edge = [...extract().edges.values()].find(e => e.kind === 'opening')!;
    const block = layout.blocks[edge.b.block];
    block.openings = block.openings.filter(o => !(o.face === edge.b.face && o.cell.every((v, i) => v === edge.b.cell[i])));
    const broken = extract();
    expect(broken.errors.length).toBeGreaterThan(0);
    expect(broken.edges.has(edge.id)).toBe(false);
  });

  it.each(['estirpe', 'mansion'])('validates the entire building for %s', seed => {
    const structure = buildStructure(makePlan(seed));
    const graph = extractGraph(structure);
    expect(graph.errors).toEqual([]);
    expect(structure.zones).toHaveLength(25);
    expect(structure.zones.at(-1)!.spec.width).toBe(112);
    const start = region(structure.zones[0], structure.entrance), end = region(structure.zones.at(-1)!, structure.origin);
    expect(reachable(graph, start, player).size).toBe(graph.adjacent.size);
    const path = route(graph, start, end, player)!;
    expect(path.filter(e => e.kind === 'gate')).toHaveLength(24);
    expect(route(graph, start, end, { ...player, keys: [] })).toBeNull();
    expect(route(graph, end, start, small)).not.toBeNull();
    let invalid = 0;
    for (const e of graph.edges.values()) {
      const upper = structure.zones[e.a.zone], lower = structure.zones[e.b.zone];
      if (owner(upper, e.a.cell) !== e.a.block || owner(lower, e.b.cell) !== e.b.block ||
          e.a.face !== opposite(e.b.face)) invalid++;
      if (e.a.zone !== e.b.zone) {
        const a = anchor(upper, e.a), b = anchor(lower, e.b);
        if (a[0] !== b[0] || a[1] !== b[1] || b[2] - a[2] !== ZONE_SLAB) invalid++;
      } else if (!e.a.cell.every((v, i) => v + STEP[e.a.face][i] === e.b.cell[i])) invalid++;
    }
    expect(invalid).toBe(0);
    const gate = path.find(e => e.kind === 'gate')!;
    const blocked = new Map([[gate.id, 'blocked' as const]]);
    expect(route(graph, start, end, player, blocked)).toBeNull();
    const bypass = route(graph, gate.from, gate.to, small, blocked)!;
    expect(bypass.some(e => e.kind === 'fissure' || e.kind === 'duct')).toBe(true);
    expect(bypass).not.toContain(gate);
    expect(canCross(gate, gate.from, { ...player, keys: [], breakBarrier: true })).toBe(true);
    expect(canCross(gate, gate.from, { ...player, width: 2 })).toBe(false);
    const fall = [...graph.edges.values()].find(e => e.kind === 'watercourse')!;
    const swimmer: Traveler = { ...small, modes: ['swim'] };
    expect(canCross(fall, fall.from, swimmer)).toBe(true);
    expect(canCross(fall, fall.to, swimmer)).toBe(false);
    expect(route(graph, fall.from, fall.to, swimmer)).toEqual([fall]);
    expect(route(graph, fall.to, fall.from, swimmer)).toBeNull();
    expect(canCross(gate, gate.from, player, 'flooded')).toBe(false);
    expect(canCross(gate, gate.from, swimmer, 'flooded')).toBe(true);

    // A reservation for the wrong face cannot authorize a cut through the slab.
    const passage = structure.passages[0];
    const bad = { ...passage, lower: { ...passage.lower, face: Face.Down } };
    const rejected = extractGraph({ zones: structure.zones.slice(0, 2), passages: [bad] });
    expect(rejected.errors).toContain('Missing gate below zone 0');
    expect([...rejected.edges.values()].some(e => e.a.zone !== e.b.zone)).toBe(false);
  }, 30_000);
});
