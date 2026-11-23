import type { Kind } from '../core/spatial.ts';

// Integer quanta per ecological hour. Calibration fixture, versioned with the model.
export const parameters = {
  maxMixedCells: 8,
  capacityPerCell: 36,
  dryHumidity: 0.2,
  wetHumidity: 0.85,
  surfaceTicks: 240,
  runoff: 24,
  litter: 12,
  irradiance: 10,
  mineralize: 2,
  growth: 2,
  detritusPerGrowth: 2,
  nutrientsPerGrowth: 1,
  energyPerGrowth: 1,
  respirationPeriod: 4,
  evaporationPeriod: 6,
  // Upper bound per stock and total initial inventory, keeping the ledger exactly integral.
  inventoryLimit: 1_000_000_000,
} as const;

export const resources = ['water', 'detritus', 'nutrients', 'fungalBiomass', 'energy'] as const;
export type Resource = typeof resources[number];
export type Stock = Record<Resource, number>;
export const emptyStock = (): Stock => ({ water: 0, detritus: 0, nutrients: 0, fungalBiomass: 0, energy: 0 });
export const channels = ['water', 'detritus', 'nutrients', 'energy'] as const;
export type Channel = typeof channels[number];

// Max quanta per cut per hour in channel order: water, detritus, nutrients, energy.
export const conductance: Record<Kind, readonly [number, number, number, number]> = {
  interior: [2, 1, 1, 2], opening: [2, 1, 1, 2], stairs: [4, 2, 1, 2],
  gate: [0, 0, 0, 1], fissure: [2, 0, 1, 1], duct: [2, 1, 1, 2],
  shaft: [6, 3, 2, 2], watercourse: [12, 4, 4, 1],
};
export const flooded = [8, 3, 3, 1] as const;
