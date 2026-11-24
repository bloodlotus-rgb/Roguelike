import {buildDispersalWorld} from '../src/ecology/dispersal-world.ts';
import {auditWeb,foundWeb,inventory,projectWeb,stepWeb} from '../src/ecology/food-web.ts';
import {enclosure} from './dispersal-trials.ts';

// Factorial comparison: identical rates and spatial graph in every run of a seed.
for (const seed of process.argv.slice(2)) {
  const {open,closed,setup,source,bridge}=enclosure(buildDispersalWorld(seed));
  for (const biomass of [4,16]) for (const prey of [2,4,6]) for (const predator of [1,2]) for (const isolate of [false,true]) {
    const initial=foundWeb(open,{...setup,founders:{...setup.founders,fungalBiomass:biomass}},[
      {region:source,connector:bridge,origin:'historical lateral entry',group:'prey',count:prey},
      {region:source,connector:bridge,origin:'historical lateral entry',group:'predator',count:predator}]);
    auditWeb(open,null,initial.state,initial.ledger);
    const world=isolate ? closed : open;
    let state=projectWeb(open,world,initial.state),preyBirths=0,predatorBirths=0,kills=0;
    const extinctAt:Record<string,number>={};
    for (let hour=1;hour<=8760;hour++) {
      const next=stepWeb(world,state);
      auditWeb(world,state,next.state,next.ledger);
      for (const e of next.ledger) if (e.kind==='conversion' && e.from!==null) {
        if (e.process==='prey-birth') preyBirths+=e.amount;
        if (e.process==='predator-birth') predatorBirths+=e.amount;
        if (e.resource==='prey' && e.process.startsWith('predator-')) kills+=e.amount;
      }
      state=next.state;
      for (const g of ['prey','predator'] as const) if (extinctAt[g]===undefined && ![...state.residents.values()].some(t=>t[g])) extinctAt[g]=hour;
    }
    const stocks=[...inventory(world,state).values()];
    const final=Object.fromEntries((['prey','predator','fungalBiomass','detritivores'] as const).map(g=>[g,stocks.reduce((n,s)=>n+s[g],0)]));
    console.log(JSON.stringify({seed,biomass,prey,predator,isolate,ticks:8760,preyBirths,predatorBirths,kills,extinctAt,final}));
  }
}
