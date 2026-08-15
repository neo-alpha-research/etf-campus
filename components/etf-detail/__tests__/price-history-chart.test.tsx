import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PriceHistoryChart } from "../price-history-chart";
import type { EtfReturnDisplayStatus } from "@/lib/data/etf-return-status";

const d2Status: EtfReturnDisplayStatus = {
  ticker: "458730",
  isIncomeEtf: true,
  priorityTier: "P1",
  prAvailable: true,
  trStatus: "partial",
  trAvailablePeriods: [],
  trUnavailableReason: "검증 TR 준비 중",
  lastVerifiedAt: "",
  estimatedReturnStatus: "available",
  estimatedAvailablePeriods: ["1d", "1w", "2w", "1m"],
  estimatedCoverageMonths: 2,
  estimatedUnavailableReason: "",
  estimatedFirstCoveredDate: "2026-05-27",
  estimatedLastCoveredDate: "2026-06-29",
};

function responseFor(url: string) {
  const estimated = url.includes("basis=estimated");
  return new Response(JSON.stringify({
    actualEnd: "2026-06-29",
    points: [
      { date: "2026-05-27", close: estimated ? 100 : 15600, returnPct: 0 },
      { date: "2026-06-29", close: estimated ? 101.48 : 15750, returnPct: estimated ? 1.48 : 0.96 },
    ],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("PriceHistoryChart D2", () => {
  it("운용사 공지 기반 분배금 반영 수익률을 검증 TR과 분리해 표시한다", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(responseFor(url)));
    vi.stubGlobal("fetch", fetchMock);

    render(<PriceHistoryChart ticker="458730" asOfDate="20260629" returnDisplayStatus={d2Status} />);
    const estimatedButton = screen.getByRole("button", { name: "분배금 반영 · 추정" });
    expect(estimatedButton).toBeEnabled();
    expect(screen.getByRole("button", { name: /분배금 포함 · 준비 중/ })).toBeDisabled();

    fireEvent.click(estimatedButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("basis=estimated")));
    expect(await screen.findByText("수익률")).toBeInTheDocument();
    expect(screen.getByText("운용사 공식 공지 기반 · 2개월 커버리지")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기간 직접 설정" })).toBeDisabled();
  });

  it("기본 선택 버튼이 1Y인지 확인", () => {
    render(<PriceHistoryChart ticker="458730" listingDate="2020-09-25" actualFirstTradingDate="2020-09-28" />);
    const button = screen.getByRole("button", { name: "1년 수익률" });
    expect(button).toHaveClass("bg-white", "text-brand-600");
  });

  it("각 버튼에 한글 접근성 이름이 있는지 확인", () => {
    render(<PriceHistoryChart ticker="458730" listingDate="2020-09-25" actualFirstTradingDate="2020-09-28" />);
    expect(screen.getByRole("button", { name: "1일 수익률" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "연초 이후 수익률" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "상장 후 수익률" })).toBeInTheDocument();
  });

  it("MAX가 상장 후 기간과 연결되는지 확인", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(responseFor(url)));
    vi.stubGlobal("fetch", fetchMock);
    render(<PriceHistoryChart ticker="458730" listingDate="2020-09-25" actualFirstTradingDate="2020-09-28" />);
    
    fireEvent.click(screen.getByRole("button", { name: "상장 후 수익률" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("start=2020-09-28"));
    });
  });

  it("Custom 클릭 시 날짜 설정 패널이 열리고 취소하면 이전 기간으로 복귀하는지 확인", () => {
    render(<PriceHistoryChart ticker="458730" listingDate="2020-09-25" actualFirstTradingDate="2020-09-28" />);
    fireEvent.click(screen.getByRole("button", { name: "기간 직접 설정" }));
    
    expect(screen.getByText("시작일")).toBeInTheDocument();
    expect(screen.getByText("종료일")).toBeInTheDocument();
    
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByText("시작일")).not.toBeInTheDocument();
  });

  it("시작일이 종료일보다 늦으면 에러 메시지를 표시하고 적용하지 않는지 확인", () => {
    render(<PriceHistoryChart ticker="458730" listingDate="2020-09-25" actualFirstTradingDate="2020-09-28" />);
    fireEvent.click(screen.getByRole("button", { name: "기간 직접 설정" }));
    
    // Select inputs
    const inputs = document.querySelectorAll('input[type="date"]');
    if (inputs.length >= 2) {
      fireEvent.change(inputs[0], { target: { value: "2026-08-01" } });
      fireEvent.change(inputs[1], { target: { value: "2026-07-01" } });
      
      fireEvent.click(screen.getByRole("button", { name: "적용" }));
      expect(screen.getByText("시작일이 종료일보다 늦을 수 없습니다.")).toBeInTheDocument();
    }
  });
});
