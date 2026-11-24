import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {indexWorld} from '../src/ecology/dispersal-world.ts';
import {foundFoodChain, validateFoodState} from '../src/ecology/chemical-food-contract.ts';
import {foodBalances, foodLedgerDigest, stepFoodChain} from '../src/ecology/chemical-food-chain.ts';
import {restoreFoodChain, saveFoodChain} from '../src/ecology/chemical-food-snapshot.ts';
import {chemicalDelivery, chemicalDigest} from '../src/ecology/chemical-ledger.ts';
import {planChemicalTransport} from '../src/ecology/chemical-transport.ts';

const [referencePath, destination] = process.argv.slice(2);
assert(referencePath && destination, 'Usage: node scripts/e2b2-presupuesto.mjs ISSUE88_RESULTS.json OUTPUT|--preflight');
const reference = JSON.parse(readFileSync(referencePath,'utf8'));
assert.equal(reference.protocol,88);
const baseline = reference.results.find(result=>result.id==='AB-control');
assert(baseline);
const start = 336, end = 816, pulses = 80;
const initial = baseline.rows[start].inventory;
assert.deepEqual([initial.fungus.matter,initial.fungus.chemicalEnergy,initial.fungus.storedEnergy,
  initial.water,initial.lots,reference.source.quotaLots],[64,320,320,1,224,448]);
const {seed,signature,habitats,ports,boundaries} = reference.world;
const regions = new Map([['test',0],['port',1]]);
const world = indexWorld({seed,signature,habitats,boundaries,regionToHabitat:regions,entrance:0,incident:[[0],[0]],barriers:[]},
  new Map(ports),new Map([...regions].map(([id,index])=>[id,habitats[index].capacity])));
const zeroBody = {matter:0,chemicalEnergy:0,storedEnergy:0};
const empty = {detritus:{matter:0,chemicalEnergy:0},mineralMatter:0,water:0};
const birth = {matter:1,energy:12,reserve:11,heat:1,adultAge:48,interval:24};
const treatments = [
  ['basal',4,192,250,1000],
  ['igual-E',8,96,500,1000],
  ['intensivo',20,192,500,1000],
  ['intensivo-750',20,192,500,750],
];
const setups = treatments.flatMap(([label,rate,density,retention,assimilation])=>
  [false,true].map(conditioned=>{
    const prey = {...baseline.rules.prey,maintenance:1,reservePerMatter:12,birth,
      feeding:{...baseline.rules.prey.feeding,interval:12,biteMatter:4,retainedMatterPermille:500,reservePermille:assimilation}};
    if (conditioned) prey.reproduction='maintenance-budget';
    const fungus = {...baseline.rules.fungus,feeding:{...baseline.rules.fungus.feeding,biteMatter:rate,
      retainedMatterPermille:retention}};
    const source = {...reference.source,id:'detrital-pulse-e2b2',rate,quotaLots:pulses*rate,
      perLot:{...empty,detritus:{matter:1,chemicalEnergy:density}}};
    return {id:label+(conditioned?'-condicionada':'-actual'),rules:{...baseline.rules,fungus,prey},source,conditioned};
  }));
