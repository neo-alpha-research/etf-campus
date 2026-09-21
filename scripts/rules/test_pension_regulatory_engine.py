from scripts.rules.pension_regulatory_engine import (
    classify_pension_and_isa,
    classify_new_listing,
    PENSION_ELIGIBLE,
    PENSION_INELIGIBLE,
    LIMIT_SAFE_ASSET,
    LIMIT_RISK_ASSET,
    LIMIT_INELIGIBLE,
    ISA_ELIGIBLE,
    ISA_INELIGIBLE,
    ISA_EDUCATION_REQUIRED,
    ISA_EDUCATION_NOT_REQUIRED,
    PENSION_SOURCE_STATUTE_DIRECT,
    PENSION_SOURCE_RULE_ESTIMATE,
    PENSION_SOURCE_SAMPLE_VERIFIED,
    PENSION_SOURCE_BROKER_VERIFIED,
    PENSION_SOURCE_CROSS_VERIFIED,
    PENSION_SOURCE_KOFIA_VERIFIED,
    PENSION_SOURCE_PROSPECTUS_VERIFIED,
    PENSION_CONFIDENCE_HIGH,
    PENSION_CONFIDENCE_MODERATE,
    PENSION_CONFIDENCE_LOW,
    PENSION_VERIFIED_YES,
    PENSION_VERIFIED_NO,
    is_underlying_security,
)


def test_leverage_and_inverse():
    # Leverage: Pension Ineligible, ISA Eligible (with education/deposit: "Y")
    res_lev = classify_pension_and_isa({
        "ticker": "122630",
        "name": "KODEX 레버리지",
        "risk_type": "leverage",
        "asset_class": "주식-국내",
    })
    assert res_lev["pension_eligible"] == PENSION_INELIGIBLE
    assert res_lev["pension_limit"] == LIMIT_INELIGIBLE
    assert res_lev["isa_eligible"] == ISA_ELIGIBLE
    assert res_lev["isa_education_required"] == ISA_EDUCATION_REQUIRED

    # Inverse -1X: Pension Ineligible, ISA Eligible, Education NOT required ("N")
    res_inv = classify_pension_and_isa({
        "ticker": "114800",
        "name": "KODEX 인버스",
        "risk_type": "inverse",
        "asset_class": "주식-국내",
    })
    assert res_inv["pension_eligible"] == PENSION_INELIGIBLE
    assert res_inv["pension_limit"] == LIMIT_INELIGIBLE
    assert res_inv["isa_eligible"] == ISA_ELIGIBLE
    assert res_inv["isa_education_required"] == ISA_EDUCATION_NOT_REQUIRED

    # Inverse -2X: Pension Ineligible, ISA Eligible, Education REQUIRED ("Y")
    res_inv2x = classify_pension_and_isa({
        "ticker": "252670",
        "name": "KODEX 200선물인버스2X",
        "risk_type": "inverse",
        "asset_class": "주식-국내",
    })
    assert res_inv2x["pension_eligible"] == PENSION_INELIGIBLE
    assert res_inv2x["pension_limit"] == LIMIT_INELIGIBLE
    assert res_inv2x["isa_eligible"] == ISA_ELIGIBLE
    assert res_inv2x["isa_education_required"] == ISA_EDUCATION_REQUIRED


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
    assert res_equity["isa_education_required"] == ISA_EDUCATION_NOT_REQUIRED


