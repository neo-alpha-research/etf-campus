/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";

const fetcher = (urls: string[]) => Promise.all(urls.map(u => fetch(u).then(async res => {
  if (!res.ok) return { points: [] };
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) return { points: [] };
  return res.json();
})));

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function calculateDates(period: string) {
  const end = new Date();
  const start = new Date();
  if (period === "1d") start.setDate(end.getDate() - 4); // fetch extra days to guarantee at least 2 trading days
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

const COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

export function CompareHistoryChart({ items, asOfDate }: { items: { ticker: string, name: string }[], asOfDate?: string }) {
  const [period, setPeriod] = useState("12m");
  const [isCustom, setIsCustom] = useState(false);
  
  const defaultDates = useMemo(() => calculateDates(period), [period]);
  
  const initialCustomStart = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 4);
    return d.toISOString().split("T")[0];
  }, []);
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
  const urls = items.map(item => `${baseUrl}/api/prices/history?ticker=${item.ticker}&start=${startStr}&end=${endStr}`);

  const { data, error, isLoading } = useSWR(
    urls.length > 0 ? urls : null,
    fetcher
  );

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { combinedPoints, minReturn, maxReturn, xScale, yScale, height, width, dates } = useMemo(() => {
    const w = 800;
    const h = 180; // Reduced height
    if (!data || data.length === 0 || !data[0].points) {
      return { combinedPoints: [], minReturn: 0, maxReturn: 0, xScale: 0, yScale: 0, height: h, width: w, dates: [] };
    }

    const dateSet = new Set<string>();
    data.forEach(d => {
      if (d.points) {
        d.points.forEach((p: any) => dateSet.add(p.date));
      }
    });
    
    let sortedDates = Array.from(dateSet).sort();
    
    // For 1d, only take the last 2 trading days if available
    if (period === "1d" && !isCustom && sortedDates.length >= 2) {
      sortedDates = sortedDates.slice(-2);
    }
    
    if (sortedDates.length === 0) return { combinedPoints: [], minReturn: 0, maxReturn: 0, xScale: 0, yScale: 0, height: h, width: w, dates: [] };

    let globalMin = 0;
    let globalMax = 0;

    const combinedPoints = items.map((item, idx) => {
      const etfData = data[idx];
      if (!etfData || !etfData.points) return { ticker: item.ticker, pathData: "", points: [], color: COLORS[idx % COLORS.length], name: item.name };

      const pointsByDate = new Map<string, any>();
      etfData.points.forEach((p: any) => pointsByDate.set(p.date, p));

      const firstDate = etfData.points[0]?.date || "9999-99-99";
      let lastClose = etfData.points[0]?.close || 0;
      const filledPoints = sortedDates.map(date => {
        if (date < firstDate) {
          return { date, close: null, valid: false };
        }
        if (pointsByDate.has(date)) {
          lastClose = pointsByDate.get(date).close;
        }
        return { date, close: lastClose, valid: true };
      });

      // Rebase returnPct so that the first VALID point is always 0%
      const baseClose = etfData.points[0]?.close || 1;
      const rebasedPoints = filledPoints.map(p => {
        if (!p.valid) return { ...p, returnPct: null };
        const returnPct = baseClose > 0 ? (p.close! / baseClose - 1) * 100 : 0;
        globalMin = Math.min(globalMin, returnPct);
        globalMax = Math.max(globalMax, returnPct);
        return { ...p, returnPct };
      });

      return {
        ticker: item.ticker,
        name: item.name,
        color: COLORS[idx % COLORS.length],
        points: rebasedPoints
      };
    });

    const pad = Math.max(Math.abs(globalMax - globalMin) * 0.15, 1);
    const min = globalMin - pad;
    const max = globalMax + pad;

    const xS = w / Math.max(sortedDates.length - 1, 1);
    const yS = h / (max - min);

    combinedPoints.forEach(cp => {
      cp.pathData = cp.points.map((p, i) => {
        if (p.returnPct === null) return "";
        const x = i * xS;
        const y = h - (p.returnPct - min) * yS;
        
        const prev = i > 0 ? cp.points[i-1] : null;
        const cmd = (!prev || prev.returnPct === null) ? 'M' : 'L';
        return `${cmd} ${x} ${y}`;
      }).filter(Boolean).join(" ");
    });

    return { combinedPoints, minReturn: min, maxReturn: max, xScale: xS, yScale: yS, height: h, width: w, dates: sortedDates };
  }, [data, items]);

  if (items.length === 0) return null;
  
  const zeroY = height - (0 - minReturn) * yScale;

  return (
    <div className="relative w-full rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm overflow-hidden mb-6" onMouseLeave={() => setHoverIndex(null)}>
      
      {/* Settings Row */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-100/80 rounded-lg w-fit">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => { setPeriod(p.id); setIsCustom(false); }}
              className={`px-3 py-1.5 text-[13px] font-bold rounded-md transition-colors ${!isCustom && period === p.id ? "bg-white text-brand-600 shadow-sm" : "text-neutral-500 hover:text-strong"}`}
            >
              {p.label}
            </button>
          ))}
          <button
             onClick={() => setIsCustom(true)}
             className={`px-3 py-1.5 text-[13px] font-bold rounded-md transition-colors ${isCustom ? "bg-white text-brand-600 shadow-sm" : "text-neutral-500 hover:text-strong"}`}
          >
            직접 입력
          </button>
        </div>

        {isCustom && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-3 py-1.5 text-sm font-semibold border border-line rounded-lg bg-white" />
            <span className="text-muted font-bold">~</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-3 py-1.5 text-sm font-semibold border border-line rounded-lg bg-white" />
          </div>
        )}
      </div>

      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-strong">
             {dates.length > 0 ? `${formatDate(dates[0])} ~ ${formatDate(dates[dates.length - 1])} 비교 수익률 추이 (기준일: ${formatDate(dates[dates.length - 1])})` : "데이터 없음"}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {combinedPoints.map((cp) => {
            const firstValid = cp.points.find(p => p.valid);
            const isShort = firstValid && firstValid.date > dates[0];
            return (
              <div key={cp.ticker} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cp.color }}></span>
                <span className="text-[13px] font-bold text-strong">{cp.name}</span>
                {isShort && <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-sm shrink-0">{formatDate(firstValid.date)} 부터</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart Canvas */}
      {error ? (
        <div className="p-4 text-center text-rose-500 bg-rose-50 rounded-xl text-sm font-bold border border-rose-100">수익률 데이터를 불러오는데 실패했습니다.</div>
      ) : isLoading ? (
        <div className="h-[220px] w-full bg-neutral-100/70 animate-pulse rounded-2xl border border-line" />
      ) : dates.length === 0 ? (
        <div className="p-8 text-center text-muted bg-neutral-50 rounded-2xl text-sm font-medium border border-line">선택한 기간의 표시할 수익률 데이터가 없습니다.</div>
      ) : (
        <div className="w-full relative touch-pan-x select-none" style={{ minHeight: "220px" }}>
          <svg viewBox={`0 0 ${width} ${height}`} className="absolute top-0 left-0 w-full h-full overflow-visible" preserveAspectRatio="none">
            {/* Zero Line */}
            <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="#e5e7eb" strokeWidth="2" strokeDasharray="6 4" />
            
            {/* Main Lines */}
            {combinedPoints.map(cp => (
              <path key={cp.ticker} d={cp.pathData} fill="none" stroke={cp.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="opacity-90 transition-opacity hover:opacity-100" />
            ))}
            
            {/* Interactive Hover Layer */}
            {dates.map((date, i) => {
              const x = i * xScale;
              const isHover = hoverIndex === i;

              return (
                <g key={i}>
                  <rect 
                    x={Math.max(0, x - xScale / 2)} 
                    y="0" 
                    width={xScale} 
                    height={height} 
                    fill="transparent" 
                    onMouseEnter={() => setHoverIndex(i)} 
                    onTouchStart={(e) => { e.preventDefault(); setHoverIndex(i); }}
                    className="cursor-crosshair"
                  />
                  
                  {isHover && (
                    <>
                      <line x1={x} y1="0" x2={x} y2={height} stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3 3" />
                      {combinedPoints.map(cp => {
                        const point = cp.points[i];
                        if (!point || point.returnPct === null) return null;
                        const y = height - (point.returnPct - minReturn) * yScale;
                        return (
                          <circle key={cp.ticker} cx={x} cy={y} r="5" fill={cp.color} stroke="#ffffff" strokeWidth="2" />
                        )
                      })}
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip Overlay (HTML) */}
          {hoverIndex !== null && dates[hoverIndex] && (
            <div 
              className="absolute top-0 pointer-events-none bg-neutral-900/95 text-white p-3.5 rounded-xl shadow-xl border border-neutral-700/50 backdrop-blur-md z-10 transition-all duration-75 ease-out flex flex-col gap-2.5 min-w-[160px]"
              style={{ 
                left: `${(hoverIndex / (dates.length - 1 || 1)) * 100}%`,
                transform: `translateX(${hoverIndex > dates.length / 2 ? 'calc(-100% - 16px)' : '16px'}) translateY(12px)`
              }}
            >
              <div className="text-[12.5px] font-bold text-neutral-400 leading-none pb-1 mb-1 border-b border-neutral-700/80">{formatDate(dates[hoverIndex])}</div>
              
              <div className="flex flex-col gap-2">
                {combinedPoints.map(cp => {
                  const pt = cp.points[hoverIndex];
                  const r = pt?.returnPct ?? 0;
                  const sign = r > 0 ? '+' : '';
                  const colorClass = r > 0 ? 'text-rose-400' : r < 0 ? 'text-blue-400' : 'text-gray-400';
                  
                  return (
                    <div key={cp.ticker} className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cp.color }} />
                        <span className="text-[12px] font-semibold text-neutral-200 truncate">{cp.name}</span>
                      </div>
                      <span className={`text-[14px] font-black tracking-tight font-mono shrink-0 ${colorClass}`}>
                        {sign}{r.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
