import { expect, it } from 'vitest';
import { assembleZone, CELL, Face } from '../core/jenga';
import { makePlan } from '../core/plan';
import { extractGraph, region, type Edge } from '../core/spatial';
import { buildStructure, type Structure } from '../core/structure';
import { deriveHabitats } from './habitats';
import { initialState, reaggregate, restore, snapshot, step, totals } from './resources';
import { audit } from './audit';
import { parameters, emptyStock } from './parameters';

function zoneFixture(): Structure {
  const layout = assembleZone({ seed: 'audit', zone: 0, width: 24, depth: 24, storeys: 4,
    arrival: [12, 12], exit: false });
  const entrance = { zone: 0, block: layout.arrival, cell: layout.blocks[layout.arrival].at, face: Face.Up };
  return { zones: [layout], seed: layout.spec.seed, entrance, origin: entrance, passages: [] };
}
it('keeps partition and checkpoint independent of Map order, and conserves stocks when a mixed cut closes', () => {
  const structure = zoneFixture(), fine = extractGraph(structure);
  const first = deriveHabitats(structure, fine);
  const reordered = deriveHabitats(structure, { errors: [], edges: new Map([...fine.edges].reverse()),
    adjacent: new Map([...fine.adjacent].reverse().map(([id, edges]) => [id, [...edges].reverse()])) });
  expect(first.signature).toBe(reordered.signature);
  const mixed = [...fine.edges.values()].find(e => first.regionToHabitat.get(e.to) === first.regionToHabitat.get(e.from))!;
  const blocked = deriveHabitats(structure, fine, new Map([[mixed.id, 'blocked']]));
  expect(blocked.regionToHabitat.get(mixed.from)).not.toBe(blocked.regionToHabitat.get(mixed.to));
  expect(blocked.boundaries.find(c => c.id === mixed.id)?.state).toBe('blocked');
  let state = initialState();
  state.stocks.set(first.regionToHabitat.get(mixed.from)!, { ...emptyStock(), nutrients: 197 });
  const projected = reaggregate(first, blocked, state);
  expect(totals(projected.stocks)).toEqual(totals(state.stocks));
  expect(totals(reaggregate(blocked, first, projected).stocks)).toEqual(totals(state.stocks));
  for (let t = 0; t < 10; t++) state = step(first, state).state;
  let resumed = restore(reordered, JSON.parse(JSON.stringify(snapshot(first, state))));
  for (let t = 0; t < 24; t++) {
    const uninterrupted = step(first, state), restarted = step(reordered, resumed);
    expect(restarted.ledger).toEqual(uninterrupted.ledger);
    state = uninterrupted.state;
    resumed = restarted.state;
  }
  expect(snapshot(reordered, resumed)).toEqual(snapshot(first, state));
});

it('retains a same-floor bridge between cycles of ordinary permeable cuts', () => {
  const structure = zoneFixture();
  const layout = structure.zones[0];
  const blocks = layout.blocks.filter(b => b.size.every(x => x === 1) && b.at[2] === 0).slice(0, 6);
  const ids = blocks.map(b => region(layout, { zone: 0, block: b.id, cell: b.at }));
  const adjacent = new Map(ids.map(id => [id, [] as Edge[]]));
  const edges = new Map<string, Edge>();
  for (const [a, b] of [[0,1],[1,2],[2,0],[2,3],[3,4],[4,5],[5,3]]) {
    const edge: Edge = { id: a + '-' + b, kind: 'opening', state: 'open', from: ids[a], to: ids[b],
      a: { zone: 0, block: blocks[a].id, cell: blocks[a].at, face: Face.E },
      b: { zone: 0, block: blocks[b].id, cell: blocks[b].at, face: Face.W } };
    edges.set(edge.id, edge);
    adjacent.get(edge.from)!.push(edge);
    adjacent.get(edge.to)!.push(edge);
  }
  const graph = deriveHabitats(structure, { edges, adjacent, errors: [] });
  expect(graph.habitats.length).toBe(2);
  expect(graph.boundaries.map(c => c.id)).toEqual(['2-3']);
});

it.each(['estirpe', 'mansion', 'zz'])('accounts for the complete occupied footprint and real transport of %s', seed => {
  const started = performance.now();
  const structure = buildStructure(makePlan(seed)), fine = extractGraph(structure);
  const graph = deriveHabitats(structure, fine);
  const cells = structure.zones.reduce((sum, z) => sum + z.cells.reduce((n, id) => n + Number(id >= 0), 0), 0);
  expect(graph.habitats.reduce((sum, h) => sum + h.areaM2, 0)).toBe(cells * CELL ** 2);
  expect(graph.regionToHabitat.size).toBe(fine.adjacent.size);
  expect(graph.habitats.length).toBeLessThan(fine.adjacent.size);
  let missing = 0;
  for (const cut of graph.boundaries) {
    const edge = fine.edges.get(cut.id)!;
    if (cut.from !== graph.regionToHabitat.get(edge.from) || cut.to !== graph.regionToHabitat.get(edge.to) ||
        cut.state !== edge.state || cut.kind !== edge.kind) missing++;
  }
  expect(missing).toBe(0);
  const occupancy = new Uint16Array(graph.habitats.length);
  for (const id of graph.regionToHabitat.values()) occupancy[id]++;
  expect(occupancy.every(size => size > 0 && size <= parameters.maxMixedCells)).toBe(true);
  for (const p of structure.passages) {
    expect(graph.regionToHabitat.get(region(structure.zones[p.upper.zone], p.upper))).not.toBe(
      graph.regionToHabitat.get(region(structure.zones[p.lower.zone], p.lower)));
  }
  let state = initialState();
  for (let t = 0; t < 24; t++) {
    const next = step(graph, state);
    audit(state.stocks, next.state.stocks, next.ledger);
    for (const e of next.ledger.filter(e => e.kind === 'transfer')) {
      const cut = fine.edges.get(e.connector!)!;
      const endpoints = [graph.regionToHabitat.get(cut.from), graph.regionToHabitat.get(cut.to)];
      if (!endpoints.includes(e.from!) || !endpoints.includes(e.to!)) throw new Error('Unsupported transfer');
    }
    state = next.state;
  }
  console.log(seed, graph.regionToHabitat.size, graph.habitats.length, Math.round(performance.now() - started), 'ms');
}, 45_000);
