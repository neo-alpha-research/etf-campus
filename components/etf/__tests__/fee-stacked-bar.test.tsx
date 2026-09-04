import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Etf, EtfFeeInfo } from "@/lib/domain/etf-types";
import { FeeStackedBar } from "../fee-stacked-bar";

const completeFee: EtfFeeInfo = {
  totalFeePct: 0.15,
  terPct: null,
  otherCostPct: 0.05,
  tradingCostPct: 0.02,
  effectiveDate: "20260715",
  verifiedAt: "20260716",
  verificationStatus: "verified_official",
  primarySourceType: "kofia",
  primarySourceUrl: null,
  dartReceiptNo: null,
  secondarySourceUrl: null,
  sourceNote: null,
};

const incompleteFee: EtfFeeInfo = {
  totalFeePct: 0.15,
  terPct: null,
  otherCostPct: null, // missing
  tradingCostPct: null, // missing
  effectiveDate: "20260715",
  verifiedAt: "20260716",
  verificationStatus: "verified_official",
  primarySourceType: "naver",
  primarySourceUrl: null,
  dartReceiptNo: null,
  secondarySourceUrl: null,
  sourceNote: null,
};

const baseEtf: Etf = {
  isin: "KR7000000000",
  ticker: "123456",
  name: "테스트 ETF",
  baseIndex: "테스트 기초지수",
  close: 10_000,
  changePct: 1.2,
  tradeValue: 2_000_000_000,
  aum: 50_000_000_000,
  fee: completeFee,
  issuer: {
    issuerId: "test",
    issuerName: "테스트",
    brand: "TEST",
    issuerStatus: "mapped_brand",
    issuerSourceUrl: null,
    issuerVerifiedAt: null,
  },
  riskType: "normal",
  assetClass: "주식-국내",
  pension: "가능",
  pensionSource: "공식",
  liquidity: "pass",
  asOfDate: "20260715",
  listingDate: "20240101",
  listingDateSource: null,
  returns: { "1d": 1, "1w": null, "2w": null, "1m": null, "2m": null, "3m": null, "6m": null, "12m": null, "24m": null, "36m": null, ytd: null, itd: null },
  isNew90d: null,
  isNew3m: false,
  classification: {
    published: true,
    marketScope: "국내",
    assetClass: "주식",
    assetDetail: "대형주",
    strategy: "일반",
    fxHedge: "해당없음",
    reviewStatus: "완료",
    reviewPriority: "기본",
    sourceUrl: null,
  },
};

describe("FeeStackedBar - Option B Zero Hallucination", () => {
  it("3분해가 완료된 ETF는 실부담비용을 표시하고 isLowest인 경우 [최저] 뱃지를 표시한다", () => {
    // 0.15 + 0.05 + 0.02 = 0.22%
    render(<FeeStackedBar etf={baseEtf} isLowest={true} />);

    expect(screen.getAllByText("0.22%").length).toBeGreaterThan(0);
    expect(screen.getByText("최저")).toBeInTheDocument();
    expect(screen.getByText("합성 총보수 (실부담비용)")).toBeInTheDocument();
  });

  it("기타비용이나 매매수수료가 결측된 ETF는 총보수만 표시하고, isLowest={true}여도 [최저] 뱃지를 표시하지 않는다", () => {
    const etfWithIncomplete: Etf = {
      ...baseEtf,
      fee: incompleteFee,
    };
    render(<FeeStackedBar etf={etfWithIncomplete} isLowest={true} />);

    // Shows nominal fee 0.15% with [총보수] badge
    expect(screen.getAllByText("0.15%").length).toBeGreaterThan(0);
    expect(screen.getByText("총보수")).toBeInTheDocument();
    // Must NOT have '최저' badge
    expect(screen.queryByText("최저")).not.toBeInTheDocument();
    // Tooltip must show "공시 전" and not "0.00%"
    expect(screen.getAllByText("공시 전").length).toBe(2);
    expect(screen.queryByText("0.00%")).not.toBeInTheDocument();
  });
});
