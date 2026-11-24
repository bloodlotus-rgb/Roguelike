import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { applyChemicalAccountingHour, applyChemicalHour, auditChemicalLedger, chemicalContract, chemicalDelivery, type ChemicalState, type ChemicalSupply } from './chemical-ledger';
import { buildDispersalWorld, changeDispersalBarrier, indexWorld } from './dispersal-world';
import { apportion, planChemicalTransport } from './chemical-transport';
import { projectChemicalState, restoreChemical, saveChemical } from './chemical-snapshot';
import type { Boundary, HabitatGraph } from './habitats';

const regions = ['a','b','c','d'];
const edges = [['alpha','a','b'],['beta','a','c'],['next','b','d']] as const;
function world(seed: string, closed = false, mixed = false, reverse = false, flat = false) {
  const partition = mixed ? [0,0,0,1] : [0,1,2,3];
  const index = new Map(regions.map((r,i) => [r,partition[i]]));
  const edgesOrdered = reverse ? [...edges].reverse() : edges;
  const boundaries: Boundary[] = edgesOrdered.flatMap(([id,a,b]) => index.get(a) === index.get(b) ? [] :
    [{ id, from:index.get(a)!, to:index.get(b)!, kind:'watercourse', state:closed && id==='alpha'?'closed':'open' }]);
  const graph: HabitatGraph = { seed, signature: JSON.stringify([seed,closed,mixed]), entrance:0,
    barriers:closed?[['alpha','closed']]:[], boundaries, regionToHabitat:index,
    habitats: Array.from({length:mixed?2:4}, (_,i) => ({zone:1,depthM:flat ? 0 : i,areaM2:10,capacity:10,humidity:1,morphology:[]})),
    incident: Array.from({length:mixed?2:4}, (_,i) => boundaries.flatMap((c,j) => c.from===i || c.to===i ? [j] : [])) };
  return indexWorld(graph,new Map(edges.map(([id,a,b]) => [id,[a,b] as const])),new Map(regions.map(r=>[r,10])));
}
const stock = (matter:number, chemicalEnergy:number, water=0, mineralMatter=0) =>
  ({detritus:{matter,chemicalEnergy},water,mineralMatter});
const opening = (w: ReturnType<typeof world>, matter=3): ChemicalState =>
  ({topology:w.graph.signature,tick:0,inventory:new Map([[0,stock(matter,7,3,2)]]),heat:new Map(),lotsUsed:new Map()});
const supply: ChemicalSupply = {id:'upstream',origin:'fixture',port:{connector:'alpha',fromRegion:'a',toRegion:'b'},
  perLot:stock(2,5,1),rate:1,periodHours:1,activeHours:1,quotaLots:2};

it.each([1,2,3])('moves %s indivisible organic units and all attached chemical energy only one cut', matter => {
  const w=world('fixture'), before=opening(w,matter);
  const ledger=planChemicalTransport(w,before);
  const result=applyChemicalHour(w,[],before,ledger);
  expect(result.state.inventory.get(1)).toEqual(stock(matter,7,3,2));
  expect(result.state.inventory.has(3)).toBe(false);
  expect(result.exported.chemicalEnergy).toBe(0n);
  expect(result.dissipated).toBe(0n);
  expect(result.internalOut.get(0)?.chemicalEnergy).toBe(7n);
  expect(result.internalIn.get(1)?.chemicalEnergy).toBe(7n);
  auditChemicalLedger(w,[],before,ledger,result.state);
});

it('saturates competing cuts deterministically and assigns the odd quantum without orphan energy', () => {
  const a=world('fixture'), b=world('fixture',false,false,true);
  const before={...opening(a),inventory:new Map([[0,stock(9,10)], [3,stock(0,0)]])};
  const ledger=planChemicalTransport(a,before);
  expect(ledger.map(t=>[t.connector,t.cargo.detritus])).toEqual([
    ['alpha',{matter:4,chemicalEnergy:5}],['beta',{matter:4,chemicalEnergy:4}],
  ]);
  const reorder={...before,inventory:new Map([...before.inventory].reverse())};
  expect(JSON.stringify(planChemicalTransport(b,reorder))).toBe(JSON.stringify(ledger));
  const after=applyChemicalHour(a,[],before,ledger).state;
  expect(after.inventory.get(0)?.detritus).toEqual({matter:1,chemicalEnergy:1});
  expect(apportion(Number.MAX_SAFE_INTEGER,[1,2,0]).reduce((a,b)=>a+b,0)).toBe(Number.MAX_SAFE_INTEGER);
});

