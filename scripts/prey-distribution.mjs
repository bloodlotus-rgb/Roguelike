import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { buildDispersalWorld } from '../src/ecology/dispersal-world.ts';
import { auditWeb, foundWeb, inventory, pass, restoreWeb, saveWeb, stepWeb } from '../src/ecology/food-web.ts';
import { enclosure } from './dispersal-trials.ts';

const [seed, directory] = process.argv.slice(2);
if (!['mansion', 'estirpe', 'zz'].includes(seed) || !directory) throw Error('Expected seed and output directory');
mkdirSync(directory, { recursive: true });
const annual = 8760;
const building = buildDispersalWorld(seed), trial = enclosure(building);
const tables = ['space,hunters,split,width,end,habitat,fineRegions,births,ownDeaths,captures,immigration,emigration,net,productiveReachable,prey,huntersEnd,fungus,water,energy,detritus'];
const summaries = [];
const reachCache = new WeakMap();
function reachable(world, site) {
  if (!reachCache.has(world)) reachCache.set(world, new Map());
  const cache = reachCache.get(world);
  if (cache.has(site)) return cache.get(site);
  const graph = world.graph, queue = [site], seen = new Set(queue);
  for (const id of queue) for (const i of graph.incident[id]) {
    const cut = graph.boundaries[i], to = cut.from === id ? cut.to : cut.from;
    if (seen.has(to) || !pass(world, cut, id, 'predator')) continue;
    seen.add(to); queue.push(to);
  }
  cache.set(site, seen);
  return seen;
}
function add(map, key, amount) { map.set(key, (map.get(key) ?? 0) + amount); }
const sum = map => [...map.values()].reduce((a, b) => a + b, 0);
function census(world, state) {
  const prey = new Map(), hunters = new Map();
  let preyPairs = 0, hunterPairs = 0;
  for (const [region, count] of state.residents) {
    const id = world.graph.regionToHabitat.get(region);
    if (count.prey) add(prey, id, count.prey);
    if (count.predator) add(hunters, id, count.predator);
    preyPairs += Math.floor(count.prey / 2); hunterPairs += Math.floor(count.predator / 2);
  }
  return { prey, hunters, preyPairs, hunterPairs };
}
const blank = () => ({ births: 0, deaths: 0, captures: 0, incoming: 0, outgoing: 0, reachableBirth: false });
function run(world, space, hunters, split) {
  const origin = world.graph.regionToHabitat.get(trial.source), receiver = world.graph.regionToHabitat.get(trial.target);
  assert.notEqual(origin, receiver);
  const founder = (group, region, count) => ({ group, count, region, connector: trial.bridge, origin: 'historical lateral entry' });
  const founders = [founder('prey', trial.source, split ? 3 : 6)];
  if (split) founders.push(founder('prey', trial.target, 3));
  if (hunters) founders.push(founder('predator', trial.source, hunters));
  const start = foundWeb(world, trial.setup, founders);
  const initial = auditWeb(world, null, start.state, start.ledger).sources;
  assert.equal(initial.prey, 6); assert.equal(initial.predator, hunters);
  const result = {
    seed, space, hunters, split: split ? '3+3' : '6+0', origin, receiver, bridge: trial.bridge, founders, initial,
    signature: world.graph.signature, setup: trial.setup, births: 0, deaths: 0, hunger: 0, lastQuarter: 0, kills: 0, hunterBirths: 0,
    hunterDeaths: 0, pairHours: 0, originNet: 0, receiverNet: 0, bothHours: 0, peakAccessible: 0,
    positiveWindows: { 48: 0, 72: 0 }, checkpoints: [], losses: [], returns: [], meals: [], globalExtinction: null,
    transfers: {}, sources: {}, sinks: {}, converted: {}, accessReference: hunters ? 'live hunters' : 'founding origin'
  };
  let state = start.state, counts = census(world, state), replay;
  assert.equal(counts.prey.get(origin), split ? 3 : 6); assert.equal(counts.prey.get(receiver) ?? 0, split ? 3 : 0);
  const journal = new Map(), lastBirth = new Map(), lastArrival = new Map(), lastLoss = new Map();
  const windows = [48, 72].map(width => ({ width, stats: new Map(), opening: counts.prey }));
  for (let hour = 1; hour <= annual; hour++) {
    const next = stepWeb(world, state);
    const accounts = auditWeb(world, state, next.state, next.ledger);
    for (const field of ['sources', 'sinks', 'converted']) for (const [r, a] of Object.entries(accounts[field]))
      result[field][r] = (result[field][r] ?? 0) + a;
    if (replay) {
      const other = stepWeb(world, replay);
      assert.deepEqual(other.ledger, next.ledger); replay = other.state;
    }
    result.pairHours += counts.hunterPairs;
    const local = new Map(counts.prey), flows = new Map(), arrivals = new Set();
    const refs = hunters ? [...counts.hunters.keys()] : [origin];
    const canReach = id => refs.some(site => reachable(world, site).has(id));
    function flow(id) { if (!flows.has(id)) flows.set(id, blank()); return flows.get(id); }
    for (const e of next.ledger) {
      const { kind, process, resource, from, to, amount } = e;
      if (kind === 'transfer') {
        const key = [e.connector, from, to, resource].join(',');
        add(journal, key, amount);
        if (resource === 'prey') {
          flow(from).outgoing += amount; flow(to).incoming += amount; arrivals.add(to);
        }
      }
      // Migration debits precede the hunt. Arrivals become edible after the consumer phase.
      if (resource === 'prey' && to !== null && kind !== 'transfer') add(local, to, amount);
      if (from === null) continue;
      if (kind === 'conversion') {
        if (process === 'prey-birth') {
          result.births += amount; flow(from).births += amount; lastBirth.set(from, hour);
          if (hour > 6570) result.lastQuarter += amount;
        }
        if (process.startsWith('prey-mortality/')) {
          result.deaths += amount; flow(from).deaths += amount;
          if (process.endsWith('/food')) result.hunger += amount;
        }
        if (process === 'predator-feeding' || process.startsWith('predator-mortality/')) {
          result.meals.push({
            hour, site: from, outcome: process, localPrey: local.get(from) ?? 0,
            reachablePrey: [...local].reduce((n, [id, v]) => n + (v && reachable(world, from).has(id) ? v : 0), 0),
            globalPrey: sum(local), lastLocalBirth: lastBirth.get(from) ?? null, lastCreditedArrival: lastArrival.get(from) ?? null
          });
          if (process.startsWith('predator-mortality/')) result.hunterDeaths += amount;
        }
        if (resource === 'prey' && (process === 'predator-feeding' || process === 'predator-birth')) {
          flow(from).captures += amount; result.kills += amount;
          if (process === 'predator-birth') result.hunterBirths += amount;
        }
      }
      if (resource === 'prey') add(local, from, -amount);
    }
    for (const id of arrivals) lastArrival.set(id, hour);
    let productive = 0;
    for (const [id, v] of flows) {
      const net = v.births - v.deaths;
      if (id === origin) result.originNet += net;
      if (id === receiver) result.receiverNet += net;
      v.reachableBirth = v.births > 0 && canReach(id);
      if (net > 0 && v.reachableBirth) productive++;
      for (const w of windows) {
        if (!w.stats.has(id)) w.stats.set(id, blank());
        const x = w.stats.get(id);
        for (const key of ['births', 'deaths', 'captures', 'incoming', 'outgoing']) x[key] += v[key];
        x.reachableBirth ||= v.reachableBirth;
      }
    }
    result.peakAccessible = Math.max(result.peakAccessible, productive);
    if (productive >= 2) result.bothHours++;
    const closing = census(world, next.state);
    for (const id of counts.prey.keys()) if (!closing.prey.has(id)) { lastLoss.set(id, hour); result.losses.push({ hour, id }); }
    for (const id of closing.prey.keys()) if (!counts.prey.has(id) && lastLoss.has(id))
      result.returns.push({ hour, id, absentHours: hour - lastLoss.get(id) });
    if (!closing.prey.size && result.globalExtinction === null) result.globalExtinction = hour;
    if ([240, 480, 2190, 6570, annual].includes(hour)) result.checkpoints.push({
      hour, prey: sum(closing.prey), preyPairs: closing.preyPairs,
      hunters: sum(closing.hunters), hunterPairs: closing.hunterPairs
    });
    state = next.state; counts = closing;
    if (hour === 48 || hour === 2190) replay = restoreWeb(world, JSON.parse(JSON.stringify(saveWeb(world, state))));
    if (hour === 120 || hour === 2262) { assert.deepEqual(saveWeb(world, replay), saveWeb(world, state)); replay = undefined; }
    for (const window of windows) if (hour % window.width === 0 || hour === annual) {
      const stock = inventory(world, state);
      const ids = new Set([...stock.keys(), ...window.stats.keys(), ...window.opening.keys()]);
      let positive = 0;
      for (const id of ids) {
        const v = window.stats.get(id) ?? blank(), net = v.births - v.deaths;
        const prey = counts.prey.get(id) ?? 0;
        assert.equal((window.opening.get(id) ?? 0) + net - v.captures + v.incoming - v.outgoing, prey);
        const accessible = net > 0 && v.reachableBirth;
        if (accessible) positive++;
        const s = stock.get(id);
        tables.push([space, hunters, result.split, window.width, hour, id, world.members[id].join('|'), v.births, v.deaths,
          v.captures, v.incoming, v.outgoing, net, +accessible, prey, counts.hunters.get(id) ?? 0, s?.fungalBiomass ?? 0,
          s?.water ?? 0, s?.energy ?? 0, s?.detritus ?? 0].join(','));
      }
      if (positive >= 2) result.positiveWindows[window.width]++;
      window.stats.clear(); window.opening = counts.prey;
    }
  }
  result.transfers = Object.fromEntries(journal);
  result.finalInventory = {};
  for (const stock of inventory(world, state).values()) {
    for (const [resource, amount] of Object.entries(stock)) {
      result.finalInventory[resource] = (result.finalInventory[resource] ?? 0) + amount;
    }
  }
  for (const [resource, amount] of Object.entries(initial)) {
    assert.equal(result.finalInventory[resource] ?? 0,
      amount + result.sources[resource] - result.sinks[resource] + result.converted[resource]);
  }
  assert.equal(sum(counts.prey), 6 + result.births - result.deaths - result.kills);
  assert.equal(sum(counts.hunters), hunters + result.hunterBirths - result.hunterDeaths);
  result.lots = state.base.lotsUsed;
  return result;
}
for (const [space, world] of [['recinto', trial.open], ['edificio', building]]) for (const hunters of [0, 2]) {
  const control = run(world, space, hunters, false), test = run(world, space, hunters, true);
  for (const k of ['signature', 'setup', 'bridge', 'initial', 'sources', 'lots']) assert.deepEqual(test[k], control[k]);
  summaries.push(control, test);
}
writeFileSync(join(directory, seed + '.jsonl.gz'), gzipSync(summaries.map(x => JSON.stringify(x)).join('\n') + '\n'));
writeFileSync(join(directory, seed + '-ventanas.csv.gz'), gzipSync(tables.join('\n') + '\n'));
