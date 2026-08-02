import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

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
    aum: 100_000_000_000,
    riskType: "normal",
    assetClass: "주식-국내",
    pension: "가능",
    pensionSource: "공식확인",
    liquidity: "pass",
    asOfDate: "20260715",
    listingDate: null,
    listingDateSource: null,
    returns: { "1d": 1.2, "1w": 1, "2w": 2, "1m": 3, "2m": 4, "3m": 5, "6m": 6, "12m": 12, "24m": 24, "36m": 36, itd: 7 },
    isNew90d: null,
    isNew3m: false,
    ...overrides,
  };
}

const items = [
  etf({ ticker: "A", name: "대형 일반 ETF", aum: 100_000_000_000, tradeValue: 3_000_000_000 }),
  etf({ ticker: "B", name: "중형 일반 ETF", aum: 50_000_000_000 }),
  etf({ ticker: "C", name: "소규모 신규 ETF", aum: 5_000_000_000, isNew3m: true }),
  etf({ ticker: "D", name: "레버리지 ETF", riskType: "leverage", pension: "불가" }),
];

describe("Dashboard", () => {
  beforeEach(() => window.history.replaceState(null, "", "/"));

  it("일반 계좌 기본 화면은 일반형·1,000억원 이상 종목만 보여준다", () => {
    render(<Dashboard etfs={items} />);
    expect(screen.getByText("1종목")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "종목코드" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "종목명" })).toHaveClass("text-center");
    expect(screen.getByRole("columnheader", { name: "종가, 단위 원" })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: "거래대금, 단위 억원" })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: "순자산, 단위 억원" })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: "1일 수익률, 단위 퍼센트" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "대형 일반 ETF" })).toBeInTheDocument();
    expect(screen.getByText("30.0")).toBeInTheDocument();
    expect(screen.queryByText("레버리지 ETF")).not.toBeInTheDocument();
  });

  it("500억과 전체 범위를 전환하고 소규모 ETF를 순자산 옆에 표시한다", () => {
    render(<Dashboard etfs={items} />);
    fireEvent.click(screen.getByRole("button", { name: "500억+" }));
    expect(screen.getByText("2종목")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(screen.getByText("3종목")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.queryByText("50.0")).not.toBeInTheDocument();
    expect(screen.queryByText("소규모 유의")).not.toBeInTheDocument();
    expect(screen.getByLabelText("소규모 ETF: 순자산 100억원 미만")).toBeInTheDocument();
  });

  it("일반 계좌에 2주를 포함하고 활용도가 낮은 2년과 3년을 제외한다", () => {
    render(<Dashboard etfs={items} />);
    expect(screen.getByRole("button", { name: "2주" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "2년" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "3년" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "2년 수익률" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "3년 수익률" })).not.toBeInTheDocument();
  });

  it("긴 종목명과 분류·연금 정보를 검색하기 쉽게 분리한다", () => {
    render(<Dashboard etfs={items} />);
    expect(screen.getByRole("columnheader", { name: "지역" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "자산" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "환헤지" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "대형 일반 ETF" })).toHaveClass("line-clamp-2");
    expect(screen.getByLabelText("연금 가능")).toHaveTextContent("O");
  });

  it("긴 자산 분류는 좁은 열에서 의미 단위로 두 줄 표시한다", () => {
    render(<Dashboard etfs={[
      etf({ ticker: "P", name: "파킹 ETF", assetClass: "금리·파킹" }),
      etf({ ticker: "R", name: "리츠 ETF", assetClass: "리츠·인프라" }),
    ]} />);
    expect(screen.getByLabelText("금리(파킹)")).toHaveTextContent("금리(파킹)");
    expect(screen.getByLabelText("리츠/인프라")).toHaveTextContent("리츠/인프라");
  });

  it("신규 상장은 2주와 상장 후 ITD를 표시하고 3개월은 제외한다", async () => {
    window.history.replaceState(null, "", "/?mode=new");
    render(<Dashboard etfs={items} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "상장 후 90일 이내 신규 ETF" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "2주" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "상장 후(ITD)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "3개월" })).not.toBeInTheDocument();
    expect(screen.getByText("소규모 신규 ETF")).toBeInTheDocument();
  });

  it("검색과 필수 수익률 고지를 제공한다", () => {
    render(<Dashboard etfs={items} />);
    const explorer = screen.getByRole("region", { name: "ETF 검색과 정렬" });
    const search = screen.getByRole("combobox", { name: "종목명 또는 티커 검색" });
    const scope = screen.getByRole("button", { name: "1,000억+" });
    expect(search.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(explorer).toContainElement(search);
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "대형" } });
    expect(screen.getByRole("link", { name: "대형 일반 ETF" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /대형 일반 ETF/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
    expect(search).toHaveValue("");
    expect(screen.queryByRole("listbox", { name: "ETF 검색 자동완성" })).not.toBeInTheDocument();
    expect(screen.getByText(/상장 전 기간은 최초 거래일 종가/)).toBeInTheDocument();
    expect(screen.getByText(/기간 수익률은 기준일 종가.*과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다/)).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "수익률 안내" })).toHaveClass("border-t");
    expect(screen.getByRole("columnheader", { name: "종가, 단위 원" })).toHaveTextContent("종가(원)");
    expect(screen.getByRole("columnheader", { name: "거래대금, 단위 억원" })).toHaveTextContent("거래대금(억원)");
    expect(screen.getByRole("columnheader", { name: "1개월 수익률, 단위 퍼센트" })).toHaveTextContent("1개월(%)");
  });
});
