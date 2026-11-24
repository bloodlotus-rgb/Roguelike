import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {indexWorld} from '../src/ecology/dispersal-world.ts';
import {foundFoodChain, preyMaintenance} from '../src/ecology/chemical-food-contract.ts';
import {foodLedgerDigest, stepFoodChain} from '../src/ecology/chemical-food-chain.ts';
import {restoreFoodChain, saveFoodChain} from '../src/ecology/chemical-food-snapshot.ts';

const base = 'a181807efe0852b9897543c4ab934d0c3d3b9ef3';
const destination = process.argv[2];
assert(destination, 'Usage: node scripts/e2b3-fisiologia.mjs OUTPUT_DIRECTORY|--preflight');
const horizon = 12;
const capacity = 64;
const habitat = {zone:0,depthM:0,areaM2:36,capacity,humidity:0,morphology:[]};
const world = indexWorld({seed:'e2b3-galeria',signature:'e2b3-galeria-64',entrance:0,habitats:[habitat],
  regionToHabitat:new Map([['galeria',0]]),boundaries:[],incident:[[]],barriers:[]}, new Map(), new Map([['galeria',capacity]]));
const stock = {detritus:{matter:0,chemicalEnergy:0},mineralMatter:0,water:1};
const fungus = {matter:30,chemicalEnergy:600,storedEnergy:450};
const rareFungus = {matter:30,chemicalEnergy:150,storedEnergy:150};
const feed = {interval:3,biteMatter:2,retainedMatterPermille:500,reservePermille:1000,residueEnergyPermille:0};
const animal = {maintenance:1,reservePerMatter:4,feeding:feed,
  movement:{modes:['crawl'],width:1,height:1,cost:0},birth:{interval:3,adultAge:3,matter:1,energy:2,reserve:2,heat:1}};
const common = {fungus:{maintenance:1,reservePerMatter:20,feeding:feed},prey:animal,predator:animal};
const integrated = {satiation:true,adultMatter:4,maintenanceMatterStep:2};
const setups = [
  {id:'control', founders:[[4,6],[2,2]]},
  {id:'saciedad', founders:[[4,6],[2,2]], physiology:{satiation:true}},
  {id:'masa-adulta', founders:[[4,6],[2,2]], physiology:{adultMatter:4}},
  {id:'mantenimiento', founders:[[4,6],[2,2]], physiology:{maintenanceMatterStep:2}},
  {id:'integrada', founders:[[4,10],[4,10]], physiology:integrated,pair:true},
  {id:'escasez', founders:[[4,10],[4,10]], physiology:integrated,pair:true,scarce:true},
].map(setup=>({...setup, fungus:setup.scarce?rareFungus:fungus,
  rules:{...common,prey:{...common.prey,physiology:setup.physiology,reproduction:setup.pair?'maintenance-budget':undefined}}}));

function opening(setup) {
  return foundFoodChain(world,[],setup.rules,{inventory:new Map([[0,stock]]),fungus:new Map([[0,setup.fungus]]),
    animals:setup.founders.map(([matter,reserve],id)=>({id,kind:'prey',region:'galeria',bornAt:0,
      body:{matter,chemicalEnergy:reserve,storedEnergy:reserve}}))});
}
const protocol = {base,horizon,habitat,stock,setups,phaseOrder:['grow','graze','maintain','birth']};
if (destination==='--preflight') {
  for (const setup of setups) {
    const state=opening(setup), saved=saveFoodChain(world,[],setup.rules,state);
    assert.deepEqual(saveFoodChain(world,[],setup.rules,restoreFoodChain(world,[],setup.rules,saved)),saved);
  }
  console.log(JSON.stringify(protocol,null,2));
  process.exit(0);
}

