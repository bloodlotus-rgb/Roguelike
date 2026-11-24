import { createHash } from 'node:crypto';
import { sections } from '../core/spatial.ts';
import { auditAccounts } from './audit.ts';
import { organismPass, type DispersalWorld } from './dispersal-world.ts';
import { type Boundary } from './habitats.ts';
import { auditMetaTransfers, emptyMeta, foundMeta, metaAccounts, metaMatter, projectMeta, restoreMetaWithMatter, saveMeta, stepMeta,
  type CompanionPhase, type Deposit, type MetaPosting, type MetaState } from './metapopulation.ts';
import { parameters } from './parameters.ts';
import { type Entry } from './resources.ts';
import { accounts, cargo, natural, type TrophicScenario } from './trophic-contract.ts';

export const profiles = {
  prey: { width: 0.25, height: 0.18, mealPeriod: 12, birthPeriod: 48, movePeriod: 6, diet:'fungalBiomass' },
  predator: { width: 0.65, height: 0.45, mealPeriod: 72, birthPeriod: 240, movePeriod: 24, diet:'prey' },
} as const;
export type Animal = keyof typeof profiles;
export const groups = Object.keys(profiles) as Animal[];
type Counts = Record<Animal,number>;
const counts = (): Counts => Object.fromEntries(groups.map(g => [g,0])) as Counts;
const fields = [...metaAccounts,...groups];
type Posting = Entry<typeof fields[number]>;
const empty = () => ({ ...emptyMeta(), ...counts() });
export interface Founder { region:string; connector:string; origin:string; group:Animal; count:number }
export interface Web {
  base: MetaState;
  residents: Map<string,Counts>;
  founders: readonly Founder[];
}

export function pass(world: DispersalWorld, cut: Boundary, id: number, group: Animal) {
  const profile = profiles[group], section = sections[cut.kind];
  return section.width >= profile.width && section.clearance >= profile.height &&
    organismPass(world.graph,cut,id,'detritivores',false);
}
function population(t?: Counts) { return t ? groups.reduce((sum,g) => sum+t[g],0) : 0; }
function baseMass(t?: { fungalBiomass:number; propagules:number; detritivores:number }) {
  return t ? t.fungalBiomass+t.propagules+t.detritivores : 0;
}
function validate(world: DispersalWorld, state: Web) {
  for (const [region,t] of state.residents) {
    const cap = world.capacities.get(region);
    if (cap === undefined || !groups.every(g => natural(t[g])) || population(t)+baseMass(state.base.anchors.get(region)) > cap) {
      throw new Error('Invalid regional population');
    }
  }
}
function founderBudget(world: DispersalWorld, setup: TrophicScenario, founders: readonly Founder[], deposits: readonly Deposit[] = []) {
  const {source} = setup;
  let budget = accounts.reduce((n,r) => n+setup.founders[r],0);
  if (source) {
    const lot = cargo[source.kind];
    budget += source.quota*(lot.water+lot.detritus+lot.energy);
  }
  for (const deposit of deposits) for (const r of accounts) budget+=deposit.stock[r];
  let total = 0;
  for (const f of founders) {
    if (!Object.hasOwn(profiles,f.group) || !natural(f.count) || !f.count || !f.origin?.trim() ||
        !world.ports.get(f.connector)?.includes(f.region)) throw new Error('Invalid founding census');
    total += f.count;
  }
  if (total+budget > parameters.inventoryLimit) throw new Error('External budget exceeded');
  return total;
}
export function foundWeb(world: DispersalWorld, setup: TrophicScenario, founders: readonly Founder[], deposits: readonly Deposit[] = []) {
  founderBudget(world,setup,founders,deposits);
  const {state:base,ledger:initial} = foundMeta(world,setup,deposits);
  const residents = new Map<string,Counts>();
  const ledger: Posting[] = [...initial];
  for (const f of founders) {
    const id = world.graph.regionToHabitat.get(f.region)!;
    const cut = world.graph.incident[id].map(i => world.graph.boundaries[i]).find(c => c.id === f.connector);
    if (!cut || !pass(world,cut,cut.from===id ? cut.to : cut.from,f.group)) throw new Error('Incompatible founding route');
    const t = residents.get(f.region) ?? counts();
    t[f.group] += f.count;
    residents.set(f.region,t);
    ledger.push({kind:'source',process:'founders/'+f.origin,resource:f.group,from:null,to:id,amount:f.count,connector:f.connector});
  }
  const state = {base,residents,founders:Object.freeze(founders.map(f=>Object.freeze({...f})))};
  validate(world,state);
  return {state,ledger};
}
export function inventory(world: DispersalWorld, web: Web) {
  const stocks = new Map<number,ReturnType<typeof empty>>();
  for (const [id,s] of web.base.stocks) stocks.set(id,{...s,...counts()});
  for (const [region,t] of web.residents) {
    const id=world.graph.regionToHabitat.get(region)!;
    const s=stocks.get(id) ?? empty();
    for (const group of groups) s[group]+=t[group];
    stocks.set(id,s);
  }
  return stocks;
}
export function auditWeb(world: DispersalWorld, before: Web | null, after: Web, ledger: Posting[]) {
  validate(world,after);
  auditMetaTransfers(world,after.base.stocks,ledger.filter(e=>!Object.hasOwn(profiles,e.resource)) as MetaPosting[]);
  const used = new Set<string>();
  for (const e of ledger) {
    if (e.kind!=='transfer' || !Object.hasOwn(profiles,e.resource)) continue;
    const cut = e.from===null ? undefined : world.graph.incident[e.from]?.map(i=>world.graph.boundaries[i]).find(c=>c.id===e.connector);
    const key = e.connector+'/'+e.resource;
    if (!cut || e.from===null || e.amount!==1 || used.has(key) || e.to!==(cut.from===e.from ? cut.to : cut.from) ||
        !pass(world,cut,e.from,e.resource as Animal)) throw new Error('Invalid animal crossing');
    used.add(key);
  }
  return auditAccounts(before ? inventory(world,before) : new Map(),inventory(world,after),ledger,fields,empty,[...metaMatter,...groups]);
}