it('rejects invented, inverted, duplicated, detached and closed crossings before committing', () => {
  const a=world('fixture'), b=world('fixture',true), before=opening(a);
  const ledger=planChemicalTransport(a,before);
  for (const change of [
    {...ledger[0],connector:'phantom'}, {...ledger[0],toHabitat:3}, {...ledger[0],fromHabitat:1,toHabitat:0},
    {...ledger[0],cargo:stock(0,1)}, {...ledger[0],cargo:stock(100,7)},
  ]) {
    expect(()=>applyChemicalHour(a,[],before,[change,...ledger.slice(1)])).toThrow();
  }
  expect(()=>applyChemicalHour(a,[],before,[...ledger,ledger[0]])).toThrow();
  const moved=projectChemicalState(a,b,before);
  expect(planChemicalTransport(b,moved).every(t=>t.connector!=='alpha')).toBe(true);
  expect(()=>applyChemicalHour(b,[],moved,ledger)).toThrow();
  expect(planChemicalTransport(a,{...before,inventory:new Map([[1,stock(3,7)]])})
    .every(t=>t.connector!=='alpha')).toBe(true);
});

it('splits and merges using fine-region overlap and keeps heat as heat', () => {
  const a=world('fixture',false,true,false,true), b=world('fixture',false,false,false,true);
  const before={...opening(a,1),contract:chemicalContract([]).contract,heat:new Map([[0,5]]),tick:2};
  const divided=projectChemicalState(a,b,before);
  expect(divided.inventory.get(0)?.detritus).toEqual({matter:1,chemicalEnergy:7});
  expect(divided.inventory.get(1)?.detritus).toEqual({matter:0,chemicalEnergy:0});
  expect([...divided.heat.values()]).toEqual([2,2,1]);
  expect(projectChemicalState(b,a,divided)).toEqual(before);
  expect(projectChemicalState(a,a, before)).toEqual(before);
  expect(()=>projectChemicalState(b,a,before)).toThrow(/epoch/);
  expect(()=>projectChemicalState(a,world('other'),before)).toThrow(/building/);
  const missing=world('fixture');
  missing.graph.regionToHabitat.delete('c');
  missing.graph.regionToHabitat.set('other',2);
  expect(()=>projectChemicalState(a,missing,before)).toThrow(/region/);
});

it.each(['mansion','estirpe','zz'])('replays exact snapshots and ledgers on fixture %s with closure', seed => {
  const open=world(seed), closed=world(seed,true);
  let continuous=opening(open), replay=opening(open);
  for (const [hour,w] of [[1,open],[2,open],[3,closed],[4,closed],[5,open]] as const) {
    if (hour===3 || hour===5) {
      const previous=hour===3?open:closed;
      continuous=projectChemicalState(previous,w,continuous,[supply]);
      replay=projectChemicalState(previous,w,replay,[supply]);
    }
    const entries=(s:ChemicalState) => {
      const delivery=w===open?chemicalDelivery(w,supply,s,'supply'):undefined;
      return [...planChemicalTransport(w,s),...(delivery?[delivery]:[])];
    };
    expect(JSON.stringify(entries(continuous))).toBe(JSON.stringify(entries(replay)));
    continuous=applyChemicalHour(w,[supply],continuous,entries(continuous)).state;
    replay=applyChemicalHour(w,[supply],replay,entries(replay)).state;
    const saved=JSON.stringify(saveChemical(w,[supply],replay));
    if (hour===2 || hour===3) replay=restoreChemical(w,[supply],JSON.parse(saved));
    expect(saved).toBe(JSON.stringify(saveChemical(w,[supply],continuous)));
  }
  expect(replay.lotsUsed.get('upstream')).toBe(2);
});

