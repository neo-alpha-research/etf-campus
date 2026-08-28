/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatWon, formatMoney } from "@/lib/domain/etf-format";
import { ReturnCell, RiskBadge, AsOfDate } from "@/components/etf";
import type { Etf, ReturnPeriod } from "@/lib/domain/etf-types";
import { RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";

type Props = {
  mainEtf?: Etf;
  basket: Etf[];
  onRemove?: (ticker: string) => void;
  mode?: string;
  selectionReasons?: Map<string, string[]>;
  comparisonProfiles?: Map<string, any>;
};

const CAUTION_REASONS = new Set([
  "환헤지/환노출 불일치",
  "커버드콜 ↔ 일반형 (총수익 비교 주의)",
  "수익 구조 다름 (비교 주의)",
  "만기 구간 다름",
]);

export function EtfCompareView({ mainEtf, basket, onRemove = () => {}, mode, selectionReasons, comparisonProfiles }: Props) {
  const compareList = useMemo(() => {
    if (!mainEtf) return basket;
    const filtered = basket.filter((e) => e.ticker !== mainEtf.ticker);
    return [mainEtf, ...filtered];
  }, [mainEtf, basket]);

  const [isScrolled, setIsScrolled] = useState(false);
  const orderedPeriods: ReturnPeriod[] = ["1d", "1w", "2w", "1m", "2m", "3m", "6m", "12m", "24m", "36m", "ytd"];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    el.scrollLeft = 0;
    setIsScrolled(false);

    const handleScroll = () => {
      setIsScrolled(el.scrollLeft > 5);
    };
    
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [compareList]);

  const shadowClass = isScrolled ? "shadow-[4px_0_12px_-4px_rgba(0,0,0,0.08)]" : "";

  if (compareList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50">
        <div className="size-12 rounded-full bg-neutral-200 flex items-center justify-center mb-4">
          <svg className="size-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-strong mb-1">비교할 ETF가 없습니다</h3>
        <p className="text-sm text-muted max-w-[260px]">비교함에 ETF를 추가하여 핵심 정보와 성과를 한눈에 비교해보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mode !== "peer-readonly" && (
        <div className="flex justify-end pr-2 mb-1">
          <AsOfDate value={compareList[0]?.asOfDate} />
        </div>
      )}
      <div className="relative rounded-2xl border border-line bg-surface overflow-hidden shadow-sm">
        <div 
          ref={scrollRef}
          className="relative text-center overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]" 
          role="region" 
          aria-label="ETF 비교 표. 좌우로 스크롤할 수 있습니다." 
          tabIndex={0}
        >
          <table className="w-full table-fixed text-sm border-separate border-spacing-0" style={{ tableLayout: "fixed" }}>
            <thead className="sticky top-0 z-30 shadow-[0_2px_0_0_#e5e7eb]">
              <tr>
                <th className={`sticky left-0 z-40 w-[104px] min-w-[104px] max-w-[110px] bg-neutral-100 backdrop-blur px-2.5 py-3 text-xs sm:text-sm font-extrabold text-neutral-700 border-b border-r border-line transition-shadow duration-200 align-middle text-center ${shadowClass}`}>비교 항목</th>
                {compareList.map((etf) => {
                  const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                  const reasons = selectionReasons?.get(etf.ticker) || [];
                  return (
                    <th key={etf.ticker} className={`relative px-2.5 py-3 min-w-[145px] sm:min-w-[160px] border-b border-r border-neutral-200 font-bold text-strong align-top transition-colors ${isBase ? "bg-brand-100/80 shadow-[inset_0_3px_0_0_#0f766e]" : "bg-neutral-100 backdrop-blur"}`}>
                      <div className="flex flex-col items-center text-center gap-1 w-full">
                        {isBase && (
                          <span className="inline-flex items-center rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
                            기준 ETF
                          </span>
                        )}
                        <Link href={`/etf/${etf.ticker}`} className="flex flex-col items-center text-center gap-0.5 group w-full">
                          <span className={`text-[11px] sm:text-[12px] font-extrabold tracking-wider font-mono group-hover:underline transition-colors ${isBase ? "text-brand-800" : "text-neutral-500"}`}>{etf.ticker}</span>
                          <span className="text-[13px] sm:text-[13.5px] font-black leading-snug break-words [overflow-wrap:anywhere] line-clamp-2 text-strong group-hover:text-brand-700 transition-colors w-full px-0.5 text-center" title={etf.name}>{etf.name}</span>
                        </Link>
                        {mode === "peer-readonly" && !isBase && reasons.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap justify-center gap-1">
                            {reasons.map((reason, idx) => {
                              const isCaution = CAUTION_REASONS.has(reason);
                              return (
                                <span
                                  key={idx}
                                  data-testid="peer-reason-badge"
                                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] sm:text-[10.5px] font-semibold leading-tight border ${
                                    isCaution
                                      ? "border-amber-300 bg-amber-50 text-amber-800"
                                      : "border-neutral-200 bg-neutral-50 text-neutral-600"
                                  }`}
                                >
                                  {reason}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {!isBase && mode !== "peer-readonly" && (
                          <button 
                            onClick={() => onRemove(etf.ticker)}
                            className="absolute right-1.5 top-1.5 p-1 text-rose-400 hover:text-rose-600 transition-all duration-200 flex items-center justify-center group/btn active:scale-90"
                            aria-label={`${etf.name} 제외하기`}
                            title="제외하기"
                          >
                            <svg className="size-4 transition-transform duration-200 group-hover/btn:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="[&>tr]:h-[36px] [&>tr]:transition-colors [&>tr:hover]:bg-neutral-100/50 [&>tr:nth-child(even)]:bg-neutral-50/40 [&>tr:nth-child(even)>th]:!bg-neutral-50/95">
              {/* 투자 분류 */}
              <tr className="hover:bg-brand-50/20">
                <th className={`sticky left-0 z-20 bg-surface px-2.5 py-1.5 text-xs font-bold text-muted border-b border-r border-line transition-shadow duration-200 text-center align-middle ${shadowClass}`}>투자 분류</th>
                {compareList.map((etf) => {
                  const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                  return (
                    <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-neutral-200 px-2 py-1.5 transition-colors ${isBase ? "bg-brand-50/40" : ""}`}>
                      <div className="flex flex-wrap justify-center gap-1 items-center overflow-hidden [&_span]:!px-1.5 [&_span]:!py-0.5 [&_span]:!text-[10.5px]">
                        {etf.classification?.marketScope && <span className="inline-flex rounded-sm border border-blue-300 bg-blue-50 font-semibold text-blue-700">{etf.classification.marketScope}</span>}
                        {etf.classification?.assetClass && <span className="inline-flex rounded-sm border border-purple-300 bg-purple-50 font-semibold text-purple-700">{etf.classification.assetClass}</span>}
                        <RiskBadge riskType={etf.riskType} />
                        {etf.pension === "가능" && (
                          <span className="inline-flex rounded-sm border border-emerald-300 bg-emerald-50 font-semibold text-emerald-700">
                            연금
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
              {/* 총보수 */}
              <tr className="hover:bg-brand-50/20">
                <th className={`sticky left-0 z-20 bg-surface px-2.5 py-1.5 text-xs font-bold text-muted border-b border-r border-line transition-shadow duration-200 text-center align-middle ${shadowClass}`}>총보수</th>
                {compareList.map((etf) => {
                  const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                  const feeInfo = etf.fee;
                  const hasFee = feeInfo?.totalFeePct != null;
                  return (
                    <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-neutral-200 px-2 py-1.5 transition-colors text-center align-middle ${isBase ? "bg-brand-50/40" : ""}`}>
                      <span className={`text-[11.5px] font-bold tabular-nums ${hasFee ? "text-strong" : "text-muted"}`}>
                        {hasFee ? `${feeInfo.totalFeePct}%` : "-"}
                      </span>
                    </td>
                  );
                })}
              </tr>
              {/* 기초 지수 */}
              <tr className="hover:bg-brand-50/20">
                <th className={`sticky left-0 z-20 bg-surface px-2.5 py-1.5 text-xs font-bold text-muted border-b border-r border-line transition-shadow duration-200 text-center align-middle ${shadowClass}`}>기초 지수</th>
                {compareList.map((etf) => {
                  const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                  return (
                    <td key={etf.ticker} className={`border-b border-r border-neutral-200 px-2 py-1.5 transition-colors text-center align-middle ${isBase ? "bg-brand-50/40" : ""}`}>
                      <span className="text-[11px] sm:text-[11.5px] font-semibold text-strong leading-tight break-words [overflow-wrap:anywhere] line-clamp-2 block max-w-full" title={etf.baseIndex || ""}>{etf.baseIndex || "-"}</span>
                    </td>
                  );
                })}
              </tr>

              {/* 순자산 */}
              <tr className="hover:bg-brand-50/20">
                <th className={`sticky left-0 z-20 bg-surface px-2.5 py-1.5 text-xs font-bold text-muted border-b border-r border-line transition-shadow duration-200 text-center align-middle ${shadowClass}`}>
                  <div className="flex items-center justify-center gap-1 group relative w-fit mx-auto">
                    <span>순자산</span>
                    <span className="text-[10px] text-neutral-400 cursor-help">ⓘ</span>
                    <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 w-60 bg-neutral-800/95 backdrop-blur-sm text-white text-[12px] font-medium p-3 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] shadow-xl whitespace-normal leading-relaxed text-left border border-neutral-700/50">
                      <div className="absolute top-1/2 -left-2 -translate-y-1/2 border-[4px] border-transparent border-r-neutral-800/95" />
                      ETF의 총 순자산 규모입니다. 규모가 클수록 상장폐지의 위험이 적고 호가창이 촘촘하여 안정적입니다.
                    </div>
                  </div>
                </th>
                {compareList.map((etf) => {
                  const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                  return (
                    <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-neutral-200 relative px-2 py-1.5 text-center tabular-nums transition-colors ${isBase ? "bg-brand-50/40" : ""} text-strong font-extrabold text-[12px] sm:text-[13px]`}>
                      <div className="flex justify-center items-center gap-1">
                        <span>{formatMoney(etf.aum)}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
              {/* 일일 거래대금 */}
              <tr className="hover:bg-brand-50/20">
                <th className={`sticky left-0 z-20 bg-surface px-2.5 py-1.5 text-xs font-bold text-muted border-b border-r border-line transition-shadow duration-200 text-center align-middle ${shadowClass}`}>
                  <div className="flex items-center justify-center gap-1 group relative w-fit mx-auto">
                    <span>거래대금</span>
                    <span className="text-[10px] text-neutral-400 cursor-help">ⓘ</span>
                    <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 w-60 bg-neutral-800/95 backdrop-blur-sm text-white text-[12px] font-medium p-3 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] shadow-xl whitespace-normal leading-relaxed text-left border border-neutral-700/50">
                      <div className="absolute top-1/2 -left-2 -translate-y-1/2 border-[4px] border-transparent border-r-neutral-800/95" />
                      최근 하루 동안 시장에서 거래된 금액입니다. 클수록 내가 원하는 가격에 매수/매도하기가 수월합니다.
                    </div>
                  </div>
                </th>
                {compareList.map((etf) => {
                  const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                  return (
                    <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-neutral-200 relative px-2 py-1.5 text-center tabular-nums transition-colors ${isBase ? "bg-brand-50/40" : ""} text-strong font-extrabold text-[12px] sm:text-[13px]`}>
                      <div className="flex justify-center items-center gap-1">
                        <span>{formatMoney(etf.tradeValue)}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
              {/* 종가 */}
              <tr className="hover:bg-brand-50/20">
                <th className={`sticky left-0 z-20 bg-surface px-2.5 py-1.5 text-xs font-bold text-muted border-b border-r border-line transition-shadow duration-200 text-center align-middle ${shadowClass}`}>종가</th>
                {compareList.map((etf) => {
                  const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                  return (
                    <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-neutral-200 px-2 py-1.5 text-center tabular-nums font-extrabold text-strong text-[12px] sm:text-[13px] ${isBase ? "bg-brand-50/40" : ""}`}>
                      {formatWon(etf.close)}
                    </td>
                  );
                })}
              </tr>

              {orderedPeriods.map((period, index) => {
                return (
                  <tr key={period} className="hover:bg-brand-50/20">
                    <th className={`sticky left-0 z-20 bg-surface px-2.5 py-1.5 text-xs font-bold text-muted border-b border-r border-line transition-shadow duration-200 text-right align-middle ${shadowClass}`}>
                      {index === 0 ? (
                        <div className="flex justify-between items-center w-full">
                          <span className="text-neutral-700">수익률</span>
                          <span>{RETURN_PERIOD_LABELS[period]}</span>
                        </div>
                      ) : (
                        RETURN_PERIOD_LABELS[period]
                      )}
                    </th>
                    {compareList.map((etf) => {
                      const val = etf.returns[period];
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      return (
                        <td key={`${etf.ticker}-${period}`} className={`whitespace-nowrap border-b border-r border-neutral-200 px-2 py-1.5 text-right tabular-nums transition-colors font-bold ${isBase ? "bg-brand-50/40" : ""}`}>
                          <div className="flex justify-end items-center gap-1">
                            <ReturnCell value={val} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
