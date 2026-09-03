import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Etf, EtfFeeInfo } from "@/lib/domain/etf-types";
import { FeeMetricItem } from "../fee-metric-item";

const mockFee: EtfFeeInfo = {
  totalFeePct: 0.15,
  terPct: null,
  otherCostPct: 0.55,
  tradingCostPct: 0.15,
  effectiveDate: "20260715",
  verifiedAt: "20260716",
  verificationStatus: "verified_official",
  primarySourceType: "dart",
  primarySourceUrl: "https://dart.fss.or.kr",
  dartReceiptNo: "123456789",
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
  fee: mockFee,
  issuer: {
    issuerId: "test_amc",
    issuerName: "테스트운용",
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
  returns: { "1d": 1.2, "1w": 0.5, "2w": null, "1m": 1, "2m": 2, "3m": null, "6m": 6, "12m": 12, "24m": null, "36m": null, ytd: 5, itd: null },
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

describe("FeeMetricItem", () => {
  it("실부담비용과 총보수를 올바르게 표출하고, 0.5%p 이상 격차 시 '숨은비용 주의' 배지를 렌더링한다", () => {
    // 0.15 + 0.55 + 0.15 = 0.85% (격차 0.85 - 0.15 = 0.70 >= 0.5)
    render(<FeeMetricItem etf={baseEtf} />);

    expect(screen.getByText("실부담비용")).toBeInTheDocument();
    expect(screen.getByText("0.85%")).toBeInTheDocument();
    expect(screen.getByText("총보수 0.15%")).toBeInTheDocument();
    expect(screen.getByText("숨은비용 주의")).toBeInTheDocument();
  });

  it("팝오버를 열면 1,000만 원 투자 시 연간 차감액(약 85,000원)과 3-Tier 비용 분해 내역이 노출된다", () => {
    render(<FeeMetricItem etf={baseEtf} />);

    const openBtn = screen.getByRole("button", { name: /실부담비용/ });
    fireEvent.click(openBtn);

    // 10,000,000 * 0.85% = 85,000원
    expect(screen.getByText(/약 85,000원/)).toBeInTheDocument();
    expect(screen.getByText("명목 총보수 (운용/판매/수탁)")).toBeInTheDocument();
    expect(screen.getByText("기타비용 (예탁원/지수사용료 등)")).toBeInTheDocument();
    expect(screen.getByText("매매수수료 (자산 교체 거래비용)")).toBeInTheDocument();
  });

  it("상장 1년 미만 신규 ETF는 '신규 (총보수)' 배지로 마스킹 처리된다", () => {
    const newEtf: Etf = {
      ...baseEtf,
      listingDate: "20260501", // < 1 year from 20260715
    };
    render(<FeeMetricItem etf={newEtf} />);

    expect(screen.getByText("신규 (총보수)")).toBeInTheDocument();
    expect(screen.getAllByText("0.15%").length).toBeGreaterThan(0);
  });

  it("미검증 데이터의 경우 수치를 숨기고 '출처 간 정보 불일치' 상태 텍스트를 노출한다", () => {
    const unverifiedEtf: Etf = {
      ...baseEtf,
      fee: {
        ...mockFee,
        verificationStatus: "conflict",
      },
    };
    render(<FeeMetricItem etf={unverifiedEtf} />);

    expect(screen.queryByText("0.85%")).not.toBeInTheDocument();
    expect(screen.getByText("출처 간 정보 불일치")).toBeInTheDocument();
  });
});
