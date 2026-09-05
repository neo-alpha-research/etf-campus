"""Unit tests for pension regulatory consistency rules R1 through R9.

Verifies that scripts/rules/validate_pension_consistency.py strictly catches
each violation pattern and that the full master CSV passes with zero violations.
"""

import csv
import pytest
from pathlib import Path

from scripts.rules.validate_pension_consistency import (
    validate_pension_consistency,
    REPO_ROOT,
)
from scripts.rules.validate_evidence_integrity import (
    validate_evidence_integrity,
)


def make_valid_row(**kwargs):
    """Helper to construct a valid baseline row for consistency testing."""
    base = {
        "ticker": "005930",
        "name": "KODEX 삼성전자",
        "risk_type": "normal",
        "asset_class": "주식-국내",
        "base_index": "코스피",
        "pension_eligible": "가능",
        "pension_limit": "70% (위험자산)",
        "pension_source": "규칙기반추정",
        "pension_verified": "N",
        "pension_confidence": "낮음",
        "isa_eligible": "가능",
        "isa_education_required": "N",
        "underlying_is_security": "Y",
    }
    base.update(kwargs)
    return base


def test_r1_verified_requires_broker_or_sample_source():
    # Invalid: verified=Y but source=규칙기반추정
    row_invalid = make_valid_row(pension_verified="Y", pension_source="규칙기반추정")
    viols = validate_pension_consistency([row_invalid], verified_tickers={"005930"})
    assert len(viols["R1"]) == 1
    assert "verified=Y but pension_source=규칙기반추정" in viols["R1"][0]["reason"]

    # Valid: verified=Y and source=증권사목록대조
    row_valid = make_valid_row(
        pension_verified="Y",
        pension_source="증권사목록대조",
        pension_confidence="높음",
    )
    viols_valid = validate_pension_consistency([row_valid], verified_tickers={"005930"})
    assert len(viols_valid["R1"]) == 0

    # Valid: verified=Y and source=협회공시대조
    row_kofia = make_valid_row(
        pension_verified="Y",
        pension_source="협회공시대조",
        pension_confidence="높음",
    )
    viols_kofia = validate_pension_consistency(
        [row_kofia],
        verified_entries={"005930": {"verified_limit": "70% (위험자산)", "source_type": "협회공시대조"}},
    )
    assert len(viols_kofia["R1"]) == 0


def test_r2_unverified_cannot_have_high_confidence():
    # Invalid: verified=N but confidence=높음
    row_invalid = make_valid_row(pension_verified="N", pension_confidence="높음")
    viols = validate_pension_consistency([row_invalid], verified_tickers=set())
    assert len(viols["R2"]) == 1
    assert "pension_verified=N but pension_confidence=높음" in viols["R2"][0]["reason"]

    # Valid: verified=N and confidence=낮음
    row_valid = make_valid_row(pension_verified="N", pension_confidence="낮음")
    viols_valid = validate_pension_consistency([row_valid], verified_tickers=set())
    assert len(viols_valid["R2"]) == 0


def test_r3_eligible_and_limit_ineligible_bidirectional():
    # Invalid: eligible=불가 but limit=70% (위험자산)
    row_invalid_1 = make_valid_row(pension_eligible="불가", pension_limit="70% (위험자산)")
    viols_1 = validate_pension_consistency([row_invalid_1], verified_tickers=set())
    assert len(viols_1["R3"]) == 1

    # Invalid: limit=불가 but eligible=가능
    row_invalid_2 = make_valid_row(pension_eligible="가능", pension_limit="불가")
    viols_2 = validate_pension_consistency([row_invalid_2], verified_tickers=set())
    assert len(viols_2["R3"]) == 1


def test_r4_eligible_limit_enum():
    # Invalid: eligible=가능 but limit=50%
    row_invalid = make_valid_row(pension_eligible="가능", pension_limit="50%")
    viols = validate_pension_consistency([row_invalid], verified_tickers=set())
    assert len(viols["R4"]) == 1

    # Valid: eligible=가능 and limit=100% (안전자산)
    row_valid = make_valid_row(
        asset_class="채권",
        name="KODEX 국고채",
        pension_eligible="가능",
        pension_limit="100% (안전자산)",
    )
    viols_valid = validate_pension_consistency([row_valid], verified_tickers=set())
    assert len(viols_valid["R4"]) == 0


