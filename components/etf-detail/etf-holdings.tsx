"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";

export type EtfHolding = {
  name: string;
  weight_pct: number;
  shares: number | null;
};

export type EtfHoldingsData = {
  ticker: string;
  as_of_date: string;
  holdings: EtfHolding[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Not found");
  return res.json();
};

const COLORS = [
  "#14C856", "#3974E5", "#F5BA0A", "#9546E8", "#FF6B4E", 
  "#4CCED1", "#F562B2", "#A3C038", "#5A67D8", "#ED8936"
];

export function EtfHoldings({ ticker }: { ticker: string }) {
  const { data, error, isLoading } = useSWR<EtfHoldingsData>(
    `/data/holdings/${ticker}.json`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
    }
  );

  const [expanded, setExpanded] = useState(false);

  if (error || (data && (!data.holdings || data.holdings.length === 0))) {
    return null;
  }

  return (
    <section aria-labelledby="holdings-title" className="scroll-mt-24 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 mb-4">
        <h2 id="holdings-title" className="text-[17px] font-extrabold tracking-tight text-strong sm:text-[19px]">
          포트폴리오 (보유종목)
        </h2>
        {data?.as_of_date && (
          <p className="text-xs font-semibold text-muted">
            기준일: {data.as_of_date.replace(/-/g, ".")}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-full rounded-full bg-line/50" />
          <div className="space-y-2">
            <div className="h-10 w-full rounded-lg bg-line/30" />
            <div className="h-10 w-full rounded-lg bg-line/30" />
            <div className="h-10 w-full rounded-lg bg-line/30" />
          </div>
        </div>
      ) : data ? (
        <HoldingsContent data={data} expanded={expanded} onToggleExpand={() => setExpanded(!expanded)} />
      ) : null}
    </section>
  );
}

function HoldingsContent({ data, expanded, onToggleExpand }: { data: EtfHoldingsData; expanded: boolean; onToggleExpand: () => void }) {
  const { holdings } = data;
  const top10 = useMemo(() => holdings.slice(0, 10), [holdings]);
  const displayedHoldings = expanded ? holdings : top10;
  
  const top10Weight = top10.reduce((acc, curr) => acc + curr.weight_pct, 0);
  const othersWeight = Math.max(0, 100 - top10Weight);

  return (
    <div className="space-y-6">
      <div className="w-full flex h-[12px] rounded-full overflow-hidden shadow-sm">
        {top10.map((h, i) => (
          <div 
            key={h.name} 
            title={`${h.name} ${h.weight_pct.toFixed(2)}%`}
            className="h-full"
            style={{ 
              width: `${h.weight_pct}%`, 
              backgroundColor: COLORS[i % COLORS.length] 
            }}
          />
        ))}
        {othersWeight > 0.01 && (
          <div 
            title={`기타 ${othersWeight.toFixed(2)}%`}
            className="h-full bg-neutral-200"
            style={{ width: `${othersWeight}%` }}
          />
        )}
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left text-[13px] whitespace-nowrap">
          <thead>
            <tr className="border-b border-line text-xs text-muted font-medium">
              <th className="px-2 py-3 font-medium">항목</th>
              <th className="px-2 py-3 font-medium text-right">주식수(계약수)</th>
              <th className="px-2 py-3 font-medium text-right">비중(%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/50">
            {displayedHoldings.map((h, i) => (
              <tr key={h.name} className="group hover:bg-surface-hover transition-colors">
                <td className="px-2 py-3 font-semibold text-strong flex items-center gap-2">
                  <span 
                    className="w-1.5 h-1.5 rounded-full inline-block shrink-0" 
                    style={{ backgroundColor: i < COLORS.length ? COLORS[i] : "#e5e7eb" }} 
                  />
                  <span className="truncate max-w-[200px] sm:max-w-none">{h.name}</span>
                </td>
                <td className="px-2 py-3 text-right text-muted tabular-nums">
                  {h.shares != null ? new Intl.NumberFormat("ko-KR").format(h.shares) : "-"}
                </td>
                <td className="px-2 py-3 text-right font-bold text-strong tabular-nums">
                  {h.weight_pct.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {holdings.length > 10 && (
        <div className="pt-2">
          <button 
            type="button" 
            onClick={onToggleExpand}
            className="w-full py-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-strong font-semibold text-sm transition-colors flex items-center justify-center gap-1 border border-neutral-100"
          >
            {expanded ? "접기" : `전체 보기 (${holdings.length}종목)`}
            <svg 
              className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
