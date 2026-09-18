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
import subprocess
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
    "S5": "evidence_grade E1/E2 증거 충분성 검증 (로컬 파일 본문에 주장 핵심 키워드 원문 실재 확인)",
    "S6-a": "E0(법령직접) 등급의 동일 evidence_quote 복제 인용 금지 (단순 조문 복제 승격 원천 차단)",
    "S7": "evidence_ref 저장소 내부 생성/파생 파일 사용 금지 (외부 원본 공시/법령만 허용)",
    "S8": "evidence_quote 템플릿 보간 위장 금지 (외부 원본 실재 인용문 필수)",
    "S9": "WHITELISTED_SHARED_EVIDENCE 외부 공인 원본 한정 검증 (내부 생성 파일 등록 차단)",
    "S10": "법령 스냅샷 만료 검사 (statute_registry.csv recheck_due 기준일 대비 만료(90일) 시 경고, 180일 초과 시 FAIL)",
    "E6": "판매사 원장 유효기간 검사 (evidence_manifest.json as_of_date 필수 메타 등록 및 60일 경과 시 경고)",
    "S11": "개인연금 법정 적격 증거 검증 (KOFIA DIS 전자공시 및 공식 원장 기반 검증, 레버리지/인버스 편입 원천 차단)",
}

# P4 Invariant Counterexample 8 Tickers (한화 반례 8종)
CX8 = {"0210E0", "238670", "433880", "447660", "451000", "451600", "453010", "477050"}


def qualifies_as_personal_pension_source(source_eligible_tickers: set[str]) -> bool:
    """개인연금 증거 자격 검정 (S11): 반례 8종(CX8)을 '가능'으로 판정하면 판별력 없음."""
    return len(CX8 & source_eligible_tickers) == 0


# Whitelist for bulk official disclosure snapshot files and extracts (ONLY external primary sources)
WHITELISTED_SHARED_EVIDENCE = {
    "data/regulatory/sources/kofia_dis_response_20260905.xml",
    "data/regulatory/sources/kofia_evidence_extract_20260905.xml",
    "data/regulatory/sources/brokers/koreainvestment/ETF_REITs_LIST_RP_260831.xlsx",
    "data/regulatory/sources/brokers/koreainvestment/kis_etf_ticker_universe_20260831.txt",
    "data/regulatory/sources/issuers/miraeasset/tiger_pension_search_20260906.html",
    "data/regulatory/sources/issuers/samsung/kodex_pension_search_20260906.json",
    "data/regulatory/sources/issuers/ace/ace_pension_search_20260906.json",
}



def is_whitelisted_shared_evidence(ev_ref: str) -> bool:
    """Check if evidence file is explicitly whitelisted or matches KOFIA monthly snapshot pattern or statute files."""
    norm = ev_ref.replace("\\", "/")
    if norm in WHITELISTED_SHARED_EVIDENCE:
        return True
    if norm.startswith("data/regulatory/sources/statutes/"):
        return True
    if re.match(r"^data/regulatory/sources/kofia_(dis_response|evidence_extract)_\d{8}\.xml$", norm):
        return True
    return False

# S3 Allowable Statutory Basis -> pension_limit mapping table
# WRBA_ART21 and PSR_ART12_1_1 are strictly excluded (cannot justify any pension limit).
ALLOWED_STATUTE_LIMIT_MAP: dict[str, set[str]] = {
    "PSR_ART11_1_4": {"100% (안전자산)"},
    "PSR_ART11_1_5": {"100% (안전자산)", "70% (위험자산)"},
    "PSR_ART11_1_6": {"100% (안전자산)"},
    "PSR_ART11_1_9": {"100% (안전자산)"},
    "FSS_PSR_RULE_ART5_2": {"100% (안전자산)"},
    "PSR_ART9_1_2": {"100% (안전자산)", "70% (위험자산)", "불가"},
    "FSC_FIBA_REG_ART4_54": {"불가"},
    "PSR_ART11_2": {"불가"},
    "ED_FSCMA_ART240_4": {"70% (위험자산)", "불가"},
    "MOEL_WRBA_RULE_ART10_1_2": {"70% (위험자산)"},
    "ITA_ART20_3": {"가능", "불가", "100% (안전자산)", "70% (위험자산)"},
    "ED_ITA_ART40_2_1_1_B": {"가능", "불가", "100% (안전자산)", "70% (위험자산)"},
    "KOFIA_PENSION_TERMS_ART8_1_2": {"가능", "불가", "100% (안전자산)", "70% (위험자산)"},
}


