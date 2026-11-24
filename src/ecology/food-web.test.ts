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

function grazingTrial(tissue:number, water:number, refuge:boolean, prey=1) {
  const world=trial();
  const dryCargo={water,energy:200,detritus:0,nutrients:0,detritivores:0,fungalBiomass:tissue};
  const scenario={...setup,founders:dryCargo,source:null,maintenancePeriod:24};
  const founders=prey ? [{...census[0],count:prey}] : [];
  return {world,state:foundWeb(world,scenario,founders,refuge).state};
}

it('retains the last fungal unit during grazing while unfed prey die',()=>{
  for (const refuge of [false,true]) {
    const run=grazingTrial(1,200,refuge);
    for (let hour=1;hour<=12;hour++) {
      const next=stepWeb(run.world,run.state);
      auditWeb(run.world,run.state,next.state,next.ledger);
      run.state=next.state;
    }
    expect(run.state.base.stocks.get(0)?.fungalBiomass).toBe(refuge ? 1 : 0);
    expect(run.state.residents.get('home')?.prey ?? 0).toBe(refuge ? 0 : 1);
    const saved=saveWeb(run.world,run.state);
    expect(restoreWeb(run.world,JSON.parse(JSON.stringify(saved))).myceliumRefuge).toBe(refuge);
    expect(()=>restoreWeb(run.world,{...saved,version:refuge ? 'E1-D/1' : 'E1-D/1-mycelium-refuge-1'})).toThrow();
  }
});

it('leaves a sterile building sterile and allows the last established mycelium to die from scarcity',()=>{
  for (const tissue of [0,1]) {
    const run=grazingTrial(tissue,0,true,0);
    let fungalDeaths=0;
    for (let hour=1;hour<=48;hour++) {
      const next=stepWeb(run.world,run.state);
      auditWeb(run.world,run.state,next.state,next.ledger);
      fungalDeaths+=next.ledger.filter(e=>e.resource==='fungalBiomass' && e.process==='fungalBiomass-mortality/water').length;
      run.state=next.state;
      if (!tissue || hour>=24) expect([...run.state.base.stocks.values()].every(s=>s.fungalBiomass===0 && s.propagules===0)).toBe(true);
    }
    expect(fungalDeaths).toBe(tissue);
  }
});

it('uses the same grazing limit for births after two paid meals',()=>{
  for (const refuge of [false,true]) {
    const run=grazingTrial(3,200,refuge,2);
    // Isolate the birth-hour transition with a fresh census, before metabolism is due.
    const scenario={...run.state.base.setup,maintenancePeriod:96};
    const before=foundWeb(run.world,scenario,run.state.founders,refuge).state;
    before.base.tick=47;
    const next=stepWeb(run.world,before);
    auditWeb(run.world,before,next.state,next.ledger);
    expect(next.ledger.some(e=>e.process==='prey-birth')).toBe(!refuge);
    expect(next.state.base.stocks.get(0)?.fungalBiomass).toBe(refuge ? 1 : 0);
  }
});

it('uses the historical E1-D/1 snapshot and trajectory by default',()=>{
  const world=trial();
  const implicit=foundWeb(world,setup,census).state;
  const saved=saveWeb(world,implicit);
  expect(saved.version).toBe('E1-D/1');
  expect(restoreWeb(world,saved).myceliumRefuge).toBe(false);
  expect(stepWeb(world,implicit)).toEqual(stepWeb(world,foundWeb(world,setup,census,false).state));
  let state=implicit;
  for (let hour=1;hour<=240;hour++) state=stepWeb(world,state).state;
  // Emitted by saveWeb at 477185fe with this fixture.
  expect(saveWeb(world,state).signature).toBe('4657aa0899efd8f4300949742324c8a0d87d2d9bb38399ef9b1f6a465ca6282e');
});
