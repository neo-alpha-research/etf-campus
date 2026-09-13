"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { type Etf, type ReturnPeriod, RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import { formatReturn } from "@/lib/domain/etf-format";
import { Download } from "lucide-react";
import { toPng } from "html-to-image";

const COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#a855f7", // purple-500
  "#f43f5e", // rose-500
];

export type ChartType = "ranking" | "grouped";
type ViewMode = "short" | "long";

const RANKING_PERIODS: { id: ReturnPeriod; label: string }[] = [
  { id: "1m", label: "1개월" },
  { id: "2m", label: "2개월" },
  { id: "3m", label: "3개월" },
  { id: "6m", label: "6개월" },
  { id: "12m", label: "1년" },
  { id: "ytd", label: "연초(YTD)" },
];

const SHORT_PERIODS: ReturnPeriod[] = ["1m", "2m", "3m", "6m"];
const LONG_PERIODS: ReturnPeriod[] = ["12m", "24m", "36m", "ytd"];

interface EtfCompareChartProps {
  basket: Etf[];
  isTrMode?: boolean;
  defaultChartType?: ChartType;
}

export function EtfCompareChart({
  basket,
  isTrMode = false,
  defaultChartType = "ranking",
}: EtfCompareChartProps) {
  const [chartType, setChartType] = useState<ChartType>(defaultChartType);
  const [rankingPeriod, setRankingPeriod] = useState<ReturnPeriod>("1m");
  const [viewMode, setViewMode] = useState<ViewMode>("short");
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const getEtfReturn = useCallback((etf: Etf, p: ReturnPeriod): number | null => {
    if (isTrMode) {
      const trVal = etf.returnsTr?.[p] ?? etf.returnsNetTr?.[p];
      if (trVal !== undefined && trVal !== null && Number.isFinite(trVal)) {
        return trVal;
      }
      return null;
    }
    const prVal = etf.returns?.[p];
    return (prVal !== undefined && prVal !== null && Number.isFinite(prVal)) ? prVal : null;
  }, [isTrMode]);

  const handleDownload = useCallback(() => {
    setIsExporting(true);
    // 렌더링(버튼 숨김 등)이 반영될 시간을 준 뒤 캡처 실행
    setTimeout(() => {
      if (chartRef.current === null) {
        setIsExporting(false);
        return;
      }
      toPng(chartRef.current, { 
        cacheBust: true, 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: {
          margin: '0',
          boxShadow: 'none',
        }
      })
        .then((dataUrl) => {
          const link = document.createElement('a');
          const typeText = chartType === "ranking" ? `ranking-${rankingPeriod}` : `grouped-${viewMode}`;
          const trSuffix = isTrMode ? "-tr" : "";
          link.download = `etf-compare-${typeText}${trSuffix}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.error('Failed to export chart', err);
        })
        .finally(() => {
          setIsExporting(false);
        });
    }, 150);
  }, [chartType, rankingPeriod, viewMode, isTrMode]);

  // --- 1. Ranking View Data Calculation ---
  const rankedData = useMemo(() => {
    const items = basket.map((etf, originalIdx) => {
      const val = getEtfReturn(etf, rankingPeriod);
      return {
        etf,
        originalIdx,
        color: COLORS[originalIdx % COLORS.length],
        val,
      };
    });

    // Sort descending: highest return first, nulls at the end
    items.sort((a, b) => {
      if (a.val === null && b.val === null) return 0;
      if (a.val === null) return 1;
      if (b.val === null) return -1;
      return b.val - a.val;
    });

    const validVals = items
      .map((i) => i.val)
      .filter((v): v is number => v !== null && Number.isFinite(v));

    const maxVal = validVals.length > 0 ? Math.max(...validVals) : 0;
    const minVal = validVals.length > 0 ? Math.min(...validVals) : 0;
    const maxAbs = Math.max(...validVals.map((v) => Math.abs(v)), 0.01);
    const hasNegative = minVal < 0;
    const hasPositive = maxVal > 0;

    return {
      items,
      validVals,
      maxVal,
      minVal,
      maxAbs,
      hasNegative,
      hasPositive,
    };
  }, [basket, rankingPeriod, getEtfReturn]);

  // --- 2. Grouped View Data Calculation ---
  const activePeriods = useMemo(() => {
    if (viewMode === "long") return LONG_PERIODS;
    return SHORT_PERIODS;
  }, [viewMode]);

  // SVG dimensions for Grouped View
  const width = 1000;
  const height = 380;
  const paddingY = 44; 
  const paddingX = 24;

  const { minRet, maxRet, range, hasData } = useMemo(() => {
    let max = -Infinity;
    let min = Infinity;
    let found = false;

    basket.forEach((etf) => {
      activePeriods.forEach((p) => {
        const val = getEtfReturn(etf, p);
        if (val !== null) {
          found = true;
          if (val > max) max = val;
          if (val < min) min = val;
        }
      });
    });

    if (!found) return { minRet: 0, maxRet: 0, range: 1, hasData: false };

    const paddedMax = Math.max(max > 0 ? max * 1.22 : max * 0.78, 0.01);
    const paddedMin = Math.min(min < 0 ? min * 1.22 : min * 0.78, -0.01);
    return { 
      minRet: paddedMin, 
      maxRet: paddedMax, 
      range: paddedMax - paddedMin,
      hasData: true
    };
  }, [basket, activePeriods, getEtfReturn]);

  if (basket.length === 0) return null;

  const usableHeight = height - paddingY * 2;
  const usableWidth = width - paddingX * 2;
  const zeroY = paddingY + ((maxRet - 0) / range) * usableHeight;
  const getY = (val: number) => paddingY + ((maxRet - val) / range) * usableHeight;

  const numSlots = activePeriods.length;
  const slotWidth = usableWidth / numSlots;
  const numBarsPerSlot = basket.length;
  const gapBetweenSlots = 28; 
  const availableSlotWidth = slotWidth - gapBetweenSlots;
  const gapBetweenBars = 3;
  const barWidth = Math.min(48, (availableSlotWidth - gapBetweenBars * (numBarsPerSlot - 1)) / numBarsPerSlot);
  const getSlotCenterX = (slotIdx: number) => paddingX + slotIdx * slotWidth + slotWidth / 2;

  const formatChartReturn = (val: number): string => {
    const sign = val > 0 ? "+" : "";
    return `${sign}${val.toFixed(1)}`;
  };

  const labelFontSize = basket.length <= 2 ? '14px' : basket.length <= 3 ? '13px' : basket.length <= 4 ? '12px' : '11.5px';

  const formatAsOfDate = (val?: string) => {
    if (!val) return "";
    const cleaned = val.replace(/[-.]/g, "");
    if (cleaned.length === 8) {
      return `${cleaned.slice(0, 4)}.${cleaned.slice(4, 6)}.${cleaned.slice(6, 8)}`;
    }
    return val.replace(/-/g, ".");
  };

  return (
    <div ref={chartRef} className="rounded-2xl border border-line bg-surface p-4 sm:p-6 mb-8 mt-8 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <div>
          <h3 className="text-[15px] font-extrabold text-strong flex items-center gap-1.5 flex-wrap">
            <span>기간별 성과 추이</span>
            <span className="text-xs font-semibold text-muted font-sans">
              ({isTrMode ? "단위: %, 배당재투자 TR 기준" : "단위: %"})
            </span>
          </h3>
          <div className="text-[12px] sm:text-[13px] text-muted font-medium font-sans mt-0.5">
            기준일: {formatAsOfDate(basket[0]?.asOfDate)}
          </div>
        </div>
        
        {/* Header Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Mode Switcher */}
          <div className="flex bg-neutral-100 p-0.5 sm:p-1 rounded-xl whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() => setChartType("ranking")}
              className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs sm:text-[13px] rounded-lg font-black transition-all ${
                chartType === "ranking"
                  ? "bg-white text-strong shadow-xs"
                  : "text-neutral-500 hover:text-strong"
              }`}
            >
              <span>⚡ 랭킹 뷰</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType("grouped")}
              className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs sm:text-[13px] rounded-lg font-black transition-all ${
                chartType === "grouped"
                  ? "bg-white text-strong shadow-xs"
                  : "text-neutral-500 hover:text-strong"
              }`}
            >
              <span>📊 전체 기간</span>
            </button>
          </div>

          {/* Grouped mode: Short/Long switcher */}
          {chartType === "grouped" && (
            <div className="flex bg-neutral-100 p-0.5 sm:p-1 rounded-xl whitespace-nowrap shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("short")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-[13px] rounded-lg font-extrabold transition-colors whitespace-nowrap ${
                  viewMode === "short" ? "bg-white text-strong shadow-xs" : "text-neutral-500 hover:text-strong"
                }`}
              >
                단기
              </button>
              <button
                type="button"
                onClick={() => setViewMode("long")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-[13px] rounded-lg font-extrabold transition-colors whitespace-nowrap ${
                  viewMode === "long" ? "bg-white text-strong shadow-xs" : "text-neutral-500 hover:text-strong"
                }`}
              >
                장기
              </button>
            </div>
          )}

          {/* Download Image Button */}
          {!isExporting && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-[13px] font-bold text-muted hover:text-strong hover:bg-neutral-100 rounded-xl transition-colors border border-line whitespace-nowrap shrink-0"
              title="차트를 고해상도 이미지로 저장"
            >
              <Download size={14} strokeWidth={2.5} />
              <span className="hidden xs:inline">이미지 저장</span>
            </button>
          )}
        </div>
      </div>

      {/* --- VIEW 1: RANKING BAR VIEW (Mobile-First Recommended) --- */}
      {chartType === "ranking" && (
        <div className="animate-in fade-in duration-200">
          {/* Period Tabs */}
          <div className="flex items-center justify-between gap-2 mb-4 pb-1">
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              {RANKING_PERIODS.map((rp) => (
                <button
                  key={rp.id}
                  type="button"
                  onClick={() => setRankingPeriod(rp.id)}
                  className={`px-3 py-1.5 text-xs sm:text-[13px] rounded-xl whitespace-nowrap transition-all ${
                    rankingPeriod === rp.id
                      ? "bg-neutral-900 text-white font-black shadow-xs"
                      : "bg-neutral-100 text-neutral-600 hover:text-strong hover:bg-neutral-200 font-bold"
                  }`}
                >
                  {rp.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted font-medium shrink-0 hidden sm:inline-block">
              * 수익률 높은 순 자동 정렬
            </span>
          </div>

          {/* Ranking Bars Container */}
          {rankedData.validVals.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center bg-neutral-50 rounded-xl border border-dashed border-line">
              <span className="text-sm font-bold text-muted">선택한 기간의 성과 데이터가 없습니다.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {rankedData.items.map((item, rankIdx) => {
                const { etf, color, val } = item;
                const isRanked = val !== null && Number.isFinite(val);
                const rankNumber = rankIdx + 1;

                // Rank badge styling
                const rankBadgeClass = !isRanked
                  ? "bg-neutral-100 text-neutral-400 border border-neutral-200"
                  : rankNumber === 1
                  ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                  : rankNumber === 2
                  ? "bg-slate-200 text-slate-800 border border-slate-300 shadow-2xs"
                  : rankNumber === 3
                  ? "bg-amber-900/10 text-amber-900 border border-amber-900/20 shadow-2xs"
                  : "bg-neutral-100 text-neutral-600 border border-neutral-200";

                const rankText = isRanked
                  ? rankNumber === 1
                    ? "🥇 1위"
                    : rankNumber === 2
                    ? "🥈 2위"
                    : rankNumber === 3
                    ? "🥉 3위"
                    : `${rankNumber}위`
                  : "-";

                // Visual Bar width & position calculation
                let barStyle: React.CSSProperties = {};
                if (val !== null && Number.isFinite(val)) {
                  if (rankedData.hasNegative && rankedData.hasPositive) {
                    // Center zero axis (50%)
                    const widthPct = Math.min(Math.max((Math.abs(val) / rankedData.maxAbs) * 50, 2), 50);
                    if (val >= 0) {
                      barStyle = {
                        left: "50%",
                        width: `${widthPct}%`,
                        backgroundColor: color,
                      };
                    } else {
                      barStyle = {
                        right: "50%",
                        width: `${widthPct}%`,
                        backgroundColor: color,
                      };
                    }
                  } else if (rankedData.hasNegative) {
                    // All negative: starts at right (100%) and extends left
                    const widthPct = Math.min(Math.max((Math.abs(val) / Math.abs(rankedData.minVal)) * 100, 2), 100);
                    barStyle = {
                      right: 0,
                      width: `${widthPct}%`,
                      backgroundColor: color,
                    };
                  } else {
                    // All positive: starts at left (0%) and extends right
                    const widthPct = rankedData.maxVal > 0
                      ? Math.min(Math.max((val / rankedData.maxVal) * 100, 2), 100)
                      : 2;
                    barStyle = {
                      left: 0,
                      width: `${widthPct}%`,
                      backgroundColor: color,
                    };
                  }
                }

                return (
                  <div
                    key={etf.ticker}
                    className="p-2.5 sm:p-3.5 rounded-2xl bg-neutral-50/70 hover:bg-neutral-100/70 border border-neutral-100 transition-colors"
                  >
                    {/* Header Row: Rank + Dot + Name + Ticker | Return Value */}
                    <div className="flex items-center justify-between gap-2 sm:gap-3 mb-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span
                          className={`inline-flex items-center justify-center shrink-0 min-w-[36px] sm:min-w-[42px] px-1.5 sm:px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-black ${rankBadgeClass}`}
                        >
                          {rankText}
                        </span>
                        <div
                          className="w-3 h-3 rounded-md shrink-0 shadow-2xs"
                          style={{ backgroundColor: color }}
                        />
                        <a
                          href={`/etf/${etf.ticker}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-extrabold text-[13px] sm:text-[14.5px] text-strong hover:text-emerald-600 truncate transition-colors"
                          title={etf.name}
                        >
                          {etf.name}
                        </a>
                        <span className="text-[10.5px] sm:text-xs text-muted font-sans font-medium shrink-0">
                          {etf.ticker}
                        </span>
                      </div>

                      <div className="shrink-0 text-right">
                        {val !== null && Number.isFinite(val) ? (
                          <span
                            className={`text-[14px] sm:text-[16px] font-black font-sans tabular-nums tracking-tight ${
                              val > 0 ? "text-rose-600" : val < 0 ? "text-blue-600" : "text-neutral-500"
                            }`}
                          >
                            {formatReturn(val)}{isTrMode ? " (TR)" : ""}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-neutral-400">데이터 없음</span>
                        )}
                      </div>
                    </div>

                    {/* Horizontal Bar Track */}
                    <div className="relative h-4 sm:h-5 w-full bg-neutral-200/60 rounded-full overflow-hidden">
                      {/* Zero axis marker if mixed values */}
                      {rankedData.hasNegative && rankedData.hasPositive && (
                        <div
                          className="absolute top-0 bottom-0 left-1/2 w-[1.5px] bg-neutral-400 z-10"
                          title="0% 기준선"
                        />
                      )}
                      {val !== null && Number.isFinite(val) && (
                        <div
                          className="absolute top-0 bottom-0 rounded-full transition-all duration-500 shadow-2xs"
                          style={barStyle}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- VIEW 2: GROUPED BARS VIEW (Comprehensive Multi-Period) --- */}
      {chartType === "grouped" && (
        <div className="animate-in fade-in duration-200">
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
            {basket.map((etf, idx) => (
              <div key={etf.ticker} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-md shrink-0 shadow-2xs" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-xs font-semibold text-strong truncate max-w-[200px]">{etf.name}</span>
              </div>
            ))}
          </div>

          {!hasData ? (
            <div className="h-[380px] flex items-center justify-center bg-neutral-50 rounded-xl border border-dashed border-line">
              <span className="text-sm font-bold text-muted">해당 기간의 성과 데이터가 없습니다.</span>
            </div>
          ) : (
            /* Responsive Horizontal Scroll Wrapper: prevents squashing 20 bars into 340px */
            <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
              <div className="min-w-[540px] sm:min-w-full relative overflow-visible" style={{ aspectRatio: "1000/380" }}>
                <svg viewBox="0 0 1000 380" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  {/* Background Grid Lines */}
                  {[maxRet, maxRet / 2, 0, minRet / 2, minRet].map((val, i) => {
                    const y = getY(val);
                    if (i === 1 || i === 3) return null; 
                    return (
                      <g key={i}>
                        <line 
                          x1={paddingX} y1={y} 
                          x2={width - paddingX} y2={y} 
                          stroke={val === 0 ? "#475569" : "#f1f5f9"} 
                          strokeWidth={val === 0 ? 1.5 : 1}
                          strokeDasharray="none"
                        />
                        {val === 0 && (
                          <text 
                            x={paddingX - 6} y={y + 1} 
                            alignmentBaseline="middle" 
                            textAnchor="end" 
                            className="text-[11px] fill-neutral-500 font-bold font-sans tracking-tighter"
                          >
                            0%
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* X Axis Labels */}
                  {activePeriods.map((p, idx) => {
                    const cx = getSlotCenterX(idx);
                    return (
                      <g key={p}>
                        <text 
                          x={cx} y={height - paddingY + 24} 
                          textAnchor="middle" 
                          className="text-[13px] fill-neutral-600 font-extrabold font-sans"
                        >
                          {RETURN_PERIOD_LABELS[p]}
                        </text>
                      </g>
                    );
                  })}

                  {/* Grouped Bars */}
                  {activePeriods.map((p, pIdx) => {
                    const cx = getSlotCenterX(pIdx);
                    const totalBarsWidth = numBarsPerSlot * barWidth + (numBarsPerSlot - 1) * gapBetweenBars;
                    const startX = cx - totalBarsWidth / 2;

                    const validPeriodReturns = basket
                      .map(e => getEtfReturn(e, p))
                      .filter((v): v is number => v !== null && Number.isFinite(v));
                    const maxValInPeriod = validPeriodReturns.length > 0 ? Math.max(...validPeriodReturns) : -Infinity;

                    return basket.map((etf, bIdx) => {
                      const val = getEtfReturn(etf, p);
                      if (val === null || val === undefined) return null;

                      const isWinner = maxValInPeriod > 0 && val === maxValInPeriod && basket.length > 1;
                      const color = COLORS[bIdx % COLORS.length];
                      const barX = startX + bIdx * (barWidth + gapBetweenBars);
                      const barY = val >= 0 ? getY(val) : zeroY;
                      const barH = Math.max(Math.abs(getY(val) - zeroY), 1);
                      const borderRadius = Math.min(barWidth / 3, 5);
                      const tooltipY = val >= 0 ? barY - 28 : barY + barH + 48;

                      return (
                        <g key={`${p}-${etf.ticker}`} className="group cursor-pointer">
                          {/* The Bar */}
                          <rect 
                            x={barX}
                            y={barY}
                            width={barWidth}
                            height={barH}
                            fill={color}
                            rx={borderRadius}
                            ry={borderRadius}
                            className="transition-all duration-300 opacity-90 group-hover:opacity-100"
                          />

                          {/* Winner Icon 🏆 */}
                          {isWinner && (
                            <text
                              x={barX + barWidth / 2}
                              y={barY - 18}
                              textAnchor="middle"
                              style={{ fontSize: '13px' }}
                            >
                              🏆
                            </text>
                          )}

                          {/* Static Value Label */}
                          <text 
                            x={barX + barWidth / 2} 
                            y={val >= 0 ? barY - 4 : barY + barH + 14} 
                            textAnchor="middle" 
                            fill={color}
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            paintOrder="stroke fill"
                            strokeLinejoin="round"
                            style={{ fontSize: labelFontSize, fontWeight: 900, letterSpacing: '-0.6px' }}
                            className="font-sans opacity-95 transition-all group-hover:opacity-100 select-none"
                          >
                            {formatChartReturn(val)}
                          </text>

                          {/* Hitbox */}
                          <rect 
                            x={barX - gapBetweenBars/2}
                            y={Math.min(barY, zeroY) - 20}
                            width={barWidth + gapBetweenBars}
                            height={barH + 40}
                            fill="transparent"
                          />
                          
                          {/* Tooltip */}
                          {!isExporting && (
                            <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                              <rect 
                                x={barX + barWidth/2 - 60} 
                                y={tooltipY - 30} 
                                width="120" 
                                height="40" 
                                rx="6" 
                                fill="#1e293b" 
                                className="drop-shadow-md"
                              />
                              <polygon 
                                points={
                                  val >= 0 
                                    ? `${barX + barWidth/2 - 6},${tooltipY + 10} ${barX + barWidth/2},${tooltipY + 16} ${barX + barWidth/2 + 6},${tooltipY + 10}`
                                    : `${barX + barWidth/2 - 6},${tooltipY - 30} ${barX + barWidth/2},${tooltipY - 36} ${barX + barWidth/2 + 6},${tooltipY - 30}`
                                }
                                fill="#1e293b" 
                              />
                              <text 
                                x={barX + barWidth/2} 
                                y={tooltipY - 14} 
                                textAnchor="middle" 
                                className="text-[10px] fill-neutral-300 font-semibold font-sans truncate"
                              >
                                {etf.name.length > 12 ? etf.name.substring(0, 11) + '…' : etf.name}
                              </text>
                              <text 
                                x={barX + barWidth/2} 
                                y={tooltipY - 1} 
                                textAnchor="middle" 
                                className="text-[12px] fill-white font-black font-sans tracking-tighter"
                              >
                                {formatReturn(val)}{isTrMode ? " (TR)" : ""}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    });
                  })}
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Designated Official Footer for PNG Exports (Capital Markets Act Art. 101 & SSOT Compliance) */}
      {isExporting && (
        <div className="mt-6 flex flex-col items-center gap-2 border-t border-line pt-4 w-full">
          <p className="text-[11px] font-bold text-slate-500 text-center">
            * 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.{isTrMode ? " (배당금 재투자 TR 기준)" : ""}
          </p>
          <div className="w-full py-2.5 px-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-center gap-x-2 text-xs text-center shadow-2xs">
            <span className="font-extrabold text-emerald-700">
              🔍 DC/IRP, 연금저축, ISA 계좌별 ETF 비교 분석 최적화
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-black text-slate-900">
              📊 ETF 캠퍼스 etf-campus.pages.dev
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
