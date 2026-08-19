"use client";

import { useState, useMemo, useRef } from "react";
import useSWR from "swr";
import { toPng } from "html-to-image";
import { getPricePeriodRange, type PricePeriod } from "@/lib/domain/etf-price-period";
import type { ItdAnchor } from "@/lib/domain/etf-types";

type PricePoint = {
  date: string;
  close: number;
  returnPct?: number;
};

type PriceHistoryResponse = {
  actualEnd?: string;
  points?: PricePoint[];
};

type ChartPoint = PricePoint & { returnPct: number };

const EMPTY_POINTS: PricePoint[] = [];

const fetcher = async (url: string): Promise<PriceHistoryResponse> => {
  const response = await fetch(url);
  if (!response.ok) return { points: EMPTY_POINTS };
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) return { points: EMPTY_POINTS };
  return response.json() as Promise<PriceHistoryResponse>;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const PERIODS = [
  { id: "1d", label: "1D", title: "1일 수익률" },
  { id: "1w", label: "1W", title: "1주 수익률" },
  { id: "2w", label: "2W", title: "2주 수익률" },
  { id: "1m", label: "1M", title: "1개월 수익률" },
  { id: "2m", label: "2M", title: "2개월 수익률" },
  { id: "3m", label: "3M", title: "3개월 수익률" },
  { id: "6m", label: "6M", title: "6개월 수익률" },
  { id: "12m", label: "1Y", title: "1년 수익률" },
  { id: "24m", label: "2Y", title: "2년 수익률" },
  { id: "36m", label: "3Y", title: "3년 수익률" },
  { id: "ytd", label: "YTD", title: "연초 이후 수익률" },
  { id: "itd", label: "ITD", title: "상장 후 수익률" },
];

