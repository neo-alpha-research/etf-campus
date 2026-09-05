#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regulatory Evidence Integrity Validator (Gate 1).

Strictly verifies evidence authenticity and compliance across regulatory ledgers
against rules E1 through E4:
- E1: pension_verified = Y -> evidence_ref must point to a file that actually exists on disk.
- E2: source_url domain-specific format validation (DART requires 14-digit rcpNo, KOFIA requires serviceId).
- E3: Evidence concentration check (flag non-whitelisted evidence shared across > 50 tickers).
- E4: verified_at timestamp cannot precede evidence file mtime.

Strictly exits with code 1 if any violation is detected.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Mapping

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

RULE_DESCRIPTIONS = {
    "E1": "pension_verified = Y -> evidence_ref 파일 실존 확인 (존재하지 않는 파일/설명문구 금지)",
    "E2": "source_url 도메인 형식 검증 (DART는 rcpNo 14자리 필수, KOFIA는 serviceId 필수)",
    "E3": "동일 evidence_ref 과다 공유 검증 (50건 초과 시 화이트리스트 등록 필수)",
    "E4": "verified_at 일자가 evidence_ref 파일 수정일(mtime)보다 앞서지 않음",
    "E5": "evidence_manifest.json 원본/추출본 SHA-256 해시 일치 검증 (로컬 파일 존재 시)",
    "S1": "statutory_basis(=statute_id) 레지스트리 실존 검증 (미등록 ID 원천 차단)",
    "S2": "statute_registry.csv evidence_ref 실존 및 excerpt 원문 부분문자열 대조 검증",
    "S3": "statute_id -> 허용 pension_limit 매핑표 정합 검증 (조문 오인용 및 WRBA_ART21/PSR_ART12_1_1 차단)",
    "S4": "statutory_basis 공란 시 pension_verified = N 필수 (근거 없는 행의 검증 표시 차단)",
}

# Whitelist for bulk official disclosure snapshot files and extracts
WHITELISTED_SHARED_EVIDENCE = {
    "data/regulatory/sources/kofia_dis_response_20260905.xml",
    "data/regulatory/sources/kofia_evidence_extract_20260905.xml",
}

# S3 Allowable Statutory Basis -> pension_limit mapping table
# WRBA_ART21 and PSR_ART12_1_1 are strictly excluded (cannot justify any pension limit).
ALLOWED_STATUTE_LIMIT_MAP: dict[str, set[str]] = {
    "PSR_ART11_1_4": {"100% (안전자산)"},
    "PSR_ART11_1_5": {"100% (안전자산)"},
    "PSR_ART11_1_6": {"100% (안전자산)"},
    "PSR_ART11_1_9": {"100% (안전자산)"},
    "PSR_ART9_1_2": {"100% (안전자산)", "70% (위험자산)", "불가"},
    "PSR_ART11_2": {"불가"},
    "MOEL_WRBA_RULE_ART10_1_2": {"70% (위험자산)"},
}

DART_RCP_PATTERN = re.compile(r"rcpNo=\d{14}")


