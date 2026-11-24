import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { buildDispersalWorld } from '../../src/ecology/dispersal-world.ts';
import { auditWeb, foundWeb, inventory, pass, restoreWeb, saveWeb, stepWeb } from '../../src/ecology/food-web.ts';
import { channelLimit, channelReach } from '../../src/ecology/transport.ts';
import { enclosure } from '../dispersal-trials.ts';

const [seed, directory] = process.argv.slice(2);
assert.ok(['mansion', 'estirpe', 'zz'].includes(seed) && directory);
mkdirSync(directory, { recursive: true });
const resources = ['water', 'detritus', 'energy'];
const duration = 8760;
const makeDigest = () => createHash('sha256');
const byRegion = (a, b) => a[0].localeCompare(b[0], 'en');

function fineCensus(state) {
  const cells = new Map();
  for (const [region, stock] of state.base.anchors) {
    cells.set(region, [stock.fungalBiomass, stock.propagules, stock.detritivores, 0]);
  }
  for (const [region, stock] of state.residents) {
    assert.equal(stock.predator, 0);
    const cell = cells.get(region) ?? [0, 0, 0, 0];
    cell[3] = stock.prey;
    cells.set(region, cell);
  }
  return [...cells].sort(byRegion);
}

function preyReachable(world, start) {
  const queue = [start], seen = new Set(queue);
  for (const id of queue) {
    for (const index of world.graph.incident[id]) {
      const cut = world.graph.boundaries[index];
      const to = cut.from === id ? cut.to : cut.from;
      if (!seen.has(to) && pass(world, cut, id, 'prey')) {
        queue.push(to);
        seen.add(to);
      }
    }
  }
  return seen;
}

function run(world, trial, space, prey, record) {
  const founders = prey ? [{ group: 'prey', count: prey, region: trial.source, connector: trial.bridge,
    origin: 'historical lateral entry' }] : [];
  const initial = foundWeb(world, trial.setup, founders);
  auditWeb(world, null, initial.state, initial.ledger);
  const digest = makeDigest();
  const origin = world.graph.regionToHabitat.get(trial.source);
  const receiver = world.graph.regionToHabitat.get(trial.target);
  const habitats = new Set([origin, receiver]), consumers = new Set();
  const postings = [], indices = new Map(), hours = [];
  function encode(ledger) {
    return ledger.flatMap(({ kind, process, resource, from, to, connector, amount }) => {
      const key = [kind, process, resource, from, to, connector ?? null];
      const name = JSON.stringify(key);
      if (!indices.has(name)) {
        indices.set(name, postings.length);
        postings.push(key);
      }
      return [indices.get(name), amount];
    });
  }
  const opening = encode(initial.ledger), openingFine = fineCensus(initial.state);
  const startingFrame = saveWeb(world, initial.state);
  let state = initial.state, replay, exhausted;
  for (let hour = 1; hour <= duration; hour++) {
    const next = stepWeb(world, state);
    auditWeb(world, state, next.state, next.ledger);
    const fine = fineCensus(next.state);
    for (const [region, cell] of fine) {
      assert.ok(cell.reduce((a,b) => a+b, 0) <= world.capacities.get(region));
    }
    const stock = [...inventory(world, next.state)].sort(([a], [b]) => a-b);
    digest.update(JSON.stringify([hour, next.state.base.lotsUsed, next.ledger, stock, fine]) + '\n');
    if (record) {
      for (const [id] of stock) habitats.add(id);
      for (const region of state.residents.keys()) consumers.add(world.graph.regionToHabitat.get(region));
      hours.push([encode(next.ledger), fine]);
    }
    if (replay) {
      const repeated = stepWeb(world, replay);
      assert.deepEqual(repeated.ledger, next.ledger);
      replay = repeated.state;
    }
    state = next.state;
    if (!exhausted && state.base.lotsUsed === trial.setup.source.quota) exhausted = hour;
    if (record && hour === 48) replay = restoreWeb(world, JSON.parse(JSON.stringify(saveWeb(world, state))));
    if (record && hour === duration) {
      assert.deepEqual(saveWeb(world, replay), saveWeb(world, state));
      replay = undefined;
    }
  }
  assert.equal(exhausted, duration);
  const check = { topology: world.graph.signature, contract: startingFrame.base.contract,
    start: startingFrame.signature, trajectory: digest.digest('hex'), end: saveWeb(world, state).signature };
  if (record) {
    const allowed = Object.fromEntries(resources.map(r => [r, new Set(channelReach(world.graph, origin, r))]));
    const bridge = world.graph.boundaries.find(c => c.id === trial.bridge);
    const sites = [...habitats].sort((a,b) => a-b);
    const geometry = sites.map(id => ({ id, regions: world.members[id], capacity: world.graph.habitats[id].capacity,
      channelsFromOrigin: resources.filter(r => allowed[r].has(id)) }));
    const preyPaths = {};
    for (const id of consumers) {
      const reachable = preyReachable(world, id);
      preyPaths[id] = sites.filter(site => reachable.has(site));
    }
    const result = { seed, space, prey, check, setup: trial.setup, founders, origin, receiver, bridge: trial.bridge,
      ports: [trial.source,trial.target], bridgeLimits: Object.fromEntries(resources.map(r => [r, channelLimit(world.graph, bridge, origin, r)])),
      exhausted, geometry, preyPaths, opening, openingFine, postings, hours };
    writeFileSync(join(directory, [seed, space, prey].join('-') + '.json.gz'), gzipSync(JSON.stringify(result)));
  }
  return check;
}

// Rebuild each geometry independently, then compare the ordered ledger and state for every hour.
const first = new Map();
for (const record of [true, false]) {
  const building = buildDispersalWorld(seed), trial = enclosure(building);
  for (const [space, world] of [['recinto', trial.open], ['edificio', building]]) {
    const checks = [0, 6].map(prey => run(world, trial, space, prey, record));
    assert.equal(checks[0].contract, checks[1].contract);
    assert.equal(checks[0].topology, checks[1].topology);
    if (record) first.set(space, checks);
    else assert.deepEqual(checks, first.get(space));
  }
}
console.log(seed, 'verified');
