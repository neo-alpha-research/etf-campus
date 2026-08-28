"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";

export type EtfHolding = {
  name: string;
  weight_pct: number;
  shares: number | null;
  item_code?: string | null;
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

// Distinct, cohesive financial palette matching ETF Campus brand
const BRAND_BAR_COLORS = [
  "#2D6A4F", // Deep Forest Green (Top 1)
  "#40916C", // Forest Green (Top 2)
  "#52B788", // Medium Emerald (Top 3)
  "#74C69D", // Soft Emerald
  "#3A86C8", // Slate Blue
  "#5C9CE6", // Light Blue
  "#E09F3E", // Warm Amber
  "#9381FF", // Soft Purple
  "#B8B8D1", // Lavender Gray
  "#D8D8E0", // Light Slate
];

const CASH_KEYWORDS = ["원화예금", "USD예금", "예수금", "원화현금", "USD현금", "단기예금", "RP", "설정해지", "콜론"];

function isCashEquivalent(name: string): boolean {
  const clean = name.replace(/\s+/g, "").toUpperCase();
  return CASH_KEYWORDS.some((kw) => clean.includes(kw));
}

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
    <section aria-labelledby="holdings-title" className="scroll-mt-24 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 mb-5">
        <div className="flex items-center gap-2">
          <h2 id="holdings-title" className="text-[17px] font-extrabold tracking-tight text-strong sm:text-[19px]">
            포트폴리오 (보유 종목 분석)
          </h2>
          {data?.holdings && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 border border-brand-200">
              총 {data.holdings.length}종목
            </span>
          )}
        </div>
        {data?.as_of_date && (
          <p className="text-xs font-medium text-muted">
            기준일: <span className="font-semibold text-strong">{data.as_of_date.replace(/-/g, ".")}</span>
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-16 w-full rounded-2xl bg-line/40" />
          <div className="h-4 w-full rounded-full bg-line/40" />
          <div className="space-y-2 pt-2">
            <div className="h-12 w-full rounded-xl bg-line/30" />
            <div className="h-12 w-full rounded-xl bg-line/30" />
            <div className="h-12 w-full rounded-xl bg-line/30" />
          </div>
        </div>
      ) : data ? (
        <HoldingsDetailView
          data={data}
          expanded={expanded}
          onToggleExpand={() => setExpanded(!expanded)}
        />
      ) : null}
    </section>
  );
}