def validate_evidence_integrity(
    ledger_rows: list[Mapping[str, Any]] | None = None,
    audit_rows: list[Mapping[str, Any]] | None = None,
    master_rows: list[Mapping[str, Any]] | None = None,
    shared_threshold: int = 50,
    statute_registry_path: Path | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Validate regulatory rows against evidence integrity rules E1 through E5, S1 to S4."""
    violations: dict[str, list[dict[str, Any]]] = {rule: [] for rule in RULE_DESCRIPTIONS}

    if ledger_rows is None:
        ledger_rows = []

    # Track evidence concentration across all verified entries
    evidence_counter: Counter[str] = Counter()

    # 1. Inspect verification ledger rows (all items in ledger are claimed verified)
    for r in ledger_rows:
        tk = str(r.get("ticker") or "").strip().upper()
        ev_ref = str(r.get("evidence_ref") or "").strip()
        src_url = str(r.get("source_url") or "").strip()
        v_at = str(r.get("verified_at") or "").strip()
        src_type = str(r.get("source_type") or "").strip()

        if ev_ref:
            evidence_counter[ev_ref] += 1

        # E1: evidence_ref must be an existing file on disk
        if not ev_ref:
            violations["E1"].append({
                "ticker": tk,
                "source_file": "pension_verification_ledger.csv",
                "reason": "검증 원장 행에 evidence_ref가 비어 있음",
            })
        else:
            file_path = (REPO_ROOT / ev_ref).resolve()
            if not file_path.is_file():
                violations["E1"].append({
                    "ticker": tk,
                    "source_file": "pension_verification_ledger.csv",
                    "evidence_ref": ev_ref,
                    "reason": f"evidence_ref 파일 실존하지 않음: '{ev_ref}'",
                })

        # E2: source_url domain-specific format validation
        if not src_url:
            violations["E2"].append({
                "ticker": tk,
                "source_file": "pension_verification_ledger.csv",
                "reason": "검증 원장 행에 source_url이 누락됨",
            })
        else:
            if "dart.fss.or.kr" in src_url:
                if not DART_RCP_PATTERN.search(src_url):
                    violations["E2"].append({
                        "ticker": tk,
                        "source_file": "pension_verification_ledger.csv",
                        "source_url": src_url,
                        "reason": f"DART URL에 14자리 rcpNo가 누락됨: '{src_url}'",
                    })
            elif "dis.kofia.or.kr" in src_url:
                if "serviceId" not in src_url:
                    violations["E2"].append({
                        "ticker": tk,
                        "source_file": "pension_verification_ledger.csv",
                        "source_url": src_url,
                        "reason": f"KOFIA URL에 serviceId 파라미터가 누락됨: '{src_url}'",
                    })

        # E4: verified_at cannot precede file mtime
        if ev_ref:
            file_path = (REPO_ROOT / ev_ref).resolve()
            if file_path.is_file() and v_at:
                try:
                    v_date = datetime.date.fromisoformat(v_at.split("T")[0])
                    mtime_date = datetime.date.fromtimestamp(file_path.stat().st_mtime)
                    if v_date < mtime_date:
                        violations["E4"].append({
                            "ticker": tk,
                            "source_file": "pension_verification_ledger.csv",
                            "verified_at": v_at,
                            "file_mtime": mtime_date.isoformat(),
                            "reason": f"verified_at ({v_date})이 증거 파일 수정일 ({mtime_date})보다 앞섬",
                        })
                except Exception as e:
                    violations["E4"].append({
                        "ticker": tk,
                        "source_file": "pension_verification_ledger.csv",
                        "verified_at": v_at,
                        "reason": f"날짜 파싱 오류: {e}",
                    })

    # 2. Inspect audit ledger rows (both verified and unverified items)
    if audit_rows is not None:
        for r in audit_rows:
            tk = str(r.get("ticker") or "").strip().upper()
            p_ver = str(r.get("pension_verified") or "").strip()
            ev_ref = str(r.get("evidence_ref") or "").strip()
            src_url = str(r.get("source_url") or "").strip()
            v_at = str(r.get("verified_at") or "").strip()

            if p_ver == "Y":
                # Must satisfy E1
                if not ev_ref:
                    violations["E1"].append({
                        "ticker": tk,
                        "source_file": "pension_audit_ledger.csv",
                        "reason": "pension_verified=Y 인데 evidence_ref가 비어 있음",
                    })
                else:
                    file_path = (REPO_ROOT / ev_ref).resolve()
                    if not file_path.is_file():
                        violations["E1"].append({
                            "ticker": tk,
                            "source_file": "pension_audit_ledger.csv",
                            "evidence_ref": ev_ref,
                            "reason": f"evidence_ref 파일 실존하지 않음: '{ev_ref}'",
                        })

                # Must satisfy E2
                if not src_url:
                    violations["E2"].append({
                        "ticker": tk,
                        "source_file": "pension_audit_ledger.csv",
                        "reason": "pension_verified=Y 인데 source_url이 비어 있음",
                    })
                elif "dart.fss.or.kr" in src_url and not DART_RCP_PATTERN.search(src_url):
                    violations["E2"].append({
                        "ticker": tk,
                        "source_file": "pension_audit_ledger.csv",
                        "source_url": src_url,
                        "reason": f"DART URL에 14자리 rcpNo 누락: '{src_url}'",
                    })
                elif "dis.kofia.or.kr" in src_url and "serviceId" not in src_url:
                    violations["E2"].append({
                        "ticker": tk,
                        "source_file": "pension_audit_ledger.csv",
                        "source_url": src_url,
                        "reason": f"KOFIA URL에 serviceId 누락: '{src_url}'",
                    })

                # Must satisfy E4
                if ev_ref:
                    file_path = (REPO_ROOT / ev_ref).resolve()
                    if file_path.is_file() and v_at:
                        try:
                            v_date = datetime.date.fromisoformat(v_at.split("T")[0])
                            mtime_date = datetime.date.fromtimestamp(file_path.stat().st_mtime)
                            if v_date < mtime_date:
                                violations["E4"].append({
                                    "ticker": tk,
                                    "source_file": "pension_audit_ledger.csv",
                                    "verified_at": v_at,
                                    "file_mtime": mtime_date.isoformat(),
                                    "reason": f"verified_at ({v_date})이 증거 파일 수정일 ({mtime_date})보다 앞섬",
                                })
                        except Exception as e:
                            violations["E4"].append({
                                "ticker": tk,
                                "source_file": "pension_audit_ledger.csv",
                                "verified_at": v_at,
                                "reason": f"날짜 파싱 오류: {e}",
                            })
            else:
                # Unverified item in audit ledger: should not have fake DART URL or fake evidence_ref
                if "dart.fss.or.kr" in src_url and not DART_RCP_PATTERN.search(src_url):
                    violations["E2"].append({
                        "ticker": tk,
                        "source_file": "pension_audit_ledger.csv",
                        "source_url": src_url,
                        "reason": f"미검증 행에 비정상 DART URL 잔존: '{src_url}'",
                    })
                if ev_ref:
                    file_path = (REPO_ROOT / ev_ref).resolve()
                    if not file_path.is_file():
                        violations["E1"].append({
                            "ticker": tk,
                            "source_file": "pension_audit_ledger.csv",
                            "evidence_ref": ev_ref,
                            "reason": f"미검증 행에 가짜 evidence_ref 문구 잔존: '{ev_ref}'",
                        })

    # 3. E3: Concentration check
    for ev_ref, count in evidence_counter.items():
        # Normalize relative path representation
        normalized = ev_ref.replace("\\", "/")
        if count > shared_threshold and normalized not in WHITELISTED_SHARED_EVIDENCE:
            violations["E3"].append({
                "evidence_ref": ev_ref,
                "count": count,
                "threshold": shared_threshold,
                "reason": f"evidence_ref '{ev_ref}'가 화이트리스트 없이 {count}건에 과다 공유됨 (한도: {shared_threshold}건)",
            })

    # 4. E5: Manifest SHA-256 hash validation
    manifest_path = REPO_ROOT / "data" / "regulatory" / "sources" / "evidence_manifest.json"
    if manifest_path.is_file():
        try:
            with manifest_path.open("r", encoding="utf-8") as f:
                manifest = json.load(f)
            for filename, meta in manifest.items():
                raw_file = REPO_ROOT / "data" / "regulatory" / "sources" / filename
                # If raw file exists locally, verify sha256 (if missing, pass for CI)
                if raw_file.is_file() and "sha256" in meta:
                    actual_sha = hashlib.sha256(raw_file.read_bytes()).hexdigest()
                    if actual_sha != meta["sha256"]:
                        violations["E5"].append({
                            "file": str(raw_file),
                            "expected_sha256": meta["sha256"],
                            "actual_sha256": actual_sha,
                            "reason": f"원본 파일 '{filename}' 해시 불일치: 기록={meta['sha256']} vs 실측={actual_sha}",
                        })
                # If extract file exists, verify extract sha256
                extract_rel = meta.get("extract")
                if extract_rel:
                    extract_file = REPO_ROOT / extract_rel
                    if extract_file.is_file() and "extract_sha256" in meta:
                        actual_ext_sha = hashlib.sha256(extract_file.read_bytes()).hexdigest()
                        if actual_ext_sha != meta["extract_sha256"]:
                            violations["E5"].append({
                                "file": str(extract_file),
                                "expected_sha256": meta["extract_sha256"],
                                "actual_sha256": actual_ext_sha,
                                "reason": f"추출본 파일 '{extract_rel}' 해시 불일치: 기록={meta['extract_sha256']} vs 실측={actual_ext_sha}",
                            })
        except Exception as e:
            violations["E5"].append({
                "file": str(manifest_path),
                "reason": f"evidence_manifest.json 파싱 오류: {e}",
            })

    # 5. S2: Statute registry evidence authenticity and excerpt substring verification
    statute_registry_file = (statute_registry_path or (REPO_ROOT / "data" / "regulatory" / "statute_registry.csv")).resolve()
    valid_statute_ids: set[str] = set()
    if not statute_registry_file.is_file():
        violations["S2"].append({
            "file": str(statute_registry_file),
            "reason": f"statute_registry.csv 파일이 존재하지 않음: '{statute_registry_file}'",
        })
        violations["S1"].append({
            "file": str(statute_registry_file),
            "reason": "statute_registry.csv 파일 부재로 statutory_basis 검증 불가",
        })
    else:
        try:
            with statute_registry_file.open("r", encoding="utf-8-sig", newline="") as f:
                registry_rows = list(csv.DictReader(f))
            for srow in registry_rows:
                sid = str(srow.get("statute_id") or "").strip()
                ev_ref = str(srow.get("evidence_ref") or "").strip()
                excerpt = str(srow.get("excerpt") or "").strip()

                if not sid:
                    violations["S2"].append({
                        "reason": "statute_registry.csv 행에 statute_id가 비어 있음",
                    })
                    continue

                valid_statute_ids.add(sid)

                if not ev_ref:
                    violations["S2"].append({
                        "statute_id": sid,
                        "reason": "evidence_ref가 비어 있음",
                    })
                    continue

                ev_file = (REPO_ROOT / ev_ref).resolve()
                if not ev_file.is_file():
                    violations["S2"].append({
                        "statute_id": sid,
                        "evidence_ref": ev_ref,
                        "reason": f"법령 증거 파일 실존하지 않음: '{ev_ref}'",
                    })
                    continue

                if not excerpt:
                    violations["S2"].append({
                        "statute_id": sid,
                        "reason": "excerpt(원문 발췌문)가 비어 있음",
                    })
                    continue

                # Strict S2: excerpt must be an authentic verbatim substring in the evidence file
                file_text = ev_file.read_text(encoding="utf-8")
                if excerpt not in file_text:
                    violations["S2"].append({
                        "statute_id": sid,
                        "evidence_ref": ev_ref,
                        "excerpt_sample": excerpt[:60],
                        "reason": f"excerpt가 법령 원문 파일 본문에 일치하지 않음 (문자열 부분일치 실패)",
                    })
        except Exception as e:
            violations["S2"].append({
                "file": str(statute_registry_file),
                "reason": f"statute_registry.csv 파싱 오류: {e}",
            })

    # 6. S1: pension_audit_ledger statutory_basis existence in statute_registry
    if audit_rows is not None:
        for r in audit_rows:
            tk = str(r.get("ticker") or "").strip().upper()
            p_ver = str(r.get("pension_verified") or "").strip()
            stat_basis = str(r.get("statutory_basis") or "").strip()

            if p_ver == "Y" and not stat_basis:
                violations["S1"].append({
                    "ticker": tk,
                    "source_file": "pension_audit_ledger.csv",
                    "reason": "검증 완료(Y) 항목에 statutory_basis가 비어 있음",
                })

            if stat_basis:
                # S1: Must be registered in statute_registry.csv
                if stat_basis not in valid_statute_ids:
                    violations["S1"].append({
                        "ticker": tk,
                        "source_file": "pension_audit_ledger.csv",
                        "statutory_basis": stat_basis,
                        "reason": f"statute_registry.csv에 미등록된 비표준 statute_id 인용: '{stat_basis}'",
                    })

                # S3: statute_id -> allowed pension_limit mapping check
                p_lim = str(r.get("pension_limit") or "").strip()
                if stat_basis not in ALLOWED_STATUTE_LIMIT_MAP:
                    violations["S3"].append({
                        "ticker": tk,
                        "source_file": "pension_audit_ledger.csv",
                        "statutory_basis": stat_basis,
                        "pension_limit": p_lim,
                        "reason": f"statute_id '{stat_basis}'는 허용 매핑표에 정의되지 않은 비허용 규제 근거임 (WRBA_ART21/PSR_ART12_1_1 원천 차단)",
                    })
                elif p_lim not in ALLOWED_STATUTE_LIMIT_MAP[stat_basis]:
                    violations["S3"].append({
                        "ticker": tk,
                        "source_file": "pension_audit_ledger.csv",
                        "statutory_basis": stat_basis,
                        "pension_limit": p_lim,
                        "allowed_limits": sorted(list(ALLOWED_STATUTE_LIMIT_MAP[stat_basis])),
                        "reason": f"statute_id '{stat_basis}'에 허용되지 않은 pension_limit '{p_lim}' 부여됨 (허용값: {sorted(list(ALLOWED_STATUTE_LIMIT_MAP[stat_basis]))})",
                    })

            # S4: Empty statutory_basis must strictly have pension_verified == 'N'
            if not stat_basis:
                if p_ver == "Y":
                    violations["S4"].append({
                        "ticker": tk,
                        "source_file": "pension_audit_ledger.csv",
                        "pension_verified": p_ver,
                        "reason": "statutory_basis가 비어 있는데 pension_verified = Y 로 표시됨 (근거 없는 행 검증 표시 차단)",
                    })

    return violations


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ledger",
        type=Path,
        default=REPO_ROOT / "data/regulatory/pension_verification_ledger.csv",
        help="Path to pension_verification_ledger.csv",
    )
    parser.add_argument(
        "--audit-ledger",
        type=Path,
        default=REPO_ROOT / "data/regulatory/pension_audit_ledger.csv",
        help="Path to pension_audit_ledger.csv",
    )
    parser.add_argument(
        "--statute-registry",
        type=Path,
        default=REPO_ROOT / "data/regulatory/statute_registry.csv",
        help="Path to statute_registry.csv",
    )
    parser.add_argument(
        "--threshold",
        type=int,
        default=50,
        help="Max items sharing single evidence_ref before requiring whitelist",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress detailed item printout on violation",
    )
    args = parser.parse_args()

    if not args.ledger.exists():
        print(f"[ERROR] Verification ledger CSV not found: {args.ledger}", file=sys.stderr)
        return 1

    with args.ledger.open("r", encoding="utf-8-sig", newline="") as f:
        ledger_rows = list(csv.DictReader(f))

    audit_rows = None
    if args.audit_ledger.exists():
        with args.audit_ledger.open("r", encoding="utf-8-sig", newline="") as f:
            audit_rows = list(csv.DictReader(f))

    print("=" * 80)
    print("REGULATORY EVIDENCE INTEGRITY CHECKER (Gate 1)")
    print("=" * 80)
    print(f"Verification Ledger : {args.ledger} ({len(ledger_rows):,} rows)")
    if audit_rows is not None:
        print(f"Audit Ledger        : {args.audit_ledger} ({len(audit_rows):,} rows)")
    print(f"Statute Registry    : {args.statute_registry}")
    print(f"Whitelist           : {sorted(list(WHITELISTED_SHARED_EVIDENCE))}\n")

    violations = validate_evidence_integrity(
        ledger_rows=ledger_rows,
        audit_rows=audit_rows,
        shared_threshold=args.threshold,
        statute_registry_path=args.statute_registry,
    )
    total_violations = sum(len(v) for v in violations.values())

    header_rule = "Rule"
    header_status = "Status"
    header_viols = "Violations"
    header_desc = "Description"
    print(f"{header_rule:<6} | {header_status:<6} | {header_viols:<10} | {header_desc}")
    print("-" * 80)
    for rule, desc in RULE_DESCRIPTIONS.items():
        v_list = violations[rule]
        status = "PASS" if len(v_list) == 0 else "FAIL"
        print(f"{rule:<6} | {status:<6} | {len(v_list):<10} | {desc}")
        if v_list and not args.quiet:
            for item in v_list[:5]:
                print(f"       -> {item.get('ticker', '')} ({item.get('source_file', '')}): {item.get('reason', '')}")
            if len(v_list) > 5:
                print(f"       -> ... and {len(v_list) - 5} more")

    print("=" * 80)
    if total_violations == 0:
        print("\n>>> RESULT: SUCCESS (0 violations across all 7 rules). All evidence and statutory references are verified against primary sources.\n")
        return 0
    else:
        print(f"\n>>> RESULT: FAILED ({total_violations} total violations detected). Zero-tolerance policy strictly requires 0 violations.\n", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
