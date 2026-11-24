import { expect,it } from 'vitest';
import { indexWorld } from './dispersal-world';
import { auditWeb,foundWeb,pass,projectWeb,restoreWeb,saveWeb,stepWeb } from './food-web';
import type { TrophicScenario } from './trophic-contract';

function trial(blocked=false) {
  const ports=new Map<string,readonly [string,string]>([['bridge',['home','near']],['stream',['home','down']]]);
  return indexWorld({seed:'test',signature:'site/'+blocked,entrance:0,barriers:[],regionToHabitat:new Map([['home',0],['near',1],['down',2]]),
    habitats:[1,1,2].map(depthM=>({zone:1,depthM,capacity:36,areaM2:36,humidity:1,morphology:[]})),
    boundaries:[{id:'bridge',from:0,to:1,kind:'opening',state:blocked?'blocked':'open'},{id:'stream',from:0,to:2,kind:'watercourse',state:'open'}],
    incident:[[0,1],[0],[1]]},ports,new Map([['home',36],['near',36],['down',36]]));
}
const setup:TrophicScenario={seed:'test',region:'home',connector:'stream',watershed:'finite basin',settlement:'upstream',
  founders:{water:40,energy:90,detritus:80,nutrients:2,detritivores:2,fungalBiomass:10},
  source:{kind:'organicSediment',rate:6,quota:50000,period:1,activeHours:1}};
const census=[{region:'home',connector:'bridge',origin:'lateral burrow',group:'prey' as const,count:4}];

it('charges founders, meals and births, respects isolation and resumes after a barrier change',()=>{
  const open=trial(),closed=trial(true), start=foundWeb(open,setup,census);
  expect(()=>foundWeb(closed,setup,census)).toThrow();
  expect(()=>foundWeb(open,setup,[{...census[0],count:40}])).toThrow();
  auditWeb(open,null,start.state,start.ledger);
  let world=closed,state=projectWeb(open,closed,start.state);
  const seen=new Set<string>();
  for (let i=1;i<=240;i++) {
    if (i===97) {
      world=open;
      state=projectWeb(closed,open,state);
    }
    const next=stepWeb(world,state);
    auditWeb(world,state,next.state,next.ledger);
    for (const e of next.ledger) seen.add(e.process);
    if (i<97) expect(next.state.residents.has('near')).toBe(false);
    if (i===90 || i===120) {
      const saved=saveWeb(world,state);
      expect(stepWeb(world,restoreWeb(world,JSON.parse(JSON.stringify(saved))))).toEqual(next);
      expect(()=>restoreWeb(world,{...saved,founders:[]})).toThrow();
    }
    state=next.state;
  }
  expect(seen.has('prey-birth')).toBe(true);
  expect(seen.has('prey-feeding')).toBe(true);
  expect(seen.has('prey-migration')).toBe(true);
  for (const kind of ['fissure','watercourse','shaft'] as const) expect(pass(open,{...open.graph.boundaries[0],kind},0,'prey')).toBe(false);
});

it('charges each kill to living prey, recycles deaths and rejects narrow or flooded hunting routes',()=>{
  const world=trial(), initial=foundWeb(world,setup,[{...census[0],count:4},{...census[0],group:'predator',count:2}]);
  const sealed=trial(true);
  let state=projectWeb(world,sealed,initial.state);
  const seen=new Set<string>();
  for (let hour=1;hour<=480;hour++) {
    const next=stepWeb(sealed,state);
    auditWeb(sealed,state,next.state,next.ledger);
    for (const e of next.ledger) {
      if (e.resource==='prey' && e.kind==='conversion' && e.from!==null) seen.add(e.process);
    }
    if (hour===73) expect(stepWeb(sealed,restoreWeb(sealed,JSON.parse(JSON.stringify(saveWeb(sealed,state)))))).toEqual(next);
    state=next.state;
  }
  expect(seen.has('predator-feeding')).toBe(true);
  expect(pass(world,{...world.graph.boundaries[0],kind:'duct'},0,'predator')).toBe(false);
  expect(pass(world,{...world.graph.boundaries[0],state:'flooded'},0,'predator')).toBe(false);
});

