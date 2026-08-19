"use client";

import { useMarketBriefingHistory } from "@/lib/hooks/use-market-briefing-history";

const decimal = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function dateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parsed);
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${decimal.format(value)}%`;
}

function changeTone(value: number) {
  if (value > 0) return "text-[#D84957]";
  if (value < 0) return "text-[#247DAA]";
  return "text-neutral-600";
}

type MarketBriefingHistoryProps = {
  activeDate?: string;
  onSelectDate: (date: string) => void;
};

export function MarketBriefingHistory({ activeDate, onSelectDate }: MarketBriefingHistoryProps) {
  const {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  } = useMarketBriefingHistory({ limit: 10 });

  return (
    <section aria-labelledby="briefing-history-title" className="rounded-[24px] border border-[#DDE6D0] bg-white p-5 shadow-[0_8px_24px_rgba(43,61,39,0.05)] sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.15em] text-[#5A7050]">BRIEFING ARCHIVE</p>
          <h2 id="briefing-history-title" className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">지난 마켓 브리핑</h2>
          <p className="mt-1 text-sm text-neutral-500">검증을 통과해 발행된 기준일만 조회할 수 있습니다.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="w-fit rounded-lg px-2 py-1.5 text-xs font-bold text-[#536A44] transition hover:bg-[#EFF8D8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ACD68]"
        >
          목록 새로고침
        </button>
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-2" aria-label="히스토리를 불러오는 중">
          {[0, 1, 2].map((index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-[#F5F8F1]" />)}
        </div>
      ) : error ? (
        <div className="mt-5 rounded-xl border border-[#F3C5C9] bg-[#FFF5F5] p-4 text-sm text-[#9E3440]">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[#D7EABB] bg-[#FBFDF8] p-5 text-sm text-neutral-600">
          아직 조회할 과거 브리핑이 없습니다. 자동 발행된 첫 브리핑부터 이 목록에 추가됩니다.
        </div>
      ) : (
        <>
          <ol className="mt-5 divide-y divide-[#E8EDE2] overflow-hidden rounded-xl border border-[#E4EBDC]">
            {items.map((item) => {
              const isActive = item.asOfDate === activeDate;
              return (
                <li key={item.asOfDate}>
                  <button
                    type="button"
                    onClick={() => onSelectDate(item.asOfDate)}
                    aria-pressed={isActive}
                    className={`grid w-full grid-cols-[minmax(94px,0.9fr)_minmax(0,1.8fr)_auto] items-center gap-3 px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7DAD55] sm:grid-cols-[132px_minmax(0,1.8fr)_96px_90px] ${isActive ? "bg-[#F1F8E3]" : "bg-white hover:bg-[#FBFDF8]"}`}
                  >
                    <div>
                      <p className="text-sm font-extrabold text-neutral-900">{dateLabel(item.asOfDate)}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">기준일 {item.asOfDate}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-800">{item.headline || `${item.marketTemperature} 흐름`}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">일반 ETF {item.generalEtfCount.toLocaleString("ko-KR")}개 · 상승 비중 {decimal.format(item.breadthRatioPct)}%</p>
                    </div>
                    <p className={`hidden text-right text-sm font-extrabold tabular-nums sm:block ${changeTone(item.top100AumWeightedReturnPct)}`}>{signed(item.top100AumWeightedReturnPct)}</p>
                    <div className="text-right">
                      <p className={`text-base font-extrabold tabular-nums ${changeTone(item.generalAumWeightedReturnPct)}`}>{signed(item.generalAumWeightedReturnPct)}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">전체 ETF</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
                className="rounded-xl border border-[#C9DDB1] bg-[#F7FBEF] px-4 py-2.5 text-sm font-bold text-[#476237] transition hover:bg-[#EFF8D8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ACD68] disabled:cursor-wait disabled:opacity-60"
              >
                {isLoadingMore ? "불러오는 중…" : "이전 브리핑 더 보기"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