it('rejects legacy formats, altered contract and malformed accounts even with recalculated integrity', () => {
  const w=world('fixture'), saved=saveChemical(w,[supply],opening(w));
  for (const version of ['E1-B1/1','E1-B2/1','E1-C/1','E1-D/1','E1-Chemical-Transport/1']) {
    expect(()=>restoreChemical(w,[supply],{version})).toThrow(/version/);
  }
  expect(()=>restoreChemical(w,[{...supply,perLot:stock(2,6,1)}],saved)).toThrow(/contract/);
  expect(()=>restoreChemical(w,[{...supply,quotaLots:4}],saved)).toThrow(/contract/);
  expect(()=>restoreChemical(world('fixture',true),[supply],saved)).toThrow(/epoch/);
  expect(()=>restoreChemical(w,[supply],{...saved,integrity:'tampered'})).toThrow(/integrity/);
  for (const corrupt of [
    (s:typeof saved)=>s.accounts[1].push(s.accounts[1][0]),
    (s:typeof saved)=>{s.accounts[1][0][1]=0;},
    (s:typeof saved)=>{s.accounts[1][0][2]=Number.MAX_SAFE_INTEGER+1;},
    (s:typeof saved)=>s.accounts[3].push(['upstream',1]),
  ]) {
    const altered=structuredClone(saved);
    corrupt(altered);
    const {integrity:_, ...payload}=altered;
    const integrity=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    expect(()=>restoreChemical(w,[supply],{...payload,integrity})).toThrow();
  }
});

it.each(['mansion','zz'])('resumes across a barrier on generated Jenga geometry %s', seed => {
  const open=buildDispersalWorld(seed);
  const cut=open.graph.boundaries.find(c=>c.kind==='watercourse' && c.state==='open' &&
    open.graph.habitats[c.from].depthM < open.graph.habitats[c.to].depthM)!;
  const closed=changeDispersalBarrier(open,cut.id,'blocked');
  const before: ChemicalState={topology:open.graph.signature,tick:0,
    inventory:new Map([[cut.from,stock(3,11,4,1)]]),heat:new Map(),lotsUsed:new Map()};
  const ledger=planChemicalTransport(open,before);
  expect(ledger.some(t=>t.connector===cut.id)).toBe(true);
  const first=applyChemicalHour(open,[],before,ledger).state;
  const projected=projectChemicalState(open,closed,first);
  const replay=restoreChemical(closed,[],JSON.parse(JSON.stringify(saveChemical(closed,[],projected))));
  const a=planChemicalTransport(closed,projected), b=planChemicalTransport(closed,replay);
  expect(a.every(t=>t.connector!==cut.id)).toBe(true);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  expect(JSON.stringify(saveChemical(closed,[],applyChemicalHour(closed,[],projected,a).state)))
    .toBe(JSON.stringify(saveChemical(closed,[],applyChemicalHour(closed,[],replay,b).state)));
}, 25000);

it('rejects an omitted physical crossing atomically', () => {
  const w = world('fixture'), before = opening(w);
  expect(planChemicalTransport(w, before).length).toBeGreaterThan(0);
  const checkpoint = saveChemical(w, [], before);
  expect(() => applyChemicalHour(w, [], before, [])).toThrow(/physical opening plan/);
  expect(saveChemical(w, [], before)).toEqual(checkpoint);
  expect(() => applyChemicalAccountingHour(w, [], before, planChemicalTransport(w, before))).toThrow(/transport mode/);
  const accounted = applyChemicalAccountingHour(w, [], before, []).state;
  expect(() => applyChemicalHour(w, [], accounted, planChemicalTransport(w, accounted))).toThrow(/contract/);
});

const meteredSupply = {...supply, perLot: stock(1, 2), rate: 2, quotaLots: 5};
function deliverFirstLots(w: ReturnType<typeof world>) {
  const before = {...opening(w), inventory: new Map()};
  return applyChemicalHour(w, [meteredSupply], before, [chemicalDelivery(w, meteredSupply, before, 'in')!]).state;
}

