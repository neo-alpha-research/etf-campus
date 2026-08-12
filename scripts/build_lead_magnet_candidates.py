"""Build page-level ETF candidate pools and provisional AUM selections.

The output is intentionally provisional. It ranks only candidates that pass the
currently available structural, classification, AUM, and history gates. Final
publication still requires raw total-return, distribution, holdings, cost, and
strategy-change evidence.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AI_RE = re.compile(r"(?<![A-Z])AI(?![A-Z])|인공지능|ARTIFICIAL\s+INTELLIGENCE", re.IGNORECASE)
# AI 생태계 확장어. 포괄적인 TECH/테크 단독 표현은 우주테크·바이오테크까지
# 오분류할 수 있어 제외하고, 공식 명칭에서 산업 범위를 식별할 수 있는 표현만 쓴다.
AI_ECOSYSTEM_RE = re.compile(
    r"클라우드|CLOUD|소프트웨어|SOFTWARE|플랫폼|PLATFORM|빅테크|BIG\s*TECH|"
    r"정보기술|INFORMATION\s+TECHNOLOGY|(?<![A-Z])IT(?![A-Z])|"
    r"반도체|SEMICONDUCTOR|HBM|DATA\s*CENTER|데이터센터|"
    r"로봇|로보틱스|ROBOTICS?|자동화|AUTOMATION",
    re.IGNORECASE,
)
AI_CANDIDATE_RE = re.compile(
    rf"(?:{AI_RE.pattern})|(?:{AI_ECOSYSTEM_RE.pattern})",
    re.IGNORECASE,
)
ELIGIBLE_CLASSIFICATION_STATUSES = {"confirmed", "confirmed_ecosystem"}
COVERED_CALL_RE = re.compile(r"커버드콜|콜매도|COVERED\s+CALL|OPTION\s+PREMIUM|옵션\s*프리미엄", re.IGNORECASE)
MIXED_ASSET_RE = re.compile(r"채권|국채|혼합|TREASUR|BOND|SOFR|CD금리|머니마켓", re.IGNORECASE)
HEDGED_RE = re.compile(r"\(H\)|환헤지", re.IGNORECASE)
DIVIDEND_RE = re.compile(r"배당|DIVIDEND", re.IGNORECASE)


def read_csv(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        return list(reader), list(reader.fieldnames or [])


def write_csv(path: Path, rows: list[dict[str, object]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def decimal_value(value: object) -> Decimal:
    text = str(value or "0").replace(",", "").strip()
    try:
        return Decimal(text or "0")
    except InvalidOperation:
        return Decimal(0)


def normalized_text(*values: object) -> str:
    return " ".join(str(value or "") for value in values).upper()


def load_classification(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    rows, _ = read_csv(path)
    return {row["ticker"]: row for row in rows if row.get("ticker")}


def load_official_validation(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    rows, _ = read_csv(path)
    return {row["ticker"]: row for row in rows if row.get("ticker")}


def effective_classification(master: dict[str, str], review: dict[str, str]) -> tuple[str, str, str]:
    market = str(review.get("final_market_scope") or review.get("suggested_market_scope") or "").strip()
    asset = str(review.get("final_asset_class") or review.get("suggested_asset_class") or master.get("asset_class") or "").strip()
    strategy = str(review.get("suggested_strategy") or "일반").strip()
    return market, asset, strategy


def region_code(market: str) -> str:
    return {
        "국내": "korea",
        "한국": "korea",
        "미국": "us",
        "글로벌": "global",
    }.get(market, "other")


def has_full_history(row: dict[str, str], returns: dict[str, str], as_of: str, years: int) -> bool:
    """Reject since-inception fallbacks that merely populate a period return field."""
    field = "r_12m" if years == 1 else "r_36m"
    if not str(returns.get(field) or "").strip():
        return False
    if years == 1 and str(returns.get("new_12m") or "").strip().upper() == "Y":
        return False
    listing_text = str(row.get("listing_date") or "").strip()
    if len(listing_text) == 8 and listing_text.isdigit():
        listing_day = datetime.strptime(listing_text, "%Y%m%d").date()
        as_of_day = datetime.strptime(as_of, "%Y%m%d").date()
        if (as_of_day - listing_day).days < years * 365:
            return False
    return True


def common_exclusions(row: dict[str, str], asset: str, strategy: str) -> list[str]:
    text = normalized_text(row.get("name"), row.get("base_index"), strategy)
    codes: list[str] = []
    if decimal_value(row.get("aum")) <= 0:
        codes.append("AUM_MISSING")
    risk = str(row.get("risk_type") or "").lower()
    if risk in {"leverage", "inverse"}:
        codes.append("STRUCTURE_EXCLUDED")
    if COVERED_CALL_RE.search(text):
        codes.append("STRUCTURE_EXCLUDED")
    if re.search(r"버퍼|단일종목", text, re.IGNORECASE):
        codes.append("STRUCTURE_EXCLUDED")
    if asset in {"채권", "혼합자산", "혼합·자산배분", "금리·파킹", "원자재", "통화"}:
        codes.append("ASSET_CLASS_NOT_EQUITY")
    if MIXED_ASSET_RE.search(text) and asset != "주식":
        codes.append("ASSET_CLASS_NOT_EQUITY")
    return sorted(set(codes))


def standard_index_bucket(name: str, base_index: str) -> str | None:
    index = re.sub(r"\s+", " ", base_index.upper()).strip()
    product = name.upper()
    if re.fullmatch(r"코스피\s*200(?:\s*TR)?", index):
        return "kospi200"
    if re.fullmatch(r"S&P\s*500(?:\s*(?:PR|NR|TR|INDEX))?", index):
        return "sp500"
    if re.fullmatch(r"NASDAQ[-\s]*100(?:\s*(?:PR|NR|TR|INDEX))?", index):
        return "nasdaq100"
    if "액티브" in product:
        return None
    return None


def dividend_bucket(row: dict[str, str], region: str) -> tuple[str | None, str]:
    name = str(row.get("name") or "")
    base = str(row.get("base_index") or "")
    text = normalized_text(name, base)
    if not DIVIDEND_RE.search(text):
        return None, "not_dividend"
    if COVERED_CALL_RE.search(text) or MIXED_ASSET_RE.search(text):
        return None, "excluded_structure"
    if re.search(r"리츠|REIT|우선주|PREFERRED", text, re.IGNORECASE):
        return None, "excluded_adjacent_strategy"
    bucket = {"korea": "korea_dividend", "us": "us_dividend"}.get(region)
    if not bucket:
        return None, "region_not_in_scope"
    evidence = "confirmed" if DIVIDEND_RE.search(base) else "manual_review"
    return bucket, evidence


THEME_PATTERNS = {
    "ai_semiconductor": re.compile(r"반도체|SEMICONDUCTOR|HBM|MEMORY", re.IGNORECASE),
    "ai_it_bigtech": re.compile(r"빅테크|BIG\s*TECH|정보기술|INFORMATION\s+TECHNOLOGY|(?<![A-Z])IT(?![A-Z])|AI테크|AI\s*TECH|미국테크|차이나테크|글로벌테크", re.IGNORECASE),
    "ai_platform_software": re.compile(r"소프트웨어|SOFTWARE|플랫폼|PLATFORM|클라우드|CLOUD", re.IGNORECASE),
    "ai_infrastructure_power": re.compile(r"전력|전력기기|인프라|INFRASTRUCTURE|DATA\s*CENTER|데이터센터|광통신|NETWORK|네트워크|SMR", re.IGNORECASE),
    "ai_robotics_automation": re.compile(r"로봇|로보틱스|ROBOT|ROBOTICS|피지컬\s*AI|PHYSICAL\s*AI|자동화", re.IGNORECASE),
    "ai_healthcare": re.compile(r"의료|헬스케어|HEALTH|진단|신약", re.IGNORECASE),
    "ai_mobility": re.compile(r"모빌리티|MOBILITY|자율주행|AUTONOMOUS|차량용", re.IGNORECASE),
}


def ai_theme(row: dict[str, str]) -> tuple[str | None, str]:
    name = str(row.get("name") or "")
    base = str(row.get("base_index") or "")
    text = normalized_text(name, base)
    has_direct_ai = bool(AI_RE.search(text))
    has_ecosystem_scope = bool(AI_ECOSYSTEM_RE.search(text))
    if not has_direct_ai and not has_ecosystem_scope:
        return None, "not_ai"
    matches = [key for key, pattern in THEME_PATTERNS.items() if pattern.search(text)]
    if len(matches) > 1:
        return None, "manual_review_theme_conflict"
    if len(matches) == 1:
        base_has_theme = bool(THEME_PATTERNS[matches[0]].search(base))
        base_has_ai = bool(AI_RE.search(base))
        if has_direct_ai:
            return matches[0], "confirmed" if base_has_theme and base_has_ai else "manual_review"
        base_has_ecosystem_scope = bool(AI_ECOSYSTEM_RE.search(base))
        status = "confirmed_ecosystem" if base_has_theme and base_has_ecosystem_scope else "manual_review"
        return matches[0], status
    return ("broad_ai_value_chain", "manual_review") if has_direct_ai else (None, "manual_review")


def candidate_row(
    page_id: str,
    bucket: str,
    row: dict[str, str],
    region: str,
    theme: str,
    classification_status: str,
    exclusions: list[str],
) -> dict[str, object]:
    return {
        "page_id": page_id,
        "bucket": bucket,
        "theme_key": theme,
        "region": region,
        "isin": row.get("isin_cd", ""),
        "ticker": row.get("ticker", ""),
        "name": row.get("name", ""),
        "base_index": row.get("base_index", ""),
        "aum_krw": str(row.get("aum") or "0").replace(",", ""),
        "classification_status": classification_status,
        "eligibility_status": "eligible"
        if not exclusions and classification_status in ELIGIBLE_CLASSIFICATION_STATUSES
        else "excluded_or_review",
        "exclusion_codes": ";".join(sorted(set(exclusions))),
        "aum_rank_in_bucket": "",
        "selection_rank": "",
        "selection_status": "not_selected",
        "selection_reason": "",
        "official_validation_status": "",
        "official_source_url": "",
        "official_evidence_summary": "",
        "strategy_change_status": "",
    }


def apply_page3_official_validations(
    candidates: list[dict[str, object]], validations: dict[str, dict[str, str]]
) -> None:
    for row in candidates:
        if row["page_id"] != "ai_momentum":
            continue
        validation = validations.get(str(row["ticker"]))
        if not validation:
            continue

        theme = str(validation.get("validated_theme") or row["theme_key"])
        status = str(validation.get("validation_status") or row["classification_status"])
        row["bucket"] = theme
        row["theme_key"] = theme
        row["region"] = str(validation.get("validated_region") or row["region"])
        row["classification_status"] = status
        row["official_validation_status"] = status
        row["official_source_url"] = str(validation.get("source_url") or "")
        row["official_evidence_summary"] = str(validation.get("evidence_summary") or "")
        strategy_change = str(validation.get("strategy_change_status") or "")
        row["strategy_change_status"] = strategy_change

        exclusions = set(filter(None, str(row["exclusion_codes"]).split(";")))
        if status in ELIGIBLE_CLASSIFICATION_STATUSES:
            exclusions.discard("CLASSIFICATION_UNCONFIRMED")
        if strategy_change == "material_change_within_1y":
            exclusions.add("STRATEGY_CHANGE_IN_WINDOW")
        row["exclusion_codes"] = ";".join(sorted(exclusions))
        row["eligibility_status"] = (
            "eligible"
            if not exclusions and status in ELIGIBLE_CLASSIFICATION_STATUSES
            else "excluded_or_review"
        )


def build_candidates(
    config: dict,
    master_rows: list[dict[str, str]],
    return_rows: list[dict[str, str]],
    classifications: dict[str, dict[str, str]],
) -> list[dict[str, object]]:
    as_of = str(master_rows[0].get("bas_dt") or "") if master_rows else ""
    returns_by_ticker = {row["ticker"]: row for row in return_rows}
    candidates: list[dict[str, object]] = []

    for row in master_rows:
        ticker = row.get("ticker", "")
        review = classifications.get(ticker, {})
        market, asset, strategy = effective_classification(row, review)
        region = region_code(market)
        base_exclusions = common_exclusions(row, asset, strategy)
        returns = returns_by_ticker.get(ticker, {})

        index_bucket = standard_index_bucket(str(row.get("name") or ""), str(row.get("base_index") or ""))
        if index_bucket:
            exclusions = list(base_exclusions)
            if HEDGED_RE.search(normalized_text(row.get("name"))):
                exclusions.append("FX_HEDGED")
            if "액티브" in normalized_text(row.get("name")):
                exclusions.append("STRUCTURE_EXCLUDED")
            if not has_full_history(row, returns, as_of, 3):
                exclusions.append("HISTORY_3Y_MISSING")
            candidates.append(candidate_row("long_term_core", index_bucket, row, region, "", "confirmed", exclusions))

        dividend, dividend_status = dividend_bucket(row, region)
        if DIVIDEND_RE.search(normalized_text(row.get("name"), row.get("base_index"))):
            exclusions = list(base_exclusions)
            if HEDGED_RE.search(normalized_text(row.get("name"))):
                exclusions.append("FX_HEDGED")
            if not has_full_history(row, returns, as_of, 1):
                exclusions.append("HISTORY_1Y_MISSING")
            if dividend is None:
                exclusions.append("DIVIDEND_SCOPE_EXCLUDED")
                dividend = "unassigned_dividend"
            if dividend_status == "manual_review":
                exclusions.append("CLASSIFICATION_UNCONFIRMED")
            candidates.append(candidate_row("dividend_income", dividend, row, region, "", dividend_status, exclusions))

        theme, ai_status = ai_theme(row)
        if AI_CANDIDATE_RE.search(normalized_text(row.get("name"), row.get("base_index"))):
            exclusions = list(base_exclusions)
            if HEDGED_RE.search(normalized_text(row.get("name"))):
                exclusions.append("FX_HEDGED")
            if not has_full_history(row, returns, as_of, 1):
                exclusions.append("HISTORY_1Y_MISSING")
            if theme is None:
                exclusions.append("CLASSIFICATION_UNCONFIRMED")
                theme = "unassigned_ai"
            if ai_status not in ELIGIBLE_CLASSIFICATION_STATUSES:
                exclusions.append("CLASSIFICATION_UNCONFIRMED")
            candidates.append(candidate_row("ai_momentum", theme, row, region, theme, ai_status, exclusions))

    return candidates


def rank_and_select(candidates: list[dict[str, object]]) -> None:
    eligible_groups: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    for row in candidates:
        if row["eligibility_status"] == "eligible":
            eligible_groups[(str(row["page_id"]), str(row["bucket"]))].append(row)

    for (page_id, _), rows in eligible_groups.items():
        rows.sort(key=lambda item: (-decimal_value(item["aum_krw"]), str(item["ticker"])))
        for rank, row in enumerate(rows, start=1):
            row["aum_rank_in_bucket"] = rank
        if page_id == "long_term_core":
            selected = rows[:1]
        elif page_id == "dividend_income":
            selected = rows[:3]
        elif page_id == "ai_momentum":
            selected = rows[:1]
        else:
            selected = []
        for row in selected:
            row["selection_status"] = "theme_representative" if page_id == "ai_momentum" else "provisional_selected"
            row["selection_reason"] = "eligible bucket AUM leader" if len(selected) == 1 else "eligible bucket AUM top 3"
            if page_id != "ai_momentum":
                row["selection_rank"] = row["aum_rank_in_bucket"]

    ai_representatives = [
        row for row in candidates if row["page_id"] == "ai_momentum" and row["selection_status"] == "theme_representative"
    ]
    ai_representatives.sort(key=lambda item: (-decimal_value(item["aum_krw"]), str(item["ticker"])))
    for rank, row in enumerate(ai_representatives[:5], start=1):
        row["selection_status"] = "provisional_selected"
        row["selection_rank"] = rank
        row["selection_reason"] = "theme AUM leader; top 5 among theme representatives"


def validate_selection(selected: list[dict[str, object]]) -> dict[str, bool]:
    expected_counts = {"long_term_core": 3, "dividend_income": 6, "ai_momentum": 5}
    actual_counts = defaultdict(int)
    for row in selected:
        actual_counts[str(row["page_id"])] += 1
    if dict(actual_counts) != expected_counts:
        raise RuntimeError(f"Selection count invariant failed: {dict(actual_counts)}")

    ai_rows = [row for row in selected if row["page_id"] == "ai_momentum"]
    themes = [str(row["theme_key"]) for row in ai_rows]
    if len(themes) != len(set(themes)):
        raise RuntimeError("AI_THEME_DUPLICATE")
    if sorted(int(row["selection_rank"]) for row in ai_rows) != [1, 2, 3, 4, 5]:
        raise RuntimeError("AI_SELECTION_RANK_INVALID")
    regions = {str(row["region"]) for row in ai_rows}
    if "korea" not in regions or not regions.intersection({"us", "global"}):
        raise RuntimeError("AI_REGION_COVERAGE_FAIL")

    for row in selected:
        rank = int(row["aum_rank_in_bucket"])
        if row["page_id"] in {"long_term_core", "ai_momentum"} and rank != 1:
            raise RuntimeError(f"AUM_SELECTION_INVARIANT_FAIL: {row['ticker']}")
        if row["page_id"] == "dividend_income" and rank > 3:
            raise RuntimeError(f"AUM_SELECTION_INVARIANT_FAIL: {row['ticker']}")
    return {
        "page_counts_match": True,
        "ai_themes_unique": True,
        "ai_selection_ranks_valid": True,
        "ai_region_coverage": True,
        "aum_ranks_valid": True,
    }


FIELDS = [
    "page_id",
    "bucket",
    "theme_key",
    "region",
    "isin",
    "ticker",
    "name",
    "base_index",
    "aum_krw",
    "aum_rank_in_bucket",
    "selection_rank",
    "classification_status",
    "eligibility_status",
    "exclusion_codes",
    "selection_status",
    "selection_reason",
    "official_validation_status",
    "official_source_url",
    "official_evidence_summary",
    "strategy_change_status",
]


def format_aum(value: object) -> str:
    amount = decimal_value(value)
    if amount >= Decimal("1000000000000"):
        return f"{amount / Decimal('1000000000000'):.2f}조원"
    return f"{amount / Decimal('100000000'):.0f}억원"


def review_markdown(selected: list[dict[str, object]], review: list[dict[str, object]], as_of: str) -> str:
    labels = {
        "long_term_core": "페이지 1 - 장기 적립형",
        "dividend_income": "페이지 2 - 배당형",
        "ai_momentum": "페이지 3 - AI 모멘텀",
    }
    lines = [
        "# ETF Campus 리드 마그넷 선정 검수 초안",
        "",
        f"- 기준일: {as_of}",
        "- 상태: 잠정 선정·발행 불가",
        "- 선정 기준: 현재 확보 데이터의 적격성 검사를 통과한 상품 중 순자산총액 상위",
        "",
        "> 이 문서는 최종 추천 목록이 아니다. 분배금 포함 총수익률, 공식 편입종목, 전략 변경 및 원본 API 검증 전에는 PDF에 사용하지 않는다.",
        "",
    ]
    for page_id in ("long_term_core", "dividend_income", "ai_momentum"):
        lines.extend(
            [
                f"## {labels[page_id]}",
                "",
                "| 버킷·테마 | 지역 | ETF | 순자산 | 선정 순위 |",
                "| --- | --- | --- | ---: | ---: |",
            ]
        )
        page_rows = [row for row in selected if row["page_id"] == page_id]
        if page_id == "ai_momentum":
            page_rows.sort(key=lambda row: int(row["selection_rank"]))
        else:
            page_rows.sort(key=lambda row: (str(row["bucket"]), int(row["selection_rank"])))
        for row in page_rows:
            bucket = str(row["theme_key"] or row["bucket"])
            lines.append(
                f"| {bucket} | {row['region']} | {row['name']} ({row['ticker']}) | "
                f"{format_aum(row['aum_krw'])} | {row['selection_rank']} |"
            )
        lines.append("")

    review_sorted = sorted(review, key=lambda row: (-decimal_value(row["aum_krw"]), str(row["ticker"])))
    lines.extend(
        [
            "## 우선 검수 대상",
            "",
            "분류가 확정되면 현재 잠정 선정 상품을 밀어낼 가능성이 큰 순서다.",
            "",
            "| 페이지 | 잠정 버킷·테마 | ETF | 순자산 | 검수 사유 |",
            "| --- | --- | --- | ---: | --- |",
        ]
    )
    for row in review_sorted[:15]:
        bucket = str(row["theme_key"] or row["bucket"])
        lines.append(
            f"| {row['page_id']} | {bucket} | {row['name']} ({row['ticker']}) | "
            f"{format_aum(row['aum_krw'])} | {row['classification_status']} |"
        )
    lines.extend(
        [
            "",
            "## 남은 발행 차단 조건",
            "",
            "- KRX/FSC 원본 API 응답 보관",
            "- 공식 분배금 이력과 총수익률 재계산",
            "- 공식 TOP 5 편입종목 및 집중도 확인",
            "- 최근 전략·기초지수 변경 이력 확인",
            "- 페이지 1 비용·추적오차 공통 기준 확인",
            "- 운영자 분류 검수",
            "",
        ]
    )
    return "\n".join(lines)


def build_outputs(
    snapshot_dir: Path,
    config_path: Path,
    classification_path: Path,
    official_validation_path: Path,
    output_dir: Path,
) -> dict[str, object]:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    master_rows, _ = read_csv(snapshot_dir / "etf_master_snapshot.csv")
    return_rows, _ = read_csv(snapshot_dir / "etf_returns_snapshot.csv")
    classifications = load_classification(classification_path)
    official_validations = load_official_validation(official_validation_path)
    candidates = build_candidates(config, master_rows, return_rows, classifications)
    apply_page3_official_validations(candidates, official_validations)
    rank_and_select(candidates)

    candidates.sort(key=lambda row: (str(row["page_id"]), str(row["bucket"]), -decimal_value(row["aum_krw"]), str(row["ticker"])))
    selected = [row for row in candidates if row["selection_status"] == "provisional_selected"]
    review = [
        row
        for row in candidates
        if str(row["classification_status"]).startswith("manual_review")
        and set(filter(None, str(row["exclusion_codes"]).split(";"))).issubset({"CLASSIFICATION_UNCONFIRMED"})
    ]
    excluded = [row for row in candidates if row["exclusion_codes"]]
    invariants = validate_selection(selected)

    write_csv(output_dir / "candidate_universe.csv", candidates, FIELDS)
    write_csv(output_dir / "selection_preview.csv", selected, FIELDS)
    write_csv(output_dir / "classification_review_queue.csv", review, FIELDS)
    write_csv(output_dir / "exclusion_log.csv", excluded, FIELDS)
    (output_dir / "SELECTION_REVIEW.md").write_text(
        review_markdown(selected, review, snapshot_dir.name),
        encoding="utf-8",
    )

    selected_counts = defaultdict(int)
    for row in selected:
        selected_counts[str(row["page_id"])] += 1
    summary = {
        "schema_version": "1.0.0",
        "as_of_date": snapshot_dir.name,
        "status": "provisional_not_for_publication",
        "candidate_count": len(candidates),
        "selected_count": len(selected),
        "review_count": len(review),
        "excluded_count": len(excluded),
        "officially_validated_page3_count": len(official_validations),
        "selected_by_page": dict(sorted(selected_counts.items())),
        "selection_invariants": invariants,
        "release_ready": False,
        "remaining_gates": [
            "raw official AUM and price response archive",
            "official distribution history and total-return reconstruction",
            "cost and tracking-error data where displayed",
            "operator classification review",
        ],
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "candidate_build_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Build provisional lead-magnet ETF candidates and AUM selections.")
    parser.add_argument("--as-of", default="20260810")
    args = parser.parse_args()
    snapshot_dir = ROOT / "data" / "lead_magnet" / "staging" / args.as_of
    output_dir = ROOT / "data" / "lead_magnet" / "generated" / args.as_of
    summary = build_outputs(
        snapshot_dir,
        ROOT / "config" / "lead_magnet.json",
        ROOT / "data" / "classification" / "etf_classification_review_draft.csv",
        ROOT / "data" / "lead_magnet" / "official_validation" / "page3_official_validation_20260811.csv",
        output_dir,
    )
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
