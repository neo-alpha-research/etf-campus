import csv, json
from collections import Counter, defaultdict
from pathlib import Path
p=Path(r'D:/ETFCampus/data/comparison/etf_comparison_classification.csv')
rows=list(csv.DictReader(p.open(encoding='utf-8-sig', newline='')))
fields=['asset_family','region_primary','comparison_category','comparison_topic','comparison_subtopic','index_family','strategy_style','payoff_structure','direction','leverage_multiple','fx_hedge','replication_method','concentration_bucket','primary_peer_group_id']
unknown={'','미확인','unknown','해당없음','unspecified','plain'}
counts=Counter(); samples=defaultdict(list)
for r in rows:
    for f in fields:
        if r.get(f,'').strip().lower() in unknown:
            counts[f]+=1
            if len(samples[f])<8: samples[f].append({'ticker':r.get('ticker',''),'name':r.get('name',''),'base_index':r.get('base_index','')})
print(json.dumps({'records':len(rows),'unknown_counts':counts,'samples':samples},ensure_ascii=False,default=list))