it('debits fallback food, preserves dietary regime through a checkpoint and charges births',()=>{
  const world=trial(), sealed=trial(true);
  const origin={...setup,founders:{...setup.founders,detritivores:14,fungalBiomass:0}};
  const initial=foundWeb(world,origin,[...census,{...census[0],group:'predator',count:2}],[],'both-generalists');
  let state=projectWeb(world,sealed,initial.state);
  let fallback=false;
  for (let hour=1;hour<=240;hour++) {
    const next=stepWeb(sealed,state);
    auditWeb(sealed,state,next.state,next.ledger);
    if (next.ledger.some(e=>e.from!==null && e.resource==='detritivores' && e.process==='prey-feeding')) fallback=true;
    if (hour===172) {
      const saved=saveWeb(sealed,state);
      expect(stepWeb(sealed,restoreWeb(sealed,JSON.parse(JSON.stringify(saved))))).toEqual(next);
      expect(()=>restoreWeb(sealed,{...saved,diet:'specialists'})).toThrow();
    }
    state=next.state;
  }
  expect(fallback).toBe(true);
});

it('replays the same chronology through two barrier changes, including every posting',()=>{
  const open=trial(),closed=trial(true);
  const founders=[...census,{...census[0],group:'predator' as const,count:2}];
  for (const diet of ['specialists','generalist-predator'] as const) {
    let reference=foundWeb(open,setup,founders,[],diet).state;
    let resumed=foundWeb(open,setup,founders,[],diet).state;
    let world=open;
    for (let tick=1;tick<=300;tick++) {
      if ([33,97].includes(tick)) {
        const next=tick===33 ? closed : open;
        reference=projectWeb(world,next,reference);
        resumed=projectWeb(world,next,resumed);
        world=next;
      }
      if ([32,48,97,181].includes(tick)) resumed=restoreWeb(world,JSON.parse(JSON.stringify(saveWeb(world,resumed))));
      const a=stepWeb(world,reference), b=stepWeb(world,resumed);
      expect(b.ledger).toEqual(a.ledger);
      expect(b.state.residents).toEqual(a.state.residents);
      reference=a.state;
      resumed=b.state;
    }
    expect(saveWeb(world,resumed)).toEqual(saveWeb(world,reference));
  }
});

it('rejects a balanced ledger in which a meal and its energy cost belong to different processes',()=>{
  const world=trial();
  let state=foundWeb(world,setup,census).state;
  for (let hour=1;hour<=12;hour++) {
    const next=stepWeb(world,state);
    if (hour===12) {
      expect(next.ledger.some(e=>e.process==='prey-maintenance')).toBe(true);
      const ledger=next.ledger.map(e=>e.process==='prey-maintenance' ? {...e,process:'evaporation'} : e);
      expect(()=>auditWeb(world,state,next.state,ledger)).toThrow('consumption');
    }
    state=next.state;
  }
});

it('restores checkpoints actually emitted by E1-C and E1-D and reproduces their next ledger',async()=>{
  const {default:fixtures}=await import('./fixtures/e1-food-web-checkpoints.json');
  for (const fixture of fixtures) {
    const world=trial(),state=restoreWeb(world,JSON.parse(JSON.stringify(fixture.snapshot)));
    expect(state.diet).toBe('specialists');
    const next=stepWeb(world,state);
    auditWeb(world,state,next.state,next.ledger);
    expect(next.ledger).toEqual(fixture.nextLedger);
  }
});

it('retains each consumer on its founding region when two habitats join and then split',()=>{
  const split=trial(), graph=split.graph;
  const regions=new Map([['home',0],['near',0],['down',1]]);
  const joined=indexWorld({...graph,signature:'joined',regionToHabitat:regions,
    habitats:[{...graph.habitats[0],capacity:72},graph.habitats[2]],incident:[[0],[0]],
    boundaries:[{...graph.boundaries[1],to:1}]},split.ports,split.capacities);
  const state=foundWeb(split,setup,[...census,{...census[0],region:'near',group:'predator',count:2}]).state;
  const merged=projectWeb(split,joined,state);
  const restored=restoreWeb(joined,JSON.parse(JSON.stringify(saveWeb(joined,merged))));
  const separated=projectWeb(joined,split,restored);
  expect(separated.residents).toEqual(state.residents);
  expect(separated.residents.get('near')).toEqual({prey:0,predator:2});
  expect(separated.residents.get('home')).toEqual({prey:4,predator:0});
});
