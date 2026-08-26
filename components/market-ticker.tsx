"use client";

/**
 * MarketTicker – 헤더 최상단에 표시되는 글로벌 시장 지표 띠.
 *
 * 현재는 정적 더미 데이터를 사용합니다.
 * 추후 Yahoo Finance 등 외부 API → D1 → API Route 경로로 교체 예정.
 */

import indicesData from "@/data/market_indices.json";

interface MarketIndex {
  label: string;
  value: number;
  change: number; // percentage, e.g. -5.8
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function IndexPill({ label, value, change }: MarketIndex) {
  const isUp = change > 0;
  const isFlat = change === 0;

  const arrow = isFlat ? "" : isUp ? "▲" : "▼";
  const sign = isUp ? "+" : "";
  const colorClass = isFlat
    ? "text-neutral-400"
    : isUp
      ? "text-rise"
      : "text-fall";

  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] leading-none tracking-tight sm:text-[11px]">
      <span className="font-semibold text-neutral-500">{label}</span>
      <span className="tabular-nums font-bold text-strong">
        {formatNumber(value)}
      </span>
      <span className={`tabular-nums font-bold ${colorClass}`}>
        {arrow} {sign}{Math.abs(change).toFixed(2)}%
      </span>
    </span>
  );
}

export function MarketTicker() {
  const baseDateStr = indicesData.base_date;
  const targetLabels = ["코스피", "코스닥", "S&P 500", "나스닥", "원/달러"];
  const indices = (indicesData.indices as MarketIndex[])
    .filter(idx => targetLabels.includes(idx.label))
    .sort((a, b) => targetLabels.indexOf(a.label) - targetLabels.indexOf(b.label));
  
  // Convert 20260821 to 2026년 8월 21일
  const formattedDate = baseDateStr
    ? `${baseDateStr.substring(0, 4)}년 ${parseInt(baseDateStr.substring(4, 6))}월 ${parseInt(baseDateStr.substring(6, 8))}일`
    : "";

  return (
    <div className="border-b border-line bg-neutral-50 flex justify-center">
      <div className="page-shell scrollbar-none flex justify-center items-center gap-x-3 overflow-x-auto py-1.5 sm:gap-x-4">
        {formattedDate && (
          <span className="flex items-center gap-1.5 shrink-0 text-[10px] leading-none tracking-tight sm:text-[11px]">
            <span className="tabular-nums font-bold text-strong">{formattedDate}</span>
            <span className="font-semibold text-neutral-500">종가</span>
            <span
              aria-hidden="true"
              className="hidden h-2.5 w-px shrink-0 bg-neutral-300 sm:block ml-1.5"
            />
          </span>
        )}
        {indices.map((idx, i) => (
          <span key={idx.label} className="contents">
            <IndexPill {...idx} />
            {i < indices.length - 1 && (
              <span
                aria-hidden="true"
                className="hidden h-2.5 w-px shrink-0 bg-neutral-300 sm:block"
              />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
