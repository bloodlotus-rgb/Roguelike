import { expect, it } from 'vitest';
import { auditTrophic, metabolize } from './trophic';
import { emptyTrophicStock, type TrophicStock } from './trophic-contract';

const ready = { ...emptyTrophicStock(), fungalBiomass:1, water:2, energy:2, nutrients:1, detritus:1 };
function observed(stock: TrophicStock, tick: number, capacity: number, priority: boolean) {
  const closing = {...stock};
  const ledger: Parameters<typeof metabolize>[5] = [];
  metabolize(closing,0,tick,capacity,6,ledger,priority);
  auditTrophic(new Map([[0,stock]]),new Map([[0,closing]]),ledger);
  return {closing,ledger};
}

it('allocates the last detritus once and pays the actual growth cost', () => {
  const original = observed(ready,3,8,false), variant = observed(ready,3,8,true);
  expect(original.closing).toEqual({...ready, detritus:0, nutrients:2, energy:1});
  expect(variant.closing).toEqual({...ready, detritus:0, nutrients:0, energy:1, fungalBiomass:3});
  expect(variant.ledger.map(e=>e.process)).toEqual(Array(5).fill('fungal-growth'));
});

const controls: [string, Partial<TrophicStock>, number, number][] = [
  ['no nutrients', {nutrients:0}, 3, 8], ['no founder', {fungalBiomass:0}, 3, 8],
  ['no water', {water:0}, 3, 8], ['no energy', {energy:0}, 3, 8],
  ['no detritus', {detritus:0}, 3, 8], ['no space', {}, 3, 2],
  ['off schedule', {}, 2, 8], ['both processes affordable', {detritus:2}, 3, 8],
  ['only energy competes', {detritus:2, energy:1}, 3, 8],
  ['maintenance uses the last substrate', {}, 6, 8],
  ['mineralization supplies the missing nutrient', {detritus:2, nutrients:0}, 3, 8],
];
it.each(controls)('keeps the ordered historical ledger for %s', (_, changes, tick, capacity) => {
  const stock = {...ready,...changes};
  expect(observed(stock,tick,capacity,true)).toEqual(observed(stock,tick,capacity,false));
});
