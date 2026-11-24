import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {indexWorld} from '../src/ecology/dispersal-world.ts';
import {foundFoodChain} from '../src/ecology/chemical-food-contract.ts';
import {foodLedgerDigest, serializeFoodLedger, stepFoodChain} from '../src/ecology/chemical-food-chain.ts';
import {restoreFoodChain, saveFoodChain} from '../src/ecology/chemical-food-snapshot.ts';
import {chemicalDelivery, chemicalDigest} from '../src/ecology/chemical-ledger.ts';
import {planChemicalTransport} from '../src/ecology/chemical-transport.ts';

const [referencePath, destination] = process.argv.slice(2);
assert(referencePath && destination, 'Usage: node scripts/e2a4-recuperacion.mjs E2A86_RESULTS.json OUTPUT_DIRECTORY|--calendar');
const previous = JSON.parse(readFileSync(referencePath,'utf8'));
assert.equal(previous.protocol,86);
assert.equal(previous.horizon,672);
const reference = previous.results.find(r=>r.id==='X-reserva' && r.regulation==='growth-budget' && r.stopAfter===null);
assert(reference);
const {source, rules: original, rows: historical} = reference;
const sources = [source], initial = historical[0].inventory;
const {seed, signature, habitats, ports, boundaries} = previous.world;
const regions = new Map([['test',0],['port',1]]);
const world = indexWorld({seed,signature,habitats,boundaries,regionToHabitat:regions,entrance:0,incident:[[0],[0]],barriers:[]},
  new Map(ports),new Map([...regions].map(([id,index])=>[id,habitats[index].capacity])));
const combined = {...original,fungus:{...original.fungus,regulation:'growth-budget-and-regression'}};
const zeroBody = {matter:0,chemicalEnergy:0,storedEnergy:0};
const zeroStock = {detritus:{matter:0,chemicalEnergy:0},mineralMatter:0,water:0};
const opening = rules => foundFoodChain(world,sources,rules,{inventory:new Map([[0,{
  detritus:initial.detritus,mineralMatter:initial.mineral,water:initial.water,
}]]),fungus:new Map([[0,initial.fungus]]),animals:[]});
const horizon = previous.horizon, interval = original.fungus.feeding.interval;
const omitted = 337, criticalFeeding = 342, resume = 343;
const windows = [[1,168],[169,336],[337,504],[505,672],[649,672]];

function preflight() {
  const referenceState = opening(original).chemical;
  assert.deepEqual([source.rate,source.perLot.detritus.matter,source.perLot.detritus.chemicalEnergy,
    source.periodHours,source.activeHours,source.quotaLots,interval],[4,1,192,6,1,448,6]);
  const delivery = hour => chemicalDelivery(world,source,{...referenceState,tick:hour-1},'schedule');
  for (const [hour,lots] of [[336,0],[omitted,4],[341,0],[criticalFeeding,0],[resume,4]]) {
    assert.equal(delivery(hour)?.lots ?? 0,lots);
    assert.equal(historical[hour].importM,lots);
  }
  assert.equal(omitted%interval,1);
  assert.equal(criticalFeeding%interval,0);
  assert.equal(resume,omitted+source.periodHours);
  assert.equal(historical[336].inventory.detritus.matter,0);
  assert.equal(historical[341].inventory.fungus.storedEnergy,0);
  assert.equal(historical[criticalFeeding].convertedM,4);
  return {previousFeeding:336,omitted,criticalFeeding,resume,quotaLots:source.quotaLots,
    deliveryPhase:'1 mod 6',feedingPhase:'0 mod 6'};
}
const calendar = preflight();
if (destination==='--calendar') {
  console.log(JSON.stringify(calendar));
  process.exit(0);
}

