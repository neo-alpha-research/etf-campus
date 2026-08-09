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

  it("일반 계좌 기본 화면은 일반형·1,000억원 이상 종목만 보여준다", () => {
    render(<Dashboard etfs={items} />);
    expect(screen.getByText("순자산 1,000억 이상 · 1종목")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "순자산 기준" })).toBeInTheDocument();
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
    const select = screen.getByRole("combobox", { name: "순자산 기준" });
    fireEvent.change(select, { target: { value: "500plus" } });
    expect(screen.getByText("순자산 500억 이상 · 2종목")).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "all" } });
    expect(screen.getByText("순자산 전체 · 3종목")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.queryByText("50.0")).not.toBeInTheDocument();
    expect(screen.queryByText("소규모 유의")).not.toBeInTheDocument();
    expect(screen.getByLabelText("소규모 ETF: 순자산 100억원 미만")).toBeInTheDocument();
  });

  it("일반 계좌에 2주, 2년, 3년 수익률이 포함된다", () => {
    const items = [
      etf({ ticker: "000001", aum: 1100 }),
    ];
    render(<Dashboard etfs={items} />);
    expect(screen.getByRole("option", { name: "2주" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2년" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "3년" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "2년 수익률, 단위 퍼센트" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "3년 수익률, 단위 퍼센트" })).toBeInTheDocument();
  });

  it("긴 종목명과 분류·연금 정보를 검색하기 쉽게 분리한다", () => {
    render(<Dashboard etfs={items} />);
    const nameHeader = screen.getByRole("columnheader", { name: "종목명" });
    const classificationHeaders = ["지역", "자산", "환헤지", "연금"].map((name) => screen.getByRole("columnheader", { name }));
    const nameLink = screen.getByRole("link", { name: "대형 일반 ETF" });

    expect(nameHeader).toHaveClass("min-w-[150px]", "text-center");
    classificationHeaders.forEach((header) => expect(header).toHaveClass("w-[4%]"));
    expect(nameLink).toHaveClass("break-all", "whitespace-normal", "text-left", "text-[13px]");
    expect(screen.getByLabelText("연금 가능")).toHaveTextContent("O");
  });

  it("데스크톱 데이터 행만 압축하고 모바일 터치 여백과 2줄 종목명은 유지한다", () => {
    render(<Dashboard etfs={items} />);
    const nameCell = screen.getByRole("rowheader", { name: "대형 일반 ETF" });
    const mobileChangeCell = screen.getAllByRole("cell", { name: /\+1\.20%/ }).find((cell) => cell.classList.contains("md:hidden"));
    const desktopChangeCell = screen.getAllByRole("cell", { name: /\+1\.20%/ }).find((cell) => cell.classList.contains("md:table-cell"));

    expect(nameCell).toHaveClass("py-2.5");
    expect(screen.getByRole("link", { name: "대형 일반 ETF" })).toHaveClass("whitespace-normal");
    expect(desktopChangeCell).toHaveClass("py-2.5");
    expect(mobileChangeCell).toHaveClass("py-4");
    expect(screen.getByRole("cell", { name: "국내" })).toHaveClass("py-2.5");
  });

  it("표 헤더를 고정하고 단위를 두 번째 줄에 표시한다", () => {
    render(<Dashboard etfs={items} />);
    const closeHeader = screen.getByRole("columnheader", { name: "종가, 단위 원" });
    const oneMonthHeader = screen.getByRole("columnheader", { name: "1개월 수익률, 단위 퍼센트" });

    expect(closeHeader).toHaveClass("sticky", "top-[37px]");
    expect(closeHeader.closest("thead")).toHaveClass("text-[13px]", "font-extrabold", "text-neutral-700");
    expect(closeHeader).toHaveClass("text-right");
    expect(oneMonthHeader).toHaveClass("text-right");
    expect(within(closeHeader).getByText("(원)")).toHaveClass("block", "text-[10px]", "font-bold", "text-neutral-500");
    expect(within(oneMonthHeader).getByText("(%)")).toHaveClass("block", "text-[10px]", "font-bold", "text-neutral-500");
  });

  it("환노출과 환헤지는 X와 O로 표시하고 부분·탄력 헤지는 유지한다", () => {
    const classification = (fxHedge: string) => ({
      published: true,
      marketScope: "미국",
      assetClass: "주식",
      assetDetail: null,
      strategy: null,
      fxHedge,
      reviewStatus: "자동확정",
      reviewPriority: "",
      sourceUrl: null,
      evidenceSummary: null,
    });
    render(<Dashboard etfs={[
      etf({ ticker: "FX1", name: "환노출 ETF", classification: classification("환노출") }),
      etf({ ticker: "FX2", name: "환헤지 ETF", classification: classification("환헤지") }),
      etf({ ticker: "FX3", name: "부분헤지 ETF", classification: classification("부분 헤지") }),
      etf({ ticker: "FX4", name: "탄력헤지 ETF", classification: classification("탄력적 헤지") }),
    ]} />);

    expect(screen.getByLabelText("환노출: 환헤지 없음")).toHaveTextContent("X");
    expect(screen.getByLabelText("환헤지 적용")).toHaveTextContent("O");
    expect(screen.getByLabelText("부분 헤지")).toHaveTextContent("부분");
    expect(screen.getByLabelText("탄력적 헤지")).toHaveTextContent("탄력");
  });

  it("긴 자산 분류는 좁은 열에서 의미 단위로 두 줄 표시한다", () => {
    render(<Dashboard etfs={[
      etf({ ticker: "P", name: "파킹 ETF", assetClass: "금리·파킹" }),
      etf({ ticker: "R", name: "리츠 ETF", assetClass: "리츠·인프라" }),
    ]} />);
    expect(screen.getByLabelText("금리")).toHaveTextContent("금리");
    expect(screen.getByLabelText("리츠/인프라")).toHaveTextContent("리츠/인프라");
  });

  it("신규 상장은 2주와 상장 후 ITD를 표시하고 3개월은 제외한다", async () => {
    window.history.replaceState(null, "", "/quick?mode=new");
    render(<Dashboard etfs={items} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "상장 후 90일 이내 신규 ETF" })).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "2주" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "상장 후" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "3개월" })).not.toBeInTheDocument();
    expect(screen.getByText("소규모 신규 ETF")).toBeInTheDocument();
  });

  it("검색과 테이블 헤더를 제공한다", () => {
    render(<Dashboard etfs={items} />);
    const explorer = screen.getByRole("region", { name: "ETF 검색과 정렬" });
    const search = screen.getByRole("combobox", { name: "종목명 또는 티커 검색" });
    const scope = screen.getByRole("combobox", { name: "순자산 기준" });
    const tableHeader = screen.getByRole("columnheader", { name: "종목코드" }).closest("thead");
    expect(search.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(explorer).toContainElement(search);
    expect(explorer).toHaveClass("border-brand-200", "bg-brand-50/40");
    expect(tableHeader).toHaveClass("border-b-2", "border-neutral-300", "bg-neutral-100");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "대형" } });
    expect(screen.getByRole("link", { name: "대형 일반 ETF" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /대형 일반 ETF/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
    expect(search).toHaveValue("");
    expect(screen.queryByRole("listbox", { name: "ETF 검색 자동완성" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "종가, 단위 원" })).toHaveTextContent("종가(원)");
    expect(screen.getByRole("columnheader", { name: "거래대금, 단위 억원" })).toHaveTextContent("거래대금(억원)");
    expect(screen.getByRole("columnheader", { name: "1개월 수익률, 단위 퍼센트" })).toHaveTextContent("1개월(%)");
  });
});