export function stepWeb(world: DispersalWorld, previous: Web) {
  const tick = previous.base.tick+1;
  const residents = new Map([...previous.residents].map(([r,t])=>[r,{...t}]));
  const occupied = new Map([...residents].map(([r,t])=>[r,population(t)]));
  const log: Posting[] = [];
  let offset = 0;
  const afterMetabolism: CompanionPhase['afterMetabolism'] = (stocks,anchors,start,debit) => {
    offset=start;
    const change = (region:string,g:Animal,delta:number) => {
      const t=residents.get(region) ?? counts();
      t[g]+=delta;
      if (population(t)) residents.set(region,t);
      else residents.delete(region);
      occupied.set(region,population(t));
    };
    function spend(id:number,process:string) {
      stocks.get(id)!.energy--;
      log.push({kind:'sink',process,from:id,to:null,resource:'energy',amount:1});
    }
    function convert(id:number,process:string,from:Posting['resource'],to:Posting['resource'],amount:number) {
      log.push({kind:'conversion',process,from:id,to:null,resource:from,amount},
        {kind:'conversion',process,from:null,to:id,resource:to,amount});
    }
    const room = (region:string) => world.capacities.get(region)!-baseMass(anchors.get(region))-(occupied.get(region) ?? 0);
    const regions=[...residents.keys()].sort();
    const incoming: {region:string; group:Animal}[]=[];
    const reserved=new Map<string,number>(), used=new Set<string>();
    for (const group of groups) {
      const profile=profiles[group];
      const food=profile.diet;
      const preyRegion=(id:number) => world.members[id].find(r => (residents.get(r)?.prey ?? 0)>0);
      const foodAt=(id:number) => food==='prey' ? preyRegion(id)!==undefined : !!stocks.get(id)?.[food];
      const feed=(id:number) => {
        if (food==='prey') change(preyRegion(id)!,food,-1);
        else debit(id,food,1);
      };
      for (const region of regions) {
        const count=residents.get(region)?.[group] ?? 0;
        if (!count) continue;
        const id=world.graph.regionToHabitat.get(region)!;
        const s=stocks.get(id) ?? emptyMeta();
        stocks.set(id,s);
        if (tick%profile.mealPeriod===0) {
          for (let i=0;i<count;i++) {
            if (s.water && s.energy && foodAt(id)) {
              feed(id);
              s.nutrients++;
              convert(id,group+'-feeding',food,'nutrients',1);
              spend(id,group+'-maintenance');
            } else {
              change(region,group,-1);
              s.detritus++;
              const cause=!s.water ? 'water' : !s.energy ? 'energy' : 'food';
              convert(id,group+'-mortality/'+cause,group,'detritus',1);
            }
          }
        }
        if (tick%profile.birthPeriod===0 && (residents.get(region)?.[group] ?? 0)>=2 && s.water && s.energy && foodAt(id) &&
            room(region)>(reserved.get(region) ?? 0)) {
          feed(id);
          change(region,group,1);
          convert(id,group+'-birth',food,group,1);
          spend(id,group+'-birth');
        }
        if (tick%profile.movePeriod || !s.energy || (residents.get(region)?.[group] ?? 0)<2) continue;
        for (const i of world.graph.incident[id]) {
          const cut=world.graph.boundaries[i], to=cut.from===id ? cut.to : cut.from;
          const port=world.ports.get(cut.id)![cut.from===id ? 1 : 0];
          const key=group+'/'+cut.id;
          if (used.has(key) || !pass(world,cut,id,group) || !stocks.get(to)?.water || !foodAt(to) ||
            (residents.get(port)?.[group] ?? 0)+1 >= residents.get(region)![group] || room(port)<=(reserved.get(port) ?? 0)) continue;
          change(region,group,-1);
          spend(id,group+'-migration');
          log.push({kind:'transfer',process:group+'-migration',from:id,to,amount:1,resource:group,connector:cut.id});
          used.add(key);
          incoming.push({region:port,group});
          reserved.set(port,(reserved.get(port) ?? 0)+1);
          break;
        }
      }
    }
    for (const arrival of incoming) change(arrival.region,arrival.group,1);
  };
  const {state:base,ledger}=stepMeta(world,previous.base,{occupied,afterMetabolism});
  return {state:{...previous,base,residents},ledger:[...ledger.slice(0,offset),...log,...ledger.slice(offset)]};
}
export function projectWeb(old:DispersalWorld,next:DispersalWorld,state:Web):Web {
  const changed={...state,base:projectMeta(old,next,state.base)};
  validate(next,changed);
  return changed;
}

