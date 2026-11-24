import { expect, it } from 'vitest';
import { indexWorld, organismPass } from './dispersal-world';
import { type HabitatGraph, type Boundary } from './habitats';
import { auditMeta, foundMeta, living, projectMeta, restoreMeta, saveMeta, stepMeta, type MetaState } from './metapopulation';
import { foundColony, stepTrophic } from './trophic';
import { emptyTrophicStock, type TrophicScenario } from './trophic-contract';

const setup: TrophicScenario = { seed: 'test', region: 'up', watershed: 'outer-basin', connector: 'inlet', settlement: 'upstream',
  founders: { water: 24, detritus: 30, nutrients: 2, fungalBiomass: 4, energy: 20, detritivores: 2 },
  source: { kind: 'organicSediment', rate: 6, quota: 1000, period: 1, activeHours: 1 } };
function site(blocked = false, mixed = false) {
  const regions = new Map([['up',0],['out',1],['bridge-end',2],['far',mixed ? 2 : 3]]);
  const graph: HabitatGraph = { seed: 'test', signature: 'fixture/' + blocked + mixed, entrance: 0, regionToHabitat: regions,
    barriers: blocked ? [['bridge','blocked']] : [],
    habitats: (mixed ? [6,12,6] : [6,12,6,6]).map((depthM,i) => ({ depthM, zone: 1, capacity: mixed && i===2 ? 72 : 36,
      areaM2: 36, morphology: ['tunnel'], humidity: 0.2 })), boundaries: [], incident: [] };
  const ports = new Map<string, readonly [string,string]>();
  function add(id: string, from: string, to: string, kind: Boundary['kind'], state: Boundary['state']) {
    ports.set(id,[from,to]);
    if (regions.get(from) !== regions.get(to)) graph.boundaries.push({ id, from: regions.get(from)!, to: regions.get(to)!, kind, state });
  }
  add('bridge','up','bridge-end','opening',blocked ? 'blocked' : 'open');
  add('far-door','bridge-end','far','opening',mixed ? 'open' : 'blocked');
  add('inlet','up','out','watercourse','open');
  graph.incident = graph.habitats.map((_,id) => graph.boundaries.flatMap((cut,i) => cut.from===id || cut.to===id ? [i] : []));
  return indexWorld(graph,ports,new Map([...regions.keys()].map(r => [r,36])));
}

it('prices a propagule, crosses a physical port, and establishes only from arrived mass; closure and reopening change the outcome', () => {
  const open = site(), closed = site(true);
  function run(reopen: boolean) {
    let world = open, state = foundMeta(open,setup).state;
    let extinct = false, recolonized = false, born = false;
    for (let t=1;t<=144;t++) {
      if (t === 33 || (t === 97 && reopen)) {
        const next = t===33 ? closed : open;
        state = projectMeta(world,next,state);
        world = next;
      }
      const next = stepMeta(world,state);
      auditMeta(state.stocks,next.state.stocks,next.ledger);
      const target = next.state.stocks.get(2);
      if (t===4) {
        expect(next.ledger.filter(e => e.process === 'propagule-production').map(e => [e.kind,e.resource,e.amount])).toEqual([
          ['conversion','fungalBiomass',1],['conversion','propagules',1],['sink','energy',1]]);
        expect(next.ledger).toContainEqual({ kind:'transfer',process:'packet-drift',from:0,to:2,connector:'bridge',resource:'propagules',amount:1 });
        expect(target?.fungalBiomass).toBe(1);
      }
      if (next.ledger.some(e => e.to===2 && e.process==='detritivore-birth')) born = true;
      if (world === closed) {
        expect(next.ledger.some(e => e.connector==='bridge')).toBe(false);
        if (!target?.fungalBiomass && !target?.propagules && !target?.detritivores) extinct=true;
      }
      if (t>=97 && extinct && target?.fungalBiomass && target.detritivores) {
        if (!recolonized) expect(next.ledger.filter(e => e.to===2 && e.connector==='bridge').map(e=>e.resource)).toContain('propagules');
        recolonized=true;
      }
      state=next.state;
    }
    expect(extinct).toBe(true);
    expect(born).toBe(true);
    return recolonized;
  }
  expect(run(false)).toBe(false);
  expect(run(true)).toBe(true);
});

