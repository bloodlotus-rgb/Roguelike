import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {indexWorld} from '../src/ecology/dispersal-world.ts';
import {foundFoodChain} from '../src/ecology/chemical-food-contract.ts';
import {stepFoodChain} from '../src/ecology/chemical-food-chain.ts';
import {restoreFoodChain, saveFoodChain} from '../src/ecology/chemical-food-snapshot.ts';
import {chemicalDelivery, chemicalDigest} from '../src/ecology/chemical-ledger.ts';
import {planChemicalTransport} from '../src/ecology/chemical-transport.ts';

assert(process.argv.length === 4, 'Usage: node scripts/e2a-regulacion.mjs ISSUE85_RESULTS.json OUTPUT_DIRECTORY');
const reference = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const output = resolve(process.argv[3]);
const windows = [[1,168],[169,336],[337,504],[505,672],[649,672]];
assert.equal(reference.revision, '3ef621b8651fc6f54b27ff36537979d99c904cd1');
assert.equal(reference.horizon, 672);
const candidates = reference.results.filter(result => result.arm === 'recurrente');
assert.deepEqual(candidates.map(result => result.id), ['X-renovacion','X-asimilacion','X-reserva']);
const {seed, signature, habitats, ports, boundaries} = reference.world;
const regions = new Map([['test',0],['port',1]]);
const world = indexWorld({seed, signature, habitats, boundaries, regionToHabitat:regions, entrance:0,
  incident:[[0],[0]], barriers:[]}, new Map(ports),
  new Map([...regions].map(([name,id]) => [name,habitats[id].capacity])));
const zeroBody = {matter:0,chemicalEnergy:0,storedEnergy:0};
const zeroStock = {detritus:{matter:0,chemicalEnergy:0},mineralMatter:0,water:0};

function inventory(state) {
  const stock = state.chemical.inventory.get(0) ?? zeroStock;
  return {fungus:state.fungus.get(0) ?? zeroBody, detritus:stock.detritus, mineral:stock.mineralMatter,
    water:stock.water, heat:state.chemical.heat.get(0) ?? 0,
    lots:state.chemical.lotsUsed.get('detrital-pulse') ?? 0};
}

const metrics = ['importM','importE','importWater','convertedM','growthM','lossM','mineralizedM','retiredE',
  'assimE','preRegressionDemandE','dueE','paidE','heatE'];
function summarize(rows, [start,end]) {
  const interval = rows.slice(start,end+1);
  const opening = rows[start-1].inventory, closing = rows[end].inventory;
  return {start,end,opening,closing,peakM:Math.max(opening.fungus.matter,...interval.map(r=>r.inventory.fungus.matter)),
    minimumM:Math.min(opening.fungus.matter,...interval.map(r=>r.inventory.fungus.matter)),
    ...Object.fromEntries(metrics.map(key => [key,interval.reduce((sum,row)=>sum+row[key],0)]))};
}
function qualifies(result) {
  return result.windows.slice(2,4).every(window => window.minimumM > 0 && window.convertedM > 0 &&
    window.dueE === window.paidE && window.opening.fungus.matter === window.closing.fungus.matter &&
    window.closing.fungus.storedEnergy >= window.opening.fungus.storedEnergy);
}

