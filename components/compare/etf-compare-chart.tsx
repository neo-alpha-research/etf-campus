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

export function EtfCompareChart({ basket, isTrMode = false }: { basket: Etf[]; isTrMode?: boolean }) {
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
    // 렌더링(툴팁/버튼 숨김)이 반영될 시간을 준 뒤 캡처 실행
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

  // Calculate max/min for scaling dynamically based on active periods
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

    // Pad by 22% for ample breathing room above top bars and below negative bars
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

  // Layout math for grouped bars
  const numSlots = activePeriods.length;
  const slotWidth = usableWidth / numSlots;
  const numBarsPerSlot = basket.length;
  const gapBetweenSlots = 28; 
  const availableSlotWidth = slotWidth - gapBetweenSlots;
  const gapBetweenBars = 3;
  const barWidth = Math.min(48, (availableSlotWidth - gapBetweenBars * (numBarsPerSlot - 1)) / numBarsPerSlot);
  
  const getSlotCenterX = (slotIdx: number) => paddingX + slotIdx * slotWidth + slotWidth / 2;

  // Smart single-decimal format for chart labels (drastically saves horizontal space while maintaining precision)
  const formatChartReturn = (val: number): string => {
    const sign = val > 0 ? "+" : "";
    return `${sign}${val.toFixed(1)}`;
  };

  const labelFontSize = basket.length <= 2 ? '14px' : basket.length <= 3 ? '13px' : basket.length <= 4 ? '12px' : '11.5px';

  return (
    <div ref={chartRef} className="rounded-2xl border border-line bg-surface p-5 sm:p-6 mb-8 mt-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h3 className="text-[15px] font-extrabold text-strong">
          기간별 성과 추이 <span className="text-xs font-semibold text-muted ml-1 font-sans font-normal">({isTrMode ? "단위: %, 배당재투자 TR 기준" : "단위: %"})</span>
        </h3>
        
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {!isExporting && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold text-muted hover:text-strong hover:bg-neutral-100 rounded-lg transition-colors"
                title="차트를 이미지로 저장"
              >
                <Download size={14} strokeWidth={2.5} />
                <span>이미지 저장</span>
              </button>
            )}
            <div className="flex bg-neutral-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode("short")}
                style={{ fontWeight: 800 }}
                className={`px-4 py-1.5 text-[15px] rounded-lg transition-colors ${
                  viewMode === "short" ? "bg-white text-strong shadow-sm" : "text-neutral-500 hover:text-strong"
                }`}
              >
                단기 성과
              </button>
              <button
                onClick={() => setViewMode("long")}
                style={{ fontWeight: 800 }}
                className={`px-4 py-1.5 text-[15px] rounded-lg transition-colors ${
                  viewMode === "long" ? "bg-white text-strong shadow-sm" : "text-neutral-500 hover:text-strong"
                }`}
              >
                장기 성과
              </button>
            </div>
          </div>
          {/* 기준일 (Captured in image) */}
          <div className="text-[13px] text-muted font-medium font-sans px-1">
            기준일: {basket[0]?.asOfDate ? basket[0].asOfDate.replace(/-/g, ".") : ""}
          </div>
        </div>
      </div>
      
      {/* 범례 (Legend) */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-6">
        {basket.map((etf, idx) => (
          <div key={etf.ticker} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-md" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
            <span className="text-xs font-semibold text-strong">{etf.name}</span>
          </div>
        ))}
      </div>

      {!hasData ? (
        <div className="h-[380px] flex items-center justify-center bg-neutral-50 rounded-xl border border-dashed border-line">
          <span className="text-sm font-bold text-muted">해당 기간의 성과 데이터가 없습니다.</span>
        </div>
      ) : (
        <div className="relative w-full overflow-visible" style={{ aspectRatio: "1000/380" }}>
          {/* ViewBox scale is 1000x380 */}
          <svg viewBox="0 0 1000 380" className="w-full h-full overflow-visible" preserveAspectRatio="none">
            
            {/* Background Grid Lines (Horizontal) */}
            {[maxRet, maxRet / 2, 0, minRet / 2, minRet].map((val, i) => {
              const y = getY(val);
              // Only draw 3 grid lines (max, zero, min) to keep it clean
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
              // Compute starting X for the first bar in the slot
              const totalBarsWidth = numBarsPerSlot * barWidth + (numBarsPerSlot - 1) * gapBetweenBars;
              const startX = cx - totalBarsWidth / 2;

              // Find winner for this period: only valid finite numbers
              const validPeriodReturns = basket
                .map(e => getEtfReturn(e, p))
                .filter((v): v is number => v !== null && Number.isFinite(v));
              const maxValInPeriod = validPeriodReturns.length > 0 ? Math.max(...validPeriodReturns) : -Infinity;

              return basket.map((etf, bIdx) => {
                const val = getEtfReturn(etf, p);
                if (val === null || val === undefined) return null;

                // Winner icon 🏆: strictly only when return is positive (> 0) and multiple ETFs compared
                const isWinner = maxValInPeriod > 0 && val === maxValInPeriod && basket.length > 1;
                const color = COLORS[bIdx % COLORS.length];
                const barX = startX + bIdx * (barWidth + gapBetweenBars);
                const barY = val >= 0 ? getY(val) : zeroY;
                const barH = Math.max(Math.abs(getY(val) - zeroY), 1); // Ensure at least 1px height
                
                // Rounded corners on bars
                const borderRadius = Math.min(barWidth / 3, 5);

                // Tooltip positions
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

                    {/* Winner Icon: Only shown for positive winners above the bar */}
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

                    {/* Static Value Label with high-contrast white outline */}
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

                    {/* Invisible Hitbox for easier hovering */}
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
      )}

      {/* Export Footer */}
      {isExporting && (
        <div className="mt-6 flex items-center justify-between border-t border-line pt-3 w-full">
          <p className="text-[9px] font-medium text-neutral-400">
            * 본 자료는 투자 참고용이며, 투자 권유를 목적으로 하지 않습니다.{isTrMode ? " (배당금 재투자 TR 기준)" : ""}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black tracking-tighter text-emerald-700">ETF Campus</span>
            <span className="text-[9px] font-semibold text-neutral-400">https://etf-campus.pages.dev/</span>
          </div>
        </div>
      )}
    </div>
  );
}

