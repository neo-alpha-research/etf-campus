"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(async (res) => {
  if (!res.ok) return { points: [] };
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) return { points: [] };
  return res.json();
});

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function calculateDates(period: string, asOfDate?: string) {
  let end = new Date();
  if (asOfDate && asOfDate.length >= 8) {
    end = new Date(`${asOfDate.slice(0, 4)}-${asOfDate.slice(4, 6)}-${asOfDate.slice(6, 8)}T12:00:00Z`);
  }
  const start = new Date(end.getTime());
  
  if (period === "1d") start.setDate(end.getDate() - 4);
  else if (period === "1w") start.setDate(end.getDate() - 7);
  else if (period === "2w") start.setDate(end.getDate() - 14);
  else if (period === "1m") start.setMonth(end.getMonth() - 1);
  else if (period === "2m") start.setMonth(end.getMonth() - 2);
  else if (period === "3m") start.setMonth(end.getMonth() - 3);
  else if (period === "6m") start.setMonth(end.getMonth() - 6);
  else if (period === "12m") start.setFullYear(end.getFullYear() - 1);
  else if (period === "24m") start.setFullYear(end.getFullYear() - 2);
  else if (period === "36m") start.setFullYear(end.getFullYear() - 3);
  else if (period === "ytd") {
    start.setMonth(0);
    start.setDate(1);
  }
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
}

const PERIODS = [
  { id: "1d", label: "1일" },
  { id: "1w", label: "1주" },
  { id: "2w", label: "2주" },
  { id: "1m", label: "1개월" },
  { id: "2m", label: "2개월" },
  { id: "3m", label: "3개월" },
  { id: "6m", label: "6개월" },
  { id: "12m", label: "1년" },
  { id: "24m", label: "2년" },
  { id: "36m", label: "3년" },
  { id: "ytd", label: "연초후" },
];

const CORE_PERIODS = ["1m", "3m", "6m", "ytd", "12m", "36m"];

