import { performance } from 'node:perf_hooks';
import { makePlan } from '../src/core/plan.ts';
import { buildStructure } from '../src/core/structure.ts';
import { extractGraph, canCross, reachable, region, route, type SpatialGraph, type Traveler } from '../src/core/spatial.ts';

function countComponents(graph: SpatialGraph) {
  const seen = new Set();
  let count = 0;
  for (const start of graph.adjacent.keys()) {
    if (seen.has(start)) continue;
    count++;
    const queue = [start];
    seen.add(start);
    for (const node of queue) {
      for (const edge of graph.adjacent.get(node)!) {
        const next = edge.from === node ? edge.to : edge.from;
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
  }
  return count;
}

function report(seed: string) {
  const started = performance.now();
  const structure = buildStructure(makePlan(seed));
  const graph = extractGraph(structure);
  const buildMs = Math.round(performance.now() - started);
  const mansion = region(structure.zones[0], structure.entrance), origin = region(structure.zones.at(-1)!, structure.origin);
  const sections: Record<string, number> = {};
  for (const edge of graph.edges.values()) sections[edge.kind] = (sections[edge.kind] ?? 0) + 1;
  const profiles: Record<string, Traveler> = {
    player: { modes: ['walk'], width: 0.7, height: 1.8, keys: ['keyIron', 'keyBronze', 'keyBone'] },
    walker: { modes: ['walk'], width: 0.7, height: 1.8 },
    crawler: { modes: ['crawl'], width: 0.4, height: 0.3 },
    climber: { modes: ['walk', 'climb'], width: 0.5, height: 1 },
    flyer: { modes: ['fly'], width: 0.4, height: 0.4 },
    swimmer: { modes: ['swim'], width: 0.4, height: 0.4 },
    small: { modes: ['crawl', 'squeeze'], width: 0.15, height: 0.2 },
    breaker: { modes: ['walk'], width: 1, height: 2, breakBarrier: true },
  };
  const routes: Record<string, { reachableFromOrigin: number; reachesMansion: boolean; inaccessibleRegions: number; reachableByZone: number[]; singleUpwardPassages: string[] }> = {};
  const slabs = [...graph.edges.values()].filter(e => e.a.zone !== e.b.zone);
  for (const [name, profile] of Object.entries(profiles)) {
    const reached = reachable(graph, origin, profile);
    const byZone = Array(structure.zones.length).fill(0);
    for (const node of reached.keys()) byZone[Number(node.split('/')[0])]++;
    const bottlenecks = [];
    for (let zone = 1; zone < byZone.length; zone++) {
      const exits = slabs.filter(e => e.b.zone === zone && reached.has(e.to) && canCross(e, e.to, profile));
      if (exits.length === 1) bottlenecks.push(exits[0].id);
    }
    routes[name] = { reachableFromOrigin: reached.size, reachesMansion: reached.has(mansion),
      inaccessibleRegions: graph.adjacent.size - reached.size, reachableByZone: byZone,
      singleUpwardPassages: bottlenecks };
  }
  const routeStarted = performance.now();
  const path = route(graph, mansion, origin, profiles.player);
  const playerRouteMs = Math.round(performance.now() - routeStarted);
  const errors = [...graph.errors];
  if (!path) errors.push('Player cannot reach Origin');
  const components = countComponents(graph);
  if (components !== 1) errors.push('Disconnected physical regions: ' + components);
  const macroPieces = structure.zones.reduce((n, z) => n + z.blocks.filter(b =>
    b.def.kind === 'macro' && z.cells[b.at[0] + b.at[1] * z.spec.width +
      b.at[2] * z.spec.width * z.spec.depth] === b.id).length, 0);
  const reservedVoidCells = structure.zones.reduce((n, z) =>
    n + z.cells.filter(id => id === -2).length, 0);
  return { seed, zones: structure.zones.length, macroPieces, reservedVoidCells,
    pieces: structure.zones.reduce((sum, z) => sum + new Set(z.cells.filter(id => id >= 0)).size, 0),
    regions: graph.adjacent.size, connectors: graph.edges.size, sections, components,
    mansion, origin, playerCrossings: path?.length ?? null, playerRouteMs, routes, buildMs,
    totalMs: Math.round(performance.now() - started), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024), errors };
}
for (const seed of process.argv.slice(2).length ? process.argv.slice(2) : ['estirpe']) {
  try {
    const result = report(seed);
    console.log(JSON.stringify(result));
    if (result.errors.length) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ seed, errors: [error instanceof Error ? error.message : String(error)] }));
    process.exitCode = 1;
  }
}
