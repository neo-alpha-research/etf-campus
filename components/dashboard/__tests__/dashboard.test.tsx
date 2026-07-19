import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Etf } from "@/lib/domain/etf-types";
import { Dashboard } from "../dashboard";

function etf(overrides: Partial<Etf>): Etf {
  return {
    isin: "KR7000000000",
    ticker: "000000",
    name: "샘플 ETF",
    baseIndex: "샘플 지수",
    close: 10_000,
    changePct: 1.2,
    tradeValue: 2_000_000_000,
    aum: 50_000_000_000,
    riskType: "normal",
    assetClass: "주식-국내",
    pension: "가능",
    pensionSource: "공식확인",
    liquidity: "pass",
    asOfDate: "20260715",
    returns: { "1m": 1, "2m": 2, "3m": 3, "6m": 6, "12m": 12 },
    isNew3m: false,
    ...overrides,
  };
}

const items = [
  etf({ ticker: "A", name: "기본 ETF", tradeValue: 3_000_000_000 }),
  etf({ ticker: "B", name: "신규 ETF", aum: 20_000_000_000, isNew3m: true }),
  etf({ ticker: "C", name: "소규모 ETF", aum: 5_000_000_000 }),
];

describe("Dashboard", () => {
  it("기본 화면은 500억원 이상 종목만 보여준다", () => {
    render(<Dashboard etfs={items} />);
    expect(screen.getByText("1종목")).toBeInTheDocument();
    expect(screen.getByText("기본 ETF")).toBeInTheDocument();
    expect(screen.queryByText("소규모 ETF")).not.toBeInTheDocument();
  });

  it("전체 보기에서 전 종목과 소규모 유의 표시를 보여준다", () => {
    render(<Dashboard etfs={items} />);
    fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(screen.getByText("3종목")).toBeInTheDocument();
    expect(screen.getByText("소규모 유의")).toBeInTheDocument();
  });

  it("신규 상장 메뉴는 3개월 미만·100억원 이상만 보여준다", () => {
    render(<Dashboard etfs={items} />);
    fireEvent.click(screen.getByRole("button", { name: "신규 상장" }));
    expect(screen.getByText("1종목")).toBeInTheDocument();
    expect(screen.getByText("신규 ETF")).toBeInTheDocument();
  });

  it("모바일 수익률 기간을 전환하고 필수 고지를 표시한다", () => {
    render(<Dashboard etfs={items} />);
    fireEvent.click(screen.getByRole("button", { name: "6개월" }));
    expect(screen.getByRole("columnheader", { name: "6개월 수익률" })).toBeInTheDocument();
    expect(screen.getByText(/가격 기준·분배금 미포함/)).toBeInTheDocument();
    expect(screen.getByText("과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다")).toBeInTheDocument();
  });
});
