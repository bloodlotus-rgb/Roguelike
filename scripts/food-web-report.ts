import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildDispersalWorld } from '../src/ecology/dispersal-world.ts';
import { auditWeb, foundWeb, groups, inventory, projectWeb, restoreWeb, saveWeb, stepWeb, type Founder } from '../src/ecology/food-web.ts';
import { enclosure } from './dispersal-trials.ts';

const [hours='8760',scenario='open',...seeds]=process.argv.slice(2);
const ticks=Number(hours);
if (!Number.isSafeInteger(ticks) || ticks<1 || !['open','scarce','sealed','reopen'].includes(scenario)) throw new Error('Expected hours, scenario and seeds');
for (const seed of seeds.length ? seeds : ['mansion']) {
  const trial=enclosure(buildDispersalWorld(seed));
  let world=trial.open;
  const setup=structuredClone(trial.setup);
  if (scenario==='scarce') setup.source=null;
  const founders:Founder[]=groups.map(group=>({group,count:group==='prey' ? 6 : 2,region:trial.source,connector:trial.bridge,origin:'historical lateral entry'}));
  const initial=foundWeb(world,setup,founders);
  auditWeb(world,null,initial.state,initial.ledger);
  let state=initial.state;
  const events:Record<string,number>={}, windows=[], durations:number[]=[];
  const targetHistory: {tick:number;group:string;present:boolean}[]=[];
  const start=performance.now();
  for (let tick=1;tick<=ticks;tick++) {
    if (((scenario==='sealed' || scenario==='reopen') && tick===33) || (scenario==='reopen' && tick===97)) {
      const next=tick===33 ? trial.closed : trial.open;
      state=projectWeb(world,next,state);
      world=next;
    }
    const clock=performance.now();
    const next=stepWeb(world,state);
    durations.push(performance.now()-clock);
    auditWeb(world,state,next.state,next.ledger);
    for (const entry of next.ledger) if (groups.some(g=>entry.process.startsWith(g+'-')) && entry.from!==null && entry.resource!=='energy') {
      events[entry.process]=(events[entry.process] ?? 0)+entry.amount;
    }
    for (const g of groups) if (!!state.residents.get(trial.target)?.[g] !== !!next.state.residents.get(trial.target)?.[g]) {
      if (targetHistory.length<64) targetHistory.push({tick,group:g,present:!!next.state.residents.get(trial.target)?.[g]});
    }
    state=next.state;
    if (tick===Math.ceil(ticks/2) || tick===32 || tick===96) {
      const rebuilt=restoreWeb(world,JSON.parse(JSON.stringify(saveWeb(world,state))));
      assert.deepEqual(stepWeb(world,rebuilt),stepWeb(world,state));
      state=rebuilt;
    }
    if ([48,8760,ticks].includes(tick)) {
      const stocks=[...inventory(world,state).values()];
      windows.push({tick,groups:Object.fromEntries([...groups,'fungalBiomass','detritivores'].map(g=>[g,stocks.reduce((n,s)=>n+s[g as keyof typeof s],0)])),lots:state.base.lotsUsed});
    }
  }
  durations.sort((a,b)=>a-b);
  console.log(JSON.stringify({seed,scenario,ticks,bridge:trial.bridge,founders,windows,events,targetHistory,
    elapsedMs:performance.now()-start,p95TickMs:durations[Math.ceil(ticks*.95)-1],peakRssMiB:process.resourceUsage().maxRSS/1024}));
}
