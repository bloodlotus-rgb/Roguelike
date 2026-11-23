import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { buildHabitatGraph } from '../src/ecology/habitats.ts';
import { audit, ledgerSummary } from '../src/ecology/audit.ts';
import { channelReach } from '../src/ecology/transport.ts';
import { channels, resources, type Recharge } from '../src/ecology/parameters.ts';
import { initialState, rechargeSite, step, totals } from '../src/ecology/resources.ts';

function report(seed: string, ticks: number, recharge: Recharge | null) {
  const start = performance.now(), cpu = process.cpuUsage();
  const graph = buildHabitatGraph(seed);
  const built = performance.now();
  if (recharge !== null) rechargeSite(graph, recharge);
  let state = initialState(false, recharge);
  const ledger = ledgerSummary();
  const processes: Record<string, number> = {};
  for (let tick = 0; tick < ticks; tick++) {
    const next = step(graph, state);
    const checked = audit(state.stocks, next.state.stocks, next.ledger);
    for (const group of ['sources', 'sinks', 'converted', 'transported'] as const) {
      for (const r of resources) ledger[group][r] += checked[group][r];
    }
    for (const event of next.ledger) {
      if (event.kind === 'source' || event.kind === 'sink') {
        const key = event.process + '/' + event.resource;
        processes[key] = (processes[key] ?? 0) + event.amount;
      }
    }
    state = next.state;
  }
  const finished = performance.now();
  const structuralReach = Object.fromEntries(channels.map(r => {
    const reachable = channelReach(graph, graph.entrance, r);
    return [r, { habitats: reachable.length, zones: new Set(reachable.map(id => graph.habitats[id].zone)).size }];
  }));
  const stock = totals(state.stocks);
  const depleted = Object.fromEntries(resources.map(r =>
    [r, graph.habitats.length - [...state.stocks.values()].filter(s => s[r] > 0).length]));
  const elapsed = process.cpuUsage(cpu);
  return { seed, ticks, regions: graph.regionToHabitat.size, habitats: graph.habitats.length,
    boundaries: graph.boundaries.length, active: state.stocks.size, structuralReach, depleted, stock,
    matter: stock.detritus + stock.nutrients + stock.fungalBiomass, ledger, processes,
    buildMs: Math.round(built - start), simulationMs: Math.round(finished - built),
    cpuMs: Math.round((elapsed.user + elapsed.system) / 1000), processPeakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
}
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  recharge: { type: 'string' }, ticks: { type: 'string', default: '48' }, format: { type: 'string', default: 'jsonl' },
} });
const ticks = Number(values.ticks);
if (!Number.isSafeInteger(ticks) || ticks < 0 || !['jsonl','json'].includes(values.format!)) {
  throw new Error('Usage: ecology:report -- [--ticks N] [--format json|jsonl] [--recharge file.json] [seed ...]');
}
const recharge = values.recharge ? JSON.parse(readFileSync(values.recharge, 'utf8')) as Recharge : null;
const batch = [];
for (const seed of positionals.length ? positionals : ['estirpe']) {
  try {
    const result = report(seed, ticks, recharge);
    if (values.format === 'jsonl') console.log(JSON.stringify(result));
    else batch.push(result);
  } catch (error) {
    process.exitCode = 1;
    const result = { seed, error: error instanceof Error ? error.message : String(error) };
    if (values.format === 'jsonl') console.log(JSON.stringify(result));
    else batch.push(result);
  }
}
if (values.format === 'json') console.log(JSON.stringify(batch));
