import { setImmediate } from 'node:timers/promises';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createScenario, gate, passage, rooms, rules, sources } from './scenario.ts';
import * as foodChain from '../../src/ecology/chemical-food-chain.ts';
import { chemicalDigest } from '../../src/ecology/chemical-ledger.ts';
import { saveFoodChain } from '../../src/ecology/chemical-food-snapshot.ts';
import * as dispersal from '../../src/ecology/dispersal-world.ts';
import { createSession, replayBudget } from './session.ts';

let opening: ReturnType<typeof createScenario>;
beforeAll(() => { opening = createScenario(); }, 60_000);
type Session = ReturnType<typeof createSession>;
type View = ReturnType<Session['view']>;
const command = (session: Session, action: unknown) => session.dispatch({ revision: session.view().revision, action });
async function advance(session: Session, hours: 1 | 6 = 6) {
  // Let the test worker flush progress messages between full-building commands.
  await setImmediate();
  return command(session, { kind: 'advance', hours });
}
const barrier = (session: Session, connector: string, state: string) => command(session, { kind: 'barrier', connector, state });
const hours = (view: View) => view.journal.filter(event => event.kind === 'hour');
const receiver = (view: View) => view.rooms.find(room => room.region === rooms[2].region)!;
const detritusCrossings = (view: View, first: number, last: number) => hours(view)
  .filter(event => event.hour >= first && event.hour <= last)
  .flatMap(event => event.flows.passive.filter(flow => flow.connector === passage && flow.cargo.detritus.matter > 0));