export function PriceHistoryChart({ ticker, asOfDate }: { ticker: string, asOfDate?: string }) {
  const [period, setPeriod] = useState("12m");
  const [isCustom, setIsCustom] = useState(false);
  
  const defaultDates = useMemo(() => calculateDates(period, asOfDate), [period, asOfDate]);
  
  const initialCustomStart = useMemo(() => {
    let d = new Date();
    if (asOfDate && asOfDate.length >= 8) {
      d = new Date(`${asOfDate.slice(0, 4)}-${asOfDate.slice(4, 6)}-${asOfDate.slice(6, 8)}T12:00:00Z`);
    }
    d.setMonth(d.getMonth() - 4);
    return d.toISOString().split("T")[0];
  }, [asOfDate]);
  
  const initialCustomEnd = useMemo(() => {
    if (asOfDate && asOfDate.length >= 8) {
      return `${asOfDate.slice(0, 4)}-${asOfDate.slice(4, 6)}-${asOfDate.slice(6, 8)}`;
    }
    return new Date().toISOString().split("T")[0];
  }, [asOfDate]);

  const [customStart, setCustomStart] = useState(initialCustomStart);
  const [customEnd, setCustomEnd] = useState(initialCustomEnd);

  const startStr = isCustom ? customStart : defaultDates.start;
  const endStr = isCustom ? customEnd : defaultDates.end;

  const baseUrl = process.env.NODE_ENV === "development" ? "https://etf-campus.pages.dev" : "";
  const { data, error, isLoading } = useSWR(
    `${baseUrl}/api/prices/history?ticker=${ticker}&start=${startStr}&end=${endStr}`,
    fetcher
  );

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  let points = data?.points || [];

  if (period === "1d" && !isCustom && points.length >= 2) {
    points = points.slice(-2);
  }

  // Rebase to the first point of the visible window
  if (points.length > 0) {
    const baseClose = points[0].close;
    points = points.map((p: any) => ({
      ...p,
      returnPct: baseClose > 0 ? (p.close / baseClose - 1) * 100 : 0
    }));
  }

  const isShort = useMemo(() => {
    if (points.length === 0) return false;
    const requestedStart = new Date(startStr);
    const actualStart = new Date(points[0].date);
    const diffDays = (actualStart.getTime() - requestedStart.getTime()) / (1000 * 3600 * 24);
    return diffDays > 7; 
  }, [points, startStr]);

  const { pathData, minReturn, maxReturn, xScale, yScale, height, width, padding, innerW, innerH, yTicks, xTicks } = useMemo(() => {
    const w = 800;
    const h = 240; 
    const padding = { top: 20, right: 10, bottom: 30, left: 45 }; 
    const innerW = w - padding.left - padding.right;
    const innerH = h - padding.top - padding.bottom;
    
    if (points.length === 0) return { pathData: "", minReturn: 0, maxReturn: 0, xScale: 0, yScale: 0, height: h, width: w, padding, innerW: 0, innerH: 0, yTicks: [], xTicks: [] };
    
    const returns = points.map((p: any) => p.returnPct);
    const minR = Math.min(...returns, 0);
    const maxR = Math.max(...returns, 0);
    
    const pad = Math.max(Math.abs(maxR - minR) * 0.1, 1);
    const min = minR - pad;
    const max = maxR + pad;

    const xS = innerW / Math.max(points.length - 1, 1);
    const yS = innerH / (max - min);

    const path = points.map((p: any, i: number) => {
      const x = padding.left + i * xS;
      const y = padding.top + innerH - (p.returnPct - min) * yS;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(" ");

    const range = max - min;
    let step = 10;
    if (range > 100) step = 50;
    else if (range > 50) step = 20;
    else if (range > 20) step = 10;
    else if (range > 10) step = 5;
    else step = 2;
    
    const yTicks = [];
    const startTick = Math.ceil(min / step) * step;
    const endTick = Math.floor(max / step) * step;
    for (let i = startTick; i <= endTick; i += step) {
      yTicks.push(i);
    }

    const xTicks = [];
    if (points.length > 2) {
      const numTicks = Math.min(6, points.length);
      for (let i = 0; i < numTicks; i++) {
        const index = Math.floor(i * (points.length - 1) / (numTicks - 1));
        const dateStr = points[index].date;
        const d = new Date(dateStr);
        let label = `${String(d.getMonth()+1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        if (points.length > 200) { 
           label = `${String(d.getFullYear()).slice(2)}.${String(d.getMonth()+1).padStart(2, '0')}`;
        }
        xTicks.push({ index, label, x: padding.left + index * xS });
      }
    }

    return { pathData: path, minReturn: min, maxReturn: max, xScale: xS, yScale: yS, height: h, width: w, padding, innerW, innerH, yTicks, xTicks };
  }, [points]);

  const zeroY = points.length > 0 ? padding.top + innerH - (0 - minReturn) * yScale : 0;

  return (
    <div className="relative w-full rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm overflow-hidden" onMouseLeave={() => setHoverIndex(null)}>
      
      {/* Settings Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-100/80 rounded-lg w-fit">
          {PERIODS.filter(p => CORE_PERIODS.includes(p.id)).map(p => (
            <button
              key={p.id}
              onClick={() => { setPeriod(p.id); setIsCustom(false); }}
              className={`px-3 py-1.5 text-[13px] font-bold rounded-md transition-colors ${!isCustom && period === p.id ? "bg-white text-brand-600 shadow-sm" : "text-neutral-500 hover:text-strong"}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isCustom && (
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-2 py-1.5 text-sm font-semibold border border-line rounded-lg bg-white" />
              <span className="text-muted font-bold">~</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-2 py-1.5 text-sm font-semibold border border-line rounded-lg bg-white" />
            </div>
          )}
          <select 
            className="px-3 py-1.5 text-[13px] font-bold border border-line rounded-lg bg-white text-neutral-600 outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            value={isCustom ? "custom" : (CORE_PERIODS.includes(period) ? "" : period)}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "custom") {
                setIsCustom(true);
              } else {
                setPeriod(val);
                setIsCustom(false);
              }
            }}
          >
            <option value="" disabled hidden>더보기</option>
            <optgroup label="단기/기타 기간">
              {PERIODS.filter(p => !CORE_PERIODS.includes(p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <option value="custom">직접 입력</option>
          </select>
        </div>
      </div>

      {/* Chart Header */}
      <div className="mb-6 flex flex-col gap-2">
        <div>
          <div className="flex items-baseline gap-3 mb-1">
            <h3 className="text-lg font-bold text-strong">
              {points.length > 0 ? `${formatDate(points[0].date)} ~ ${formatDate(points[points.length - 1].date)} 수익률 추이` : "데이터 없음"}
            </h3>
            {points.length > 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-black font-mono tracking-tight ${points[points.length - 1].returnPct > 0 ? 'text-rose-600' : points[points.length - 1].returnPct < 0 ? 'text-blue-600' : 'text-neutral-600'}`}>
                  {points[points.length - 1].returnPct > 0 ? '+' : ''}{points[points.length - 1].returnPct.toFixed(2)}%
                </span>
                <span className="text-sm font-bold text-muted">누적 수익률</span>
              </div>
            )}
          </div>
          {points.length > 0 && (
             <div className="flex items-center gap-2 text-[13px] font-medium text-gray-500 mt-1">
               <span>기준일: {formatDate(points[points.length - 1].date)}</span>
               <span className="text-gray-300">|</span>
               <span>가격수익률(PR) · 분배금 미포함</span>
             </div>
          )}
          {data?.actualEnd && asOfDate && asOfDate.length >= 8 && (
            (() => {
              const formattedAsOf = `${asOfDate.slice(0, 4)}.${asOfDate.slice(4, 6)}.${asOfDate.slice(6, 8)}`;
              const actualEndFormatted = formatDate(data.actualEnd);
              if (formattedAsOf !== actualEndFormatted) {
                return (
                  <div className="mt-2 text-[12px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 w-fit">
                    차트 데이터 갱신 중 (상품 정보 기준일 {formattedAsOf} / 차트 기준일 {actualEndFormatted})
                  </div>
                );
              }
              return null;
            })()
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      {error ? (
        <div className="p-4 text-center text-rose-500 bg-rose-50 rounded-xl text-sm font-bold border border-rose-100">수익률 데이터를 불러오는데 실패했습니다.</div>
      ) : isLoading ? (
        <div className="h-[200px] w-full bg-neutral-100/70 animate-pulse rounded-2xl border border-line" />
      ) : points.length === 0 ? (
        <div className="p-8 text-center text-muted bg-neutral-50 rounded-2xl text-sm font-medium border border-line">선택한 기간의 표시할 데이터가 없습니다.</div>
      ) : isShort ? (
        <div className="flex items-center justify-center h-[220px] w-full bg-amber-50/30 rounded-2xl border border-dashed border-amber-200/60">
          <div className="text-center px-4">
            <svg className="w-8 h-8 text-amber-400 mx-auto mb-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[15px] font-bold text-strong leading-relaxed">
              선택한 기간보다 상장이 늦어<br />
              <strong className="text-amber-600">{formatDate(points[0].date)}</strong>부터의 데이터가 표시됩니다.
            </p>
            <p className="mt-3 text-[13px] font-medium text-muted">차트를 보려면 상단에서 더 짧은 기간을 선택해 주세요.</p>
          </div>
        </div>
      ) : (
        <div className="w-full relative touch-pan-x select-none" style={{ minHeight: "220px" }}>
          <svg viewBox={`0 0 ${width} ${height}`} className="absolute top-0 left-0 w-full h-full overflow-visible" preserveAspectRatio="none">
            {/* Y-axis Grid lines & labels */}
            {yTicks.map((tick, i) => {
              const y = padding.top + innerH - (tick - minReturn) * yScale;
              return (
                <g key={`y-${i}`}>
                  <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />
                  <text x={padding.left - 8} y={y + 3} fill="#9ca3af" fontSize="11" fontWeight="bold" textAnchor="end">{tick}%</text>
                </g>
              );
            })}

            {/* Zero Line */}
            <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4 4" />
            
            {/* Main Line */}
            <path d={pathData} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            
            {/* X-axis labels */}
            {xTicks.map((tick, i) => (
              <text key={`x-${i}`} x={tick.x} y={height - 5} fill="#9ca3af" fontSize="11" fontWeight="600" textAnchor="middle">
                {tick.label}
              </text>
            ))}

            {/* Interactive Hover Layer */}
            {points.map((p: any, i: number) => {
              const x = padding.left + i * xScale;
              const y = padding.top + innerH - (p.returnPct - minReturn) * yScale;
              const isHover = hoverIndex === i;

              return (
                <g key={i}>
                  {/* Transparent hover hit area */}
                  <rect 
                    x={Math.max(padding.left, x - xScale / 2)} 
                    y={padding.top} 
                    width={xScale} 
                    height={innerH} 
                    fill="transparent" 
                    onMouseEnter={() => setHoverIndex(i)} 
                    onTouchStart={(e) => { e.preventDefault(); setHoverIndex(i); }}
                    className="cursor-crosshair"
                  />
                  
                  {isHover && (
                    <>
                      {/* Vertical Crosshair */}
                      <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3 3" />
                      {/* Horizontal Crosshair */}
                      <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3 3" />
                      
                      <circle cx={x} cy={y} r="5.5" fill="#0ea5e9" stroke="white" strokeWidth="2.5" className="drop-shadow-sm" />
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip Overlay (HTML) */}
          {hoverIndex !== null && points[hoverIndex] && (
            <div 
              className="absolute pointer-events-none bg-neutral-900/90 text-white p-3 rounded-xl shadow-xl border border-neutral-700/50 backdrop-blur-md z-10 transition-all duration-75 ease-out flex flex-col gap-1 min-w-[120px]"
              style={{ 
                left: `${((padding.left + hoverIndex * xScale) / width) * 100}%`,
                top: `${padding.top}px`,
                transform: `translateX(${hoverIndex > points.length / 2 ? 'calc(-100% - 16px)' : '16px'}) translateY(0)`
              }}
            >
              <div className="text-[12px] font-bold text-neutral-400 leading-none mb-1">{formatDate(points[hoverIndex].date)}</div>
              <div className={`text-xl font-black tracking-tighter font-mono leading-none ${points[hoverIndex].returnPct > 0 ? 'text-rose-400' : points[hoverIndex].returnPct < 0 ? 'text-blue-400' : 'text-neutral-200'}`}>
                {points[hoverIndex].returnPct > 0 ? '+' : ''}{points[hoverIndex].returnPct.toFixed(2)}%
              </div>
              <div className="text-[13px] font-semibold text-neutral-300 mt-0.5">
                {points[hoverIndex].close.toLocaleString()}원
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
