import { describe, it, expect } from "vitest";
import { normalizeMulti, SeriesInput, DATA_FLOOR } from "../normalize-series";

describe("normalizeMulti - Normalization and Alignment Engine", () => {
  // Helper to generate N daily dates starting from a given date
  function makeDates(startDate: string, count: number): string[] {
    const dates: string[] = [];
    const d = new Date(startDate);
    while (dates.length < count) {
      // skip weekends for realism (optional, but keep simple ISO dates)
      const iso = d.toISOString().slice(0, 10);
      dates.push(iso);
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }

  // ① 동일 길이 2종목 정상
  it("① 동일 길이 2종목 정상: 공통 앵커일과 정규화 수익률 정상 계산", () => {
    const dates = makeDates("2024-01-01", 30);
    const inputA: SeriesInput = {
      ticker: "AAA",
      dates,
      values: dates.map((_, i) => 10000 + i * 100), // 10000 -> 12900 (+29%)
    };
    const inputB: SeriesInput = {
      ticker: "BBB",
      dates,
      values: dates.map((_, i) => 20000 + i * 200), // 20000 -> 25800 (+29%)
    };

    const res = normalizeMulti([inputA, inputB], dates[0], dates[29]);
    expect(res.anchorDate).toBe(dates[0]);
    expect(res.series).toHaveLength(2);
    expect(res.series[0].coverage).toBe("ok");
    expect(res.series[1].coverage).toBe("ok");
    expect(res.series[0].points[0].value).toBe(0);
    expect(res.series[0].terminalReturn).toBe(29);
    expect(res.series[1].points[0].value).toBe(0);
    expect(res.series[1].terminalReturn).toBe(29);
  });

  // ② 한 종목 중간 결측 → LOCF
  it("② 한 종목 중간 결측 → LOCF 직전 종가 전방 채움", () => {
    const dates = makeDates("2024-01-01", 30);
    // BBB is missing dates[5] and dates[6] (2 days gap <= 5)
    const datesB = dates.filter((_, i) => i !== 5 && i !== 6);
    const valuesB = datesB.map((_, i) => 10000 + i * 100);

    const inputA: SeriesInput = {
      ticker: "AAA",
      dates,
      values: dates.map((_, i) => 10000 + i * 50),
    };
    const inputB: SeriesInput = {
      ticker: "BBB",
      dates: datesB,
      values: valuesB,
    };

    const res = normalizeMulti([inputA, inputB], dates[0], dates[29]);
    const bPoints = res.series.find((s) => s.ticker === "BBB")!.points;

    // dates[4] is the day before gap
    const valAt4 = bPoints[4].value;
    expect(bPoints[5].date).toBe(dates[5]);
    expect(bPoints[5].value).toBe(valAt4); // carried forward!
    expect(bPoints[5].isFilled).toBe(false); // <= 5 days gap -> solid line
    expect(bPoints[6].value).toBe(valAt4);
    expect(bPoints[6].isFilled).toBe(false);
  });

  // ③ 마지막 데이터 이후 미연장
  it("③ 마지막 데이터 이후 미연장: 마지막 실제 데이터 이후는 value: null", () => {
    const dates = makeDates("2024-01-01", 30);
    // BBB trading stopped at index 19 (e.g. delisting or paused)
    const datesB = dates.slice(0, 20);
    const valuesB = datesB.map((_, i) => 10000 + i * 100);

    const inputA: SeriesInput = {
      ticker: "AAA",
      dates,
      values: dates.map((_, i) => 10000 + i * 50),
    };
    const inputB: SeriesInput = {
      ticker: "BBB",
      dates: datesB,
      values: valuesB,
    };

    const res = normalizeMulti([inputA, inputB], dates[0], dates[29]);
    const bPoints = res.series.find((s) => s.ticker === "BBB")!.points;

    expect(bPoints[19].value).not.toBeNull();
    // After index 19 (indices 20..29), value must be null (never extrapolated)
    for (let k = 20; k < 30; k++) {
      expect(bPoints[k].value).toBeNull();
    }
    // Terminal return should be the last non-null value
    expect(res.series.find((s) => s.ticker === "BBB")!.terminalReturn).toBe(bPoints[19].value);
  });

  // ④ 신규상장 → 순차 합류(Staggered Inception) 및 앵커 보존
  it("④ 신규상장 → 순차 합류: 후발 상장 종목이 있어도 전체 캘린더를 유지하며 상장일부터 0% 출발", () => {
    const dates = makeDates("2024-01-01", 50);
    // BBB listed on dates[10], has 40 days
    const datesB = dates.slice(10);
    const valuesB = datesB.map((_, i) => 20000 + i * 100);

    const inputA: SeriesInput = {
      ticker: "AAA",
      dates,
      values: dates.map((_, i) => 10000 + i * 50),
    };
    const inputB: SeriesInput = {
      ticker: "BBB",
      dates: datesB,
      values: valuesB,
    };

    // 1. Default Staggered Inception mode
    const res = normalizeMulti([inputA, inputB], dates[0], dates[49]);
    expect(res.anchorDate).toBe(dates[0]); // 전체 요청 기간의 시작일 보존 (Zero-Truncation)
    expect(res.truncated).toEqual(
      expect.arrayContaining([{ ticker: "BBB", reason: "late_listing" }])
    );

    const aSeries = res.series.find((s) => s.ticker === "AAA")!;
    const bSeries = res.series.find((s) => s.ticker === "BBB")!;

    // AAA starts at day 0 with 0%
    expect(aSeries.points[0].value).toBe(0);

    // BBB has null before day 10, and starts at day 10 with 0%
    expect(bSeries.points[0].value).toBeNull();
    expect(bSeries.points[9].value).toBeNull();
    const bAnchorPt = bSeries.points.find((p) => p.date === dates[10]);
    expect(bAnchorPt?.value).toBe(0);
    expect(bSeries.anchorDate).toBe(dates[10]);

    // 2. Legacy common_anchor mode
    const resLegacy = normalizeMulti([inputA, inputB], dates[0], dates[49], { mode: "common_anchor" });
    expect(resLegacy.anchorDate).toBe(dates[10]);
  });

  // ⑤ 가용 기간 최대 활용: 2영업일 이상이면 포함하고 2일 미만만 insufficient 제외
  it("⑤ 가용 기간 최대 활용: 10거래일 신규 종목도 정상 포함되고, 2영업일 미만만 insufficient 제외", () => {
    const dates = makeDates("2024-01-01", 40);
    // CCC listed on dates[30], has 10 trading days
    const datesC = dates.slice(30);
    const valuesC = datesC.map((_, i) => 10000 + i * 10);

    // DDD only has 1 trading day (< 2)
    const datesD = dates.slice(39);
    const valuesD = [10000];

    const inputA: SeriesInput = {
      ticker: "AAA",
      dates,
      values: dates.map((_, i) => 10000 + i * 50),
    };
    const inputC: SeriesInput = {
      ticker: "CCC",
      dates: datesC,
      values: valuesC,
    };
    const inputD: SeriesInput = {
      ticker: "DDD",
      dates: datesD,
      values: valuesD,
    };

    // Staggered mode: CCC (10 days) should be OK and included from its listing date
    const res = normalizeMulti([inputA, inputC, inputD], dates[0], dates[39]);
    const cSeries = res.series.find((s) => s.ticker === "CCC")!;
    expect(cSeries.coverage).toBe("ok");
    expect(cSeries.points.filter((p) => p.value !== null)).toHaveLength(10);
    expect(cSeries.points.find((p) => p.date === dates[30])?.value).toBe(0);

    // DDD (1 day) is truly insufficient (< 2 days)
    const dSeries = res.series.find((s) => s.ticker === "DDD")!;
    expect(dSeries.coverage).toBe("insufficient");
    expect(dSeries.points).toHaveLength(0);

    // Legacy mode: CCC (< 20 days) is insufficient
    const resLegacy = normalizeMulti([inputA, inputC], dates[0], dates[39], { mode: "common_anchor" });
    const cLegacy = resLegacy.series.find((s) => s.ticker === "CCC")!;
    expect(cLegacy.coverage).toBe("insufficient");
  });

  // ⑥ 2023-01-02 클램프
  it("⑥ 2023-01-02 클램프: 2023-01-02 이전 요청 시작일은 클램프되고 data_floor 기록", () => {
    const dates = makeDates("2023-01-02", 30);
    const inputA: SeriesInput = {
      ticker: "AAA",
      dates,
      values: dates.map((_, i) => 10000 + i * 100),
    };

    const res = normalizeMulti([inputA], "2022-06-01", "2023-01-31");
    expect(res.anchorDate).toBe(DATA_FLOOR);
    expect(res.truncated).toEqual(
      expect.arrayContaining([{ ticker: "AAA", reason: "data_floor" }])
    );
  });

  // ⑦ 앵커 값 0/음수 → insufficient
  it("⑦ 앵커 값 0/음수 → insufficient: 앵커 값이 0 이하이면 insufficient로 제외", () => {
    const dates = makeDates("2024-01-01", 30);
    const inputZero: SeriesInput = {
      ticker: "ZERO",
      dates,
      values: dates.map((_, i) => (i === 0 ? 0 : 10000 + i * 100)),
    };
    const inputNormal: SeriesInput = {
      ticker: "NORM",
      dates,
      values: dates.map((_, i) => 20000 + i * 100),
    };

    const res = normalizeMulti([inputZero, inputNormal], dates[0], dates[29]);
    const zeroSeries = res.series.find((s) => s.ticker === "ZERO")!;
    expect(zeroSeries.coverage).toBe("insufficient");
    expect(zeroSeries.points).toHaveLength(0);
  });

  // ⑧ 5일 초과 연속 채움 → 구간 전체 filled
  it("⑧ 5일 초과 연속 채움 → 구간 전체 filled: 6거래일 연속 결측 시 6거래일 전체가 isFilled: true", () => {
    const dates = makeDates("2024-01-01", 30);
    // BBB is missing dates[5] through dates[10] (6 days > 5)
    const datesB = dates.filter((_, i) => i < 5 || i > 10);
    const valuesB = datesB.map((_, i) => 10000 + i * 100);

    const inputA: SeriesInput = {
      ticker: "AAA",
      dates,
      values: dates.map((_, i) => 10000 + i * 50),
    };
    const inputB: SeriesInput = {
      ticker: "BBB",
      dates: datesB,
      values: valuesB,
    };

    const res = normalizeMulti([inputA, inputB], dates[0], dates[29]);
    const bPoints = res.series.find((s) => s.ticker === "BBB")!.points;

    // All 6 days (indices 5, 6, 7, 8, 9, 10) must be isFilled: true
    for (let k = 5; k <= 10; k++) {
      expect(bPoints[k].isFilled).toBe(true);
      expect(bPoints[k].value).toBe(bPoints[4].value); // LOCF
    }
    // Normal days before and after should not be filled
    expect(bPoints[4].isFilled).toBe(false);
    expect(bPoints[11].isFilled).toBe(false);
  });

  // ⑨ MDD 계산값 검증
  it("⑨ MDD 계산값 검증: 피크 대비 최대 낙폭(음수 %) 정확히 계산", () => {
    const dates = makeDates("2024-01-01", 5);
    // Anchor=100 (0%), peak=120 (+20%), drop to 96 (-4%), recovery to 108 (+8%)
    // Peak factor: 1.20. Drop: (0.96 - 1.20) / 1.20 * 100 = -20.0%
    const input: SeriesInput = {
      ticker: "MDD_TEST",
      dates,
      values: [100, 120, 96, 108, 114],
    };

    const res = normalizeMulti([input], dates[0], dates[4]);
    expect(res.series[0].maxDrawdown).toBe(-20);
    expect(res.series[0].terminalReturn).toBe(14); // (114/100 - 1) * 100 = 14%
  });

  // ⑩ [Step 84 회귀 1] 겹침 충분: 20거래일 이상 및 내부 결측 없을 때 coverage: "ok"
  it("⑩ [Step 84 회귀 1] 겹침 충분: 20거래일 이상 및 내부 결측 없을 때 coverage: 'ok'", () => {
    const dates = makeDates("2024-03-01", 30);
    const inputA: SeriesInput = {
      ticker: "AAA",
      dates,
      values: dates.map((_, i) => 10000 + i * 50),
    };
    const inputB: SeriesInput = {
      ticker: "BBB",
      dates,
      values: dates.map((_, i) => 20000 + i * 100),
    };

    const res = normalizeMulti([inputA, inputB], dates[0], dates[29]);
    expect(res.series).toHaveLength(2);
    expect(res.series[0].coverage).toBe("ok");
    expect(res.series[1].coverage).toBe("ok");
  });

  // ⑪ [Step 84 회귀 2] 겹침 부족: common_anchor 모드에서 20일 미만 insufficient 및 staggered 모드에서 정상 포함
  it("⑪ [Step 84 회귀 2] 겹침 부족: common_anchor 모드에서 20일 미만 insufficient 및 staggered 모드에서 정상 포함", () => {
    const dates = makeDates("2024-03-01", 30);
    // BBB listed on day 15, only 15 trading days (< 20)
    const datesB = dates.slice(15);
    const inputA: SeriesInput = {
      ticker: "AAA",
      dates,
      values: dates.map((_, i) => 10000 + i * 50),
    };
    const inputB: SeriesInput = {
      ticker: "BBB",
      dates: datesB,
      values: datesB.map((_, i) => 20000 + i * 100),
    };

    // Staggered mode (default): 15 days is >= 2, so BBB is ok and has 15 non-null points
    const res = normalizeMulti([inputA, inputB], dates[0], dates[29]);
    const bSeries = res.series.find((s) => s.ticker === "BBB")!;
    expect(bSeries.coverage).toBe("ok");
    expect(bSeries.points.filter((p) => p.value !== null)).toHaveLength(15);

    // Common anchor mode: BBB (< 20 days) is insufficient
    const resLegacy = normalizeMulti([inputA, inputB], dates[0], dates[29], { mode: "common_anchor" });
    const bLegacy = resLegacy.series.find((s) => s.ticker === "BBB")!;
    expect(bLegacy.coverage).toBe("insufficient");
    expect(bLegacy.points).toHaveLength(0);
  });

  // ⑫ [Step 84 회귀 3] 겹침 내부 결측: 5거래일 초과 거래정지 결측 구간 존재 시 coverage: "gapped"
  it("⑫ [Step 84 회귀 3] 겹침 내부 결측: 5거래일 초과 거래정지 결측 구간 존재 시 coverage: 'gapped'", () => {
    const dates = makeDates("2024-03-01", 40);
    // BBB missing 7 trading days (index 10 to 16 inclusive)
    const datesB = dates.filter((_, i) => i < 10 || i > 16);
    const inputA: SeriesInput = {
      ticker: "AAA",
      dates,
      values: dates.map((_, i) => 10000 + i * 50),
    };
    const inputB: SeriesInput = {
      ticker: "BBB",
      dates: datesB,
      values: datesB.map((_, i) => 20000 + i * 100),
    };

    const res = normalizeMulti([inputA, inputB], dates[0], dates[39]);
    const aSeries = res.series.find((s) => s.ticker === "AAA")!;
    const bSeries = res.series.find((s) => s.ticker === "BBB")!;
    expect(aSeries.coverage).toBe("ok");
    expect(bSeries.coverage).toBe("gapped");
    expect(bSeries.points.some((p) => p.isFilled)).toBe(true);
  });

  // ⑬ [Step 84 회귀 4] 정규화 앵커 검증
  it("⑬ [Step 84 회귀 4] 정규화 앵커 검증: common_anchor 모드에서는 후발 상장일이 공통 앵커가 되고, staggered 모드에서는 전체 시작일이 앵커가 됨", () => {
    const dates = makeDates("2024-03-01", 50);
    // AAA listed on day 0, BBB listed on day 20 (30 days >= 20)
    const datesB = dates.slice(20);
    const inputA: SeriesInput = {
      ticker: "AAA",
      dates,
      values: dates.map((_, i) => 10000 + i * 50),
    };
    const inputB: SeriesInput = {
      ticker: "BBB",
      dates: datesB,
      values: datesB.map((_, i) => 20000 + i * 100),
    };

    // Staggered mode (default)
    const res = normalizeMulti([inputA, inputB], dates[0], dates[49]);
    expect(res.anchorDate).toBe(dates[0]);
    const aAnchorStaggered = res.series.find((s) => s.ticker === "AAA")!.points.find((p) => p.date === dates[0]);
    const bAnchorStaggered = res.series.find((s) => s.ticker === "BBB")!.points.find((p) => p.date === dates[20]);
    expect(aAnchorStaggered?.value).toBe(0);
    expect(bAnchorStaggered?.value).toBe(0);

    // Common anchor mode
    const resLegacy = normalizeMulti([inputA, inputB], dates[0], dates[49], { mode: "common_anchor" });
    expect(resLegacy.anchorDate).toBe(dates[20]); // First common trading day
    const aAnchor = resLegacy.series.find((s) => s.ticker === "AAA")!.points.find((p) => p.date === dates[20]);
    const bAnchor = resLegacy.series.find((s) => s.ticker === "BBB")!.points.find((p) => p.date === dates[20]);
    expect(aAnchor?.value).toBe(0);
    expect(bAnchor?.value).toBe(0);
  });
});
