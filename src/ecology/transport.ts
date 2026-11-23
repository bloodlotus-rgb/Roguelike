import type { Boundary, HabitatGraph } from './habitats.ts';
import { channels, conductance, flooded, type Channel, type Stock } from './parameters.ts';

export interface Flux { from: number; to: number; resource: Channel; amount: number; connector: string }

/** Directed structural capacity. Actual flux also requires stock and a driving gradient. */
export function channelLimit(graph: HabitatGraph, cut: Boundary, from: number, resource: Channel): number {
  if (from !== cut.from && from !== cut.to) return 0;
  if (cut.state === 'blocked' || cut.state === 'closed') return 0;
  if (cut.kind === 'watercourse' && from !== cut.from) return 0;
  const to = from === cut.from ? cut.to : cut.from;
  if (resource !== 'energy' && graph.habitats[from].depthM > graph.habitats[to].depthM) return 0;
  const rates = cut.state === 'flooded' ? flooded : conductance[cut.kind];
  return rates[channels.indexOf(resource)];
}

/** Potential paths with all donors supplied, independent of the current resource inventory. */
export function channelReach(graph: HabitatGraph, start: number, resource: Channel): number[] {
  const queue = [start];
  const visited = new Set(queue);
  for (const from of queue) {
    for (const i of graph.incident[from]) {
      const cut = graph.boundaries[i];
      const to = from === cut.from ? cut.to : cut.from;
      if (visited.has(to) || !channelLimit(graph, cut, from, resource)) continue;
      visited.add(to);
      queue.push(to);
    }
  }
  return queue;
}

/** Proposals use the same phase-start stocks. Vertical mass transfer is downhill only. */
export function fluxes(graph: HabitatGraph, cut: Boundary, a: Stock, b: Stock): Flux[] {
  if (cut.state === 'closed' || cut.state === 'blocked') return [];
  const upper = graph.habitats[cut.from], lower = graph.habitats[cut.to];
  const downhill = Math.sign(lower.depthM - upper.depthM);
  const result: Flux[] = [];
  for (const resource of channels) {
    const gradient = (a[resource] * lower.capacity - b[resource] * upper.capacity) / (upper.capacity + lower.capacity);
    let signed = Math.trunc(gradient);
    if (resource !== 'energy' && downhill) signed = downhill > 0 ? a[resource] : -b[resource];
    if (!signed) continue;
    const forward = signed > 0;
    const limit = channelLimit(graph, cut, forward ? cut.from : cut.to, resource);
    if (!limit) continue;
    const donor = forward ? a : b;
    if (resource === 'nutrients' && !donor.water) continue;
    result.push({ from: forward ? cut.from : cut.to, to: forward ? cut.to : cut.from,
      resource, amount: Math.min(Math.abs(signed), limit), connector: cut.id });
  }
  return result;
}
