"use client";

import Link from "next/link";
import { type Etf } from "@/lib/domain/etf-types";
import { formatReturn } from "@/lib/domain/etf-format";

export function ReturnRankingChart({ etfs }: { etfs: readonly Etf[] }) {
  // 1년 수익률(12m)이 있는 종목만 필터링하고 내림차순 정렬하여 상위 5개 추출
  const top10 = [...etfs]
    .filter((etf) => etf.returns["12m"] !== null)
    .sort((a, b) => (b.returns["12m"] as number) - (a.returns["12m"] as number))
    .slice(0, 5);

  if (top10.length === 0) return null;

  // 가장 큰 절대 수익률을 기준으로 막대 최대 너비(100%) 비율 계산
  const maxAbsReturn = Math.max(...top10.map(etf => Math.abs(etf.returns["12m"] as number)), 1);

  return (
    <section aria-labelledby="ranking-chart-title" className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface p-5 md:p-6 shadow-sm">
      <div className="mb-6">
        <h2 id="ranking-chart-title" className="text-lg font-extrabold text-strong">
          1년 수익률 상위 TOP 5
        </h2>
        <p className="mt-1 text-xs text-muted">선택한 필터 조건 내에서 최근 1년 수익률이 가장 높은 5개 종목입니다.</p>
      </div>
      
      <div className="space-y-4">
        {top10.map((etf, index) => {
          const ret = etf.returns["12m"] as number;
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
