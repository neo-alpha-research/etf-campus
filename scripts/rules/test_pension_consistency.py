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
