"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { type Etf, type ReturnPeriod, RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import type { ScreenerEtf } from "@/lib/domain/etf-screener";
import { formatReturn } from "@/lib/domain/etf-format";

import { GENERAL_RETURN_PERIODS } from "@/lib/domain/etf-explorer";

const RANKING_PERIODS: ReturnPeriod[] = [...GENERAL_RETURN_PERIODS];

export function ReturnRankingChart({ 
  etfs, 
  selectedPeriod, 
  onPeriodChange,
  activeFilterLabels = [],
  comparisonPeriod = null,
  onComparisonPeriodChange,
  customDateRange = null,
  customReturnsData = null,
}: { 
  etfs: readonly ScreenerEtf[]; 
  selectedPeriod: ReturnPeriod | "custom";
  onPeriodChange: (period: ReturnPeriod | "custom") => void;
  activeFilterLabels?: string[];
  comparisonPeriod?: ReturnPeriod | null;
  onComparisonPeriodChange?: (period: ReturnPeriod | null) => void;
  customDateRange?: { start: string; end: string } | null;
  customReturnsData?: { returns: Record<string, number | null> } | null;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTop, setIsTop] = useState(true);

  const getReturn = (etf: ScreenerEtf) => {
    if (selectedPeriod === "custom") {
      return customReturnsData?.returns?.[etf.ticker] ?? null;
    }
    return etf.returns[selectedPeriod as ReturnPeriod];
  };

  const top10 = [...etfs]
    .filter((etf) => getReturn(etf) !== null)
    .sort((a, b) => {
      const diff = (getReturn(b) as number) - (getReturn(a) as number);
      return isTop ? diff : -diff;
    })
    .slice(0, 5);

  const maxAbsReturn = Math.max(...top10.map(etf => Math.abs(getReturn(etf) as number)), 1);

  const handleDownload = async () => {
    if (!chartRef.current) return;
    try {
      setIsCapturing(true);
      // Wait for state to reflect in DOM
      await new Promise(r => setTimeout(r, 100));
      
      const dataUrl = await toPng(chartRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2, // High resolution
        style: {
          margin: '0',
          boxShadow: 'none',
        }
      });
      
      const link = document.createElement('a');
      link.download = `ETF_Campus_수익률_${isTop ? "TOP5" : "BOTTOM5"}_${selectedPeriod}.png`;
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
    <section aria-labelledby="ranking-chart-title" className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {RANKING_PERIODS.map((period) => {
            const isActive = selectedPeriod === period;
            return (
              <button
                key={period}
                type="button"
                onClick={() => onPeriodChange(period)}
                aria-pressed={isActive}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1.5 transition-colors ${period === "ytd" ? "text-[10px] font-bold" : "text-xs font-bold"} ${
                  isActive ? "bg-neutral-900 text-white" : "text-muted hover:bg-neutral-100 hover:text-strong"
                }`}
              >
                {RETURN_PERIOD_LABELS[period]}
              </button>
            );
          })}
          {comparisonPeriod && !RANKING_PERIODS.includes(comparisonPeriod) && (
            <>
              <span className="text-neutral-300 select-none">|</span>
              <button
                type="button"
                onClick={() => onPeriodChange(comparisonPeriod)}
                aria-pressed={selectedPeriod === comparisonPeriod}
                className={`shrink-0 whitespace-nowrap rounded-lg border border-dashed border-brand-400 px-3 py-1.5 text-xs font-bold transition-colors ${
                  selectedPeriod === comparisonPeriod ? "bg-brand-700 text-white" : "text-brand-700 hover:bg-brand-50"
                }`}
              >
                {RETURN_PERIOD_LABELS[comparisonPeriod]}
              </button>
              <button
                type="button"
                onClick={() => onComparisonPeriodChange?.(null)}
                aria-label="비교 기간 해제"
                className="shrink-0 rounded-full p-0.5 text-muted hover:bg-neutral-100 hover:text-strong"
              >
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </>
          )}
          {customDateRange && (
            <>
              <span className="text-neutral-300 select-none">|</span>
              <button
                type="button"
                onClick={() => onPeriodChange("custom")}
                aria-pressed={selectedPeriod === "custom"}
                className={`shrink-0 whitespace-nowrap rounded-lg border border-brand-200 px-2 py-1 transition-colors ${
                  selectedPeriod === "custom" ? "bg-brand-700 text-white" : "text-brand-700 hover:bg-brand-50"
                }`}
              >
                <div className="flex flex-col items-center leading-tight">
                  <span className="text-[10px]">직접 입력</span>
                  <span className="text-[10px] font-bold">{customDateRange.start.slice(2).replace(/-/g, '.')} ~ {customDateRange.end.slice(2).replace(/-/g, '.')}</span>
                </div>
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3">
          <div className="flex shrink-0 items-center rounded-lg bg-neutral-100 p-1" role="group" aria-label="순위 방향 선택">
            <button
              onClick={() => setIsTop(true)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                isTop ? "bg-white text-rise shadow-sm" : "text-muted hover:text-strong"
              }`}
            >
              상위
            </button>
            <button
              onClick={() => setIsTop(false)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                !isTop ? "bg-white text-fall shadow-sm" : "text-muted hover:text-strong"
              }`}
            >
              하위
            </button>
          </div>
          <button 
            onClick={handleDownload}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-100"
            title="이미지를 PNG로 다운로드하여 공유하기"
            aria-label="이미지를 PNG로 다운로드"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3" />
            </svg>
            <span className="hidden sm:inline">저장</span>
          </button>
        </div>
      </div>

      <div ref={chartRef} className="bg-white p-2 sm:p-2.5">
        <div className="mb-2">
          <h2 id="ranking-chart-title" className="text-[13px] font-extrabold tracking-tight text-strong sm:text-sm">
            {activeFilterLabels.length > 0 ? (
              <span className="text-brand-700">
                {activeFilterLabels.length <= 3 
                  ? activeFilterLabels.join(", ") 
                  : `${activeFilterLabels.slice(0, 3).join(", ")} 등`}
              </span>
            ) : (
              "전체 조건"
            )}{" — "}
            <span className="font-semibold text-strong">
              {selectedPeriod === "custom" && customDateRange ? `${customDateRange.start.slice(2).replace(/-/g, '.')} ~ ${customDateRange.end.slice(2).replace(/-/g, '.')}` : (selectedPeriod !== "custom" ? RETURN_PERIOD_LABELS[selectedPeriod] : "")} 수익률 {isTop ? "TOP" : "BOTTOM"} 5
            </span>
          </h2>
        </div>
        
        {top10.length > 0 ? (
          <div className="space-y-1">
            {top10.map((etf, index) => {
              const ret = getReturn(etf);
              if (ret === null) return null;
              const barWidth = Math.max(Math.abs(ret) / maxAbsReturn * 100, 1);
              const isPositive = ret > 0;
              const isNegative = ret < 0;
              const isZero = ret === 0;
              
              return (
                <div 
                  key={etf.ticker} 
                  className="group flex items-center gap-1.5 rounded-lg bg-neutral-50 py-1.5 px-2 sm:gap-2"
                >
                  <div className="flex items-center gap-1.5 sm:w-[150px] sm:shrink-0">
                    <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-neutral-400 shadow-sm">
                      {index + 1}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <Link href={`/etf/${etf.ticker}`} className="truncate text-xs font-bold text-strong hover:text-brand-700 focus:outline-none focus:underline" title={etf.name}>
                        {etf.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-muted">
                        <span className="tabular-nums font-semibold">{etf.ticker}</span>
                        <span className="text-neutral-300">|</span>
                        <span className="truncate max-w-[80px]">{etf.classification?.marketScope || etf.assetClass}</span>
                        {etf.pension === "가능" && (
                          <span className="shrink-0 rounded-[3px] bg-brand-100 px-1 py-0.5 font-bold text-brand-800">연금O</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 items-center gap-2">
                    <div className="flex-1">
                      <div className="flex h-2.5 items-center rounded-full bg-neutral-200/50 sm:h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${isPositive ? "bg-rise" : isZero ? "bg-neutral-300" : "bg-fall"} ${
                            index === 0 ? "opacity-100" : index === 1 ? "opacity-90" : index === 2 ? "opacity-75" : index === 3 ? "opacity-60" : "opacity-40"
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex w-14 shrink-0 flex-col items-end pt-1">
                      <span className={`text-xs font-bold tabular-nums tracking-tight ${getReturn(etf) === null ? 'text-muted' : getReturn(etf)! > 0 ? "text-rise" : getReturn(etf)! < 0 ? "text-fall" : "text-strong"}`}>
                        {getReturn(etf) !== null ? formatReturn(getReturn(etf)!) : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line bg-neutral-50">
            <p className="text-sm font-semibold text-muted">해당 기간의 수익률 데이터가 없습니다.</p>
          </div>
        )}

        {activeFilterLabels.length > 3 && (
          <div className="mt-2 text-[9px] font-medium text-neutral-500">
            * 추가 적용 필터: {activeFilterLabels.slice(3).join(", ")}
          </div>
        )}

        {/* Watermark for captured image */}
        {isCapturing && (
          <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2">
            <p className="text-[9px] font-medium text-neutral-400">* 본 자료는 투자 참고용이며, 투자 권유를 목적으로 하지 않습니다.</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tighter text-brand-700">ETF Campus</span>
              <span className="text-[9px] font-semibold text-neutral-400">https://etf-campus.pages.dev/</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
