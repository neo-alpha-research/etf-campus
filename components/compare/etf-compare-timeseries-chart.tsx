"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { type Etf } from "@/lib/domain/etf-types";
import { normalizeMulti, NormalizedSeries, SeriesInput } from "@/lib/domain/normalize-series";
import { Download, AlertCircle, Info } from "lucide-react";
import { toPng } from "html-to-image";

export type ComparePeriod = "1M" | "3M" | "6M" | "1Y" | "3Y";

export interface SeriesV2Data {
  ticker: string;
  startDate: string;
  dates: string[];
  close: number[];
  tr: number[];
  netTr: number[];
  hasDistribution: boolean;
  filled?: number[];
  asOf: string;
}

// 5 Distinct high-contrast colors (Light / Dark mode tokens)
export const CHART_PALETTE = [
  { stroke: "#2563eb", darkStroke: "#60a5fa", bg: "bg-blue-600", text: "text-blue-600" },      // Primary / Base
  { stroke: "#059669", darkStroke: "#34d399", bg: "bg-emerald-600", text: "text-emerald-600" }, // Deep Emerald
  { stroke: "#d97706", darkStroke: "#fbbf24", bg: "bg-amber-600", text: "text-amber-600" },     // Deep Amber
  { stroke: "#7c3aed", darkStroke: "#a78bfa", bg: "bg-purple-600", text: "text-purple-600" },   // Deep Violet
  { stroke: "#e11d48", darkStroke: "#fb7185", bg: "bg-rose-600", text: "text-rose-600" },       // Deep Rose
];

export const PERIOD_LABELS: { key: ComparePeriod; label: string }[] = [
  { key: "1M", label: "1개월" },
  { key: "3M", label: "3개월" },
  { key: "6M", label: "6개월" },
  { key: "1Y", label: "1년" },
  { key: "3Y", label: "3년" },
];

export function calculateStartDate(toDateStr: string, period: ComparePeriod): string {
  const d = new Date(toDateStr);
  if (isNaN(d.getTime())) return "2023-01-02";
  switch (period) {
    case "1M":
      d.setMonth(d.getMonth() - 1);
      break;
    case "3M":
      d.setMonth(d.getMonth() - 3);
      break;
    case "6M":
      d.setMonth(d.getMonth() - 6);
      break;
    case "1Y":
      d.setFullYear(d.getFullYear() - 1);
      break;
    case "3Y":
      d.setFullYear(d.getFullYear() - 3);
      break;
  }
  const iso = d.toISOString().slice(0, 10);
  return iso < "2023-01-02" ? "2023-01-02" : iso;
}

export interface EtfCompareTimeseriesChartProps {
  basket: readonly Etf[];
  isTrMode?: boolean;
  baseTicker?: string;
  period?: ComparePeriod;
  onPeriodChange?: (period: ComparePeriod) => void;
  seriesMap?: Record<string, SeriesV2Data | null>;
  isLoading?: boolean;
  onHoverTicker?: (ticker: string | null) => void;
  focusedTicker?: string | null;
}

