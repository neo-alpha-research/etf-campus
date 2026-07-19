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
  returns: { "1m": 1, "2m": 2, "3m": null, "6m": 6, "12m": 12 },
  isNew3m: false,
};

describe("EtfDetail", () => {
  it("개요·태그·기간 수익률·연금 상태와 기준일을 표시한다", () => {
    render(<EtfDetail etf={item} />);
    expect(screen.getByRole("heading", { name: "상세 테스트 ETF" })).toBeInTheDocument();
    expect(screen.getByText("테스트 기초지수")).toBeInTheDocument();
    expect(screen.getAllByText("연금 확인중")).toHaveLength(2);
    expect(screen.getByText("기준일 2026.07.15")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "-, 가격 기준·분배금 미포함" })).toBeInTheDocument();
  });

  it("수익률 기준과 필수 고지를 표시한다", () => {
    render(<EtfDetail etf={item} />);
    expect(screen.getByText(/가격 기준·분배금 미포함/)).toBeInTheDocument();
    expect(screen.getByText("과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다")).toBeInTheDocument();
  });

  it("FinancialProduct JSON-LD를 포함한다", () => {
    const { container } = render(<EtfDetail etf={item} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent!)).toMatchObject({ "@type": "FinancialProduct", name: item.name });
  });
});
