"use client";
import { useRef } from "react";

import { useMarketBriefingHistory } from "@/lib/hooks/use-market-briefing-history";
import { useAuthSession } from "@/components/auth/use-auth-session";
import { generateMarketNarrative } from "@/lib/domain/market-briefing-narrative";
import { Info } from "lucide-react";

function InfoTooltip({
  text,
  side = "bottom",
  align = "right",
}: {
  text: React.ReactNode;
  side?: "top" | "bottom";
  align?: "left" | "center" | "right";
}) {
  const positionClasses =
    side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  const alignClasses =
    align === "right"
      ? "right-0 translate-x-0"
      : align === "left"
      ? "left-0 translate-x-0"
      : "left-1/2 -translate-x-1/2";
  const arrowClasses =
    side === "top"
      ? align === "right"
        ? "-bottom-1 right-2 border-4 border-transparent border-t-neutral-900"
        : align === "left"
        ? "-bottom-1 left-2 border-4 border-transparent border-t-neutral-900"
        : "-bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900"
      : align === "right"
      ? "-top-1 right-2 border-4 border-transparent border-b-neutral-900"
      : align === "left"
      ? "-top-1 left-2 border-4 border-transparent border-b-neutral-900"
      : "-top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-neutral-900";

  return (
    <div className="group relative inline-flex items-center justify-center ml-1">
      <button
        type="button"
        aria-label="도움말"
        className="text-neutral-400 cursor-help transition-colors group-hover:text-neutral-600 focus:outline-none"
      >
        <Info className="h-3 w-3 shrink-0" />
      </button>
      <div
        className={`pointer-events-none absolute ${positionClasses} ${alignClasses} z-50 w-52 sm:w-56 max-w-[calc(100vw-32px)] rounded-xl bg-slate-900/98 p-2.5 text-[11px] sm:text-xs leading-relaxed text-white opacity-0 shadow-2xl backdrop-blur-md transition-all group-hover:pointer-events-auto group-hover:opacity-100 font-normal text-left whitespace-normal break-keep`}
      >
        {text}
        <div className={`absolute ${arrowClasses}`} />
      </div>
    </div>
  );
}

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
  const { authenticated } = useAuthSession();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const {
    items,
    isLoading,
    error,
    refresh,
  } = useMarketBriefingHistory({ limit: 5 });

  return (
    <section aria-labelledby="briefing-history-title" className="rounded-[24px] border border-[#DDE6D0] bg-white p-5 shadow-[0_8px_24px_rgba(43,61,39,0.05)] sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.15em] text-[#5A7050]">BRIEFING ARCHIVE</p>
          <h2 id="briefing-history-title" className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">지난 마켓 브리핑</h2>
          <p className="mt-1 text-sm text-neutral-500">최근 5영업일 마켓 브리핑 및 과거 발행 리포트를 조회할 수 있습니다.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="w-fit rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#536A44] transition hover:bg-[#EFF8D8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ACD68]"
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
          아직 조회할 과거 브리핑이 없습니다. 검증 완료된 기준일부터 이 목록에 추가됩니다.
        </div>
      ) : (
        <>
          <div className="mt-5 overflow-hidden rounded-xl border border-[#E4EBDC]">
            <div className="grid grid-cols-[minmax(94px,0.9fr)_minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5 bg-[#F8FAF6] border-b border-[#E4EBDC] text-[11.5px] font-extrabold text-neutral-500 sm:grid-cols-[132px_minmax(0,1fr)_100px]">
              <span>기준일자</span>
              <span>핵심 브리핑 요약</span>
              <span className="flex items-center justify-end">
                시장 체온
                <InfoTooltip
                  text="일반 실물 ETF 1,018개 전체의 순자산 가중수익률(시장 체온)입니다."
                  side="bottom"
                  align="right"
                />
              </span>
            </div>

            <ol className="divide-y divide-[#E8EDE2]">
              {items.filter(item => item.asOfDate >= "2026-08-31").map((item, index) => {
                const isActive = item.asOfDate === activeDate;
                const isPastItem = index > 0;

                const narrative = generateMarketNarrative({
                  generalEtfCount: item.generalEtfCount,
                  upCount: Math.round(item.generalEtfCount * ((item.breadthRatioPct || 50) / 100)),
                  downCount: item.generalEtfCount - Math.round(item.generalEtfCount * ((item.breadthRatioPct || 50) / 100)),
                  generalAumWeightedReturnPct: item.generalAumWeightedReturnPct,
                  breadthRatioPct: item.breadthRatioPct,
                });
                const firstSummarySentence = narrative.headline.split('. ')[0]?.trim() || item.headline || `${item.marketTemperature} 흐름`;
                const displayHeadline = firstSummarySentence.endsWith('.') ? firstSummarySentence : `${firstSummarySentence}.`;

                return (
                  <li key={item.asOfDate}>
                    <button
                      type="button"
                      onClick={() => onSelectDate(item.asOfDate)}
                      aria-pressed={isActive}
                      className={`grid w-full grid-cols-[minmax(94px,0.9fr)_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7DAD55] sm:grid-cols-[132px_minmax(0,1fr)_100px] ${isActive ? "bg-[#F1F8E3]" : "bg-white hover:bg-[#FBFDF8]"}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-extrabold text-neutral-900">{dateLabel(item.asOfDate)}</p>
                        {isPastItem && !authenticated && (
                          <span className="inline-flex items-center rounded-full bg-[#FAFDF4] px-1.5 py-0.2 text-[9px] font-bold text-[#5A7050] border border-[#D7EABB]">
                            🔒 회원
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-800" title={displayHeadline}>
                          {displayHeadline}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">일반 ETF {item.generalEtfCount.toLocaleString("ko-KR")}개 · 상승 비중 {decimal.format(item.breadthRatioPct)}%</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-extrabold tabular-nums ${changeTone(item.generalAumWeightedReturnPct)}`}>
                          {signed(item.generalAumWeightedReturnPct)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="mt-5 flex justify-center">
            <div className="relative inline-flex">
              <input 
                ref={dateInputRef}
                type="date" 
                id="history-date-picker"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 block"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    if (val < "2026-08-31") {
                      alert("마켓 브리핑은 2026년 8월 31일부터 정식 제공됩니다.");
                      e.target.value = "";
                      return;
                    }
                    onSelectDate(val);
                  }
                }}
                min="2026-08-31"
                max={new Date().toISOString().split('T')[0]}
                title="2026년 8월 31일 이후의 날짜를 선택하여 과거 브리핑을 조회합니다"
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    dateInputRef.current?.showPicker();
                  } catch {
                    dateInputRef.current?.focus();
                  }
                }}
                className="rounded-xl border border-[#C9DDB1] bg-[#F7FBEF] px-5 py-2.5 text-[13px] font-bold text-[#476237] transition hover:bg-[#EFF8D8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ACD68] flex items-center gap-2 shadow-sm relative z-20 pointer-events-auto"
              >
                📅 달력에서 이전 일자 찾기
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