def test_r5_bond_cannot_be_risk_asset_without_reason():
    # Invalid: asset_class=채권 but limit=70% (위험자산) (0191M0 regression check)
    row_invalid = make_valid_row(
        asset_class="채권",
        name="마이티 특수채",
        pension_limit="70% (위험자산)",
    )
    viols = validate_pension_consistency([row_invalid], verified_tickers=set())
    assert len(viols["R5"]) == 1

    # Valid: asset_class=채권 and limit=100% (안전자산)
    row_valid = make_valid_row(
        asset_class="채권",
        name="마이티 특수채",
        pension_limit="100% (안전자산)",
    )
    viols_valid = validate_pension_consistency([row_valid], verified_tickers=set())
    assert len(viols_valid["R5"]) == 0


def test_r6_equity_cannot_be_safe_asset():
    # Invalid: asset_class=주식-국내 but limit=100% (안전자산)
    row_invalid = make_valid_row(
        asset_class="주식-국내",
        pension_limit="100% (안전자산)",
    )
    viols = validate_pension_consistency([row_invalid], verified_tickers=set())
    assert len(viols["R6"]) == 1

    # Valid: asset_class=주식-국내 and limit=70% (위험자산)
    row_valid = make_valid_row(
        asset_class="주식-국내",
        pension_limit="70% (위험자산)",
    )
    viols_valid = validate_pension_consistency([row_valid], verified_tickers=set())
    assert len(viols_valid["R6"]) == 0


def test_r7_leverage_inverse_must_be_ineligible():
    # Invalid: leverage with limit=70%
    row_invalid = make_valid_row(
        name="KODEX 레버리지",
        risk_type="leverage",
        pension_eligible="가능",
        pension_limit="70% (위험자산)",
    )
    viols = validate_pension_consistency([row_invalid], verified_tickers=set())
    assert len(viols["R7"]) == 1

    # Valid: leverage with limit=불가
    row_valid = make_valid_row(
        name="KODEX 레버리지",
        risk_type="leverage",
        pension_eligible="불가",
        pension_limit="불가",
        isa_education_required="Y",
    )
    viols_valid = validate_pension_consistency([row_valid], verified_tickers=set())
    assert len(viols_valid["R7"]) == 0


def test_r8_statute_direct_recalculation_match():
    # Invalid: claimed statute direct on standard domestic equity ETF
    row_invalid = make_valid_row(
        name="KODEX 삼성전자",
        pension_source="법령조건직접판정",
        pension_confidence="보통",
    )
    viols = validate_pension_consistency([row_invalid], verified_tickers=set())
    assert len(viols["R8"]) == 1

    # Valid: 1X synthetic equity meets 2016.9.21 statute exception
    row_valid = make_valid_row(
        ticker="999999",
        name="TIGER 미국S&P500(합성)",
        base_index="S&P 500",
        risk_type="normal",
        asset_class="주식-해외",
        pension_source="법령조건직접판정",
        pension_confidence="보통",
    )
    viols_valid = validate_pension_consistency([row_valid], verified_tickers=set())
    assert len(viols_valid["R8"]) == 0


def test_r9_engine_recomputation_exact_match():
    # Invalid: row's pension_limit artificially diverges from engine
    row_divergent = make_valid_row(
        pension_limit="100% (안전자산)",  # Engine evaluates to 70%
    )
    viols = validate_pension_consistency([row_divergent], verified_tickers=set())
    assert len(viols["R9"]) == 1


def test_full_master_csv_zero_violations():
    """Verify that the official data/etf_master_draft.csv passes all R1-R9 rules with 0 violations."""
    master_path = REPO_ROOT / "data/etf_master_draft.csv"
    assert master_path.exists(), "Master CSV must exist"

    with master_path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    assert len(rows) == 1167, "Must contain exactly 1,167 ETFs"

    violations = validate_pension_consistency(rows)
    total_viols = sum(len(v) for v in violations.values())

    for rule, v_list in violations.items():
        assert len(v_list) == 0, f"Rule {rule} failed with {len(v_list)} violations: {v_list[:3]}"

    assert total_viols == 0, "DoD Gate A requires 0 total violations across all 1,167 rows"


# ---------------------------------------------------------------------------
# Gate 1: Evidence Integrity Unit Tests (E1 ~ E4)
# ---------------------------------------------------------------------------

