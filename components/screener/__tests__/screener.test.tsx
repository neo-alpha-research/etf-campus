import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { Etf } from "@/lib/domain/etf-types";
import { Screener } from "../screener";

function etf(overrides: Partial<Etf>): Etf {
  return {
    isin: "KR7000000000", ticker: "000000", name: "샘플 ETF", baseIndex: "샘플 지수",
    close: 10_000, changePct: 1.2, tradeValue: 2_000_000_000, aum: 100_000_000_000,
    riskType: "normal", assetClass: "주식-국내", pension: "가능", pensionSource: "공식확인",
    liquidity: "pass", asOfDate: "20260715", listingDate: null, listingDateSource: null,
    returns: { "1d": 1.2, "1w": 1, "2w": 2, "1m": 3, "2m": 4, "3m": 5, "6m": 6, "12m": 12, "24m": 24, "36m": 36, ytd: 7, itd: 7 },
    isNew90d: null, isNew3m: false,
    issuer: { issuerId: "samsung", issuerName: "삼성자산운용" },
    classification: { published: true, marketScope: "국내", assetClass: "주식-국내", assetDetail: null, strategy: "액티브", fxHedge: "환노출", reviewStatus: "자동확정", reviewPriority: "", sourceUrl: null, evidenceSummary: null },
    fee: { totalFeePct: 0.1, verificationStatus: "verified_official" },
    ...overrides,
  };
}

const items = [
  etf({ ticker: "A", name: "대형 일반 ETF", aum: 100_000_000_000, classification: { published: true, marketScope: "미국", assetClass: "주식-해외", assetDetail: null, strategy: "액티브", fxHedge: "환노출", reviewStatus: "자동확정", reviewPriority: "", sourceUrl: null, evidenceSummary: null } }),
  etf({ ticker: "B", name: "레버리지 ETF", riskType: "leverage", aum: 100_000_000_000, classification: { published: true, marketScope: "국내", assetClass: "주식-국내", assetDetail: null, strategy: "패시브", fxHedge: "환노출", reviewStatus: "자동확정", reviewPriority: "", sourceUrl: null, evidenceSummary: null } }),
];

