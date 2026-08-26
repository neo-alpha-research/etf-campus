"use client";

import { useState } from "react";
import { DisparityWarning } from "@/lib/hooks/use-market-briefing";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

export function DisparityAlert({ warnings }: { warnings: DisparityWarning[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!warnings || warnings.length === 0) return null;

  const INITIAL_LIMIT = 4;
  const isOverflowing = warnings.length > INITIAL_LIMIT;
  const displayedWarnings = isOverflowing && !isExpanded ? warnings.slice(0, INITIAL_LIMIT) : warnings;

  return (
    <section aria-labelledby="disparity-alert-title" className="mb-14 scroll-mt-20">
      <div className="rounded-[22px] border border-rose-200 bg-gradient-to-r from-[#FFF5F5] to-white p-5 sm:p-6 shadow-[0_4px_16px_rgba(27,38,26,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-rose-100">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <AlertTriangle className="h-4 w-4 stroke-[2.5]" />
            </span>
            <h3 id="disparity-alert-title" className="text-[14.5px] font-black text-rose-950 tracking-tight">
              수급 쏠림 주의 ETF (괴리율 경보)
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
              {warnings.length}개 종목
            </span>
          </div>
          <p className="text-[12px] font-medium text-rose-700">
            단기 매수세 집중으로 실제 가치(NAV) 대비 시장가격이 비싸게 형성된 종목입니다. (국내 1%, 해외 3% 이상)
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {displayedWarnings.map((w) => {
            const isPremium = w.disparityPct > 0;
            return (
              <Link
                key={w.ticker}
                href={`/etf/${w.ticker}`}
                className="group flex flex-col justify-between rounded-xl border border-rose-100 bg-white p-3.5 shadow-2xs transition-all hover:border-rose-300 hover:shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-bold text-neutral-900 group-hover:text-rose-700 group-hover:underline line-clamp-1">
                    {w.etfName}
                  </p>
                  {w.assetClass && (
                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
                      {w.assetClass}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-neutral-400 tabular-nums">{w.ticker}</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-[11.5px] font-black tabular-nums px-2 py-0.5 rounded border ${
                      isPremium
                        ? "bg-rose-50 border-rose-200 text-rose-600"
                        : "bg-blue-50 border-blue-200 text-blue-600"
                    }`}>
                      {isPremium ? `+${w.disparityPct.toFixed(2)}% 고평가` : `${w.disparityPct.toFixed(2)}% 저평가`}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-rose-500" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {isOverflowing && (
          <div className="mt-4 pt-3 border-t border-rose-100 flex justify-center">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white border border-rose-200 text-[12px] font-bold text-rose-700 hover:bg-rose-50 transition-colors shadow-2xs"
            >
              {isExpanded ? (
                <>
                  <span>간략히 보기 (접기)</span>
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>외 {warnings.length - INITIAL_LIMIT}개 경보 종목 더보기</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
