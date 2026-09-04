import pytest
from scripts.rules.pension_regulatory_engine import (
    classify_pension_and_isa,
    PENSION_ELIGIBLE,
    PENSION_INELIGIBLE,
    LIMIT_SAFE_ASSET,
    LIMIT_RISK_ASSET,
    LIMIT_INELIGIBLE,
    ISA_ELIGIBLE,
    ISA_INELIGIBLE,
)


def test_leverage_and_inverse():
    # Leverage: Pension Ineligible, but ISA Eligible (with education/deposit)
    res_lev = classify_pension_and_isa({
        "ticker": "122630",
        "name": "KODEX 레버리지",
        "risk_type": "leverage",
        "asset_class": "주식-국내",
    })
    assert res_lev["pension_eligible"] == PENSION_INELIGIBLE
    assert res_lev["pension_limit"] == LIMIT_INELIGIBLE
    assert res_lev["isa_eligible"] == ISA_ELIGIBLE

    # Inverse: Pension Ineligible, but ISA Eligible
    res_inv = classify_pension_and_isa({
        "ticker": "114800",
        "name": "KODEX 인버스",
        "risk_type": "inverse",
        "asset_class": "주식-국내",
    })
    assert res_inv["pension_eligible"] == PENSION_INELIGIBLE
    assert res_inv["pension_limit"] == LIMIT_INELIGIBLE
    assert res_inv["isa_eligible"] == ISA_ELIGIBLE


def test_commodity_futures_vs_spot():
    # 1X Oil Futures: Pension Ineligible, but ISA Eligible
    res_oil = classify_pension_and_isa({
        "ticker": "261220",
        "name": "KODEX WTI원유선물(H)",
        "base_index": "S&P GSCI Crude Oil Index ER",
        "risk_type": "normal",
        "asset_class": "원자재",
    })
    assert res_oil["pension_eligible"] == PENSION_INELIGIBLE
    assert res_oil["pension_limit"] == LIMIT_INELIGIBLE
    assert res_oil["isa_eligible"] == ISA_ELIGIBLE

    # KRX Gold Spot: Pension Eligible (70% risk asset), ISA Eligible
    res_gold = classify_pension_and_isa({
        "ticker": "411060",
        "name": "ACE KRX금현물",
        "base_index": "KRX 금현물 지수",
        "risk_type": "normal",
        "asset_class": "원자재",
    })
    assert res_gold["pension_eligible"] == PENSION_ELIGIBLE
    assert res_gold["pension_limit"] == LIMIT_RISK_ASSET
    assert res_gold["isa_eligible"] == ISA_ELIGIBLE


def test_pure_bond_and_parking():
    # Pure Bond: 100% Safe Asset in Pension, ISA Eligible
    res_bond = classify_pension_and_isa({
        "ticker": "148070",
        "name": "KOSEF 국고채10년",
        "risk_type": "normal",
        "asset_class": "채권",
    })
    assert res_bond["pension_eligible"] == PENSION_ELIGIBLE
    assert res_bond["pension_limit"] == LIMIT_SAFE_ASSET
    assert res_bond["isa_eligible"] == ISA_ELIGIBLE

    # CD Rate Parking: 100% Safe Asset in Pension, ISA Eligible
    res_cd = classify_pension_and_isa({
        "ticker": "459580",
        "name": "KODEX CD금리액티브(합성)",
        "risk_type": "normal",
        "asset_class": "금리·파킹",
    })
    assert res_cd["pension_eligible"] == PENSION_ELIGIBLE
    assert res_cd["pension_limit"] == LIMIT_SAFE_ASSET
    assert res_cd["isa_eligible"] == ISA_ELIGIBLE


def test_bond_mixed_50_and_tdf():
    # Bond mixed 50: 100% Safe Asset in Pension under 2022 amendment
    res_mixed50 = classify_pension_and_isa({
        "ticker": "0233A0",
        "name": "ACE 삼성전자SK하이닉스플러스채권혼합50",
        "risk_type": "normal",
        "asset_class": "채권",
    })
    assert res_mixed50["pension_eligible"] == PENSION_ELIGIBLE
    assert res_mixed50["pension_limit"] == LIMIT_SAFE_ASSET
    assert res_mixed50["isa_eligible"] == ISA_ELIGIBLE

    # Qualified TDF: 100% Safe Asset in Pension
    res_tdf = classify_pension_and_isa({
        "ticker": "0231Z0",
        "name": "KODEX 코리아적격TDF2065액티브",
        "risk_type": "normal",
        "asset_class": "혼합·자산배분",
    })
    assert res_tdf["pension_eligible"] == PENSION_ELIGIBLE
    assert res_tdf["pension_limit"] == LIMIT_SAFE_ASSET
    assert res_tdf["isa_eligible"] == ISA_ELIGIBLE


def test_trf_subtypes():
    # TRF3070 (30% stock): 100% Safe Asset
    res_3070 = classify_pension_and_isa({
        "ticker": "329650",
        "name": "KODEX TRF3070",
        "risk_type": "normal",
        "asset_class": "혼합·자산배분",
    })
    assert res_3070["pension_limit"] == LIMIT_SAFE_ASSET

    # TRF7030 (70% stock): 70% Risk Asset
    res_7030 = classify_pension_and_isa({
        "ticker": "329670",
        "name": "KODEX TRF7030",
        "risk_type": "normal",
        "asset_class": "혼합·자산배분",
    })
    assert res_7030["pension_limit"] == LIMIT_RISK_ASSET


def test_standard_equity_etfs():
    # KODEX 200: 70% Risk Asset in Pension, ISA Eligible
    res_equity = classify_pension_and_isa({
        "ticker": "069500",
        "name": "KODEX 200",
        "risk_type": "normal",
        "asset_class": "주식-국내",
    })
    assert res_equity["pension_eligible"] == PENSION_ELIGIBLE
    assert res_equity["pension_limit"] == LIMIT_RISK_ASSET
    assert res_equity["isa_eligible"] == ISA_ELIGIBLE
