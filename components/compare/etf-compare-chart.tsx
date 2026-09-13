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

type ViewMode = "short" | "long";

const SHORT_PERIODS: ReturnPeriod[] = ["1m", "2m", "3m", "6m"];
const LONG_PERIODS: ReturnPeriod[] = ["12m", "24m", "36m", "ytd"];

interface EtfCompareChartProps {
  basket: Etf[];
  isTrMode?: boolean;
}

export function EtfCompareChart({
  basket,
  isTrMode = false,
}: EtfCompareChartProps) {
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

  const formatAsOfDate = (val?: string) => {
    if (!val) return "";
    const cleaned = val.replace(/[-.]/g, "");
    if (cleaned.length === 8) {
      return `${cleaned.slice(0, 4)}.${cleaned.slice(4, 6)}.${cleaned.slice(6, 8)}`;
    }
    return val.replace(/-/g, ".");
  };

  const handleDownload = useCallback(() => {
    setIsExporting(true);
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
          const modeText = viewMode === "short" ? "short" : "long";
          const trSuffix = isTrMode ? "-tr" : "";
          link.download = `etf-compare-${modeText}${trSuffix}.png`;
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
  }, [viewMode, isTrMode]);

  const activePeriods = useMemo(() => {
    if (viewMode === "long") return LONG_PERIODS;
    return SHORT_PERIODS;
  }, [viewMode]);

  // SVG dimensions
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
        
        {/* Header Controls: 단기/장기 토글 & 이미지 저장 */}
        <div className="flex items-center gap-2">
          <div className="flex bg-neutral-100 p-0.5 sm:p-1 rounded-xl whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("short")}
              className={`px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-[13px] rounded-lg font-black transition-all ${
                viewMode === "short" ? "bg-white text-strong shadow-xs" : "text-neutral-500 hover:text-strong"
              }`}
            >
              단기 성과
            </button>
            <button
              type="button"
              onClick={() => setViewMode("long")}
              className={`px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-[13px] rounded-lg font-black transition-all ${
                viewMode === "long" ? "bg-white text-strong shadow-xs" : "text-neutral-500 hover:text-strong"
              }`}
            >
              장기 성과
            </button>
          </div>

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

      {/* 범례 (Legend): 모바일에서 5줄로 늘어지지 않는 슬림 가로 칩 레이아웃 */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto py-1 scrollbar-none flex-nowrap sm:flex-wrap max-w-full">
          {basket.map((etf, idx) => (
            <div
              key={etf.ticker}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100/70 sm:bg-transparent border border-neutral-200/50 sm:border-0 shrink-0"
            >
              <div
                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-md shrink-0 shadow-2xs"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <span className="text-[11.5px] sm:text-xs font-bold text-strong whitespace-nowrap">
                {etf.name}
              </span>
            </div>
          ))}
        </div>
        <span className="text-[11px] text-neutral-400 font-medium shrink-0 sm:hidden">
          👉 좌우 스크롤
        </span>
      </div>

      {/* Chart Canvas Area */}
      {!hasData ? (
        <div className="h-[380px] flex items-center justify-center bg-neutral-50 rounded-xl border border-dashed border-line">
          <span className="text-sm font-bold text-muted">해당 기간의 성과 데이터가 없습니다.</span>
        </div>
      ) : (
        /* 모바일 가로 스와이프 보호 래퍼: 20개 막대가 찌그러지지 않고 모바일에서도 큰 폰트(12px)와 막대 두께 유지 */
        <div className="w-full overflow-x-auto pb-2 scrollbar-thin overscroll-x-contain">
          <div className="min-w-[500px] sm:min-w-full relative overflow-visible" style={{ aspectRatio: "1000/380" }}>
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