const bodyOf=(entry,side,id)=>entry?.[side].find(a=>a.kind==='animal'&&a.id===id)?.stock?.body;
const ordered=state=>[...state.animals.values()].sort((a,b)=>a.id-b.id);
function run(setup) {
  const {rules}=setup;
  let state=opening(setup), nextBirthEnergy=new Map(setup.founders.map(([,e],id)=>[id,e]));
  const rows=[{hour:0,fungus:setup.fungus,animals:ordered(state)}];
  for(let hour=1;hour<=horizon;hour++){
    const before=ordered(state);
    const input={chemical:[],pairs:setup.pair && hour%rules.prey.birth.interval===0?[[0,1]]:[]};
    const report=stepFoodChain(world,[],rules,state,input);
    if ([3,6,9,12].includes(hour)){
      const saved=saveFoodChain(world,[],rules,state);
      const replay=stepFoodChain(world,[],rules,restoreFoodChain(world,[],rules,JSON.parse(JSON.stringify(saved))),input);
      assert.equal(foodLedgerDigest(report),foodLedgerDigest(replay));
      assert.deepEqual(report.audit,replay.audit);
      assert.deepEqual(saveFoodChain(world,[],rules,replay.state),saveFoodChain(world,[],rules,report.state));
    }
    const {opening,closing,dissipated}=report.audit;
    assert.equal(opening.matter,closing.matter);
    assert.equal(opening.water,closing.water);
    assert.equal(opening.chemicalEnergy,closing.chemicalEnergy+dissipated);
    state=report.state;
    const assessments=report.feedingDecisions??[];
    const animals=before.map(animal=>{
      const id=animal.id, assessment=assessments.find(x=>x.animal===id);
      const bite=report.entries.find(e=>e.phase==='graze'&&bodyOf(e,'debits',id));
      const care=report.entries.find(e=>['maintain','die'].includes(e.phase)&&bodyOf(e,'debits',id));
      const afterMeal=bodyOf(bite,'credits',id)??animal.body;
      const afterCare=bodyOf(care,'credits',id);
      const paid=care?.heat.energy??0;
      const grazed=bite?bite.debits[0].stock.matter-(bite.credits[0].stock?.matter??0):0;
      const mealEnergy=bite?bite.debits[0].stock.chemicalEnergy-(bite.credits[0].stock?.chemicalEnergy??0):0;
      return {id,age:hour-animal.bornAt,mature:hour-animal.bornAt>=rules.prey.birth.adultAge,
        before:animal.body,assessment:assessment??null,grazed,mealEnergy,
        assimilated:afterMeal.storedEnergy-animal.body.storedEnergy,
        addedMatter:afterMeal.matter-animal.body.matter,afterMeal,afterCare:afterCare??null,paid,
        required:Number(preyMaintenance(rules.prey,afterMeal.matter)),death:care?.phase==='die',
        closing:state.animals.get(id)?.body??null,
        mineralResidue:bite?bite.credits[2].stock.mineralMatter-(bite.debits[2].stock?.mineralMatter??0):0,
        mealHeat:bite?.heat.energy??0};
    });
    for(const item of animals){
      // Spend ingested energy first in this attribution bound, so initial energy left is an upper bound.
      const sourceUpper=nextBirthEnergy.get(item.id)??0;
      nextBirthEnergy.set(item.id,Math.min(sourceUpper,item.afterCare?.storedEnergy??0));
    }
    const birth=report.entries.find(e=>e.phase==='birth');
    const parents=birth?.debits.filter(a=>a.stock).map(a=>a.id)??[];
    let newborn=null;
    if(birth){
      const child=birth.credits.find(a=>!parents.includes(a.id)).stock;
      const payments=parents.map(id=>{
        const opening=bodyOf(birth,'debits',id), closing=bodyOf(birth,'credits',id);
        const cost=opening.storedEnergy-closing.storedEnergy;
        const initialUpper=nextBirthEnergy.get(id)??0;
        nextBirthEnergy.set(id,Math.min(initialUpper,closing.storedEnergy));
        return {id,cost,initialEnergyUpperBound:Math.min(cost,initialUpper),
          retainedReserve:closing.storedEnergy,retainedMatter:closing.matter,
          requiredUntilNextMeal:Number(preyMaintenance(rules.prey,closing.matter))*2};
      });
      newborn={id:child.id,parents,body:child.body,payments,heat:birth.heat.energy};
      nextBirthEnergy.set(child.id,payments.reduce((sum,p)=>sum+p.initialEnergyUpperBound,0));
    }
    const paired=animals.filter(a=>a.id===0||a.id===1);
    const omitted=input.pairs.length&&!newborn?
      paired.length<2||paired.some(a=>a.death)?'uno o ambos progenitores ausentes':
        !state.fungus.get(0)?.chemicalEnergy?'sin alimento energético local':
        'sin reparto que pague la cría y deje la reserva exigida a ambos':null;
    const mineral=state.chemical.inventory.get(0).mineralMatter;
    rows.push({hour,fungus:state.fungus.get(0)??null,animals,newborn,omitted,minerals:mineral,heat:Number(dissipated),
      ledger:foodLedgerDigest(report),postings:report.entries.length});
  }
  return {id:setup.id,rows,summary:{
    assessed:rows.slice(1).flatMap(r=>r.animals).filter(a=>a.assessment).length,
    candidates:rows.slice(1).flatMap(r=>r.animals).reduce((total,a)=>total+(a.assessment?.evaluated??0),0),
    postings:rows.slice(1).reduce((total,r)=>total+r.postings,0),
    meals:rows.slice(1).flatMap(r=>r.animals).filter(a=>a.grazed).length,
    births:rows.slice(1).filter(r=>r.newborn).length,deaths:rows.slice(1).flatMap(r=>r.animals).filter(a=>a.death).length,
  }};
}
const results=setups.map(run);
const output=resolve(destination);
mkdirSync(output,{recursive:true});
writeFileSync(resolve(output,'results.json'),JSON.stringify({...protocol,results},null,2)+'\n');
const fmt=body=>body?body.matter+' M, '+body.chemicalEnergy+' E químicas, '+body.storedEnergy+' E de reserva':'sin cuerpo vivo';
const lines=['# Galería de prueba · Traza cronológica','',
  'Las señales de hambre indican necesidad de alimento local. El registro no representa desplazamientos.'];
