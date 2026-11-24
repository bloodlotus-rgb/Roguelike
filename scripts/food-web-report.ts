import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildDispersalWorld } from '../src/ecology/dispersal-world.ts';
import { auditWeb, foundWeb, groups, inventory, projectWeb, restoreWeb, saveWeb, stepWeb, type Founder } from '../src/ecology/food-web.ts';
import { enclosure } from './dispersal-trials.ts';

const [hours='8760',scenario='open',...seeds]=process.argv.slice(2);
const ticks=Number(hours);
const cases=['open','scarce','sealed','reopen','isolated','one-hunter','whole','recovery','dense'];
if (!Number.isSafeInteger(ticks) || ticks<1 || (scenario!=='matrix' && !cases.includes(scenario))) throw new Error('Expected hours, scenario and seeds');
for (const seed of seeds.length ? seeds : ['mansion']) {
  const building=buildDispersalWorld(seed);
  const trial=enclosure(building);
  for (const name of scenario==='matrix' ? cases : [scenario]) run(seed,building,trial,name);
}
function run(seed:string,building:ReturnType<typeof buildDispersalWorld>,trial:ReturnType<typeof enclosure>,scenario:string) {
  let world=scenario==='whole' ? building : trial.open;
  const setup=structuredClone(trial.setup);
  if (scenario==='scarce') setup.source=null;
  const founders:Founder[]=groups.map(group=>({group,count:group==='prey' ? (scenario==='dense' ? 10 : 6) : (scenario==='one-hunter' ? 1 : 2),region:trial.source,connector:trial.bridge,origin:'historical lateral entry'}));
  const initial=foundWeb(world,setup,founders);
  auditWeb(world,null,initial.state,initial.ledger);
  let state=initial.state;
  const events:Record<string,number>={}, windows=[], durations:number[]=[];
  const targetHistory: {tick:number;group:string;present:boolean}[]=[];
  const start=performance.now(), cpu=process.cpuUsage();
  let removed=0;
  const extinctAt: Record<string,number>={};
  const targetId=world.graph.regionToHabitat.get(trial.target)!;
  const sample: number[]=[];

  for (let tick=1;tick<=ticks;tick++) {
    if ((scenario==='isolated' && tick===1) || ((scenario==='sealed' || scenario==='reopen') && tick===33) || (scenario==='reopen' && tick===97)) {
      const next=tick===97 ? trial.open : trial.closed;
      state=projectWeb(world,next,state);
      world=next;
    }
    // A one-off local mortality pulse is an experimental intervention. Return the entire census as carrion.
    if (scenario==='recovery' && tick===30) {
      const residents=new Map(state.residents);
      const tissue=residents.get(trial.target);
      if (tissue) {
        residents.delete(trial.target);
        const stocks=new Map(state.base.stocks), local={...stocks.get(targetId)!};
        const losses=groups.flatMap(group=>{
          const amount=tissue[group];
          if (!amount) return [];
          local.detritus+=amount;
          removed+=amount;
          targetHistory.push({tick,group,present:false});
          return [{kind:'conversion' as const,process:'local-mortality-pulse',from:targetId,to:null,amount,resource:group},
            {kind:'conversion' as const,process:'local-mortality-pulse',from:null,to:targetId,amount,resource:'detritus' as const}];
        });
        stocks.set(targetId,local);
        const changed={...state,residents,base:{...state.base,stocks}};
        auditWeb(world,state,changed,losses);
        state=changed;
      }
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
    for (const g of groups) if (extinctAt[g]===undefined && ![...next.state.residents.values()].some(t=>t[g])) extinctAt[g]=tick;
    state=next.state;
    if (tick<=240) sample.push(state.residents.size);
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
    removed,extinctAt,peakActiveRegionsFirst240:Math.max(...sample),cpuMs:Object.values(process.cpuUsage(cpu)).reduce((a,b)=>a+b,0)/1000,elapsedMs:performance.now()-start,p95TickMs:durations[Math.ceil(ticks*.95)-1],peakRssMiB:process.resourceUsage().maxRSS/1024}));
}