const setups = [
  {id:'AB-control',rules:combined,harvests:[]},
  {id:'AB-retiro-8',rules:combined,harvests:[[336,8]]},
  {id:'AB-retiro-16',rules:combined,harvests:[[336,16]]},
  {id:'AB-retiro-repetido',rules:combined,harvests:[[336,8],[408,8],[480,8],[552,8]]},
  {id:'A-pulso-omitido',rules:original,harvests:[],omit:omitted},
  {id:'AB-pulso-omitido',rules:combined,harvests:[],omit:omitted},
];
function inventory(state) {
  const stock = state.chemical.inventory.get(0) ?? zeroStock;
  return {fungus:state.fungus.get(0) ?? zeroBody,detritus:stock.detritus,mineral:stock.mineralMatter,
    water:stock.water,heat:state.chemical.heat.get(0) ?? 0,lots:state.chemical.lotsUsed.get(source.id) ?? 0};
}
const replayHours = new Set([336,337,342,343,408,480,552,649]);
const metrics = ['importM','importE','exportM','exportE','exportReserveE','convertedM','growthM','lossM',
  'mineralizedM','retiredE','assimE','maintenancePaidE','heatE'];

function run(setup) {
  const {id,rules,harvests,omit} = setup;
  const withdrawals = new Map(harvests);
  let state = opening(rules), extinct = null;
  const rows = [{hour:0,inventory:inventory(state)}];
  assert.deepEqual(rows[0].inventory,initial);
  for (let hour=1;hour<=horizon;hour++) {
    const plan = planChemicalTransport(world,state.chemical);
    assert.equal(plan.length,0,'auxiliary port activity');
    const delivery = hour===omit ? undefined : chemicalDelivery(world,source,state.chemical,'input-'+hour);
    const withdrawal = withdrawals.get(hour);
    const input = {chemical:delivery?[delivery]:[],harvest:withdrawal===undefined?undefined:{habitat:0,matter:withdrawal}};
    const before = inventory(state);
    const report = stepFoodChain(world,sources,rules,state,input);
    assert.equal(report.state.animals.size,0);
    if (replayHours.has(hour)) {
      const saved = saveFoodChain(world,sources,rules,state);
      const restored = restoreFoodChain(world,sources,rules,JSON.parse(JSON.stringify(saved)));
      const replay = stepFoodChain(world,sources,rules,restored,input);
      assert.equal(serializeFoodLedger(replay),serializeFoodLedger(report));
      assert.deepEqual(saveFoodChain(world,sources,rules,replay.state),saveFoodChain(world,sources,rules,report.state));
      assert.deepEqual(replay.audit,report.audit);
    }
    const {opening,closing,imported,exported,dissipated} = report.audit;
    const shouldDeliver = hour!==omit && hour%source.periodHours===1;
    assert.equal(imported.matter,shouldDeliver?4n:0n);
    assert.equal(imported.chemicalEnergy,shouldDeliver?768n:0n);
    for (const key of ['matter','chemicalEnergy','water']) {
      assert.equal(closing[key]+exported[key]+(key==='chemicalEnergy'?dissipated:0n),opening[key]+imported[key],
        id+':'+hour+':'+key);
    }
    state = report.state;
    const after = inventory(state);
    const harvest = report.entries.find(entry=>entry.phase==='harvest');
    const grown = report.entries.find(e=>e.phase==='grow')?.credits.find(a=>a.kind==='fungus')?.stock ?? before.fungus;
    const preHarvest = harvest?.debits.find(a=>a.kind==='fungus')?.stock ?? after.fungus;
    const maintenance = report.entries.find(e=>['maintain','regress','die'].includes(e.phase));
    const lossM = grown.matter-preHarvest.matter;
    const retired = maintenance?.credits.find(a=>a.kind==='stock')?.stock;
    const original = maintenance?.debits.find(a=>a.kind==='stock')?.stock;
    if (lossM && !after.fungus.matter && extinct===null) extinct = hour;
    assert.equal(after.fungus.matter,preHarvest.matter-(withdrawal??0));
    assert.equal(exported.matter,BigInt(withdrawal??0));
    assert.equal(exported.chemicalEnergy,BigInt(harvest?.exported.chemicalEnergy??0));
    if (harvest) {
      const round = value => Math.floor((2*value*withdrawal+preHarvest.matter)/(2*preHarvest.matter));
      assert.equal(harvest.exported.chemicalEnergy,round(preHarvest.chemicalEnergy));
      assert.equal(harvest.exported.storedEnergy,round(preHarvest.storedEnergy));
    }
    rows.push({hour,inventory:after,preHarvest,importM:Number(imported.matter),importE:Number(imported.chemicalEnergy),
      exportM:Number(exported.matter),exportE:Number(exported.chemicalEnergy),exportReserveE:harvest?.exported.storedEnergy??0,
      convertedM:before.detritus.matter+Number(imported.matter)-after.detritus.matter+lossM,
      growthM:grown.matter-before.fungus.matter,lossM,mineralizedM:after.mineral-before.mineral,
      retiredE:(retired?.detritus.chemicalEnergy??0)-(original?.detritus.chemicalEnergy??0),
      assimE:grown.storedEnergy-before.fungus.storedEnergy,maintenancePaidE:maintenance?.heat.energy??0,
      heatE:Number(dissipated),ledger:foodLedgerDigest(report)});
  }
  assert.equal(rows[horizon].inventory.lots,source.quotaLots-(omit===undefined?0:source.rate));
  return {id,rules,harvests,omit:omit??null,extinct,rows,
    windows:windows.map(([from,to])=>({from,to,opening:rows[from-1].inventory,closing:rows[to].inventory,
      ...Object.fromEntries(metrics.map(key=>[key,rows.slice(from,to+1).reduce((sum,row)=>sum+row[key],0)]))}))};
}