it('uses species-specific passage, section, slope and flooding constraints', () => {
  const {graph} = site();
  for (const [kind, packet, grazer] of [
    ['fissure',true,false],['shaft',true,false],['duct',true,true],['stairs',true,true],['gate',true,true],
    ['interior',true,true],['opening',true,true],['watercourse',true,false],
  ] as const) {
    const cut = { ...graph.boundaries[0], kind };
    expect(organismPass(graph,cut,0,'propagules',true)).toBe(packet);
    expect(organismPass(graph,cut,0,'detritivores',true)).toBe(grazer);
    for (const state of ['blocked','closed'] as const) for (const r of ['propagules','detritivores'] as const) {
      expect(organismPass(graph,{ ...cut,state },0,r,true)).toBe(false);
    }
    expect(organismPass(graph,{ ...cut,state:'flooded' },0,'detritivores',true)).toBe(false);
    expect(organismPass(graph,{ ...cut,state:'flooded' },0,'propagules',false)).toBe(false);
  }
  const stream = graph.boundaries.at(-1)!;
  expect(organismPass(graph,stream,1,'propagules',true)).toBe(false);
  expect(organismPass(graph,{ ...stream,kind:'shaft' },1,'propagules',true)).toBe(false);
  expect(organismPass(graph,{ ...stream,kind:'gate',state:'destroyed' },0,'detritivores',true)).toBe(true);
  expect(organismPass(graph,{ ...stream,kind:'gate',state:'destroyed' },1,'detritivores',true)).toBe(false);
  expect(organismPass(graph,{ ...stream,state:'flooded' },0,'propagules',true)).toBe(true);
});

it('matches stationary E1-B1 accounts and ordered postings every hour when disabled', () => {
  const w = site();
  let first=foundColony(w.graph,setup).state, second=foundMeta(w,setup,[],false).state;
  for (let i=0;i<240;i++) {
    const a=stepTrophic(w.graph,first), b=stepMeta(w,second);
    expect(b.ledger).toEqual(a.ledger);
    expect(b.state.lotsUsed).toBe(a.state.lotsUsed);
    expect(new Map([...a.state.stocks].map(([id,s])=>[id,{ ...s,propagules:0 }]))).toEqual(b.state.stocks);
    first=a.state; second=b.state;
  }
});

it('keeps living material on its fine regions through a merge, checkpoint and split', () => {
  const split=site(), mixed=site(false,true);
  const deposit = { region:'bridge-end',connector:'bridge',origin:'earlier-sediment',stock:{...emptyTrophicStock(),fungalBiomass:3} };
  const initial=foundMeta(split,setup,[deposit]).state;
  const merged=projectMeta(split,mixed,initial);
  const saved=saveMeta(mixed,merged);
  const resumed=restoreMeta(mixed,JSON.parse(JSON.stringify(saved)));
  expect(() => restoreMeta(mixed,{...saved,contract:'wrong'})).toThrow();
  expect(() => restoreMeta(mixed,{...saved,tick:saved.tick+1})).toThrow('Damaged checkpoint');
  expect(() => restoreMeta(mixed,{...saved,anchors:[]})).toThrow();
  expect(() => restoreMeta(split,saved)).toThrow();
  const back=projectMeta(mixed,split,resumed);
  expect(back.anchors).toEqual(initial.anchors);
  expect(back.stocks.get(3)?.fungalBiomass ?? 0).toBe(0);
  let a: MetaState=merged, b=resumed;
  for(let i=0;i<36;i++){
    const x=stepMeta(mixed,a), y=stepMeta(mixed,b);
    expect(x).toEqual(y);
    a=x.state;b=y.state;
  }
  const splitAgain=projectMeta(mixed,split,a);
  for (const r of living) expect(splitAgain.stocks.get(3)?.[r] ?? 0).toBe(a.anchors.get('far')?.[r] ?? 0);
  expect(() => foundMeta(site(true),setup,[deposit])).toThrow('blocked');
});

it('delays onward movement and recycles an ungerminated packet with no water or organic substrate', () => {
  const world=site(), graph=world.graph;
  // Dry fissures pass packets. Their resource law retains detritus, so the receiver cannot germinate.
  graph.boundaries[0].kind='fissure';
  graph.boundaries[1].state='open';
  graph.boundaries[1].kind='fissure';
  const config={...setup,source:null,founders:{...setup.founders, water:60,detritus:30,energy:60}};
  const start=foundMeta(world,config);
  let state=start.state;
  let decayed=false;
  for (let t=1;t<=24;t++) {
    const next=stepMeta(world,state);
    auditMeta(state.stocks,next.state.stocks,next.ledger);
    if(t===4) {
      expect(next.state.stocks.get(2)?.propagules).toBe(1);
      expect(next.state.stocks.get(3)?.propagules ?? 0).toBe(0);
    }
    if(t===8) expect(next.ledger.some(e=>e.process==='packet-drift' && e.from===2)).toBe(true);
    if(next.ledger.some(e=>e.process==='packet-decay')) decayed=true;
    expect(next.state.stocks.get(2)?.fungalBiomass ?? 0).toBe(0);
    state=next.state;
  }
  expect(decayed).toBe(true);
});

it('keeps nutrient-rich sterile sites sterile and rejects a checkpoint from the stationary format', () => {
  const world=site();
  let state=foundMeta(world,{...setup,founders:emptyTrophicStock()}).state;
  for(let t=0;t<24;t++) state=stepMeta(world,state).state;
  expect(state.anchors.size).toBe(0);
  expect(() => restoreMeta(world,{...saveMeta(world,state),version:'E1-B1/1'})).toThrow();
});
