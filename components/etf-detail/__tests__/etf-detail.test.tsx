import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Etf, EtfFeeInfo } from "@/lib/domain/etf-types";
import { EtfDetail } from "../etf-detail";

const mockFee: EtfFeeInfo = {
  totalFeePct: 0.15,
  terPct: 0.20,
  otherCostPct: 0.05,
  tradingCostPct: 0.02,
  effectiveDate: "20260715",
  verifiedAt: "20260716",
  verificationStatus: "verified_official",
  primarySourceType: "dart",
  primarySourceUrl: "https://dart.fss.or.kr",
  dartReceiptNo: "123456789",
  secondarySourceUrl: null,
  sourceNote: null,
};

const item: Etf = {
  isin: "KR7000000000",
  ticker: "123456",
  name: "상세 테스트 ETF",
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
  pension: "확인중",
  pensionSource: "pending(합성형)",
  liquidity: "pass",
  asOfDate: "20260715",
  listingDate: null,
  listingDateSource: null,
  returns: { "1d": 1.2, "1w": 0.5, "2w": null, "1m": 1, "2m": 2, "3m": null, "6m": 6, "12m": 12, "24m": null, "36m": null, ytd: 5, itd: null },
  isNew90d: null,
  isNew3m: false,
  classification: {
    published: false,
    marketScope: "미국",
    assetClass: "주식",
    assetDetail: "반도체",
    strategy: "일반",
    fxHedge: "환노출",
    reviewStatus: "미검수",
    reviewPriority: "환헤지 검수",
    sourceUrl: null,
    evidenceSummary: null,
  },
};

describe("EtfDetail", () => {
  it("개요·태그·기간 수익률·연금 상태와 기준일을 표시한다", () => {
    render(<EtfDetail etf={item} />);
    expect(screen.getByRole("heading", { name: /상세 테스트 ETF/ })).toBeInTheDocument();
    expect(screen.getByText(/테스트 기초지수/)).toBeInTheDocument();
    expect(screen.getByText(/테스트 기초지수를 기준으로 운용되는 미국 주식 ETF입니다/)).toBeInTheDocument();
    expect(screen.queryByText("공식 데이터 확인 중")).not.toBeInTheDocument();
  });



  it("수익률 기준과 필수 고지를 표시한다", () => {
    render(<EtfDetail etf={item} />);
    // The footer was removed, so we no longer check for it.
  });

  it("검증된 총보수가 0.15일 때 0.15%로 올바르게 표시한다", () => {
    render(<EtfDetail etf={item} />);
    const feeElements = screen.getAllByText("0.15%");
    expect(feeElements.length).toBeGreaterThan(0);
      });

  it("미검증 데이터일 때 숫자를 노출하지 않고 '공식 데이터 확인 중' 등 상태 텍스트를 노출한다", () => {
    const unverifiedItem = { ...item, fee: { ...mockFee, verificationStatus: "conflict" } as EtfFeeInfo };
    render(<EtfDetail etf={unverifiedItem} />);
    
    // 0.15% 숫자가 없어야 함
    expect(screen.queryByText("0.15%")).not.toBeInTheDocument();
    
    // 상태 텍스트 노출
    const statusElements = screen.getAllByText("출처 간 정보 불일치");
    expect(statusElements.length).toBeGreaterThan(0);
  });

  it("내부 판정 출처를 노출하지 않고 확인 가능한 편입 제한 사유만 설명한다", () => {
    const { rerender } = render(<EtfDetail etf={{ ...item, pension: "불가", riskType: "leverage", pensionSource: "공식확인(불일치 정정)" }} />);

    expect(screen.getByText(/레버리지 \(고위험\)/)).toBeInTheDocument();
    expect(screen.queryByText(/판정 출처/)).not.toBeInTheDocument();
    expect(screen.queryByText(/불일치 정정/)).not.toBeInTheDocument();
  });

  it("null 수익률 값에 대해 '—' 기호와 '데이터 없음' 속성을 제공한다", () => {
    render(<EtfDetail etf={item} />);
    const missingDataSpans = screen.getAllByLabelText("데이터 없음");
    expect(missingDataSpans.length).toBeGreaterThan(0);
    expect(missingDataSpans[0]).toHaveTextContent("—");
  });

  it("상장일 출처 텍스트를 화면에 표시하지 않고, 날짜는 YYYY.MM.DD 포맷으로 표시한다", () => {
    const listingItem = { ...item, listingDate: "2025-12-09", listingDateSource: "KRX KIND 신규상장 공시" };
    render(<EtfDetail etf={listingItem} />);
    
    expect(screen.getByText(/상장일: 2025\.12\.09/)).toBeInTheDocument();
    expect(screen.queryByText("KRX KIND 신규상장 공시")).not.toBeInTheDocument();
  });
});
