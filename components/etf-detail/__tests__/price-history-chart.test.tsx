import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PriceHistoryChart } from "../price-history-chart";
import type { EtfReturnDisplayStatus } from "@/lib/data/etf-return-status";

const htmlToImageMock = vi.hoisted(() => ({
  toPng: vi.fn(),
}));

vi.mock("html-to-image", () => htmlToImageMock);

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

const verifiedItdAnchor = {
  price: 10_000,
  date: "2026-05-27",
  source: "KRX_KIND_LISTING_REFERENCE_PRICE",
  qualityStatus: "official_verified",
  verified: true,
} as const;

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

afterEach(() => {
  vi.unstubAllGlobals();
  htmlToImageMock.toPng.mockReset();
});

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

  it("일반 ETF는 YTD를 표시하고 ITD를 표시하지 않는다", () => {
    render(<PriceHistoryChart ticker="458730" listingDate="2020-09-25" actualFirstTradingDate="2020-09-28" />);
    expect(screen.getByRole("button", { name: "1일 수익률" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "연초 이후 수익률" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "상장 후 수익률" })).not.toBeInTheDocument();
  });

  it("ITD가 상장 후 기간과 연결되는지 확인", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(responseFor(url)));
    vi.stubGlobal("fetch", fetchMock);
    render(<PriceHistoryChart ticker="458730" listingDate="2020-09-25" actualFirstTradingDate="2020-09-28" isNewListing itdAnchor={verifiedItdAnchor} />);
    
    fireEvent.click(screen.getByRole("button", { name: "상장 후 수익률" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("start=2020-09-25"));
    });
    expect(await screen.findByText("+57.50%")).toBeInTheDocument();
  });

  it("미검증 상장 기준가격이라도 기준가격 확인 중 상태로 신규 ETF의 ITD를 표시한다", () => {
    render(<PriceHistoryChart ticker="458730" listingDate="2026-05-27" isNewListing itdAnchor={{ ...verifiedItdAnchor, verified: false, qualityStatus: "kind_search_error" }} />);
    expect(screen.getByRole("button", { name: "상장 후 수익률" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "연초 이후 수익률" })).not.toBeInTheDocument();
  });

  it("직접입력 클릭 시 같은 제어행에 날짜 입력란이 열리고 적용·취소 버튼은 표시하지 않는다", () => {
    render(<PriceHistoryChart ticker="458730" asOfDate="20260814" listingDate="2020-09-25" actualFirstTradingDate="2020-09-28" />);
    fireEvent.click(screen.getByRole("button", { name: "기간 직접 설정" }));
    
    expect(screen.getByLabelText("시작일")).toBeInTheDocument();
    expect(screen.getByLabelText("종료일")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "적용" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "취소" })).not.toBeInTheDocument();
  });

  it("직접입력 날짜 범위가 역전되지 않도록 입력 제한을 적용한다", () => {
    render(<PriceHistoryChart ticker="458730" asOfDate="20260814" listingDate="2020-09-25" actualFirstTradingDate="2020-09-28" />);
    fireEvent.click(screen.getByRole("button", { name: "기간 직접 설정" }));

    const start = screen.getByLabelText("시작일") as HTMLInputElement;
    const end = screen.getByLabelText("종료일") as HTMLInputElement;
    expect(start.max).toBe("2026-08-14");
    expect(end.min).toBe("2026-04-14");

    fireEvent.change(end, { target: { value: "2026-03-01" } });
    expect(end.value).toBe("2026-08-14");
  });

  it("저장 이미지에는 종목명과 코드가 좌측 상단에 표시되고 하단에는 중복하지 않는다", async () => {
    let resolveCapture: ((value: string) => void) | undefined;
    htmlToImageMock.toPng.mockImplementationOnce(() => new Promise<string>((resolve) => {
      resolveCapture = resolve;
    }));

    render(<PriceHistoryChart ticker="495330" etfName="1Q 코리아밸류업" asOfDate="20260814" />);
    fireEvent.click(screen.getByTitle("차트를 PNG로 다운로드"));

    await waitFor(() => expect(htmlToImageMock.toPng).toHaveBeenCalledTimes(1));

    const name = screen.getByText("1Q 코리아밸류업");
    expect(name).toHaveClass("text-brand-700", "text-[16px]");
    expect(screen.getByText("495330")).toHaveClass("text-neutral-500");
    expect(screen.queryByText("1Q 코리아밸류업 (495330)")).not.toBeInTheDocument();

    resolveCapture?.("data:image/png;base64,stub");
  });
});
