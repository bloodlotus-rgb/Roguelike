import { emptyStock, resources } from './parameters.ts';
import { type Entry, type Inventory } from './resources.ts';

export function ledgerSummary() {
  return { sources: emptyStock(), sinks: emptyStock(), converted: emptyStock(), transported: emptyStock() };
}

/** Reconcile individual accounts, then independently check matter, energy and water budgets. */
export function audit(before: Inventory, after: Inventory, entries: Entry[]) {
  return auditAccounts(before, after, entries, resources, emptyStock, ['detritus', 'nutrients', 'fungalBiomass']);
}

export function auditAccounts<R extends string>(before: Map<number, Record<R, number>>, after: Map<number, Record<R, number>>,
  entries: Entry<R>[], fields: readonly R[], createStock: () => Record<R, number>, matter: readonly R[]) {
  const summary = { sources: createStock(), sinks: createStock(), converted: createStock(), transported: createStock() };
  const accounts: Map<number, Record<R, number>> = new Map();
  before.forEach((stock, id) => accounts.set(id, { ...stock }));
  const zero = createStock();
  function book(id: number, r: R, change: number) {
    let stock = accounts.get(id);
    if (!stock) {
      stock = createStock();
      accounts.set(id, stock);
    }
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
  accounts.forEach((expected, id) => {
    const actual = after.get(id) ?? zero;
    for (const r of fields) if (expected[r] !== actual[r]) throw new Error('Unbalanced account ' + id + '/' + r);
  });
  after.forEach((stock, id) => {
    if (!accounts.has(id) && fields.some(r => stock[r] !== 0)) throw new Error('Unbalanced account ' + id);
  });
  const c = summary.converted;
  if (matter.reduce((n, r) => n + c[r], 0) !== 0 || fields.some(r => !matter.includes(r) && c[r] !== 0)) {
    throw new Error('Unbalanced conversion');
  }
  return summary;
}
