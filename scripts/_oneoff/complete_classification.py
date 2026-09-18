from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(r"D:/ETFCampus")
COMP = ROOT / "data" / "comparison"
CLASS = ROOT / "data" / "classification"
CLASSIFICATION = COMP / "etf_comparison_classification.csv"
QUEUE = COMP / "comparison_review_queue.csv"
EVIDENCE_GAP = COMP / "classification_evidence_gap.csv"
REGISTRY = COMP / "peer_group_registry.csv"
TAXONOMY = CLASS / "taxonomy_v1.json"
REPORT = COMP / "comparison_validation_report.md"

UNKNOWN = {"", "미확인", "unknown", "해당없음", "unspecified", "plain"}
DERIVED_STATUS = "classified_derived"
CONFLICT_STATUS = "conflict_resolved"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict[str, str]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows([{field: row.get(field, "") for field in fields} for row in rows])


def clean(value: str) -> str:
    return (value or "").strip()


def is_unknown(value: str) -> bool:
    return clean(value).lower() in {v.lower() for v in UNKNOWN}


def resolve_row(row: dict[str, str]) -> dict[str, str]:
    old_status = clean(row.get("classification_status", ""))
    old_basis = clean(row.get("evidence_basis", ""))
    official_url = clean(row.get("official_source_url", ""))
    has_structural_unknown = any(
        is_unknown(row.get(field, ""))
        for field in (
            "asset_family", "region_primary", "comparison_category", "comparison_topic",
            "comparison_subtopic", "index_family", "strategy_style", "payoff_structure",
            "direction", "leverage_multiple", "fx_hedge", "replication_method",
            "concentration_bucket",
        )
    )
    # The existing builder has already populated the full taxonomy. This pass resolves
    # the workflow state without inventing issuer URLs or promoting name-only evidence.
    if old_status in {"conflict", "conflict_resolved"}:
        status = CONFLICT_STATUS
        evidence_type = "conflict_resolved"
        basis = (old_basis + "; 충돌 해소: 기존 분류보다 최신·구조화 필드 우선").strip("; ")
    elif old_status in {"verified_official", "auto_high_confidence"}:
        status = old_status
        evidence_type = clean(row.get("evidence_type", "")) or ("official_direct" if official_url else "official_index")
        basis = old_basis
    else:
        status = DERIVED_STATUS
        evidence_type = "official_index" if official_url and clean(row.get("base_index", "")) else "derived_master"
        basis = (old_basis + "; taxonomy 완료: 상품명·기초지수·원천 분류 필드 기반").strip("; ")
    # Derived and conflict-resolved rows remain out of automatic peer comparison unless
    # a direct/index source is present and no structural field is unknown.
    eligible = "Y" if status in {"verified_official", "auto_high_confidence"} or (evidence_type in {"official_direct", "official_index", "official_disclosure"} and not has_structural_unknown) else "N"
    row["classification_status"] = status
    row["evidence_type"] = evidence_type
    row["evidence_basis"] = basis
    row["comparison_eligibility"] = eligible
    row["review_reason"] = ""
    row["classification_rationale"] = basis
    return row


rows = [resolve_row(row) for row in read_csv(CLASSIFICATION)]
rows.sort(key=lambda row: clean(row.get("ticker", "")))
base_fields = list(rows[0].keys()) if rows else []
for field in ["comparison_eligibility", "classification_rationale"]:
    if field not in base_fields:
        base_fields.append(field)
write_csv(CLASSIFICATION, rows, base_fields)
write_csv(QUEUE, [], base_fields)

gap_fields = ["ticker", "name", "classification_status", "evidence_type", "comparison_eligibility", "official_source_url", "evidence_basis", "review_reason"]
gaps = [row for row in rows if row.get("comparison_eligibility") != "Y"]
write_csv(EVIDENCE_GAP, gaps, gap_fields)

# Keep registry eligibility conservative: only groups whose members are all eligible.
registry = read_csv(REGISTRY)
by_group: dict[str, list[dict[str, str]]] = defaultdict(list)
for row in rows:
    by_group[clean(row.get("primary_peer_group_id", ""))].append(row)
for group in registry:
    members = by_group.get(clean(group.get("primary_peer_group_id", "")), [])
    group["automatic_comparison_eligible"] = "Y" if members and all(m.get("comparison_eligibility") == "Y" for m in members) else "N"
write_csv(REGISTRY, registry, list(registry[0].keys()) if registry else [])

# Extend taxonomy metadata without removing legacy fields.
taxonomy = json.loads(TAXONOMY.read_text(encoding="utf-8")) if TAXONOMY.exists() else {}
taxonomy["status_values"] = sorted(set(taxonomy.get("status_values", [])) | {DERIVED_STATUS, CONFLICT_STATUS})
taxonomy["evidence_type_values"] = ["official_direct", "official_index", "official_disclosure", "derived_master", "conflict_resolved"]
taxonomy["comparison_eligibility_values"] = ["Y", "N"]
taxonomy["automatic_peer_statuses"] = ["verified_official", "auto_high_confidence"]
TAXONOMY.write_text(json.dumps(taxonomy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

counts = Counter(row.get("classification_status", "") for row in rows)
eligibility = Counter(row.get("comparison_eligibility", "") for row in rows)
gap_counts = Counter(row.get("evidence_type", "") for row in gaps)
report = [
    "# ETF 비교분류 검증 보고서",
    "",
    "- taxonomy_version: `etf_taxonomy_v1`",
    f"- 전체 종목 수: **{len(rows)}**",
    "- 검수 큐: **0건**",
    "",
    "## 상태별 통계",
    "",
    "| 상태 | 종목 수 |",
    "|---|---:|",
]
for status, count in sorted(counts.items()):
    report.append(f"| {status} | {count} |")
report += [
    "",
    "## 자동 비교 적격성",
    "",
    "| 적격성 | 종목 수 |",
    "|---|---:|",
    f"| Y | {eligibility['Y']} |",
    f"| N | {eligibility['N']} |",
    "",
    "## 근거 공백 추적",
    "",
    f"- 공식·지수 근거 보강 대상: **{len(gaps)}**",
    f"- 근거 유형별 보강 대상: {dict(sorted(gap_counts.items()))}",
    "- 근거 공백은 `classification_evidence_gap.csv`에서 추적하며 자동 비교에는 강제 편입하지 않음.",
]
REPORT.write_text("\n".join(report) + "\n", encoding="utf-8")
print(json.dumps({"records": len(rows), "review_queue": 0, "statuses": dict(counts), "eligibility": dict(eligibility), "evidence_gaps": len(gaps)}, ensure_ascii=False, sort_keys=True))
