import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {buildDispersalWorld} from '../src/ecology/dispersal-world.ts';
import {auditWeb,foundWeb,groups,pass,restoreWeb,saveWeb,stepWeb,type Founder} from '../src/ecology/food-web.ts';
import {type Deposit} from '../src/ecology/metapopulation.ts';
import {colonyHome} from '../src/ecology/trophic-contract.ts';
import {surveyReserve} from './dispersal-trials.ts';
import {viabilityTrial} from './viability-trials.ts';

const [seed='mansion',size='100',hours='96',movement='dispersal',diet='specialists']=process.argv.slice(2);
if (movement!=='dispersal' && movement!=='local-foraging') throw new Error('Expected movement policy');
if (diet!=='specialists' && diet!=='generalist-predator') throw new Error('Expected a benchmark diet');
const count=Number(size), ticks=Number(hours);
if (![count,ticks].every(n=>Number.isSafeInteger(n) && n>0)) throw new Error('Expected positive census size and hours');
const start=performance.now(),world=buildDispersalWorld(seed),buildMs=performance.now()-start;
const {graph}=world, setup=viabilityTrial(graph,'closed');
const queue=[graph.entrance],seen=new Set(queue),deposits:Deposit[]=[],founders:Founder[]=[];
const home=colonyHome(graph,setup);
for (const id of queue) {
  for (const index of graph.incident[id]) {
    const cut=graph.boundaries[index], to=cut.from===id ? cut.to : cut.from;
    if (seen.has(to) || !groups.every(group=>pass(world,cut,id,group))) continue;
    queue.push(to);
    seen.add(to);
    if (to===home) continue;
    const region=world.ports.get(cut.id)![cut.from===id ? 1 : 0];
    deposits.push({region,connector:cut.id,origin:'surface-survey',stock:surveyReserve(world,to)});
    for (const group of groups) founders.push({region,connector:cut.id,origin:'surface-survey',group,count:2});
    if (deposits.length===count) break;
  }
  if (deposits.length===count) break;
}
assert.equal(deposits.length,count);
const initial=foundWeb(world,setup,founders,deposits,diet,movement);
auditWeb(world,null,initial.state,initial.ledger);
let state=initial.state, active=0;
const step:number[]=[],audit:number[]=[];
for (let i=0;i<ticks;i++) {
  const t=performance.now(),next=stepWeb(world,state),a=performance.now();
  auditWeb(world,state,next.state,next.ledger);
  step.push(a-t);
  audit.push(performance.now()-a);
  state=next.state;
  active+=state.residents.size;
}
assert.deepEqual(stepWeb(world,restoreWeb(world,JSON.parse(JSON.stringify(saveWeb(world,state))))),stepWeb(world,state));
function stats(times:number[]) {
  times.sort((a,b)=>a-b);
  return {mean:times.reduce((a,b)=>a+b,0)/times.length,p95:times[Math.ceil(times.length*.95)-1]};
}
console.log(JSON.stringify({seed,movement,diet,count,ticks,meanOccupiedRegions:active/ticks,finalOccupiedRegions:state.residents.size,
  buildMs,stepMs:stats(step),auditMs:stats(audit),peakRssMiB:process.resourceUsage().maxRSS/1024}));
