"use client";

import { useState, useMemo } from "react";
import { DisparityWarning } from "@/lib/hooks/use-market-briefing";
import Link from "next/link";
import { AlertTriangle, TrendingUp, TrendingDown, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, Info } from "lucide-react";

export function DisparityAlert({ warnings }: { warnings: DisparityWarning[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. 데이터 분류 및 정렬 (고평가 내림차순, 저평가 오름차순)
  const { premiums, discounts } = useMemo(() => {
    if (!warnings || warnings.length === 0) return { premiums: [], discounts: [] };

    type LegacyWarning = DisparityWarning & { disparity_pct?: number; etf_name?: string; asset_class?: string };
    const premList: DisparityWarning[] = [];
    const discList: DisparityWarning[] = [];

    warnings.forEach((w) => {
      const legacyW = w as LegacyWarning;
      const pct = Number(legacyW.disparityPct ?? legacyW.disparity_pct ?? 0);
      if (pct > 0) {
        premList.push(w);
      } else if (pct < 0) {
        discList.push(w);
      }
    });

    premList.sort((a, b) => {
      const pctA = Number((a as LegacyWarning).disparityPct ?? (a as LegacyWarning).disparity_pct ?? 0);
      const pctB = Number((b as LegacyWarning).disparityPct ?? (b as LegacyWarning).disparity_pct ?? 0);
      return pctB - pctA; // 높은 순 (내림차순)
    });

    discList.sort((a, b) => {
      const pctA = Number((a as LegacyWarning).disparityPct ?? (a as LegacyWarning).disparity_pct ?? 0);
      const pctB = Number((b as LegacyWarning).disparityPct ?? (b as LegacyWarning).disparity_pct ?? 0);
      return pctA - pctB; // 음수 절댓값 큰 순 (오름차순: -4% -> -2%)
    });

    return { premiums: premList, discounts: discList };
  }, [warnings]);

  if (!warnings || warnings.length === 0) return null;

  const topPremiums = isExpanded ? premiums : premiums.slice(0, 3);
  const topDiscounts = isExpanded ? discounts : discounts.slice(0, 3);
  const totalHiddenCount = (premiums.length > 3 ? premiums.length - 3 : 0) + (discounts.length > 3 ? discounts.length - 3 : 0);

  return (
    <section aria-labelledby="disparity-alert-title" className="mb-14 scroll-mt-20">
      <div className="rounded-[22px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-[0_4px_16px_rgba(27,38,26,0.03)]">
        {/* 헤더 바 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60">
              <AlertTriangle className="h-4 w-4 stroke-[2.5]" />
            </span>
            <div className="flex items-center gap-2">
              <h3 id="disparity-alert-title" className="text-[15px] font-black text-neutral-900 tracking-tight">
                수급 쏠림 주의 ETF (괴리율 경보)
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                총 {warnings.length}개 종목
              </span>
            </div>
          </div>
          <p className="text-[12px] font-medium text-neutral-500 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
            기준 괴리율: 국내 1.0% / 해외 3.0% 이상 (정상 가치 회귀 시 가격 변동 위험)
          </p>
        </div>

        {/* 듀얼 패널 컨테이너 (고평가 Top 3 vs 저평가 Top 3) */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* 좌측 패널: 고평가 (Premium) TOP 3 */}
          <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-4 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-3 border-b border-rose-100/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TrendingUp className="h-4 w-4 text-rose-600 stroke-[2.5] shrink-0" />
                  <span className="text-[13.5px] font-bold text-rose-950 truncate">고평가 TOP 3 (Premium)</span>
                </div>
                <span className="text-[10.5px] sm:text-[11px] font-semibold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md w-fit shrink-0 break-keep">
                  추격 매수 주의 (시장가 &gt; NAV)
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                {topPremiums.length > 0 ? (
                  topPremiums.map((w, idx) => {
                    const legacyW = w as DisparityWarning & { disparity_pct?: number; etf_name?: string; asset_class?: string };
                    const pct = Number(legacyW.disparityPct ?? legacyW.disparity_pct ?? 0);
                    const name = legacyW.etfName ?? legacyW.etf_name ?? "";
                    const assetClass = legacyW.assetClass ?? legacyW.asset_class ?? "";

                    return (
                      <Link
                        key={w.ticker}
                        href={`/etf/${w.ticker}`}
                        className="group flex items-center justify-between gap-2 rounded-lg border border-rose-100 bg-white px-3 sm:px-3.5 py-2.5 shadow-2xs transition-all hover:border-rose-300 hover:shadow-xs w-full min-w-0"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-rose-50 text-[11px] font-black text-rose-600">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] sm:text-[13px] font-bold text-neutral-900 truncate group-hover:text-rose-700 group-hover:underline">
                              {name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10.5px] sm:text-[11px] font-medium text-neutral-400 tabular-nums">{w.ticker}</span>
                              {assetClass && (
                                <span className="text-[9.5px] sm:text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-500 font-medium truncate">
                                  {assetClass}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] sm:text-[12px] font-black tabular-nums px-2 py-0.5 rounded border bg-rose-50 border-rose-200 text-rose-600 whitespace-nowrap">
                            +{pct.toFixed(2)}% 고평가
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-rose-600 shrink-0" />
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-[12px] text-neutral-400 bg-white/60 rounded-lg border border-dashed border-rose-200 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>현재 고평가 경보 종목이 없습니다.</span>
                  </div>
                )}
              </div>
            </div>
            {premiums.length > 3 && !isExpanded && (
              <p className="mt-2.5 text-right text-[11px] font-medium text-rose-600/80">
                외 {premiums.length - 3}개 고평가 종목 대기 중
              </p>
            )}
          </div>

          {/* 우측 패널: 저평가 (Discount) TOP 3 */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-3 border-b border-blue-100/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TrendingDown className="h-4 w-4 text-blue-600 stroke-[2.5] shrink-0" />
                  <span className="text-[13.5px] font-bold text-blue-950 truncate">저평가 TOP 3 (Discount)</span>
                </div>
                <span className="text-[10.5px] sm:text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md w-fit shrink-0 break-keep">
                  헐값 매도 주의 / 기회 (시장가 &lt; NAV)
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                {topDiscounts.length > 0 ? (
                  topDiscounts.map((w, idx) => {
                    const legacyW = w as DisparityWarning & { disparity_pct?: number; etf_name?: string; asset_class?: string };
                    const pct = Number(legacyW.disparityPct ?? legacyW.disparity_pct ?? 0);
                    const name = legacyW.etfName ?? legacyW.etf_name ?? "";
                    const assetClass = legacyW.assetClass ?? legacyW.asset_class ?? "";

                    return (
                      <Link
                        key={w.ticker}
                        href={`/etf/${w.ticker}`}
                        className="group flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-white px-3 sm:px-3.5 py-2.5 shadow-2xs transition-all hover:border-blue-300 hover:shadow-xs w-full min-w-0"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-50 text-[11px] font-black text-blue-600">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] sm:text-[13px] font-bold text-neutral-900 truncate group-hover:text-blue-700 group-hover:underline">
                              {name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10.5px] sm:text-[11px] font-medium text-neutral-400 tabular-nums">{w.ticker}</span>
                              {assetClass && (
                                <span className="text-[9.5px] sm:text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-500 font-medium truncate">
                                  {assetClass}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] sm:text-[12px] font-black tabular-nums px-2 py-0.5 rounded border bg-blue-50 border-blue-200 text-blue-600 whitespace-nowrap">
                            {pct.toFixed(2)}% 저평가
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 shrink-0" />
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-[12px] text-neutral-400 bg-white/60 rounded-lg border border-dashed border-blue-200 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>현재 저평가 경보 종목이 없습니다. (모두 정상 범위)</span>
                  </div>
                )}
              </div>
            </div>
            {discounts.length > 3 && !isExpanded && (
              <p className="mt-2.5 text-right text-[11px] font-medium text-blue-600/80">
                외 {discounts.length - 3}개 저평가 종목 대기 중
              </p>
            )}
          </div>
        </div>

        {/* 전체 펼쳐보기/접기 토글 바 */}
        {totalHiddenCount > 0 && (
          <div className="mt-5 pt-3.5 border-t border-neutral-100 flex justify-center">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-[12px] font-bold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-all shadow-2xs cursor-pointer"
            >
              {isExpanded ? (
                <>
                  <span>간략히 보기 (Top 3로 접기)</span>
                  <ChevronUp className="w-4 h-4 text-neutral-500" />
                </>
              ) : (
                <>
                  <span>전체 {warnings.length}개 괴리율 경보 종목 펼쳐보기 ({totalHiddenCount}개 더보기)</span>
                  <ChevronDown className="w-4 h-4 text-neutral-500" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
