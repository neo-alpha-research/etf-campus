#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/community/validate_tickers.py
--------------------------------------
ETF 캠퍼스 커뮤니티 게시글 티커 자동 검증기.

public/mock-community-posts.json 내 6자리 종목코드를
public/data/screener.json 실데이터와 교차 검증합니다.

사용법:
  python scripts/community/validate_tickers.py
  python scripts/community/validate_tickers.py --json     # JSON 리포트 출력
  python scripts/community/validate_tickers.py --strict   # 오류 시 exit code 1

Zero-Hallucination 정책:
  - 스크리너에 존재하지 않는 티커를 게시글에 사용하면 WARNING 처리
  - 브랜드명과 스크리너의 issuerId가 불일치하면 ERROR 처리
"""

import io
import json
import re
import sys
import argparse
from pathlib import Path

# Windows PowerShell UTF-8 출력 설정
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent.parent
POSTS_FILE = ROOT / "public" / "mock-community-posts.json"
SCREENER_FILE = ROOT / "public" / "data" / "screener.json"

# 운용사 issuerId → 허용 브랜드 접두사 매핑 (screener.json issuerId 기준)
ISSUER_BRAND_MAP: dict[str, list[str]] = {
    "samsung": ["KODEX"],
    "miraeasset": ["TIGER"],
    "koreainvestment": ["ACE"],
    "shinhan": ["SOL"],
    "kb": ["KBSTAR", "RISE"],
    "hanaro": ["HANARO"],
    "db": ["DBETF"],
    "nh": ["NHQV"],
    "kiwoom": ["KIWOOM"],
    "hanwha": ["PLUS"],
    "timefolio": ["TIME"],
}

# 역방향: 브랜드 접두사 → issuerId
BRAND_ISSUER_MAP: dict[str, str] = {
    brand: issuer_id
    for issuer_id, brands in ISSUER_BRAND_MAP.items()
    for brand in brands
}

# 브랜드 접두사 내림차순 정렬 (긴 것 먼저 매칭)
_BRANDS_SORTED = sorted(BRAND_ISSUER_MAP.keys(), key=len, reverse=True)

# 티커 바로 앞 최대 탐색 거리 (chars)
_BRAND_LOOKAHEAD = 20


def load_screener() -> dict[str, dict]:
    """screener.json에서 ticker → {name, issuerId} 매핑 로드"""
    with open(SCREENER_FILE, encoding="utf-8") as f:
        data = json.load(f)
    etfs: list[dict] = data if isinstance(data, list) else data.get("etfs", data.get("data", []))
    result: dict[str, dict] = {}
    for etf in etfs:
        ticker = str(etf.get("ticker", "") or etf.get("code", ""))
        if len(ticker) == 6 and ticker.isdigit():
            name = etf.get("name", "")
            raw_issuer = etf.get("issuer", {})
            if isinstance(raw_issuer, str):
                try:
                    raw_issuer = json.loads(raw_issuer)
                except (json.JSONDecodeError, ValueError):
                    raw_issuer = {}
            issuer_id = raw_issuer.get("issuerId", "") if isinstance(raw_issuer, dict) else ""
            result[ticker] = {"name": name, "issuerId": issuer_id}
    return result


def find_brand_before_ticker(text: str, ticker_start: int) -> str | None:
    """
    티커 코드 '(XXXXXX)' 직전 _BRAND_LOOKAHEAD 문자 내에서
    가장 가까이(오른쪽) 위치한 브랜드 접두사를 반환합니다.

    규칙:
    - 브랜드 앞에는 공백·구두점 등 비알파뉴메릭 문자가 와야 합니다
      (예: "단기채권PLUS"의 PLUS는 브랜드가 아니므로 제외)
    - 후보 중 가장 오른쪽(티커에 가장 가까운) 것을 반환합니다
      (예: "TIGER(458730), ACE(402970)" → ACE 반환)
    """
    window_start = max(0, ticker_start - _BRAND_LOOKAHEAD)
    window = text[window_start:ticker_start]
    best_brand: str | None = None
    best_pos = -1
    for brand in _BRANDS_SORTED:
        start = 0
        while True:
            pos = window.find(brand, start)
            if pos == -1:
                break
            # 브랜드 앞이 단어 경계인지 확인 (비알파뉴메릭 또는 창 첫 글자)
            preceded_by_boundary = (pos == 0) or (not window[pos - 1].isalnum())
            if preceded_by_boundary and pos > best_pos:
                best_pos = pos
                best_brand = brand
            start = pos + 1
    return best_brand


def validate_posts(strict: bool = False, as_json: bool = False) -> int:
    """
    Returns:
        0 = 통과 (오류 없음)
        1 = WARNING (strict 모드에서 경고가 있을 때)
        2 = ERROR (브랜드-티커 불일치 발견)
    """
    screener = load_screener()

    with open(POSTS_FILE, encoding="utf-8") as f:
        data = json.load(f)

    posts: list[dict] = data["posts"]
    warnings: list[dict] = []
    errors: list[dict] = []

    for post in posts:
        slug = post["slug"]
        full_text = " ".join([
            post.get("title", ""),
            post.get("excerpt", ""),
            post.get("bodyText", ""),
        ])

        for m in re.finditer(r"\((\d{6})\)", full_text):
            ticker = m.group(1)
            ctx_start = max(0, m.start() - 25)
            ctx = full_text[ctx_start: m.end() + 10].replace("\n", " ")

            if ticker not in screener:
                warnings.append({
                    "slug": slug,
                    "ticker": ticker,
                    "issue": "NOT_IN_SCREENER",
                    "context": ctx,
                })
                continue

            screener_info = screener[ticker]
            screener_issuer = screener_info["issuerId"]
            screener_name = screener_info["name"]

            brand = find_brand_before_ticker(full_text, m.start())
            if brand:
                expected_issuer = BRAND_ISSUER_MAP.get(brand)
                if expected_issuer and expected_issuer != screener_issuer:
                    correct_brands = [b for b, i in BRAND_ISSUER_MAP.items() if i == screener_issuer]
                    errors.append({
                        "slug": slug,
                        "ticker": ticker,
                        "issue": "BRAND_MISMATCH",
                        "found_brand": brand,
                        "correct_brands": correct_brands,
                        "screener_name": screener_name,
                        "context": ctx,
                    })

    report = {
        "total_posts": len(posts),
        "errors": errors,
        "warnings": warnings,
        "passed": len(errors) == 0,
    }

    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        if errors:
            print(f"[ERROR] {len(errors)} brand/ticker mismatch(es) found:")
            for e in errors:
                print(f"  slug : {e['slug'][:50]}")
                print(f"  ticker  : {e['ticker']} ({e['screener_name']})")
                print(f"  written : {e['found_brand']}  ->  correct: {e['correct_brands']}")
                print(f"  context : ...{e['context']}...")
                print()
        else:
            print(f"[OK] No brand/ticker errors in {len(posts)} posts.")

        if warnings:
            print(f"[WARN] {len(warnings)} ticker(s) not found in screener:")
            for w in warnings:
                print(f"  {w['ticker']} in {w['slug'][:50]}")
        else:
            print("[OK] All tickers present in screener.")

    exit_code = 0
    if errors:
        exit_code = 2
    elif warnings and strict:
        exit_code = 1
    return exit_code


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ETF community post ticker validator")
    parser.add_argument("--json", action="store_true", help="Output JSON report")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as errors (exit 1)")
    args = parser.parse_args()
    sys.exit(validate_posts(strict=args.strict, as_json=args.json))
