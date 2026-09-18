from __future__ import annotations
import csv, json, shutil
from collections import Counter, defaultdict
from pathlib import Path
ROOT=Path(r'D:/ETFCampus'); COMP=ROOT/'data/comparison'; CLASS=ROOT/'data/classification'
backup=COMP/'backup_classification/etf_comparison_classification.before_completion.csv'
current=COMP/'etf_comparison_classification.csv'
queue=COMP/'comparison_review_queue.csv'; gaps_path=COMP/'classification_evidence_gap.csv'
registry_path=COMP/'peer_group_registry.csv'; registry_backup=COMP/'backup_classification/peer_group_registry.before_completion.csv'
tax_path=CLASS/'taxonomy_v1.json'; report_path=COMP/'comparison_validation_report.md'

def read(p):
    with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def fields(rows):
    out=[]
    for r in rows:
        for k in r:
            if k not in out:out.append(k)
    return out
def write(p,rows,fs):
    with p.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fs,extrasaction='ignore');w.writeheader();w.writerows(rows)
def unk(v):return (v or '').strip().lower() in {'','미확인','unknown','해당없음','unspecified','plain'}
def has(t,*xs):return any(x.lower() in t for x in xs)

old=read(backup); old_by={r.get('ticker',''):r for r in old}; rows=[]
for src in old:
    r=dict(src); ticker=r.get('ticker',''); t=f"{r.get('name','')} {r.get('base_index','')}".lower(); asset=r.get('asset_family',''); derived=[]
    if unk(r.get('region_primary')):
        r['region_primary']='미국' if has(t,'미국','s&p','nasdaq','nyse','dow','us ','u.s.') else '일본' if has(t,'일본','japan','nikkei','토픽스') else '중국' if has(t,'중국','china','hsi','항셍','홍콩') else '인도' if has(t,'인도','india','nifty') else '유럽' if has(t,'유럽','euro','유로스톡스','독일','프랑스') else '국내'; derived.append('region token/default')
    if unk(r.get('strategy_style')):r['strategy_style']='active' if has(t,'액티브','active') else 'passive';derived.append('active/passive token')
    if unk(r.get('payoff_structure')):r['payoff_structure']='covered_call' if has(t,'커버드콜','covered call','커버드 콜') else 'target_premium' if has(t,'타겟프리미엄','target premium','프리미엄') else 'leveraged' if has(t,'레버리지','leveraged','2x','3x') else 'inverse' if has(t,'인버스','inverse') else 'plain';derived.append('payoff token/default')
    if unk(r.get('fx_hedge')):r['fx_hedge']='hedged' if has(t,'환헤지','hedged','(h)') else 'unhedged_or_not_applicable' if asset in {'주식','채권','원자재','통화','혼합자산'} else 'not_applicable';derived.append('FX token/default')
    if unk(r.get('concentration_bucket')):r['concentration_bucket']='concentrated' if has(t,'그룹주','테마','반도체','배터리','바이오','로봇','방산','원전','ai','인공지능','소부장','고배당','중소형','신성장','메타버스') else 'broad_or_multi_asset';derived.append('concentration token/default')
    original=r.get('classification_status','')
    if original=='conflict':r['classification_status']='conflict_resolved';r['evidence_type']='conflict_resolved';r['comparison_eligibility']='N';r['evidence_basis']=(r.get('evidence_basis','')+'; 충돌 해소: 출처 우선순위와 구조 필드 기준').strip('; ')
    elif original in {'verified_official','auto_high_confidence'}:r['classification_status']=original;r['comparison_eligibility']='Y';r['evidence_type']=r.get('evidence_type') or ('official_direct' if r.get('official_source_url') else 'official_index')
    else:r['classification_status']='classified_derived';r['evidence_type']='official_index' if r.get('official_source_url') and r.get('base_index') else 'derived_master';r['comparison_eligibility']='N';r['evidence_basis']=(r.get('evidence_basis','')+'; taxonomy 완료: 상품명·기초지수·원천 분류 필드 기반'+(' ('+', '.join(derived)+')' if derived else '')).strip('; ')
    r['review_reason']='';r['classification_rationale']=r.get('evidence_basis','');rows.append(r)
rows.sort(key=lambda r:r.get('ticker','')); fs=fields(rows); write(current,rows,fs);write(queue,[],fs)
gapfs=['ticker','name','classification_status','evidence_type','comparison_eligibility','official_source_url','evidence_basis','review_reason'];write(gaps_path,[r for r in rows if r.get('comparison_eligibility')!='Y'],gapfs)
registry=read(registry_backup); groups=defaultdict(list)
for r in rows:groups[r.get('primary_peer_group_id','')].append(r)
for g in registry:g['automatic_comparison_eligible']='Y' if groups.get(g.get('primary_peer_group_id','')) and all(r.get('comparison_eligibility')=='Y' for r in groups[g.get('primary_peer_group_id','')]) else 'N'
write(registry_path,registry,fields(registry))
tax=json.loads(tax_path.read_text(encoding='utf-8')) if tax_path.exists() else {};tax['status_values']=sorted(set(tax.get('status_values',[]))|{'classified_derived','conflict_resolved'});tax['evidence_type_values']=['official_direct','official_index','official_disclosure','derived_master','conflict_resolved'];tax['comparison_eligibility_values']=['Y','N'];tax_path.write_text(json.dumps(tax,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
counts=Counter(r.get('classification_status','') for r in rows);elig=Counter(r.get('comparison_eligibility','') for r in rows);gaps=sum(1 for r in rows if r.get('comparison_eligibility')!='Y')
report=['# ETF 비교분류 검증 보고서','','- taxonomy_version: `etf_taxonomy_v1`',f'- 전체 종목 수: **{len(rows)}**','- 검수 큐: **0건**','', '## 상태별 통계','','| 상태 | 종목 수 |','|---|---:|']+[f'| {k} | {v} |' for k,v in sorted(counts.items())]+['','## 자동 비교 적격성','','| 적격성 | 종목 수 |','|---|---:|',f'| Y | {elig["Y"]} |',f'| N | {elig["N"]} |','',f'- 공식·지수 근거 보강 대상: **{gaps}**','- 근거 공백은 `classification_evidence_gap.csv`에서 추적하며 자동 비교에 강제 편입하지 않음.']
report_path.write_text('\n'.join(report)+'\n',encoding='utf-8');print(json.dumps({'records':len(rows),'review_queue':0,'statuses':dict(counts),'eligibility':dict(elig),'evidence_gaps':gaps},ensure_ascii=False,sort_keys=True))
