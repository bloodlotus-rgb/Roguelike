"""Turn the per-habitat annual measurements into a CSV for origin, receiver and whole space."""
import csv
import json
import sys
from collections import Counter
from pathlib import Path

tables = Path(sys.argv[1])
writer = csv.writer(sys.stdout, lineterminator='\n')
metrics = ['triggers','fungal-growth','mineralized','germination','fungalMortality','grazing','late',
           'births','deaths','preyNet','birthsQ4','meal.fed','meal.food','meal.energy','meal.water','in.prey','out.prey']
resources = ['water','detritus','nutrients','energy']
flows = [prefix+r for r in resources for prefix in ('source.','in.','out.','sink.')]
writer.writerow(['seed','space','founders','policy','area','habitat',*metrics,*flows,
                 *['end.'+r for r in [*resources,'fungalBiomass','prey']], 'end.pairs','globalPreyExtinction','quotaHour'])
for seed in ('mansion','estirpe','zz'):
    for space in ('recinto','edificio'):
        for founders in (0,6):
            for policy in ('original','priority'):
                key = f'{seed}-{space}-{founders}-{policy}'
                data = json.loads((tables/(key+'-annual.json')).read_text())
                for area in ('origin','receiver','all'):
                    if area == 'all':
                        site = ''
                        counts = Counter(data['total'])
                        stock = Counter()
                        for local in data['final'].values():
                            stock.update(local)
                        pairs = sum(data['pairs'].values())
                    else:
                        site = str(data[area])
                        counts = Counter(data['sites'][site])
                        stock = Counter(data['final'][site])
                        pairs = data['pairs'].get(site,0)
                    counts['fungalMortality'] = sum(n for k,n in counts.items() if k.startswith('spent.fungalBiomass-mortality/'))
                    counts['grazing'] = counts['spent.prey-feeding'] + counts['spent.prey-birth']
                    writer.writerow([seed,space,founders,policy,area,site,*[counts[k] for k in metrics+flows],
                                     *[stock[k] for k in [*resources,'fungalBiomass','prey']],pairs,data['extinction'],data['quotaHour']])
