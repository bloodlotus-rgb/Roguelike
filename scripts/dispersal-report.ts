import { isDeepStrictEqual, parseArgs } from 'node:util';
import { buildDispersalWorld, changeDispersalBarrier, type DispersalWorld } from '../src/ecology/dispersal-world.ts';
import { auditMeta, emptyMeta, foundMeta, living, metaAccounts, projectMeta, restoreMeta, saveMeta, stepMeta,
  type Deposit, type MetaState } from '../src/ecology/metapopulation.ts';
import { foundColony, stepTrophic } from '../src/ecology/trophic.ts';
import { accounts, colonyHome } from '../src/ecology/trophic-contract.ts';
import { enclosure, surveyDeposits, surveyReserve } from './dispersal-trials.ts';
import { viabilityTrial } from './viability-trials.ts';

const cases = ['open', 'reopen', 'sealed', 'two-foci', 'scarce', 'half-rate'] as const;
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  case: { type: 'string', default: 'whole' }, ticks: { type: 'string', default: '48' },
  colonies: { type: 'string', default: '1' }, trace: { type: 'boolean', default: false },
} });
const ticks = Number(values.ticks), count = Number(values.colonies), choice = values.case!;
if (!Number.isSafeInteger(ticks) || ticks < 1 || !Number.isSafeInteger(count) || count < 1 ||
    ![...cases, 'matrix', 'load', 'whole', 'stationary'].includes(choice)) throw new Error('Invalid experiment');
const zero = emptyMeta();
const groups = ['fungalBiomass','detritivores'] as const;
function occupancy(world: DispersalWorld, stocks: MetaState['stocks']) {
  const total = emptyMeta(), occupied = { fungalBiomass: 0, detritivores: 0, propagules: 0 }, area = { ...occupied }, deepestM = { ...occupied };
  let colonies = 0;
  for (const [id,s] of stocks) {
    for (const r of metaAccounts) total[r] += s[r];
    if (s.fungalBiomass || s.detritivores) colonies++;
    for (const r of living) if (s[r]) {
      occupied[r]++;
      area[r] += world.graph.habitats[id].areaM2;
      deepestM[r] = Math.max(deepestM[r], world.graph.habitats[id].depthM);
    }
  }
  return { total, colonies, occupied, occupiedAreaM2: area, deepestOccupiedM: deepestM, habitatsWithStock: stocks.size };
}