function found(setup) {
  const animals = [0,1].map(id=>({id,kind:'prey',region:'test',bornAt:0,
    body:{matter:2,chemicalEnergy:11,storedEnergy:11}}));
  const state = foundFoodChain(world,[setup.source],setup.rules,{
    inventory:new Map([[0,{detritus:initial.detritus,mineralMatter:initial.mineral,water:initial.water}]]),
    fungus:new Map([[0,initial.fungus]]),animals});
  // Close the historical source at the experimental cutover. The distinct new source starts at zero.
  const anchored = {...state,chemical:{...state.chemical,tick:start,heat:new Map([[0,initial.heat]])},
    animals:new Map(animals.map(animal=>[animal.id,{...animal,bornAt:start}]))};
  validateFoodState(world,[setup.source],setup.rules,anchored);
  return anchored;
}
const deliveryHours = Array.from({length:end-start},(_,i)=>start+1+i).filter(hour=>(hour-1)%6===0);
assert.deepEqual([deliveryHours.length,deliveryHours[0],deliveryHours.at(-1)],[pulses,337,811]);
assert.equal(birth.interval%12,0);
assert.equal(birth.reserve,12-1);
assert(birth.reserve<=birth.energy && birth.reserve<=12*birth.matter);
const preflight = setups.map(setup=>{
  const state=found(setup), total=foodBalances(world,state).get(0);
  assert.equal(total.matter,BigInt(initial.fungus.matter+initial.detritus.matter+initial.mineral+4));
  assert.equal(total.chemicalEnergy,BigInt(initial.fungus.chemicalEnergy+initial.detritus.chemicalEnergy+22));
  assert.equal(total.water,BigInt(initial.water));
  assert.equal(chemicalDelivery(world,setup.source,state.chemical,'preflight')?.lots,setup.source.rate);
  const checkpoint=saveFoodChain(world,[setup.source],setup.rules,state);
  assert.deepEqual(saveFoodChain(world,[setup.source],setup.rules,restoreFoodChain(world,[setup.source],setup.rules,checkpoint)),checkpoint);
  return {id:setup.id,epoch:checkpoint.chemical.epoch,tick:start,openingMatter:Number(total.matter),
    openingEnergy:Number(total.chemicalEnergy),openingWater:Number(total.water),
    openerPreyMatter:4,openerPreyEnergy:22,openerPreyReserve:22,newSourceMeter:0,
    newMatterBudget:setup.source.quotaLots,newEnergyBudget:setup.source.quotaLots*setup.source.perLot.detritus.chemicalEnergy};
});
const protocol = {base:'306097f1fef0f4c3eb76c10a4819bc4a28e6ba81',referenceDigest:chemicalDigest(reference),
  start,end,pulses,deliveryHours,initial,historicalSource:reference.source,world:reference.world,setups,preflight};
if (destination==='--preflight') {
  console.log(JSON.stringify(protocol,null,2));
  process.exit(0);
}

function inventory(state) {
  const stock = state.chemical.inventory.get(0)??empty;
  return {fungus:state.fungus.get(0)??zeroBody,detritus:stock.detritus,mineral:stock.mineralMatter,water:stock.water,
    auxiliaryDetritus:state.chemical.inventory.get(1)?.detritus??empty.detritus,
    heat:state.chemical.heat.get(0)??0,lots:state.chemical.lotsUsed.get('detrital-pulse-e2b2')??0,
    animals:[...state.animals.values()].sort((a,b)=>a.id-b.id)};
}
const replayHours = new Set([337,348,384,408,456,480,576,696,816]);
const fields = ['importM','importE','convertedM','fungalGrowthM','fungalLossM','fungalAssimE','fungalDemandE','fungalPaidE',
  'grazedM','grazedE','preyGrowthM','preyAssimE','preyDemandE','preyPaidE','births','birthHeatE','deaths',
  'mineralsM','heatE','localOutM','localOutE'];
function summarize(rows,from,to) {
  const opening=rows[from-start-1].inventory, closing=rows[to-start].inventory;
  const sample=rows.slice(from-start,to-start+1);
  return {from,to,opening,closing,peakPreyM:Math.max(...sample.map(row=>row.preyMatter)),
    ...Object.fromEntries(fields.map(key=>[key,sample.reduce((sum,row)=>sum+row[key],0)]))};
}
function account(entry,side,kind) {
  return entry?.[side].find(a=>a.kind===kind)?.stock;
}

