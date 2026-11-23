import { createHash } from 'node:crypto';
import { type HabitatGraph } from './habitats.ts';
import { emptyStock, parameters, resources, resourceSignature } from './parameters.ts';

export const accounts = [...resources, 'detritivores'] as const;
export type Account = typeof accounts[number];
export type TrophicStock = Record<Account, number>;
export const emptyTrophicStock = (): TrophicStock => ({ ...emptyStock(), detritivores: 0 });
export const matter = ['detritus', 'nutrients', 'fungalBiomass', 'detritivores'] as const;

// Each detritivore is one indivisible unit of tissue. Fungal tissue uses the same mass unit.
export const biology = {
  maintenancePeriod: 6, fungalUnitsPerRation: 4, animalsPerRation: 2,
  maintenanceEnergy: 1, maintenanceFood: 1,
  mineralizationRate: 1, mineralizationEnergy: 1, fungalGrowthPeriod: 3, fungalGrowthEnergy: 1, fungalGrowthFood: 1, fungalGrowthNutrients: 1,
  detritivoreBirthPeriod: 4, birthFood: 1, birthEnergy: 2, evaporationPeriod: parameters.evaporationPeriod,
} as const;

// Gross input per upstream lot. Fines settling at the inlet are booked as a physical loss.
export const cargo = {
  groundwater: { water: 4, detritus: 0, energy: 0, settling: 0 },
  organicSediment: { water: 4, detritus: 3, energy: 2, settling: 1 },
} as const;
export interface TrophicScenario {
  seed: string;
  watershed: string;
  region: string;
  connector: string;
  founders: TrophicStock;
  source: { kind: keyof typeof cargo; rate: number; quota: number; activeHours: number; period: number } | null;
}

export function natural(value: number) { return Number.isSafeInteger(value) && value >= 0; }

export function inlet(graph: HabitatGraph, setup: TrophicScenario) {
  const site = graph.regionToHabitat.get(setup.region);
  const index = site === undefined ? undefined : graph.incident[site].find(i => {
    const cut = graph.boundaries[i];
    return cut.id === setup.connector && cut.kind === 'watercourse' && cut.from === site;
  });
  if (setup.seed !== graph.seed || typeof setup.watershed !== 'string' || !setup.watershed.trim() || index === undefined) {
    throw new Error('Missing declared watershed or upstream physical inlet');
  }
  return graph.boundaries[index];
}

export function validateScenario(graph: HabitatGraph, setup: TrophicScenario) {
  const cut = inlet(graph, setup);
  const f = setup.founders;
  if (!accounts.every(r => natural(f[r])) || f.detritivores + f.fungalBiomass > graph.habitats[cut.to].capacity) {
    throw new Error('Invalid founding deposit');
  }
  let budget = accounts.reduce((sum, r) => sum + f[r], 0);
  if (setup.source !== null) {
    const s = setup.source;
    if (!Object.hasOwn(cargo, s.kind) || ![s.quota, s.rate, s.period, s.activeHours].every(n => natural(n) && n > 0)
      || s.activeHours > s.period) throw new Error('Invalid source schedule or quota');
    const lot = cargo[s.kind];
    budget += s.quota * (lot.water + lot.detritus + lot.energy);
  }
  if (budget > parameters.inventoryLimit) throw new Error('Scenario exceeds inventory budget');
}

export function trophicSignature(setup: TrophicScenario) {
  const s = setup.source;
  const config = [setup.seed, setup.watershed, setup.region, setup.connector, accounts.map(r => setup.founders[r]),
    s && [s.kind, s.quota, s.rate, s.period, s.activeHours]];
  return createHash('sha256').update(JSON.stringify([1, resourceSignature(null), biology, cargo, accounts, config])).digest('hex');
}

/** Reproducible trial: an explicitly declared external basin at the first deep stream in physical cut order. */
export function watershedTrial(graph: HabitatGraph, policy: 'closed' | 'finite' | 'periodic'): TrophicScenario {
  const cut = graph.boundaries.find(c => c.kind === 'watercourse' && graph.habitats[c.from].zone > 0);
  if (!cut) throw new Error('No deep physical watercourse for seed ' + graph.seed);
  let region: string | undefined;
  for (const [key, id] of graph.regionToHabitat) {
    if (id === cut.from) { region = key; break; }
  }
  if (region === undefined) throw new Error('Missing upstream region');
  return { seed: graph.seed, watershed: 'upstream-' + cut.id, region, connector: cut.id,
    founders: { water: 24, detritus: 30, nutrients: 2, fungalBiomass: 4, energy: 20, detritivores: 2 },
    source: policy === 'closed' ? null : { kind: 'organicSediment', rate: 2,
      quota: policy === 'finite' ? 6 : 4096, period: 12, activeHours: 4 } };
}
