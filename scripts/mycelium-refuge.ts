import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildDispersalWorld, type DispersalWorld } from '../src/ecology/dispersal-world.ts';
import { auditWeb, foundWeb, restoreWeb, saveWeb, stepWeb, type Founder } from '../src/ecology/food-web.ts';
import { enclosure } from './dispersal-trials.ts';

const hours = 8760;
function simulate(world: DispersalWorld, trial: ReturnType<typeof enclosure>, predators: number, refuge: boolean) {
  const founder = (group: Founder['group'], count: number): Founder =>
    ({group,count,region:trial.source,connector:trial.bridge,origin:'historical lateral entry'});
  const founders = [founder('prey',6)];
  if (predators) founders.push(founder('predator',predators));
  const initial = foundWeb(world,trial.setup,founders,refuge);
  auditWeb(world,null,initial.state,initial.ledger);
  let state = initial.state;
  let resumed: typeof state | undefined;
  const digest = createHash('sha256');
  const deaths: Record<string,number> = {};
  const preyBirths = [0,0,0,0];
  let grazedToZero=0, otherDepletions=0, regrowthFromOne=0, preyExtinction: number|null=null;
  const grazedRemnants=new Set<number>();
  let recoveredAfterGrazing=0, localPreyExtinctions=0;
  let predatorBirths=0, captures=0, predatorMouthHours=0, colocatedPreyHours=0;
  for (let hour=1;hour<=hours;hour++) {
    const next=stepWeb(world,state);
    auditWeb(world,state,next.state,next.ledger);
    digest.update(JSON.stringify(next.ledger)+'\n');
    if (resumed) {
      const replay=stepWeb(world,resumed);
      assert.deepEqual(replay.ledger,next.ledger);
      resumed=replay.state;
    }
    const fungal=new Map<number,number>();
    for (const entry of next.ledger) {
      const {resource,process,from,to,amount}=entry;
      if (resource==='fungalBiomass') {
        const id=(from ?? to)!;
        const before=fungal.get(id) ?? state.base.stocks.get(id)?.fungalBiomass ?? 0;
        const after=before+(from===null ? amount : -amount);
        fungal.set(id,after);
        if (before>0 && after===0) {
          if (process==='prey-feeding' || process==='prey-birth') grazedToZero++;
          else otherDepletions++;
        }
        if (before===1 && after>1 && process==='fungal-growth') {
          regrowthFromOne++;
          if (grazedRemnants.has(id)) recoveredAfterGrazing++;
        }
        if (after!==1) grazedRemnants.delete(id);
        else if (process==='prey-feeding' || process==='prey-birth') grazedRemnants.add(id);
      }
      if (entry.kind!=='conversion' || from===null) continue;
      if (process==='prey-birth') preyBirths[Math.floor((hour-1)/2190)]+=amount;
      if (process==='predator-birth') predatorBirths+=amount;
      if (resource==='prey' && (process==='predator-feeding' || process==='predator-birth')) captures+=amount;
      if (process.includes('-mortality/')) deaths[process]=(deaths[process] ?? 0)+amount;
    }
    const previousSites=new Set<number>();
    for (const [region,t] of state.residents) if (t.prey) previousSites.add(world.graph.regionToHabitat.get(region)!);
    state=next.state;
    let preyCount=0;
    for (const [region,t] of state.residents) {
      preyCount+=t.prey;
      if (t.prey) previousSites.delete(world.graph.regionToHabitat.get(region)!);
      if (!t.predator) continue;
      predatorMouthHours+=t.predator;
      const id=world.graph.regionToHabitat.get(region)!;
      if (world.members[id].some(r=>state.residents.get(r)?.prey)) colocatedPreyHours+=t.predator;
    }
    localPreyExtinctions+=previousSites.size;
    if (!preyCount && preyExtinction===null) preyExtinction=hour;
    if (hour===48 || hour===hours/2) {
      const saved=saveWeb(world,state);
      if (resumed) assert.deepEqual(saveWeb(world,resumed),saved);
      resumed=restoreWeb(world,JSON.parse(JSON.stringify(saved)));
    }
  }
  const final=saveWeb(world,state);
  assert.deepEqual(saveWeb(world,resumed!),final);
  if (refuge) assert.equal(grazedToZero,0);
  const census=[...state.residents.values()];
  return {seed:world.graph.seed,space:world===trial.open?'recinto':'edificio',predators,refuge,hours,lots:state.base.lotsUsed,
    grazedToZero,otherDepletions,regrowthFromOne,recoveredAfterGrazing,localPreyExtinctions,deaths,preyBirths,preyExtinction,
    prey:census.reduce((n,t)=>n+t.prey,0),pairs:census.reduce((n,t)=>n+Math.floor(t.prey/2),0),
    predatorBirths,captures,predatorsFinal:census.reduce((n,t)=>n+t.predator,0),predatorMouthHours,colocatedPreyHours,
    ledgerHash:digest.digest('hex'),snapshotHash:final.signature};
}
for (const seed of ['mansion','estirpe','zz']) {
  const building=buildDispersalWorld(seed);
  const trial=enclosure(building);
  for (const predators of [0,2]) for (const world of [trial.open,building]) for (const refuge of [false,true]) {
    console.log(JSON.stringify(simulate(world,trial,predators,refuge)));
  }
}
