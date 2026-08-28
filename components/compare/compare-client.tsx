"use client";

import type { Etf, EtfSlim } from "@/lib/domain/etf-types";
import { useCompareBasket } from "@/lib/hooks/use-compare-basket";
import { CompareSearch } from "./compare-search";
import { CompareThemes } from "./compare-themes";
import { EtfCompareView } from "@/components/etf-detail/etf-compare-view";
import { EtfCompareChart } from "./etf-compare-chart";
import { useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/components/auth/use-auth-session";
import { withReturnTo } from "@/lib/auth/return-to";

export function CompareClient({ etfs }: { etfs: readonly EtfSlim[] }) {
  const { basket, mounted, toastMessage, addEtf, removeEtf, clearBasket, overwriteBasket, MAX_ITEMS } = useCompareBasket();
  const { authenticated, isLoading } = useAuthSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL 파라미터(tickers, base, action 등) 처리 및 초기 바구니 설정
  useEffect(() => {
    if (!mounted) return;

    // 1. URL에 tickers 또는 base 파라미터가 전달된 경우 (로그인 여부 무관 즉시 바구니 채우기)
    const tickersParam = searchParams.get("tickers");
    const baseParam = searchParams.get("base");

    if (tickersParam || baseParam) {
      let targetTickers: string[] = [];
      if (tickersParam) {
        targetTickers = tickersParam.split(",").map((t) => t.trim()).filter(Boolean);
      } else if (baseParam) {
        targetTickers = [baseParam.trim()];
      }

      if (targetTickers.length > 0) {
        const matchedEtfs = targetTickers
          .map((ticker) => etfs.find((e) => e.ticker === ticker))
          .filter((e): e is EtfSlim => e !== undefined);
        if (matchedEtfs.length > 0) {
          overwriteBasket(matchedEtfs);
        }
      }

      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("tickers");
      newParams.delete("base");
      newParams.delete("group");
      newParams.delete("action");
      const qs = newParams.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
      return;
    }

    // 2. 로그인 완료 후 URL의 action 파라미터 처리
    const action = searchParams.get("action");
    if (action) {
      if (isLoading || !authenticated) return;

      let modified = false;
      const newParams = new URLSearchParams(searchParams.toString());

      if (action === "add") {
        const ticker = searchParams.get("ticker");
        if (ticker) {
          const etf = etfs.find((e) => e.ticker === ticker);
          if (etf) addEtf(etf);
        }
        newParams.delete("ticker");
        modified = true;
      } else if (action === "remove") {
        const ticker = searchParams.get("ticker");
        if (ticker) removeEtf(ticker);
        newParams.delete("ticker");
        modified = true;
      } else if (action === "clear") {
        clearBasket();
        modified = true;
      } else if (action === "theme") {
        const tickers = searchParams.get("tickers");
        if (tickers) {
          const tickerArray = tickers.split(",");
          const themeEtfs = etfs.filter((e) => tickerArray.includes(e.ticker));
          if (themeEtfs.length > 0) overwriteBasket(themeEtfs);
        }
        newParams.delete("tickers");
        modified = true;
      }

      if (modified) {
        newParams.delete("action");
        const qs = newParams.toString();
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
        return;
      }
    }

    // 3. 최초 접속 시 (로컬스토리지 비어있을 때) 대표지수 5종목 자동 채우기
    if (!localStorage.getItem("etfcampus_compare_basket")) {
      const defaultTickers = ["069500", "229200", "245340", "360750", "133690"];
      const themeEtfs = defaultTickers
        .map((ticker) => etfs.find((e) => e.ticker === ticker))
        .filter((e): e is EtfSlim => e !== undefined);
      if (themeEtfs.length > 0) {
        overwriteBasket(themeEtfs);
      }
    }
  }, [mounted, isLoading, authenticated, searchParams, etfs, addEtf, removeEtf, clearBasket, overwriteBasket, pathname, router]);

  const requireAuth = useCallback((actionPath: string) => {
    if (isLoading) return true; // 로딩 중에는 액션 차단
    if (!authenticated) {
      const currentQuery = searchParams.toString();
      const currentPath = `${pathname}${currentQuery ? `?${currentQuery}` : ""}`;
      const returnUrl = currentPath.includes("?") 
        ? `${currentPath}&${actionPath}` 
        : `${currentPath}?${actionPath}`;
      router.push(withReturnTo("/login/", returnUrl));
      return true;
    }
    return false;
  }, [authenticated, isLoading, pathname, searchParams, router]);

  const handleAddEtf = useCallback((etf: EtfSlim) => {
    if (requireAuth(`action=add&ticker=${etf.ticker}`)) return;
    addEtf(etf);
  }, [requireAuth, addEtf]);

  const handleRemoveEtf = useCallback((ticker: string) => {
    if (requireAuth(`action=remove&ticker=${ticker}`)) return;
    removeEtf(ticker);
  }, [requireAuth, removeEtf]);

  const handleClearBasket = useCallback(() => {
    if (requireAuth(`action=clear`)) return;
    clearBasket();
  }, [requireAuth, clearBasket]);

  const handleSelectTheme = useCallback((themeEtfs: EtfSlim[]) => {
    // 추천 테마 클릭은 회원가입/로그인 없이 체험 가능하도록 requireAuth 제거
    overwriteBasket(themeEtfs);
  }, [overwriteBasket]);

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
        <CompareSearch etfs={etfs} onAdd={handleAddEtf} disabled={isFull} />
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
            <button onClick={handleClearBasket} className="group flex items-center justify-center gap-1.5 h-[34px] px-4 text-[13px] font-bold text-rose-500 bg-rose-50 border border-rose-100 hover:bg-rose-500 hover:text-white hover:border-rose-500 rounded-lg transition-all duration-200 shadow-sm active:scale-[0.97]">
              <svg className="size-[15px] transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              모든 종목 지우기
            </button>
          )}
        </div>
        
        {basket.length > 0 ? (
          <div className="animate-in fade-in duration-300">
            <EtfCompareChart basket={basket as Etf[]} />
            <EtfCompareView basket={basket as Etf[]} onRemove={handleRemoveEtf} />
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
