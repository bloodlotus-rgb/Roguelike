import { expect, it } from 'vitest';
import { trace } from './fixtures/e1a-trace';
import frames from './fixtures/e1a-frames.json';
import { updateBarrier } from './habitats';

it.each([
  ['audit', 'zero'], ['mansion', 'one'], ['estirpe', 'many'],
] as const)('replays E1-A accounts, ordered ledger and checkpoint each hour: %s/%s', (seed, active) => {
  const actual = trace(seed, active, (graph, id, state, rebuild) => {
    const updated = updateBarrier(graph, id, state, rebuild);
    const full = rebuild(new Map(graph.barriers).set(id, state));
    expect(updated).toEqual(full);
    return updated;
  });
  expect(actual).toEqual(frames[active]);
});
