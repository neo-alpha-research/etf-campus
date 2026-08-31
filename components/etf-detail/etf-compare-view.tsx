import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/domain/etf-format";
import { ReturnCell, RiskBadge, AsOfDate, FeeStackedBar } from "@/components/etf";
import type { Etf, ReturnPeriod } from "@/lib/domain/etf-types";
import { RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import { getSyntheticFee, isNewEtfForFeeMasking } from "@/lib/domain/etf-fee-utils";

type Props = {
  mainEtf?: Etf;
  basket: Etf[];
  onRemove?: (ticker: string) => void;
  mode?: string;
  selectionReasons?: Map<string, string[]>;
  comparisonProfiles?: Map<string, unknown>;
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
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const corePeriods: ReturnPeriod[] = ["1m", "3m", "6m", "12m", "ytd"];
  const allPeriods: ReturnPeriod[] = ["1d", "1w", "2w", "1m", "2m", "3m", "6m", "12m", "24m", "36m", "ytd"];
  const orderedPeriods = showAllPeriods ? allPeriods : corePeriods;

  const hasDifferentClassification = compareList.some((e) =>
    e.classification?.marketScope !== compareList[0]?.classification?.marketScope ||
    e.classification?.assetClass !== compareList[0]?.classification?.assetClass ||
    e.pension !== compareList[0]?.pension ||
    e.riskType !== compareList[0]?.riskType
  );
  
  const { maxSyntheticFee, lowestSyntheticTicker } = useMemo(() => {
    let max = 0;
    let min = Infinity;
    let lowestTicker = "";
    compareList.forEach(e => {
      if (isNewEtfForFeeMasking(e)) return;
      const fee = getSyntheticFee(e);
      if (fee !== null) {
        if (fee > max) max = fee;
        if (fee < min) { min = fee; lowestTicker = e.ticker; }
      }
    });
    return { maxSyntheticFee: max, lowestSyntheticTicker: lowestTicker };
  }, [compareList]);

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

  const validTrades = compareList.map((e) => e.tradeValue).filter((t): t is number => typeof t === "number" && t > 0);
  const maxTrade = validTrades.length > 0 ? Math.max(...validTrades) : null;

  const validAums = compareList.map((e) => e.aum).filter((a): a is number => typeof a === "number" && a > 0);
  const maxAum = validAums.length > 0 ? Math.max(...validAums) : null;

  const valid1YReturns = compareList
    .map((e) => e.returns?.["12m"])
    .filter((r): r is number => typeof r === "number" && Number.isFinite(r));
  const max1YReturn = valid1YReturns.length > 0 ? Math.max(...valid1YReturns) : null;

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
                        <Link
                          href={`/etf/${etf.ticker}`}
                          onClick={() => {
                            if (typeof window !== "undefined" && window.location.pathname.includes(`/etf/${etf.ticker}`)) {
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }
                          }}
                          className="flex flex-col items-center text-center gap-0.5 group w-full cursor-pointer"
                          title={isBase ? `${etf.name} (${etf.ticker}) [현재 기준 ETF]` : `${etf.name} (${etf.ticker}) 상세 보기`}
                          aria-label={isBase ? `${etf.name} (기준 ETF)` : etf.name}
                        >
                          <span className={`text-[11px] sm:text-[12px] font-extrabold tracking-wider font-mono group-hover:underline transition-colors ${isBase ? "text-brand-800 group-hover:text-brand-900" : "text-neutral-500 group-hover:text-neutral-700"}`}>{etf.ticker}</span>
                          <span className="text-[13px] sm:text-[13.5px] font-black leading-snug break-words [overflow-wrap:anywhere] line-clamp-2 text-strong group-hover:text-brand-700 transition-colors w-full px-0.5 text-center" title={etf.name}>{etf.name}</span>
                        </Link>
                        {compareList.length > 1 && (
                          <div className="flex flex-wrap justify-center gap-1 mt-0.5">
                            {lowestSyntheticTicker === etf.ticker && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-extrabold bg-emerald-100/90 text-emerald-800 border border-emerald-300 shadow-xs"
                                title="비교군 중 실부담비용 최저"
                              >
                                최저 비용 🥇
                              </span>
                            )}
                            {maxTrade !== null && etf.tradeValue === maxTrade && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-extrabold bg-sky-100/90 text-sky-800 border border-sky-300 shadow-xs"
                                title="비교군 중 거래대금 1위 (풍부한 유동성)"
                              >
                                거래대금 1위 💧
                              </span>
                            )}
                            {maxAum !== null && etf.aum === maxAum && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-extrabold bg-indigo-100/90 text-indigo-800 border border-indigo-300 shadow-xs"
                                title="비교군 중 순자산 1위"
                              >
                                순자산 1위 🏛️
                              </span>
                            )}
                            {max1YReturn !== null && etf.returns?.["12m"] === max1YReturn && max1YReturn > 0 && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-extrabold bg-amber-100/90 text-amber-800 border border-amber-300 shadow-xs"
                                title={`1년 수익률 +${max1YReturn.toFixed(1)}% (비교군 1위)`}
                              >
                                1년 성과 1위 📈
                              </span>
                            )}
                          </div>
                        )}
                        {mode === "peer-readonly" && !isBase && (
                          (() => {
                            const cautionReasons = reasons.filter((r) => CAUTION_REASONS.has(r));
                            if (cautionReasons.length === 0) return null;
                            return (
                              <div className="mt-1 flex flex-wrap justify-center gap-1">
                                {cautionReasons.map((reason, idx) => (
                                  <span
                                    key={idx}
                                    data-testid="peer-reason-badge"
                                    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-bold leading-tight border border-amber-300 bg-amber-50 text-amber-900 shadow-xs"
                                  >
                                    <span aria-hidden="true">⚠️</span> {reason}
                                  </span>
                                ))}
                              </div>
                            );
                          })()
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
              {/* 투자 분류 (차이점이 있을 때만 노출) */}
              {hasDifferentClassification && (
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
              )}

              {/* 실부담비용 */}
              <tr className="hover:bg-brand-50/20 hover:z-40 relative">
                <th className={`sticky left-0 z-20 hover:z-50 bg-surface px-2.5 py-1.5 text-xs font-bold text-muted border-b border-r border-line transition-all duration-200 text-center align-middle ${shadowClass}`}>
                  <div className="flex items-center justify-center gap-1 group relative w-fit mx-auto cursor-help">
                    <span>실부담비용</span>
                    <span className="text-[10px] text-neutral-400">ⓘ</span>
                    <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 w-80 p-4 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100]">
                      <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900/98" />
                      <div className="flex items-center justify-between gap-1 mb-2.5 pb-2 border-b border-slate-800">
                        <span className="text-[13px] font-black text-emerald-400">실부담비용이란?</span>
                        <span className="text-[10.5px] font-bold text-slate-300 bg-slate-800 border border-slate-700/80 px-2 py-0.5 rounded-full">
                          실제 차감 총비용
                        </span>
                      </div>
                      <p className="text-[11.5px] text-slate-100 leading-relaxed mb-3 font-normal">
                        광고에 표기되는 <strong>기본 간판 보수</strong> 외에, 펀드 운용 중 발생하는 <strong>모든 숨은 비용(주식 매매수수료 + 회계/전산 유지비)</strong>을 합산한 <strong>투자자 실제 부담 비용</strong>입니다.
                      </p>
                      <div className="space-y-1.5 text-xs bg-slate-800/90 p-3 rounded-lg border border-slate-700/60 mb-3">
                        <div className="flex items-center justify-between text-slate-200">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-brand-400 shrink-0" />
                            <strong className="text-white">명목보수</strong>
                          </span>
                          <span className="text-[11px] text-slate-300">기본 간판 운용 수수료</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-200">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                            <strong className="text-white">기타비용</strong>
                          </span>
                          <span className="text-[11px] text-slate-300">예탁원·지수사용 펀드 유지비</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-200">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                            <strong className="text-white">매매수수료</strong>
                          </span>
                          <span className="text-[11px] text-slate-300">주식 매매 시 발생하는 거래비용</span>
                        </div>
                      </div>
                      <div className="text-[11.5px] text-emerald-300 bg-emerald-950/60 rounded-lg p-2.5 leading-relaxed border border-emerald-800/60">
                        <p className="text-emerald-200 font-medium">
                          별도 납부 없이 매일 펀드 순자산(수익률)에서 자동 차감되므로, <strong>동일 지수를 추종한다면 실부담비용이 낮은 ETF를 선택하는 것이 장기 성과에 유리</strong>합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </th>
                {compareList.map((etf, index) => {
                  const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                  const align =
                    index === compareList.length - 1
                      ? "right"
                      : index === 0
                      ? "left"
                      : "center";
                  return (
                    <td key={etf.ticker} className={`border-b border-r border-neutral-200 px-1 py-1.5 transition-colors align-middle ${isBase ? "bg-brand-50/40" : ""}`}>
                      <FeeStackedBar
                        etf={etf}
                        isLowest={etf.ticker === lowestSyntheticTicker}
                        maxFee={maxSyntheticFee}
                        align={align}
                      />
                    </td>
                  );
                })}
              </tr>

              {/* 순자산 */}
              <tr className="hover:bg-brand-50/20 hover:z-40 relative">
                <th className={`sticky left-0 z-20 hover:z-50 bg-surface px-2.5 py-1.5 text-xs font-bold text-muted border-b border-r border-line transition-all duration-200 text-center align-middle ${shadowClass}`}>
                  <div className="flex items-center justify-center gap-1 group relative w-fit mx-auto cursor-help">
                    <span>순자산</span>
                    <span className="text-[10px] text-neutral-400">ⓘ</span>
                    <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 w-64 p-3 rounded-xl bg-neutral-900/95 backdrop-blur-md text-white text-left shadow-2xl border border-neutral-700/80 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100]">
                      <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-neutral-900/95" />
                      <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-neutral-700/50">
                        <span className="text-[12px] font-black text-brand-300">순자산 (AUM)</span>
                        <span className="text-[10px] text-neutral-400 font-mono">규모</span>
                      </div>
                      <p className="text-[11px] text-neutral-200 leading-snug mb-1.5 font-medium">
                        ETF가 실제로 운용하는 전체 자산의 총 규모입니다.
                      </p>
                      <div className="text-[10.5px] text-amber-200/95 bg-amber-500/10 rounded-md p-1.5 leading-snug border border-amber-500/20">
                        <strong className="text-amber-300">💡 팁:</strong> 규모가 클수록 상장폐지 위험이 낮고 호가가 촘촘하여 매매가 유리합니다.
                      </div>
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
              <tr className="hover:bg-brand-50/20 hover:z-40 relative">
                <th className={`sticky left-0 z-20 hover:z-50 bg-surface px-2.5 py-1.5 text-xs font-bold text-muted border-b border-r border-line transition-all duration-200 text-center align-middle ${shadowClass}`}>
                  <div className="flex items-center justify-center gap-1 group relative w-fit mx-auto cursor-help">
                    <span>거래대금</span>
                    <span className="text-[10px] text-neutral-400">ⓘ</span>
                    <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 w-64 p-3 rounded-xl bg-neutral-900/95 backdrop-blur-md text-white text-left shadow-2xl border border-neutral-700/80 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100]">
                      <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-neutral-900/95" />
                      <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-neutral-700/50">
                        <span className="text-[12px] font-black text-brand-300">거래대금 (유동성)</span>
                        <span className="text-[10px] text-neutral-400 font-mono">1일</span>
                      </div>
                      <p className="text-[11px] text-neutral-200 leading-snug mb-1.5 font-medium">
                        최근 1영업일 동안 시장에서 실제 거래된 총액입니다.
                      </p>
                      <div className="text-[10.5px] text-sky-200/95 bg-sky-500/10 rounded-md p-1.5 leading-snug border border-sky-500/20">
                        <strong className="text-sky-300">💡 팁:</strong> 유동성이 풍부할수록 원하는 가격과 수량으로 즉시 체결하기 수월합니다.
                      </div>
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

              {/* 괴리율 */}
              <tr className="hover:bg-brand-50/20 hover:z-40 relative">
                <th className={`sticky left-0 z-20 hover:z-50 bg-surface px-2.5 py-1.5 text-xs font-bold text-muted border-b border-r border-line transition-all duration-200 text-center align-middle ${shadowClass}`}>
                  <div className="flex items-center justify-center gap-1 group relative w-fit mx-auto cursor-help">
                    <span>괴리율</span>
                    <span className="text-[10px] text-neutral-400">ⓘ</span>
                    <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 w-72 p-3.5 rounded-xl bg-neutral-900/95 backdrop-blur-md text-white text-left shadow-2xl border border-neutral-700/80 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100]">
                      <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-neutral-900/95" />
                      <div className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-neutral-700/50">
                        <span className="text-[12px] font-black text-brand-300">괴리율 (Disparity)</span>
                        <span className="text-[10px] text-neutral-400 font-mono">산식 & 해석</span>
                      </div>
                      
                      {/* 산식 박스 */}
                      <div className="bg-neutral-800/90 rounded px-2 py-1 mb-2 font-mono text-[10.5px] text-brand-200 border border-neutral-700/50">
                        산식: (시장가격 - NAV) ÷ NAV × 100
                      </div>

                      {/* 상태별 직관 가이드 */}
                      <div className="space-y-1 text-[11px] mb-2 leading-tight">
                        <div className="flex items-start gap-1.5">
                          <span className="font-extrabold text-blue-300 shrink-0">• - (음수):</span>
                          <span className="text-neutral-200"><strong className="text-blue-300 font-bold">저평가 (할인)</strong> - 실제가치(NAV)보다 싸게 거래 중</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-extrabold text-rose-300 shrink-0">• + (양수):</span>
                          <span className="text-neutral-200"><strong className="text-rose-300 font-bold">고평가 (웃돈)</strong> - 실제가치(NAV)보다 비싸게 거래 중</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-extrabold text-emerald-300 shrink-0">• 0% 근처:</span>
                          <span className="text-neutral-200"><strong className="text-emerald-300 font-bold">적정가</strong> - 실제가치에 부합하게 정상 거래 중</span>
                        </div>
                      </div>

                      <div className="text-[10.5px] text-amber-200/95 bg-amber-500/10 rounded-md p-1.5 leading-snug border border-amber-500/20">
                        <strong className="text-amber-300">💡 실전 팁:</strong> 매수 시에는 고평가(+)된 ETF보다 적정가 또는 저평가(-) 상태인 ETF를 매수하는 것이 유리합니다.
                      </div>
                    </div>
                  </div>
                </th>
                {compareList.map((etf) => {
                  const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                  const d = etf.disparity;
                  const hasDisparity = typeof d === "number" && Number.isFinite(d);
                  return (
                    <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-neutral-200 px-2 py-1.5 text-center tabular-nums font-bold text-[12px] sm:text-[12.5px] ${isBase ? "bg-brand-50/40" : ""}`}>
                      {hasDisparity ? (
                        <div className="flex items-center justify-center gap-1 font-bold">
                          <span className={d > 0 ? "text-rose-600 font-mono" : d < 0 ? "text-blue-600 font-mono" : "text-neutral-700 font-mono"}>
                            {d > 0 ? `+${d.toFixed(2)}%` : `${d.toFixed(2)}%`}
                          </span>
                          <span
                            className={`text-[9.5px] sm:text-[10px] font-extrabold px-1 py-0.2 rounded border shadow-2xs ${
                              Math.abs(d) <= 0.1
                                ? "text-emerald-800 bg-emerald-50 border-emerald-300"
                                : d > 0
                                ? "text-rose-800 bg-rose-50 border-rose-300"
                                : "text-blue-800 bg-blue-50 border-blue-300"
                            }`}
                            title={Math.abs(d) <= 0.1 ? "실제 가치와 일치하는 적정가 거래 상태" : d > 0 ? "실제 가치(NAV)보다 비싸게 거래되는 고평가(웃돈) 상태" : "실제 가치(NAV)보다 싸게 거래되는 저평가(할인) 상태"}
                          >
                            {Math.abs(d) <= 0.1 ? "적정가" : d > 0 ? "고평가" : "저평가"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
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

              {/* 수익률 행들 (1위 하이라이트 탑재) */}
              {orderedPeriods.map((period, index) => {
                const periodValues = compareList
                  .map((e) => e.returns?.[period])
                  .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
                const maxReturnForPeriod = periodValues.length > 0 ? Math.max(...periodValues) : null;

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
                      const val = etf.returns?.[period];
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      const isTop = maxReturnForPeriod !== null && val === maxReturnForPeriod && compareList.length > 1;
                      return (
                        <td key={`${etf.ticker}-${period}`} className={`whitespace-nowrap border-b border-r border-neutral-200 px-2 py-1.5 text-right tabular-nums transition-colors ${isBase ? "bg-brand-50/40" : ""}`}>
                          <div className="flex justify-end items-center gap-1">
                            {isTop && val != null && (
                              <span
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-black leading-none bg-amber-100/90 text-amber-900 border border-amber-300 shadow-2xs"
                                title="해당 기간 비교군 1위 성과"
                              >
                                1위
                              </span>
                            )}
                            <span className={isTop ? "font-black" : "font-semibold"}>
                              <ReturnCell value={val} />
                            </span>
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

        {/* 기간 더보기 토글 바 */}
        <div className="flex items-center justify-center py-2 px-4 bg-neutral-50/70 border-t border-neutral-200">
          <button
            type="button"
            onClick={() => setShowAllPeriods(!showAllPeriods)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1 text-xs font-bold text-neutral-600 hover:text-brand-800 hover:bg-neutral-200/70 rounded-full transition-all active:scale-95 shadow-xs border border-neutral-200 bg-white"
          >
            <span>{showAllPeriods ? "핵심 기간만 보기 (1개월~1년)" : "전체 세부 기간 보기 (1일~3년)"}</span>
            <span className="text-[10px]">{showAllPeriods ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
