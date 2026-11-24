import { foodBalances, foodLedgerDigest, stepFoodChain } from '../../src/ecology/chemical-food-chain.ts';
import { preyMaintenance, regionHabitat, type FoodChainState } from '../../src/ecology/chemical-food-contract.ts';
import { projectFoodChain, readFoodChainSnapshot, restoreFoodChain, saveFoodChain } from '../../src/ecology/chemical-food-snapshot.ts';
import { readChemicalSnapshot } from '../../src/ecology/chemical-snapshot.ts';
import { changeDispersalBarrier, type DispersalWorld } from '../../src/ecology/dispersal-world.ts';
import { channelLimit } from '../../src/ecology/transport.ts';
import { createScenario, gate, hourInput, passage, rooms, rules, scenarioId, seed, source, sources } from './scenario.ts';

const saveVersion = 'estirpe-lab/1';
// A short lab run covers all six source pulses. Barrier projections cost more than a tick.
export const replayBudget = { actions: 24, hours: 36, barriers: 8 } as const;

type Action =
  | { kind: 'advance'; hours: 1 | 6 }
  | { kind: 'barrier'; connector: typeof passage | typeof gate; state: 'open' | 'closed' };
type Report = ReturnType<typeof stepFoodChain>;
type Hour = { kind: 'hour'; hour: number; digest: string; audit: Report['audit'];
  flows: Report['cutFlows']; entries: Report['entries']; feeding: NonNullable<Report['feedingDecisions']> };
