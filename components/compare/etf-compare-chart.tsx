"use client";

import { useState, useMemo } from "react";
import { type Etf, type ReturnPeriod, RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import { formatReturn } from "@/lib/domain/etf-format";

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

export function EtfCompareChart({ basket }: { basket: Etf[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("short");

  const activePeriods = useMemo(() => {
    if (viewMode === "long") return LONG_PERIODS;
    return SHORT_PERIODS;
  }, [viewMode]);

  // SVG dimensions
  const width = 1000;
  const height = 300;
  const paddingY = 50; 
  const paddingX = 40;

  // Calculate max/min for scaling dynamically based on active periods
  const { minRet, maxRet, range, hasData } = useMemo(() => {
    let max = -Infinity;
    let min = Infinity;
    let found = false;

    basket.forEach((etf) => {
      activePeriods.forEach((p) => {
        const val = etf.returns[p];
        if (val !== null && val !== undefined) {
          found = true;
          if (val > max) max = val;
          if (val < min) min = val;
        }
      });
    });

    if (!found) return { minRet: 0, maxRet: 0, range: 1, hasData: false };

    // Pad by 20%
    const paddedMax = Math.max(max > 0 ? max * 1.2 : max * 0.8, 0.01);
    const paddedMin = Math.min(min < 0 ? min * 1.2 : min * 0.8, -0.01);
    return { 
      minRet: paddedMin, 
      maxRet: paddedMax, 
      range: paddedMax - paddedMin,
      hasData: true
    };
  }, [basket, activePeriods]);

  if (basket.length === 0) return null;

  const usableHeight = height - paddingY * 2;
  const usableWidth = width - paddingX * 2;
  const zeroY = paddingY + ((maxRet - 0) / range) * usableHeight;

  const getY = (val: number) => paddingY + ((maxRet - val) / range) * usableHeight;

  // Layout math for grouped bars
  const numSlots = activePeriods.length;
  const slotWidth = usableWidth / numSlots;
  const numBarsPerSlot = basket.length;
  const gapBetweenSlots = slotWidth * 0.2; 
  const availableSlotWidth = slotWidth - gapBetweenSlots;
  const gapBetweenBars = 4;
  const barWidth = Math.min(40, (availableSlotWidth - gapBetweenBars * (numBarsPerSlot - 1)) / numBarsPerSlot);
  
  const getSlotCenterX = (slotIdx: number) => paddingX + slotIdx * slotWidth + slotWidth / 2;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 mb-8 mt-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h3 className="text-[15px] font-extrabold text-strong">
          기간별 성과 추이 <span className="text-xs font-semibold text-muted ml-1 font-sans">(단위: %)</span>
        </h3>
        
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
        <div className="h-[300px] flex items-center justify-center bg-neutral-50 rounded-xl border border-dashed border-line">
          <span className="text-sm font-bold text-muted">해당 기간의 성과 데이터가 없습니다.</span>
        </div>
      ) : (
        <div className="relative w-full overflow-visible" style={{ aspectRatio: "1000/300" }}>
          {/* ViewBox scale is 1000x300 */}
          <svg viewBox="0 0 1000 300" className="w-full h-full overflow-visible" preserveAspectRatio="none">
            
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
                    stroke={val === 0 ? "#64748b" : "#f1f5f9"} 
                    strokeWidth={val === 0 ? 2 : 1}
                    strokeDasharray="none"
                  />
                  {val === 0 && (
                    <text 
                      x={paddingX - 10} y={y} 
                      alignmentBaseline="middle" 
                      textAnchor="end" 
                      className="text-[11px] fill-neutral-400 font-bold font-sans tracking-tighter"
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
                    x={cx} y={height - paddingY + 25} 
                    textAnchor="middle" 
                    className="text-[12px] fill-neutral-500 font-extrabold font-sans"
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

              // Find winner for this period
              const maxValInPeriod = Math.max(...basket.map(e => e.returns[p] ?? -Infinity));

              return basket.map((etf, bIdx) => {
                const val = etf.returns[p];
                if (val === null || val === undefined) return null;

                const isWinner = val === maxValInPeriod && val > -Infinity;
                const color = COLORS[bIdx % COLORS.length];
                const barX = startX + bIdx * (barWidth + gapBetweenBars);
                const barY = val >= 0 ? getY(val) : zeroY;
                const barH = Math.max(Math.abs(getY(val) - zeroY), 1); // Ensure at least 1px height
                
                // For negative values, we want rounded corners at the bottom.
                // For positive values, rounded corners at the top.
                // But standard SVG rx/ry applies to all 4 corners. 
                // To keep it simple, we just apply small rounded corners to all.
                const borderRadius = Math.min(barWidth / 3, 4);

                // Tooltip positions
                const tooltipY = val >= 0 ? barY - 25 : barY + barH + 45;

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

                    {/* Winner Icon */}
                    {isWinner && basket.length > 1 && (
                      <text
                        x={barX + barWidth / 2}
                        y={val >= 0 ? barY - 18 : barY + barH + 24}
                        textAnchor="middle"
                        className="text-[14px]"
                      >
                        🏆
                      </text>
                    )}

                    {/* Static Value Label */}
                    <text 
                      x={barX + barWidth / 2} 
                      y={val >= 0 ? barY - 6 : barY + barH + 12} 
                      textAnchor="middle" 
                      fill={color}
                      className="text-[9.5px] font-extrabold font-sans tracking-tighter opacity-90 transition-all group-hover:opacity-100 group-hover:drop-shadow-sm"
                    >
                      {formatReturn(val).replace("%", "")}
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
                        {formatReturn(val)}
                      </text>
                    </g>
                  </g>
                );
              });
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