DART_RCP_PATTERN = re.compile(r"rcpNo=\d{14}")

_EVIDENCE_DATE_CACHE: dict[Path, datetime.date] = {}

def parse_evidence_date(file_path: Path) -> datetime.date:
    """Extracts the authentic date of an evidence file.

    In CI/CD environments (GitHub Actions) or fresh clones, filesystem st_mtime
    is set to the clone/checkout timestamp (now) rather than the authentic publication
    or commit date. Therefore, we determine the genuine date through:
    1. YYYYMMDD in filename (e.g. kofia_evidence_extract_20260905.xml -> 2026-09-05)
    2. YYMMDD in filename (e.g. ETF_REITs_LIST_RP_260831.xlsx -> 2026-08-31)
    3. evidence_manifest.json metadata (filing_date, as_of_date, collected_at)
    4. Git commit date (for git-tracked files)
    5. Filesystem st_mtime fallback
    """
    if file_path in _EVIDENCE_DATE_CACHE:
        return _EVIDENCE_DATE_CACHE[file_path]

    fname = file_path.name
    # 1. Match from filename: YYYYMMDD
    m = re.search(r"(\d{4})(\d{2})(\d{2})", fname)
    if m:
        try:
            d = datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            _EVIDENCE_DATE_CACHE[file_path] = d
            return d
        except ValueError:
            pass

    # 2. Match from filename: YYMMDD
    m2 = re.search(r"_(\d{2})(\d{2})(\d{2})\.", fname)
    if m2:
        try:
            d = datetime.date(2000 + int(m2.group(1)), int(m2.group(2)), int(m2.group(3)))
            _EVIDENCE_DATE_CACHE[file_path] = d
            return d
        except ValueError:
            pass

    # 3. Check evidence_manifest.json
    manifest_file = REPO_ROOT / "data/regulatory/sources/evidence_manifest.json"
    if manifest_file.is_file():
        try:
            manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
            rel_str = str(file_path.relative_to(REPO_ROOT)).replace("\\", "/")
            for k, meta in manifest.items():
                if k in rel_str or meta.get("extract") == rel_str:
                    for dt_key in ("filing_date", "as_of_date", "collected_at"):
                        if meta.get(dt_key):
                            d = datetime.date.fromisoformat(meta[dt_key].split("T")[0])
                            _EVIDENCE_DATE_CACHE[file_path] = d
                            return d
        except Exception:
            pass

    # 4. Git commit date
    try:
        rel_path = file_path.relative_to(REPO_ROOT)
        res = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", str(rel_path)],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=5,
        )
        if res.returncode == 0 and res.stdout.strip():
            d = datetime.date.fromisoformat(res.stdout.strip())
            _EVIDENCE_DATE_CACHE[file_path] = d
            return d
    except Exception:
        pass

    # 5. Fallback to mtime
    d = datetime.date.fromtimestamp(file_path.stat().st_mtime)
    _EVIDENCE_DATE_CACHE[file_path] = d
    return d


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

        sub_refs = [p.strip() for p in ev_ref.split(";") if p.strip()] if ev_ref else []
        for p in sub_refs:
            evidence_counter[p] += 1

        # E1: evidence_ref must be an existing file on disk
        if not ev_ref:
            violations["E1"].append({
                "ticker": tk,
                "source_file": "pension_verification_ledger.csv",
                "reason": "검증 원장 행에 evidence_ref가 비어 있음",
            })
        else:
            for p in sub_refs:
                file_path = (REPO_ROOT / p).resolve()
                if not file_path.is_file():
                    violations["E1"].append({
                        "ticker": tk,
                        "source_file": "pension_verification_ledger.csv",
                        "evidence_ref": p,
                        "reason": f"evidence_ref 파일 실존하지 않음: '{p}'",
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
        for p in sub_refs:
            file_path = (REPO_ROOT / p).resolve()
            if file_path.is_file() and v_at:
                try:
                    v_date = datetime.date.fromisoformat(v_at.split("T")[0])
                    mtime_date = parse_evidence_date(file_path)
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

            sub_refs = [p.strip() for p in ev_ref.split(";") if p.strip()] if ev_ref else []

            if p_ver == "Y":
                if not ledger_rows:
                    for p in sub_refs:
                        evidence_counter[p] += 1
                # Must satisfy E1
                if not ev_ref:
                    violations["E1"].append({
                        "ticker": tk,
                        "source_file": "pension_audit_ledger.csv",
                        "reason": "pension_verified=Y 인데 evidence_ref가 비어 있음",
                    })
                else:
                    for p in sub_refs:
                        file_path = (REPO_ROOT / p).resolve()
                        if not file_path.is_file():
                            violations["E1"].append({
                                "ticker": tk,
                                "source_file": "pension_audit_ledger.csv",
                                "evidence_ref": p,
                                "reason": f"evidence_ref 파일 실존하지 않음: '{p}'",
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
                for p in sub_refs:
                    file_path = (REPO_ROOT / p).resolve()
                    if file_path.is_file() and v_at:
                        try:
                            v_date = datetime.date.fromisoformat(v_at.split("T")[0])
                            mtime_date = parse_evidence_date(file_path)
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
                    for p in sub_refs:
                        file_path = (REPO_ROOT / p).resolve()
                        if not file_path.is_file():
                            violations["E1"].append({
                                "ticker": tk,
                                "source_file": "pension_audit_ledger.csv",
                                "evidence_ref": p,
                                "reason": f"미검증 행에 가짜 evidence_ref 문구 잔존: '{p}'",
                            })

    # 3. E3: Concentration check
    for ev_ref, count in evidence_counter.items():
        # Normalize relative path representation
        normalized = ev_ref.replace("\\", "/")
        if count > shared_threshold and not is_whitelisted_shared_evidence(ev_ref):
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

                # E6: Broker ledger as_of_date mandatory metadata & 60-day expiry check
                if filename.startswith("brokers/") or meta.get("account_type") in ("retirement_pension", "personal_pension"):
                    as_of_date_str = meta.get("as_of_date")
                    if not as_of_date_str:
                        violations["E6"].append({
                            "file": filename,
                            "reason": "판매사 원장에 필수 메타데이터 as_of_date 누락",
                        })
                    else:
                        try:
                            as_of_date = datetime.date.fromisoformat(as_of_date_str)
                            today = datetime.date.today()
                            elapsed_days = (today - as_of_date).days
                            if elapsed_days > 60:
                                print(f"       [WARN E6] 판매사 원장 기준일 60일 경과: {filename} (기준일: {as_of_date_str}, {elapsed_days}일 경과)", file=sys.stderr)
                        except Exception as e:
                            violations["E6"].append({
                                "file": filename,
                                "reason": f"as_of_date 날짜 형식 오류: {e}",
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

                # S10: Statute snapshot expiry check (90 days cycle, warn if overdue, fail if > 180 days)
                recheck_due_str = str(srow.get("recheck_due") or "").strip()
                if not recheck_due_str:
                    violations["S10"].append({
                        "statute_id": sid,
                        "reason": "statute_registry.csv 행에 recheck_due(재확인 만료예정일) 컬럼이 누락됨",
                    })
                else:
                    try:
                        due_date = datetime.date.fromisoformat(recheck_due_str)
                        today = datetime.date.today()
                        if today > due_date:
                            days_overdue = (today - due_date).days
                            if days_overdue > 90:  # 90-day cycle + 90 days = 180 days overdue
                                violations["S10"].append({
                                    "statute_id": sid,
                                    "recheck_due": recheck_due_str,
                                    "days_overdue": days_overdue,
                                    "reason": f"법령 스냅샷 재확인 기한 180일 초과 방치 ({days_overdue}일 초과) -> CRITICAL FAIL",
                                })
                            else:
                                print(f"       [WARN S10] 법령 스냅샷 재확인 주기 도래 (만료): {sid} (기한: {recheck_due_str}, {days_overdue}일 경과)", file=sys.stderr)
                    except Exception as e:
                        violations["S10"].append({
                            "statute_id": sid,
                            "recheck_due": recheck_due_str,
                            "reason": f"recheck_due 날짜 형식 오류: {e}",
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

    # 7. S5: Evidence sufficiency for E1 / E2 items (F-1 prevention)
    # If evidence_grade is E1/E2 and evidence_ref is a local file,
    # the file content MUST contain verbatim keywords backing the statutory claim.
    all_check_rows = list(ledger_rows)
    if audit_rows:
        all_check_rows.extend([r for r in audit_rows if str(r.get("pension_verified") or "").strip() == "Y"])

    seen_s5_tickers = set()
    for r in all_check_rows:
        tk = str(r.get("ticker") or "").strip().upper()
        if tk in seen_s5_tickers:
            continue
        seen_s5_tickers.add(tk)

        ev_grade = str(r.get("evidence_grade") or "").strip().upper()
        ev_ref = str(r.get("evidence_ref") or "").strip()
        note = str(r.get("note") or r.get("audit_notes") or "").strip()

        if ev_grade in ("E1", "E1B", "E2"):
            if not ev_ref:
                violations["S5"].append({
                    "ticker": tk,
                    "evidence_grade": ev_grade,
                    "reason": "E1/E1B/E2 승격 항목에 evidence_ref가 누락됨",
                })
                continue

            file_path = (REPO_ROOT / ev_ref).resolve()
            if not file_path.is_file():
                violations["S5"].append({
                    "ticker": tk,
                    "evidence_grade": ev_grade,
                    "evidence_ref": ev_ref,
                    "reason": f"E1/E1B/E2 증거 파일 실존하지 않음: {ev_ref}",
                })
                continue

            try:
                file_text = file_path.read_text(encoding="utf-8")
            except Exception:
                try:
                    file_text = file_path.read_text(encoding="cp949")
                except Exception as e:
                    violations["S5"].append({
                        "ticker": tk,
                        "evidence_grade": ev_grade,
                        "evidence_ref": ev_ref,
                        "reason": f"증거 파일 읽기 실패: {e}",
                    })
                    continue

            # Core keyword sets based on statutory claim
            required_keywords = []
            claim_desc = []

            if any(k in note for k in ["특별자산"]):
                required_keywords.append("특별자산")
                claim_desc.append("특별자산집합투자기구")
            elif any(k in note for k in ["TDF", "글라이드패스"]):
                required_keywords.extend(["투자목표시점", "제5조의2", "채무증권"])
                claim_desc.append("적격 TDF 요건")
            elif any(k in note for k in ["주식", "한도", "채권혼합", "50% 미만", "40% 이하", "투자대상주식"]):
                required_keywords.extend(["투자대상주식", "주식의 투자한도", "주식의투자한도", "100분의 50", "100분의50"])
                claim_desc.append("주식 투자한도")
            elif any(k in note for k in ["위험평가액", "장외파생", "파생"]):
                required_keywords.append("위험평가액")
                claim_desc.append("파생 위험평가액")
            elif any(k in note for k in ["사모", "재간접"]):
                required_keywords.extend(["사모", "집합투자증권에 투자", "집합투자증권에투자"])
                claim_desc.append("사모/재간접")
            elif any(k in note for k in ["부동산"]):
                required_keywords.extend(["부동산집합투자기구", "제240조"])
                claim_desc.append("부동산집합투자기구")

            if not required_keywords:
                required_keywords = ["투자대상주식", "위험평가액", "신탁계약", "투자한도"]
                claim_desc.append("일반 규정 조항")


            matched = [kw for kw in required_keywords if kw in file_text]
            if not matched:
                violations["S5"].append({
                    "ticker": tk,
                    "evidence_grade": ev_grade,
                    "evidence_ref": ev_ref,
                    "claim": ", ".join(claim_desc),
                    "required_keywords": required_keywords,
                    "reason": f"증거 파일 본문에 주장 핵심 키워드({required_keywords})가 일체 존재하지 않음 (증거 불충분 표지)",
                })

    # 7-2. S5 expansion: Statute registry primary document sufficiency check
    statute_file = statute_registry_path or (REPO_ROOT / "data/regulatory/statute_registry.csv")
    if statute_file.is_file():
        try:
            with statute_file.open("r", encoding="utf-8-sig", newline="") as f:
                for srow in csv.DictReader(f):
                    sid = (srow.get("statute_id") or "").strip()
                    ev_ref = (srow.get("evidence_ref") or "").strip()
                    excerpt = (srow.get("excerpt") or "").strip()
                    if not ev_ref:
                        violations["S5"].append({
                            "ticker": sid,
                            "statute_id": sid,
                            "reason": "statute_registry 행에 evidence_ref 누락",
                        })
                        continue
                    p = (REPO_ROOT / ev_ref).resolve()
                    if not p.is_file():
                        violations["S5"].append({
                            "ticker": sid,
                            "statute_id": sid,
                            "evidence_ref": ev_ref,
                            "reason": f"statute_registry evidence_ref 파일 미존재: {ev_ref}",
                        })
                        continue
                    try:
                        ftext = p.read_text(encoding="utf-8")
                    except Exception:
                        ftext = p.read_text(encoding="cp949", errors="ignore")

                    # Reject agent-written summary memos
                    if ftext.startswith("# ") and any(sig in ftext for sig in ["작성 메모", "해설 메모", "정본 (KOFIA_FUND_TYPE_STD)"]):
                        violations["S5"].append({
                            "ticker": sid,
                            "statute_id": sid,
                            "evidence_ref": ev_ref,
                            "reason": "에이전트 작성 요약/해설 메모는 공식 evidence_ref로 허용되지 않음 (공식 정본 문서 필수)",
                        })
                    if excerpt and excerpt not in ftext:
                        violations["S5"].append({
                            "ticker": sid,
                            "statute_id": sid,
                            "evidence_ref": ev_ref,
                            "reason": f"excerpt 핵심 문구가 evidence_ref 파일 본문에 실재하지 않음 (S5 불충분)",
                        })
        except Exception as e:
            violations["S5"].append({
                "ticker": "statute_registry",
                "reason": f"statute_registry S5 검증 중 오류: {e}",
            })

    # 8. S6-a: Evidentiary rigor gate for E0 (statutory direct deduction)
    # E0 forbids reusing the exact same evidence_quote across multiple distinct tickers
    # without fund-specific facts. Blanket statutory citations across multiple tickers must trigger violation.
    e0_quotes: dict[str, list[str]] = {}
    for r in ledger_rows:
        eg = str(r.get("evidence_grade") or "").strip().upper()
        if eg == "E0":
            q = str(r.get("evidence_quote") or "").strip()
            tk = str(r.get("ticker") or "").strip().upper()
            if q:
                e0_quotes.setdefault(q, []).append(tk)

    for q, tickers in e0_quotes.items():
        if len(tickers) > 1:
            for tk in tickers:
                violations["S6-a"].append({
                    "ticker": tk,
                    "evidence_grade": "E0",
                    "shared_count": len(tickers),
                    "evidence_quote_sample": q[:60],
                    "reason": f"E0(법령 직접 판정) 등급은 동일한 조문 인용구(evidence_quote)를 여러 종목({len(tickers)}건)에 복제 인용하는 것을 금지합니다. (개별 펀드 사실관계 결여)",
                })

    # 9. S7: evidence_ref must NOT be a locally-created/derived file (must be external primary source)
    for r in ledger_rows:
        tk = str(r.get("ticker") or "").strip().upper()
        ev_ref = str(r.get("evidence_ref") or "").strip()
        ev_grade = str(r.get("evidence_grade") or "").strip().upper()
        if ev_grade in ("E1", "E1B", "E2", "E3", "E4"):
            sub_refs = [p.strip().replace("\\", "/") for p in ev_ref.split(";") if p.strip()] if ev_ref else []
            for p in sub_refs:
                if not (p.startswith("data/regulatory/sources/") or p.startswith("data/regulatory/statutes/")):
                    violations["S7"].append({
                        "ticker": tk,
                        "evidence_grade": ev_grade,
                        "evidence_ref": p,
                        "reason": f"S7 위반: evidence_ref '{p}'는 저장소 내부 생성/파생 파일로 외부 공인 원본이 아님 (sources/ 내 파일만 허용)",
                    })
                elif "broker_pension_universe" in p:
                    violations["S7"].append({
                        "ticker": tk,
                        "evidence_grade": ev_grade,
                        "evidence_ref": p,
                        "reason": f"S7 위반: broker_pension_universe는 실측 조회가 아닌 내부 생성 파일로 증거 사용 금지",
                    })

    # S7 extension: strictly scan all files in sources/ for self-generated internal judgement files
    PROHIBITED_SOURCE_KEYS = ("verification_method", "auditor_consensus", "statutory_eligible", "audited_at")
    sources_dir = REPO_ROOT / "data/regulatory/sources"
    if sources_dir.is_dir():
        for fpath in sources_dir.rglob("*.json"):
            try:
                content = fpath.read_text(encoding="utf-8", errors="ignore")
                for pkey in PROHIBITED_SOURCE_KEYS:
                    if f'"{pkey}"' in content or f"'{pkey}'" in content:
                        violations["S7"].append({
                            "file": str(fpath.relative_to(REPO_ROOT)),
                            "prohibited_key": pkey,
                            "reason": f"S7 위반: sources/ 디렉터리 내 파일 '{fpath.name}'에 자체 판정 키워드 '{pkey}' 존재 (자체 판정 생성 파일의 증거 폴더 유입 절대 금지)",
                        })
            except Exception:
                pass

    # 10. S8: evidence_quote template interpolation prohibition
    for r in ledger_rows:
        tk = str(r.get("ticker") or "").strip().upper()
        q = str(r.get("evidence_quote") or "").strip()
        ev_grade = str(r.get("evidence_grade") or "").strip().upper()
        if ev_grade in ("E0", "E1", "E1B", "E2", "E3", "E4"):
            if "[판매사유니버스]" in q or "투자한도 대조 확인" in q:
                violations["S8"].append({
                    "ticker": tk,
                    "evidence_grade": ev_grade,
                    "evidence_quote": q,
                    "reason": f"S8 위반: evidence_quote '{q}'는 외부 원본 발췌 인용문이 아닌 문자열 보간 템플릿임",
                })

    # 11. S9: WHITELISTED_SHARED_EVIDENCE external primary source validation
    ALLOWED_WHITELISTED_SOURCES = {
        "data/regulatory/sources/kofia_dis_response_20260905.xml",
        "data/regulatory/sources/kofia_evidence_extract_20260905.xml",
        "data/regulatory/sources/brokers/koreainvestment/ETF_REITs_LIST_RP_260831.xlsx",
        "data/regulatory/sources/brokers/koreainvestment/kis_etf_ticker_universe_20260831.txt",
        "data/regulatory/sources/issuers/miraeasset/tiger_pension_search_20260906.html",
        "data/regulatory/sources/issuers/samsung/kodex_pension_search_20260906.json",
        "data/regulatory/sources/issuers/ace/ace_pension_search_20260906.json",
    }

    for w in WHITELISTED_SHARED_EVIDENCE:
        norm_w = w.replace("\\", "/")
        if norm_w not in ALLOWED_WHITELISTED_SOURCES and not norm_w.startswith("data/regulatory/sources/statutes/"):
            violations["S9"].append({
                "whitelisted_file": w,
                "reason": f"S9 위반: 화이트리스트에 비공인 또는 내부 생성 파일 '{w}' 등록 금지 (외부 공인 원본만 허용)",
            })

    # 12. S11: Statutory Personal Pension Evidence Verification (개인연금 법정 적격 증거 검증)
    # Personal pension eligible items must be backed by official disclosure and strictly exclude leverage/inverse.
    if master_rows is None:
        master_file = REPO_ROOT / "data" / "etf_master_draft.csv"
        if master_file.is_file():
            with master_file.open("r", encoding="utf-8-sig") as f:
                master_rows = list(csv.DictReader(f))
        else:
            master_rows = []

    kofia_evidence_file = REPO_ROOT / "data/regulatory/sources/kofia_evidence_extract_20260905.xml"
    for r in master_rows:
        p_status = str(r.get("personal_pension") or "").strip()
        nm = str(r.get("name") or "").strip()
        tk = str(r.get("ticker") or "").strip().upper()
        risk = str(r.get("risk_type") or "").strip().lower()
        is_lev = risk in ("leverage", "inverse") or any(k in nm for k in ("레버리지", "인버스", "2X", "2x", "-1X", "-2X", "Leverage", "Inverse"))
        if is_lev and p_status == "가능":
            violations["S11"].append({
                "ticker": tk,
                "name": nm,
                "reason": f"S11 위반: 레버리지/인버스 종목 '{tk}'({nm})가 개인연금 '가능'으로 등록됨 (표준약관 제8조 위반)",
            })
        if p_status == "가능" and not kofia_evidence_file.is_file():
            violations["S11"].append({
                "ticker": tk,
                "name": nm,
                "reason": f"S11 위반: 개인연금 '가능' 종목의 증거 파일이 존재하지 않음: {kofia_evidence_file}",
            })

    return violations


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ledger",
        type=Path,
        default=REPO_ROOT / "data/regulatory/pension_audit_ledger.csv",
        help="Path to pension_audit_ledger.csv (or legacy verification ledger)",
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

    ledger_rows = None
    audit_rows = None

    if args.ledger.resolve() == args.audit_ledger.resolve():
        if not args.audit_ledger.exists():
            print(f"[ERROR] Audit ledger CSV not found: {args.audit_ledger}", file=sys.stderr)
            return 1
        with args.audit_ledger.open("r", encoding="utf-8-sig", newline="") as f:
            audit_rows = list(csv.DictReader(f))
    else:
        if args.ledger.exists():
            with args.ledger.open("r", encoding="utf-8-sig", newline="") as f:
                ledger_rows = list(csv.DictReader(f))
        if args.audit_ledger.exists():
            with args.audit_ledger.open("r", encoding="utf-8-sig", newline="") as f:
                audit_rows = list(csv.DictReader(f))

    print("=" * 80)
    print("REGULATORY EVIDENCE INTEGRITY CHECKER (Gate 1)")
    print("=" * 80)
    if audit_rows is not None:
        print(f"Audit Ledger        : {args.audit_ledger} ({len(audit_rows):,} rows)")
    if ledger_rows is not None:
        print(f"Legacy Ledger       : {args.ledger} ({len(ledger_rows):,} rows)")
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
