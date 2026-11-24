import { createHash } from 'node:crypto';
import { foundColony, saveColony, stepTrophic } from './trophic';
import { foundMeta, saveMeta, stepMeta } from './metapopulation';
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

it('restores signed historical C/D snapshots and rejects a changed growth policy', () => {
  const world=trial(), historic=foundWeb(world,setup,census).state;
  const original=saveWeb(world,historic);
  // Signatures produced by 7ce01e7 (C) and 477185fe (D) with the same physical fixture.
  expect(original.signature).toBe('bec56d21ddb77dcf3dc084f484894f81fbbbd32d162f44f7919b2f5bc6d73656');
  const legacy={...original, version:'E1-C/1', residents:original.residents.map(([r,t])=>[r,{prey:t.prey}]),
    signature:'57790579b325a42c1cc190302b8c5499b144fb2a9af4dac1da66aa1ff17bd417'};
  expect(restoreWeb(world,JSON.parse(JSON.stringify(legacy)))).toEqual(historic);
  expect(restoreWeb(world,original)).toEqual(historic);
  const experimental=saveWeb(world,foundWeb(world,setup,census,true).state);
  expect(restoreWeb(world,experimental).growthPriority).toBe(true);
  expect(()=>restoreWeb(world,{...experimental,version:original.version})).toThrow();
  expect(()=>restoreWeb(world,{...original,version:experimental.version})).toThrow();
  expect(()=>restoreWeb(world,{...experimental,signature:original.signature})).toThrow();
});

it('reproduces 240 historical B1/B2 hourly ledgers and their final snapshots', () => {
  const world=trial();
  let colony=foundColony(world.graph,setup).state, meta=foundMeta(world,setup).state;
  const b1=createHash('sha256'), b2=createHash('sha256');
  for(let tick=0;tick<240;tick++){
    const c=stepTrophic(world.graph,colony), m=stepMeta(world,meta);
    b1.update(JSON.stringify(c.ledger));
    b2.update(JSON.stringify(m.ledger));
    colony=c.state;
    meta=m.state;
  }
  expect(b1.update(JSON.stringify(saveColony(world.graph,colony))).digest('hex'))
    .toBe('7ec5d3fa66a7292fb6d51023d011e05e74c8ff16b34940d4bf84aefacf6eda31');
  expect(b2.update(JSON.stringify(saveMeta(world,meta))).digest('hex'))
    .toBe('d8216b43ab9f09ca4c33010e2701871fbb89b0030bd5b07614712edb46eed6a6');
});
