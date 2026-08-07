"use client";

import Link from "next/link";
import { type Etf, type ReturnPeriod, RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import { formatReturn } from "@/lib/domain/etf-format";

const ALLOWED_PERIODS: ReturnPeriod[] = ["1d", "1w", "1m", "3m", "6m", "12m", "24m", "36m", "itd"];

export function ReturnRankingChart({ 
  etfs, 
  selectedPeriod, 
  onPeriodChange 
}: { 
  etfs: readonly Etf[]; 
  selectedPeriod: ReturnPeriod;
  onPeriodChange: (period: ReturnPeriod) => void;
}) {
  // 선택된 기간 수익률이 있는 종목만 필터링하고 내림차순 정렬하여 상위 5개 추출
  const top10 = [...etfs]
    .filter((etf) => etf.returns[selectedPeriod] !== null)
    .sort((a, b) => (b.returns[selectedPeriod] as number) - (a.returns[selectedPeriod] as number))
    .slice(0, 5);

  if (top10.length === 0) return null;

  // 가장 큰 절대 수익률을 기준으로 막대 최대 너비(100%) 비율 계산
  const maxAbsReturn = Math.max(...top10.map(etf => Math.abs(etf.returns[selectedPeriod] as number)), 1);

  return (
    <section aria-labelledby="ranking-chart-title" className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface p-5 md:p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="ranking-chart-title" className="text-lg font-extrabold text-strong">
            수익률 상위 TOP 5
          </h2>
          <p className="mt-1 text-xs text-muted">선택한 조건 내에서 {RETURN_PERIOD_LABELS[selectedPeriod]} 수익률이 가장 높은 5개 종목입니다.</p>
        </div>
        
        {/* 기간 선택 컨트롤러 (가로 스크롤 칩) */}
        <div className="scrollbar-none flex -mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex gap-1.5 rounded-xl bg-neutral-100 p-1">
            {ALLOWED_PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => onPeriodChange(period)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  selectedPeriod === period 
                    ? "bg-white text-brand-700 shadow-sm ring-1 ring-black/5" 
                    : "text-muted hover:bg-neutral-200/50 hover:text-strong"
                }`}
              >
                {RETURN_PERIOD_LABELS[period]}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        {top10.map((etf, index) => {
          const ret = etf.returns[selectedPeriod] as number;
          const widthPct = Math.max((Math.abs(ret) / maxAbsReturn) * 100, 1); // 최소 1% 너비
          const isPositive = ret > 0;
          
          return (
            <div key={etf.ticker} className="flex items-center gap-3 md:gap-4">
              <div className="w-6 shrink-0 text-center text-sm font-bold text-muted md:w-8">
                {index + 1}
              </div>
              <div className="w-28 shrink-0 truncate sm:w-40">
                <Link href={`/etf/${etf.ticker}`} className="text-sm font-bold text-strong hover:text-brand-700">
                  {etf.name}
                </Link>
                <div className="mt-0.5 text-[10px] text-muted">{etf.ticker}</div>
              </div>
              <div className="flex-1">
                <div className="flex h-5 items-center md:h-6">
                  <div
                    className={`h-full rounded-sm transition-all duration-500 ${isPositive ? "bg-brand-500" : "bg-neutral-300"}`}
                    style={{ width: `${widthPct}%` }}
                  />
                  <span className={`ml-2 whitespace-nowrap text-xs font-bold tabular-nums ${isPositive ? "text-rise" : ret < 0 ? "text-fall" : "text-muted"}`}>
                    {formatReturn(ret)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
    </section>
  );
}
