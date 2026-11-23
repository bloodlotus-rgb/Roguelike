import { createHash } from 'node:crypto';
import { assembleZone, Face } from '../../core/jenga.ts';
import { extractGraph, type State } from '../../core/spatial.ts';
import { type Structure } from '../../core/structure.ts';
import { audit } from '../audit.ts';
import { deriveHabitats, type HabitatGraph } from '../habitats.ts';
import { emptyStock } from '../parameters.ts';
import { initialState, reaggregate, restore, snapshot, step, totals } from '../resources.ts';

type Rebuild = (states: ReadonlyMap<string, State>) => HabitatGraph;
type Update = (graph: HabitatGraph, id: string, state: State, rebuild: Rebuild) => HabitatGraph;

/** Small physical zones with prescribed aperture types to exercise E1-A's boundary rules. */
export function trace(seed: string, active: 'zero' | 'one' | 'many', update?: Update) {
  const zone = assembleZone({ seed, zone: 0, width: 20, depth: 20, storeys: 4, arrival: [10, 10], exit: false });
  const entrance = { zone: 0, block: zone.arrival, cell: zone.blocks[zone.arrival].at, face: Face.Up };
  const structure: Structure = { seed, entrance, origin: entrance, passages: [], zones: [zone] };
  const fine = extractGraph(structure);
  const [gate, inlet] = [...fine.edges.values()].filter(e => e.from !== e.to);
  gate.kind = 'gate';
  gate.state = 'closed';
  inlet.kind = 'watercourse';
  const rebuild: Rebuild = states => deriveHabitats(structure, fine, states);
  let graph = rebuild(new Map());
  const mixed = [...fine.edges.values()].find(e => graph.regionToHabitat.get(e.from) === graph.regionToHabitat.get(e.to))!;
  let state = initialState(active !== 'many', active === 'many' ? { seed, region: inlet.from, connector: inlet.id,
    watershed: 'arroyo', period: 3, activeHours: 1, rate: 9 } : null);
  if (active === 'one') state.stocks.set(graph.regionToHabitat.get(inlet.from)!, { ...emptyStock(), water: 1 });
  if (active === 'many') {
    state.tick = 236;
    for (let i = graph.habitats.length - 1; i >= 0; i -= 2) {
      state.stocks.set(i, { water: i % 7, nutrients: i % 9, detritus: i % 14, energy: i % 13, fungalBiomass: i % 5 });
    }
  }
  const frames: string[] = [];
  const changes = new Map<number, [string, State]>([[1, [gate.id, 'destroyed']], [3, [gate.id, 'flooded']],
    [5, [mixed.id, 'blocked']], [8, [mixed.id, 'open']], [10, [gate.id, 'closed']]]);
  for (let hour = 0; hour < 12; hour++) {
    const change = changes.get(hour);
    if (change) {
      const [id, status] = change;
      const next = update ? update(graph, id, status, rebuild) : rebuild(new Map(graph.barriers).set(id, status));
      state = reaggregate(graph, next, state);
      graph = next;
    }
    const previous = state;
    const next = step(graph, previous);
    state = next.state;
    const saved = snapshot(graph, state);
    // The digest includes each ordered posting (including connector), not just global totals.
    const frame = [saved, [...state.stocks], totals(state.stocks), next.ledger, audit(previous.stocks, state.stocks, next.ledger)];
    frames.push(createHash('sha256').update(JSON.stringify(frame)).digest('hex'));
    if (hour === 6) state = restore(graph, JSON.parse(JSON.stringify(saved)));
  }
  return frames;
}
