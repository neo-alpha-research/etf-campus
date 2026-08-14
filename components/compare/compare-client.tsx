"use client";

import type { Etf, EtfSlim } from "@/lib/domain/etf-types";
import { useCompareBasket } from "@/lib/hooks/use-compare-basket";
import { CompareSearch } from "./compare-search";
import { CompareThemes } from "./compare-themes";
import { EtfCompareView } from "@/components/etf-detail/etf-compare-view";
import { EtfCompareChart } from "./etf-compare-chart";

export function CompareClient({ etfs }: { etfs: readonly EtfSlim[] }) {
  const { basket, mounted, toastMessage, addEtf, removeEtf, clearBasket, overwriteBasket, MAX_ITEMS } = useCompareBasket();

  const handleSelectTheme = (themeEtfs: EtfSlim[]) => {
    // Quick Add buttons overwrite the entire basket
    overwriteBasket(themeEtfs);
  };

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="flex flex-col gap-2">
          <div className="h-9 w-40 rounded-lg bg-neutral-200"></div>
          <div className="h-5 w-60 rounded-lg bg-neutral-100"></div>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl bg-neutral-50 p-6 border border-line">
          <div className="h-12 w-full max-w-md rounded-xl bg-neutral-200"></div>
          <div className="flex gap-2 mt-2">
            <div className="h-6 w-24 rounded-full bg-neutral-200"></div>
            <div className="h-6 w-24 rounded-full bg-neutral-200"></div>
            <div className="h-6 w-24 rounded-full bg-neutral-200"></div>
          </div>
        </div>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 h-64"></div>
      </div>
    );
  }

  const isFull = basket.length >= MAX_ITEMS;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold text-strong">ETF 비교</h1>
        <p className="text-sm text-muted">최대 {MAX_ITEMS}개의 ETF를 한눈에 비교해 보세요.</p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-neutral-50 p-6 border border-line">
        <CompareSearch etfs={etfs} onAdd={addEtf} disabled={isFull} />
        <CompareThemes etfs={etfs} onSelectTheme={handleSelectTheme} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-strong">비교 종목</h2>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-semibold text-brand-700">
              {basket.length}개 선택 <span className="text-brand-400 font-medium">/ 최대 {MAX_ITEMS}개</span>
            </span>
          </div>
          {basket.length > 0 && (
            <button onClick={clearBasket} className="group flex items-center justify-center gap-1.5 h-[34px] px-4 text-[13px] font-bold text-rose-500 bg-rose-50 border border-rose-100 hover:bg-rose-500 hover:text-white hover:border-rose-500 rounded-lg transition-all duration-200 shadow-sm active:scale-[0.97]">
              <svg className="size-[15px] transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              모든 종목 지우기
            </button>
          )}
        </div>
        
        {basket.length > 0 ? (
          <div className="animate-in fade-in duration-300">
            <EtfCompareChart basket={basket as Etf[]} />
            <EtfCompareView basket={basket as Etf[]} onRemove={removeEtf} />
          </div>
        ) : (
          <div className="py-24 text-center rounded-2xl border border-dashed border-line bg-surface">
            <p className="text-sm font-semibold text-muted">비교할 ETF를 검색하거나 테마를 선택해 보세요.</p>
          </div>
        )}
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-neutral-800 text-white px-5 py-3 rounded-full shadow-lg text-sm font-semibold text-center whitespace-nowrap">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}