def test_pension_source_and_confidence():
    # 1. Area B: 1X Securities Synthetic ETF fallback -> Direct Statute, unverified, MODERATE confidence
    res_synth = classify_pension_and_isa({
        "ticker": "459580",
        "name": "KODEX CD금리액티브(합성)",
        "risk_type": "normal",
        "asset_class": "금리·파킹",
    }, verified_entries={})
    assert res_synth["pension_source"] == PENSION_SOURCE_STATUTE_DIRECT
    assert res_synth["pension_verified"] == PENSION_VERIFIED_NO
    assert res_synth["pension_confidence"] == PENSION_CONFIDENCE_MODERATE
    assert res_synth["underlying_is_security"] == "Y"
    assert res_synth["pension_eligible"] == PENSION_ELIGIBLE
    assert res_synth["pension_limit"] == LIMIT_SAFE_ASSET

    # 1-1. When ledger entry is present, verified = Y
    res_synth_verified = classify_pension_and_isa(
        {
            "ticker": "459580",
            "name": "KODEX CD금리액티브(합성)",
            "risk_type": "normal",
            "asset_class": "금리·파킹",
        },
        verified_entries={"459580": {"verified_limit": LIMIT_SAFE_ASSET, "source_type": PENSION_SOURCE_KOFIA_VERIFIED}},
    )
    assert res_synth_verified["pension_source"] == PENSION_SOURCE_KOFIA_VERIFIED
    assert res_synth_verified["pension_verified"] == PENSION_VERIFIED_YES
    assert res_synth_verified["pension_confidence"] == PENSION_CONFIDENCE_HIGH

    # 2. Special Audit Case: 219390 (RISE 미국S&P원유생산기업(합성 H)) fallback when unverified
    # Misclassified as '원자재' in asset_class, but tracks oil producer EQUITIES -> underlying_is_security == 'Y'
    res_219390 = classify_pension_and_isa({
        "ticker": "219390",
        "name": "RISE 미국S&P원유생산기업(합성 H)",
        "base_index": "S&P Oil & Gas Exploration & Production Select Industry Index(PR)",
        "risk_type": "normal",
        "asset_class": "원자재",
    }, verified_entries={})
    assert res_219390["underlying_is_security"] == "Y"
    assert res_219390["pension_source"] == PENSION_SOURCE_STATUTE_DIRECT
    assert res_219390["pension_verified"] == PENSION_VERIFIED_NO
    assert res_219390["pension_confidence"] == PENSION_CONFIDENCE_MODERATE
    assert res_219390["pension_eligible"] == PENSION_ELIGIBLE

    # 2-1. When ledger entry is present, verified = Y (70% 위험자산)
    res_219390_verified = classify_pension_and_isa(
        {
            "ticker": "219390",
            "name": "RISE 미국S&P원유생산기업(합성 H)",
            "base_index": "S&P Oil & Gas Exploration & Production Select Industry Index(PR)",
            "risk_type": "normal",
            "asset_class": "원자재",
        },
        verified_entries={"219390": {"verified_limit": LIMIT_RISK_ASSET, "source_type": PENSION_SOURCE_PROSPECTUS_VERIFIED}},
    )
    assert res_219390_verified["pension_source"] == PENSION_SOURCE_PROSPECTUS_VERIFIED
    assert res_219390_verified["pension_verified"] == PENSION_VERIFIED_YES
    assert res_219390_verified["pension_confidence"] == PENSION_CONFIDENCE_HIGH
    assert res_219390_verified["pension_limit"] == LIMIT_RISK_ASSET

    # 3. Non-Security Futures ETF: 400570 (Carbon credit futures H) fallback when unverified
    res_carbon = classify_pension_and_isa({
        "ticker": "400570",
        "name": "KODEX 유럽탄소배출권선물ICE(H)",
        "base_index": "ICE European Carbon Futures Index",
        "risk_type": "normal",
        "asset_class": "원자재",
    }, verified_entries={})
    assert res_carbon["underlying_is_security"] == "N"
    assert res_carbon["pension_eligible"] == PENSION_INELIGIBLE
    assert res_carbon["pension_source"] == PENSION_SOURCE_RULE_ESTIMATE
    assert res_carbon["pension_verified"] == PENSION_VERIFIED_NO
    assert res_carbon["pension_confidence"] == PENSION_CONFIDENCE_LOW

    # 3-1. Non-Security Futures ETF verified via ledger
    res_carbon_verified = classify_pension_and_isa(
        {
            "ticker": "400570",
            "name": "KODEX 유럽탄소배출권선물ICE(H)",
            "base_index": "ICE European Carbon Futures Index",
            "risk_type": "normal",
            "asset_class": "원자재",
        },
        verified_entries={"400570": {"verified_limit": LIMIT_INELIGIBLE, "source_type": PENSION_SOURCE_PROSPECTUS_VERIFIED}},
    )
    assert res_carbon_verified["underlying_is_security"] == "N"
    assert res_carbon_verified["pension_eligible"] == PENSION_INELIGIBLE

    assert res_carbon_verified["pension_source"] == PENSION_SOURCE_PROSPECTUS_VERIFIED
    assert res_carbon_verified["pension_verified"] == PENSION_VERIFIED_YES
    assert res_carbon_verified["pension_confidence"] == PENSION_CONFIDENCE_HIGH

    # 4. Area D: Synthetic Covered Call Revocation Verification (472830 fallback)
    # Even though synthetic, covered call is prioritized into Area D -> RULE_ESTIMATE, LOW confidence when unverified
    res_synth_cc = classify_pension_and_isa({
        "ticker": "472830",
        "name": "RISE 미국30년국채커버드콜(합성)",
        "risk_type": "normal",
        "asset_class": "채권",
    }, verified_entries={})
    assert res_synth_cc["pension_source"] == PENSION_SOURCE_RULE_ESTIMATE
    assert res_synth_cc["pension_verified"] == PENSION_VERIFIED_NO
    assert res_synth_cc["pension_confidence"] == PENSION_CONFIDENCE_LOW
    assert res_synth_cc["pension_eligible"] == PENSION_ELIGIBLE

    # 5. Sample verified Synthetic Covered Call (441680) -> RULE_ESTIMATE, VERIFIED_YES, HIGH confidence
    res_synth_cc_sample = classify_pension_and_isa({
        "ticker": "441680",
        "name": "TIGER 미국나스닥100커버드콜(합성)",
        "risk_type": "normal",
        "asset_class": "주식-해외",
    }, verified_entries={}, verified_tickers={"441680"})
    assert res_synth_cc_sample["pension_source"] == PENSION_SOURCE_BROKER_VERIFIED
    assert res_synth_cc_sample["pension_verified"] == PENSION_VERIFIED_YES
    assert res_synth_cc_sample["pension_confidence"] == PENSION_CONFIDENCE_HIGH

    # 6. Verified Synthetic Non-Covered-Call (0005C0) -> BROKER_VERIFIED, VERIFIED_YES, HIGH confidence
    res_synth_sample = classify_pension_and_isa({
        "ticker": "0005C0",
        "name": "RISE 미국S&P500엔화노출(합성 H)",
        "risk_type": "normal",
        "asset_class": "주식-해외",
    }, verified_entries={}, verified_tickers={"0005C0"})
    assert res_synth_sample["pension_source"] == PENSION_SOURCE_BROKER_VERIFIED
    assert res_synth_sample["pension_verified"] == PENSION_VERIFIED_YES
    assert res_synth_sample["pension_confidence"] == PENSION_CONFIDENCE_HIGH

    # 7. Verified Physical Covered Call (289480) -> BROKER_VERIFIED, VERIFIED_YES, HIGH confidence
    res_sample = classify_pension_and_isa({
        "ticker": "289480",
        "name": "TIGER 200커버드콜ATM",
        "risk_type": "normal",
        "asset_class": "주식-국내",
    }, verified_entries={}, verified_tickers={"289480"})
    assert res_sample["pension_source"] == PENSION_SOURCE_BROKER_VERIFIED
    assert res_sample["pension_verified"] == PENSION_VERIFIED_YES
    assert res_sample["pension_confidence"] == PENSION_CONFIDENCE_HIGH

    # 8. Unverified Physical Covered Call -> Area D Gray Zone, LOW confidence
    res_cc = classify_pension_and_isa({
        "ticker": "999999",
        "name": "TEST 코스피200커버드콜",
        "risk_type": "normal",
        "asset_class": "주식-국내",
    })
    assert res_cc["pension_source"] == PENSION_SOURCE_RULE_ESTIMATE
    assert res_cc["pension_verified"] == PENSION_VERIFIED_NO
    assert res_cc["pension_confidence"] == PENSION_CONFIDENCE_LOW

    # 9. Standard equity ETF unverified fallback (when not in ledger) -> Rule estimate, unverified, LOW confidence
    res_std = classify_pension_and_isa({
        "ticker": "999998",
        "name": "TEST KODEX 200",
        "risk_type": "normal",
        "asset_class": "주식-국내",
    }, verified_entries={})
    assert res_std["pension_source"] == PENSION_SOURCE_RULE_ESTIMATE
    assert res_std["pension_verified"] == PENSION_VERIFIED_NO
    assert res_std["pension_confidence"] == PENSION_CONFIDENCE_LOW

    # 9-1. Standard equity ETF verified via KOFIA ledger (069500) -> KOFIA_VERIFIED, HIGH confidence per Step B resolution
    res_kofia = classify_pension_and_isa({
        "ticker": "069500",
        "name": "KODEX 200",
        "risk_type": "normal",
        "asset_class": "주식-국내",
    })
    assert res_kofia["pension_source"] in (PENSION_SOURCE_KOFIA_VERIFIED, PENSION_SOURCE_CROSS_VERIFIED)
    assert res_kofia["pension_verified"] == PENSION_VERIFIED_YES
    assert res_kofia["pension_confidence"] == PENSION_CONFIDENCE_HIGH

    # 10. Futures ETF (261220, normal with futures keyword) fallback when unverified
    res_fut = classify_pension_and_isa({
        "ticker": "261220",
        "name": "KODEX WTI원유선물(H)",
        "risk_type": "normal",
        "asset_class": "원자재",
    }, verified_entries={})
    assert res_fut["pension_eligible"] == PENSION_INELIGIBLE
    assert res_fut["pension_verified"] == PENSION_VERIFIED_NO
    assert res_fut["pension_confidence"] == PENSION_CONFIDENCE_LOW

    # 10-1. Futures ETF verified via prospectus ledger
    res_fut_verified = classify_pension_and_isa(
        {
            "ticker": "261220",
            "name": "KODEX WTI원유선물(H)",
            "risk_type": "normal",
            "asset_class": "원자재",
        },
        verified_entries={"261220": {"verified_limit": LIMIT_INELIGIBLE, "source_type": PENSION_SOURCE_PROSPECTUS_VERIFIED}},
    )
    assert res_fut_verified["pension_eligible"] == PENSION_INELIGIBLE
    assert res_fut_verified["pension_verified"] == PENSION_VERIFIED_YES
    assert res_fut_verified["pension_source"] == PENSION_SOURCE_PROSPECTUS_VERIFIED
    assert res_fut_verified["pension_confidence"] == PENSION_CONFIDENCE_HIGH

    # 11. Leverage ETF (122630) fallback when unverified
    res_lev = classify_pension_and_isa({
        "ticker": "122630",
        "name": "KODEX 레버리지",
        "risk_type": "leverage",
        "asset_class": "주식-국내",
    }, verified_entries={})
    assert res_lev["pension_eligible"] == PENSION_INELIGIBLE
    assert res_lev["pension_verified"] == PENSION_VERIFIED_NO
    assert res_lev["pension_confidence"] == PENSION_CONFIDENCE_LOW

    # 11-1. Leverage ETF verified via prospectus ledger
    res_lev_verified = classify_pension_and_isa(
        {
            "ticker": "122630",
            "name": "KODEX 레버리지",
            "risk_type": "leverage",
            "asset_class": "주식-국내",
        },
        verified_entries={"122630": {"verified_limit": LIMIT_INELIGIBLE, "source_type": PENSION_SOURCE_PROSPECTUS_VERIFIED}},
    )
    assert res_lev_verified["pension_eligible"] == PENSION_INELIGIBLE
    assert res_lev_verified["pension_verified"] == PENSION_VERIFIED_YES
    assert res_lev_verified["pension_source"] == PENSION_SOURCE_PROSPECTUS_VERIFIED
    assert res_lev_verified["pension_confidence"] == PENSION_CONFIDENCE_HIGH


