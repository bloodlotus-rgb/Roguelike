import { createHash } from 'node:crypto';
import { Profile } from './profile.ts';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { Rng } from '../src/core/rng.ts';
import { buildHabitatGraph, updateBarrier } from '../src/ecology/habitats.ts';
import { audit } from '../src/ecology/audit.ts';
import { initialState, reaggregate, restore, snapshot, step, totals } from '../src/ecology/resources.ts';

const { values } = parseArgs({ options: { seed: { type: 'string', default: 'estirpe' },
  trace: { type: 'boolean', default: false }, allocations: { type: 'boolean', default: false },
  barriers: { type: 'boolean', default: false }, active: { type: 'string', default: '5000' }, ticks: { type: 'string', default: '48' } } });
const count = Number(values.active), ticks = Number(values.ticks);
const cpu = process.cpuUsage(), wall = performance.now();
const profile = new Profile(values.allocations);
let graph = buildHabitatGraph(values.seed!);
profile.end('initialBuild');
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
const frames: string[] = [];
for (let i = 0; i < ticks; i++) {
  if (values.barriers && (i === Math.floor(ticks / 3) || i === Math.floor(2 * ticks / 3))) {
    const status = i === Math.floor(ticks / 3) ? 'destroyed' : 'flooded';
    const start = performance.now();
    profile.start();
    const rebuilt = updateBarrier(graph, gate.id, status);
    profile.end('graphUpdate');
    const projected = reaggregate(graph, rebuilt, state);
    profile.end('reaggregate');
    if (!isDeepStrictEqual(totals(state.stocks), totals(projected.stocks))) throw new Error('Epoch balance mismatch');
    profile.end('totalsCheck');
    const saved = JSON.stringify(snapshot(rebuilt, projected));
    profile.end('serialize', saved.length);
    state = restore(rebuilt, JSON.parse(saved));
    profile.end('restore');
    if (!isDeepStrictEqual(step(rebuilt, projected), step(rebuilt, state))) throw new Error('Restart mismatch');
    profile.end('restartCheck');
    graph = rebuilt;
    epochs.push({ tick: i, status, ms: performance.now() - start });
  }
  activeSum += state.stocks.size;
  const start = performance.now();
  profile.start();
  const next = step(graph, state, profile.end);
  const computed = performance.now();
  audit(state.stocks, next.state.stocks, next.ledger);
  profile.end('audit', next.ledger.length);
  auditMs += performance.now() - computed;
  entries += next.ledger.length;
  times.push(computed - start);
  sampledHeap = Math.max(sampledHeap, process.memoryUsage().heapUsed);
  if (values.trace) {
    const digest = createHash('sha256');
    digest.update(JSON.stringify(snapshot(graph, next.state)));
    digest.update(JSON.stringify(next.ledger));
    frames.push(digest.digest('hex'));
    profile.end('trace');
  }
  state = next.state;
}
times.sort((a, b) => a - b);
const elapsedCPU = process.cpuUsage(cpu);
console.log(JSON.stringify({ phases: profile.report(), frames: values.trace ? frames : undefined, cpuMs: (elapsedCPU.user + elapsedCPU.system) / 1000, wallMs: performance.now() - wall, barriers: !!values.barriers, seed: graph.seed, initial: count, ticks, epochs, final: state.stocks.size,
  meanActive: activeSum / ticks, meanStepMs: times.reduce((a,b) => a+b, 0) / ticks,
  p95StepMs: times[Math.ceil(ticks * 0.95) - 1], meanAuditMs: auditMs / ticks, entries,
  startRssMiB: rssStart / 2**20, processPeakRssMiB: process.resourceUsage().maxRSS / 1024,
  sampledHeapMiB: sampledHeap / 2**20 }));
