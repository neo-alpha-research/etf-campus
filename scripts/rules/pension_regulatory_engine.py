#!/usr/bin/env python3
"""Statutory Pension & ISA Classification Engine.

Implements statutory regulatory rules under:
1. 근로자퇴직급여 보장법 (근퇴법) 제25조
2. 퇴직연금감독규정 제9조(운용방법 및 기준), 제11조(적립금 운용방법의 제한), [별표 1]
3. 조세특례제한법 제91조의18 (개인종합자산관리계좌 ISA 과세특례)
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from typing import Any, Mapping

# ---------------------------------------------------------------------------
# Regulatory Classification Constants
# ---------------------------------------------------------------------------
PENSION_ELIGIBLE = "가능"
PENSION_INELIGIBLE = "불가"

LIMIT_SAFE_ASSET = "100% (안전자산)"
LIMIT_RISK_ASSET = "70% (위험자산)"
LIMIT_INELIGIBLE = "불가"

ISA_ELIGIBLE = "가능"
ISA_INELIGIBLE = "불가"


def classify_pension_and_isa(row: Mapping[str, Any]) -> dict[str, str]:
    """Classify a single ETF according to statutory Pension (DC/IRP) and ISA regulations.

    Returns:
        dict with keys:
            - pension_eligible: "적격" | "불가"
            - pension_limit: "100% (안전자산)" | "70% (위험자산)" | "불가"
            - isa_eligible: "가능" | "불가"
            - pension_reason: descriptive legal/regulatory basis
    """
    ticker = str(row.get("ticker") or "").strip()
    name = str(row.get("name") or "").strip()
    base_index = str(row.get("base_index") or "").strip()
    risk = str(row.get("risk_type") or "normal").strip().lower()
    asset = str(row.get("asset_class") or "").strip()

    # -----------------------------------------------------------------------
    # 1. ISA 편입 적격 판별 (조세특례제한법 제91조의18)
    # -----------------------------------------------------------------------
    # 2021년 법령 개정: 국내 상장 레버리지/인버스 ETF는 ISA 계좌 편입 전면 금지
    if risk in ("leverage", "inverse"):
        isa_eligible = ISA_INELIGIBLE
    else:
        # 그 외 국내 상장 ETF (1배수 원자재·통화 선물, 파킹, 리츠, 주식형 등) 100% 가능
        isa_eligible = ISA_ELIGIBLE

    # -----------------------------------------------------------------------
    # 2. 퇴직연금 (DC/IRP) 편입 적격 판별 (퇴직연금감독규정 제9조 및 제11조)
    # -----------------------------------------------------------------------
    # 2-1) 레버리지 / 인버스: 파생상품 순위험평가액 40% 초과로 절대 불가
    if risk in ("leverage", "inverse"):
        return {
            "pension_eligible": PENSION_INELIGIBLE,
            "pension_limit": LIMIT_INELIGIBLE,
            "isa_eligible": isa_eligible,
            "pension_reason": "레버리지/인버스 파생평가액 초과 (감독규정 제9조 위반)",
        }

    # 2-2) 파생상품(선물) 기반 고위험 자산 배제
    # 원자재 선물, 통화 선물, VIX 선물, 국채선물 등 파생평가액 40% 초과 종목
    # 단, '현물'(KRX금현물 등)은 실물 기반이므로 적격
    is_spot = "현물" in name
    has_futures_keyword = bool(
        re.search(r"선물|Futures", f"{name} {base_index}", re.IGNORECASE)
    )

    if has_futures_keyword and not is_spot:
        return {
            "pension_eligible": PENSION_INELIGIBLE,
            "pension_limit": LIMIT_INELIGIBLE,
            "isa_eligible": isa_eligible,
            "pension_reason": "선물 기반 파생 위험평가액 40% 초과 (감독규정 제9조 위반)",
        }

    # -----------------------------------------------------------------------
    # 3. 퇴직연금 계좌 내 편입 한도 판정 (100% 안전자산 vs 70% 위험자산)
    # -----------------------------------------------------------------------
    # 감독규정 제11조: 계좌 잔고의 최대 70%까지만 위험자산 투자 가능.
    # 안전자산(100% 투자 가능, 30% 의무바스켓 충족 종목) 기준:
    #   (1) 순수 채권형 (asset == '채권')
    #   (2) 금리·파킹형 (asset == '금리·파킹')
    #   (3) 적격 채권혼합형 (주식 비중 50% 이하)
    #   (4) 적격 TDF (Glide-path 기반 금융위 등록 적격 TDF)
    #   (5) TRF3070 / TRF5050 / TIF 등 주식비중 50% 이하 멀티에셋
    pension_eligible = PENSION_ELIGIBLE
    is_safe = False
    reason = "위험자산 (계좌 내 70% 한도)"

    if asset == "금리·파킹":
        is_safe = True
        reason = "금리·파킹형 안전자산 (100% 투자 가능)"
    elif asset == "채권":
        is_safe = True
        reason = "채권형 안전자산 (100% 투자 가능)"
    elif "TDF" in name:
        # 모든 적격 TDF ETF는 금융위 등록 적격 TDF로 안전자산 100% 인정
        is_safe = True
        reason = "적격 TDF 안전자산 (100% 투자 가능)"
    elif "TRF3070" in name or "TRF5050" in name or "TIF" in name:
        is_safe = True
        reason = "주식비중 50% 이하 자산배분 안전자산 (100% 투자 가능)"
    elif any(kw in name for kw in ["채권혼합", "혼합50", "국채혼합50"]):
        is_safe = True
        reason = "적격 채권혼합형(주식 50% 이하) 안전자산 (100% 투자 가능)"

    pension_limit = LIMIT_SAFE_ASSET if is_safe else LIMIT_RISK_ASSET

    return {
        "pension_eligible": pension_eligible,
        "pension_limit": pension_limit,
        "isa_eligible": isa_eligible,
        "pension_reason": reason,
    }


def process_csv(master_path: Path, output_path: Path) -> dict[str, Any]:
    """Process an ETF master CSV and enrich with regulatory pension & ISA tags."""
    with master_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        rows = list(reader)

    # Ensure new fields exist in header
    for col in ("pension_limit", "isa_eligible"):
        if col not in fields:
            fields.append(col)

    stats = {
        "total": len(rows),
        "pension_eligible": 0,
        "pension_ineligible": 0,
        "safe_asset_100": 0,
        "risk_asset_70": 0,
        "isa_eligible": 0,
        "isa_ineligible": 0,
    }

    for row in rows:
        reg = classify_pension_and_isa(row)
        # Update row
        row["pension_eligible"] = reg["pension_eligible"]
        row["pension_limit"] = reg["pension_limit"]
        row["isa_eligible"] = reg["isa_eligible"]

        if reg["pension_eligible"] == PENSION_ELIGIBLE:
            stats["pension_eligible"] += 1
        else:
            stats["pension_ineligible"] += 1

        if reg["pension_limit"] == LIMIT_SAFE_ASSET:
            stats["safe_asset_100"] += 1
        elif reg["pension_limit"] == LIMIT_RISK_ASSET:
            stats["risk_asset_70"] += 1

        if reg["isa_eligible"] == ISA_ELIGIBLE:
            stats["isa_eligible"] += 1
        else:
            stats["isa_ineligible"] += 1

    with output_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--master",
        type=Path,
        default=Path("data/etf_master_draft.csv"),
        help="Path to input master CSV",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/etf_master_draft.csv"),
        help="Path to output enriched CSV",
    )
    args = parser.parse_args()

    stats = process_csv(args.master, args.output)
    print(f"Enriched {stats['total']} ETFs at {args.output}")
    print(f"  - 퇴직연금 적격: {stats['pension_eligible']:,} | 불가: {stats['pension_ineligible']:,}")
    print(f"    * 100% 안전자산: {stats['safe_asset_100']:,}")
    print(f"    * 70% 위험자산: {stats['risk_asset_70']:,}")
    print(f"  - ISA 가능: {stats['isa_eligible']:,} | 불가: {stats['isa_ineligible']:,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
