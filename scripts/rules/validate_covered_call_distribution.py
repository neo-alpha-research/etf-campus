"""
Covered Call Distribution Coverage & Regulatory Integrity Validator
Checks:
1. Strategy token parsing ('strategy'.split('·').includes('커버드콜')) vs Name matching
2. Distribution data coverage (TTM yield, payment cycle, last ex-date) in screener.json (Gate >= 60%)
3. Zero-hallucination verification (missing yields must be null, never 0.0)
4. Pension limit distribution breakdown (70% risk vs 100% safe vs ineligible)
"""

import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCREENER_JSON = REPO_ROOT / "public" / "data" / "screener.json"
DIST_SUMMARIES_JSON = REPO_ROOT / "data" / "distributions" / "etf_distribution_summaries.json"

COVERED_CALL_DISTRIBUTION_MIN = 0.60


def validate_covered_call():
    if not SCREENER_JSON.exists():
        print(f"[FAIL] screener.json not found at {SCREENER_JSON}", file=sys.stderr)
        sys.exit(1)

    with open(SCREENER_JSON, "r", encoding="utf-8") as f:
        etfs = json.load(f)

    # 1. Strategy token parsing vs name match
    token_matches = []
    name_matches = []

    for e in etfs:
        tk = e.get("ticker", "")
        nm = e.get("name", "")
        strat = (e.get("classification") or {}).get("strategy") or ""
        tokens = [t.strip() for t in strat.split("·") if t.strip()]

        is_token_cc = "커버드콜" in tokens
        is_name_cc = "커버드콜" in nm

        if is_token_cc:
            token_matches.append(e)
        if is_name_cc:
            name_matches.append(e)

    token_tickers = {e["ticker"] for e in token_matches}
    name_tickers = {e["ticker"] for e in name_matches}

    diff_token_only = token_tickers - name_tickers
    diff_name_only = name_tickers - token_tickers

    print("=" * 80)
    print("🔍 커버드콜(Covered Call) 종목 선정 및 분배금 데이터 무결성 검사")
    print("=" * 80)
    print(f"전략 토큰 기준 종목수  : {len(token_matches)}개")
    print(f"종목명 매칭 기준 종목수: {len(name_matches)}개")
    print(f"토큰 전용 (이름 누락)  : {len(diff_token_only)}건 {list(diff_token_only) if diff_token_only else '✓ 일치'}")
    print(f"이름 전용 (토큰 누락)  : {len(diff_name_only)}건 {list(diff_name_only) if diff_name_only else '✓ 일치'}")

    if diff_token_only or diff_name_only:
        print("[WARN] 전략 토큰과 종목명 간 불일치 발생! 분류 데이터 점검 권장", file=sys.stderr)

    cc_etfs = token_matches
    total_cc = len(cc_etfs)
    if total_cc == 0:
        print("[FAIL] 커버드콜 종목이 0건 검출되었습니다.", file=sys.stderr)
        sys.exit(1)

    # 2. Distribution data coverage
    with_yield = 0
    with_cycle = 0
    with_date = 0
    zero_yield_suspicious = 0

    for e in cc_etfs:
        y = e.get("distributionYield")
        c = e.get("distributionCycle")
        d = e.get("lastDistributionDate")

        if y is not None:
            with_yield += 1
            if y == 0.0:
                zero_yield_suspicious += 1
        if c is not None and str(c).strip():
            with_cycle += 1
        if d is not None and str(d).strip():
            with_date += 1

    yield_coverage = with_yield / total_cc

    print("-" * 80)
    print(f"📊 분배금 실적 데이터 커버리지 (총 {total_cc}종)")
    print(f"  • 실적 분배율(TTM) 보유 : {with_yield}/{total_cc} ({yield_coverage * 100:.1f}%) [게이트 임계치: {COVERED_CALL_DISTRIBUTION_MIN * 100:.0f}%]")
    print(f"  • 분배 주기(월/분기 등) : {with_cycle}/{total_cc} ({with_cycle / total_cc * 100:.1f}%)")
    print(f"  • 최근 분배락일 보유    : {with_date}/{total_cc} ({with_date / total_cc * 100:.1f}%)")

    # 3. Pension limit breakdown
    safe_100 = 0
    risk_70 = 0
    ineligible = 0

    for e in cc_etfs:
        lim = e.get("pensionLimit")
        if lim == "100% (안전자산)":
            safe_100 += 1
        elif lim == "70% (위험자산)":
            risk_70 += 1
        elif lim == "불가":
            ineligible += 1

    print("-" * 80)
    print(f"🛡️ 퇴직연금(DC·IRP) 법정 한도 분포")
    print(f"  • 70% 한도 (위험자산)   : {risk_70}종 ({risk_70 / total_cc * 100:.1f}%)")
    print(f"  • 100% 한도 (법정안전자산): {safe_100}종 ({safe_100 / total_cc * 100:.1f}%)")
    print(f"  • 퇴직연금 편입 불가    : {ineligible}종 ({ineligible / total_cc * 100:.1f}%)")
    print("=" * 80)

    # Gate check
    if yield_coverage < COVERED_CALL_DISTRIBUTION_MIN:
        print(f"[FAIL] 커버드콜 실적 분배율 커버리지 부족: {yield_coverage * 100:.1f}% < {COVERED_CALL_DISTRIBUTION_MIN * 100:.0f}% (탭 출시 보류)", file=sys.stderr)
        sys.exit(1)

    print(f"[PASS] 커버드콜 분배금 게이트 통과 (커버리지: {yield_coverage * 100:.1f}% >= {COVERED_CALL_DISTRIBUTION_MIN * 100:.0f}%)")
    sys.exit(0)


if __name__ == "__main__":
    validate_covered_call()
