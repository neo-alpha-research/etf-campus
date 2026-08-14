"use client";

import { useState } from "react";
import type { Etf } from "@/lib/domain/etf-types";
import { useCompareBasket } from "@/lib/hooks/use-compare-basket";
import { EtfCompareView } from "./etf-compare-view";

export function CompareActionButton({ etf }: { etf: Etf }) {
  const { mounted, addEtf, removeEtf, isStored } = useCompareBasket();
  
  if (!mounted) return <div className="h-9 w-32 animate-pulse rounded-full bg-neutral-100" />;
  
  const isCurrentStored = isStored(etf.ticker);

  return (
    <button
      onClick={() => isCurrentStored ? removeEtf(etf.ticker) : addEtf(etf)}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-bold transition-all ${isCurrentStored ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100" : "border-line bg-surface text-strong hover:border-brand-400"}`}
    >
      {isCurrentStored ? "비교 후보에서 제외" : "비교 후보 추가"}
    </button>
  );
}

type Props = {
  etf: Etf;
  similarTopEtfs?: { ticker: string, name: string }[];
  children: React.ReactNode;
};

export function EtfDetailClient({ etf, similarTopEtfs = [], children }: Props) {
  const [activeTab, setActiveTab] = useState<"summary" | "compare">("summary");
  const { basket, mounted, addEtf, removeEtf, clearBasket } = useCompareBasket();

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-px">
        <nav className="-mb-px flex gap-6" aria-label="상세 탭">
          <button
            onClick={() => setActiveTab("summary")}
            className={`whitespace-nowrap border-b-2 py-2 text-base font-bold transition-colors ${activeTab === "summary" ? "border-brand-700 text-brand-700" : "border-transparent text-muted hover:border-line hover:text-strong"}`}
            aria-current={activeTab === "summary" ? "page" : undefined}
          >
            요약 정보
          </button>
          <button
            onClick={() => setActiveTab("compare")}
            className={`flex items-center whitespace-nowrap border-b-2 py-2 text-base font-bold transition-colors ${activeTab === "compare" ? "border-brand-700 text-brand-700" : "border-transparent text-muted hover:border-line hover:text-strong"}`}
            aria-current={activeTab === "compare" ? "page" : undefined}
          >
            선택된 ETF 비교 {mounted ? <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${basket.length > 0 ? "bg-brand-100 text-brand-800" : "bg-neutral-100 text-neutral-500"}`}>{basket.length}개</span> : null}
          </button>
        </nav>
        
        {/* Actions Row */}
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          {similarTopEtfs.length > 0 && (
            <button
              onClick={() => {
                clearBasket();
                addEtf(etf);
                similarTopEtfs.forEach(s => addEtf(s as Etf));
                setActiveTab("compare");
              }}
              className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-[13px] font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              순자산 상위 동종 ETF 비교하기
            </button>
          )}
          {mounted && basket.length > 0 && (
            <button onClick={clearBasket} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-bold text-muted hover:border-brand-400 hover:text-strong transition-colors">
              비교함 비우기
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        {activeTab === "summary" ? children : (
          mounted ? <EtfCompareView mainEtf={etf} basket={basket} onRemove={removeEtf} /> : <div className="py-20 text-center text-sm text-muted">비교 테이블을 불러오는 중...</div>
        )}
      </div>

      {/* Floating Basket on Mobile */}
      {mounted && basket.length > 0 && activeTab === "summary" && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between rounded-full bg-strong px-5 py-3 text-white shadow-xl sm:hidden">
          <p className="text-sm font-bold">비교함에 {basket.length}개 담김</p>
          <div className="flex gap-3 items-center">
            <button className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors" onClick={clearBasket}>비우기</button>
            <span aria-hidden="true" className="w-px h-3 bg-neutral-600" />
            <button className="text-xs font-bold text-brand-200 hover:text-brand-300 transition-colors" onClick={() => setActiveTab("compare")}>비교하기</button>
          </div>
        </div>
      )}
    </div>
  );
}
