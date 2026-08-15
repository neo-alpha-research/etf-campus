"use client";

import { useState, useMemo, useRef } from "react";
import useSWR from "swr";
import { toPng } from "html-to-image";
import { getPricePeriodRange, type PricePeriod } from "@/lib/domain/etf-price-period";
import type { EtfReturnDisplayStatus } from "@/lib/data/etf-return-status";
import type { ItdAnchor } from "@/lib/domain/etf-types";

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

export function PriceHistoryChart({ ticker, etfName, asOfDate, listingDate, actualFirstTradingDate, isNewListing = false, itdAnchor, returnDisplayStatus }: { ticker: string; etfName?: string; asOfDate?: string; listingDate?: string | null; actualFirstTradingDate?: string | null; isNewListing?: boolean; itdAnchor?: ItdAnchor; returnDisplayStatus?: EtfReturnDisplayStatus }) {
  const [returnBasis, setReturnBasis] = useState<"pr" | "estimated" | "tr">("pr");
  const isIncomeEtf = returnDisplayStatus?.isIncomeEtf ?? false;
  const estimatedAvailable = returnDisplayStatus?.estimatedReturnStatus === "available";
  const estimatedPeriods = returnDisplayStatus?.estimatedAvailablePeriods ?? [];
  const trAvailable = returnDisplayStatus?.trStatus === "available";
  const trBlocked = returnBasis === "tr" && !trAvailable;
  const estimatedBlocked = returnBasis === "estimated" && !estimatedAvailable;
  const [period, setPeriod] = useState<PricePeriod>(isNewListing ? "1d" : "12m");
  const hasItdAnchor = Boolean(isNewListing && itdAnchor?.price && itdAnchor?.date);
  const activeReturnLabel = period === "itd" && hasItdAnchor ? "상장 후 수익률" : "수익률";
  const [isCustom, setIsCustom] = useState(false);
  
  const chartRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const estimatedAsOfDate = returnDisplayStatus?.estimatedLastCoveredDate?.replaceAll("-", "") || asOfDate;
  const defaultDates = useMemo(() => getPricePeriodRange(period, returnBasis === "estimated" ? estimatedAsOfDate : asOfDate, {
    listingDate,
    actualFirstTradingDate: period === "itd" && hasItdAnchor ? null : actualFirstTradingDate,
  }), [period, asOfDate, estimatedAsOfDate, returnBasis, listingDate, actualFirstTradingDate, hasItdAnchor]);
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
  
  const estimatedFirstCoveredDate = returnDisplayStatus?.estimatedFirstCoveredDate || "";
  const startStr = returnBasis === "estimated" && estimatedFirstCoveredDate
    ? ((defaultDates.start ?? "") < estimatedFirstCoveredDate ? estimatedFirstCoveredDate : (defaultDates.start ?? ""))
    : (isCustom ? customStart : (defaultDates.start ?? ""));
  const endStr = returnBasis === "estimated" && returnDisplayStatus?.estimatedLastCoveredDate
    ? returnDisplayStatus.estimatedLastCoveredDate
    : (isCustom ? customEnd : defaultDates.end);

  // `next dev` does not execute Cloudflare Pages Functions.  Default to the
  // deployed read-only endpoint so a local chart still works after a reboot.
  // Developers running a local Pages proxy can opt in via the public env var.
  const configuredApiBaseUrl = process.env.NEXT_PUBLIC_PRICE_HISTORY_API_BASE_URL?.replace(/\/$/, "");
  const baseUrl = configuredApiBaseUrl ?? (process.env.NODE_ENV === "development" ? "https://etf-campus.pages.dev" : "");
  const { data, error, isLoading } = useSWR(
    trBlocked || estimatedBlocked || !startStr ? null : `${baseUrl}/api/prices/history?ticker=${ticker}&start=${startStr}&end=${endStr}&basis=${returnBasis}`,
    fetcher
  );

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  let points = data?.points || [];

  if (period === "1d" && !isCustom && points.length >= 2) {
    points = points.slice(-2);
  }

  // New-listing ITD is deliberately measured from the verified KRX listing
  // reference price, not the first observed market close.
  if (points.length > 0) {
    const baseClose = period === "itd" && hasItdAnchor && itdAnchor?.price
      ? itdAnchor.price
      : points[0].close;
    points = points.map((p: any) => ({
      ...p,
      returnPct: baseClose > 0 ? (p.close / baseClose - 1) * 100 : 0
    }));
  }

  const isShort = useMemo(() => {
    if (isNewListing) return false;
    if (!startStr || points.length === 0) return false;
    const requestedStart = new Date(startStr);
    const actualStart = new Date(points[0].date);
    const diffDays = (actualStart.getTime() - requestedStart.getTime()) / (1000 * 3600 * 24);
    return diffDays > 7; // more than 7 days gap means the ETF is likely newer than the requested period
  }, [points, startStr, isNewListing]);

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
              }).map(p => {
                const disabled = returnBasis === "estimated" && !estimatedPeriods.includes(p.id);
                return (
                <button
                  key={p.id}
                  disabled={disabled}
                  title={disabled ? "확인된 분배금 커버리지 범위를 벗어난 기간입니다." : p.title}
                  aria-label={p.title}
                  onClick={() => { if (!disabled) { setPeriod(p.id as PricePeriod); setIsCustom(false); } }}
                  className={`min-h-8 px-2 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${!isCustom && period === p.id ? "bg-white text-brand-600 shadow-sm" : disabled ? "cursor-not-allowed text-neutral-300" : "text-neutral-500 hover:text-strong"}`}
                >
                  {p.label}
                </button>
                );
              })}
              <button
                 disabled={returnBasis === "estimated"}
                 title={returnBasis === "estimated" ? "분배금 반영 수익률은 확인된 커버리지 기간만 제공합니다." : "기간 직접 설정"}
                 aria-label="기간 직접 설정"
                 onClick={() => { 
                   if (returnBasis !== "estimated") {
                     setIsCustom(true);
                   }
                 }}
                 className={`min-h-8 px-2 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${isCustom ? "bg-white text-brand-600 shadow-sm" : returnBasis === "estimated" ? "cursor-not-allowed text-neutral-300" : "text-neutral-500 hover:text-strong"}`}
              >
                직접입력
              </button>
            </div>

            {isCustom && returnBasis !== "estimated" && (
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

      {/* Return Basis Selection */}
      {isIncomeEtf && (
        <div className="mb-3 sm:mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-neutral-50/80 px-2 py-1.5 w-fit">
          <span className="px-1 text-xs font-bold text-muted">수익률 기준</span>
          <div className="flex items-center gap-1 rounded-lg bg-neutral-200/70 p-1" role="group" aria-label="수익률 기준 선택">
            <button type="button" onClick={() => setReturnBasis("pr")} className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${returnBasis === "pr" ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-strong"}`} title="선택 기간의 시장 종가 변화를 계산한 누적 수익률입니다. 분배금은 포함하지 않습니다.">분배금 미포함</button>
            <button type="button" onClick={() => { if (estimatedAvailable) { setReturnBasis("estimated"); setPeriod("1m"); setIsCustom(false); } }} disabled={!estimatedAvailable} title={estimatedAvailable ? "운용사 공식 분배금 공지를 가격 이력에 반영한 추정 수익률입니다." : returnDisplayStatus?.estimatedUnavailableReason || "분배금 반영 수익률 준비 중"} className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${returnBasis === "estimated" ? "bg-white text-brand-700 shadow-sm" : estimatedAvailable ? "text-muted hover:text-strong" : "cursor-not-allowed text-neutral-400"}`}>분배금 반영{estimatedAvailable ? " · 추정" : " · 준비 중"}</button>
            <button type="button" onClick={() => trAvailable && setReturnBasis("tr")} disabled={!trAvailable} title={trAvailable ? "검증된 분배금을 세전 재투자한 것으로 가정한 누적 수익률입니다." : returnDisplayStatus?.trUnavailableReason || "검증 TR 준비 중"} className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${returnBasis === "tr" ? "bg-white text-brand-700 shadow-sm" : trAvailable ? "text-muted hover:text-strong" : "cursor-not-allowed text-neutral-400"}`}>분배금 포함{trAvailable ? " · 검증" : " · 준비 중"}</button>
          </div>
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
              <div className="flex items-baseline gap-2.5 flex-wrap justify-end">
                <span className={`font-bold text-[22px] ${isShort ? 'text-neutral-400' : points[points.length - 1].returnPct > 0 ? 'text-rose-600' : points[points.length - 1].returnPct < 0 ? 'text-blue-600' : 'text-neutral-600'}`}>{activeReturnLabel}</span>
                <span className={`font-black font-mono tracking-tight leading-none text-[22px] ${isShort ? 'text-neutral-400' : points[points.length - 1].returnPct > 0 ? 'text-rose-600' : points[points.length - 1].returnPct < 0 ? 'text-blue-600' : 'text-neutral-600'}`}>
                  {isShort ? '-' : `${points[points.length - 1].returnPct > 0 ? '+' : ''}${points[points.length - 1].returnPct.toFixed(2)}%`}
                </span>
              </div>
              {!isShort && returnBasis !== "pr" && (
                <div className="text-[11px] text-gray-500 mt-1.5">{returnBasis === "tr" ? "(세전 분배금 재투자 · KIND 검증 완료)" : `운용사 공식 공지 기반 · ${returnDisplayStatus?.estimatedCoverageMonths ?? 0}개월 커버리지`}</div>
              )}
              {!isShort && returnBasis === "pr" && period === "itd" && hasItdAnchor && (
                <div className="text-[11px] text-gray-500 mt-1.5">{itdAnchor?.verified ? "KRX 신규상장 기준가격 대비" : "상장일 기준 가격 대비 · KRX 기준가격 공식 대조 중"} · 분배금 미포함</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      {trBlocked ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 px-5 text-center">
          <div>
            <p className="text-[15px] font-bold text-strong">검증 총수익률(TR)은 아직 준비 중입니다.</p>
            <p className="mt-2 text-[13px] font-medium leading-relaxed text-muted">{returnDisplayStatus?.trUnavailableReason || "KIND 공시 대조와 가격 이력 검증이 완료된 후 제공됩니다."}</p>
          </div>
        </div>
      ) : estimatedBlocked ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-5 text-center">
          <div>
            <p className="text-[15px] font-bold text-strong">분배금 반영 수익률은 아직 준비 중입니다.</p>
            <p className="mt-2 text-[13px] font-medium leading-relaxed text-muted">{returnDisplayStatus?.estimatedUnavailableReason || "운용사 공식 공지의 분배락일과 가격 이력이 확인된 후 제공됩니다."}</p>
          </div>
        </div>
      
) : maxListingDateUnavailable ? (
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
                {returnBasis === "estimated" ? `지수 ${Number(points[hoverIndex].close).toFixed(2)}` : `${points[hoverIndex].close.toLocaleString()}원`}
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