def test_e1_evidence_ref_must_be_real_file():
    # Invalid: phrase instead of file path
    row_phrase = {
        "ticker": "0000D0",
        "evidence_ref": "투자설명서(신탁계약서) 제16조(투자대상 및 투자비율)",
        "source_url": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20240905000123",
        "verified_at": "2026-09-05",
    }
    viols_1 = validate_evidence_integrity([row_phrase])
    assert len(viols_1["E1"]) == 1
    assert "실존하지 않음" in viols_1["E1"][0]["reason"]

    # Invalid: non-existent file path
    row_missing = {
        "ticker": "005930",
        "evidence_ref": "data/regulatory/sources/non_existent_file.xml",
        "source_url": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20240905000123",
        "verified_at": "2026-09-05",
    }
    viols_2 = validate_evidence_integrity([row_missing])
    assert len(viols_2["E1"]) == 1

    # Valid: actual existing file
    row_valid = {
        "ticker": "069500",
        "evidence_ref": "data/regulatory/sources/kofia_dis_response_20260905.xml",
        "source_url": "https://dis.kofia.or.kr/websquare/index.jsp?serviceId=SDIS01005001000",
        "verified_at": "2026-09-05",
    }
    viols_3 = validate_evidence_integrity([row_valid])
    assert len(viols_3["E1"]) == 0


def test_e2_source_url_domain_format():
    # Invalid: DART URL without 14-digit rcpNo
    row_fake_dart = {
        "ticker": "0000D0",
        "evidence_ref": "data/regulatory/sources/kofia_dis_response_20260905.xml",
        "source_url": "https://dart.fss.or.kr/dsac001/main.do?select=ticker_0000D0",
        "verified_at": "2026-09-05",
    }
    viols_1 = validate_evidence_integrity([row_fake_dart])
    assert len(viols_1["E2"]) == 1
    assert "rcpNo" in viols_1["E2"][0]["reason"]

    # Valid: DART URL with 14-digit rcpNo
    row_valid_dart = {
        "ticker": "0000D0",
        "evidence_ref": "data/regulatory/sources/kofia_dis_response_20260905.xml",
        "source_url": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20240905000123",
        "verified_at": "2026-09-05",
    }
    viols_2 = validate_evidence_integrity([row_valid_dart])
    assert len(viols_2["E2"]) == 0

    # Invalid: KOFIA URL without serviceId
    row_bad_kofia = {
        "ticker": "069500",
        "evidence_ref": "data/regulatory/sources/kofia_dis_response_20260905.xml",
        "source_url": "https://dis.kofia.or.kr/websquare/index.jsp",
        "verified_at": "2026-09-05",
    }
    viols_3 = validate_evidence_integrity([row_bad_kofia])
    assert len(viols_3["E2"]) == 1
    assert "serviceId" in viols_3["E2"][0]["reason"]


def test_e3_evidence_concentration_check():
    # Invalid: 51 rows sharing a non-whitelisted path
    fake_rows = [
        {
            "ticker": f"TICK{i:03d}",
            "evidence_ref": "data/regulatory/sources/single_unwhitelisted_file.csv",
            "source_url": "https://dis.kofia.or.kr/websquare/index.jsp?serviceId=TEST",
            "verified_at": "2026-09-05",
        }
        for i in range(55)
    ]
    viols = validate_evidence_integrity(fake_rows, shared_threshold=50)
    assert len(viols["E3"]) == 1
    assert "과다 공유" in viols["E3"][0]["reason"]


def test_e4_verified_at_precedes_mtime():
    # Invalid: verified_at in 2020 before file existed
    row_predated = {
        "ticker": "069500",
        "evidence_ref": "data/regulatory/sources/kofia_dis_response_20260905.xml",
        "source_url": "https://dis.kofia.or.kr/websquare/index.jsp?serviceId=SDIS01005001000",
        "verified_at": "2020-01-01",
    }
    viols = validate_evidence_integrity([row_predated])
    assert len(viols["E4"]) == 1
    assert "앞섬" in viols["E4"][0]["reason"]


def test_e5_manifest_sha256_hash_validation():
    # Verify manifest exists and is valid
    manifest_path = REPO_ROOT / "data/regulatory/sources/evidence_manifest.json"
    assert manifest_path.is_file(), "evidence_manifest.json must exist"

    # Testing with official ledger rows produces 0 E5 violations
    ledger_path = REPO_ROOT / "data/regulatory/pension_verification_ledger.csv"
    with ledger_path.open("r", encoding="utf-8-sig", newline="") as f:
        ledger_rows = list(csv.DictReader(f))

    viols = validate_evidence_integrity(ledger_rows=ledger_rows)
    assert len(viols["E5"]) == 0, f"E5 hash check failed: {viols['E5']}"


