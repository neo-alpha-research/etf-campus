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
    ...overrides,
  };
}

const items = [
  etf({ ticker: "A", name: "대형 일반 ETF", aum: 100_000_000_000, classification: { published: true, marketScope: "미국", assetClass: "주식-해외", assetDetail: null, strategy: "액티브", fxHedge: "환노출", reviewStatus: "자동확정", reviewPriority: "", sourceUrl: null, evidenceSummary: null } }),
];

describe("Screener - 빠른 시작 및 선택 조건", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("기본 화면에서 순자산 1,000억 이상 빠른 칩이 활성인지 확인한다", () => {
    render(<Screener etfs={items} />);
    const aumQuick = screen.getByRole("button", { name: "순자산 1,000억 이상" });
    expect(aumQuick).toHaveAttribute("aria-pressed", "true");
  });

  it("연금 가능 칩 클릭 시 pension 필터와 URL이 변경된다", () => {
    render(<Screener etfs={items} />);
    const pensionQuick = screen.getByRole("button", { name: "연금 가능 ETF" });
    expect(pensionQuick).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(pensionQuick);
    expect(pensionQuick).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("pension=eligible");
    
    // 선택 조건 칩 확인
    expect(screen.getByRole("button", { name: "DC·IRP 가능 조건 제거" })).toBeInTheDocument();
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

  it("선택 조건 칩 하나를 제거해도 다른 조건이 유지된다", () => {
    render(<Screener etfs={items} />);
    // 연금 & 미국 선택
    fireEvent.click(screen.getByRole("button", { name: "연금 가능 ETF" }));
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
    expect(screen.getByRole("button", { name: "순자산 1,000억원 이상 조건 제거" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "일반형 조건 제거" })).toBeInTheDocument();
  });
});