def test_broker_universe_dynamic_verification():
    # Unverified covered call -> LOW confidence
    unverified_cc = {
        "ticker": "999999",
        "name": "TEST 커버드콜",
        "risk_type": "normal",
        "asset_class": "주식-국내",
    }
    res_before = classify_pension_and_isa(unverified_cc, verified_tickers=set())
    assert res_before["pension_verified"] == PENSION_VERIFIED_NO
    assert res_before["pension_confidence"] == PENSION_CONFIDENCE_LOW

    # Verified via broker list -> upgraded to HIGH confidence
    res_after = classify_pension_and_isa(unverified_cc, verified_tickers={"999999"})
    assert res_after["pension_verified"] == PENSION_VERIFIED_YES
    assert res_after["pension_confidence"] == PENSION_CONFIDENCE_HIGH
    assert "증권사 적격 대조 완료" in res_after["pension_reason"]

    # Compliance Veto: Even if broker list includes leverage, statutory rule strictly overrides
    fake_broker_leverage = {
        "ticker": "122630",
        "name": "KODEX 레버리지",
        "risk_type": "leverage",
        "asset_class": "주식-국내",
    }
    # When unverified in ledger, fallback confidence is LOW and broker list cannot verify leverage
    res_veto = classify_pension_and_isa(fake_broker_leverage, verified_entries={}, verified_tickers={"122630"})
    assert res_veto["pension_eligible"] == PENSION_INELIGIBLE
    assert res_veto["pension_limit"] == LIMIT_INELIGIBLE
    assert res_veto["pension_verified"] == PENSION_VERIFIED_NO
    assert res_veto["pension_confidence"] == PENSION_CONFIDENCE_LOW

    # When ledger entry is present, confirmed ineligible with HIGH confidence
    res_veto_verified = classify_pension_and_isa(
        fake_broker_leverage,
        verified_entries={"122630": {"verified_limit": LIMIT_INELIGIBLE, "source_type": PENSION_SOURCE_KOFIA_VERIFIED}},
        verified_tickers={"122630"},
    )
    assert res_veto_verified["pension_eligible"] == PENSION_INELIGIBLE
    assert res_veto_verified["pension_limit"] == LIMIT_INELIGIBLE
    assert res_veto_verified["pension_verified"] == PENSION_VERIFIED_YES
    assert res_veto_verified["pension_confidence"] == PENSION_CONFIDENCE_HIGH


