import assert from 'node:assert/strict';
import {buildDispersalWorld} from '../src/ecology/dispersal-world.ts';
import {auditWeb,diets,foundWeb,groups,inventory,stepWeb,restoreWeb,saveWeb} from '../src/ecology/food-web.ts';
import {enclosure} from './dispersal-trials.ts';

// Matched controls: same building, inoculum, source, timetable and metabolism for each menu.
const args=process.argv.slice(2);
const sustained=args[0]==='--decade';
if (sustained) args.shift();
const ticks=sustained ? 87600 : 8760;
for (const seed of args) {
  const building=buildDispersalWorld(seed),trial=enclosure(building);
  for (const world of sustained ? [building] : [trial.open,building]) for (const diet of sustained ? ['generalist-predator'] as const : diets) {
    const founders=groups.map(group=>({region:trial.source,connector:trial.bridge,origin:'historical lateral entry',group,count:group==='prey'?6:2}));
    const setup=structuredClone(trial.setup);
    if (sustained) setup.source!.quota*=10;
    const initial=foundWeb(world,setup,founders,[],diet);
    auditWeb(world,null,initial.state,initial.ledger);
    let state=initial.state;
    const intake:Record<string,number>={}, extinctAt:Record<string,number>={};
    const years=[];
    let births={prey:0,predator:0};
    for (let hour=1;hour<=ticks;hour++) {
      const next=stepWeb(world,state);
      auditWeb(world,state,next.state,next.ledger);
      for (const e of next.ledger) if (e.kind==='conversion' && e.from!==null && groups.some(g=>e.process===g+'-feeding' || e.process===g+'-birth')) {
        for (const g of groups) if (e.process===g+'-birth') births[g]+=e.amount;
        const key=e.process+'/'+e.resource;
        intake[key]=(intake[key] ?? 0)+e.amount;
      }
      for (const group of groups) if (!extinctAt[group] && ![...next.state.residents.values()].some(t=>t[group])) extinctAt[group]=hour;
      state=next.state;
      if (hour%8760===0) {
        years.push({hour,births, ...Object.fromEntries(groups.map(g=>[g,[...state.residents.values()].reduce((n,t)=>n+t[g],0)]))});
        births={prey:0,predator:0};
        const restored=restoreWeb(world,JSON.parse(JSON.stringify(saveWeb(world,state))));
        assert.deepEqual(stepWeb(world,state),stepWeb(world,restored));
        state=restored;
      }
    }
    const stocks=[...inventory(world,state).values()];
    const final=Object.fromEntries((['fungalBiomass','detritivores',...groups] as const).map(g=>[g,stocks.reduce((n,s)=>n+s[g],0)]));
    console.log(JSON.stringify({seed,years,enclosure:world===trial.open,diet,ticks:state.base.tick,final,extinctAt,intake,lots:state.base.lotsUsed}));
  }
}
