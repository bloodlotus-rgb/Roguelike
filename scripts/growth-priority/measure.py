"""Read one experimental trace. Write habitat windows, individual events and an annual summary."""
import csv
import gzip
import json
import sys
from collections import Counter, defaultdict
from contextlib import ExitStack
from pathlib import Path

trace_path, out = map(Path, sys.argv[1:])
with gzip.open(trace_path, 'rt') as f:
    run = json.load(f)
out.mkdir(parents=True, exist_ok=True)
name = run['name']
stocks = defaultdict(Counter)
annual, block = defaultdict(Counter), defaultdict(Counter)
windows = {w: defaultdict(Counter) for w in (12, 48, 72, 2190)}
sites = run['regionSites']
foci = [run['origin'], run['receiver']]
organic = ['detritus', 'nutrients', 'energy']
events = []

def entries(encoded):
    return ((run['entries'][code], amount) for code, amount in zip(encoded[::2], encoded[1::2], strict=True))

def apply(resource, donor, target, amount):
    if donor is not None:
        stocks[donor][resource] -= amount
    if target is not None:
        stocks[target][resource] += amount

def substrate(site):
    return [stocks[site][r] for r in organic]

def census(cells):
    counts, pairs = Counter(), Counter()
    for region, (fungus, spores, decomposers, prey) in cells:
        if prey:
            site = sites[region]
            counts[site] += prey
            pairs[site] += prey // 2
    return counts, pairs

for (kind, process, resource, donor, target, cut), amount in entries(run['opening']):
    apply(resource, donor, target, amount)
prior, _ = census(run['initialCells'])
initially_occupied = set(prior)
seen = initially_occupied.copy()
opening = {width: prior.copy() for width in windows}
extinction = None
with ExitStack() as handles:
    def table(suffix, columns):
        file = handles.enter_context(gzip.open(out / (name + '-' + suffix + '.csv.gz'), 'wt', newline=''))
        writer = csv.writer(file)
        writer.writerow(columns)
        return writer
    periods = table('windows', ['width','end','habitat','countsJSON','closingStocksJSON','closingPairs'])
    meals = table('meals', ['hour','habitat','outcome','fungusBefore','waterBefore','energyBefore','laterTissueSameHour'])
    priority = table('priority', ['hour','habitat','beforeGrowth_D_N_E','afterGrowth_D_N_E','afterMineralization_D_N_E'])
    for hour, (encoded, cells) in enumerate(run['hours'], 1):
        mineralized, germinated = set(), set()
        triggers, meals_now = {}, []
        for (kind, process, r, donor, target, cut), n in entries(encoded):
            site = donor if donor is not None else target
            s = stocks[site]
            if kind == 'transfer':
                block[donor]['out.'+r] += n
                block[target]['in.'+r] += n
            elif kind == 'source':
                block[target]['source.'+r] += n
            elif kind == 'sink':
                block[donor]['sink.'+r] += n
            if process == 'fungal-mineralization' and r == 'detritus':
                mineralized.add(site)
                block[site]['mineralized'] += n
            if process == 'fungal-growth' and r == 'detritus' and site not in mineralized:
                # With the signed rates, an affordable growth before any mineralization
                # consumes the last detritus. Check the actual pre-action inventories.
                assert run['priority'] and hour % 3 == 0 and s['detritus'] == 1
                assert s['nutrients'] and s['water'] and s['energy'] and s['fungalBiomass']
                triggers[site] = [substrate(site)]
                block[site]['triggers'] += 1
            if kind == 'conversion' and r == 'fungalBiomass':
                key = process if target is not None else 'spent.' + process
                block[site][key] += n
                if process == 'germination':
                    germinated.add(site)
            if kind == 'conversion' and donor is not None:
                if process == 'prey-feeding' or process.startswith('prey-mortality/'):
                    outcome = 'fed' if process == 'prey-feeding' else process.split('/')[1]
                    meals_now.append((site,outcome,s['fungalBiomass'],s['water'],s['energy']))
                    block[site]['meal.'+outcome] += 1
                if process == 'prey-birth':
                    block[site]['births'] += n
                    if hour > 6570:
                        block[site]['birthsQ4'] += n
                if process.startswith('prey-mortality/'):
                    block[site]['deaths'] += n
            apply(r, donor, target, n)
            if site in triggers and kind == 'sink' and process == 'fungal-growth':
                triggers[site].append(substrate(site))
        for site,(before,after) in triggers.items():
            assert after == [before[0]-1, before[1]-1, before[2]-1]
            assert site not in mineralized and after[0] == 0
            # No remaining detritus and no mineralization postings; its debit is zero.
            priority.writerow([hour,site,before,after,after])
        for site,outcome,fungus,water,energy in meals_now:
            expected = 'water' if not water else 'energy' if not energy else 'food' if not fungus else 'fed'
            assert outcome == expected
            late = outcome == 'food' and site in germinated
            meals.writerow([hour,site,outcome,fungus,water,energy,int(late)])
            block[site]['late'] += int(late)
        counts,pairs = census(cells)
        for site in prior.keys() - counts.keys():
            events.append([hour,site,'extinction'])
        for site in counts.keys() - prior.keys():
            events.append([hour,site,'recolonization' if site in seen else 'colonization'])
        seen.update(counts)
        if prior and not counts:
            extinction = hour
        prior = counts
        if hour % 6:
            continue
        for site, metrics in block.items():
            annual[site].update(metrics)
            for w in windows.values():
                w[site].update(metrics)
        block.clear()
        for width, records in windows.items():
            if hour % width and hour != 8760:
                continue
            for site,s in stocks.items():
                m = records.get(site, Counter())
                if m or any(s.values()) or site in foci:
                    assert counts[site] == s['prey'] == opening[width][site]+m['births']-m['deaths']+m['in.prey']-m['out.prey']
                    m['preyNet'] = m['births']-m['deaths']
                    periods.writerow([width,hour,site,json.dumps(m,separators=(',',':')),
                                      json.dumps(s,separators=(',',':')),pairs[site]])
            opening[width] = counts.copy()
            records.clear()
total = Counter()
for site, m in annual.items():
    m['preyNet'] = m['births']-m['deaths']
    total.update(m)
assert sum(counts.values()) == run['prey']+total['preyNet']
summary = {'name':name, 'origin':foci[0], 'receiver':foci[1], 'sites':annual, 'total':total,
           'final':stocks, 'pairs':pairs, 'events':events,'extinction':extinction,'quotaHour':run['exhausted']}
(out / (name+'-annual.json')).write_text(json.dumps(summary,separators=(',',':'))+'\n')
