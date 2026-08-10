"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { type Etf, type ReturnPeriod, RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import { formatReturn } from "@/lib/domain/etf-format";

import { GENERAL_RETURN_PERIODS } from "@/lib/domain/etf-explorer";

const RANKING_PERIODS: ReturnPeriod[] = [...GENERAL_RETURN_PERIODS].filter(p => p !== "ytd");

export function ReturnRankingChart({ 
  etfs, 
  selectedPeriod, 
  onPeriodChange,
  activeFilterLabels = []
}: { 
  etfs: readonly Etf[]; 
  selectedPeriod: ReturnPeriod;
  onPeriodChange: (period: ReturnPeriod) => void;
  activeFilterLabels?: string[];
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const top10 = [...etfs]
    .filter((etf) => etf.returns[selectedPeriod] !== null)
    .sort((a, b) => (b.returns[selectedPeriod] as number) - (a.returns[selectedPeriod] as number))
    .slice(0, 5);

  const maxAbsReturn = Math.max(...top10.map(etf => Math.abs(etf.returns[selectedPeriod] as number)), 1);

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
      link.download = `ETF_Campus_수익률_TOP5_${selectedPeriod}.png`;
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
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {RANKING_PERIODS.map((period) => {
            const isActive = selectedPeriod === period;
            return (
              <button
                key={period}
                type="button"
                onClick={() => onPeriodChange(period)}
                aria-pressed={isActive}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  isActive ? "bg-neutral-900 text-white" : "text-muted hover:bg-neutral-100 hover:text-strong"
                }`}
              >
                {RETURN_PERIOD_LABELS[period]}
              </button>
            );
          })}
        </div>
        <button 
          onClick={handleDownload}
          className="shrink-0 ml-3 flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-100"
          title="이미지로 저장하여 공유하기"
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="hidden sm:inline">저장</span>
        </button>
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
            {RETURN_PERIOD_LABELS[selectedPeriod]} 수익률 TOP 5
          </h2>
        </div>
        
        {top10.length > 0 ? (
          <div className="space-y-1">
            {top10.map((etf, index) => {
              const ret = etf.returns[selectedPeriod] as number;
              const widthPct = Math.max((Math.abs(ret) / maxAbsReturn) * 100, 1);
              const isPositive = ret > 0;
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
                      <div className="truncate text-xs font-bold text-strong">
                        {etf.name}
                      </div>
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
                      <div className="flex h-1.5 items-center rounded-full bg-neutral-200/50 sm:h-1.5">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${isPositive ? "bg-rise" : isZero ? "bg-neutral-300" : "bg-fall"} ${
                            index === 0 ? "opacity-100" : index === 1 ? "opacity-90" : index === 2 ? "opacity-75" : index === 3 ? "opacity-60" : "opacity-40"
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                    <div className={`w-[48px] shrink-0 text-right whitespace-nowrap text-[11px] font-bold tabular-nums ${isPositive ? "text-rise" : isZero ? "text-muted" : "text-fall"}`}>
                      {formatReturn(ret)}
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
