import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Etf } from "@/lib/domain/etf-types";
import { EtfDetail } from "../etf-detail";

const item: Etf = {
  isin: "KR7000000000",
  ticker: "123456",
  name: "상세 테스트 ETF",
  baseIndex: "테스트 기초지수",
  close: 10_000,
  changePct: 1.2,
  tradeValue: 2_000_000_000,
  aum: 50_000_000_000,
  riskType: "normal",
  assetClass: "주식-국내",
  pension: "확인중",
  pensionSource: "pending(합성형)",
  liquidity: "pass",
  asOfDate: "20260715",
  listingDate: null,
  listingDateSource: null,
  returns: { "1d": 1.2, "1w": 0.5, "2w": null, "1m": 1, "2m": 2, "3m": null, "6m": 6, "12m": 12, "24m": null, "36m": null, itd: null },
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
    expect(screen.getByRole("heading", { name: "상세 테스트 ETF" })).toBeInTheDocument();
    expect(screen.getByText("테스트 기초지수")).toBeInTheDocument();
    expect(screen.getAllByText("연금 확인중")).toHaveLength(2);
    expect(screen.getByText("기준일 2026.07.15")).toBeInTheDocument();
    expect(screen.getAllByLabelText("분류: 국내, 주식").length).toBeGreaterThan(0);
    expect(screen.getByText("자동 검수 대기")).toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "-, 가격 기준·분배금 미포함" }).length).toBeGreaterThan(0);
  });

  it("수익률 기준과 필수 고지를 표시한다", () => {
    render(<EtfDetail etf={item} />);
    expect(screen.getByText(/가격 기준·분배금 미포함/)).toBeInTheDocument();
    expect(screen.getByText("과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다")).toBeInTheDocument();
  });

  it("내부 판정 출처를 노출하지 않고 확인 가능한 편입 제한 사유만 설명한다", () => {
    const { rerender } = render(<EtfDetail etf={{ ...item, pension: "불가", riskType: "leverage", pensionSource: "공식확인(불일치 정정)" }} />);

    expect(screen.getByText(/1배를 초과해 추종하는 레버리지 구조/)).toBeInTheDocument();
    expect(screen.queryByText(/판정 출처/)).not.toBeInTheDocument();
    expect(screen.queryByText(/불일치 정정/)).not.toBeInTheDocument();

    rerender(<EtfDetail etf={{ ...item, pension: "불가", riskType: "normal", pensionSource: "공식확인" }} />);
    expect(screen.getByText(/공개 정보만으로 구체적인 제한 사유를 확정할 수 없는 경우/)).toBeInTheDocument();
  });

  it("연금 확인중 종목에는 이유와 확인 방법을 안내한다", () => {
    const { rerender } = render(<EtfDetail etf={{ ...item, pension: "확인중", listingDate: "20260715", isNew90d: true }} />);

    expect(screen.getByText(/신규 상장 후 공식 연금 상품 목록 반영을 기다리고 있습니다/)).toBeInTheDocument();
    expect(screen.getByText(/DC·IRP 상품 검색에서 종목코드를 확인/)).toBeInTheDocument();

    rerender(<EtfDetail etf={{ ...item, pension: "확인중", listingDate: null, isNew90d: false }} />);
    expect(screen.getByText(/공개된 연금 편입 정보에서 해당 종목을 확인하지 못했습니다/)).toBeInTheDocument();
  });

  it("FinancialProduct JSON-LD를 포함한다", () => {
    const { container } = render(<EtfDetail etf={item} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent!)).toMatchObject({ "@type": "FinancialProduct", name: item.name });
  });
});