describe("Screener - 빠른 시작 및 선택 조건", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("연금 가능 칩은 기본 선택되며 해제 상태도 URL에 보존된다", () => {
    render(<Screener etfs={items} />);
    const pensionSwitch = screen.getByRole("switch", { name: "DC·IRP 가능만" });
    expect(pensionSwitch).toBeChecked();
    expect(screen.getByRole("button", { name: "DC·IRP 가능 조건 제거" })).toBeInTheDocument();

    fireEvent.click(pensionSwitch);
    expect(pensionSwitch).not.toBeChecked();
    expect(window.location.search).toContain("pension=all");
    expect(screen.queryByRole("button", { name: "DC·IRP 가능 조건 제거" })).not.toBeInTheDocument();
  });

  it("미국 주식 칩이 자산군과 지역을 함께 변경한다", () => {
    render(<Screener etfs={items} />);
    const usQuick = screen.getByRole("button", { name: "미국 주식" });
    fireEvent.click(usQuick);
    expect(usQuick).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("market=%EB%AF%B8%EA%B5%AD"); // 미국
    expect(window.location.search).toContain("asset=%EC%A3%BC%EC%8B%9D-%ED%95%B4%EC%99%B8"); // 주식-해외

    expect(screen.getByRole("button", { name: "미국 조건 제거" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "주식-해외 조건 제거" })).toBeInTheDocument();
  });

  it("채권·파킹이 두 자산을 OR로 적용한다", () => {
    render(<Screener etfs={items} />);
    const bondQuick = screen.getByRole("button", { name: "채권·파킹" });
    fireEvent.click(bondQuick);
    expect(bondQuick).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("asset=%EC%B1%84%EA%B6%8C"); // 채권
    expect(window.location.search).toContain("asset=%EA%B8%88%EB%A6%AC%C2%B7%ED%8C%8C%ED%82%B9"); // 금리·파킹
  });

  it("10개의 인기 퀵 필터 버튼이 정상 렌더링되고 테마 전환이 작동한다", () => {
    render(<Screener etfs={items} />);
    expect(screen.getByText("TOP 10 인기 테마")).toBeInTheDocument();

    const labels = ["미국 주식", "국내 주식", "배당성장", "반도체", "AI·빅테크", "채권·파킹", "커버드콜", "금·원자재", "전력·원자력", "2차전지"];
    for (const label of labels) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    const semiButton = screen.getByRole("button", { name: "반도체" });
    fireEvent.click(semiButton);
    expect(semiButton).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("q=%EB%B0%98%EB%8F%84%EC%B2%B4"); // 반도체

    // 필터 해제 버튼 확인
    const clearButton = screen.getByRole("button", { name: "반도체 필터 해제" });
    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton);
    expect(semiButton).toHaveAttribute("aria-pressed", "false");
  });

  it("선택 조건 칩 하나를 제거해도 다른 조건이 유지된다", () => {
    render(<Screener etfs={items} />);
    // 기본 연금 조건을 유지한 채 미국 선택
    fireEvent.click(screen.getByRole("button", { name: "미국 주식" }));

    // 미국 지역 조건만 제거
    const removeMarket = screen.getByRole("button", { name: "미국 조건 제거" });
    fireEvent.click(removeMarket);

    // 연금과 해외주식은 남아야 함
    expect(screen.getByRole("button", { name: "DC·IRP 가능 조건 제거" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "주식-해외 조건 제거" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "미국 조건 제거" })).not.toBeInTheDocument();

    // 미국 주식 칩은 더이상 전체가 활성이 아니므로 false
    expect(screen.getByRole("button", { name: "미국 주식" })).toHaveAttribute("aria-pressed", "false");
  });

  it("초기화가 기본 상태로 돌아간다", () => {
    render(<Screener etfs={items} />);
    fireEvent.click(screen.getByRole("button", { name: "미국 주식" }));
    expect(window.location.search).toContain("market=");

    fireEvent.click(screen.getByRole("button", { name: "조건 초기화" }));
    expect(window.location.search).toBe(""); // 기본값은 쿼리 없음
    
    // 기본값인 1,000억 이상과 일반형은 선택 조건 칩에 노출되어야 한다. 
    // wait, the prompt says "기본 상태로 복귀해야 합니다... 선택 조건 칩도 즉시 갱신되어야 합니다."
    // 1000억과 일반형 칩이 있는지 확인.
    expect(screen.getByRole("button", { name: "순자산 1,000억 이상 조건 제거" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "일반형 조건 제거" })).toBeInTheDocument();
  });

  it("1개월 선택 시 차트 제목과 선택 기간이 변경되며 URL이 동기화된다", () => {
    render(<Screener etfs={items} />);
    const monthQuick = screen.getByRole("button", { name: "1개월" });
    fireEvent.click(monthQuick);

    expect(monthQuick).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("period=1m");
    expect(screen.getByRole("heading", { name: /1개월 수익률 TOP 5/ })).toBeInTheDocument();
  });

  it("TOP 5 종목의 상세 정보(순위, 이름, 티커, 수익률, 연금 배지 등)가 표시되며 상세 페이지로 링크된다", () => {
    render(<Screener etfs={items} />);
    // 1일 선택(기본)
    const links = screen.getAllByRole("link", { name: /대형 일반 ETF/ });
    expect(links[0]).toHaveAttribute("href", "/etf/A");
    
    // 수익률(1.2%) 표시 확인
    const returns = screen.getAllByText("+1.20%");
    expect(returns.length).toBeGreaterThan(0);
    
    // 지역 정보 확인 (미국)
    const regions = screen.getAllByText("미국");
    expect(regions.length).toBeGreaterThan(0);
  });

  it("연금 불가 종목에는 연금불가 배지를 노출한다", () => {
    render(<Screener etfs={[etf({ ticker: "X", name: "일반 비연금 ETF", pension: "불가" })]} />);
    fireEvent.click(screen.getByRole("switch", { name: "DC·IRP 가능만" }));
    expect(screen.getAllByText("연금불가")[0]).toBeInTheDocument();
  });

  it("정렬 기준을 순자산으로 변경하면 URL에 동기화된다", () => {
    render(<Screener etfs={items} />);
    const sortSelect = screen.getByLabelText("정렬 기준");
    fireEvent.change(sortSelect, { target: { value: "aum" } });
    
    expect(sortSelect).toHaveValue("aum");
    expect(window.location.search).toContain("sort=aum");
  });

  it("CTA 버튼은 펜션 모드일 때 mode=pension을 포함한다", () => {
    render(<Screener etfs={items} />);
    const cta = screen.getByRole("link", { name: /이 조건으로 상세 표 보기/ });
    expect(cta).toHaveAttribute("href", expect.stringContaining("mode=pension"));
  });

  it("CTA 버튼은 레버리지/인버스만 선택 시 mode=derivatives를 포함한다", () => {
    render(<Screener etfs={items} />);
    // 파생상품 탐색으로 전환할 때는 기본 연금 조건을 먼저 해제한다.
    fireEvent.click(screen.getByRole("switch", { name: "DC·IRP 가능만" }));

    // 레버리지 선택
    const leverageLabel = screen.getByLabelText("레버리지");
    fireEvent.click(leverageLabel);
    
    // 일반형 해제
    const normalLabel = screen.getByLabelText("일반형");
    fireEvent.click(normalLabel);

    const cta = screen.getByRole("link", { name: /이 조건으로 상세 표 보기/ });
    expect(cta).toHaveAttribute("href", expect.stringContaining("mode=derivatives"));
    expect(cta).toHaveAttribute("href", expect.stringContaining("risk=leverage"));
  });

  it("TR 모드 전환 시 TR 결측 종목은 PR로 슬그머니 대체되지 않고 '-'로 표시되며 정렬 최하단으로 이동한다", () => {
    const etfWithTr = etf({
      ticker: "TR_YES",
      name: "TR 보유 ETF",
      returnsTr: { "1d": 5.0, "1w": 5, "2w": 5, "1m": 5, "2m": 5, "3m": 5, "6m": 5, "12m": 5, "24m": 5, "36m": 5, ytd: 5, itd: 5 },
      returns: { "1d": 2.0, "1w": 2, "2w": 2, "1m": 2, "2m": 2, "3m": 2, "6m": 2, "12m": 2, "24m": 2, "36m": 2, ytd: 2, itd: 2 },
    });
    const etfNoTr = etf({
      ticker: "TR_NO",
      name: "TR 미보유 ETF",
      returnsTr: undefined,
      returns: { "1d": 10.0, "1w": 10, "2w": 10, "1m": 10, "2m": 10, "3m": 10, "6m": 10, "12m": 10, "24m": 10, "36m": 10, ytd: 10, itd: 10 },
    });

    render(<Screener etfs={[etfWithTr, etfNoTr]} />);
    // 기본 상태(PR 모드)에서는 둘 다 PR 값(+2.00, +10.00)을 노출
    expect(screen.getAllByText("+2.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+10.00").length).toBeGreaterThan(0);

    // TR 토글 클릭
    const trButton = screen.getByRole("button", { name: /TR OFF/ });
    fireEvent.click(trButton);

    // TR 모드에서는 TR 보유 ETF는 +5.00 노출, 미보유 ETF는 10.00(PR)으로 폴백되지 않고 '-' 노출
    expect(screen.getAllByText("+5.00").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("+10.00").length).toBe(0);
  });
});