export function EtfCompareTimeseriesChart({
  basket,
  isTrMode = false,
  baseTicker,
  period = "3M",
  onPeriodChange,
  seriesMap = {},
  isLoading = false,
  onHoverTicker,
  focusedTicker,
}: EtfCompareTimeseriesChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [internalFocusedTicker, setInternalFocusedTicker] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const activeFocus = focusedTicker ?? internalFocusedTicker;

  // 1. Prepare Inputs for Normalization Engine
  const { normalizedResult, activeDates, hasZeroDistEtfs } = useMemo(() => {
    // Find latest available asOf date among loaded series
    let latestDate = "2023-01-02";
    let zeroDist = false;

    const inputs: SeriesInput[] = [];

    for (const etf of basket) {
      const sData = seriesMap[etf.ticker];
      if (sData && sData.dates.length > 0) {
        if (sData.asOf > latestDate) {
          latestDate = sData.asOf;
        }
        if (sData.hasDistribution === false) {
          zeroDist = true;
        }
        const values = isTrMode ? sData.tr : sData.close;
        inputs.push({
          ticker: etf.ticker,
          dates: sData.dates,
          values,
          filled: sData.filled,
        });
      }
    }

    const fromDate = calculateStartDate(latestDate, period);
    const norm = normalizeMulti(inputs, fromDate, latestDate);

    // Common active dates across normalized points
    const dates =
      norm.series.find((s) => s.coverage !== "insufficient" && s.points.length > 0)?.points.map(
        (p) => p.date
      ) ?? [];

    return {
      normalizedResult: norm,
      activeDates: dates,
      hasZeroDistEtfs: zeroDist,
    };
  }, [basket, seriesMap, isTrMode, period]);

  // 2. SVG Geometry Specifications
  // Width: 1000px viewBox
  // Height: 244px (plot: 176px + xAxis: 24px + margins: 44px)
  // Horizontal: Left 8px, Plot 932px, Right gutter 60px
  const width = 1000;
  const height = 244;
  const plotLeft = 8;
  const plotRight = 940; // plot width: 932px
  const plotWidth = plotRight - plotLeft;
  const plotTop = 20;
  const plotBottom = 196; // plot height: 176px
  const plotHeight = plotBottom - plotTop;

  // 3. Min/Max Calculation and Y-Scale
  const { minVal, maxVal, validSeries } = useMemo(() => {
    const valid = normalizedResult.series.filter(
      (s) => s.coverage !== "insufficient" && s.points.length > 0
    );

    let min = 0;
    let max = 0;

    for (const s of valid) {
      for (const p of s.points) {
        if (p.value !== null) {
          if (p.value < min) min = p.value;
          if (p.value > max) max = p.value;
        }
      }
    }

    // Include 0% baseline and add 12% padding for breathing room
    const span = Math.max(max - min, 2);
    const paddedMin = min - span * 0.12;
    const paddedMax = max + span * 0.12;

    return {
      minVal: paddedMin,
      maxVal: paddedMax,
      validSeries: valid,
    };
  }, [normalizedResult]);

  const getY = useCallback(
    (val: number) => {
      const ratio = (val - minVal) / (maxVal - minVal);
      return plotBottom - ratio * plotHeight;
    },
    [minVal, maxVal, plotBottom, plotHeight]
  );

  const getX = useCallback(
    (index: number, total: number) => {
      if (total <= 1) return plotLeft;
      return plotLeft + (index / (total - 1)) * plotWidth;
    },
    [plotLeft, plotWidth]
  );

  const zeroBaselineY = useMemo(() => getY(0), [getY]);

  // 4. Deterministic 1D Badge Collision Avoidance Algorithm
  const badgePositions = useMemo(() => {
    const minGap = 18;
    const badgeTopLimit = plotTop + 8;
    const badgeBottomLimit = plotBottom - 6;

    interface RawBadge {
      ticker: string;
      color: string;
      idealY: number;
      actualY: number;
      finalX: number;
      terminalReturn: number | null;
    }

    const items: RawBadge[] = [];

    validSeries.forEach((s) => {
      const idx = basket.findIndex((b) => b.ticker === s.ticker);
      const color = CHART_PALETTE[idx >= 0 ? idx % CHART_PALETTE.length : 0].stroke;

      // Find last non-null point
      let lastPtIndex = -1;
      for (let i = s.points.length - 1; i >= 0; i--) {
        if (s.points[i].value !== null) {
          lastPtIndex = i;
          break;
        }
      }

      if (lastPtIndex >= 0 && s.terminalReturn !== null) {
        const idealY = getY(s.terminalReturn);
        const finalX = getX(lastPtIndex, activeDates.length);
        items.push({
          ticker: s.ticker,
          color,
          idealY,
          actualY: idealY,
          finalX,
          terminalReturn: s.terminalReturn,
        });
      }
    });

    // 1. Sort by idealY ascending
    items.sort((a, b) => a.idealY - b.idealY);

    // 2. Pass 1: Top-to-bottom push
    for (let i = 1; i < items.length; i++) {
      if (items[i].actualY < items[i - 1].actualY + minGap) {
        items[i].actualY = items[i - 1].actualY + minGap;
      }
    }

    // 3. Pass 2: Bottom-to-top push if exceeding bottom limit
    if (items.length > 0) {
      const lastIdx = items.length - 1;
      if (items[lastIdx].actualY > badgeBottomLimit) {
        items[lastIdx].actualY = badgeBottomLimit;
        for (let i = lastIdx - 1; i >= 0; i--) {
          if (items[i].actualY > items[i + 1].actualY - minGap) {
            items[i].actualY = items[i + 1].actualY - minGap;
          }
        }
      }
    }

    // 4. Pass 3: Clamp to top limit
    for (let i = 0; i < items.length; i++) {
      if (items[i].actualY < badgeTopLimit) {
        items[i].actualY = badgeTopLimit;
      }
    }

    // 5. Final downward pass to maintain minGap after top clamp
    for (let i = 1; i < items.length; i++) {
      if (items[i].actualY < items[i - 1].actualY + minGap) {
        items[i].actualY = items[i - 1].actualY + minGap;
      }
    }

    return items;
  }, [validSeries, basket, getY, getX, activeDates.length, plotTop, plotBottom]);

  // 5. Y-Axis Grid Lines (max 4 lines)
  const yGridLines = useMemo(() => {
    const lines: number[] = [];
    const step = (maxVal - minVal) / 4;
    for (let i = 1; i <= 3; i++) {
      const val = minVal + i * step;
      // Skip lines too close to 0% baseline
      if (Math.abs(val) > (maxVal - minVal) * 0.08) {
        lines.push(val);
      }
    }
    return lines;
  }, [minVal, maxVal]);

  // 6. X-Axis Tick Labels (Anchor, Mid, End)
  const xTicks = useMemo(() => {
    if (activeDates.length === 0) return [];
    const first = activeDates[0];
    const last = activeDates[activeDates.length - 1];
    const midIdx = Math.floor(activeDates.length / 2);
    const mid = activeDates[midIdx];

    const fmt = (d: string) => d.slice(2).replace(/-/g, ".");

    return [
      { label: fmt(first), x: plotLeft, anchor: "start" as const },
      { label: fmt(mid), x: getX(midIdx, activeDates.length), anchor: "middle" as const },
      { label: fmt(last), x: plotRight, anchor: "end" as const },
    ];
  }, [activeDates, plotLeft, plotRight, getX]);

  // 7. Interactive Pointer Movement
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || activeDates.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * width;

    if (svgX < plotLeft || svgX > plotRight) {
      setHoverIndex(null);
      return;
    }

    const ratio = (svgX - plotLeft) / plotWidth;
    const idx = Math.round(ratio * (activeDates.length - 1));
    const clampedIdx = Math.max(0, Math.min(activeDates.length - 1, idx));
    setHoverIndex(clampedIdx);
  };

  const handlePointerLeave = () => {
    setHoverIndex(null);
  };

  const handleDownload = useCallback(() => {
    setIsExporting(true);
    setTimeout(() => {
      if (chartContainerRef.current === null) {
        setIsExporting(false);
        return;
      }
      toPng(chartContainerRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      })
        .then((dataUrl) => {
          const link = document.createElement("a");
          const trSuffix = isTrMode ? "-tr" : "-pr";
          link.download = `etf-compare-timeseries-${period.toLowerCase()}${trSuffix}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.error("Failed to export chart image", err);
        })
        .finally(() => {
          setIsExporting(false);
        });
    }, 150);
  }, [period, isTrMode]);

  // Accessibility Summary Text
  const accessibleSummary = useMemo(() => {
    const basis = isTrMode ? "TR(세전)" : "시장가격(PR)";
    const parts = validSeries.map((s) => {
      const etf = basket.find((b) => b.ticker === s.ticker);
      const name = etf?.name ?? s.ticker;
      const ret = s.terminalReturn !== null ? `${s.terminalReturn > 0 ? "+" : ""}${s.terminalReturn.toFixed(1)}%` : "N/A";
      return `${name} ${ret}`;
    });
    return `비교 기간 ${period}, 기준 ${basis}, 종목별 누적수익률: ${parts.join(", ")}`;
  }, [validSeries, basket, isTrMode, period]);

  // Excluded tickers with insufficient coverage (< 20 trading days)
  const insufficientTickers = useMemo(() => {
    return normalizedResult.series
      .filter((s) => s.coverage === "insufficient")
      .map((s) => {
        const etf = basket.find((b) => b.ticker === s.ticker);
        return { ticker: s.ticker, name: etf?.name ?? s.ticker };
      });
  }, [normalizedResult, basket]);

  const isPartial = normalizedResult.series.some((s) => s.coverage === "partial");

  // Hovered Point Summary Data
  const hoveredSummary = useMemo(() => {
    if (hoverIndex === null || hoverIndex >= activeDates.length) return null;
    const date = activeDates[hoverIndex];
    const items = validSeries.map((s) => {
      const etf = basket.find((b) => b.ticker === s.ticker);
      const pt = s.points[hoverIndex];
      const idx = basket.findIndex((b) => b.ticker === s.ticker);
      const color = CHART_PALETTE[idx >= 0 ? idx % CHART_PALETTE.length : 0];
      return {
        ticker: s.ticker,
        name: etf?.name ?? s.ticker,
        value: pt?.value ?? null,
        isFilled: pt?.isFilled ?? false,
        color,
      };
    });
    return { date, items };
  }, [hoverIndex, activeDates, validSeries, basket]);

  return (
    <div
      ref={chartContainerRef}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 transition-colors"
      style={{ touchAction: "pan-y" }}
      data-testid="compare-timeseries-chart-container"
    >
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {/* Period Selector Segmented Control */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto no-scrollbar">
          {PERIOD_LABELS.map(({ key, label }) => {
            const isSelected = period === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPeriodChange?.(key)}
                className={`min-w-[44px] min-h-[32px] px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  isSelected
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                data-testid={`period-button-${key}`}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Right Tools (PNG Export) */}
        <div className="flex items-center gap-2">
          {hasZeroDistEtfs && isTrMode && (
            <span className="hidden md:inline-flex items-center text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              분배 이력 없는 종목 포함 (시장가격과 동일)
            </span>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            title="차트 이미지 저장"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            data-testid="chart-export-button"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Warning Banners */}
      {isPartial && (
        <div
          className="flex items-center gap-1.5 p-2 mb-2 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg"
          data-testid="partial-coverage-banner"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>선택하신 종목 중 최근 상장된 종목으로 인해 비교 시작일이 자동 축소되었습니다.</span>
        </div>
      )}

      {insufficientTickers.length > 0 && (
        <div
          className="flex items-center gap-1.5 p-2 mb-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg"
          data-testid="insufficient-coverage-banner"
        >
          <Info className="w-4 h-4 shrink-0 text-slate-500" />
          <span>
            {insufficientTickers.map((t) => t.name).join(", ")} 종목은 거래일수 부족(20일 미만)으로 시계열 비교에서 제외되었습니다.
          </span>
        </div>
      )}

      {/* 3. Top Crosshair Fixed Summary Strip (no floating popover overlay) */}
      <div
        className="h-7 px-2 mb-1.5 flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 rounded-md overflow-x-auto no-scrollbar font-tabular-nums"
        data-testid="top-summary-strip"
      >
        {hoveredSummary ? (
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {hoveredSummary.date}
            </span>
            <div className="flex items-center gap-2.5">
              {hoveredSummary.items.map((it) => (
                <div key={it.ticker} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: it.color.stroke }}
                  />
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 max-w-[80px] truncate">
                    {it.name}
                  </span>
                  <span
                    className={`font-bold text-[11px] ${
                      it.value !== null && it.value > 0
                        ? "text-red-600 dark:text-red-400"
                        : it.value !== null && it.value < 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {it.value !== null ? `${it.value > 0 ? "+" : ""}${it.value.toFixed(1)}%` : "N/A"}
                  </span>
                  {it.isFilled && (
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">(직전종가)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
            <span>누적수익률 기준</span>
            <span>·</span>
            <span>선택 기간: {period} ({isTrMode ? "TR 세전 재투자" : "시장가격 PR"})</span>
          </div>
        )}
      </div>

      {/* 4. Main SVG Timeseries Canvas */}
      {isLoading ? (
        <div
          className="w-full h-[244px] flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/30 rounded-lg animate-pulse"
          data-testid="chart-skeleton"
        >
          <div className="text-xs text-slate-400">데이터 로딩 중...</div>
        </div>
      ) : validSeries.length === 0 ? (
        <div
          className="w-full h-[244px] flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/30 rounded-lg"
          data-testid="chart-empty"
        >
          <div className="text-xs text-slate-400">비교 가능한 시계열 데이터가 없습니다.</div>
        </div>
      ) : (
        <div className="relative w-full">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto select-none overflow-visible"
            role="img"
            aria-label={accessibleSummary}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            data-testid="compare-timeseries-svg"
          >
            {/* Background grids */}
            {yGridLines.map((yVal, idx) => (
              <line
                key={`grid-${idx}`}
                x1={plotLeft}
                y1={getY(yVal)}
                x2={plotRight}
                y2={getY(yVal)}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
                className="dark:stroke-slate-800"
              />
            ))}

            {/* 0% Baseline */}
            <line
              x1={plotLeft}
              y1={zeroBaselineY}
              x2={plotRight}
              y2={zeroBaselineY}
              stroke="#94a3b8"
              strokeWidth={1}
              className="dark:stroke-slate-600"
            />
            <text
              x={plotLeft + 4}
              y={zeroBaselineY - 4}
              fontSize={10}
              fontWeight={600}
              fill="#94a3b8"
              className="dark:fill-slate-500"
            >
              0.0%
            </text>

            {/* X-Axis Ticks */}
            {xTicks.map((tick, idx) => (
              <text
                key={`xtick-${idx}`}
                x={tick.x}
                y={plotBottom + 18}
                textAnchor={tick.anchor}
                fontSize={11}
                fill="#64748b"
                className="dark:fill-slate-400 font-medium"
              >
                {tick.label}
              </text>
            ))}

            {/* Crosshair vertical cursor line */}
            {hoverIndex !== null && hoverIndex < activeDates.length && (
              <line
                x1={getX(hoverIndex, activeDates.length)}
                y1={plotTop}
                x2={getX(hoverIndex, activeDates.length)}
                y2={plotBottom}
                stroke="#64748b"
                strokeWidth={1}
                strokeDasharray="2 2"
                className="dark:stroke-slate-400"
              />
            )}

            {/* ETF Series Line Paths */}
            {validSeries.map((s) => {
              const idx = basket.findIndex((b) => b.ticker === s.ticker);
              const palette = CHART_PALETTE[idx >= 0 ? idx % CHART_PALETTE.length : 0];
              const isBase = s.ticker === baseTicker;
              const isCurrentFocused = activeFocus === s.ticker;
              const hasAnyFocus = activeFocus !== null;

              const strokeColor = palette.stroke;
              const strokeWidth = isCurrentFocused ? 2.5 : isBase ? 2.25 : 1.75;
              const opacity = hasAnyFocus ? (isCurrentFocused ? 1.0 : 0.25) : 1.0;

              // Build continuous multi-segment paths splitting by isFilled
              type Segment = { isFilled: boolean; points: { x: number; y: number }[] };
              const segments: Segment[] = [];
              let currentSegment: Segment | null = null;

              for (let i = 0; i < s.points.length; i++) {
                const pt = s.points[i];
                if (pt.value === null) {
                  currentSegment = null;
                  continue;
                }
                const x = getX(i, activeDates.length);
                const y = getY(pt.value);

                if (!currentSegment || currentSegment.isFilled !== pt.isFilled) {
                  // Connect with last point if transitioning to avoid gap
                  const prevPt = currentSegment && currentSegment.points.length > 0
                    ? currentSegment.points[currentSegment.points.length - 1]
                    : null;
                  currentSegment = {
                    isFilled: pt.isFilled,
                    points: prevPt ? [prevPt, { x, y }] : [{ x, y }],
                  };
                  segments.push(currentSegment);
                } else {
                  currentSegment.points.push({ x, y });
                }
              }

              return (
                <g
                  key={`series-${s.ticker}`}
                  opacity={opacity}
                  style={{ transition: "opacity 150ms ease" }}
                  onMouseEnter={() => {
                    setInternalFocusedTicker(s.ticker);
                    onHoverTicker?.(s.ticker);
                  }}
                  onMouseLeave={() => {
                    setInternalFocusedTicker(null);
                    onHoverTicker?.(null);
                  }}
                  data-testid={`series-group-${s.ticker}`}
                >
                  {segments.map((seg, sIdx) => {
                    if (seg.points.length < 2) return null;
                    const d = seg.points.reduce((acc, p, pIdx) => {
                      return `${acc} ${pIdx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                    }, "");
                    return (
                      <path
                        key={`path-${sIdx}`}
                        d={d}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={seg.isFilled ? "3 3" : undefined}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        style={{ vectorEffect: "non-scaling-stroke" }}
                      />
                    );
                  })}

                  {/* Hover indicator dot */}
                  {hoverIndex !== null && s.points[hoverIndex]?.value !== null && (
                    <circle
                      cx={getX(hoverIndex, activeDates.length)}
                      cy={getY(s.points[hoverIndex].value!)}
                      r={isCurrentFocused ? 4.5 : 3.5}
                      fill="#ffffff"
                      stroke={strokeColor}
                      strokeWidth={2}
                    />
                  )}
                </g>
              );
            })}

            {/* Right Gutter Terminal Badges & Leader Lines */}
            {badgePositions.map((b) => {
              const isFocused = activeFocus === b.ticker;
              const displacement = Math.abs(b.actualY - b.idealY);
              const retText =
                b.terminalReturn !== null
                  ? `${b.terminalReturn > 0 ? "+" : ""}${b.terminalReturn.toFixed(1)}%`
                  : "";

              return (
                <g
                  key={`badge-${b.ticker}`}
                  data-testid={`badge-${b.ticker}`}
                  onMouseEnter={() => {
                    setInternalFocusedTicker(b.ticker);
                    onHoverTicker?.(b.ticker);
                  }}
                  onMouseLeave={() => {
                    setInternalFocusedTicker(null);
                    onHoverTicker?.(null);
                  }}
                  className="cursor-pointer"
                >
                  {/* Leader line if displaced > 4px */}
                  {displacement > 4 && (
                    <line
                      x1={b.finalX}
                      y1={b.idealY}
                      x2={plotRight + 4}
                      y2={b.actualY}
                      stroke={b.color}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                      opacity={0.6}
                      data-testid={`leader-line-${b.ticker}`}
                    />
                  )}

                  {/* Terminal badge background & text */}
                  <rect
                    x={plotRight + 4}
                    y={b.actualY - 8}
                    width={52}
                    height={16}
                    rx={3}
                    fill={b.color}
                    opacity={isFocused ? 1.0 : 0.9}
                  />
                  <text
                    x={plotRight + 30}
                    y={b.actualY + 3.5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={10}
                    fontWeight={700}
                    className="font-tabular-nums"
                  >
                    {retText}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hidden Accessible Table for Screen Readers */}
          <table className="sr-only">
            <caption>{accessibleSummary}</caption>
            <thead>
              <tr>
                <th scope="col">종목코드</th>
                <th scope="col">종목명</th>
                <th scope="col">최종 수익률</th>
                <th scope="col">최대 낙폭(MDD)</th>
              </tr>
            </thead>
            <tbody>
              {validSeries.map((s) => {
                const etf = basket.find((b) => b.ticker === s.ticker);
                return (
                  <tr key={`sr-${s.ticker}`}>
                    <td>{s.ticker}</td>
                    <td>{etf?.name ?? s.ticker}</td>
                    <td>{s.terminalReturn !== null ? `${s.terminalReturn.toFixed(1)}%` : "N/A"}</td>
                    <td>{`${s.maxDrawdown.toFixed(1)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Static Legal Disclaimers (자본시장법 제101조 및 금융 컴플라이언스 3종 상시 각주) */}
      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 font-normal">
        <p>• 분배금은 분배락일 종가로 재투자했다고 가정한 이론 수치이며, 실제 지급일·재투자 시점·거래비용은 반영하지 않았습니다.</p>
        <p>• 세금은 반영하지 않은 세전 기준입니다. 계좌 유형에 따라 실제 세후 수익률은 달라집니다.</p>
        <p>• 과거 성과가 미래 수익을 보장하지 않습니다.</p>
      </div>
    </div>
  );
}
