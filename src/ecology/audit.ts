import { emptyStock, resources, type Stock } from './parameters.ts';
import { type Entry, type Inventory } from './resources.ts';

export function ledgerSummary() {
  return { sources: emptyStock(), sinks: emptyStock(), converted: emptyStock(), transported: emptyStock() };
}

/** Reconcile individual accounts, then independently check matter, energy and water budgets. */
export function audit(before: Inventory, after: Inventory, entries: Entry[]) {
  const summary = ledgerSummary();
  const accounts = new Map([...before].map(([id, s]) => [id, { ...s }]));
  const zero = emptyStock();
  function book(id: number, r: keyof Stock, change: number) {
    if (!accounts.has(id)) accounts.set(id, emptyStock());
    const stock = accounts.get(id)!;
    stock[r] += change;
    if (!Number.isSafeInteger(stock[r]) || stock[r] < 0) throw new Error('Invalid ledger balance');
  }
  for (const e of entries) {
    if (!Number.isSafeInteger(e.amount) || e.amount <= 0) throw new Error('Invalid ledger amount');
    const input = e.from === null && e.to !== null;
    const output = e.to === null && e.from !== null;
    if ((e.kind === 'source' && !input) || (e.kind === 'sink' && !output) ||
        (e.kind === 'conversion' && !input && !output) ||
        (e.kind === 'transfer' && (e.from === null || e.to === null || e.from === e.to || !e.connector))) {
      throw new Error('Invalid ledger endpoints: ' + e.process);
    }
    if (e.from !== null) book(e.from, e.resource, -e.amount);
    if (e.to !== null) book(e.to, e.resource, e.amount);
    switch (e.kind) {
      case 'source': summary.sources[e.resource] += e.amount; break;
      case 'sink': summary.sinks[e.resource] += e.amount; break;
      case 'transfer': summary.transported[e.resource] += e.amount; break;
      case 'conversion': summary.converted[e.resource] += e.from === null ? e.amount : -e.amount; break;
    }
  }
  for (const id of new Set([...accounts.keys(), ...after.keys()])) {
    const expected = accounts.get(id) ?? zero, actual = after.get(id) ?? zero;
    for (const r of resources) if (expected[r] !== actual[r]) throw new Error('Unbalanced account ' + id + '/' + r);
  }
  const c = summary.converted;
  if (c.water || c.energy || c.detritus + c.nutrients + c.fungalBiomass !== 0) throw new Error('Unbalanced conversion');
  return summary;
}
