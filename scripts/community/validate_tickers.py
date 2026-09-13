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
  - 브랜드명과 스크리너의 issuerName이 불일치하면 ERROR 처리
"""

import json
import re
import sys
import argparse
from pathlib import Path
from typing import Optional

# Windows PowerShell UTF-8 출력 설정
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent.parent
POSTS_FILE = ROOT / "public" / "mock-community-posts.json"
SCREENER_FILE = ROOT / "public" / "data" / "screener.json"

# 운용사 ID → 브랜드 접두사 매핑 (screener.json issuerId 기준)
ISSUER_BRAND_MAP = {
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

BRAND_ISSUER_MAP: dict[str, str] = {}
for issuer_id, brands in ISSUER_BRAND_MAP.items():
    for brand in brands:
        BRAND_ISSUER_MAP[brand] = issuer_id


def load_screener() -> dict[str, dict]:
    """screener.json에서 ticker → {name, issuerId} 매핑 로드"""
    with open(SCREENER_FILE, encoding="utf-8") as f:
        data = json.load(f)
    etfs = data if isinstance(data, list) else data.get("etfs", data.get("data", []))
    result = {}
    for etf in etfs:
        ticker = str(etf.get("ticker", "") or etf.get("code", ""))
        if len(ticker) == 6 and ticker.isdigit():
            name = etf.get("name", "")
            issuer = etf.get("issuer", {})
            if isinstance(issuer, str):
                # Sometimes issuer is a serialized dict string
                try:
                    issuer = eval(issuer)  # noqa: S307
                except Exception:
                    issuer = {}
            issuer_id = issuer.get("issuerId", "") if isinstance(issuer, dict) else ""
            result[ticker] = {"name": name, "issuerId": issuer_id}
    return result


def extract_tickers_with_context(text: str) -> list[tuple[str, str]]:
    """텍스트에서 (티커코드, 앞뒤30자 컨텍스트) 추출"""
    results = []
    for m in re.finditer(r"\((\d{6})\)", text):
        ticker = m.group(1)
        start = max(0, m.start() - 30)
        end = min(len(text), m.end() + 30)
        ctx = text[start:end].replace("\n", " ")
        results.append((ticker, ctx))
    return results


def detect_brand_in_context(ctx: str) -> str | None:
    """컨텍스트에서 브랜드명 추출"""
    for brand in BRAND_ISSUER_MAP:
        if brand in ctx:
            return brand
    return None


def validate_posts(strict: bool = False, as_json: bool = False) -> int:
    """
    Returns:
        0 = 통과
        1 = WARNING (strict 모드에서는 1 반환)
        2 = ERROR
    """
    screener = load_screener()

    with open(POSTS_FILE, encoding="utf-8") as f:
        data = json.load(f)

    posts = data["posts"]

    warnings: list[dict] = []
    errors: list[dict] = []

    for post in posts:
        slug = post["slug"]
        full_text = (
            post.get("title", "")
            + " "
            + post.get("excerpt", "")
            + " "
            + post.get("bodyText", "")
        )

        ticker_ctx_pairs = extract_tickers_with_context(full_text)

        for ticker, ctx in ticker_ctx_pairs:
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

            # 브랜드 불일치 검사
            brand = detect_brand_in_context(ctx)
            if brand:
                expected_issuer = BRAND_ISSUER_MAP.get(brand)
                if expected_issuer and expected_issuer != screener_issuer:
                    errors.append({
                        "slug": slug,
                        "ticker": ticker,
                        "issue": "BRAND_MISMATCH",
                        "found_brand": brand,
                        "expected_brand": [b for b, i in BRAND_ISSUER_MAP.items() if i == screener_issuer],
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
            print(f"[ERROR] {len(errors)} BRAND/TICKER ERROR(S) FOUND:")
            for e in errors:
                print(f"  [{e['slug'][:40]}] {e['ticker']} -- {e['issue']}")
                print(f"    found: {e['found_brand']}  expected: {e.get('expected_brand', '?')}")
                print(f"    screener name: {e['screener_name']}")
                print(f"    ctx: ...{e['context']}...")
        else:
            print(f"[OK] No brand/ticker errors found in {len(posts)} posts.")

        if warnings:
            print(f"\n[WARN] {len(warnings)} ticker(s) not found in screener (may be new products):")
            for w in warnings:
                print(f"  [{w['slug'][:40]}] {w['ticker']} -- {w['issue']}")
        else:
            print("[OK] All tickers found in screener.")

    exit_code = 0
    if errors:
        exit_code = 2
    elif warnings and strict:
        exit_code = 1
    return exit_code


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ETF 커뮤니티 게시글 티커 검증기")
    parser.add_argument("--json", action="store_true", help="JSON 리포트 출력")
    parser.add_argument("--strict", action="store_true", help="WARNING도 exit code 1로 처리")
    args = parser.parse_args()

    code = validate_posts(strict=args.strict, as_json=args.json)
    sys.exit(code)