it('binds confirmed state to the original source manifest', () => {
  const w = world('fixture'), after = deliverFirstLots(w);
  const changed = {...meteredSupply, perLot: stock(1, 99)};
  expect(after.inventory.get(0)).toEqual(stock(2, 4));
  expect(() => saveChemical(w, [changed], after)).toThrow(/contract/);
  expect(() => applyChemicalHour(w, [changed], after, planChemicalTransport(w, after))).toThrow(/contract/);
  expect(() => projectChemicalState(w, world('fixture', true), after, [changed])).toThrow(/contract/);
});

it('rejects a quota meter unreachable by complete scheduled lots', () => {
  const w = world('fixture'), after = deliverFirstLots(w);
  const saved = saveChemical(w, [meteredSupply], after);
  const {integrity: _, ...payload} = structuredClone(saved);
  payload.accounts[3][0][1] = 1;
  const integrity = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  expect(() => restoreChemical(w, [meteredSupply], {...payload, integrity})).toThrow(/supply meter/);
  const second = applyChemicalHour(w, [meteredSupply], after,
    [...planChemicalTransport(w, after), chemicalDelivery(w, meteredSupply, after, 'second')!]).state;
  const last = chemicalDelivery(w, meteredSupply, second, 'last')!;
  expect(last).toMatchObject({lots: 1});
  const exhausted = applyChemicalHour(w, [meteredSupply], second, [...planChemicalTransport(w, second), last]).state;
  expect(exhausted.lotsUsed.get(meteredSupply.id)).toBe(5);
  expect(restoreChemical(w, [meteredSupply], saveChemical(w, [meteredSupply], exhausted))).toEqual(exhausted);
});

it('rejects a depth edit disguised as a change of barrier', () => {
  const a = world('fixture'), b = world('fixture', true);
  b.graph.habitats[1].depthM = 0;
  expect(() => projectChemicalState(a, b, opening(a))).toThrow(/building/);
});

it('keeps the barriers in a checkpoint detached from the live world', () => {
  const w = world('fixture', true);
  const checkpoint = saveChemical(w, [], opening(w));
  checkpoint.epoch.barriers[0][1] = 'open';
  expect(w.graph.barriers[0][1]).toBe('closed');
});

it('resumes mansion after a used source becomes internal to a merged habitat', () => {
  const connector = '0/12/12/0/1';
  const open = buildDispersalWorld('mansion');
  const split = changeDispersalBarrier(open, connector, 'flooded');
  const [fromRegion, toRegion] = split.ports.get(connector)!;
  const source = {...meteredSupply, port: {connector, fromRegion, toRegion}};
  const before = {...opening(split), inventory: new Map()};
  const after = applyChemicalHour(split, [source], before, [chemicalDelivery(split, source, before, 'in')!]).state;
  expect(open.graph.regionToHabitat.get(fromRegion)).toBe(open.graph.regionToHabitat.get(toRegion));
  const merged = projectChemicalState(split, open, after, [source]);
  const saved = saveChemical(open, [source], merged);
  const restored = restoreChemical(open, [source], JSON.parse(JSON.stringify(saved)));
  expect(restored.lotsUsed.get(source.id)).toBe(2);
  expect(chemicalDelivery(open, source, restored, 'inactive')).toBeUndefined();
  const plan = planChemicalTransport(open, restored);
  expect(() => applyChemicalHour(open, [source], restored, [...plan, {
    kind: 'source', tick: 2, transactionId: 'invalid', process: 'delivery', supply: source.id, lots: 2,
  }])).toThrow();
  const advanced = applyChemicalHour(open, [source], restored, plan);
  expect(advanced.imported.chemicalEnergy).toBe(0n);
  expect(advanced.state.lotsUsed.get(source.id)).toBe(2);
  expect(advanced.state.tick).toBe(2);
  const reopened = projectChemicalState(open, split, advanced.state, [source]);
  expect(chemicalDelivery(split, source, reopened, 'return')).toMatchObject({lots: 2});
}, 25000);