def test_classify_new_listing_never_defaults_to_safe_asset():
    """Gate 5: Newly listed ETF automatic classifier must NEVER default to 100% (safe asset).
    
    Permits only '불가' or '70% (위험자산)'. Verified flag must be 'N'.
    """
    # 1. Bond ETF: ordinarily safe asset, but for new listing defaults to 70% risk asset
    new_bond = {
        "ticker": "999991",
        "name": "TEST 신규 상장 국채",
        "risk_type": "normal",
        "asset_class": "채권",
    }
    res_bond = classify_new_listing(new_bond)
    assert res_bond["pension_limit"] == LIMIT_RISK_ASSET
    assert res_bond["pension_verified"] == PENSION_VERIFIED_NO
    assert res_bond["pension_confidence"] == PENSION_CONFIDENCE_LOW
    assert "보수적 기본값" in res_bond["pension_reason"]

    # 2. Money market: ordinarily safe asset, but for new listing defaults to 70% risk asset
    new_mm = {
        "ticker": "999992",
        "name": "TEST 신규 CD금리액티브",
        "risk_type": "normal",
        "asset_class": "금리·파킹",
    }
    res_mm = classify_new_listing(new_mm)
    assert res_mm["pension_limit"] == LIMIT_RISK_ASSET
    assert res_mm["pension_verified"] == PENSION_VERIFIED_NO

    # 3. Leverage: correctly remains '불가'
    new_lev = {
        "ticker": "999993",
        "name": "TEST 신규 레버리지",
        "risk_type": "leverage",
        "asset_class": "주식-국내",
    }
    res_lev = classify_new_listing(new_lev)
    assert res_lev["pension_limit"] == LIMIT_INELIGIBLE
    assert res_lev["pension_eligible"] == PENSION_INELIGIBLE
    assert res_lev["pension_verified"] == PENSION_VERIFIED_NO