describe('Jenga ecology lab', () => {
  it('observes transport, a closure with no alternative, and renewed transport on reopening', async () => {
    const control = createSession(opening), intervention = createSession(opening);
    const first = await advance(control), sameFirst = await advance(intervention);
    expect(sameFirst).toEqual(first);
    expect(detritusCrossings(first, 1, 1)).toEqual([]);
    expect(detritusCrossings(first, 2, 2)[0]?.cargo.detritus).toEqual({ matter: 1, chemicalEnergy: 192 });
    expect(first.journal.some(event => event.kind === 'hour' && event.feeding.some(decision => decision.bite > 0))).toBe(true);

    const shut = barrier(intervention, passage, 'closed');
    expect(shut.hour).toBe(6);
    expect(shut.totals).toEqual(sameFirst.totals);
    expect(shut.source).toEqual(sameFirst.source);
    const control12 = await advance(control), closed12 = await advance(intervention);
    expect(detritusCrossings(control12, 7, 12)).toHaveLength(4);
    expect(detritusCrossings(closed12, 7, 12)).toEqual([]);
    expect(control12.source.used).toBe(32);
    expect(closed12.source.used).toBe(32);
    expect(receiver(control12).fungus).toMatchObject({ matter: 15, chemicalEnergy: 335 });
    expect(receiver(closed12).fungus).toMatchObject({ matter: 13, chemicalEnergy: 217 });
    expect(receiver(closed12).animals.map(animal => animal.region)).toEqual([rooms[2].region, rooms[2].region]);

    const reopened = barrier(intervention, passage, 'open');
    expect(reopened.totals).toEqual(closed12.totals);
    const after = await advance(intervention, 1);
    expect(detritusCrossings(after, 13, 13)[0]?.cargo.detritus).toEqual({ matter: 1, chemicalEnergy: 192 });
    for (const view of [control12, after]) {
      for (const { audit: { opening, closing, imported, exported, dissipated } } of hours(view)) {
        expect(opening.matter + imported.matter).toBe(closing.matter + exported.matter);
        expect(opening.water + imported.water).toBe(closing.water + exported.water);
        expect(opening.chemicalEnergy + imported.chemicalEnergy).toBe(closing.chemicalEnergy + exported.chemicalEnergy + dissipated);
      }
      expect(view.totals.water).toBe(2n);
    }
  }, 60_000);

  it('replays a closed-epoch save with the real iron gate open, and preserves the journal after continuing', async () => {
    const original = createSession(opening), resumed = createSession(opening);
    await advance(original);
    const before = barrier(original, passage, 'closed');
    const openGate = barrier(original, gate, 'open');
    expect(openGate.hour).toBe(before.hour);
    expect(openGate.totals).toEqual(before.totals);
    expect(openGate.connections.find(edge => edge.id === gate)).toMatchObject({ kind: 'gate', state: 'open', detritusLimits: [0, 0] });
    await advance(original);
    const saved = JSON.parse(JSON.stringify(original.save()));
    await setImmediate();
    const loaded = command(resumed, { kind: 'load', save: saved });
    expect(resumed.save()).toEqual(saved);
    expect(loaded.journal).toEqual(original.view().journal);
    expect(detritusCrossings(loaded, 7, 12)).toEqual([]);
    for (const session of [original, resumed]) {
      await setImmediate();
      barrier(session, passage, 'open');
    }
    expect((await advance(resumed)).journal).toEqual((await advance(original)).journal);
    expect(resumed.save()).toEqual(original.save());
    expect(command(resumed, { kind: 'reset' })).toMatchObject({ hour: 0, journal: [] });
    expect(resumed.save()).toEqual(createSession(opening).save());
  }, 60_000);

  it('rejects stale and invalid commands and an inconsistent restore without changing live state', async () => {
    const session = createSession(opening);
    await advance(session, 1);
    const before = session.view(), saved = session.save();
    expect(() => session.dispatch({ revision: 0, action: { kind: 'advance', hours: 6 } })).toThrow(/desactualizada/);
    expect(() => barrier(session, 'invented', 'closed')).toThrow(/inválido/);
    expect(() => barrier(session, passage, 'open')).toThrow(/ese estado/);
    expect(() => command(session, { kind: 'advance', hours: -1 })).toThrow(/inválido/);
    expect(() => command(session, { kind: 'load', save: { ...saved, actions: [] } })).toThrow(/divergen/);
    expect(() => command(session, { kind: 'load', save: { ...saved, snapshot: { ...saved.snapshot, integrity: 'wrong' } } })).toThrow(/integrity/);
    expect(session.view()).toEqual(before);
    expect(session.save()).toEqual(saved);
  }, 60_000);

  it('checks snapshot structure, versions, and both digests before replay without changing the session', () => {
    const session = createSession(opening);
    const saved = session.save(), before = session.view();
    const { integrity: _integrity, ...payload } = saved.snapshot;
    const { integrity: _chemicalIntegrity, ...chemical } = payload.chemical;
    const resign = (snapshot: Record<string, unknown>) => ({ ...snapshot, integrity: chemicalDigest(snapshot) });
    const actions = [{ kind: 'advance', hours: 1 }];
    const step = vi.spyOn(foodChain, 'stepFoodChain');
    try {
      const invalid = [
        [null, /food-chain snapshot version/i],
        [{ ...saved.snapshot, version: 'unknown' }, /food-chain snapshot version/i],
        [{ ...saved.snapshot, integrity: 'tampered' }, /food-chain snapshot integrity/i],
        [resign({ ...payload, fungus: [[0, null]] }), /food-chain snapshot structure/i],
        [resign({ ...payload, chemical: { ...payload.chemical, version: 'unknown' } }), /chemical snapshot version/i],
        [resign({ ...payload, chemical: { ...payload.chemical, integrity: 'tampered' } }), /chemical snapshot integrity/i],
        [resign({ ...payload, chemical: resign({ ...chemical, accounts: [0, [[0]], [], []] }) }), /chemical snapshot structure/i],
      ] as const;
      for (const [snapshot, error] of invalid) {
        expect(() => command(session, { kind: 'load', save: { ...saved, actions, snapshot } })).toThrow(error);
      }
      expect(step).not.toHaveBeenCalled();
      expect(session.view()).toEqual(before);
      expect(session.save()).toEqual(saved);
    } finally {
      step.mockRestore();
    }
  });

  it('rejects excessive action, hour, and barrier budgets before any engine work', () => {
    const session = createSession(opening);
    const saved = session.save(), before = session.view();
    const step = vi.spyOn(foodChain, 'stepFoodChain');
    const change = vi.spyOn(dispersal, 'changeDispersalBarrier');
    try {
      const excessiveHistories = [
        Array.from({ length: replayBudget.actions + 1 }, () => ({ kind: 'advance', hours: 1 })),
        Array.from({ length: Math.floor(replayBudget.hours / 6) + 1 }, () => ({ kind: 'advance', hours: 6 })),
        Array.from({ length: replayBudget.barriers + 1 }, (_, i) => ({
          kind: 'barrier', connector: passage, state: i % 2 ? 'open' : 'closed',
        })),
      ];
      for (const actions of excessiveHistories) {
        expect(() => command(session, { kind: 'load', save: { ...saved, actions } })).toThrow(/presupuesto de reproducción/);
      }
      expect(step).not.toHaveBeenCalled();
      expect(change).not.toHaveBeenCalled();
      expect(session.view()).toEqual(before);
      expect(session.save()).toEqual(saved);
    } finally {
      step.mockRestore();
      change.mockRestore();
    }
  });

  it('compares a structurally valid snapshot against the replay at the same hour and geometry', () => {
    const session = createSession(opening);
    const saved = session.save(), before = session.view();
    const { initial, world } = opening;
    const inventory = new Map(initial.chemical.inventory);
    for (const [id, stock] of inventory) inventory.set(id, { ...stock, water: stock.water + 1 });
    const different = { ...initial, chemical: { ...initial.chemical, inventory } };
    const snapshot = saveFoodChain(world, sources, rules, different);
    expect(() => command(session, { kind: 'load', save: { ...saved, snapshot } })).toThrow(/divergen/);
    expect(session.view()).toEqual(before);
    expect(session.save()).toEqual(saved);
    expect(command(session, { kind: 'load', save: saved })).toEqual({ ...before, revision: before.revision + 1 });
  });
});
