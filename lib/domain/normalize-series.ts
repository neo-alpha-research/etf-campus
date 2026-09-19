/**
 * Pure normalization and alignment engine for multi-ETF timeseries compare charts.
 * Adheres strictly to Zero-Hallucination and financial alignment rules:
 * - Union calendar (outer join) across displayed tickers
 * - Single common anchor date (first trading day all displayed series have real values)
 * - LOCF (Last Observation Carried Forward) with strict boundary guards:
 *     * No fill before anchor (value: null)
 *     * No fill after last real observation (value: null)
 *     * Continuous gap > 5 days flagged as isFilled: true across the entire gap
 * - Late listing pushes anchorDate; <20 trading days marked as insufficient
 * - Truncation > 50% flagged as partial coverage
 * - Data floor clamped to 2023-01-02
 * - MDD (Maximum Drawdown) calculated within selected period
 */

export type SeriesInput = {
  ticker: string;
  dates: string[];
  values: number[];
  filled?: number[];
};

export type NormalizedPoint = {
  date: string;
  value: number | null;
  isFilled: boolean;
};

export type NormalizedSeries = {
  ticker: string;
  points: NormalizedPoint[];
  terminalReturn: number | null;
  anchorDate: string;
  maxDrawdown: number; // 음수 %, 선택 기간 내
  coverage: "ok" | "insufficient" | "gapped";
};

export type TruncatedReason = {
  ticker: string;
  reason: "late_listing" | "data_floor";
};

export const DATA_FLOOR = "2023-01-02";

export type NormalizeOptions = {
  mode?: "staggered" | "common_anchor";
  minTradingDays?: number;
};

