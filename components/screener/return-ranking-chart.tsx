"use client";

import Link from "next/link";
import { type Etf, type ReturnPeriod, RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import { formatReturn } from "@/lib/domain/etf-format";

const RANKING_PERIODS: ReturnPeriod[] = ["1d", "1w", "1m", "3m", "12m"];

export function ReturnRankingChart({ 
  etfs, 
  selectedPeriod, 
  onPeriodChange 
}: { 
  etfs: readonly Etf[]; 
  selectedPeriod: ReturnPeriod;
  onPeriodChange: (period: ReturnPeriod) => void;
}) {
  const top10 = [...etfs]
    .filter((etf) => etf.returns[selectedPeriod] !== null)
    .sort((a, b) => (b.returns[selectedPeriod] as number) - (a.returns[selectedPeriod] as number))
    .slice(0, 5);

  const maxAbsReturn = Math.max(...top10.map(etf => Math.abs(etf.returns[selectedPeriod] as number)), 1);

  return (
    <section aria-labelledby="ranking-chart-title" className="mb-4 overflow-hidden rounded-xl border border-line bg-surface p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="ranking-chart-title" className="text-lg font-extrabold text-strong">
            선택 조건 내 {RETURN_PERIOD_LABELS[selectedPeriod]} 수익률 TOP 5
          </h2>
          <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted sm:text-xs">
            현재 필터를 통과한 ETF 안에서 선택 기간 가격수익률 기준으로 계산된 순위입니다.<br className="hidden sm:block"/>
            (분배금 미포함, 투자 추천 아님)
          </p>
        </div>
        
        <div className="flex shrink-0 overflow-x-auto rounded-lg border border-line bg-neutral-50 p-1 sm:overflow-visible">
          {RANKING_PERIODS.map((period) => {
            const isActive = selectedPeriod === period;
            return (
              <button
                key={period}
                type="button"
                onClick={() => onPeriodChange(period)}
                aria-pressed={isActive}
                className={`min-w-[48px] whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  isActive ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-strong"
                }`}
              >
                {RETURN_PERIOD_LABELS[period]}
              </button>
            );
          })}
        </div>
      </div>
      
      {top10.length > 0 ? (
        <div className="space-y-1">
          {top10.map((etf, index) => {
            const ret = etf.returns[selectedPeriod] as number;
            const widthPct = Math.max((Math.abs(ret) / maxAbsReturn) * 100, 1);
            const isPositive = ret > 0;
            const isZero = ret === 0;
            
            return (
              <Link 
                key={etf.ticker} 
                href={`/etf/${etf.ticker}`}
                className="group flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-neutral-50"
              >
                <div className="w-5 shrink-0 text-center text-xs font-extrabold text-muted md:w-6">
                  {index + 1}
                </div>
                <div className="flex w-[140px] shrink-0 flex-col justify-center sm:w-[180px]">
                  <div className="truncate text-[13.5px] font-bold text-strong group-hover:text-brand-700">
                    {etf.name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted">
                    <span className="tabular-nums font-semibold">{etf.ticker}</span>
                    <span className="text-neutral-300">|</span>
                    <span className="truncate max-w-[60px] sm:max-w-[90px]">{etf.classification?.marketScope || etf.assetClass}</span>
                    {etf.pension === "가능" && (
                      <span className="shrink-0 rounded-[4px] bg-brand-50 px-1 py-0.5 font-bold text-brand-700">연금O</span>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex h-3.5 items-center sm:h-4">
                    <div
                      className={`h-full rounded-sm transition-all duration-500 ${isPositive ? "bg-rise" : isZero ? "bg-neutral-300" : "bg-fall"}`}
                      style={{ width: `${widthPct}%` }}
                    />
                    <span className={`ml-2 whitespace-nowrap text-xs font-bold tabular-nums ${isPositive ? "text-rise" : isZero ? "text-muted" : "text-fall"}`}>
                      {formatReturn(ret)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-line bg-neutral-50">
          <p className="text-sm font-semibold text-muted">해당 기간의 수익률 데이터가 없습니다.</p>
        </div>
      )}
    </section>
  );
}