function HoldingsDetailView({
  data,
  expanded,
  onToggleExpand,
}: {
  data: EtfHoldingsData;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { holdings } = data;

  // 1. Calculations for Concentration Metrics
  const { top3Weight, top10Weight, cashWeight, concentrationType, concentrationColor } = useMemo(() => {
    const top3 = holdings.slice(0, 3).reduce((acc, curr) => acc + Math.max(0, curr.weight_pct), 0);
    const top10 = holdings.slice(0, 10).reduce((acc, curr) => acc + Math.max(0, curr.weight_pct), 0);
    const cash = holdings
      .filter((h) => isCashEquivalent(h.name))
      .reduce((acc, curr) => acc + Math.max(0, curr.weight_pct), 0);

    let type = "균등 분산형";
    let color = "bg-blue-50 text-blue-700 border-blue-200";

    if (top3 >= 50) {
      type = "소수 종목 초집중형";
      color = "bg-rose-50 text-rose-700 border-rose-200";
    } else if (top3 >= 35 || top10 >= 75) {
      type = "상위 주도주 집중형";
      color = "bg-amber-50 text-amber-800 border-amber-200";
    } else if (holdings.length <= 15) {
      type = "압축 포트폴리오";
      color = "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    return {
      top3Weight: top3,
      top10Weight: top10,
      cashWeight: cash,
      concentrationType: type,
      concentrationColor: color,
    };
  }, [holdings]);

  const top10 = useMemo(() => holdings.slice(0, 10), [holdings]);
  const displayedHoldings = expanded ? holdings : top10;
  const maxWeight = useMemo(() => Math.max(...holdings.map((h) => Math.max(0, h.weight_pct)), 1), [holdings]);
  const othersWeight = Math.max(0, 100 - top10Weight);

  return (
    <div className="space-y-5">
      {/* 1. Summary Intelligence Cards (CR3, CR10, Cash) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-2xl border border-line bg-surface p-3.5 flex flex-col justify-between shadow-xs">
          <span className="text-[11px] font-semibold text-muted">상위 3종목 비중 (CR3)</span>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-lg font-black tracking-tight text-strong tabular-nums">
              {top3Weight.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-3.5 flex flex-col justify-between shadow-xs">
          <span className="text-[11px] font-semibold text-muted">상위 10종목 비중 (CR10)</span>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-lg font-black tracking-tight text-strong tabular-nums">
              {top10Weight.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-3.5 flex flex-col justify-between shadow-xs">
          <span className="text-[11px] font-semibold text-muted">포트폴리오 성격</span>
          <div className="mt-1.5">
            <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold border ${concentrationColor}`}>
              {concentrationType}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-3.5 flex flex-col justify-between shadow-xs">
          <span className="text-[11px] font-semibold text-muted">현금성 유동성 비중</span>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-lg font-black tracking-tight text-muted tabular-nums">
              {cashWeight > 0 ? `${cashWeight.toFixed(2)}%` : "0% 미만"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Visual Modern Concentration Segmented Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-semibold text-muted px-0.5">
          <span>상위 종목 집중도 게이지</span>
          <span>Top 10 합산 {top10Weight.toFixed(1)}%</span>
        </div>
        <div className="w-full flex h-[10px] rounded-full overflow-hidden bg-neutral-100 shadow-inner">
          {top10.map((h, i) => {
            const w = Math.max(0, h.weight_pct);
            if (w < 0.1) return null;
            return (
              <div
                key={h.name}
                title={`${h.name} (${w.toFixed(2)}%)`}
                className="h-full transition-all duration-300 hover:brightness-110"
                style={{
                  width: `${w}%`,
                  backgroundColor: BRAND_BAR_COLORS[i % BRAND_BAR_COLORS.length],
                }}
              />
            );
          })}
          {othersWeight > 0.1 && (
            <div
              title={`기타 ${othersWeight.toFixed(2)}%`}
              className="h-full bg-neutral-300 transition-all duration-300"
              style={{ width: `${othersWeight}%` }}
            />
          )}
        </div>
      </div>

      {/* 3. In-line Visual Bar Table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-hover/50 text-[11px] font-bold text-muted uppercase tracking-wider">
                <th className="py-2.5 pl-4 pr-2 w-12 text-center">순위</th>
                <th className="py-2.5 px-3">구성 종목명</th>
                <th className="py-2.5 px-3 text-right hidden sm:table-cell">수량 (주/계약)</th>
                <th className="py-2.5 pr-4 pl-3 text-right w-44">보유 비중</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {displayedHoldings.map((h, i) => {
                const isTop3 = i < 3;
                const isCash = isCashEquivalent(h.name);
                const barWidth = Math.min(100, (Math.max(0, h.weight_pct) / maxWeight) * 100);

                return (
                  <tr
                    key={`${h.name}-${i}`}
                    className="group relative hover:bg-surface-hover/80 transition-colors"
                  >
                    {/* Rank */}
                    <td className="py-3 pl-4 pr-2 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold tabular-nums ${
                          isTop3
                            ? "bg-brand-700 text-white shadow-xs"
                            : "text-muted bg-neutral-100"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>

                    {/* Stock Name + Tags */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold tracking-tight truncate max-w-[160px] sm:max-w-[280px] ${
                            isTop3 ? "text-strong text-[14px]" : "text-neutral-700"
                          }`}
                          title={h.name}
                        >
                          {h.name}
                        </span>

                        {isTop3 && (
                          <span className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 border border-brand-200">
                            주도주
                          </span>
                        )}

                        {isCash && (
                          <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                            유동성
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Shares */}
                    <td className="py-3 px-3 text-right text-muted tabular-nums text-xs hidden sm:table-cell">
                      {h.shares != null ? `${new Intl.NumberFormat("ko-KR").format(h.shares)}` : "—"}
                    </td>

                    {/* Weight + In-line Background Gauge Bar */}
                    <td className="py-3 pr-4 pl-3 text-right">
                      <div className="relative flex items-center justify-end">
                        {/* Soft visual progress fill behind the number */}
                        <div
                          className="absolute right-0 top-1/2 -translate-y-1/2 h-6 rounded-md bg-brand-50/80 border border-brand-100/50 -z-0 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                        <span
                          className={`relative z-10 font-bold tabular-nums pr-2 ${
                            isTop3 ? "text-brand-800 text-[14px]" : "text-strong text-[13px]"
                          }`}
                        >
                          {h.weight_pct.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 4. Expand / Collapse Trigger */}
        {holdings.length > 10 && (
          <div className="p-3 border-t border-line/60 bg-surface-hover/20">
            <button
              type="button"
              onClick={onToggleExpand}
              className="w-full py-2.5 rounded-xl bg-surface hover:bg-surface-hover text-strong font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 border border-line shadow-2xs cursor-pointer"
            >
              <span>{expanded ? "간략히 접기" : `전체 구성종목 (${holdings.length}개) 모두 보기`}</span>
              <svg
                className={`w-4 h-4 text-muted transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                }`}
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
    </div>
  );
}