function experiment(base: DispersalWorld, name: string, buildMs: number, lab?: ReturnType<typeof enclosure>) {
  const initStart = performance.now();
  let world = lab?.open ?? base;
  const setup = viabilityTrial(world.graph, name === 'half-rate' ? 'half-rate' : 'control');
  if (name === 'scarce' || name === 'load') setup.source = null;
  let deposits: Deposit[] = [];
  if (name === 'load') {
    const home = colonyHome(world.graph,setup);
    setup.founders = surveyReserve(world,home);
    deposits = surveyDeposits(world, count - 1, home);
  }
  if (name === 'two-foci') deposits = [{ region: lab!.target, connector: lab!.bridge, origin: 'historical-deposit-from-inlet',
    stock: { ...setup.founders } }];
  const founded = foundMeta(world, setup, deposits, name !== 'stationary');
  let reference = name === 'stationary' ? foundColony(world.graph,setup).state : undefined;
  const book = auditMeta(new Map(), founded.state.stocks, founded.ledger);
  let state = founded.state;
  const initial = occupancy(world, state.stocks);
  const history = { fungalBiomass: new Set<string>(), detritivores: new Set<string>() };
  const losses = { fungalBiomass: new Map<string, number>(), detritivores: new Map<string, number>() };
  const changes = { fungalBiomass: { settlements: 0, extinctions: 0, recolonizations: 0 }, detritivores: { settlements: 0, extinctions: 0, recolonizations: 0 } };
  const causes: Record<string,number> = {}, flows: Record<string, Record<string,number>> = {};
  for (const [id,s] of state.stocks) for (const r of groups) if (s[r]) history[r].add(world.members[id][0]);
  const events: object[] = [], trace: object[] = [], epochs: object[] = [], windows: object[] = [];
  let peak = initial.colonies, colonyHours = 0, stockHours = 0, stepMs = 0, auditMs = 0;
  const samples: number[] = [], auditSamples: number[] = [];
  const simStart = performance.now(), initializationMs = simStart-initStart;
  const cpu = process.cpuUsage();
  for (let hour = 1; hour <= ticks; hour++) {
    let nextWorld: DispersalWorld | undefined;
    const epochStart = performance.now();
    if ((hour === 1 && name === 'two-foci') || (hour === 33 && ['reopen','sealed'].includes(name))) nextWorld = lab!.closed;
    if (hour === 97 && name === 'reopen') nextWorld = lab!.open;
    if (name === 'load' && hour === Math.max(2, Math.floor(ticks / 2))) {
      const gate = world.graph.boundaries.find(c => c.kind === 'gate')!;
      nextWorld = changeDispersalBarrier(world, gate.id, 'destroyed');
    }
    if (nextWorld) {
      const graphUpdateMs = performance.now()-epochStart;
      const before = occupancy(world,state.stocks).total, projectStart = performance.now();
      state = projectMeta(world, nextWorld, state);
      const projected = performance.now();
      if (!isDeepStrictEqual(before, occupancy(nextWorld,state.stocks).total)) throw new Error('Projection budget mismatch');
      const restored = restoreMeta(nextWorld, JSON.parse(JSON.stringify(saveMeta(nextWorld,state))));
      if (!isDeepStrictEqual(stepMeta(nextWorld, restored), stepMeta(nextWorld,state))) throw new Error('Epoch restart mismatch');
      world = nextWorld;
      epochs.push({ hour, graphUpdateMs, projectMs: projected-projectStart, totalMs: performance.now()-epochStart, signature: world.graph.signature });
    }
    const target = lab && world.graph.regionToHabitat.get(lab.target);
    const started = performance.now();
    const next = stepMeta(world,state);
    const stepped = performance.now(), duration = stepped - started;
    stepMs += duration; samples.push(duration);
    const balance = auditMeta(state.stocks,next.state.stocks,next.ledger);
    const auditDuration = performance.now()-stepped;
    auditMs += auditDuration;
    auditSamples.push(auditDuration);
    for (const r of metaAccounts) for (const key of ['sources','sinks','converted','transported'] as const) book[key][r] += balance[key][r];
    if (reference) {
      const legacy = stepTrophic(world.graph,reference);
      if (!isDeepStrictEqual(legacy.ledger,next.ledger) || next.state.lotsUsed !== legacy.state.lotsUsed ||
          next.state.stocks.size !== legacy.state.stocks.size) throw new Error('Stationary ledger mismatch');
      for (const [id,s] of legacy.state.stocks) {
        const found = next.state.stocks.get(id);
        if (!found || found.propagules !== 0 || accounts.some(r => s[r] !== found[r])) throw new Error('Stationary inventory mismatch');
      }
      reference = legacy.state;
    }
    let colonies = 0;
    // Replay biological postings to include a death and a new establishment in the same hour.
    const observed = new Map<number, { fungalBiomass: number; detritivores: number }>();
    function observe(id: number, r: typeof groups[number], delta: number, cause: string) {
      let local = observed.get(id);
      if (!local) {
        const opening = state.stocks.get(id) ?? zero;
        local = { fungalBiomass: opening.fungalBiomass, detritivores: opening.detritivores };
        observed.set(id, local);
      }
      const was = local[r];
      local[r] += delta;
      if (!!was === !!local[r]) return;
      const region = world.members[id][0];
      const kind = !local[r] ? 'extinctions' : history[r].has(region) ? 'recolonizations' : 'settlements';
      changes[r][kind]++;
      const delay = local[r] && losses[r].has(region) ? hour-losses[r].get(region)! : undefined;
      if (local[r]) history[r].add(region); else losses[r].set(region,hour);
      if (id === target && events.length < 32) events.push({ hour, region, group: r, kind, cause, delay });
    }
    for (const e of next.ledger) {
      if (e.kind === 'transfer' && (e.resource === 'propagules' || e.resource === 'detritivores')) {
        const flow = flows[e.connector!] ??= {};
        const ports = world.ports.get(e.connector!)!;
        const direction = world.graph.regionToHabitat.get(ports[0]) === e.from ? 'forward' : 'reverse';
        const key = e.resource + '/' + direction;
        flow[key] = (flow[key] ?? 0) + e.amount;
      }
      if (e.resource === 'fungalBiomass' || e.resource === 'detritivores') {
        if (e.from !== null) observe(e.from,e.resource,-e.amount,e.process);
        if (e.to !== null) observe(e.to,e.resource,e.amount,e.process);
        if (e.from !== null && e.process.includes('-mortality/')) causes[e.process] = (causes[e.process] ?? 0) + e.amount;
      }
    }
    for (const s of next.state.stocks.values()) if (s.fungalBiomass || s.detritivores) colonies++;
    peak = Math.max(peak,colonies);
    colonyHours += colonies;
    stockHours += next.state.stocks.size;
    if (values.trace && target !== undefined && [4,8,12,32,36,96,97,100,104].includes(hour)) {
      const source = colonyHome(world.graph,setup);
      trace.push({ hour, source, target, before: [state.stocks.get(source) ?? zero,state.stocks.get(target) ?? zero],
        after: [next.state.stocks.get(source) ?? zero,next.state.stocks.get(target) ?? zero],
        ledger: next.ledger.filter(e => e.process !== 'transport' && (e.from === target || e.to === target ||
          e.connector === lab!.bridge || ['propagule-production','migration-cost'].includes(e.process))) });
    }
    state = next.state;
    if ([48,240,8760,87600,ticks].includes(hour) || (name === 'load' && hour === 12)) {
      const w = occupancy(world,state.stocks);
      for (const r of metaAccounts) if (w.total[r] !== book.sources[r]-book.sinks[r]+book.converted[r]) throw new Error('Period mismatch: '+r);
      windows.push({ hour, ...w, lotsUsed: state.lotsUsed, changes: structuredClone(changes),
        everOccupied: { fungalBiomass: history.fungalBiomass.size, detritivores: history.detritivores.size },
        target: target === undefined ? undefined : state.stocks.get(target) ?? zero });
    }
  }
  const simulationMs = performance.now()-simStart;
  samples.sort((a,b) => a-b);
  auditSamples.sort((a,b) => a-b);
  const elapsed = process.cpuUsage(cpu);
  return { seed: base.graph.seed, scenario: name, ticks, initial, setup, depositCount: deposits.length,
    bridge: lab?.bridge, source: lab?.source, target: lab?.target, peakColonies: peak, meanColonies: colonyHours/ticks, meanHabitatsWithStock: stockHours/ticks, windows, epochs,
    firstTargetEvents: events, trace, flows, mortality: causes, book, buildMs, initializationMs, simulationMs, meanStepMs: stepMs/ticks,
    p95StepMs: samples[Math.ceil(.95*ticks)-1], meanAuditMs: auditMs/ticks, p95AuditMs: auditSamples[Math.ceil(.95*ticks)-1], cpuSimulationMs: (elapsed.user+elapsed.system)/1000,
    peakRssMiB: process.resourceUsage().maxRSS/1024 };
}
for (const seed of positionals.length ? positionals : ['estirpe']) {
  const begin = performance.now(), base = buildDispersalWorld(seed);
  const lab = choice === 'whole' || choice === 'load' || choice === 'stationary' ? undefined : enclosure(base);
  const buildMs = performance.now()-begin;
  for (const name of choice === 'matrix' ? cases : [choice]) console.log(JSON.stringify(experiment(base,name,buildMs,lab)));
}
