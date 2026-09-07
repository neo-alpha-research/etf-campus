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
    await waitFor(() => expect(screen.getByRole("heading", { name: /신규 상장 ETF/ })).toBeInTheDocument());
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

  it("혼합채권 모드는 82% 자산배분 가이드 카드와 5대 투자유형 퀵 필터를 제공한다", async () => {
    const mbEtfs = [
      etf({
        ticker: "MB1",
        name: "RISE 삼성전자SK하이닉스채권혼합50",
        assetClass: "채권",
        aum: 100_000_000_000,
        pension: "가능",
      }),
      etf({
        ticker: "MB2",
        name: "TIME 미국나스닥100채권혼합50액티브",
        assetClass: "채권",
        aum: 100_000_000_000,
        pension: "가능",
      }),
      etf({
        ticker: "MB3",
        name: "1Q 200채권혼합50액티브",
        assetClass: "채권",
        aum: 100_000_000_000,
        pension: "가능",
      }),
      etf({
        ticker: "MB4",
        name: "SOL 팔란티어커버드콜OTM채권혼합",
        assetClass: "채권",
        aum: 100_000_000_000,
        pension: "가능",
      }),
      etf({
        ticker: "MB5",
        name: "KODEX TRF3070",
        assetClass: "혼합·자산배분",
        aum: 100_000_000_000,
        pension: "가능",
      }),
    ];

    window.history.replaceState(null, "", "/quick?mode=mixed_bonds");
    render(<Dashboard etfs={mbEtfs} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /혼합채권 ETF/ })).toBeInTheDocument());

    // 1. 헤더 카피 및 가이드 카드 검증
    expect(screen.getByText("퇴직연금 82% 자산배분 전략")).toBeInTheDocument();
    expect(screen.getByText(/근퇴법상 안전자산 100% 인정/)).toBeInTheDocument();
    expect(screen.getByText(/실질 주식 비중 최대 85% 극대화/)).toBeInTheDocument();
    expect(screen.getByText(/주식\+채권 분산 쿠션 및 단일종목 집중/)).toBeInTheDocument();
    expect(screen.getByText(/원금 손실 위험 유의/)).toBeInTheDocument();

    // 2. 5대 퀵 필터 칩 렌더링 검증
    expect(screen.getByRole("button", { name: /전체 5/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /빅테크·단일종목 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /미국·글로벌 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /국내 대표지수·배당 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /인컴·원자재 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /TRF\(자산배분\) 1/ })).toBeInTheDocument();

    // 3. 퀵 필터 인터랙션 검증
    fireEvent.click(screen.getByRole("button", { name: /빅테크·단일종목 1/ }));
    expect(screen.getByText("RISE 삼성전자SK하이닉스채권혼합50")).toBeInTheDocument();
    expect(screen.queryByText("TIME 미국나스닥100채권혼합50액티브")).not.toBeInTheDocument();
  });

  it("TDF 모드는 글라이드패스 2열 가이드 카드와 실존 6대 빈티지 및 내 나이 추천 퀵 필터를 제공한다", async () => {
    const tdfEtfs = [
      etf({
        ticker: "TDF30",
        name: "KODEX TDF2030액티브 적격",
        assetClass: "혼합·자산배분",
        aum: 93_200_000_000,
        pension: "가능",
      }),
      etf({
        ticker: "TDF40",
        name: "KODEX TDF2040액티브 적격",
        assetClass: "혼합·자산배분",
        aum: 187_400_000_000,
        pension: "가능",
      }),
      etf({
        ticker: "TDF45",
        name: "TIGER TDF2045 적격",
        assetClass: "혼합·자산배분",
        aum: 772_000_000_000,
        pension: "가능",
      }),
      etf({
        ticker: "TDF50",
        name: "KODEX TDF2050액티브 적격",
        assetClass: "혼합·자산배분",
        aum: 621_200_000_000,
        pension: "가능",
      }),
      etf({
        ticker: "TDF60",
        name: "KODEX TDF2060액티브 적격",
        assetClass: "혼합·자산배분",
        aum: 183_700_000_000,
        pension: "가능",
      }),
      etf({
        ticker: "TDF65",
        name: "KODEX 코리아TDF2065액티브 적격",
        assetClass: "혼합·자산배분",
        aum: 19_700_000_000,
        pension: "가능",
      }),
    ];

    window.history.replaceState(null, "", "/quick?mode=tdf");
    render(<Dashboard etfs={tdfEtfs} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /TDF ETF/ })).toBeInTheDocument());

    // 1. 헤더 카피 및 2열 가이드 카드 검증
    expect(screen.getByText("생애주기 자동 자산배분 전략")).toBeInTheDocument();
    expect(screen.getByText(/근퇴법상 적격 TDF 100% 편입 특례/)).toBeInTheDocument();
    expect(screen.getByText(/글라이드패스\(Glide Path\) 자동 리밸런싱/)).toBeInTheDocument();
    expect(screen.getByText(/고용노동부 적격 판정 · 100% 전액 편입/)).toBeInTheDocument();
    expect(screen.getByText(/전 빈티지 13종 전수 노출|전수 노출/)).toBeInTheDocument();

    // 2. 6대 실존 빈티지 칩 검증 (허위 2035, 2055 부재 확인)
    expect(screen.getByRole("button", { name: /전체 6/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2030 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2040 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2045 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2050 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2060 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2065 1/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /2035/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /2055/ })).not.toBeInTheDocument();

    // 3. 내 나이 맞춤 추천 검증 (50대 클릭 시 2040 매핑 및 100% 정상 필터링)
    const age50Button = screen.getByRole("button", { name: "50대 (2040)" });
    expect(age50Button).toBeInTheDocument();
    fireEvent.click(age50Button);
    expect(screen.getByText("KODEX TDF2040액티브 적격")).toBeInTheDocument();
    expect(screen.queryByText("KODEX TDF2050액티브 적격")).not.toBeInTheDocument();

    // 4. 테이블 행 뱃지 검증
    expect(screen.getByText("2040 빈티지 · 주식~55%")).toBeInTheDocument();
    expect(screen.getByText("적격 100%편입")).toBeInTheDocument();
  });

  it("커버드콜 모드는 2열 가이드 카드와 5대 실전 테마 퀵 필터 및 안전자산 100% 뱃지를 제공한다", async () => {
    const ccEtfs = [
      etf({
        ticker: "CC_TECH",
        name: "TIGER 미국나스닥100타겟데일리커버드콜",
        assetClass: "주식-해외",
        aum: 2_353_500_000_000,
        pension: "가능",
        pensionLimit: "70% (위험자산)",
        distributionYield: 12.5,
        distributionCycle: "월 분배",
        classification: {
          published: true,
          marketScope: "미국",
          assetClass: "주식",
          assetDetail: null,
          strategy: "커버드콜",
          fxHedge: null,
          reviewStatus: "수기확정",
          reviewPriority: "",
          sourceUrl: null,
          evidenceSummary: null,
        },
      }),
      etf({
        ticker: "CC_BOND",
        name: "TIGER 미국30년국채커버드콜액티브(H)",
        assetClass: "채권",
        aum: 770_700_000_000,
        pension: "가능",
        pensionLimit: "100% (안전자산)",
        distributionYield: 10.2,
        distributionCycle: "월 분배",
        classification: {
          published: true,
          marketScope: "미국",
          assetClass: "채권",
          assetDetail: null,
          strategy: "커버드콜",
          fxHedge: "헤지",
          reviewStatus: "수기확정",
          reviewPriority: "",
          sourceUrl: null,
          evidenceSummary: null,
        },
      }),
      etf({
        ticker: "CC_DIV",
        name: "TIGER 미국배당다우존스타겟데일리커버드콜",
        assetClass: "주식-해외",
        aum: 707_100_000_000,
        pension: "가능",
        pensionLimit: "70% (위험자산)",
        distributionYield: 9.8,
        distributionCycle: "월 분배",
        classification: {
          published: true,
          marketScope: "미국",
          assetClass: "주식",
          assetDetail: null,
          strategy: "커버드콜",
          fxHedge: null,
          reviewStatus: "수기확정",
          reviewPriority: "",
          sourceUrl: null,
          evidenceSummary: null,
        },
      }),
      etf({
        ticker: "CC_DOM",
        name: "KODEX 200타겟위클리커버드콜",
        assetClass: "주식-국내",
        aum: 5_546_200_000_000,
        pension: "가능",
        pensionLimit: "70% (위험자산)",
        distributionYield: 8.5,
        distributionCycle: "월 분배",
        classification: {
          published: true,
          marketScope: "한국",
          assetClass: "주식",
          assetDetail: null,
          strategy: "커버드콜",
          fxHedge: null,
          reviewStatus: "수기확정",
          reviewPriority: "",
          sourceUrl: null,
          evidenceSummary: null,
        },
      }),
      etf({
        ticker: "CC_SP",
        name: "TIGER 미국S&P500타겟데일리커버드콜",
        assetClass: "주식-해외",
        aum: 648_500_000_000,
        pension: "가능",
        pensionLimit: "70% (위험자산)",
        distributionYield: 9.1,
        distributionCycle: "월 분배",
        classification: {
          published: true,
          marketScope: "미국",
          assetClass: "주식",
          assetDetail: null,
          strategy: "커버드콜",
          fxHedge: null,
          reviewStatus: "수기확정",
          reviewPriority: "",
          sourceUrl: null,
          evidenceSummary: null,
        },
      }),
    ];

    window.history.replaceState(null, "", "/quick?mode=covered_call");
    render(<Dashboard etfs={ccEtfs} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /커버드콜 ETF/ })).toBeInTheDocument());

    // 1. 헤더 카피 및 2열 가이드 카드 검증
    expect(screen.getByText("월배당 인컴 & 옵션 매도 전략")).toBeInTheDocument();
    expect(screen.getByText(/자본시장법 제101조 분배금 성격 및 원금 손실 유의/)).toBeInTheDocument();
    expect(screen.getByText(/상방 제한 & 하방 개방/)).toBeInTheDocument();
    expect(screen.getByText(/제자리 깎기\(원금 분배\) & TR 수익률 확인/)).toBeInTheDocument();
    expect(screen.getByText(/위험자산 70%, 채권·혼합형\(1개\)은 안전자산 100% 적격/)).toBeInTheDocument();

    // 2. 5대 실전 테마 퀵 필터 칩 검증
    expect(screen.getByRole("button", { name: /전체 5/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /빅테크·AI·나스닥 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /미국채·채권혼합 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /배당성장·배당다우존스 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /국내대표지수·밸류업 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /미국 S&P500·글로벌 1/ })).toBeInTheDocument();

    // 3. 미국채·채권혼합 칩 클릭 시 필터링 및 안전자산 100% 뱃지 확인
    const bondThemeButton = screen.getByRole("button", { name: /미국채·채권혼합 1/ });
    fireEvent.click(bondThemeButton);
    expect(screen.getByText("TIGER 미국30년국채커버드콜액티브(H)")).toBeInTheDocument();
    expect(screen.queryByText("TIGER 미국나스닥100타겟데일리커버드콜")).not.toBeInTheDocument();
    expect(screen.getByText("안전자산100%")).toBeInTheDocument();

    // 4. 전체 칩 클릭 시 필터 해제 및 옵션 특성 태그 확인
    const showAllButton = screen.getByRole("button", { name: /전체 5/ });
    fireEvent.click(showAllButton);
    expect(screen.getByText("TIGER 미국나스닥100타겟데일리커버드콜")).toBeInTheDocument();
    expect(screen.getAllByText("타겟데일리").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("위험70%").length).toBeGreaterThanOrEqual(1);
  });

  it("레버리지·인버스 모드는 2열 가이드 카드와 배수 퀵 필터 및 파생 배수 뱃지를 제공한다", async () => {
    const derivEtfs = [
      etf({
        ticker: "LEV2",
        name: "KODEX 레버리지",
        assetClass: "주식-국내",
        riskType: "leverage",
        aum: 5_251_900_000_000,
        tradeValue: 1_447_300_000_000,
        pension: "불가",
      }),
      etf({
        ticker: "INV2",
        name: "KODEX 200선물인버스2X",
        assetClass: "주식-국내",
        riskType: "inverse",
        aum: 745_300_000_000,
        tradeValue: 442_000_000_000,
        pension: "불가",
      }),
      etf({
        ticker: "INV1",
        name: "KODEX 인버스",
        assetClass: "주식-국내",
        riskType: "inverse",
        aum: 751_100_000_000,
        tradeValue: 593_200_000_000,
        pension: "불가",
      }),
    ];

    window.history.replaceState(null, "", "/quick?mode=derivatives");
    render(<Dashboard etfs={derivEtfs} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /레버리지·인버스 ETF/ })).toBeInTheDocument());

    // 1. 헤더 카피 및 2열 가이드 카드 검증
    expect(screen.getByText("단기 매매 & 리스크 헤지 전략")).toBeInTheDocument();
    expect(screen.getByText(/근퇴법상 연금 편입 전면 금지/)).toBeInTheDocument();
    expect(screen.getByText(/일간 배수 추종 & 단기 방향성 매매/)).toBeInTheDocument();
    expect(screen.getByText(/음의 복리\(변동성 잠식\) & 장기 보유 금지/)).toBeInTheDocument();
    expect(screen.getByText(/연금계좌\(DC\/IRP\/연금저축\) 편입 불가/)).toBeInTheDocument();
    expect(screen.getByText(/금융투자협회 사전의무교육\(1시간\) 필수/)).toBeInTheDocument();

    // 2. 배수 퀵 필터 칩 및 테이블 행 뱃지 검증 (필터 칩 + 테이블 행 뱃지 동시 검증)
    expect(screen.getAllByText("+2X 레버리지").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("-2X 곱버스").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("-1X 인버스").length).toBeGreaterThanOrEqual(2);
  });

  it("신규 상장 모드는 2열 가이드 카드와 상장 기간 퀵 필터 및 전 종목 노출을 제공한다", async () => {
    const newEtfs = [
      etf({
        ticker: "NEW1",
        name: "ACE AI반도체포커스",
        assetClass: "주식-국내",
        listingDate: "2026-02-25",
        asOfDate: "2026-03-05",
        aum: 20_000_000_000,
        pension: "가능",
      }),
      etf({
        ticker: "NEW2",
        name: "PLUS 글로벌AI전력인프라",
        assetClass: "주식-해외",
        listingDate: "2026-01-25",
        asOfDate: "2026-03-05",
        aum: 15_000_000_000,
        pension: "가능",
      }),
      etf({
        ticker: "NEW3",
        name: "RISE 국고채30년액티브",
        assetClass: "채권",
        listingDate: "2025-12-20",
        asOfDate: "2026-03-05",
        aum: 150_000_000_000,
        pension: "가능",
      }),
    ];

    window.history.replaceState(null, "", "/quick?mode=new");
    render(<Dashboard etfs={newEtfs} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /신규 상장 ETF/ })).toBeInTheDocument());

    // 1. 헤더 카피 및 2열 가이드 카드 검증
    expect(screen.getByText("최신 시장 트렌드 · 상장 90일 이내")).toBeInTheDocument();
    expect(screen.getByText(/최신 테마 발굴 & 규모 제한 해제/)).toBeInTheDocument();
    expect(screen.getByText(/초기 괴리율\(지정가 매수\) & 결산 전 보수 유의/)).toBeInTheDocument();
    expect(screen.getByText(/순자산 규모 제한 해제 \(1,000억 미만 전 종목 전수 노출\)/)).toBeInTheDocument();
    expect(screen.getByText(/퇴직연금 100% 적격/)).toBeInTheDocument();

    // 2. 상장 기간 퀵 필터 칩 검증
    expect(screen.getByRole("button", { name: /전체.*3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /🔥 30일 이내.*1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /31~60일.*1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /61~90일.*1/ })).toBeInTheDocument();

    // 3. 퀵 필터 인터랙션 검증 (30일 이내 클릭 시 NEW1만 노출)
    fireEvent.click(screen.getByRole("button", { name: /🔥 30일 이내.*1/ }));
    expect(screen.getByText("ACE AI반도체포커스")).toBeInTheDocument();
    expect(screen.queryByText("PLUS 글로벌AI전력인프라")).not.toBeInTheDocument();
    expect(screen.queryByText("RISE 국고채30년액티브")).not.toBeInTheDocument();
  });

  it("전략별 5대 탭은 영문 공식 명칭 대칭과 규모 제한 해제 캡슐 및 서브 필터 URL 동기화를 지원한다", async () => {
    const strategySampleEtfs = [
      etf({
        ticker: "MB_SMALL",
        name: "SOL 미국배당다우존스채권혼합50",
        assetClass: "채권",
        aum: 20_000_000_000, // 1000억 미만 소규모
        pension: "가능",
      }),
      etf({
        ticker: "MB_BIG",
        name: "RISE 삼성전자SK하이닉스채권혼합50",
        assetClass: "채권",
        aum: 250_000_000_000,
        pension: "가능",
      }),
    ];

    // 1. URL 쿼리 파라미터가 포함된 상태로 접속 시 서브 필터 자동 초기화 검증
    window.history.replaceState(null, "", "/quick?mode=mixed_bonds&category=single_stock");
    render(<Dashboard etfs={strategySampleEtfs} />);

    // 2. 영문 공식 명칭 표기 검증
    await waitFor(() => expect(screen.getByRole("heading", { name: "혼합채권 ETF (Mixed Bonds)" })).toBeInTheDocument());

    // 3. 1,000억 미만 소규모 종목도 가려지지 않고 전수 노출되는 캡슐 뱃지 검증
    expect(screen.getByText(/전 종목 2개 전수 노출 · 안전자산 100%/)).toBeInTheDocument();

    // 4. URL의 category=single_stock 파라미터에 의해 빅테크 단일종목만 자동 필터링되었는지 검증
    expect(screen.getByText("RISE 삼성전자SK하이닉스채권혼합50")).toBeInTheDocument();
    expect(screen.queryByText("SOL 미국배당다우존스채권혼합50")).not.toBeInTheDocument();
  });

  it("전략별 탭에서 TR 토글 스위치 클릭 시 TR 수익률을 표시하고 URL returnType을 동기화한다", async () => {
    const trSampleEtfs = [
      etf({
        ticker: "TDF_A",
        name: "KODEX TDF2050액티브",
        aum: 50_000_000_000,
        returns: { ...etf({}).returns, "1d": 1.5, "1m": 2.0 },
        returnsTr: { ...etf({}).returns, "1d": 1.8, "1m": 4.5 },
      }),
    ];

    window.history.replaceState(null, "", "/quick?mode=tdf");
    render(<Dashboard etfs={trSampleEtfs} />);

    // 1. 기본 상태: TR OFF 확인 및 PR 수익률(+2.00) 표시
    const trToggleBtn = screen.getByRole("button", { name: "TR OFF" });
    expect(trToggleBtn).toBeInTheDocument();
    expect(screen.getByText("+2.00")).toBeInTheDocument();

    // 2. TR 토글 클릭 -> TR ON 전환
    fireEvent.click(trToggleBtn);
    expect(screen.getByRole("button", { name: "TR ON" })).toBeInTheDocument();
    // TR 수익률(+4.50) 표시 확인
    expect(screen.getByText("+4.50")).toBeInTheDocument();

    // 3. 툴팁 버튼 클릭 시 모바일 안내 모달 노출 확인
    const infoBtn = screen.getByRole("button", { name: "TR 모드 안내" });
    fireEvent.click(infoBtn);
    expect(screen.getAllByText("TR(Total Return) 모드 안내")[0]).toBeInTheDocument();
  });

  it("커버드콜 탭에서 '🛡️ 안전자산 100%' 퀵 필터 칩이 정상 동작한다", async () => {
    const ccSampleEtfs = [
      etf({
        ticker: "CC_BOND",
        name: "ACE 미국30년국채액티브(H)커버드콜",
        classification: { strategy: "커버드콜" } as any,
        aum: 100_000_000_000,
        pension: "가능",
        pensionLimit: "100% (안전자산)",
      }),
      etf({
        ticker: "CC_EQUITY",
        name: "TIGER 미국나스닥100커버드콜",
        classification: { strategy: "커버드콜" } as any,
        aum: 200_000_000_000,
        pension: "가능",
        pensionLimit: "70% (위험자산)",
      }),
    ];

    window.history.replaceState(null, "", "/quick?mode=covered_call");
    render(<Dashboard etfs={ccSampleEtfs} />);

    // 1. 초기 상태: 2개 종목 모두 노출, 안전자산 100% 칩 카운트 1개
    expect(screen.getByText("ACE 미국30년국채액티브(H)커버드콜")).toBeInTheDocument();
    expect(screen.getByText("TIGER 미국나스닥100커버드콜")).toBeInTheDocument();
    const safeChip = screen.getByRole("button", { name: /안전자산 100%.*1/ });
    expect(safeChip).toBeInTheDocument();

    // 2. 안전자산 100% 칩 클릭 시 채권형 커버드콜만 필터링
    fireEvent.click(safeChip);
    expect(screen.getByText("ACE 미국30년국채액티브(H)커버드콜")).toBeInTheDocument();
    expect(screen.queryByText("TIGER 미국나스닥100커버드콜")).not.toBeInTheDocument();
  });

  it("테이블 컬럼 헤더 클릭 시 해당 열로 정렬되고 재클릭 시 정렬 방향이 토글된다", async () => {
    window.history.replaceState(null, "", "/quick");
    const sortSample = [
      etf({ ticker: "ETF_A", name: "종목A", aum: 500_000_000_000, tradeValue: 10_000_000_000, returns: { "1d": 1.0 } as any }),
      etf({ ticker: "ETF_B", name: "종목B", aum: 100_000_000_000, tradeValue: 50_000_000_000, returns: { "1d": 5.0 } as any }),
    ];
    render(<Dashboard etfs={sortSample} />);

    // 1. 순자산 헤더 클릭 -> AUM 내림차순 정렬
    const aumHeader = screen.getByRole("columnheader", { name: "순자산, 단위 억원" });
    fireEvent.click(aumHeader);
    await waitFor(() => expect(window.location.search).toContain("sort=aum"));

    // 2. 순자산 헤더 재클릭 -> AUM 오름차순 정렬 (direction=asc)
    fireEvent.click(aumHeader);
    await waitFor(() => expect(window.location.search).toContain("direction=asc"));

    // 3. 거래대금 헤더 클릭 -> tradeValue 내림차순 정렬
    const tradeHeader = screen.getByRole("columnheader", { name: "거래대금, 단위 억원" });
    fireEvent.click(tradeHeader);
    await waitFor(() => expect(window.location.search).toContain("sort=tradeValue"));
  });

  it("검색 결과 0건 시 빈 화면 초기화 CTA 버튼이 표시되고 클릭 시 필터가 초기화된다", () => {
    const sample = [
      etf({ ticker: "ETF_A", name: "종목A", aum: 500_000_000_000 }),
    ];
    render(<Dashboard etfs={sample} />);

    const searchInput = screen.getByRole("combobox", { name: "종목명 또는 티커 검색" });
    fireEvent.change(searchInput, { target: { value: "없는검색어XYZ" } });

    expect(screen.getByText("조건에 맞는 ETF가 없습니다")).toBeInTheDocument();
    const resetBtn = screen.getByRole("button", { name: "🔄 검색 및 필터 초기화" });
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(searchInput).toHaveValue("");
    expect(screen.getByText("종목A")).toBeInTheDocument();
  });

  it("혼합채권 및 TDF 가이드 카드에 퇴직연금 안전자산 이동 미니 캡슐 브릿지를 렌더링한다", async () => {
    window.history.replaceState(null, "", "/quick?mode=mixed_bonds");
    const { unmount } = render(<Dashboard etfs={[]} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /혼합채권 ETF/ })).toBeInTheDocument());
    const mbBridge = screen.getByRole("link", { name: /퇴직연금 안전자산 계좌로 이동/ });
    expect(mbBridge).toHaveAttribute("href", "/explore?account=pension&pension_tier=safe");
    unmount();

    window.history.replaceState(null, "", "/quick?mode=tdf");
    render(<Dashboard etfs={[]} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /TDF ETF/ })).toBeInTheDocument());
    const tdfBridge = screen.getByRole("link", { name: /퇴직연금 전체 계좌로 이동/ });
    expect(tdfBridge).toHaveAttribute("href", "/explore?account=pension");
  });
});

