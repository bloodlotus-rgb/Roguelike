"""Summarize one archived hourly ledger without calling the simulation."""
import bisect
import csv
import gzip
import json
import sys
from collections import Counter, defaultdict, deque
from contextlib import ExitStack
from pathlib import Path

source, destination = map(Path, sys.argv[1:])
destination.mkdir(parents=True, exist_ok=True)
with gzip.open(source, 'rt') as handle:
    run = json.load(handle)
stem = source.name.split('.')[0]
postings = run['postings']
fields = ['water', 'detritus', 'energy', 'fungalBiomass']
regions = {r: s['id'] for s in run['geometry'] for r in s['regions']}
paths = {int(k): set(v) for k, v in run['preyPaths'].items()}
stocks = defaultdict(Counter)
annual = defaultdict(Counter)
interval = defaultdict(Counter)
widths = (12, 48, 72, 2190)
windows = {width: defaultdict(Counter) for width in widths}
credits = defaultdict(list)
meals = []
opening = {}

def apply(entry, amount):
    kind, process, resource, donor, target, cut = entry
    if donor is not None:
        stocks[donor][resource] -= amount
    if target is not None:
        stocks[target][resource] += amount

def entries(encoded):
    return ((postings[i], n) for i, n in zip(encoded[::2], encoded[1::2], strict=True))

def vector(stock):
    return tuple(stock[r] for r in fields)

def living(fine):
    by_site = defaultdict(list)
    for region, cell in fine:
        by_site[regions[region]].append([region, *cell])
    return by_site

def summarize_entry(entry, amount, hour):
    kind, process, r, donor, target, cut = entry
    if kind == 'transfer':
        interval[donor]['out.' + r] += amount
        interval[target]['in.' + r] += amount
    elif kind == 'source':
        interval[target]['source.' + r] += amount
    elif kind == 'sink':
        interval[donor]['sink.' + process + '.' + r] += amount
    elif donor is not None:
        interval[donor]['use.' + process + '.' + r] += amount
    else:
        interval[target]['make.' + process + '.' + r] += amount
    if target is not None and (r in fields[:3] and kind in ('transfer', 'source') or r == 'fungalBiomass'):
        # Only germination can credit edible tissue after the animal phase.
        credits[target, r].append((hour, int(process == 'germination')))

for entry, n in entries(run['opening']):
    apply(entry, n)
foci = {run['origin'], run['receiver']}
capacity = {s['id']: s['capacity'] for s in run['geometry']}
prior_fine = run['openingFine']
for width in widths:
    opening[width] = {id: s['prey'] for id, s in stocks.items()}