export function PriceHistoryChart({ ticker, etfName, asOfDate, listingDate, actualFirstTradingDate, isNewListing = false, itdAnchor, fixedReturns }: { ticker: string; etfName?: string; asOfDate?: string; listingDate?: string | null; actualFirstTradingDate?: string | null; isNewListing?: boolean; itdAnchor?: ItdAnchor; fixedReturns?: Record<string, number | null> }) {

  const [period, setPeriod] = useState<PricePeriod>(isNewListing ? "1d" : "12m");
  const hasItdAnchor = Boolean(isNewListing && itdAnchor?.price && itdAnchor?.date);
  const activeReturnLabel = period === "itd" && hasItdAnchor ? "상장 후 수익률" : "수익률";
  const [isCustom, setIsCustom] = useState(false);
  
  const chartRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  
    const defaultDates = useMemo(() => getPricePeriodRange(period, asOfDate, {
    listingDate,
    actualFirstTradingDate: period === "itd" && hasItdAnchor ? null : actualFirstTradingDate,
  }), [period, asOfDate, listingDate, actualFirstTradingDate, hasItdAnchor]);

  const maxListingDateUnavailable = period === "itd" && defaultDates.dataStatus === "listing_date_unavailable";
  
  const initialCustomStart = useMemo(() => {
    let d = new Date();
    if (asOfDate && asOfDate.length >= 8) {
      d = new Date(`${asOfDate.slice(0, 4)}-${asOfDate.slice(4, 6)}-${asOfDate.slice(6, 8)}T12:00:00Z`);
    }
    d.setMonth(d.getMonth() - 4);

    // 최소 시작일 제한 적용
    const calculatedStart = d.toISOString().split("T")[0];
    const minConstraint = actualFirstTradingDate || listingDate || "";
    if (minConstraint && calculatedStart < minConstraint) {
      return minConstraint;
    }
    return calculatedStart;
  }, [asOfDate, actualFirstTradingDate, listingDate]);

  const threeYearStart = getPricePeriodRange("36m", asOfDate).start ?? undefined;
  const minDateConstraint = isNewListing
    ? (listingDate || actualFirstTradingDate || undefined)
    : threeYearStart;
  const maxDateConstraint = asOfDate && asOfDate.length >= 8 ? `${asOfDate.slice(0, 4)}-${asOfDate.slice(4, 6)}-${asOfDate.slice(6, 8)}` : undefined;
  
  const initialCustomEnd = useMemo(() => {
    if (asOfDate && asOfDate.length >= 8) {
      return `${asOfDate.slice(0, 4)}-${asOfDate.slice(4, 6)}-${asOfDate.slice(6, 8)}`;
    }
    return new Date().toISOString().split("T")[0];
  }, [asOfDate]);

  const [customStart, setCustomStart] = useState(initialCustomStart);
  const [customEnd, setCustomEnd] = useState(initialCustomEnd);
  
  const startStr = isCustom ? customStart : (defaultDates.start ?? "");
  const endStr = isCustom ? customEnd : defaultDates.end;

  // `next dev` does not execute Cloudflare Pages Functions.  Default to the
  // deployed read-only endpoint so a local chart still works after a reboot.
  // Developers running a local Pages proxy can opt in via the public env var.
  const configuredApiBaseUrl = process.env.NEXT_PUBLIC_PRICE_HISTORY_API_BASE_URL?.replace(/\/$/, "");
  const baseUrl = configuredApiBaseUrl ?? (process.env.NODE_ENV === "development" ? "https://etf-campus.pages.dev" : "");
  const { data, error, isLoading } = useSWR(
    !startStr ? null : `${baseUrl}/api/prices/history?ticker=${ticker}&start=${startStr}&end=${endStr}&basis=pr`,
    fetcher
  );

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const sourcePoints = data?.points ?? EMPTY_POINTS;
  const points = useMemo<ChartPoint[]>(() => {
    const visiblePoints = period === "1d" && !isCustom && sourcePoints.length >= 2
      ? sourcePoints.slice(-2)
      : sourcePoints;
    if (visiblePoints.length === 0) return [];

    // New-listing ITD is deliberately measured from the verified KRX listing
    // reference price, not the first observed market close.
    const baseClose = period === "itd" && hasItdAnchor && itdAnchor?.price
      ? itdAnchor.price
      : visiblePoints[0].close;
    const rawPoints = visiblePoints.map((point) => ({
      ...point,
      returnPct: baseClose > 0 ? (point.close / baseClose - 1) * 100 : 0,
    }));

    return rawPoints;
  }, [sourcePoints, period, isCustom, hasItdAnchor, itdAnchor, fixedReturns]);

  const isShort = useMemo(() => {
    if (isNewListing) return false;
    if (!startStr || points.length === 0) return false;
    const requestedStart = new Date(startStr);
    const actualStart = new Date(points[0].date);
    const diffDays = (actualStart.getTime() - requestedStart.getTime()) / (1000 * 3600 * 24);
    return diffDays > 7; // more than 7 days gap means the ETF is likely newer than the requested period
  }, [points, startStr, isNewListing]);

    const { pathData, minReturn, xScale, yScale, height, width } = useMemo(() => {

    const w = 800;
    const h = 160; // Reduced height for better readability
        if (points.length === 0) return { pathData: "", minReturn: 0, xScale: 0, yScale: 0, height: h, width: w };
    
    const returns = points.map((point) => point.returnPct);

    const minR = Math.min(...returns, 0);
    const maxR = Math.max(...returns, 0);
    
    // add padding
    const pad = Math.max(Math.abs(maxR - minR) * 0.15, 1);
    const min = minR - pad;
    const max = maxR + pad;

    const xS = w / Math.max(points.length - 1, 1);
    const yS = h / (max - min);

        const path = points.map((p, i) => {

      const x = i * xS;
      const y = h - (p.returnPct - min) * yS;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(" ");

        return { pathData: path, minReturn: min, xScale: xS, yScale: yS, height: h, width: w };

  }, [points]);

  const zeroY = height - (0 - minReturn) * yScale;

  const handleDownload = async () => {
    if (!chartRef.current) return;
    try {
      setIsCapturing(true);
      await new Promise(r => setTimeout(r, 100)); // Wait for render
      
      const dataUrl = await toPng(chartRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: {
          margin: '0',
          boxShadow: 'none',
        }
      });
      
      const link = document.createElement('a');
      const start = points.length > 0 ? formatDate(points[0].date).replace(/\./g, '') : '';
      const end = points.length > 0 ? formatDate(points[points.length - 1].date).replace(/\./g, '') : '';
      link.download = `ETF_Campus_${ticker}_${period}_${start}_${end}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to capture image', err);
      alert('이미지 저장 중 오류가 발생했습니다.');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div ref={chartRef} className="relative w-full rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm overflow-hidden" onMouseLeave={() => setHoverIndex(null)}>
      
      {/* 1. Period Selection & Download Row */}
      {!isCapturing && (
        <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
          <div className="flex flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center gap-0.5 p-1 bg-neutral-100/80 rounded-lg w-fit shrink-0">
              {PERIODS.filter((p) => {
                if (p.id === "itd") return hasItdAnchor;
                return isNewListing ? ["1d", "1w", "2w", "1m", "2m"].includes(p.id) : true;
                            }).map(p => (
                <button
                  key={p.id}
                  title={p.title}
                  aria-label={p.title}
                  onClick={() => { setPeriod(p.id as PricePeriod); setIsCustom(false); }}
                  className={`min-h-8 px-2 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${!isCustom && period === p.id ? "bg-white text-brand-600 shadow-sm" : "text-neutral-500 hover:text-strong"}`}
                >

                  {p.label}
                </button>
                              ))}
              <button
                 title="기간 직접 설정"
                 aria-label="기간 직접 설정"
                 onClick={() => setIsCustom(true)}
                 className={`min-h-8 px-2 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${isCustom ? "bg-white text-brand-600 shadow-sm" : "text-neutral-500 hover:text-strong"}`}

              >
                직접입력
              </button>
            </div>

            {isCustom && (
              <div className="flex shrink-0 items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <input
                  aria-label="시작일"
                  type="date"
                  min={minDateConstraint}
                  max={customEnd || maxDateConstraint}
                  value={customStart}
                  onChange={(event) => {
                    const nextStart = event.target.value;
                    if (nextStart && nextStart <= customEnd) setCustomStart(nextStart);
                  }}
                  className="h-8 w-[108px] rounded border border-line bg-white px-1 py-1 text-xs font-semibold tracking-tighter outline-none transition-shadow focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                />
                <span aria-hidden="true" className="text-[10px] font-bold text-muted">~</span>
                <input
                  aria-label="종료일"
                  type="date"
                  min={customStart || minDateConstraint}
                  max={maxDateConstraint}
                  value={customEnd}
                  onChange={(event) => {
                    const nextEnd = event.target.value;
                    if (nextEnd && nextEnd >= customStart) setCustomEnd(nextEnd);
                  }}
                  className="h-8 w-[108px] rounded border border-line bg-white px-1 py-1 text-xs font-semibold tracking-tighter outline-none transition-shadow focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                />
              </div>
            )}
          </div>
          
          <button 
            onClick={handleDownload}
            className="shrink-0 flex h-8 items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-100"
            title="차트를 PNG로 다운로드"
            aria-label="차트를 PNG로 다운로드"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3" />
            </svg>
            <span className="hidden sm:inline">저장</span>
          </button>
        </div>
      )}

      {/* Chart Header */}
      <div className="flex flex-wrap justify-between items-end gap-y-4 mb-4">
        <div className="flex flex-col gap-1">
          {isCapturing && (
            <div className="flex items-baseline gap-2.5">
              <span className="text-[16px] sm:text-[17px] font-bold tracking-tight text-brand-700">{etfName || ticker}</span>
              <span className="text-[14px] font-semibold tabular-nums text-neutral-500">{ticker}</span>
            </div>
          )}
          <div className="text-[16px] sm:text-[17px] font-bold text-strong tracking-tight tabular-nums flex items-center gap-1.5 flex-wrap">
            <span>{points.length > 0 ? `${formatDate(points[0].date)} ~ ${formatDate(points[points.length - 1].date)}` : "데이터 없음"}</span>
          </div>
          {data?.actualEnd && asOfDate && asOfDate.length >= 8 && (
            (() => {
              const formattedAsOf = `${asOfDate.slice(0, 4)}.${asOfDate.slice(4, 6)}.${asOfDate.slice(6, 8)}`;
              const actualEndFormatted = formatDate(data.actualEnd);
              if (formattedAsOf !== actualEndFormatted) {
                return (
                  <div className="text-[11px] font-bold text-amber-600">
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
              <div className="flex items-center gap-4 flex-wrap justify-end">
                <div className="flex items-baseline gap-2.5 flex-wrap justify-end">
                  <span className={`font-bold text-[22px] ${isShort ? 'text-neutral-400' : points[points.length - 1].returnPct > 0 ? 'text-rose-600' : points[points.length - 1].returnPct < 0 ? 'text-blue-600' : 'text-neutral-600'}`}>{activeReturnLabel}</span>
                  <span className={`font-black font-mono tracking-tight leading-none text-[22px] ${isShort ? 'text-neutral-400' : points[points.length - 1].returnPct > 0 ? 'text-rose-600' : points[points.length - 1].returnPct < 0 ? 'text-blue-600' : 'text-neutral-600'}`}>
                    {isShort ? '-' : `${points[points.length - 1].returnPct > 0 ? '+' : ''}${points[points.length - 1].returnPct.toFixed(2)}%`}
                  </span>
                </div>
              </div>
              {!isShort && period === "itd" && hasItdAnchor && (
                <div className="text-[11px] text-gray-500 mt-1.5">{itdAnchor?.verified ? "KRX 신규상장 기준가격 대비" : "상장일 기준 가격 대비 · KRX 기준가격 공식 대조 중"} · 분배금 미포함</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
            {maxListingDateUnavailable ? (

        <div className="p-8 text-center text-muted bg-neutral-50 rounded-2xl text-sm font-medium">
          상장일 확인 중
        </div>
      ) : error ? (

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
                        {points.map((p, i) => {

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

      {/* Watermark for captured image */}
      {isCapturing && (
        <div className="mt-4 flex flex-wrap items-end justify-between border-t border-neutral-100 pt-3">
          <span className="text-[9px] font-medium text-neutral-400">* 본 자료는 투자 참고용이며, 투자 권유를 목적으로 하지 않습니다.</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black tracking-tighter text-brand-700">ETF Campus</span>
            <span className="text-[9px] font-semibold text-neutral-400">https://etf-campus.pages.dev/</span>
          </div>
        </div>
      )}
    </div>
  );
}

