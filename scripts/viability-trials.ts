import { type HabitatGraph } from '../src/ecology/habitats.ts';
import { biology, watershedTrial } from '../src/ecology/trophic-contract.ts';

export const trials = ['closed', 'finite', 'periodic', 'control', 'outlet-control', 'half-rate', 'pulse',
  'fast-maintenance', 'slow-maintenance', 'groundwater'] as const;
export type Trial = typeof trials[number];

export function viabilityTrial(graph: HabitatGraph, name: Trial) {
  if (name === 'closed' || name === 'finite' || name === 'periodic') return watershedTrial(graph, name);
  const setup = watershedTrial(graph, 'periodic');
  // Six lots supply 12 energy and 12 accessible detritus per hour. The annual quota is finite.
  setup.source = { kind: name === 'groundwater' ? 'groundwater' : 'organicSediment', rate: 6,
    period: 1, activeHours: 1, quota: 6 * 8760 };
  setup.settlement = name === 'outlet-control' ? 'downstream' : 'upstream';
  if (name === 'half-rate') setup.source.rate /= 2;
  if (name === 'pulse') Object.assign(setup.source, { rate: 18, period: 12, activeHours: 4 });
  if (name === 'fast-maintenance') setup.maintenancePeriod = biology.maintenancePeriod / 2;
  if (name === 'slow-maintenance') setup.maintenancePeriod = biology.maintenancePeriod * 2;
  return setup;
}
