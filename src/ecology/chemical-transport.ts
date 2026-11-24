import type { DispersalWorld } from './dispersal-world.ts';
import { emptyStock, type Channel } from './parameters.ts';
import { channelLimit } from './transport.ts';
import type { ChemicalInventory, ChemicalState, ChemicalTransfer } from './chemical-ledger.ts';

export const chemicalTransportRules = {
  revision: 2, phase: 'before external and local transactions', mixing: 'homogeneous detritus per habitat',
  flux: 'historical material gradient and cut limits', allocation: 'largest remainder in canonical order',
  projection: 'material by fine-region overlap, energy by allocated detritus',
} as const;
export const compareChemicalIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Exact apportionment. Weights arrive in canonical tie-breaking order. */
export function apportion(amount: number, weights: readonly number[]) {
  const denominator = weights.reduce((n, w) => n + BigInt(w), 0n);
  if (!denominator) {
    if (amount) throw new Error('Cannot apportion without a carrier');
    return weights.map(() => 0);
  }
  const parts = weights.map((weight, index) => {
    const product = BigInt(amount) * BigInt(weight);
    return { index, amount: product / denominator, remainder: product % denominator };
  });
  const ranked = [...parts].sort((a,b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  const missing = BigInt(amount) - parts.reduce((sum, part) => sum + part.amount, 0n);
  for (let i = 0; i < Number(missing); i++) ranked[i].amount++;
  return parts.map(part => Number(part.amount));
}

export function planChemicalTransport(world: DispersalWorld, state: ChemicalState): ChemicalTransfer[] {
  if (state.topology !== world.graph.signature) throw new Error('Wrong chemical geometry epoch');
  const { graph } = world;
  const stock = new Map([...state.inventory].map(([id, s]) => [id, {
    ...emptyStock(), detritus: s.detritus.matter, nutrients: s.mineralMatter, water: s.water,
  }]));
  const none = emptyStock(), remaining = new Map([...stock].map(([id,s]) => [id,{...s}]));
  const proposed = new Map<number, ChemicalTransfer[]>();
  const transfers: ChemicalTransfer[] = [];
  const cuts = new Set<number>();
  for (const id of stock.keys()) for (const index of graph.incident[id]) cuts.add(index);
  const channels = ['water', 'detritus', 'nutrients'] as const satisfies readonly Channel[];
  for (const index of [...cuts].sort((a,b) => compareChemicalIds(graph.boundaries[a].id, graph.boundaries[b].id))) {
    const cut = graph.boundaries[index];
    const a = stock.get(cut.from) ?? none, b = stock.get(cut.to) ?? none;
    const left = graph.habitats[cut.from], right = graph.habitats[cut.to];
    const lc = BigInt(left.capacity), rc = BigInt(right.capacity);
    for (const resource of channels) {
      const signed = right.depthM > left.depthM ? BigInt(a[resource]) : right.depthM < left.depthM ? -BigInt(b[resource])
        : (BigInt(a[resource]) * rc - BigInt(b[resource]) * lc) / (lc + rc);
      if (!signed) continue;
      const [fromHabitat, toHabitat] = signed > 0n ? [cut.from, cut.to] : [cut.to, cut.from];
      const connector = cut.id;
      const limit = channelLimit(graph, cut, fromHabitat, resource);
      if (!limit || (resource === 'nutrients' && !(stock.get(fromHabitat)?.water))) continue;
      const magnitude = signed > 0n ? signed : -signed;
      const offer = Math.min(limit, Number(magnitude));
      const donor = remaining.get(fromHabitat)!;
      const amount = Math.min(donor[resource], offer);
      if (!amount) continue;
      donor[resource] -= amount;
      const cargo: ChemicalInventory = {
        detritus: { matter: resource === 'detritus' ? amount : 0, chemicalEnergy: 0 },
        water: resource === 'water' ? amount : 0,
        mineralMatter: resource === 'nutrients' ? amount : 0,
      };
      const transfer: ChemicalTransfer = { kind: 'transfer', process: 'passive transport', tick: state.tick + 1,
        transactionId: JSON.stringify(['transport', connector, resource]), fromHabitat, toHabitat, connector, cargo };
      transfers.push(transfer);
      if (resource === 'detritus') {
        const list = proposed.get(fromHabitat) ?? [];
        list.push(transfer);
        proposed.set(fromHabitat,list);
      }
    }
  }
  for (const [id, list] of proposed) {
    const weights = [...list.map(t => t.cargo.detritus.matter), remaining.get(id)!.detritus];
    const shares = apportion(state.inventory.get(id)!.detritus.chemicalEnergy, weights);
    list.forEach((t, i) => { t.cargo = {...t.cargo, detritus:{...t.cargo.detritus, chemicalEnergy:shares[i]}}; });
  }
  return transfers;
}