export function normalizeMulti(
  inputs: SeriesInput[],
  from: string,
  to: string,
  options?: NormalizeOptions
): {
  series: NormalizedSeries[];
  anchorDate: string;
  truncated: TruncatedReason[];
} {
  const mode = options?.mode ?? "staggered";
  const minTradingDays = options?.minTradingDays ?? (mode === "staggered" ? 2 : 20);
  const truncated: TruncatedReason[] = [];

  // 1. Data floor clamp (Rule 6)
  let clampedFrom = from;
  if (from < DATA_FLOOR) {
    clampedFrom = DATA_FLOOR;
    for (const inp of inputs) {
      truncated.push({ ticker: inp.ticker, reason: "data_floor" });
    }
  }

  // Quick exit if no inputs
  if (!inputs || inputs.length === 0) {
    return { series: [], anchorDate: "", truncated };
  }

  // 2. Filter input points per ticker within [clampedFrom, to] and index by date
  type ParsedTicker = {
    ticker: string;
    input: SeriesInput;
    dateMap: Map<string, { value: number; isRawFilled: boolean }>;
    allInRangeDates: string[];
    earliestInRangeDate: string | null;
    lastInRangeDate: string | null;
    isInsufficient: boolean;
  };

  const parsedList: ParsedTicker[] = inputs.map((inp) => {
    const dateMap = new Map<string, { value: number; isRawFilled: boolean }>();
    const inRangeDates: string[] = [];
    const filledSet = new Set(inp.filled ?? []);

    for (let i = 0; i < inp.dates.length; i++) {
      const d = inp.dates[i];
      const v = inp.values[i];
      if (d >= clampedFrom && d <= to) {
        inRangeDates.push(d);
        dateMap.set(d, {
          value: v,
          isRawFilled: filledSet.has(i),
        });
      }
    }

    inRangeDates.sort();
    const earliest = inRangeDates.length > 0 ? inRangeDates[0] : null;
    const last = inRangeDates.length > 0 ? inRangeDates[inRangeDates.length - 1] : null;

    return {
      ticker: inp.ticker,
      input: inp,
      dateMap,
      allInRangeDates: inRangeDates,
      earliestInRangeDate: earliest,
      lastInRangeDate: last,
      isInsufficient: inRangeDates.length === 0,
    };
  });

  // 3. Screen for candidate tickers with late listing and trading days below threshold
  for (const item of parsedList) {
    if (item.isInsufficient) continue;

    if (item.allInRangeDates.length < minTradingDays) {
      item.isInsufficient = true;
    }
  }

  // 4. Candidate tickers for union calendar
  const candidateTickers = parsedList.filter((p) => !p.isInsufficient);

  if (candidateTickers.length === 0) {
    // All insufficient
    const series: NormalizedSeries[] = parsedList.map((p) => ({
      ticker: p.ticker,
      points: [],
      terminalReturn: null,
      anchorDate: "",
      maxDrawdown: 0,
      coverage: "insufficient",
    }));
    return { series, anchorDate: "", truncated };
  }

  // 5. Build Union Calendar across all candidate tickers (Rule 1)
  const unionDateSet = new Set<string>();
  for (const item of candidateTickers) {
    for (const d of item.allInRangeDates) {
      unionDateSet.add(d);
    }
  }
  const unionDates = Array.from(unionDateSet).sort();

  // 6. Anchor calculation
  let commonAnchorDate: string | null = null;

  if (mode === "common_anchor") {
    // Legacy common anchor: the first trading day in unionDates where ALL candidate tickers have an actual positive value
    for (const d of unionDates) {
      const allHaveActual = candidateTickers.every((item) => {
        const entry = item.dateMap.get(d);
        return entry !== undefined;
      });

      if (allHaveActual) {
        commonAnchorDate = d;
        break;
      }
    }

    if (!commonAnchorDate) {
      const series: NormalizedSeries[] = parsedList.map((p) => ({
        ticker: p.ticker,
        points: [],
        terminalReturn: null,
        anchorDate: "",
        maxDrawdown: 0,
        coverage: "insufficient",
      }));
      return { series, anchorDate: "", truncated };
    }

    for (const item of candidateTickers) {
      if (item.earliestInRangeDate && item.earliestInRangeDate > clampedFrom) {
        truncated.push({ ticker: item.ticker, reason: "late_listing" });
      }
    }
  } else {
    // Staggered Inception mode: The overall calendar starts at the earliest available union date
    commonAnchorDate = unionDates[0] || clampedFrom;

    for (const item of candidateTickers) {
      if (item.earliestInRangeDate && item.earliestInRangeDate > clampedFrom) {
        truncated.push({ ticker: item.ticker, reason: "late_listing" });
      }
    }
  }

  const activeUnionDates = mode === "common_anchor" 
    ? unionDates.filter((d) => d >= commonAnchorDate!)
    : unionDates;

  // 7. Generate Normalized Series for each ticker
  const series: NormalizedSeries[] = parsedList.map((item) => {
    if (item.isInsufficient) {
      return {
        ticker: item.ticker,
        points: [],
        terminalReturn: null,
        anchorDate: "",
        maxDrawdown: 0,
        coverage: "insufficient",
      };
    }

    const tickerAnchorDate = mode === "common_anchor" ? commonAnchorDate! : item.earliestInRangeDate!;
    const anchorEntry = item.dateMap.get(tickerAnchorDate);
    if (!anchorEntry || anchorEntry.value <= 0) {
      // Anchor value <= 0 or missing (Rule 3)
      return {
        ticker: item.ticker,
        points: [],
        terminalReturn: null,
        anchorDate: "",
        maxDrawdown: 0,
        coverage: "insufficient",
      };
    }

    const anchorValue = anchorEntry.value;
    const tickerLastActualDate = item.lastInRangeDate ?? "";

    // First pass: identify missing gaps and values
    type TempPoint = {
      date: string;
      value: number | null;
      isRawMissing: boolean;
      rawFilled: boolean;
    };

    const tempPoints: TempPoint[] = [];
    let lastKnownVal = anchorValue;

    for (const d of activeUnionDates) {
      if (d < tickerAnchorDate) {
        // Before listing date -> value: null (staggered inception)
        tempPoints.push({
          date: d,
          value: null,
          isRawMissing: false,
          rawFilled: false,
        });
      } else if (d > tickerLastActualDate) {
        // After last real date -> value: null (Rule 4.2)
        tempPoints.push({
          date: d,
          value: null,
          isRawMissing: false,
          rawFilled: false,
        });
      } else {
        const entry = item.dateMap.get(d);
        if (entry !== undefined) {
          lastKnownVal = entry.value;
          tempPoints.push({
            date: d,
            value: entry.value,
            isRawMissing: false,
            rawFilled: entry.isRawFilled,
          });
        } else {
          // Missing day -> LOCF (Rule 4)
          tempPoints.push({
            date: d,
            value: lastKnownVal,
            isRawMissing: true,
            rawFilled: false,
          });
        }
      }
    }

    // Second pass: continuous fill tracking
    // Continuous gap > 5 days flagged as isFilled: true across the entire gap (Rule 4.3)
    const points: NormalizedPoint[] = [];

    // Find contiguous runs of isRawMissing
    let i = 0;
    while (i < tempPoints.length) {
      if (tempPoints[i].isRawMissing) {
        let j = i;
        while (j < tempPoints.length && tempPoints[j].isRawMissing) {
          j++;
        }
        const gapLen = j - i;
        const markFilled = gapLen > 5;

        for (let k = i; k < j; k++) {
          const tp = tempPoints[k];
          const normVal =
            tp.value !== null
              ? Math.round(((tp.value / anchorValue - 1) * 100) * 100) / 100
              : null;
          points.push({
            date: tp.date,
            value: normVal,
            isFilled: markFilled || tp.rawFilled,
          });
        }
        i = j;
      } else {
        const tp = tempPoints[i];
        const normVal =
          tp.value !== null
            ? Math.round(((tp.value / anchorValue - 1) * 100) * 100) / 100
            : null;
        points.push({
          date: tp.date,
          value: normVal,
          isFilled: tp.rawFilled,
        });
        i++;
      }
    }

    // Calculate terminal return (last non-null normalized value)
    let terminalReturn: number | null = null;
    for (let idx = points.length - 1; idx >= 0; idx--) {
      if (points[idx].value !== null) {
        terminalReturn = points[idx].value;
        break;
      }
    }

    // Calculate MDD (Rule 7)
    let peak = -Infinity;
    let maxDrawdown = 0;

    for (const pt of points) {
      if (pt.value !== null) {
        const growthFactor = 1 + pt.value / 100;
        if (growthFactor > peak) {
          peak = growthFactor;
        }
        if (peak > 0) {
          const dd = ((growthFactor - peak) / peak) * 100;
          if (dd < maxDrawdown) {
            maxDrawdown = dd;
          }
        }
      }
    }

    const hasInternalGap = points.some((pt) => pt.isFilled);
    const coverage: "ok" | "insufficient" | "gapped" = hasInternalGap
      ? "gapped"
      : "ok";

    return {
      ticker: item.ticker,
      points,
      terminalReturn,
      anchorDate: tickerAnchorDate,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      coverage,
    };
  });

  return {
    series,
    anchorDate: commonAnchorDate,
    truncated,
  };
}
