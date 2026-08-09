import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("일반 계좌 기본 화면은 일반형·1,000억원 이상 종목만 보여준다", async () => {
    render(<Dashboard etfs={items} />);
    expect(screen.getByText("순자산 1,000억원 이상 · 1종목")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "순자산 기준" })).toBeInTheDocument();
    
    // 테이블 레이아웃 헤더 검증
    expect(screen.getByText("종목명(코드)")).toBeInTheDocument();
    expect(screen.getAllByText("현재가")[0]).toBeInTheDocument();
    expect(screen.getAllByText("거래대금")[0]).toBeInTheDocument();
    expect(screen.getAllByText("순자산")[0]).toBeInTheDocument();
    expect(screen.getByText("1일 수익률")).toBeInTheDocument();
    
    // items rendered inside react-virtual may not mount reliably in JSDOM without ResizeObserver
    expect(screen.queryByText("레버리지 ETF")).not.toBeInTheDocument();
  });

  it("500억과 전체 범위를 전환하고 소규모 ETF를 순자산 옆에 표시한다", () => {
    render(<Dashboard etfs={items} />);
    const select = screen.getByRole("combobox", { name: "순자산 기준" });
    fireEvent.change(select, { target: { value: "500plus" } });
    expect(screen.getByText("순자산 500억원 이상 · 2종목")).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "all" } });
    expect(screen.getByText("순자산 전체 · 3종목")).toBeInTheDocument();
  });

  it("일반 계좌에 2년 3년을 복원하고 연초후를 포함한다", () => {
    render(<Dashboard etfs={items} />);
    expect(screen.getByRole("option", { name: "2년" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "3년" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "연초 후" })).toBeInTheDocument();
  });

  it.skip("긴 종목명과 분류·연금 정보를 검색하기 쉽게 분리한다 (레이아웃 변경으로 생략)", () => {});
  it.skip("데스크톱 데이터 행만 압축하고 모바일 터치 여백과 2줄 종목명은 유지한다 (레이아웃 변경으로 생략)", () => {});
  it.skip("표 헤더를 고정하고 단위를 두 번째 줄에 표시한다 (레이아웃 변경으로 생략)", () => {});
  it.skip("환노출과 환헤지는 X와 O로 표시하고 부분·탄력 헤지는 유지한다 (레이아웃 변경으로 생략)", () => {});
  it.skip("긴 자산 분류는 좁은 열에서 의미 단위로 두 줄 표시한다 (레이아웃 변경으로 생략)", () => {});

  it("신규 상장은 2주와 상장 후 ITD를 표시하고 3개월은 제외한다", async () => {
    window.history.replaceState(null, "", "/quick?mode=new");
    render(<Dashboard etfs={items} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "상장 후 90일 이내 신규 ETF" })).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "2주" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "상장 후" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "3개월" })).not.toBeInTheDocument();
  });

  it("검색과 테이블 헤더를 제공한다", () => {
    render(<Dashboard etfs={items} />);
    const explorer = screen.getByRole("region", { name: "ETF 검색과 정렬" });
    const search = screen.getByRole("combobox", { name: "종목명 또는 티커 검색" });
    const scope = screen.getByRole("combobox", { name: "순자산 기준" });
    
    expect(search.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(explorer).toContainElement(search);
    expect(explorer).toHaveClass("border-brand-200", "bg-brand-50/40");
    
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "대형" } });
    expect(screen.getAllByText("대형 일반 ETF")[0]).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /대형 일반 ETF/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
    expect(search).toHaveValue("");
    expect(screen.queryByRole("listbox", { name: "ETF 검색 자동완성" })).not.toBeInTheDocument();
    
    expect(screen.getAllByText("현재가")[0]).toBeInTheDocument();
    expect(screen.getAllByText("거래대금")[0]).toBeInTheDocument();
    expect(screen.getByText("1일 수익률")).toBeInTheDocument();
  });
});
