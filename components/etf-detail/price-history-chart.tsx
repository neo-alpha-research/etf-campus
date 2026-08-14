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
    return diffDays > 7; // more than 7 days gap means the ETF is likely newer than the requested period
  }, [points, startStr]);

  const { pathData, minReturn, maxReturn, xScale, yScale, height, width } = useMemo(() => {
    const w = 800;
    const h = 160; // Reduced height for better readability
    if (points.length === 0) return { pathData: "", minReturn: 0, maxReturn: 0, xScale: 0, yScale: 0, height: h, width: w };
    
    const returns = points.map((p: any) => p.returnPct);
    const minR = Math.min(...returns, 0);
    const maxR = Math.max(...returns, 0);
    
    // add padding
    const pad = Math.max(Math.abs(maxR - minR) * 0.15, 1);
    const min = minR - pad;
    const max = maxR + pad;

    const xS = w / Math.max(points.length - 1, 1);
    const yS = h / (max - min);

    const path = points.map((p: any, i: number) => {
      const x = i * xS;
      const y = h - (p.returnPct - min) * yS;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(" ");

    return { pathData: path, minReturn: min, maxReturn: max, xScale: xS, yScale: yS, height: h, width: w };
  }, [points]);

  const zeroY = height - (0 - minReturn) * yScale;

  return (
    <div className="relative w-full rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm overflow-hidden" onMouseLeave={() => setHoverIndex(null)}>
      
      {/* Settings Row */}
      <div className="flex justify-between items-start gap-4 mb-2">
        <div className="flex-1 overflow-x-auto scrollbar-hide flex flex-col gap-2">
          <div className="flex items-center gap-1 p-1 bg-neutral-100/80 rounded-lg w-fit">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => { setPeriod(p.id); setIsCustom(false); }}
                className={`px-2.5 py-1 text-[12px] font-bold rounded-md transition-colors ${!isCustom && period === p.id ? "bg-white text-brand-600 shadow-sm" : "text-neutral-500 hover:text-strong"}`}
              >
                {p.label}
              </button>
            ))}
            <button
               onClick={() => setIsCustom(true)}
               className={`px-2.5 py-1 text-[12px] font-bold rounded-md transition-colors ${isCustom ? "bg-white text-brand-600 shadow-sm" : "text-neutral-500 hover:text-strong"}`}
            >
              직접 입력
            </button>
          </div>

          {isCustom && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-2 py-1 text-xs font-semibold border border-line rounded bg-white" />
              <span className="text-muted font-bold text-xs">~</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-2 py-1 text-xs font-semibold border border-line rounded bg-white" />
            </div>
          )}
        </div>
        
        {points.length > 0 && (
          <div className="font-bold text-emerald-700 tracking-tight whitespace-nowrap mt-1" style={{ fontSize: '22px' }}>
            기준일: {formatDate(points[points.length - 1].date)}
          </div>
        )}
      </div>

      {/* Chart Header */}
      <div className="flex flex-wrap justify-between items-start gap-y-2 mb-2">
        <div>
          <h3 className="font-bold text-emerald-700 flex items-center gap-2 flex-wrap tracking-tight" style={{ fontSize: '27.3px' }}>
            {points.length > 0 ? `${formatDate(points[0].date)} ~ ${formatDate(points[points.length - 1].date)} 수익률 추이` : "데이터 없음"}
          </h3>
          {data?.actualEnd && asOfDate && asOfDate.length >= 8 && (
            (() => {
              const formattedAsOf = `${asOfDate.slice(0, 4)}.${asOfDate.slice(4, 6)}.${asOfDate.slice(6, 8)}`;
              const actualEndFormatted = formatDate(data.actualEnd);
              if (formattedAsOf !== actualEndFormatted) {
                return (
                  <div className="mt-1 text-[11px] font-bold text-amber-600">
                    * 차트 데이터 갱신 중 (상품 정보 기준일 {formattedAsOf} / 차트 기준일 {actualEndFormatted})
                  </div>
                );
              }
              return null;
            })()
          )}
        </div>
        <div className="text-right flex flex-col items-end">
          {points.length > 0 && (
            <div className="flex flex-col items-end leading-tight">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-strong" style={{ fontSize: '18px' }}>수익률</span>
                <span className={`font-black font-mono tracking-tight leading-none ${points[points.length - 1].returnPct > 0 ? 'text-rose-600' : points[points.length - 1].returnPct < 0 ? 'text-blue-600' : 'text-neutral-600'}`} style={{ fontSize: '33px' }}>
                  {points[points.length - 1].returnPct > 0 ? '+' : ''}{points[points.length - 1].returnPct.toFixed(2)}%
                </span>
              </div>
              <div className="text-[18px] text-gray-500 mt-1">(분배금 미포함)</div>
            </div>
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
          {/* Canvas SVG */}
          <svg viewBox={`0 0 ${width} ${height}`} className="absolute top-0 left-0 w-full h-full overflow-visible" preserveAspectRatio="none">
            {/* Zero Line */}
            <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="#e5e7eb" strokeWidth="2" strokeDasharray="6 4" />
            <text x="-6" y={zeroY + 4} fontSize="11" fill="#9ca3af" fontWeight="600" textAnchor="end" style={{ pointerEvents: 'none' }}>0</text>
            
            {/* Main Line */}
            <path d={pathData} fill="none" stroke="#047857" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            
            {/* Interactive Hover Layer */}
            {points.map((p: any, i: number) => {
              const x = i * xScale;
              const y = height - (p.returnPct - minReturn) * yScale;
              const isHover = hoverIndex === i;

              return (
                <g key={i}>
                  {/* Transparent hover hit area */}
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
                      <circle cx={x} cy={y} r="5.5" fill="#047857" stroke="white" strokeWidth="2.5" className="drop-shadow-sm" />
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip Overlay (HTML) */}
          {hoverIndex !== null && points[hoverIndex] && (
            <div 
              className="absolute top-0 pointer-events-none bg-neutral-900/90 text-white p-3 rounded-xl shadow-xl border border-neutral-700/50 backdrop-blur-md z-10 transition-all duration-75 ease-out flex flex-col gap-1 min-w-[120px]"
              style={{ 
                left: `${(hoverIndex / (points.length - 1 || 1)) * 100}%`,
                transform: `translateX(${hoverIndex > points.length / 2 ? 'calc(-100% - 16px)' : '16px'}) translateY(12px)`
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
