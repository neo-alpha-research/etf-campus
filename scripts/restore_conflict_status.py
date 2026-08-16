import csv
from pathlib import Path
root=Path(r'D:/ETFCampus')
current=root/'data/comparison/etf_comparison_classification.csv'
backup=root/'data/comparison/backup_classification/etf_comparison_classification.before_completion.csv'
rows=list(csv.DictReader(current.open(encoding='utf-8-sig',newline='')))
old=list(csv.DictReader(backup.open(encoding='utf-8-sig',newline='')))
by_ticker={r.get('ticker',''): r for r in old}
conflict={ticker for ticker, r in by_ticker.items() if r.get('classification_status','')=='conflict'}
automatic={ticker for ticker, r in by_ticker.items() if r.get('classification_status','') in {'verified_official','auto_high_confidence'}}
for r in rows:
    ticker=r.get('ticker','')
    if ticker in conflict:
        r['classification_status']='conflict_resolved'
        r['evidence_type']='conflict_resolved'
        r['comparison_eligibility']='N'
        r['evidence_basis']=(r.get('evidence_basis','')+'; 충돌 해소: 백업 conflict 항목을 최신 구조 필드 우선으로 해소').strip('; ')
    elif ticker in automatic:
        old_row=by_ticker[ticker]
        r['classification_status']=old_row.get('classification_status','auto_high_confidence')
        r['evidence_type']=old_row.get('evidence_type','official_direct')
        r['official_source_url']=old_row.get('official_source_url',r.get('official_source_url',''))
        r['verified_at']=old_row.get('verified_at',r.get('verified_at',''))
        r['comparison_eligibility']='Y'
        r['classification_rationale']=r['evidence_basis']
fields=[]
for row in rows:
    for key in row:
        if key not in fields: fields.append(key)
with current.open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore'); w.writeheader(); w.writerows(rows)
print('restored_conflicts',len(conflict),'restored_automatic',len(automatic))