const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function saveWeb(world:DispersalWorld,state:Web) {
  const data={version:'E1-D/1',base:saveMeta(world,state.base),founders:structuredClone(state.founders),
    residents:[...state.residents.keys()].sort().map(r=>[r,{...state.residents.get(r)!}] as const)};
  return {...data,signature:digest([profiles,data])};
}
export function restoreWeb(world:DispersalWorld,saved:ReturnType<typeof saveWeb>):Web {
  const {signature,...data}=saved;
  const legacy=data.version==='E1-C/1';
  const rules=legacy ? {prey:profiles.prey} : profiles;
  if ((!legacy && data.version!=='E1-D/1') || digest([rules,data])!==signature) throw new Error('Invalid food web snapshot');
  const initial=founderBudget(world,data.base.setup,data.founders,data.base.deposits);
  const residents=new Map(data.residents.map(([r,t])=>[r,legacy ? {...t,predator:0} : {...t}]));
  if (residents.size!==data.residents.length) throw new Error('Duplicate occupied region');
  const total=[...residents.values()].reduce((n,t)=>n+population(t),0);
  const base=restoreMetaWithMatter(world,data.base,total-initial);
  const state={base,residents,founders:Object.freeze(data.founders.map(f=>Object.freeze({...f})))};
  validate(world,state);
  return state;
}
