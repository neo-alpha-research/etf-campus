import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    returns: { "1d": 1.2, "1w": 1, "2w": 2, "1m": 3, "2m": 4, "3m": 5, "6m": 6, "ytd": 8, "12m": 12, "24m": 24, "36m": 36, itd: 7 },
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
    expect(screen.getByRole("columnheader", { name: "종목 정보" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "종가, 단위 원" })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: "거래대금, 단위 억원" })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: "순자산, 단위 억원" })).toHaveClass("text-right");
    expect(screen.getAllByRole("columnheader", { name: "1일 수익률" })[0]).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "대형 일반 ETF" })).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.queryByText("레버리지 ETF")).not.toBeInTheDocument();
  });

  it("500억과 전체 범위를 전환하고 순자산 수치를 그대로 표시한다", () => {
    render(<Dashboard etfs={items} />);
    const select = screen.getByRole("combobox", { name: "순자산 기준" });
    fireEvent.change(select, { target: { value: "500plus" } });
    expect(screen.getByText("순자산 500억 이상 · 2종목")).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "all" } });
    expect(screen.getByText("순자산 전체 · 3종목")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.queryByText("50.0")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("소규모 ETF: 순자산 100억원 미만")).not.toBeInTheDocument();
  });

  it("일반 계좌에 2주, 2년, 3년 수익률이 포함되며 전 구간 토글이 작동한다", () => {
    const items = [
      etf({ ticker: "000001", aum: 1100 }),
    ];
    render(<Dashboard etfs={items} />);
    expect(screen.getByRole("option", { name: "2주" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2년" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "3년" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "3년 수익률" })).toBeInTheDocument();

    // 전 구간 10개 펼치기 토글 클릭
    fireEvent.click(screen.getByRole("button", { name: "전 구간 10개 펼치기 ▾" }));
    expect(screen.getByRole("columnheader", { name: "2년 수익률" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "2주 수익률" })).toBeInTheDocument();

    // 다시 5개 핵심으로 접기
    fireEvent.click(screen.getByRole("button", { name: "5개 핵심으로 접기 ▴" }));
    expect(screen.queryByRole("columnheader", { name: "2년 수익률" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "3년 수익률" })).toBeInTheDocument();
  });

  it("긴 종목명과 분류·티커 정보를 2줄로 통합 표시한다", () => {
    render(<Dashboard etfs={items} />);
    const infoHeader = screen.getByRole("columnheader", { name: "종목 정보" });
    const nameLink = screen.getByRole("link", { name: "대형 일반 ETF" });

    expect(infoHeader).toHaveClass("text-center");
    expect(nameLink).toHaveClass("line-clamp-1", "truncate", "block", "text-left");
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("주식-국내")).toBeInTheDocument();
  });

  it("데이터 행 패딩과 2줄 종목명 및 좌측 고정을 유지한다", () => {
    render(<Dashboard etfs={items} />);
    const nameCell = screen.getByRole("rowheader", { name: /대형 일반 ETF/ });
    const changeCell = screen.getAllByRole("cell", { name: /\+1\.20%/ })[0];

    expect(nameCell).toHaveClass("py-1.5", "sticky", "left-0");
    expect(screen.getByRole("link", { name: "대형 일반 ETF" })).toBeInTheDocument();
    expect(changeCell).toHaveClass("py-2");
  });

  it("표 헤더를 고정하고 단위를 두 번째 줄에 표시한다", () => {
    render(<Dashboard etfs={items} />);
    const closeHeader = screen.getByRole("columnheader", { name: "종가, 단위 원" });
    const oneMonthHeader = screen.getByRole("columnheader", { name: "1개월 수익률" });

    expect(closeHeader.closest("thead")).toHaveClass("sticky", "top-0");
    expect(closeHeader.closest("thead")).toHaveClass("font-bold", "text-neutral-700");
    expect(closeHeader).toHaveClass("text-right");
    expect(oneMonthHeader).toHaveClass("text-right");
  });

  it("환헤지는 노출을 비우고 헤지·부분·탄력을 짧게 표기한다", () => {
    const classification = (fxHedge: string) => ({
      published: true,
      marketScope: "미국",
      assetClass: "주식",
      assetDetail: null,
      strategy: null,
      fxHedge,
      reviewStatus: "미검수",
      reviewPriority: "",
      sourceUrl: null,
      evidenceSummary: null,
    });

    render(<Dashboard etfs={[etf({ ticker: "FX1", name: "환노출 ETF", classification: classification("노출") })]} />);
    expect(screen.queryByLabelText("환헤지 적용")).not.toBeInTheDocument();

    cleanup();
    render(<Dashboard etfs={[etf({ ticker: "FX2", name: "환헤지 ETF", classification: classification("헤지") })]} />);
    expect(screen.getByLabelText("환헤지 적용")).toHaveTextContent("(H)");

    cleanup();
    render(<Dashboard etfs={[etf({ ticker: "FX3", name: "부분헤지 ETF", classification: classification("부분") })]} />);
    expect(screen.getByLabelText("환헤지 적용")).toHaveTextContent("(부분 H)");

    cleanup();
    render(<Dashboard etfs={[etf({ ticker: "FX4", name: "탄력헤지 ETF", classification: classification("탄력적 헤지") })]} />);
    expect(screen.getByLabelText("환헤지 적용")).toHaveTextContent("(탄력 H)");
  });

  it("자산 분류를 종목 정보 내에 표시한다", () => {
    render(<Dashboard etfs={[
      etf({ ticker: "P", name: "파킹 ETF", assetClass: "금리·파킹" }),
      etf({ ticker: "R", name: "리츠 ETF", assetClass: "리츠·인프라" }),
    ]} />);
    expect(screen.getByText("금리·파킹")).toBeInTheDocument();
    expect(screen.getByText("리츠·인프라")).toBeInTheDocument();
  });

  it("신규 상장은 2주와 상장 후 ITD를 표시하고 3개월은 제외한다", async () => {
    window.history.replaceState(null, "", "/quick?mode=new");
    render(<Dashboard etfs={[
      etf({ ticker: "NEW", name: "소규모 신규 ETF", aum: 5_000_000_000, listingDate: "20260701", isNew3m: true }),
    ]} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "상장 후 90일 이내 신규 ETF" })).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "2주" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "상장 후" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "3개월" })).not.toBeInTheDocument();
    expect(screen.getByText("소규모 신규 ETF")).toBeInTheDocument();
    expect(screen.getByText("2026.07.01")).toHaveClass("whitespace-nowrap");
    expect(screen.queryByLabelText("소규모 ETF: 순자산 100억원 미만")).not.toBeInTheDocument();
  });

  it("검색과 테이블 헤더를 제공한다", () => {
    render(<Dashboard etfs={items} />);
    const explorer = screen.getByRole("region", { name: "ETF 검색과 정렬" });
    const search = screen.getByRole("combobox", { name: "종목명 또는 티커 검색" });
    const scope = screen.getByRole("combobox", { name: "순자산 기준" });
    const tableHeader = screen.getByRole("columnheader", { name: "종목 정보" }).closest("thead");
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
    expect(screen.getByRole("columnheader", { name: "1개월 수익률" })).toHaveTextContent("1개월");
  });

  it("커버드콜 모드에서는 4대 유의사항 배너, 기초자산 퀵 필터 및 전용 뱃지를 제공한다", async () => {
    const ccEtfs = [
      etf({
        ticker: "CC1",
        name: "해외주식 커버드콜 ETF",
        assetClass: "주식-해외",
        aum: 100_000_000_000,
        classification: { strategy: "커버드콜" } as any,
        distributionYield: 12.5,
        distributionCycle: "월배당",
        pension: "가능",
        pensionLimit: "70%",
      }),
      etf({
        ticker: "CC2",
        name: "국내주식 커버드콜 ETF",
        assetClass: "주식-국내",
        aum: 100_000_000_000,
        classification: { strategy: "커버드콜" } as any,
        distributionYield: 9.8,
        distributionCycle: "월배당",
        pension: "가능",
        pensionLimit: "70%",
      }),
      etf({
        ticker: "CC3",
        name: "채권 커버드콜 ETF",
        assetClass: "채권",
        aum: 100_000_000_000,
        classification: { strategy: "커버드콜" } as any,
        distributionYield: 11.2,
        distributionCycle: "월배당",
        pension: "가능",
        pensionLimit: "100% (안전자산)",
      }),
      etf({
        ticker: "CC4",
        name: "원자재 커버드콜 ETF",
        assetClass: "원자재",
        aum: 100_000_000_000,
        classification: { strategy: "커버드콜" } as any,
        distributionYield: 8.0,
        distributionCycle: "월배당",
        pension: "불가",
      }),
    ];

    window.history.replaceState(null, "", "/quick?mode=covered_call");
    render(<Dashboard etfs={ccEtfs} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "커버드콜 ETF" })).toBeInTheDocument());

    // 1. 유의사항 배너 4대 항목 검증 (당국 명칭 배제 확인)
    const banner = screen.getByText(/커버드콜 ETF 투자 유의사항/).closest(".rounded-xl");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("상승 제한");
    expect(banner).toHaveTextContent("원금 손실");
    expect(banner).toHaveTextContent("제자리 깎기(원금 분배) 위험");
    expect(banner).toHaveTextContent("목표 분배율 미보장");
    expect(banner?.textContent).not.toContain("금감원");
    expect(banner?.textContent).not.toContain("금융감독원");

    // 2. 2-Tier 기초자산 퀵 필터 칩 검증 (합계 = 모수 일치)
    expect(screen.getByRole("button", { name: /전체/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /해외주식 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /국내주식 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /채권 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /원자재 1/ })).toBeInTheDocument();

    // 3. 전용 뱃지 검증 (분배율 실적 및 퇴직연금 한도 분기)
    expect(screen.getByText("연 12.5% · 월배당")).toBeInTheDocument();
    expect(screen.getByText("연 11.2% · 월배당")).toBeInTheDocument();
    expect(screen.getByText("안전자산100%")).toBeInTheDocument();
    expect(screen.getAllByText("위험70%").length).toBe(2);
    expect(screen.getByText("연금불가")).toBeInTheDocument();

    // 4. 서브 필터 클릭 동작 검증
    fireEvent.click(screen.getByRole("button", { name: /채권 1/ }));
    expect(screen.getByText("채권 커버드콜 ETF")).toBeInTheDocument();
    expect(screen.queryByText("해외주식 커버드콜 ETF")).not.toBeInTheDocument();
  });
});
