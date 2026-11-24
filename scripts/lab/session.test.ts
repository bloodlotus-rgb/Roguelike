import { setImmediate } from 'node:timers/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { createScenario, gate, passage, rooms } from './scenario.ts';
import { createSession } from './session.ts';

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
});