def test_official_ledgers_evidence_integrity_zero_violations():
    """Verify that both official ledgers pass E1 through E5 with zero violations."""
    ledger_path = REPO_ROOT / "data/regulatory/pension_verification_ledger.csv"
    audit_path = REPO_ROOT / "data/regulatory/pension_audit_ledger.csv"

    assert ledger_path.exists(), "Verification ledger must exist"
    assert audit_path.exists(), "Audit ledger must exist"

    with ledger_path.open("r", encoding="utf-8-sig", newline="") as f:
        ledger_rows = list(csv.DictReader(f))
    with audit_path.open("r", encoding="utf-8-sig", newline="") as f:
        audit_rows = list(csv.DictReader(f))

    assert len(ledger_rows) == 738, f"Verification ledger must have 738 rows, got {len(ledger_rows)}"
    assert len(audit_rows) == 1167, f"Audit ledger must have 1,167 rows, got {len(audit_rows)}"

    violations = validate_evidence_integrity(ledger_rows=ledger_rows, audit_rows=audit_rows)
    total_viols = sum(len(v) for v in violations.values())

    for rule, v_list in violations.items():
        assert len(v_list) == 0, f"Evidence rule {rule} failed: {v_list[:3]}"

    assert total_viols == 0, "Gate 1 requires 0 total violations across all ledger entries"


def test_s1_statute_must_be_registered():
    fake_audit = [{
        "ticker": "005930",
        "statutory_basis": "NON_EXISTENT_STATUTE_ID",
        "pension_verified": "N",
        "pension_limit": "70% (위험자산)",
    }]
    viols = validate_evidence_integrity(audit_rows=fake_audit)
    assert len(viols["S1"]) == 1
    assert "NON_EXISTENT_STATUTE_ID" in viols["S1"][0]["reason"]
    assert "미등록된" in viols["S1"][0]["reason"]


def test_s3_statute_limit_mapping_and_forbidden_statutes():
    # Invalid: PSR_ART11_1_4 (bond 100%) mapped to 70%
    fake_audit_mismatch = [{
        "ticker": "005930",
        "statutory_basis": "PSR_ART11_1_4",
        "pension_verified": "N",
        "pension_limit": "70% (위험자산)",
    }]
    viols_1 = validate_evidence_integrity(audit_rows=fake_audit_mismatch)
    assert len(viols_1["S3"]) == 1
    assert "PSR_ART11_1_4" in viols_1["S3"][0]["reason"]
    assert "허용되지 않은" in viols_1["S3"][0]["reason"]

    # Invalid: WRBA_ART21 is strictly forbidden (cannot justify limits)
    fake_audit_forbidden = [{
        "ticker": "005930",
        "statutory_basis": "WRBA_ART21",
        "pension_verified": "N",
        "pension_limit": "70% (위험자산)",
    }]
    viols_2 = validate_evidence_integrity(audit_rows=fake_audit_forbidden)
    assert len(viols_2["S3"]) == 1
    assert "WRBA_ART21" in viols_2["S3"][0]["reason"]
    assert "원천 차단" in viols_2["S3"][0]["reason"]

    # Invalid: PSR_ART12_1_1 is strictly forbidden (collective investments excluded)
    fake_audit_art12 = [{
        "ticker": "005930",
        "statutory_basis": "PSR_ART12_1_1",
        "pension_verified": "N",
        "pension_limit": "70% (위험자산)",
    }]
    viols_3 = validate_evidence_integrity(audit_rows=fake_audit_art12)
    assert len(viols_3["S3"]) == 1
    assert "PSR_ART12_1_1" in viols_3["S3"][0]["reason"]
    assert "원천 차단" in viols_3["S3"][0]["reason"]


def test_s4_empty_statutory_basis_requires_unverified():
    # Invalid: statutory_basis is empty but pension_verified = Y
    fake_audit = [{
        "ticker": "005930",
        "statutory_basis": "",
        "pension_verified": "Y",
        "pension_limit": "70% (위험자산)",
    }]
    viols = validate_evidence_integrity(audit_rows=fake_audit)
    assert len(viols["S4"]) == 1
    assert "pension_verified = Y" in viols["S4"][0]["reason"]

    # Valid: statutory_basis is empty and pension_verified = N
    fake_audit_valid = [{
        "ticker": "005930",
        "statutory_basis": "",
        "pension_verified": "N",
        "pension_limit": "70% (위험자산)",
    }]
    viols_valid = validate_evidence_integrity(audit_rows=fake_audit_valid)
    assert len(viols_valid["S4"]) == 0