function run(candidate, regulation, stopAfter) {
  const rules = {...candidate.rules,fungus:{...candidate.rules.fungus,regulation}};
  const source = {...candidate.source};
  if (stopAfter !== undefined) source.quotaLots = source.rate * (stopAfter/source.periodHours);
  const sources = [source], initial = candidate.initial;
  let state = foundFoodChain(world,sources,rules,{inventory:new Map([[0,{
    detritus:initial.detritus,mineralMatter:initial.mineral,water:initial.water,
  }]]), fungus:new Map([[0,initial.fungus]]),animals:[]});
  assert.deepEqual(inventory(state),initial);
  const rows = [{hour:0,inventory:initial}];
  let extinct = null;
  for (let hour=1; hour<=reference.horizon; hour++) {
    const delivery = chemicalDelivery(world,source,state.chemical,'input-'+hour);
    const report = stepFoodChain(world,sources,rules,state,
      {chemical:[...planChemicalTransport(world,state.chemical),...(delivery?[delivery]:[])]});
    assert.equal(report.cutFlows.passive.length,0,'the auxiliary port must stay inactive');
    assert.equal(report.state.animals.size,0);
    const {opening,closing,imported,exported,dissipated} = report.audit;
    for (const key of ['matter','chemicalEnergy','water']) {
      assert.equal(closing[key]+exported[key]+(key==='chemicalEnergy'?dissipated:0n),opening[key]+imported[key]);
    }
    const shouldDeliver = hour <= (stopAfter ?? reference.horizon) && (hour-1)%source.periodHours===0;
    assert.equal(imported.matter,shouldDeliver?4n:0n);
    assert.equal(imported.chemicalEnergy,BigInt(shouldDeliver?4*source.perLot.detritus.chemicalEnergy:0));
    const before = inventory(state);
    state = report.state;
    const after = inventory(state);
    assert(after.fungus.matter>=0 && after.fungus.matter<=habitats[0].capacity);
    const growth = report.entries.find(entry=>entry.phase==='grow');
    const grown = growth?.credits.find(account=>account.kind==='fungus')?.stock ?? before.fungus;
    const maintenance = report.entries.find(entry=>entry.phase!=='grow');
    const lossM = grown.matter-after.fungus.matter;
    const returned = maintenance?.credits.find(account=>account.kind==='stock')?.stock;
    const prior = maintenance?.debits.find(account=>account.kind==='stock')?.stock;
    if (lossM) assert.equal((returned?.detritus.matter ?? 0)-(prior?.detritus.matter ?? 0),lossM);
    if (lossM && !after.fungus.matter && extinct === null) extinct = hour;
    const due = grown.matter*rules.fungus.maintenance;
    rows.push({hour,inventory:after,importM:Number(imported.matter),importE:Number(imported.chemicalEnergy),
      importWater:Number(imported.water),convertedM:before.detritus.matter+Number(imported.matter)-after.detritus.matter+lossM,
      growthM:grown.matter-before.fungus.matter,lossM,mineralizedM:after.mineral-before.mineral,
      retiredE:(returned?.detritus.chemicalEnergy ?? 0)-(prior?.detritus.chemicalEnergy ?? 0),
      assimE:grown.storedEnergy-before.fungus.storedEnergy,preRegressionDemandE:due,
      dueE:maintenance?.phase==='regress'?after.fungus.matter*rules.fungus.maintenance:due,
      paidE:maintenance?.heat.energy ?? 0,heatE:Number(dissipated)});
    if (hour===336) {
      const checkpoint = saveFoodChain(world,sources,rules,state);
      state = restoreFoodChain(world,sources,rules,JSON.parse(JSON.stringify(checkpoint)));
      assert.deepEqual(saveFoodChain(world,sources,rules,state),checkpoint);
    }
  }
  assert.equal(rows.at(-1).inventory.lots,source.quotaLots);
  return {id:candidate.id,regulation,stopAfter:stopAfter ?? null,source,rules,extinct,rows,
    windows:windows.map(interval=>summarize(rows,interval)), total:summarize(rows,[1,reference.horizon])};
}

const results = [];
const regulations = ['growth-budget','partial-regression'];
for (const regulation of regulations) {
  for (const candidate of candidates) results.push(run(candidate,regulation));
}
for (const regulation of regulations) {
  // Use the first qualifying candidate in the recorded #85 order for each variant.
  const continuous = results.find(result=>result.regulation===regulation && qualifies(result));
  if (!continuous) continue;
  const candidate = candidates.find(item=>item.id===continuous.id);
  const cutoff = run(candidate,regulation,504);
  assert.deepEqual(cutoff.rows.slice(0,505),continuous.rows.slice(0,505));
  results.push(cutoff);
}
mkdirSync(output,{recursive:true});
const manifest = {protocol:86,baseline:reference.revision,referenceDigest:chemicalDigest(reference),windows,
  horizon:reference.horizon,world:reference.world,results:results.map(result=>({...result,qualifies:qualifies(result)})),
  reference:candidates.map(({id,source,rules,initial,windows,extinct})=>({id,source,rules,initial,windows,extinct}))};
writeFileSync(resolve(output,'results.json'),JSON.stringify(manifest,null,2)+'\n');
const columns = ['id','regulation','stopAfter','start','end','extinct','peakM','minimumM',
  'openingM','closingM','openingReserveE','closingReserveE',...metrics];
const csv = [columns,...results.flatMap(result=>result.windows.map(window=>[
  result.id,result.regulation,result.stopAfter,window.start,window.end,result.extinct,window.peakM,window.minimumM,
  window.opening.fungus.matter,window.closing.fungus.matter,window.opening.fungus.storedEnergy,window.closing.fungus.storedEnergy,
  ...metrics.map(key=>window[key]),
]))].map(row=>row.join(',')).join('\n')+'\n';
writeFileSync(resolve(output,'windows.csv'),csv);
console.log(csv);
