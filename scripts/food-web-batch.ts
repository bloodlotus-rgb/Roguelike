import { buildDispersalWorld } from '../src/ecology/dispersal-world.ts';
import { auditWeb, foundWeb, groups, inventory, pass, stepWeb } from '../src/ecology/food-web.ts';
import { inlet } from '../src/ecology/trophic-contract.ts';
import { viabilityTrial } from './viability-trials.ts';

const seed=process.argv[2];
if (!seed) throw new Error('Expected one building seed');
const world=buildDispersalWorld(seed);
const setup=viabilityTrial(world.graph,'control');
const stream=inlet(world.graph,setup);
const region=world.ports.get(stream.id)![0];
const cut=world.graph.incident[stream.from].map(i=>world.graph.boundaries[i]).find(edge=>{
  const origin=edge.from===stream.from ? edge.to : edge.from;
  return world.graph.habitats[origin].depthM===world.graph.habitats[stream.from].depthM &&
    groups.every(group=>pass(world,edge,origin,group));
});
if (cut) {
  const founders=groups.map(group=>({region,connector:cut.id,origin:'historical lateral entry',group,count:group==='prey'?6:2}));
  const initial=foundWeb(world,setup,founders,[],'generalist-predator');
  auditWeb(world,null,initial.state,initial.ledger);
  let state=initial.state;
  const births={prey:0,predator:0},meals={prey:0,predator:0};
  for (let i=0;i<8760;i++) {
    const next=stepWeb(world,state);
    auditWeb(world,state,next.state,next.ledger);
    for (const e of next.ledger) if (e.kind==='conversion' && e.from!==null) for (const g of groups) {
      if (e.process===g+'-birth') births[g]+=e.amount;
      if (e.process===g+'-feeding') meals[g]+=e.amount;
    }
    state=next.state;
  }
  const stocks=[...inventory(world,state).values()];
  const remaining=Object.fromEntries((['fungalBiomass','detritivores',...groups] as const).map(g=>[g,stocks.reduce((sum,s)=>sum+s[g],0)]));
  console.log(JSON.stringify({seed,region,connector:cut.id,ticks:state.base.tick,lots:state.base.lotsUsed,births,meals,remaining}));
} else {
  console.log(JSON.stringify({seed,region,ticks:0,reason:'No compatible lateral access for founding census'}));
}
