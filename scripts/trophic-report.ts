import { parseArgs } from 'node:util';
import { buildHabitatGraph } from '../src/ecology/habitats.ts';
import { accounts, emptyTrophicStock, matter, watershedTrial, type TrophicStock } from '../src/ecology/trophic-contract.ts';
import { auditTrophic, foundColony, stepTrophic } from '../src/ecology/trophic.ts';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  ticks: { type: 'string', default: '240' }, scenario: { type: 'string', default: 'periodic' },
} });
const ticks = Number(values.ticks);
const policy = values.scenario;
if (!Number.isSafeInteger(ticks) || ticks < 1 || (policy !== 'closed' && policy !== 'finite' && policy !== 'periodic')) {
  throw new Error('Expected --ticks N --scenario closed|finite|periodic [seeds...]');
}

function mass(s: TrophicStock) { return matter.reduce((sum, r) => sum + s[r], 0); }

for (const seed of positionals.length ? positionals : ['estirpe']) {
  const begin = performance.now();
  const graph = buildHabitatGraph(seed);
  const buildMs = performance.now() - begin;
  const setup = watershedTrial(graph, policy);
  const founded = foundColony(graph, setup);
  const book = auditTrophic(new Map(), founded.state.stocks, founded.ledger);
  let state = founded.state, activeSum = 0, activePeak = 0, auditMs = 0, stepMs = 0;
  const lossCauses: Record<string, number> = {};
  const times: number[] = [], windows = [];
  let births = 0, deaths = 0;
  const cpu = process.cpuUsage();
  for (let hour = 1; hour <= ticks; hour++) {
    const start = performance.now();
    const next = stepTrophic(graph, state);
    const stepped = performance.now();
    times.push(stepped - start);
    stepMs += stepped - start;
    const balance = auditTrophic(state.stocks, next.state.stocks, next.ledger);
    auditMs += performance.now() - stepped;
    for (const r of accounts) for (const group of ['sources', 'sinks', 'converted', 'transported'] as const) {
      book[group][r] += balance[group][r];
    }
    for (const e of next.ledger) {
      if (e.process.includes('-mortality/') && e.from !== null) {
        lossCauses[e.process] = (lossCauses[e.process] ?? 0) + e.amount;
        if (e.resource === 'detritivores') deaths += e.amount;
      }
      if (e.resource === 'detritivores' && e.process === 'detritivore-birth') births += e.amount;
    }
    state = next.state;
    activeSum += state.stocks.size;
    activePeak = Math.max(activePeak, state.stocks.size);
    if (hour === 48 || hour === 240 || hour === ticks) {
      const totals = emptyTrophicStock();
      for (const stock of state.stocks.values()) for (const r of accounts) totals[r] += stock[r];
      for (const r of accounts) if (book.sources[r] - book.sinks[r] + book.converted[r] !== totals[r]) throw new Error('Period mismatch: ' + r);
      if (mass(totals) !== mass(book.sources) - mass(book.sinks) || totals.detritivores !== setup.founders.detritivores + births - deaths) {
        throw new Error('Matter or population mismatch');
      }
      windows.push({ hour, lotsUsed: state.lotsUsed, totals, active: state.stocks.size, births, deaths,
        mortality: { ...lossCauses }, ledger: structuredClone(book) });
    }
  }
  const elapsed = process.cpuUsage(cpu);
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ seed, scenario: values.scenario, ticks, setup, buildMs, habitats: graph.habitats.length, windows,
    meanActive: activeSum / ticks, activePeak, meanStepMs: stepMs / ticks, p95StepMs: times[Math.ceil(ticks * .95) - 1],
    meanAuditMs: auditMs / ticks, cpuSimulationMs: (elapsed.user + elapsed.system) / 1000,
    processPeakRssMiB: process.resourceUsage().maxRSS / 1024 }));
}
