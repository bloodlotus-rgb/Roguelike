import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { buildDispersalWorld } from '../../src/ecology/dispersal-world.ts';
import { auditWeb, foundWeb, inventory, restoreWeb, saveWeb, stepWeb } from '../../src/ecology/food-web.ts';
import { enclosure } from '../dispersal-trials.ts';

const [seed, output, evidenceDirectory] = process.argv.slice(2);
assert.ok(['mansion', 'estirpe', 'zz'].includes(seed) && output && evidenceDirectory);
mkdirSync(output, { recursive: true });
const complete = buildDispersalWorld(seed);
const trial = enclosure(complete);

// D0 format: a region and its anchored fungus, propagules, detritivores and resident prey.
function fineState(web) {
  const values = new Map([...web.base.anchors].map(([r,s]) => [r,[s.fungalBiomass,s.propagules,s.detritivores,0]]));
  for (const [r,counts] of web.residents) {
    assert.equal(counts.predator, 0);
    const tissue = values.get(r) ?? [0,0,0,0];
    tissue[3] = counts.prey;
    values.set(r,tissue);
  }
  return [...values].sort(([a],[b]) => a.localeCompare(b,'en'));
}

function simulate(world, space, prey, priority, reference) {
  const founders = prey ? [{group:'prey', count:6, region:trial.source, connector:trial.bridge, origin:'historical lateral entry'}] : [];
  const start = () => foundWeb(world,trial.setup,founders,priority);
  const founded = start();
  auditWeb(world,null,founded.state,founded.ledger);
  const initial = saveWeb(world,founded.state);
  assert.deepEqual(founders,reference.founders);
  assert.deepEqual(initial.base.setup,reference.setup);
  assert.equal(initial.base.topology,reference.check.topology);
  assert.equal(initial.base.contract,reference.check.contract);
  const entries = [], codes = new Map();
  function encode(ledger) {
    const encoded = [];
    for (const e of ledger) {
      const key = [e.kind,e.process,e.resource,e.from,e.to,e.connector ?? null];
      const serialized = JSON.stringify(key);
      if (!codes.has(serialized)) {
        codes.set(serialized,entries.length);
        entries.push(key);
      }
      encoded.push(codes.get(serialized), e.amount);
    }
    return encoded;
  }

  const opening = encode(founded.ledger), hours = [], sites = new Set();
  const hash = createHash('sha256');
  let state = founded.state, duplicate = start().state;
  let exhausted = null;
  for (let hour=1; hour<=8760; hour++) {
    const next = stepWeb(world,state), copy = stepWeb(world,duplicate);
    assert.deepEqual(copy.ledger,next.ledger);
    auditWeb(world,state,next.state,next.ledger);
    const cells = fineState(next.state);
    for (const [r,cell] of cells) assert.ok(cell.reduce((a,b) => a+b,0) <= world.capacities.get(r));
    const stocks = [...inventory(world,next.state)].sort(([a],[b]) => a-b);
    for (const [id] of stocks) sites.add(id);
    const used = next.state.base.lotsUsed;
    if (used === trial.setup.source.quota && exhausted === null) exhausted = hour;
    hash.update(JSON.stringify([hour,used,next.ledger,stocks,cells])+'\n');
    const frame = [encode(next.ledger),cells];
    if (!priority) assert.deepEqual(frame,reference.hours[hour-1]);
    hours.push(frame);
    state = next.state;
    duplicate = copy.state;
    if ([48,2190,8760].includes(hour)) {
      const snapshot = saveWeb(world,duplicate);
      assert.deepEqual(snapshot,saveWeb(world,state));
      if (hour < 8760) {
        duplicate = restoreWeb(world,JSON.parse(JSON.stringify(snapshot)));
        // Vary insertion order only; ledger traversal must retain its canonical order.
        duplicate.base.stocks = new Map([...duplicate.base.stocks].reverse());
        duplicate.residents = new Map([...duplicate.residents].reverse());
      }
    }
  }
  assert.equal(exhausted,8760);
  const checks = {topology:initial.base.topology, contract:initial.base.contract, start:initial.signature,
    trajectory:hash.digest('hex'), end:saveWeb(world,state).signature};
  if (!priority) {
    assert.deepEqual(checks,reference.check);
    assert.deepEqual(opening,reference.opening);
    assert.deepEqual(entries,reference.postings);
    assert.deepEqual(fineState(founded.state),reference.openingFine);
  }
  const regionSites = {};
  for (const id of sites) for (const r of world.members[id]) regionSites[r] = id;
  const name = [seed,space,prey,priority?'priority':'original'].join('-');
  const data = {name,seed,space,prey,priority,origin:reference.origin,receiver:reference.receiver,ports:reference.ports,
    bridge:trial.bridge,setup:trial.setup,founders,regionSites,entries,opening,initialCells:fineState(founded.state),
    hours,checks,exhausted,lots:state.base.lotsUsed,version:initial.version};
  writeFileSync(join(output,name+'.json.gz'), gzipSync(JSON.stringify(data)));
  console.log(name, checks.trajectory);
}

for (const [space,world] of [['recinto',trial.open],['edificio',complete]]) {
  for (const prey of [0,6]) {
    const path = [seed,space,prey].join('-')+'.json.gz';
    const reference = JSON.parse(gunzipSync(readFileSync(join(evidenceDirectory,path))));
    for (const priority of [false,true]) simulate(world,space,prey,priority,reference);
  }
}