const results = setups.map(run);
const [control,,,repeated,outageA,outageAB] = results;
assert.deepEqual(control.rows.map(row=>row.inventory),historical.map(row=>row.inventory));
for (const result of [outageA,outageAB]) {
  assert.deepEqual(result.rows.slice(0,337).map(row=>row.inventory),control.rows.slice(0,337).map(row=>row.inventory));
}
function recovery(result) {
  return result.harvests.map(([hour,matter],i) => {
    const next = result.harvests[i+1]?.[0] ?? horizon;
    const after = result.rows[hour].inventory.fungus;
    const same = h => ['matter','chemicalEnergy','storedEnergy'].every(key =>
      result.rows[h].preHarvest[key]===control.rows[h].preHarvest[key]);
    let first=null, confirmed=null;
    for(let h=hour+interval;h<=next;h+=interval) {
      if (first===null && same(h)) first=h;
      if (h+interval<=next && same(h) && same(h+interval)) {
        confirmed=h+interval;
        break;
      }
    }
    const restored=first===null?null:result.rows[first].preHarvest;
    return {hour,matter,exportedE:result.rows[hour].exportE,exportedReserveE:result.rows[hour].exportReserveE,
      after,first,confirmed,restored,
      regained:restored===null?null:Object.fromEntries(Object.keys(after).map(key=>[key,restored[key]-after[key]])),
      beforeNext:result.rows[next].preHarvest};
  });
}
for(const result of results) result.recovery=recovery(result);
assert.equal(repeated.harvests.length,4);
const output=resolve(destination);
mkdirSync(output,{recursive:true});
writeFileSync(resolve(output,'results.json'),JSON.stringify({protocol:88,base:'5b653bf95785d9591c36f8f809ad8b36605414d6',
  referenceDigest:chemicalDigest(previous),calendar,source,world:previous.world,results},null,2)+'\n');
const table=[['id','extinct','endM','endChemicalE','endReserveE','importM','exportM','exportE','exportReserveE','growthM',
  'lossM','mineralizedM','heatE'],...results.map(result=>[result.id,result.extinct,
    ...Object.values(result.rows.at(-1).inventory.fungus),
    ...['importM','exportM','exportE','exportReserveE','growthM','lossM','mineralizedM','heatE'].map(key=>
      result.rows.slice(1).reduce((sum,row)=>sum+row[key],0))])];
const csv=table.map(row=>row.join(',')).join('\n')+'\n';
writeFileSync(resolve(output,'summary.csv'),csv);
console.log(csv);
