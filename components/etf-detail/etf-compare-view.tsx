import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/domain/etf-format";
import { ReturnCell, RiskBadge, AsOfDate, FeeStackedBar } from "@/components/etf";
import type { Etf, ReturnPeriod } from "@/lib/domain/etf-types";
import { RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import { isNewEtfForFeeMasking, getFeeDisplayContext } from "@/lib/domain/etf-fee-utils";

type Props = {
  mainEtf?: Etf;
  basket: Etf[];
  onRemove?: (ticker: string) => void;
  mode?: string;
  selectionReasons?: Map<string, string[]>;
  comparisonProfiles?: Map<string, unknown>;
  isTrMode?: boolean;
  onToggleTr?: () => void;
};

const CAUTION_REASONS = new Set([
  "환헤지/환노출 불일치",
  "커버드콜 ↔ 일반형 (총수익 비교 주의)",
  "수익 구조 다름 (비교 주의)",
  "만기 구간 다름",
]);

type MetricInfoKey = "pension" | "isa" | "aum" | "tradeValue" | "fee" | "disparity" | "trackingError";

interface MetricInfo {
  title: string;
  badge: string;
  desc: string;
  items?: { label: string; text: string; color?: string }[];
  tip?: string;
}

const METRIC_INFOS: Record<MetricInfoKey, MetricInfo> = {
  pension: {
    title: "퇴직연금 (DC·IRP) 편입 한도",
    badge: "감독규정",
    desc: "퇴직연금감독규정 제12조에 따른 계좌 내 편입 가능 한도입니다.",
    items: [
      { label: "100% (안전자산)", text: "채권형 등 전액 편입 가능", color: "text-emerald-300" },
      { label: "70% (위험자산)", text: "주식형 등 최대 70%까지 가능", color: "text-blue-300" },
      { label: "불가", text: "레버리지·선물파생 등 편입 제한", color: "text-neutral-400" },
    ],
  },
  isa: {
    title: "중개형 ISA 편입",
    badge: "절세 계좌",
    desc: "조세특례제한법상 중개형 ISA 계좌 편입 가능 여부입니다.",
    items: [
      { label: "일반 ETF", text: "전액 비과세/분리과세 혜택 가능", color: "text-indigo-300" },
      { label: "레버리지/인버스", text: "금융투자교육원 사전교육 및 기본예탁금 필요", color: "text-amber-300" },
    ],
  },
  aum: {
    title: "순자산 (AUM)",
    badge: "규모",
    desc: "ETF가 실제로 운용하는 전체 자산의 총 규모입니다.",
    tip: "규모가 클수록 상장폐지 위험이 낮고 호가가 촘촘하여 매매가 유리합니다.",
  },
  tradeValue: {
    title: "일일 거래대금",
    badge: "유동성 (1일)",
    desc: "최근 1영업일 동안 시장에서 실제 거래된 총액입니다.",
    tip: "유동성이 풍부할수록 원하는 가격과 수량으로 즉시 체결하기 수월합니다.",
  },
  fee: {
    title: "실부담비용이란?",
    badge: "실제 차감 총비용",
    desc: "기본 간판 운용보수 외에 숨은 비용(주식 매매중개수수료 + 회계/전산 기타비용)을 합산한 투자자 실제 부담 총비용입니다.",
    items: [
      { label: "명목보수", text: "기본 간판 운용 수수료", color: "text-brand-300" },
      { label: "기타비용", text: "예탁원·지수사용 펀드 유지비", color: "text-sky-300" },
      { label: "매매수수료", text: "주식 매매 시 발생하는 거래비용", color: "text-orange-300" },
    ],
    tip: "별도 납부 없이 매일 펀드 순자산(수익률)에서 자동 차감되므로, 동일 지수를 추종한다면 실부담비용이 낮은 ETF를 선택하는 것이 장기 성과에 유리합니다.",
  },
  disparity: {
    title: "괴리율이란?",
    badge: "시장가 vs 실제가치",
    desc: "주식시장에서 거래되는 현재 가격이 ETF의 진짜 가치(NAV) 대비 얼마나 웃돈이나 할인이 붙었는지 나타내는 지표입니다.",
    items: [
      { label: "+ (양수)", text: "실제 가치보다 웃돈(고평가)을 주고 사는 상태", color: "text-rose-400" },
      { label: "- (음수)", text: "실제 가치보다 할인(저평가)되어 싸게 사는 상태", color: "text-blue-400" },
    ],
    tip: "국내 ETF는 +0.5%, 해외 ETF는 +1.0% 이상 비정상적으로 웃돈이 붙었을 때 [고평가 주의] 경고가 켜집니다.",
  },
  trackingError: {
    title: "추적오차율이란?",
    badge: "배당 조정 (TR)",
    desc: "과거 1년간 ETF 순자산가치(NAV)가 목표 기초지수를 얼마나 똑같이 따라갔는지 나타내는 운용 복제 정밀도(표준편차)입니다.",
    tip: "배당금(분배금) 효과를 금융공학적으로 보정한 [순수 운용 추적오차(TR 기준)]이며, 숫자가 낮을수록 지수를 오차 없이 안정적으로 복제하고 있음을 의미합니다.",
  },
};

export function EtfCompareView({
  mainEtf,
  basket,
  onRemove = () => {},
  mode,
  selectionReasons,
  isTrMode: controlledTrMode,
  onToggleTr,
}: Props) {
  const compareList = useMemo(() => {
    if (!mainEtf) return basket;
    const filtered = basket.filter((e) => e.ticker !== mainEtf.ticker);
    return [mainEtf, ...filtered];
  }, [mainEtf, basket]);

  const [viewMode, setViewMode] = useState<"summary" | "detailed">("detailed");
  const [summaryPeriod, setSummaryPeriod] = useState<ReturnPeriod>("12m");
  const [activeMetricModal, setActiveMetricModal] = useState<MetricInfoKey | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const [internalTrMode, setInternalTrMode] = useState(false);

  // Switch to summary view automatically on mobile when 3+ ETFs are compared
  useEffect(() => {
    const mql = typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)") : null;
    if (mql?.matches && compareList.length >= 3) {
      const raf = requestAnimationFrame(() => {
        setViewMode("summary");
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [compareList.length]);

  const isTrMode = controlledTrMode !== undefined ? controlledTrMode : internalTrMode;
  const handleToggleTr = onToggleTr || (() => setInternalTrMode((prev) => !prev));
  
  const getActiveReturns = (etf: Etf) => isTrMode ? (etf.returnsTr || etf.returnsNetTr) : etf.returns;

  const corePeriods: ReturnPeriod[] = ["1m", "3m", "6m", "12m", "ytd"];
  const allPeriods: ReturnPeriod[] = ["1d", "1w", "2w", "1m", "2m", "3m", "6m", "12m", "24m", "36m", "ytd", "itd"];
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
      const ctx = getFeeDisplayContext(e);
      // ONLY ETFs with 100% verified 3-tier synthetic fee can receive lowest badge
      if (ctx.type === "synthetic" && ctx.syntheticFee !== null) {
        if (ctx.syntheticFee > max) max = ctx.syntheticFee;
        if (ctx.syntheticFee < min) { min = ctx.syntheticFee; lowestTicker = e.ticker; }
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
    .map((e) => getActiveReturns(e)?.["12m"])
    .filter((r): r is number => typeof r === "number" && Number.isFinite(r));
  const max1YReturn = valid1YReturns.length > 0 ? Math.max(...valid1YReturns) : null;

  return (
    <div className="space-y-3">
      {/* View Mode Switcher and Date Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="inline-flex p-1 rounded-xl bg-neutral-100 border border-neutral-200 text-xs font-bold w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewMode("detailed")}
            className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewMode === "detailed"
                ? "bg-white text-brand-800 shadow-xs font-black"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <span>📊 상세 스펙 비교표</span>
            <span className="text-[10px] text-neutral-400 font-normal hidden sm:inline">(좌우 스크롤)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("summary")}
            className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewMode === "summary"
                ? "bg-white text-brand-800 shadow-xs font-black"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <span>⚡ 5종목 한눈에 뷰</span>
            {compareList.length >= 3 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-brand-100 text-brand-700 font-black">
                추천
              </span>
            )}
          </button>
        </div>

        {mode !== "peer-readonly" && (
          <div className="flex justify-end items-center pr-1 text-xs text-neutral-500">
            <AsOfDate value={compareList[0]?.asOfDate} />
          </div>
        )}
      </div>

      {/* VIEW 1: 5-ETF TRANSPOSED SUMMARY VIEW */}
      {viewMode === "summary" && (
        <div className="relative rounded-2xl border border-line bg-surface overflow-hidden shadow-sm animate-in fade-in duration-200">
          {/* Period selector toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-neutral-600 text-[11px] sm:text-xs">수익률 기준:</span>
              <div className="inline-flex rounded-lg bg-neutral-200/80 p-0.5">
                {(["1m", "3m", "6m", "12m", "ytd"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSummaryPeriod(p)}
                    className={`px-2 py-0.5 sm:py-1 rounded-md text-[11px] font-bold transition-all ${
                      summaryPeriod === p
                        ? "bg-white text-brand-800 shadow-2xs font-black"
                        : "text-neutral-600 hover:text-neutral-900"
                    }`}
                  >
                    {RETURN_PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={isTrMode}
                onClick={handleToggleTr}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-neutral-600 bg-white border border-neutral-200 rounded-lg shadow-2xs hover:text-brand-800 active:scale-95"
              >
                <span>TR {isTrMode ? "ON" : "OFF"}</span>
                <div className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${isTrMode ? 'bg-brand-600' : 'bg-neutral-300'}`}>
                  <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${isTrMode ? 'translate-x-3' : 'translate-x-0.5'}`} />
                </div>
              </button>
            </div>
          </div>

          {/* Transposed Table: 5 ETFs as rows, fits 100% mobile viewport */}
          <div className="overflow-x-hidden">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="bg-neutral-100 border-b border-neutral-200 text-[11px] font-black text-neutral-600">
                <tr>
                  <th className="py-2.5 px-2 sm:px-3 w-[35%] text-left">ETF 종목</th>
                  <th className="py-2.5 px-1 sm:px-1.5 w-[21%] text-right whitespace-nowrap">
                    {RETURN_PERIOD_LABELS[summaryPeriod]} 수익률
                  </th>
                  <th className="py-2.5 px-1 sm:px-1.5 w-[17%] text-center whitespace-nowrap">
                    실부담비용
                  </th>
                  <th className="py-2.5 px-1.5 sm:px-3 w-[27%] text-right whitespace-nowrap">
                    순자산/연금
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {compareList.map((etf) => {
                  const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                  const returnVal = getActiveReturns(etf)?.[summaryPeriod] ?? null;
                  const periodValues = compareList
                    .map((e) => getActiveReturns(e)?.[summaryPeriod])
                    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
                  const maxPeriodVal = periodValues.length > 0 ? Math.max(...periodValues) : null;
                  const isTopReturn = maxPeriodVal !== null && maxPeriodVal > 0 && returnVal === maxPeriodVal && compareList.length > 1;

                  const feeCtx = getFeeDisplayContext(etf);
                  const isLowestFee = etf.ticker === lowestSyntheticTicker;

                  const isTopAum = maxAum !== null && etf.aum === maxAum && compareList.length > 1;
                  const isTopTrade = maxTrade !== null && etf.tradeValue === maxTrade && compareList.length > 1;

                  return (
                    <tr
                      key={etf.ticker}
                      className={`hover:bg-neutral-50/80 transition-colors ${
                        isBase ? "bg-brand-50/30 font-semibold" : ""
                      }`}
                    >
                      {/* ETF 종목 info */}
                      <td className="py-2.5 px-2 sm:px-3 align-middle">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-mono font-extrabold text-neutral-400">
                                {etf.ticker}
                              </span>
                              {isBase && (
                                <span className="text-[9px] font-black px-1 rounded bg-brand-100 text-brand-800">
                                  기준
                                </span>
                              )}
                            </div>
                            {!isBase && mode !== "peer-readonly" && (
                              <button
                                type="button"
                                onClick={() => onRemove(etf.ticker)}
                                className="p-0.5 text-rose-400 hover:text-rose-600 transition-colors active:scale-90"
                                aria-label={`${etf.name} 제외하기`}
                                title="제외하기"
                              >
                                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <Link
                            href={`/etf/${etf.ticker}`}
                            className="text-[12px] sm:text-[13px] font-black text-strong hover:text-brand-700 transition-colors line-clamp-1 break-words"
                            title={etf.name}
                          >
                            {etf.name}
                          </Link>
                          {/* Smart Advantage Chips */}
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {isLowestFee && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200"
                              >
                                최저 🥇
                              </span>
                            )}
                            {isTopReturn && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200"
                              >
                                1위 📈
                              </span>
                            )}
                            {isTopAum && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200"
                              >
                                규모 🏛️
                              </span>
                            )}
                            {isTopTrade && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-sky-100 text-sky-800 border border-sky-200"
                              >
                                유동 💧
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 수익률 */}
                      <td className="py-2.5 px-1 sm:px-1.5 text-right align-middle whitespace-nowrap tabular-nums font-mono">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`text-[11.5px] sm:text-[13px] font-black ${isTopReturn ? "text-rose-600" : ""}`}>
                            <ReturnCell value={returnVal} isTr={isTrMode} />
                          </span>
                          {isTopReturn && (
                            <span className="text-[8px] sm:text-[8.5px] font-black text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 font-sans">
                              1위
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 실부담비용 */}
                      <td className="py-2.5 px-1 sm:px-1.5 text-center align-middle whitespace-nowrap tabular-nums font-mono">
                        <div className="flex flex-col items-center gap-0.5">
                          {feeCtx.type === "masked_new" ? (
                            <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-1 py-0.5 rounded font-sans">
                              신규상장*
                            </span>
                          ) : feeCtx.syntheticFee !== null ? (
                            <div className="flex items-center justify-center gap-0.5 text-[11px] sm:text-[12px] font-extrabold text-neutral-800">
                              <span>{feeCtx.syntheticFee.toFixed(2)}%</span>
                              {isLowestFee && (
                                <span className="text-[8.5px] text-emerald-700 font-sans font-black">
                                  🥇
                                </span>
                              )}
                            </div>
                          ) : feeCtx.nominalFee !== null ? (
                            <span className="text-[10.5px] font-bold text-neutral-600">
                              {feeCtx.nominalFee.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-neutral-400">-</span>
                          )}
                        </div>
                      </td>

                      {/* 순자산 / 연금 */}
                      <td className="py-2.5 px-1.5 sm:px-3 text-right align-middle whitespace-nowrap tabular-nums">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[10.5px] sm:text-[12px] font-extrabold text-neutral-800 font-mono tracking-tight">
                            {formatMoney(etf.aum)}
                          </span>
                          <span className={`text-[8.5px] sm:text-[9px] font-bold px-1 py-0.2 rounded border ${
                            etf.pensionLimit?.includes("100%")
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : etf.pensionLimit?.includes("70%")
                              ? "border-blue-300 bg-blue-50 text-blue-700"
                              : etf.pension === "가능"
                              ? "border-brand-200 bg-brand-50 text-brand-700"
                              : "border-neutral-200 bg-neutral-100 text-neutral-400"
                          }`}>
                            {etf.pensionLimit ? (etf.pensionLimit.includes("100%") ? "안전 100%" : etf.pensionLimit.includes("70%") ? "위험 70%" : etf.pensionLimit) : (etf.pension === "가능" ? "연금가능" : "연금불가")}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div className="px-3 sm:px-4 py-2 bg-neutral-50/70 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10.5px] text-neutral-400">
            <span>* 괴리율, 추적오차율 등 세부 데이터는 [상세 스펙 비교표] 탭에서 확인하실 수 있습니다.</span>
            <span className="font-mono">{compareList[0]?.asOfDate ? `${compareList[0].asOfDate.replace(/-/g, ".")} 기준` : ""}</span>
          </div>
        </div>
      )}

      {/* VIEW 2: DETAILED SIDE-BY-SIDE COMPARISON TABLE */}
      {viewMode === "detailed" && (
        <div className="relative rounded-2xl border border-line bg-surface overflow-hidden shadow-sm animate-in fade-in duration-200">
          <div 
            ref={scrollRef}
            className="relative text-center overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]" 
            role="region" 
            aria-label="ETF 비교 표. 좌우로 스크롤할 수 있습니다." 
            tabIndex={0}
          >
            <table className="min-w-full w-max border-separate border-spacing-0 whitespace-nowrap text-sm">
              <thead className="shadow-[0_2px_0_0_#e5e7eb]">
                <tr>
                  <th className={`sticky left-0 z-40 w-[76px] min-w-[76px] max-w-[80px] sm:w-[100px] sm:min-w-[100px] sm:max-w-[108px] bg-neutral-100 backdrop-blur px-1.5 sm:px-2.5 py-2.5 sm:py-3 text-[11px] sm:text-sm font-extrabold text-neutral-700 border-b border-r border-line transition-shadow duration-200 align-middle text-center ${shadowClass}`}>비교 항목</th>
                  {compareList.map((etf) => {
                    const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                    const reasons = selectionReasons?.get(etf.ticker) || [];
                    return (
                      <th key={etf.ticker} className={`relative px-1.5 sm:px-2.5 py-2.5 sm:py-3 w-[126px] min-w-[126px] sm:w-[160px] sm:min-w-[160px] border-b border-r border-neutral-200 font-bold text-strong align-top transition-colors ${isBase ? "bg-brand-100/80 shadow-[inset_0_3px_0_0_#0f766e]" : "bg-neutral-100 backdrop-blur"}`}>
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
                            <span className={`text-[10.5px] sm:text-[12px] font-extrabold tracking-wider font-mono group-hover:underline transition-colors ${isBase ? "text-brand-800 group-hover:text-brand-900" : "text-neutral-500 group-hover:text-neutral-700"}`}>{etf.ticker}</span>
                            <span className="text-[12px] sm:text-[13.5px] font-black leading-snug break-words [overflow-wrap:anywhere] line-clamp-2 text-strong group-hover:text-brand-700 transition-colors w-full px-0.5 text-center" title={etf.name}>{etf.name}</span>
                          </Link>
                          {compareList.length > 1 && (
                            <div className="flex flex-wrap justify-center gap-1 mt-0.5">
                              {lowestSyntheticTicker === etf.ticker && (
                                <span
                                  data-testid="smart-advantage-badge"
                                  className="inline-flex items-center rounded px-1 sm:px-1.5 py-0.5 text-[8.5px] sm:text-[10px] font-extrabold bg-emerald-100/90 text-emerald-800 border border-emerald-300 shadow-xs"
                                  title="비교군 중 실부담비용 최저"
                                >
                                  최저 비용 🥇
                                </span>
                              )}
                              {maxTrade !== null && etf.tradeValue === maxTrade && (
                                <span
                                  data-testid="smart-advantage-badge"
                                  className="inline-flex items-center rounded px-1 sm:px-1.5 py-0.5 text-[8.5px] sm:text-[10px] font-extrabold bg-sky-100/90 text-sky-800 border border-sky-300 shadow-xs"
                                  title="비교군 중 거래대금 1위 (풍부한 유동성)"
                                >
                                  거래대금 1위 💧
                                </span>
                              )}
                              {maxAum !== null && etf.aum === maxAum && (
                                <span
                                  data-testid="smart-advantage-badge"
                                  className="inline-flex items-center rounded px-1 sm:px-1.5 py-0.5 text-[8.5px] sm:text-[10px] font-extrabold bg-indigo-100/90 text-indigo-800 border border-indigo-300 shadow-xs"
                                  title="비교군 중 순자산 1위"
                                >
                                  순자산 1위 🏛️
                                </span>
                              )}
                              {max1YReturn !== null && getActiveReturns(etf)?.["12m"] === max1YReturn && max1YReturn > 0 && (
                                <span
                                  data-testid="smart-advantage-badge"
                                  className="inline-flex items-center rounded px-1 sm:px-1.5 py-0.5 text-[8.5px] sm:text-[10px] font-extrabold bg-amber-100/90 text-amber-800 border border-amber-300 shadow-xs"
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
                                      className="inline-flex items-center gap-0.5 rounded px-1 sm:px-1.5 py-0.5 text-[8.5px] sm:text-[10px] font-bold leading-tight border border-amber-300 bg-amber-50 text-amber-900 shadow-xs"
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
                              className="absolute right-1 top-1 sm:right-1.5 sm:top-1.5 p-1 text-rose-400 hover:text-rose-600 transition-all duration-200 flex items-center justify-center group/btn active:scale-90"
                              aria-label={`${etf.name} 제외하기`}
                              title="제외하기"
                            >
                              <svg className="size-3.5 sm:size-4 transition-transform duration-200 group-hover/btn:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
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
                    <th className={`sticky left-0 z-20 bg-surface px-1 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-muted border-b border-r border-line transition-shadow duration-200 text-center align-middle ${shadowClass}`}>투자 분류</th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      return (
                        <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-neutral-200 px-1 sm:px-2 py-1.5 transition-colors ${isBase ? "bg-brand-50/40" : ""}`}>
                          <div className="flex flex-wrap justify-center gap-1 items-center overflow-hidden [&_span]:!px-1.5 [&_span]:!py-0.5 [&_span]:!text-[10px] sm:[&_span]:!text-[10.5px]">
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

                {/* 퇴직연금 (DC·IRP) 한도 */}
                <tr className="hover:bg-brand-50/20 hover:z-40 relative">
                  <th className={`sticky left-0 z-20 hover:z-50 bg-surface px-1 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-muted border-b border-r border-line transition-all duration-200 text-center align-middle ${shadowClass}`}>
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 group relative w-fit mx-auto">
                      <button
                        type="button"
                        onClick={() => setActiveMetricModal("pension")}
                        aria-label="퇴직연금 (DC·IRP) 편입 한도 안내 보기"
                        className="inline-flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-sm"
                      >
                        <span className="leading-tight">퇴직연금 한도</span>
                        <span className="text-[10px] text-neutral-400 font-sans" aria-hidden="true">ⓘ</span>
                      </button>
                      <div className="hidden sm:block absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 w-64 p-3 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                        <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900/98" />
                        <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-700/60">
                          <span className="text-[12.5px] font-black text-brand-300">퇴직연금 (DC·IRP) 편입 한도</span>
                          <span className="text-[10px] text-slate-400 font-mono">감독규정</span>
                        </div>
                        <p className="text-[12px] text-neutral-200 leading-snug mb-1.5 font-medium">
                          퇴직연금감독규정 제12조에 따른 계좌 내 편입 가능 한도입니다.
                        </p>
                        <div className="text-[11.5px] text-neutral-300 space-y-1">
                          <div><strong className="text-emerald-300">100% (안전자산):</strong> 채권형 등 전액 편입 가능</div>
                          <div><strong className="text-blue-300">70% (위험자산):</strong> 주식형 등 최대 70%까지 가능</div>
                          <div><strong className="text-neutral-400">불가:</strong> 레버리지·선물파생 등 편입 제한</div>
                        </div>
                      </div>
                    </div>
                  </th>
                  {compareList.map((etf) => {
                    const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                    const limit = etf.pensionLimit;
                    const is100 = limit === "100% (안전자산)";
                    const is70 = limit === "70% (위험자산)";
                    const isSpecialCd = ["357870", "477080"].includes(etf.ticker);
                    const isSpecialKiwoom = etf.ticker === "0198A0";
                    return (
                      <td key={`pension-${etf.ticker}`} className={`whitespace-nowrap border-b border-r border-neutral-200 px-1 sm:px-2 py-1.5 text-center transition-colors ${isBase ? "bg-brand-50/40" : ""}`}>
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] sm:text-[11px] font-bold border ${
                            is100
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : is70
                              ? "border-blue-300 bg-blue-50 text-blue-700"
                              : etf.pension === "가능"
                              ? "border-brand-300 bg-brand-50 text-brand-700"
                              : "border-neutral-200 bg-neutral-100 text-neutral-400"
                          }`}>
                            {limit ? (is100 ? "안전 100%" : is70 ? "위험 70%" : limit) : (etf.pension === "가능" ? "편입 가능" : "불가")}
                          </span>
                          {isSpecialCd && (
                            <span className="text-[9px] text-amber-700 font-medium leading-tight">
                              *증권사별 100% 가능
                            </span>
                          )}
                          {isSpecialKiwoom && (
                            <span className="text-[9px] text-neutral-500 font-medium leading-tight">
                              *일부 증권사 미취급
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* 중개형 ISA */}
                <tr className="hover:bg-brand-50/20 hover:z-40 relative">
                  <th className={`sticky left-0 z-20 hover:z-50 bg-surface px-1 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-muted border-b border-r border-line transition-all duration-200 text-center align-middle ${shadowClass}`}>
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 group relative w-fit mx-auto">
                      <button
                        type="button"
                        onClick={() => setActiveMetricModal("isa")}
                        aria-label="중개형 ISA 편입 혜택 안내 보기"
                        className="inline-flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-sm"
                      >
                        <span className="leading-tight">중개형 ISA</span>
                        <span className="text-[10px] text-neutral-400 font-sans" aria-hidden="true">ⓘ</span>
                      </button>
                      <div className="hidden sm:block absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 w-64 p-3 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                        <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900/98" />
                        <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-700/60">
                          <span className="text-[12.5px] font-black text-brand-300">중개형 ISA 편입</span>
                          <span className="text-[10px] text-slate-400 font-mono">절세 계좌</span>
                        </div>
                        <p className="text-[12px] text-neutral-200 leading-snug mb-1.5 font-medium">
                          조세특례제한법상 중개형 ISA 계좌 편입 가능 여부입니다.
                        </p>
                        <div className="text-[11.5px] text-neutral-300">
                          레버리지/인버스 ETF는 금융투자교육원 사전교육 및 기본예탁금이 필요합니다.
                        </div>
                      </div>
                    </div>
                  </th>
                  {compareList.map((etf) => {
                    const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                    const isEdu = etf.riskType === "leverage" || etf.isaEducationRequired === "Y";
                    return (
                      <td key={`isa-${etf.ticker}`} className={`whitespace-nowrap border-b border-r border-neutral-200 px-1 sm:px-2 py-1.5 text-center transition-colors ${isBase ? "bg-brand-50/40" : ""}`}>
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] sm:text-[11px] font-bold border ${
                          isEdu
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : "border-indigo-300 bg-indigo-50 text-indigo-700"
                        }`}>
                          {isEdu ? "가능 (교육필요)" : "편입 가능"}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* 순자산 */}
                <tr className="hover:bg-brand-50/20 hover:z-40 relative">
                  <th className={`sticky left-0 z-20 hover:z-50 bg-surface px-1 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-muted border-b border-r border-line transition-all duration-200 text-center align-middle ${shadowClass}`}>
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 group relative w-fit mx-auto">
                      <button
                        type="button"
                        onClick={() => setActiveMetricModal("aum")}
                        aria-label="순자산 (AUM) 안내 보기"
                        className="inline-flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-sm"
                      >
                        <span className="leading-tight">순자산</span>
                        <span className="text-[10px] text-neutral-400 font-sans" aria-hidden="true">ⓘ</span>
                      </button>
                      <div className="hidden sm:block absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 w-64 p-3 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                        <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900/98" />
                        <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-700/60">
                          <span className="text-[12.5px] font-black text-brand-300">순자산 (AUM)</span>
                          <span className="text-[10px] text-slate-400 font-mono">규모</span>
                        </div>
                        <p className="text-[12px] text-neutral-200 leading-snug mb-1.5 font-medium">
                          ETF가 실제로 운용하는 전체 자산의 총 규모입니다.
                        </p>
                        <div className="text-[11.5px] text-amber-200/95 bg-amber-500/10 rounded-md p-1.5 leading-snug border border-amber-500/20">
                          <strong className="text-amber-300">💡 팁:</strong> 규모가 클수록 상장폐지 위험이 낮고 호가가 촘촘하여 매매가 유리합니다.
                        </div>
                      </div>
                    </div>
                  </th>
                  {compareList.map((etf) => {
                    const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                    return (
                      <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-neutral-200 relative px-1 sm:px-2 py-1.5 text-center tabular-nums transition-colors ${isBase ? "bg-brand-50/40" : ""} text-strong font-extrabold text-[11.5px] sm:text-[13px]`}>
                        <div className="flex justify-center items-center gap-1 font-mono">
                          <span>{formatMoney(etf.aum)}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* 일일 거래대금 */}
                <tr className="hover:bg-brand-50/20 hover:z-40 relative">
                  <th className={`sticky left-0 z-20 hover:z-50 bg-surface px-1 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-muted border-b border-r border-line transition-all duration-200 text-center align-middle ${shadowClass}`}>
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 group relative w-fit mx-auto">
                      <button
                        type="button"
                        onClick={() => setActiveMetricModal("tradeValue")}
                        aria-label="일일 거래대금 (유동성) 안내 보기"
                        className="inline-flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-sm"
                      >
                        <span className="leading-tight">거래대금</span>
                        <span className="text-[10px] text-neutral-400 font-sans" aria-hidden="true">ⓘ</span>
                      </button>
                      <div className="hidden sm:block absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 w-64 p-3 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                        <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900/98" />
                        <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-700/60">
                          <span className="text-[12.5px] font-black text-brand-300">거래대금 (유동성)</span>
                          <span className="text-[10px] text-slate-400 font-mono">1일</span>
                        </div>
                        <p className="text-[12px] text-neutral-200 leading-snug mb-1.5 font-medium">
                          최근 1영업일 동안 시장에서 실제 거래된 총액입니다.
                        </p>
                        <div className="text-[11.5px] text-sky-200/95 bg-sky-500/10 rounded-md p-1.5 leading-snug border border-sky-500/20">
                          <strong className="text-sky-300">💡 팁:</strong> 유동성이 풍부할수록 원하는 가격과 수량으로 즉시 체결하기 수월합니다.
                        </div>
                      </div>
                    </div>
                  </th>
                  {compareList.map((etf) => {
                    const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                    return (
                      <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-neutral-200 relative px-1 sm:px-2 py-1.5 text-center tabular-nums transition-colors ${isBase ? "bg-brand-50/40" : ""} text-strong font-extrabold text-[11.5px] sm:text-[13px]`}>
                        <div className="flex justify-center items-center gap-1 font-mono">
                          <span>{formatMoney(etf.tradeValue)}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* 수익률 행들 (1위 하이라이트 탑재) */}
                {orderedPeriods.map((period, index) => {
                  const periodValues = compareList
                    .map((e) => getActiveReturns(e)?.[period])
                    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
                  const maxReturnForPeriod = periodValues.length > 0 ? Math.max(...periodValues) : null;

                  return (
                    <tr key={period} className="hover:bg-brand-50/20">
                      <th className={`sticky left-0 z-20 bg-surface px-1 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-muted border-b border-r border-line transition-shadow duration-200 text-right align-middle ${shadowClass}`}>
                        {index === 0 ? (
                          <div className="flex justify-between items-center w-full">
                            <span className="text-neutral-700 hidden sm:inline">수익률</span>
                            <div className="flex items-center gap-1 ml-auto">
                              <button
                                type="button"
                                onClick={() => setShowAllPeriods((prev) => !prev)}
                                className="inline-flex items-center gap-0.5 text-[9.5px] sm:text-[10px] font-extrabold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-1 sm:px-1.5 py-0.5 rounded border border-brand-200 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                                title={showAllPeriods ? "핵심 5개 기간(1m~1y)만 보기" : "1일~3년 전체 12개 기간 펼치기"}
                              >
                                <span>{showAllPeriods ? "핵심" : "세부+"}</span>
                                <span className="text-[8px]">{showAllPeriods ? "▲" : "▼"}</span>
                              </button>
                              <span className="font-sans">{RETURN_PERIOD_LABELS[period]}</span>
                            </div>
                          </div>
                        ) : (
                          RETURN_PERIOD_LABELS[period]
                        )}
                      </th>
                      {compareList.map((etf) => {
                        const val = getActiveReturns(etf)?.[period] ?? null;
                        const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                        // 1위 뱃지는 양수 수익률(> 0)에서만 노출 (자본시장 정서 및 컴플라이언스 준수)
                        const isTop = maxReturnForPeriod !== null && maxReturnForPeriod > 0 && val === maxReturnForPeriod && compareList.length > 1;
                        return (
                          <td key={`${etf.ticker}-${period}`} className={`whitespace-nowrap border-b border-r border-neutral-200 px-1 sm:px-2 py-1.5 text-right tabular-nums transition-colors ${isBase ? "bg-brand-50/40" : ""}`}>
                            <div className="flex justify-end items-center gap-0.5 sm:gap-1 font-mono">
                              {isTop && val != null && (
                                <span
                                  className="inline-flex items-center rounded px-1 sm:px-1.5 py-0.5 text-[8.5px] sm:text-[9px] font-black leading-none bg-amber-100/90 text-amber-900 border border-amber-300 shadow-2xs font-sans"
                                  title="해당 기간 비교군 1위 성과"
                                >
                                  1위
                                </span>
                              )}
                              <span className={isTop ? "font-black" : "font-semibold"}>
                                <ReturnCell value={val} isTr={isTrMode} />
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* 실부담비용 (수익률 바로 아래 배치) */}
                <tr className="hover:bg-brand-50/20 hover:z-40 relative">
                  <th className={`sticky left-0 z-20 hover:z-50 bg-surface px-1 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-muted border-b border-r border-line transition-all duration-200 text-center align-middle ${shadowClass}`}>
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 group relative w-fit mx-auto">
                      <button
                        type="button"
                        onClick={() => setActiveMetricModal("fee")}
                        aria-label="실부담비용 상세 안내 보기"
                        className="inline-flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-sm"
                      >
                        <span className="leading-tight">실부담비용</span>
                        <span className="text-[10px] text-neutral-400 font-sans" aria-hidden="true">ⓘ</span>
                      </button>
                      <div className="hidden sm:block absolute left-[calc(100%+10px)] bottom-[-20px] w-80 p-4 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                        <div className="absolute bottom-6 -left-1.5 border-[6px] border-transparent border-r-slate-900/98" />
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
                              <span className="w-2.5 h-2.5 rounded-full bg-brand-400 shrink-0" />
                              <strong className="text-white">명목보수</strong>
                            </span>
                            <span className="text-[11px] text-slate-300">기본 간판 운용 수수료</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-200">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
                              <strong className="text-white">기타비용</strong>
                            </span>
                            <span className="text-[11px] text-slate-300">예탁원·지수사용 펀드 유지비</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-200">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" />
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
                      <td key={etf.ticker} className={`border-b border-r border-neutral-200 px-1 py-1.5 transition-colors align-middle whitespace-nowrap tabular-nums ${isBase ? "bg-brand-50/40" : ""}`}>
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

                {/* 괴리율 */}
                <tr className="hover:bg-brand-50/20 hover:z-40 relative">
                  <th className={`sticky left-0 z-20 hover:z-50 bg-surface px-1 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-muted border-b border-r border-line transition-all duration-200 text-center align-middle ${shadowClass}`}>
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 group relative w-fit mx-auto">
                      <button
                        type="button"
                        onClick={() => setActiveMetricModal("disparity")}
                        aria-label="괴리율 상세 안내 보기"
                        className="inline-flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-sm"
                      >
                        <span className="leading-tight">괴리율</span>
                        <span className="text-[10px] text-neutral-400 font-sans" aria-hidden="true">ⓘ</span>
                      </button>
                      <div className="hidden sm:block absolute left-[calc(100%+10px)] bottom-[-20px] w-80 p-4 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                        <div className="absolute bottom-6 -left-1.5 border-[6px] border-transparent border-r-slate-900/98" />
                        <div className="flex items-center justify-between gap-1 mb-2.5 pb-2 border-b border-slate-800">
                          <span className="text-[13px] font-black text-emerald-400">괴리율이란?</span>
                          <span className="text-[10px] text-neutral-400 font-mono bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                            시장가 vs 실제가치
                          </span>
                        </div>
                        <p className="text-xs text-slate-100 leading-relaxed mb-3 font-normal">
                          주식시장에서 거래되는 <strong>현재 가격이 ETF의 진짜 가치(NAV) 대비 얼마나 웃돈이나 할인이 붙었는지</strong> 나타내는 지표입니다.
                        </p>
                        <div className="space-y-1.5 text-xs bg-slate-800/90 p-3 rounded-lg border border-slate-700/60 mb-3">
                          <div className="flex items-start gap-2 text-slate-200">
                            <span className="text-rose-400 font-bold shrink-0">• + (양수):</span>
                            <span>실제 가치보다 <strong>웃돈(고평가)</strong>을 주고 사는 상태</span>
                          </div>
                          <div className="flex items-start gap-2 text-slate-200">
                            <span className="text-blue-400 font-bold shrink-0">• - (음수):</span>
                            <span>실제 가치보다 <strong>할인(저평가)</strong>되어 싸게 사는 상태</span>
                          </div>
                        </div>
                        <div className="text-[11.5px] text-amber-300 bg-amber-950/60 rounded-lg p-2.5 leading-relaxed border border-amber-800/60">
                          <strong className="text-amber-200 block mb-0.5">⚠️ 고평가 주의 기준:</strong>
                          국내 ETF는 +0.5%, 해외 ETF는 +1.0% 이상 비정상적으로 웃돈이 붙었을 때만 <strong>[고평가 주의]</strong> 경고가 켜집니다.
                        </div>
                      </div>
                    </div>
                  </th>
                  {compareList.map((etf) => {
                    const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                    const d = etf.disparity;
                    const hasDisparity = typeof d === "number" && Number.isFinite(d);
                    
                    const isOverseas = etf.classification?.marketScope === "미국" || etf.classification?.marketScope === "글로벌" || etf.classification?.marketScope === "신흥국";
                    const overvalueThreshold = isOverseas ? 1.0 : 0.5;
                    const isAbnormallyOvervalued = hasDisparity && d > overvalueThreshold;

                    return (
                      <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-neutral-200 px-1 sm:px-2 py-1.5 text-center tabular-nums font-bold text-[11.5px] sm:text-[12.5px] ${isBase ? "bg-brand-50/40" : ""}`}>
                        {hasDisparity ? (
                          <div className="flex items-center justify-center gap-1 font-bold">
                            <span className={d > 0 ? "text-rose-600 font-mono" : d < 0 ? "text-blue-600 font-mono" : "text-neutral-700 font-mono"}>
                              {d > 0 ? `+${d.toFixed(2)}%` : `${d.toFixed(2)}%`}
                            </span>
                            {isAbnormallyOvervalued && (
                              <span
                                className="text-[8.5px] sm:text-[10px] font-extrabold px-1 sm:px-1.5 py-0.5 rounded border text-rose-800 bg-rose-50 border-rose-300 shadow-2xs leading-none font-sans"
                                title={`실제 가치(NAV)보다 ${d.toFixed(2)}% 비싸게 거래되는 비정상 고평가 상태입니다. 매수 시 주의하세요.`}
                              >
                                ⚠️ 주의
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                
                {/* 추적 오차율 (배당 보정 순수 운용 지표) */}
                <tr className="hover:bg-brand-50/20 hover:z-40 relative">
                  <th className={`sticky left-0 z-20 hover:z-50 bg-surface px-1 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-muted border-b border-r border-line transition-all duration-200 text-center align-middle ${shadowClass}`}>
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 group relative w-fit mx-auto">
                      <button
                        type="button"
                        onClick={() => setActiveMetricModal("trackingError")}
                        aria-label="추적오차율 상세 안내 보기"
                        className="inline-flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-sm"
                      >
                        <span className="leading-tight">추적오차율</span>
                        <span className="text-[10px] text-neutral-400 font-sans" aria-hidden="true">ⓘ</span>
                      </button>
                      <div className="hidden sm:block absolute left-[calc(100%+10px)] bottom-[-20px] w-84 p-4 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                        <div className="absolute bottom-6 -left-1.5 border-[6px] border-transparent border-r-slate-900/98" />
                        <div className="flex items-center justify-between gap-1 mb-2.5 pb-2 border-b border-slate-800">
                          <span className="text-[13px] font-black text-emerald-400">추적오차율이란?</span>
                          <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700/60 font-semibold">
                            배당 조정(TR)
                          </span>
                        </div>
                        <p className="text-xs text-slate-100 leading-relaxed mb-3 font-normal">
                          과거 1년간 ETF 순자산가치(NAV)가 목표 기초지수를 얼마나 똑같이 따라갔는지 나타내는 <strong>운용 복제 정밀도(표준편차)</strong>입니다.
                        </p>
                        <div className="text-[12px] text-emerald-200 bg-emerald-950/90 rounded-lg p-2.5 leading-snug border border-emerald-600/80 mb-3 shadow-inner">
                          <strong>배당금(분배금) 효과를 금융공학적으로 보정한 [순수 운용 추적오차(TR 기준)]입니다.</strong>
                        </div>
                        <div className="space-y-1.5 text-xs bg-slate-800/90 p-3 rounded-lg border border-slate-700/60 mb-2.5">
                          <div className="flex items-start gap-2 text-slate-200">
                            <span className="text-emerald-400 font-bold shrink-0">• 숫자가 낮을수록:</span>
                            <span>운용사가 지수를 <strong>오차 없이 안정적이고 완벽하게 복제</strong>하고 있음을 의미합니다.</span>
                          </div>
                        </div>
                        <div className="text-[10.5px] text-neutral-400">
                          💡 액티브 ETF는 펀드매니저의 초과수익 추구로 추적오차율이 상대적으로 높게 나타납니다.
                        </div>
                      </div>
                    </div>
                  </th>
                  {compareList.map((etf) => {
                    const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                    const te = etf.trackingError;
                    const hasTE = typeof te === "number" && Number.isFinite(te);
                    return (
                      <td key={`te-${etf.ticker}`} className={`whitespace-nowrap border-b border-r border-neutral-200 px-1 sm:px-2 py-1.5 text-center tabular-nums font-bold text-[11.5px] sm:text-[12.5px] ${isBase ? "bg-brand-50/40" : ""}`}>
                        {hasTE ? (
                          <div className="flex items-center justify-center gap-1 font-bold">
                            <span className="text-neutral-700 font-mono">
                              {te.toFixed(2)}%
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
                  <th className={`sticky left-0 z-20 bg-surface px-1 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-muted border-b border-r border-line transition-shadow duration-200 text-center align-middle ${shadowClass}`}>기초 지수</th>
                  {compareList.map((etf) => {
                    const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                    return (
                      <td key={etf.ticker} className={`border-b border-r border-neutral-200 px-1 sm:px-2 py-1.5 transition-colors text-center align-middle ${isBase ? "bg-brand-50/40" : ""}`}>
                        <span className="text-[10.5px] sm:text-[11.5px] font-semibold text-strong leading-tight break-words [overflow-wrap:anywhere] line-clamp-2 block max-w-full" title={etf.baseIndex || ""}>{etf.baseIndex || "-"}</span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 기간 더보기 & TR 토글 바 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 py-2.5 sm:py-3 px-3 sm:px-4 bg-neutral-50/70 border-t border-neutral-200">
            <button
              type="button"
              role="switch"
              aria-checked={isTrMode}
              onClick={handleToggleTr}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 text-xs font-bold text-neutral-600 hover:text-brand-800 hover:bg-neutral-200/70 rounded-full transition-all active:scale-95 shadow-xs border border-neutral-200 bg-white"
            >
              <span className={isTrMode ? "text-brand-700" : ""}>TR (배당 재투자) {isTrMode ? "ON" : "OFF"}</span>
              <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${isTrMode ? 'bg-brand-600' : 'bg-neutral-300'}`}>
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} style={{ transform: isTrMode ? 'translateX(14px)' : 'translateX(2px)' }} />
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setShowAllPeriods(!showAllPeriods)}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 text-xs font-bold text-neutral-600 hover:text-brand-800 hover:bg-neutral-200/70 rounded-full transition-all active:scale-95 shadow-xs border border-neutral-200 bg-white"
            >
              <span>{showAllPeriods ? "핵심 기간만 보기 (1개월~1년)" : "전체 세부 기간 보기 (1일~3년)"}</span>
              <span className="text-[10px]">{showAllPeriods ? "▲" : "▼"}</span>
            </button>
          </div>

          {/* 법적 컴플라이언스 및 데이터 기준 각주 */}
          <div className="px-3 sm:px-4 py-2.5 bg-neutral-50/50 border-t border-neutral-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[10.5px] sm:text-[11px] text-neutral-400 font-medium">
            <p>
              * 실부담비용: 금융투자협회 최근 공시 기준 · 수익률/순자산/괴리율: 최근 영업일 종가 기준 · 본 자료는 투자 참고용이며 권유 목적이 아닙니다.
            </p>
            <span className="font-mono text-[10px] sm:text-[10.5px] text-neutral-400 shrink-0">
              {compareList[0]?.asOfDate ? `${compareList[0].asOfDate.replace(/-/g, ".")} 기준` : ""}
            </span>
          </div>
        </div>
      )}

      {/* MOBILE METRIC DETAIL MODAL (BOTTOM SHEET / CENTER MODAL) */}
      {activeMetricModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={METRIC_INFOS[activeMetricModal].title}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setActiveMetricModal(null)}
        >
          <div
            className="w-full max-w-md bg-slate-900 text-white rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-black text-emerald-400">
                  {METRIC_INFOS[activeMetricModal].title}
                </h3>
                <span className="text-[10px] font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                  {METRIC_INFOS[activeMetricModal].badge}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveMetricModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                aria-label="닫기"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed mb-3">
              {METRIC_INFOS[activeMetricModal].desc}
            </p>

            {METRIC_INFOS[activeMetricModal].items && (
              <div className="space-y-1.5 text-xs bg-slate-800/90 p-3 rounded-xl border border-slate-700/60 mb-3">
                {METRIC_INFOS[activeMetricModal].items!.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className={`font-bold shrink-0 ${item.color || "text-slate-300"}`}>
                      • {item.label}:
                    </span>
                    <span className="text-slate-200">{item.text}</span>
                  </div>
                ))}
              </div>
            )}

            {METRIC_INFOS[activeMetricModal].tip && (
              <div className="text-[11.5px] text-amber-200/95 bg-amber-500/10 rounded-xl p-2.5 leading-snug border border-amber-500/20">
                <strong className="text-amber-300">💡 팁:</strong> {METRIC_INFOS[activeMetricModal].tip}
              </div>
            )}

            <div className="mt-4 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveMetricModal(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors text-center cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
