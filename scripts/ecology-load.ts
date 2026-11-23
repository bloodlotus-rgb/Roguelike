import { isDeepStrictEqual, parseArgs } from 'node:util';
import { Rng } from '../src/core/rng.ts';
import { buildHabitatGraph } from '../src/ecology/habitats.ts';
import { audit } from '../src/ecology/audit.ts';
import { initialState, reaggregate, restore, snapshot, step, totals } from '../src/ecology/resources.ts';

const { values } = parseArgs({ options: { seed: { type: 'string', default: 'estirpe' },
  barriers: { type: 'boolean', default: false }, active: { type: 'string', default: '5000' }, ticks: { type: 'string', default: '48' } } });
const count = Number(values.active), ticks = Number(values.ticks);
let graph = buildHabitatGraph(values.seed!);
if (!Number.isSafeInteger(count) || count < 1 || count > graph.habitats.length ||
    !Number.isSafeInteger(ticks) || ticks < 1) throw new Error('Invalid load size');
const ids = graph.habitats.map((_, i) => i);
Rng.derive(graph.seed, 'load-permutation').shuffle(ids);
let state = initialState(true);
for (const id of ids.slice(0, count)) {
  state.stocks.set(id, { water: 160, detritus: 100, nutrients: 60, fungalBiomass: 12, energy: 120 });
}
const gate = graph.boundaries.find(cut => cut.kind === 'gate')!;
global.gc?.();
const rssStart = process.memoryUsage().rss;
const times: number[] = [];
let auditMs = 0, entries = 0, activeSum = 0, sampledHeap = 0;
const epochs = [];
for (let i = 0; i < ticks; i++) {
  if (values.barriers && (i === Math.floor(ticks / 3) || i === Math.floor(2 * ticks / 3))) {
    const status = i === Math.floor(ticks / 3) ? 'destroyed' : 'flooded';
    const start = performance.now();
    const rebuilt = buildHabitatGraph(graph.seed, new Map([[gate.id, status]]));
    const projected = reaggregate(graph, rebuilt, state);
    if (!isDeepStrictEqual(totals(state.stocks), totals(projected.stocks))) throw new Error('Epoch balance mismatch');
    const saved = snapshot(rebuilt, projected);
    state = restore(rebuilt, JSON.parse(JSON.stringify(saved)));
    if (!isDeepStrictEqual(step(rebuilt, projected), step(rebuilt, state))) throw new Error('Restart mismatch');
    graph = rebuilt;
    epochs.push({ tick: i, status, ms: performance.now() - start });
  }
  activeSum += state.stocks.size;
  const start = performance.now();
  const next = step(graph, state);
  const computed = performance.now();
  audit(state.stocks, next.state.stocks, next.ledger);
  auditMs += performance.now() - computed;
  entries += next.ledger.length;
  times.push(computed - start);
  sampledHeap = Math.max(sampledHeap, process.memoryUsage().heapUsed);
  state = next.state;
}
times.sort((a, b) => a - b);
console.log(JSON.stringify({ seed: graph.seed, initial: count, ticks, epochs, final: state.stocks.size,
  meanActive: activeSum / ticks, meanStepMs: times.reduce((a,b) => a+b, 0) / ticks,
  p95StepMs: times[Math.ceil(ticks * 0.95) - 1], meanAuditMs: auditMs / ticks, entries,
  startRssMiB: rssStart / 2**20, processPeakRssMiB: process.resourceUsage().maxRSS / 1024,
  sampledHeapMiB: sampledHeap / 2**20 }));