for(const result of results){
  lines.push('','## '+result.id,'');
  for(const row of result.rows){
    lines.push('### h'+row.hour,'','Micelio al cierre. '+fmt(row.fungus)+'.');
    for(const item of row.animals){
      if(row.hour===0){lines.push('- Presa '+item.id+' al fundar. '+fmt(item.body)+'.');continue;}
      const a=item.assessment;
      const reason=a?{
        'sated':'saciada para el próximo intervalo', 'no-food':'hambrienta, sin micelio disponible',
        'no-improvement':'hambrienta, sin bocado que mejore el déficit',
        'budget-covered':'come lo mínimo que cubre el déficit','partial-budget':'come un bocado que reduce el déficit',
      }[a.reason]:item.grazed?'come en su turno de pastoreo':'sin ingesta';
      const food=item.grazed?' Toma '+item.grazed+' M/'+item.mealEnergy+' E, asimila '+item.assimilated+' E y gana '+item.addedMatter+' M.':'';
      const decision=a?' Déficit '+a.deficit+' → '+a.remainingDeficit+' E.':'';
      lines.push('- Presa '+item.id+' ('+(item.mature?'madura':'juvenil')+'). '+reason+'.'+food+decision+
        ' Paga '+item.paid+'/'+item.required+' E de mantenimiento. '+(item.death?'Muere por falta de reserva.':'Cierre. '+fmt(item.closing)+'.'));
    }
    if(row.newborn) lines.push('- Nace la presa '+row.newborn.id+' de '+row.newborn.parents.join(' y ')+'. '+fmt(row.newborn.body)+
      '. Aporte fundador máximo al pago: '+row.newborn.payments.reduce((sum,p)=>sum+p.initialEnergyUpperBound,0)+' E.');
    if(row.omitted) lines.push('- La pareja no cría. Motivo registrado: '+row.omitted+'.');
    lines.push('');
  }
}
writeFileSync(resolve(output,'traza.md'),lines.join('\n')+'\n');
console.log(JSON.stringify(results.map(({id,summary})=>({id,...summary})),null,2));
