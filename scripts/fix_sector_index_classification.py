from pathlib import Path
import csv
from collections import defaultdict

root=Path(r'D:/ETFCampus'); comp=root/'data/comparison'
classification=comp/'etf_comparison_classification.csv'
registry=comp/'peer_group_registry.csv'

def read(p):
    with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def write(p,rows,fields):
    with p.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows(rows)

def has(t,*xs):return any(x.lower() in t for x in xs)

def sector_topic(t):
    mapping=[(('정보기술','반도체','소프트웨어','테크','technology'),'IT·반도체'),(('자동차','모빌리티','자동차부품'),'자동차·모빌리티'),(('바이오','헬스케어','제약','의료'),'바이오·헬스케어'),(('금융','은행','증권','보험'),'금융'),(('에너지','원전','전력','친환경','수소'),'에너지·전력'),(('화학','철강','소재'),'소재·화학'),(('건설','인프라'),'건설·인프라'),(('통신','미디어'),'통신·미디어'),(('소비재','유통','여행'),'소비·서비스')]
    for keys,label in mapping:
        if has(t,*keys):return label
    return '산업·섹터'

rows=read(classification); changed=[]
market_tokens=('코스피 200','kospi 200','코스닥 150','s&p 500','sp 500','나스닥 100','nasdaq 100','다우','dow jones','니케이 225','nikkei 225','msci world','msci korea','러셀 2000','국채','회사채')
sector_tokens=('정보기술','반도체','소프트웨어','테크','technology','자동차','모빌리티','바이오','헬스케어','제약','금융','은행','증권','보험','에너지','원전','전력','친환경','수소','화학','철강','소재','건설','인프라','통신','미디어','소비재','유통','여행')
for r in rows:
    text=f"{r.get('name','')} {r.get('base_index','')}"; low=text.lower()
    # Sector-specific wording overrides a broad market-family token such as KOSPI 200.
    if r.get('comparison_category')=='대표지수' and has(low,*sector_tokens):
        topic=sector_topic(low); region=r.get('region_primary') or '국내'
        r['comparison_category']='산업·섹터';r['comparison_topic']=topic;r['comparison_subtopic']=f'{region} {topic}';r['index_family']=f'섹터-{region}-{topic}'
        r['primary_peer_group_id']=f'PG-SECTOR-{region}-{topic}'
        r['evidence_basis']=(r.get('evidence_basis','')+'; sector override: sector-specific index token').strip('; ')
        r['classification_rationale']=r['evidence_basis'];changed.append(r)
# Explicit safety correction for the reported product.
for r in rows:
    if r.get('ticker')=='363580':
        r['comparison_category']='산업·섹터';r['comparison_topic']='IT·반도체';r['comparison_subtopic']='국내 IT·반도체';r['index_family']='섹터-국내-IT·반도체';r['primary_peer_group_id']='PG-SECTOR-국내-IT·반도체'
        if r not in changed:changed.append(r)
rows.sort(key=lambda r:r.get('ticker','')); fs=[]
for r in rows:
    for k in r:
        if k not in fs:fs.append(k)
write(classification,rows,fs)
# Rebuild/update registry entries for affected groups while preserving existing groups.
old=read(registry); by_id={r.get('primary_peer_group_id',''):r for r in old}; members=defaultdict(list)
for r in rows:members[r.get('primary_peer_group_id','')].append(r)
for gid, group_rows in members.items():
    if gid not in by_id: by_id[gid]={}
    g=by_id[gid]; first=group_rows[0]
    g.update({'primary_peer_group_id':gid,'peer_group_name':f"{first.get('region_primary','')} {first.get('comparison_subtopic','')}",'member_count':str(len(group_rows)),'asset_family':first.get('asset_family',''),'region_primary':first.get('region_primary',''),'comparison_category':first.get('comparison_category',''),'comparison_topic':first.get('comparison_topic',''),'comparison_subtopic':first.get('comparison_subtopic',''),'index_family':first.get('index_family',''),'strategy_structure':f"{first.get('payoff_structure','')}|{first.get('direction','')}|{first.get('leverage_multiple','')}",'automatic_comparison_eligible':'Y' if all(x.get('comparison_eligibility')=='Y' for x in group_rows) else 'N','group_status_summary':', '.join(sorted(set(x.get('classification_status','') for x in group_rows))),'classification_rationale':first.get('evidence_basis','')})
new=list(by_id.values()); reg_fields=[]
for r in new:
    for k in r:
        if k not in reg_fields:reg_fields.append(k)
write(registry,new,reg_fields)
print('sector_changed',len(changed),'363580',next(r for r in rows if r.get('ticker')=='363580')['comparison_category'],next(r for r in rows if r.get('ticker')=='363580')['primary_peer_group_id'])
