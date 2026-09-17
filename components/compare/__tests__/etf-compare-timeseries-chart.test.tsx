import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EtfCompareTimeseriesChart,
  SeriesV2Data,
} from "../etf-compare-timeseries-chart";
import type { Etf } from "@/lib/domain/etf-types";

describe("EtfCompareTimeseriesChart", () => {
  // Helper to generate 60 dates
  const dates60: string[] = [];
  const baseDate = new Date("2026-07-01");
  for (let i = 0; i < 60; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    dates60.push(d.toISOString().slice(0, 10));
  }

  const createMockEtf = (ticker: string, name: string): Etf =>
    ({
      ticker,
      name,
      asOfDate: "2026-09-01",
      returns: { "1m": 2, "3m": 5 },
    } as unknown as Etf);

  const createMockSeries = (
    ticker: string,
    dates: string[],
    startVal: number,
    slope: number
  ): SeriesV2Data => ({
    ticker,
    startDate: dates[0],
    dates,
    close: dates.map((_, i) => startVal + i * slope),
    tr: dates.map((_, i) => startVal + i * slope),
    netTr: dates.map((_, i) => startVal + i * slope),
    hasDistribution: true,
    asOf: dates[dates.length - 1],
  });

  // ① 5종목 라인 렌더
  it("① 5종목 라인 렌더: 5개 종목이 모두 유효할 때 5개 시리즈 그룹과 SVG가 정상 렌더링된다", () => {
    const tickers = ["069500", "360750", "133690", "488770", "161510"];
    const basket = tickers.map((t, idx) => createMockEtf(t, `종목 ${idx + 1}`));
    const seriesMap: Record<string, SeriesV2Data> = {};

    tickers.forEach((t, idx) => {
      seriesMap[t] = createMockSeries(t, dates60, 10000 * (idx + 1), 50 * (idx + 1));
    });

    render(
      <EtfCompareTimeseriesChart
        basket={basket}
        period="1M"
        seriesMap={seriesMap}
      />
    );

    const svg = screen.getByTestId("compare-timeseries-svg");
    expect(svg).toBeDefined();

    // Verify all 5 series groups exist
    tickers.forEach((t) => {
      expect(screen.getByTestId(`series-group-${t}`)).toBeDefined();
    });
  });

  // ② 뱃지 겹침 없음(최소 간격 18px 이상)
  it("② 뱃지 겹침 없음: 5종목이 거의 동일한 수익률로 마감해도 뱃지 간 y 거리가 최소 18px 이상 유지된다", () => {
    const tickers = ["T1", "T2", "T3", "T4", "T5"];
    const basket = tickers.map((t) => createMockEtf(t, `종목 ${t}`));
    const seriesMap: Record<string, SeriesV2Data> = {};

    // All 5 start at 10000 and end virtually identical (e.g. 10501, 10502, 10503...)
    tickers.forEach((t, idx) => {
      seriesMap[t] = createMockSeries(t, dates60, 10000, 50 + idx * 0.1);
    });

    const { container } = render(
      <EtfCompareTimeseriesChart
        basket={basket}
        period="1M"
        seriesMap={seriesMap}
      />
    );

    // Get all badge rect elements
    const badgeRects = container.querySelectorAll("g[data-testid^='badge-'] rect");
    expect(badgeRects.length).toBe(5);

    const yPositions: number[] = [];
    badgeRects.forEach((r) => {
      const y = parseFloat(r.getAttribute("y") || "0");
      yPositions.push(y);
    });

    // Sort y positions
    yPositions.sort((a, b) => a - b);

    // Verify distance between consecutive badges is >= 18px
    for (let i = 1; i < yPositions.length; i++) {
      const gap = yPositions[i] - yPositions[i - 1];
      expect(gap).toBeGreaterThanOrEqual(18);
    }
  });

  // ③ insufficient 종목은 선을 그리지 않고 안내 문구 표시
  it("③ insufficient 종목은 선을 그리지 않고 안내 문구 표시: 거래일수 20일 미만 종목은 라인 제외 및 배너 노출", () => {
    const basket = [
      createMockEtf("GOOD", "정상 종목"),
      createMockEtf("NEW1", "신규 상장 종목"),
    ];

    // GOOD has 60 dates, NEW1 only has 5 dates (< 20)
    const seriesMap: Record<string, SeriesV2Data> = {
      GOOD: createMockSeries("GOOD", dates60, 10000, 50),
      NEW1: createMockSeries("NEW1", dates60.slice(55), 10000, 10),
    };

    render(
      <EtfCompareTimeseriesChart
        basket={basket}
        period="1M"
        seriesMap={seriesMap}
      />
    );

    // GOOD should have series line
    expect(screen.getByTestId("series-group-GOOD")).toBeDefined();

    // NEW1 should NOT have series line
    expect(screen.queryByTestId("series-group-NEW1")).toBeNull();

    // Insufficient banner must be visible
    const banner = screen.getByTestId("insufficient-coverage-banner");
    expect(banner.textContent).toContain("신규 상장 종목");
    expect(banner.textContent).toContain("거래일수 부족(20일 미만)으로 시계열 비교에서 제외되었습니다");
  });

  // ④ partial 일 때 기간 축소 배너 노출
  it("④ partial 일 때 기간 축소 배너 노출: 후발 상장으로 요청 기간의 50% 이상 축소 시 경고 배너 노출", () => {
    const basket = [
      createMockEtf("BASE", "기존 종목"),
      createMockEtf("LATE", "후발 종목"),
    ];

    // Requested period is 1M (60 days in test).
    // LATE listed at day 40 (has 20 days >= 20, but truncates 40/60 = 66.7% > 50%)
    const seriesMap: Record<string, SeriesV2Data> = {
      BASE: createMockSeries("BASE", dates60, 10000, 50),
      LATE: createMockSeries("LATE", dates60.slice(40), 10000, 20),
    };

    render(
      <EtfCompareTimeseriesChart
        basket={basket}
        period="3M"
        seriesMap={seriesMap}
      />
    );

    // Partial coverage banner must be visible
    const banner = screen.getByTestId("partial-coverage-banner");
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain("비교 시작일이 자동 축소되었습니다");
  });

  // ⑤ 법정 면책 문구 및 스크린 리더 테이블 렌더 검증
  it("⑤ 법정 면책 문구 및 스크린 리더 접근성: 3종 컴플라이언스 각주와 스크린 리더용 표가 정상 렌더링된다", () => {
    const basket = [createMockEtf("BASE", "대표 ETF")];
    const seriesMap: Record<string, SeriesV2Data> = {
      BASE: createMockSeries("BASE", dates60, 10000, 50),
    };

    render(
      <EtfCompareTimeseriesChart
        basket={basket}
        period="1M"
        seriesMap={seriesMap}
      />
    );

    // 3 Legal Disclaimers
    expect(screen.getByText(/분배금은 분배락일 종가로 재투자했다고 가정한 이론 수치이며/)).toBeInTheDocument();
    expect(screen.getByText(/세금은 반영하지 않은 세전 기준입니다/)).toBeInTheDocument();
    expect(screen.getByText(/과거 성과가 미래 수익을 보장하지 않습니다/)).toBeInTheDocument();

    // Accessible table for screen readers
    const table = screen.getByRole("table", { hidden: true });
    expect(table).toBeInTheDocument();
    expect(table.className).toContain("sr-only");
  });
});
