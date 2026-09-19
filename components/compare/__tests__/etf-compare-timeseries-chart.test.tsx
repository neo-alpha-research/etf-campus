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
  it("③ insufficient 종목은 선을 그리지 않고 안내 문구 표시: 유효 거래일수(2일 미만) 부족 종목은 라인 제외 및 배너 노출", () => {
    const basket = [
      createMockEtf("GOOD", "정상 종목"),
      createMockEtf("NEW1", "신규 상장 종목"),
    ];

    // GOOD has 60 dates, NEW1 only has 1 date (< 2)
    const seriesMap: Record<string, SeriesV2Data> = {
      GOOD: createMockSeries("GOOD", dates60, 10000, 50),
      NEW1: createMockSeries("NEW1", dates60.slice(59), 10000, 10),
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

    // NEW1 should NOT have series line (only 1 data point)
    expect(screen.queryByTestId("series-group-NEW1")).toBeNull();

    // Insufficient banner must be visible
    const banner = screen.getByTestId("insufficient-coverage-banner");
    expect(banner.textContent).toContain("신규 상장 종목");
    expect(banner.textContent).toContain("거래일수 부족으로 시계열 비교에서 제외되었습니다");
  });

  // ④ late listing 종목 상장 시점 합류 안내 배너 노출
  it("④ late listing 종목 상장 시점 합류 안내 배너 노출: 후발 상장 종목 포함 시 상장 시점부터 수익률 시작 안내 배너 노출", () => {
    const basket = [
      createMockEtf("BASE", "기존 종목"),
      createMockEtf("LATE", "후발 종목"),
    ];

    // Requested period is 1M (60 days in test).
    // LATE listed at day 40 (has 20 days >= 2)
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

    // Late listing coverage banner must be visible
    const banner = screen.getByTestId("partial-coverage-banner");
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain("상장 시점부터 수익률 곡선이 시작됩니다");
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

  // ⑥ 모바일 제스처 최적화 touch-action: pan-y
  it("⑥ 모바일 제스처 최적화: SVG 및 컨테이너에 touchAction 'pan-y'가 적용되어 모바일 세로 스크롤을 방해하지 않는다", () => {
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

    const svg = screen.getByTestId("compare-timeseries-svg");
    expect(svg).toBeInTheDocument();
    expect(svg.style.touchAction).toBe("pan-y");
  });

  // ⑦ 격리 종목 안내 배너 렌더 검증
  it("⑦ 격리 종목 안내: quarantinedMap에 등재된 종목이 있을 때 경고 배너가 표시된다", () => {
    const basket = [
      createMockEtf("069500", "KODEX 200"),
      createMockEtf("122630", "KODEX 레버리지"),
    ];
    const seriesMap: Record<string, SeriesV2Data> = {
      "122630": createMockSeries("122630", dates60, 10000, 50),
    };
    const quarantinedMap = {
      "069500": { reason: "unadjusted_corporate_action" },
    };

    render(
      <EtfCompareTimeseriesChart
        basket={basket}
        period="1M"
        seriesMap={seriesMap}
        quarantinedMap={quarantinedMap}
      />
    );

    const banner = screen.getByTestId("quarantined-ticker-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("069500");
    expect(banner.textContent).toContain("일시 격리되었습니다");
  });

  // ⑧ 레버리지/인버스 경고 배너 및 축 정의 뱃지 검증
  it("⑧ 레버리지/인버스 경고 및 축 정의 뱃지: 레버리지 종목 포함 시 음의 복리 경고가 표시되고 TR/PR 축 뱃지가 표시된다", () => {
    const basket = [createMockEtf("122630", "KODEX 레버리지")];
    const seriesMap: Record<string, SeriesV2Data> = {
      "122630": createMockSeries("122630", dates60, 10000, 50),
    };

    render(
      <EtfCompareTimeseriesChart
        basket={basket}
        isTrMode={true}
        period="1M"
        seriesMap={seriesMap}
      />
    );

    const warning = screen.getByTestId("leverage-inverse-warning");
    expect(warning).toBeInTheDocument();
    expect(warning.textContent).toContain("음의 복리");

    expect(screen.getByText(/\[TR\] 분배금 재투자 수정기준가 기준/)).toBeInTheDocument();
  });

  // ⑨ 내부 결측(gapped) 안내 배너 검증
  it("⑨ 내부 결측(gapped) 안내: 한 종목에 거래정지 결측(6일 이상)이 포함되어 LOCF 보정된 경우 안내 배너가 표시된다", () => {
    const basket = [
      createMockEtf("AAA", "종목 A"),
      createMockEtf("BBB", "종목 B"),
    ];
    // BBB has 7 days gap within the active 1M window (indices 40 to 47)
    const datesB = dates60.filter((_, i) => i < 40 || i > 47);
    const seriesMap: Record<string, SeriesV2Data> = {
      AAA: createMockSeries("AAA", dates60, 10000, 50),
      BBB: createMockSeries("BBB", datesB, 10000, 50),
    };

    render(
      <EtfCompareTimeseriesChart
        basket={basket}
        period="1M"
        seriesMap={seriesMap}
      />
    );

    const notice = screen.getByTestId("gapped-series-notice");
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toContain("거래정지/결측 구간");
  });

  // ⑩ 이미지 저장 시 초슬림 1줄 워터마크 및 웹 화면 각주 분리 검증 (Option 1)
  it("⑩ 초슬림 1줄 워터마크 및 이미지 저장: 웹 화면에는 법정 면책 각주가 노출되고, 워터마크는 1줄 규격으로 구성되며 캡처 시 액션 버튼은 제외된다", () => {
    const basket = [createMockEtf("069500", "KODEX 200")];
    const seriesMap: Record<string, SeriesV2Data> = {
      "069500": createMockSeries("069500", dates60, 10000, 50),
    };

    render(
      <EtfCompareTimeseriesChart
        basket={basket}
        period="1Y"
        seriesMap={seriesMap}
      />
    );

    // 1. 웹 화면 전용 자본시장법 법정 면책 각주 확인 및 data-export-ignore="true" 지정 확인
    const disclaimers = screen.getByTestId("compare-chart-web-disclaimers");
    expect(disclaimers).toBeInTheDocument();
    expect(disclaimers).toHaveAttribute("data-export-ignore", "true");
    expect(disclaimers.textContent).toContain("본 자료는 투자 판단을 돕기 위한 정보 제공용이며");

    // 2. 이미지 저장용 초슬림 1줄 워터마크 확인 (최소 면책 + 브랜드 URL)
    const watermark = screen.getByTestId("compare-chart-official-footer");
    expect(watermark).toBeInTheDocument();
    expect(watermark.textContent).toContain("본 자료는 투자 참고용이며, 투자 권유를 목적으로 하지 않습니다.");
    expect(watermark.textContent).toContain("ETF 캠퍼스 etf-campus.pages.dev");

    // 3. 이미지 저장 버튼에 data-export-ignore="true" 지정 확인 (캡처 시 액션 버튼 제외)
    const exportBtn = screen.getByTestId("chart-export-button");
    expect(exportBtn).toHaveAttribute("data-export-ignore", "true");
  });
});

