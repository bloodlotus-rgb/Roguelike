import type { Entry } from '../src/ecology/resources.ts';
import { accounts, biology, emptyTrophicStock, type Account, type TrophicStock } from '../src/ecology/trophic-contract.ts';
import type { TrophicState } from '../src/ecology/trophic.ts';

const groups = ['fungalBiomass', 'detritivores'] as const;
type Group = typeof groups[number];
type Posting = Entry<Account>;
const zero = emptyTrophicStock();
const emptyBudget = () => ({ sources: emptyTrophicStock(), sinks: emptyTrophicStock(), converted: emptyTrophicStock(),
  imports: emptyTrophicStock(), exports: emptyTrophicStock() });

function distribution(stocks: TrophicState['stocks'], home: number, inletId: number) {
  const outside = emptyTrophicStock(), occupied = emptyTrophicStock();
  for (const [id, stock] of stocks) {
    if (id === home) continue;
    for (const r of accounts) {
      outside[r] += stock[r];
      if (stock[r]) occupied[r]++;
    }
  }
  return { home: { ...(stocks.get(home) ?? zero) }, inletStock: { ...(stocks.get(inletId) ?? zero) }, outside, outsideHabitatsWithStock: occupied };
}

/** Replay the ordered ledger up to this group's first maintenance posting, including earlier competition. */
function rationAtDeath(opening: TrophicStock, ledger: Posting[], home: number, group: Group) {
  const available = { ...opening };
  for (const e of ledger) {
    if (e.from === home && (e.process === group + '-feeding' || e.process === group + '-maintenance' ||
      e.process.startsWith(group + '-mortality/'))) break;
    if (e.from === home) available[e.resource] -= e.amount;
    if (e.to === home) available[e.resource] += e.amount;
  }
  const rations = Math.ceil(available[group] / (group === 'detritivores' ? biology.animalsPerRation : biology.fungalUnitsPerRation));
  const required = { water: 1, detritus: rations * biology.maintenanceFood, energy: rations * biology.maintenanceEnergy };
  const deficit = { water: Math.max(0, 1 - available.water), detritus: Math.max(0, required.detritus - available.detritus),
    energy: Math.max(0, required.energy - available.energy) };
  return { available, required, deficit };
}

export class ColonyBudget {
  readonly home: number;
  readonly inletId: number;
  readonly balance = emptyBudget();
  readonly cuts: Record<string, { imports: TrophicStock; exports: TrophicStock }> = {};
  readonly energySpent: Record<string, number> = {};
  readonly extinctions: { group: Group; hour: number; rations: ReturnType<typeof rationAtDeath>;
    closing: ReturnType<typeof distribution>; budget: ReturnType<typeof emptyBudget>; energySpent: Record<string, number>; lotsUsed: number }[] = [];
  readonly minimum: Record<Group, number>;
  readonly maximum: Record<Group, number>;
  quotaExhaustedAt: number | null = null;

  constructor(home: number, inletId: number, founded: TrophicState, deposits: Posting[]) {
    this.home = home;
    this.inletId = inletId;
    const stock = founded.stocks.get(home) ?? zero;
    this.minimum = { fungalBiomass: stock.fungalBiomass, detritivores: stock.detritivores };
    this.maximum = { ...this.minimum };
    this.book(deposits);
  }

  private book(ledger: Posting[]) {
    for (const e of ledger) {
      const from = e.from === this.home, to = e.to === this.home;
      if (!from && !to) continue;
      const r = e.resource;
      if (e.kind === 'transfer') {
        const direction = from ? 'exports' : 'imports';
        this.balance[direction][r] += e.amount;
        const cut = this.cuts[e.connector!] ??= { imports: emptyTrophicStock(), exports: emptyTrophicStock() };
        cut[direction][r] += e.amount;
      } else if (e.kind === 'conversion') this.balance.converted[r] += from ? -e.amount : e.amount;
      else if (e.kind === 'source') this.balance.sources[r] += e.amount;
      else {
        this.balance.sinks[r] += e.amount;
        if (r === 'energy') this.energySpent[e.process] = (this.energySpent[e.process] ?? 0) + e.amount;
      }
    }
  }

  record(before: TrophicState, after: TrophicState, ledger: Posting[]) {
    this.book(ledger);
    const initial = before.stocks.get(this.home) ?? zero, final = after.stocks.get(this.home) ?? zero;
    const b = this.balance;
    for (const r of accounts) {
      if (b.sources[r] + b.imports[r] - b.exports[r] + b.converted[r] - b.sinks[r] !== final[r]) {
        throw new Error('Unbalanced colony budget: ' + r);
      }
    }
    if (after.lotsUsed !== before.lotsUsed && after.lotsUsed === after.setup.source?.quota) this.quotaExhaustedAt = after.tick;
    for (const group of groups) {
      this.minimum[group] = Math.min(this.minimum[group], final[group]);
      this.maximum[group] = Math.max(this.maximum[group], final[group]);
      if (initial[group] && !final[group]) {
        this.extinctions.push({ group, hour: after.tick, rations: rationAtDeath(initial, ledger, this.home, group),
          closing: distribution(after.stocks, this.home, this.inletId), budget: structuredClone(b), energySpent: { ...this.energySpent }, lotsUsed: after.lotsUsed });
      }
    }
  }

  window(state: TrophicState) {
    return { homeId: this.home, inletId: this.inletId, ...distribution(state.stocks, this.home, this.inletId), budget: structuredClone(this.balance),
      cuts: structuredClone(this.cuts), energySpent: { ...this.energySpent }, minimum: { ...this.minimum }, maximum: { ...this.maximum }, quotaExhaustedAt: this.quotaExhaustedAt };
  }
}
