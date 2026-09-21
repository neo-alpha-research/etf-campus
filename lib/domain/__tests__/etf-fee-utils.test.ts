import { describe, expect, it } from "vitest";
import {
  getFeeDisplayContext,
  getSyntheticFee,
  isNewEtfForFeeMasking,
  type FeeInputEtf,
} from "../etf-fee-utils";
import type { EtfFeeInfo } from "../etf-types";

const createFee = (overrides?: Partial<EtfFeeInfo>): EtfFeeInfo => ({
  totalFeePct: 0.15,
  terPct: null,
  otherCostPct: 0.05,
  tradingCostPct: 0.02,
  effectiveDate: "202607",
  verifiedAt: "2026-07-16T00:00:00Z",
  verificationStatus: "verified_official",
  primarySourceType: "kofia",
  primarySourceUrl: "https://dis.kofia.or.kr",
  dartReceiptNo: null,
  secondarySourceUrl: null,
  sourceNote: null,
  ...overrides,
});

describe("getSyntheticFee", () => {
  it("3계층 수수료(명목+기타+매매)가 있을 때 올바르게 합산한다", () => {
    const etf: FeeInputEtf = {
      fee: createFee({
        totalFeePct: 0.15,
        otherCostPct: 0.1,
        tradingCostPct: 0.05,
      }),
    };
    // 0.15 + 0.10 + 0.05 = 0.30
    expect(getSyntheticFee(etf)).toBeCloseTo(0.3, 5);
  });

  it("terPct가 명시적으로 제공된 경우 terPct + tradingCostPct로 합산한다", () => {
    const etf: FeeInputEtf = {
      fee: createFee({
        totalFeePct: 0.15,
        terPct: 0.25,
        otherCostPct: null,
        tradingCostPct: 0.05,
      }),
    };
    // 0.25 + 0.05 = 0.30
    expect(getSyntheticFee(etf)).toBeCloseTo(0.3, 5);
  });

  it("tradingCostPct가 결측된 경우 실부담비용 왜곡을 방지하기 위해 null을 반환한다", () => {
    const etf: FeeInputEtf = {
      fee: createFee({
        totalFeePct: 0.15,
        otherCostPct: 0.1,
        tradingCostPct: null,
      }),
    };
    expect(getSyntheticFee(etf)).toBeNull();
  });

  it("totalFeePct 또는 기타비용/TER이 결측된 경우 null을 반환한다", () => {
    const etfWithoutTotal: FeeInputEtf = {
      fee: createFee({
        totalFeePct: null,
        otherCostPct: 0.1,
        tradingCostPct: 0.05,
      }),
    };
    expect(getSyntheticFee(etfWithoutTotal)).toBeNull();

    const etfWithoutOther: FeeInputEtf = {
      fee: createFee({
        totalFeePct: 0.15,
        terPct: null,
        otherCostPct: null,
        tradingCostPct: 0.05,
      }),
    };
    expect(getSyntheticFee(etfWithoutOther)).toBeNull();
  });

  it("fee 객체 자체가 없으면 null을 반환한다", () => {
    expect(getSyntheticFee({})).toBeNull();
  });
});

describe("isNewEtfForFeeMasking", () => {
  it("asOfDate 기준 상장 1년 미만인 ETF를 감지한다", () => {
    const newEtf: FeeInputEtf = {
      listingDate: "20260101",
      asOfDate: "20260715",
    };
    expect(isNewEtfForFeeMasking(newEtf)).toBe(true);
  });

  it("asOfDate 기준 상장 1년 이상 경과한 ETF는 마스킹 대상이 아니다", () => {
    const matureEtf: FeeInputEtf = {
      listingDate: "20240101",
      asOfDate: "20260715",
    };
    expect(isNewEtfForFeeMasking(matureEtf)).toBe(false);
  });

  it("날짜 정보가 결측되거나 유효하지 않으면 false를 반환한다", () => {
    expect(isNewEtfForFeeMasking({ listingDate: null, asOfDate: "20260715" })).toBe(false);
    expect(isNewEtfForFeeMasking({ listingDate: "20240101", asOfDate: null })).toBe(false);
    expect(isNewEtfForFeeMasking({ listingDate: "invalid", asOfDate: "20260715" })).toBe(false);
  });
});

describe("getFeeDisplayContext", () => {
  it("명목보수가 없으면 unknown 컨텍스트를 반환한다", () => {
    const ctx = getFeeDisplayContext({ fee: createFee({ totalFeePct: null }) });
    expect(ctx.type).toBe("unknown");
    expect(ctx.nominalFee).toBeNull();
    expect(ctx.syntheticFee).toBeNull();
  });

  it("상장 1년 미만 신규 ETF는 masked_new 컨텍스트로 분류한다", () => {
    const ctx = getFeeDisplayContext({
      fee: createFee({ totalFeePct: 0.15, otherCostPct: 0.2, tradingCostPct: 0.1 }),
      listingDate: "20260501",
      asOfDate: "20260715",
    });
    expect(ctx.type).toBe("masked_new");
    expect(ctx.nominalFee).toBe(0.15);
    expect(ctx.syntheticFee).toBeNull();
  });

  it("명목과 실부담 격차가 0.5%p 미만일 때 hasHiddenCostWarning = false이다", () => {
    const ctx = getFeeDisplayContext({
      fee: createFee({ totalFeePct: 0.15, otherCostPct: 0.1, tradingCostPct: 0.05 }),
      listingDate: "20240101",
      asOfDate: "20260715",
    });
    expect(ctx.type).toBe("synthetic");
    expect(ctx.syntheticFee).toBeCloseTo(0.3, 5);
    expect(ctx.hasHiddenCostWarning).toBe(false);
  });

  it("명목과 실부담 격차가 0.5%p 이상이면 숨은비용 주의 플래그(hasHiddenCostWarning = true)를 켠다", () => {
    const ctx = getFeeDisplayContext({
      fee: createFee({ totalFeePct: 0.15, otherCostPct: 0.45, tradingCostPct: 0.25 }),
      listingDate: "20240101",
      asOfDate: "20260715",
    });
    // 실부담 0.85% - 명목 0.15% = 0.70% >= 0.5%p
    expect(ctx.type).toBe("synthetic");
    expect(ctx.syntheticFee).toBeCloseTo(0.85, 5);
    expect(ctx.hasHiddenCostWarning).toBe(true);
  });

  it("기타비용이나 매매비용이 누락된 성숙 ETF는 nominal_only 컨텍스트를 반환한다", () => {
    const ctx = getFeeDisplayContext({
      fee: createFee({ totalFeePct: 0.2, otherCostPct: null, tradingCostPct: null }),
      listingDate: "20240101",
      asOfDate: "20260715",
    });
    expect(ctx.type).toBe("nominal_only");
    expect(ctx.nominalFee).toBe(0.2);
    expect(ctx.syntheticFee).toBeNull();
    expect(ctx.hasHiddenCostWarning).toBe(false);
  });
});