type Barrier = { kind: 'barrier'; hour: number; connector: Extract<Action, { kind: 'barrier' }> };
type Journal = Hour | Barrier;
type Run = { world: DispersalWorld; state: FoodChainState; journal: Journal[]; actions: Action[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAction(value: unknown): Action {
  if (isRecord(value)) {
    if (value.kind === 'advance' && (value.hours === 1 || value.hours === 6)) {
      return { kind: 'advance', hours: value.hours };
    }
    if (value.kind === 'barrier' && (value.connector === passage || value.connector === gate) &&
        (value.state === 'open' || value.state === 'closed')) {
      return { kind: 'barrier', connector: value.connector, state: value.state };
    }
  }
  throw new Error('Comando inválido.');
}

function checkReplayBudget(length: number, hours: number, barriers: number) {
  if (length > replayBudget.actions || hours > replayBudget.hours || barriers > replayBudget.barriers) {
    throw new Error(`El historial supera el presupuesto de reproducción (${replayBudget.actions} acciones, ${replayBudget.hours} h o ${replayBudget.barriers} maniobras de barrera).`);
  }
}

export function totals(world: DispersalWorld, state: FoodChainState) {
  const result = { matter: 0n, water: 0n, chemicalEnergy: 0n, heat: 0n };
  for (const row of foodBalances(world, state).values()) {
    result.matter += row.matter;
    result.water += row.water;
    result.chemicalEnergy += row.chemicalEnergy;
  }
  for (const heat of state.chemical.heat.values()) result.heat += BigInt(heat);
  return result;
}

function apply(run: Run, action: Action): Run {
  let { world, state } = run;
  const events: Journal[] = [];
  if (action.kind === 'barrier') {
    const cut = world.graph.boundaries.find(edge => edge.id === action.connector);
    if (!cut || cut.state === action.state) throw new Error('La barrera ya está en ese estado o no está disponible.');
    const next = changeDispersalBarrier(world, action.connector, action.state);
    const projected = projectFoodChain(world, next, sources, rules, state);
    const before = totals(world, state), after = totals(next, projected);
    if (before.matter !== after.matter || before.water !== after.water || before.chemicalEnergy !== after.chemicalEnergy ||
        before.heat !== after.heat || projected.chemical.lotsUsed.get(source.id) !== state.chemical.lotsUsed.get(source.id)) {
      throw new Error('La maniobra no conservó el inventario o la cuota.');
    }
    world = next;
    state = projected;
    events.push({ kind: 'barrier', hour: state.chemical.tick, connector: action });
  } else {
    for (let i = 0; i < action.hours; i++) {
      const report = stepFoodChain(world, sources, rules, state, hourInput(world, state));
      state = report.state;
      events.push({ kind: 'hour', hour: state.chemical.tick, digest: foodLedgerDigest(report),
        audit: report.audit, flows: report.cutFlows, entries: report.entries, feeding: report.feedingDecisions ?? [] });
    }
  }
  return { world, state, journal: [...run.journal, ...events].slice(-48), actions: [...run.actions, action] };
}

export function createSession(opening = createScenario()) {
  const reset = (): Run => ({ world: opening.world, state: opening.initial, journal: [], actions: [] });
  let run = reset(), revision = 0;

  function view() {
    const { world, state, journal } = run, { graph } = world;
    const lastFeeding = new Map<number, { hour: number; decision: Hour['feeding'][number] }>();
    for (const event of journal) {
      if (event.kind === 'hour') for (const decision of event.feeding) lastFeeding.set(decision.animal, { hour: event.hour, decision });
    }
    const visible = rooms.map(room => {
      const habitat = regionHabitat(world, room.region);
      return { ...room, habitat, depth: graph.habitats[habitat].depthM, area: graph.habitats[habitat].areaM2,
        stock: state.chemical.inventory.get(habitat) ?? { detritus: { matter: 0, chemicalEnergy: 0 }, water: 0, mineralMatter: 0 },
        fungus: state.fungus.get(habitat) ?? null,
        animals: [...state.animals.values()].filter(animal => animal.region === room.region).map(animal => ({
          ...animal, age: state.chemical.tick - animal.bornAt, mature: state.chemical.tick - animal.bornAt >= rules.prey.birth.adultAge,
          adultMatter: rules.prey.physiology?.adultMatter, maintenance: Number(preyMaintenance(rules.prey, animal.body.matter)),
          feeding: lastFeeding.get(animal.id) ?? null,
        })) };
    });
    const indices = new Set(visible.flatMap(room => graph.incident[room.habitat]));
    const connections = [...indices].sort((a, b) => a - b).map(index => {
      const cut = graph.boundaries[index];
      return { ...cut, regions: world.ports.get(cut.id)!, detritusLimits: [cut.from, cut.to].map(from => channelLimit(graph, cut, from, 'detritus')) };
    });
    return { revision, seed, hour: state.chemical.tick, rooms: visible, connections, journal,
      source: { used: state.chemical.lotsUsed.get(source.id) ?? 0, quota: source.quotaLots, period: source.periodHours },
      totals: totals(world, state), passage, gate };
  }

  function save() {
    checkReplayBudget(run.actions.length, run.state.chemical.tick, run.actions.filter(action => action.kind === 'barrier').length);
    return { version: saveVersion, scenario: scenarioId, seed, actions: run.actions.slice(),
      snapshot: saveFoodChain(run.world, sources, rules, run.state) };
  }

  function load(value: unknown) {
    if (!isRecord(value) || value.version !== saveVersion || value.scenario !== scenarioId || value.seed !== seed || !Array.isArray(value.actions)) {
      throw new Error('Archivo incompatible con este escenario.');
    }
    const snapshot = readFoodChainSnapshot(value.snapshot);
    const { accounts: [savedHour] } = readChemicalSnapshot(snapshot.chemical);
    checkReplayBudget(value.actions.length, savedHour, 0);
    const actions = value.actions.map(parseAction);
    let hours = 0, barriers = 0;
    for (const action of actions) {
      if (action.kind === 'advance') hours += action.hours;
      else barriers++;
    }
    checkReplayBudget(actions.length, hours, barriers);
    if (hours !== savedHour) throw new Error('El guardado y el registro de comandos divergen.');
    const replay = actions.reduce(apply, reset());
    const state = restoreFoodChain(replay.world, sources, rules, snapshot);
    if (saveFoodChain(replay.world, sources, rules, state).integrity !==
        saveFoodChain(replay.world, sources, rules, replay.state).integrity) {
      throw new Error('El guardado y el registro de comandos divergen.');
    }
    return { ...replay, state };
  }

  function dispatch(body: unknown) {
    if (!isRecord(body) || body.revision !== revision || !isRecord(body.action)) {
      throw new Error('Revisión del laboratorio desactualizada. Actualizá la vista.');
    }
    const { action } = body;
    run = action.kind === 'reset' ? reset() : action.kind === 'load' ? load(action.save) : apply(run, parseAction(action));
    revision++;
    return view();
  }

  return { view, dispatch, save };
}