// For the fixed one-M birth use an independent bounded payment check for the diagnostic.
function fundable(first,second,cap,floor) {
  const cost=birth.energy+birth.heat;
  if (!first.storedEnergy||!second.storedEnergy) return false;
  for(let fromA=0;fromA<=birth.matter;fromA++){
    const leftA=first.matter-fromA, leftB=second.matter-(birth.matter-fromA);
    if(leftA<1||leftB<1) continue;
    for(let payA=0;payA<=cost;payA++){
      const reserveA=first.storedEnergy-payA, reserveB=second.storedEnergy-(cost-payA);
      if(reserveA>=floor&&reserveB>=floor&&reserveA<=leftA*cap&&reserveB<=leftB*cap) return true;
    }
  }
  return false;
}
function run(setup) {
  const {source,rules,conditioned,id}=setup, sources=[source];
  let state=found(setup), extinct=null;
  const history=new Map([[0,{born:start,parents:[],children:[]}],[1,{born:start,parents:[],children:[]}]]);
  const births=[], cases=[], deaths=[], windows=[[337,456],[457,576],[577,696],[697,816]];
  const rows=[{hour:start,inventory:inventory(state)}];
  for(let hour=start+1;hour<=end;hour++){
    const before=rows.at(-1).inventory;
    const adults=before.animals.filter(animal=>hour-animal.bornAt>=birth.adultAge);
    const pairs=[];
    if(hour%birth.interval===0){
      for(let i=0;i+1<adults.length;i+=2) pairs.push([adults[i].id,adults[i+1].id]);
    }
    const passive=planChemicalTransport(world,state.chemical);
    const delivery=chemicalDelivery(world,source,state.chemical,'entry-'+hour);
    const input={chemical:[...passive,...(delivery?[delivery]:[])],pairs};
    const report=stepFoodChain(world,sources,rules,state,input);
    const ledger=foodLedgerDigest(report);
    if(replayHours.has(hour)){
      const saved=saveFoodChain(world,sources,rules,state);
      const replay=stepFoodChain(world,sources,rules,restoreFoodChain(world,sources,rules,JSON.parse(JSON.stringify(saved))),input);
      assert.equal(foodLedgerDigest(replay),ledger);
      assert.deepEqual(replay.audit,report.audit);
      assert.deepEqual(saveFoodChain(world,sources,rules,replay.state),saveFoodChain(world,sources,rules,report.state));
    }
    const {opening,closing,imported,exported,dissipated}=report.audit;
    for(const key of ['matter','chemicalEnergy','water']){
      assert.equal(opening[key]+imported[key],closing[key]+exported[key]+(key==='chemicalEnergy'?dissipated:0n),id+':'+hour+':'+key);
    }
    assert.equal(imported.matter,(hour-1)%6===0?BigInt(source.rate):0n);
    assert.equal(imported.chemicalEnergy,imported.matter*BigInt(source.perLot.detritus.chemicalEnergy));
    state=report.state;
    const after=inventory(state);
    const growth=report.entries.find(entry=>entry.phase==='grow');
    const preGraze=account(growth,'credits','fungus')??before.fungus;
    const grazes=report.entries.filter(entry=>entry.phase==='graze').map(entry=>{
      const fungusBefore=account(entry,'debits','fungus'), fungusAfter=account(entry,'credits','fungus')??zeroBody;
      const individualBefore=account(entry,'debits','animal'), individualAfter=account(entry,'credits','animal');
      return {id:individualBefore.id,matter:fungusBefore.matter-fungusAfter.matter,
        chemicalEnergy:fungusBefore.chemicalEnergy-fungusAfter.chemicalEnergy,
        retainedMatter:individualAfter.body.matter-individualBefore.body.matter,
        assimilated:individualAfter.body.storedEnergy-individualBefore.body.storedEnergy, fungusAfter};
    });
    const postGraze=grazes.at(-1)?.fungusAfter??preGraze;
    const fungalMaintenance=report.entries.find(entry=>['maintain','regress','die'].includes(entry.phase)&&account(entry,'debits','fungus'));
    const animalMaintenance=report.entries.filter(entry=>['maintain','die'].includes(entry.phase)&&account(entry,'debits','animal'));
    const maintained=new Map(animalMaintenance.filter(entry=>entry.phase==='maintain').map(entry=>{
      const animal=account(entry,'credits','animal');
      const past=history.get(animal.id);
      if(hour-animal.bornAt>=birth.adultAge) past.matured??=hour;
      const bite=grazes.find(graze=>graze.id===animal.id);
      if(bite?.matter) past.firstPaidMeal??=hour;
      return [animal.id,animal.body];
    }));
    const casualties=[];
    for(const entry of animalMaintenance.filter(entry=>entry.phase==='die')){
      const animal=account(entry,'debits','animal'), past=history.get(animal.id);
      past.died=hour;
      const bite=grazes.find(graze=>graze.id===animal.id);
      const reason=hour%12===0?(bite?'reserva-insuficiente-tras-ingesta':preGraze.matter?'sin-porcion':'sin-micelio')
        :'reserva-agotada-entre-ingestas';
      const death={id:animal.id,hour,reason,body:animal.body,bite:bite??null,
        detritusBefore:(account(entry,'debits','stock')??empty).detritus,detritusAfter:account(entry,'credits','stock').detritus};
      casualties.push(death);
      deaths.push(death);
    }
    const offspring=[];
    for(const entry of report.entries.filter(entry=>entry.phase==='birth')){
      const parents=entry.debits.filter(account=>account.stock).map(account=>account.id);
      const baby=entry.credits.find(account=>!parents.includes(account.id)).stock;
      const afterParents=entry.credits.filter(account=>parents.includes(account.id)).map(account=>account.stock.body);
      if(conditioned) assert(afterParents.every(body=>body.storedEnergy>=11));
      const event={hour,id:baby.id,parents,body:baby.body,beforeParents:parents.map(id=>maintained.get(id)),afterParents};
      for(const parent of parents) history.get(parent).children.push(baby.id);
      history.set(baby.id,{born:hour,parents,children:[]});
      offspring.push(event);
      births.push(event);
    }
    const occupancy=after.animals.reduce((sum,animal)=>sum+animal.body.matter,0);
    for(const pair of pairs){
      const [a,b]=pair.map(id=>maintained.get(id));
      const result=offspring.find(event=>event.parents.includes(pair[0])&&event.parents.includes(pair[1]));
      const physicallyEligible=Boolean(a&&b&&after.water&&after.fungus.chemicalEnergy&&
        habitats[0].capacity-occupancy>=birth.matter&&fundable(a,b,rules.prey.reservePerMatter,0));
      const funded=physicallyEligible&&fundable(a,b,rules.prey.reservePerMatter,11);
      assert.equal(Boolean(result),conditioned?funded:physicallyEligible);
      cases.push({hour,pair,physicallyEligible,funded,parents:[a??null,b??null],birth:result?.id??null});
    }
    if(!after.animals.length && before.animals.length && extinct===null) extinct=hour;
    const conversionBefore=account(growth,'debits','stock')?.detritus;
    const conversionAfter=account(growth,'credits','stock')?.detritus;
    const activeOut=passive.filter(posting=>posting.fromHabitat===0).reduce((total,{cargo})=>[
      total[0]+cargo.detritus.matter+cargo.mineralMatter,total[1]+cargo.detritus.chemicalEnergy], [0,0]);
    rows.push({hour,phase:hour%6,inventory:after,preGraze,postGraze,grazes,occupancy:occupancy/habitats[0].capacity,
      preyMatter:occupancy,importM:Number(imported.matter),importE:Number(imported.chemicalEnergy),
      convertedM:growth?conversionBefore.matter-conversionAfter.matter:0,
      fungalGrowthM:preGraze.matter-before.fungus.matter,fungalLossM:postGraze.matter-after.fungus.matter,
      fungalAssimE:preGraze.storedEnergy-before.fungus.storedEnergy,
      fungalDemandE:postGraze.matter, fungalPaidE:fungalMaintenance?.heat.energy??0,
      grazedM:preGraze.matter-postGraze.matter,grazedE:preGraze.chemicalEnergy-postGraze.chemicalEnergy,
      preyGrowthM:grazes.reduce((total,g)=>total+g.retainedMatter,0),preyAssimE:grazes.reduce((total,g)=>total+g.assimilated,0),
      preyDemandE:animalMaintenance.length,preyPaidE:animalMaintenance.reduce((total,e)=>total+e.heat.energy,0),
      births:offspring.length,birthHeatE:offspring.length*birth.heat,deaths:casualties.length,
      mineralsM:growth?account(growth,'credits','stock').mineralMatter-account(growth,'debits','stock').mineralMatter:0,
      heatE:Number(dissipated),localOutM:activeOut[0],localOutE:activeOut[1],
      conversion:{before:conversionBefore??null,after:conversionAfter??null},offspring,casualties,ledger});
  }
  assert.equal(rows.at(-1).inventory.lots,source.quotaLots);
  const replacement = births.filter(event=>event.parents.some(parent=>{
    const h=history.get(parent);
    return h.parents.length>0 && h.matured<=event.hour;
  }) && history.get(event.id).firstPaidMeal===event.hour+12);
  return {id,conditioned,extinct,history:[...history],births,deaths,cases,replacement,rows,
    windows:windows.map(([a,b])=>summarize(rows,a,b)), total:summarize(rows,start+1,end)};
}
const results = setups.map(run);
const output=resolve(destination);
mkdirSync(output,{recursive:true});
writeFileSync(resolve(output,'results.json'),JSON.stringify({...protocol,results},null,2)+'\n');
const columns=['id','extinct','endPrey','endFungus','matureDescendants','firstMealOfOffspring','replacement',
  'blockedBirths','peakPreyM',...fields];
const csv=[columns,...results.map(r=>[r.id,r.extinct,r.total.closing.animals.length,r.total.closing.fungus.matter,
  r.history.filter(([,h])=>h.parents.length&&h.matured).length,r.history.filter(([,h])=>h.parents.length&&h.firstPaidMeal).length,
  r.replacement.length,r.conditioned?r.cases.filter(c=>c.physicallyEligible&&!c.funded).length:0,r.total.peakPreyM,
  ...fields.map(key=>r.total[key])])].map(row=>row.join(',')).join('\n')+'\n';
writeFileSync(resolve(output,'summary.csv'),csv);
console.log(csv);
