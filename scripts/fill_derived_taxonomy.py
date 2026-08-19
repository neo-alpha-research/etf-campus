from pathlib import Path
import csv

path=Path(r'D:/ETFCampus/data/comparison/etf_comparison_classification.csv')
rows=list(csv.DictReader(path.open(encoding='utf-8-sig',newline='')))
unknown={'','미확인','unknown','해당없음','unspecified','plain'}

def is_unknown(v): return (v or '').strip().lower() in unknown

def text(r): return f"{r.get('name','')} {r.get('base_index','')}".lower()

def has(t,*xs): return any(x.lower() in t for x in xs)

for r in rows:
    t=text(r); asset=r.get('asset_family','')
    derived=[]
    if is_unknown(r.get('region_primary')):
        if has(t,'미국','s&p','nasdaq','nyse','dow','us ','u.s.'): r['region_primary']='미국'
        elif has(t,'일본','japan','nikkei','토픽스'): r['region_primary']='일본'
        elif has(t,'중국','china','hsi','항셍','홍콩'): r['region_primary']='중국'
        elif has(t,'인도','india','nifty'): r['region_primary']='인도'
        elif has(t,'유럽','euro','유로스톡스','독일','프랑스'): r['region_primary']='유럽'
        else: r['region_primary']='국내'
        derived.append('region token/default')
    if is_unknown(r.get('strategy_style')):
        r['strategy_style']='active' if has(t,'액티브','active') else 'passive'
        derived.append('active/passive token')
    if is_unknown(r.get('payoff_structure')):
        if has(t,'커버드콜','covered call','커버드 콜'): r['payoff_structure']='covered_call'
        elif has(t,'타겟프리미엄','target premium','프리미엄'): r['payoff_structure']='target_premium'
        elif has(t,'레버리지','leveraged','2x','3x'): r['payoff_structure']='leveraged'
        elif has(t,'인버스','inverse'): r['payoff_structure']='inverse'
        else: r['payoff_structure']='plain'
        derived.append('payoff token/default')
    if is_unknown(r.get('fx_hedge')):
        if has(t,'환헤지','hedged','(h)'): r['fx_hedge']='hedged'
        elif asset in ('주식','채권','원자재','통화','혼합자산'): r['fx_hedge']='unhedged_or_not_applicable'
        else: r['fx_hedge']='not_applicable'
        derived.append('FX token/default')
    if is_unknown(r.get('concentration_bucket')):
        if has(t,'그룹주','테마','반도체','배터리','바이오','로봇','방산','원전','AI','인공지능','소부장','고배당','중소형','신성장','메타버스'):
            r['concentration_bucket']='concentrated'
        else:
            r['concentration_bucket']='broad_or_multi_asset'
        derived.append('concentration token/default')
    if derived:
        r['evidence_basis']=(r.get('evidence_basis','')+'; derived taxonomy: '+', '.join(derived)).strip('; ')
        r['classification_rationale']=r['evidence_basis']
        r['comparison_eligibility']='N'
        if r.get('classification_status') not in ('conflict_resolved',): r['classification_status']='classified_derived'

fields=list(rows[0].keys())
with path.open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)
print('updated',len(rows))