with ExitStack() as files:
    def table(name, header):
        f = files.enter_context(gzip.open(destination / (stem + '-' + name + '.csv.gz'), 'wt', newline=''))
        writer = csv.writer(f)
        writer.writerow(header)
        return writer

    phases = table('phases', ['hour', 'habitat', 'phase', *fields])
    periods = table('windows', ['width', 'end', 'habitat', 'flowsJSON', 'stocksJSON', 'fineJSON'])
    for hour, (encoded, fine) in enumerate(run['hours'], 1):
        rows = list(entries(encoded))
        # Reconstruct the two focal stocks at the growth decision. Only transport,
        # maintenance and mineralization precede it at a site on this reference commit.
        if hour % 3 == 0:
            gate = {site: stocks[site].copy() for site in foci}
            grown = Counter()
            mineralized = Counter()
            for (kind, process, resource, donor, target, cut), amount in rows:
                if process == 'fungal-mineralization' and resource == 'detritus':
                    mineralized[donor] += amount
                if process == 'fungal-growth' and resource == 'fungalBiomass':
                    grown[target] += amount
                before_growth = (kind == 'source' or process in ('inlet-settling','fungal-mineralization')
                                 or (kind == 'transfer' and resource in ('water','detritus','nutrients','energy'))
                                 or process.startswith(('fungalBiomass-', 'detritivores-')))
                if before_growth:
                    if donor in gate:
                        gate[donor][resource] -= amount
                    if target in gate:
                        gate[target][resource] += amount
            for site, stock in gate.items():
                blockers = [r for r in (*fields, 'nutrients') if not stock[r]]
                occupied = sum(stock[r] for r in ('fungalBiomass','detritivores','propagules','prey'))
                if occupied + 2 > capacity[site]:
                    blockers.append('space')
                assert grown[site] == (0 if blockers else 2), (hour, site, stock, blockers, grown)
                # Eligible immediately before mineralization, then blocked solely by detritus.
                if blockers == ['detritus'] and mineralized[site] and stock['nutrients'] > mineralized[site]:
                    interval[site]['readyBeforeMineralization'] += 1
                interval[site]['growthGate.' + ('+'.join(blockers) or 'open')] += 1
        # Pool stocks are by habitat. Fine residence identifies the consumer, not ownership of its food.
        expected = defaultdict(deque)
        if hour % 12 == 0:
            for region, cell in sorted(prior_fine):
                expected[regions[region]].extend([region] * cell[3])
        maintenance = hour % (run['setup'].get('maintenancePeriod', 6)) == 0
        active = set(stocks)
        phase_written = set()

        def phase(site, label):
            if not maintenance or (site, label) in phase_written:
                return
            phase_written.add((site, label))
            phases.writerow([hour, site, label, *vector(stocks[site])])

        # Transport precedes all basal metabolism. A site's two boundaries can be observed
        # even on a maintenance hour with no debit (empty pool or failed maintenance).
        for entry, amount in rows:
            kind, process, r, donor, target, cut = entry
            physical = kind == 'source' or process == 'inlet-settling' or (kind == 'transfer' and r in ('water','energy','detritus','nutrients'))
            if physical:
                if target is not None:
                    active.add(target)
                apply(entry, amount)
                summarize_entry(entry, amount, hour)
                continue
            site = donor if donor is not None else target
            phase(site, 'beforeMaintenance')
            is_maintenance = process.startswith(('fungalBiomass-', 'detritivores-'))
            if not is_maintenance:
                phase(site, 'afterMaintenance')
            if donor is not None and kind == 'conversion' and (process == 'prey-feeding' or process.startswith('prey-mortality/')):
                s = stocks[site]
                cause = 'water' if not s['water'] else 'energy' if not s['energy'] else 'food' if not s['fungalBiomass'] else 'fed'
                assert amount == 1 and (process == 'prey-feeding' if cause == 'fed' else process == 'prey-mortality/' + cause)
                global_food = sum(t['fungalBiomass'] for t in stocks.values())
                reachable = sum(stocks[id]['fungalBiomass'] for id in paths[site] if id in stocks)
                after = list(vector(s))
                if cause == 'fed':
                    after[2] -= 1
                    after[3] -= 1
                else:
                    after[1] += 1  # The dead prey is converted to local detritus.
                meals.append([hour, site, expected[site].popleft(), cause, *vector(s), *after, reachable, global_food])
            apply(entry, amount)
            summarize_entry(entry, amount, hour)
        assert not any(expected.values()), (hour, expected)
        if maintenance:
            for site in active:
                phase(site, 'beforeMaintenance')
                phase(site, 'afterMaintenance')
        prior_fine = fine
        if hour % 6:
            continue
        for site, flows in interval.items():
            annual[site].update(flows)
            for counters in windows.values():
                counters[site].update(flows)
        interval.clear()
        for width in widths:
            if hour % width and hour != 8760:
                continue
            cells = living(fine)
            for site, s in stocks.items():
                flows = windows[width].get(site, Counter())
                if not flows and not any(s.values()):
                    continue
                births = flows['make.prey-birth.prey']
                deaths = sum(n for k,n in flows.items() if k.startswith('use.prey-mortality/'))
                assert opening[width].get(site, 0) + births - deaths + flows['in.prey'] - flows['out.prey'] == s['prey']
                assert sum(cell[-1] for cell in cells[site]) == s['prey']
                assert sum(cell[1] for cell in cells[site]) == s['fungalBiomass']
                periods.writerow([width, hour, site, json.dumps(flows, separators=(',',':')),
                                  json.dumps(s, separators=(',',':')), json.dumps(cells[site], separators=(',',':'))])
            opening[width] = {id: s['prey'] for id,s in stocks.items()}
            windows[width].clear()
    food = table('meals', ['hour','habitat','region','outcome',*fields, *['after.'+r for r in fields],
                           'reachableFungus','globalFungus', *['nextCreditHours.'+r for r in fields]])
    for row in meals:
        hour, site = row[:2]
        delays = []
        for r in fields:
            times = credits[site,r]
            index = bisect.bisect_right(times, (hour,0))
            delays.append(times[index][0]-hour if index < len(times) else None)
        food.writerow([*row,*delays])
with (destination / (stem + '-annual.json')).open('w') as output:
    json.dump({'sites': annual, 'closing': stocks}, output, separators=(',',':'))
