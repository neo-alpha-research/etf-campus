"use client";

import Link from "next/link";
import { type Etf, type ReturnPeriod, RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import { GENERAL_RETURN_PERIODS } from "@/lib/domain/etf-explorer";
import { formatReturn } from "@/lib/domain/etf-format";

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
    <section aria-labelledby="ranking-chart-title" className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface p-4 md:p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="ranking-chart-title" className="text-lg font-extrabold text-strong">
            수익률 상위 TOP 5
          </h2>
          <p className="mt-1 text-xs text-muted">선택한 조건 내에서 {RETURN_PERIOD_LABELS[selectedPeriod]} 수익률이 가장 높은 5개 종목입니다.</p>
        </div>
        
        {/* 기간 선택 컨트롤러 (Select 드롭다운) */}
        <div className="shrink-0">
          <select
            value={selectedPeriod}
            onChange={(e) => onPeriodChange(e.target.value as ReturnPeriod)}
            className="block w-full rounded-lg border border-line bg-white py-1.5 pl-3 pr-8 text-sm font-bold text-strong focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-auto"
            aria-label="차트 기간 선택"
          >
            {GENERAL_RETURN_PERIODS.map((period) => (
              <option key={period} value={period}>
                {RETURN_PERIOD_LABELS[period]}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="space-y-2">
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
                <div className="flex h-4 items-center md:h-5">
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
