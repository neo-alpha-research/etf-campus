"use client";

import type { Etf, EtfSlim } from "@/lib/domain/etf-types";
import { useCompareBasket } from "@/lib/hooks/use-compare-basket";
import { CompareSearch } from "./compare-search";
import { CompareThemes } from "./compare-themes";
import { EtfCompareView } from "@/components/etf-detail/etf-compare-view";
import {
  EtfCompareTimeseriesChart,
  type ComparePeriod,
  type SeriesV2Data,
} from "./etf-compare-timeseries-chart";
import { useEffect, useCallback, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";

export interface SeriesManifest {
  asOf: string;
  tickers?: Record<string, string>;
}

export function getSeriesUrl(
  ticker: string,
  isRecent: boolean,
  manifest: SeriesManifest | null
): string {
  const fileSuffix = isRecent ? ".recent.json" : ".json";
  const version = manifest?.tickers?.[ticker] || manifest?.asOf;
  const query = version ? `?v=${version}` : "";
  return `/data/series/v2/${ticker}${fileSuffix}${query}`;
}

export function CompareClient({ etfs }: { etfs: readonly Etf[] }) {
  const { basket, mounted, toastMessage, showToast, addEtf, removeEtf, clearBasket, overwriteBasket, MAX_ITEMS } = useCompareBasket(etfs);
  const searchParams = useSearchParams();

  const initialPeriod: ComparePeriod = (() => {
    const p = searchParams.get("period");
    if (p) {
      const pUpper = p.toUpperCase() as ComparePeriod;
      if (["1M", "3M", "6M", "1Y", "3Y"].includes(pUpper)) return pUpper;
    }
    return "3M";
  })();

  const initialTrMode = searchParams.get("basis")?.toLowerCase() === "tr";

  const [period, setPeriod] = useState<ComparePeriod>(initialPeriod);
  const [isTrMode, setIsTrMode] = useState<boolean>(initialTrMode);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);
  const [seriesMap, setSeriesMap] = useState<Record<string, SeriesV2Data | null>>({});
  const [loadedKey, setLoadedKey] = useState<string>("");
  const [manifest, setManifest] = useState<{ asOf: string; tickers?: Record<string, string> } | null>(null);
  const seriesCacheRef = useRef<Map<string, SeriesV2Data>>(new Map());

  // Dynamic manifest fetch on mount
  useEffect(() => {
    let isMounted = true;
    fetch("/data/series/v2/manifest.json", { cache: "no-cache" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { asOf: string; tickers?: Record<string, string> } | null) => {
        if (isMounted && data) {
          setManifest(data);
        }
      })
      .catch(() => {
        // Fallback gracefully
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const currentKey = `${basket.map((e) => e.ticker).join(",")}_${period}`;
  const isLoadingSeries = basket.length > 0 && loadedKey !== currentKey;

  // URL query sync helper
  const syncUrl = useCallback((tickersList: string[], curPeriod: ComparePeriod, curTrMode: boolean) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (tickersList.length > 0) {
      params.set("tickers", tickersList.join(","));
      params.set("base", tickersList[0]);
    } else {
      params.delete("tickers");
      params.delete("base");
    }
    params.set("period", curPeriod.toLowerCase());
    params.set("basis", curTrMode ? "tr" : "pr");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
  }, []);

  const handleCopyLink = useCallback(() => {
    if (basket.length === 0) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const tickers = basket.map((e) => e.ticker).join(",");
    const baseTicker = basket[0]?.ticker ?? "";
    const basis = isTrMode ? "tr" : "pr";
    const periodParam = period.toLowerCase();
    const shareUrl = `${origin}/compare?tickers=${encodeURIComponent(tickers)}&base=${encodeURIComponent(baseTicker)}&period=${periodParam}&basis=${basis}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("비교 링크가 클립보드에 복사되었습니다.");
      }).catch(() => {
        showToast("링크 복사에 실패했습니다.");
      });
    } else {
      showToast("클립보드를 지원하지 않는 환경입니다.");
    }
  }, [basket, isTrMode, period, showToast]);

  // URL 파라미터(tickers, base) 초기 파싱
  useEffect(() => {
    if (!mounted) return;

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
          .filter((e): e is Etf => e !== undefined);
        if (matchedEtfs.length > 0) {
          overwriteBasket(matchedEtfs);
        }
      }
    }
  }, [mounted, searchParams, etfs, overwriteBasket]);

  // Keep URL in sync when basket, period, or isTrMode changes
  useEffect(() => {
    if (!mounted) return;
    const tickerList = basket.map((e) => e.ticker);
    syncUrl(tickerList, period, isTrMode);
  }, [mounted, basket, period, isTrMode, syncUrl]);

  // Parallel Data Fetching for v2 Series
  useEffect(() => {
    if (!mounted || basket.length === 0) return;

    let isMounted = true;
    const isRecent = period === "1M" || period === "3M" || period === "6M" || period === "1Y";
    const fileSuffix = isRecent ? ".recent.json" : ".json";
    const requestKey = `${basket.map((e) => e.ticker).join(",")}_${period}_${manifest?.asOf || "default"}`;

    const fetchPromises = basket.map(async (etf) => {
      const url = getSeriesUrl(etf.ticker, isRecent, manifest);
      const cacheKey = `${etf.ticker}_${isRecent ? "recent" : "full"}_${url}`;
      if (seriesCacheRef.current.has(cacheKey)) {
        return { ticker: etf.ticker, data: seriesCacheRef.current.get(cacheKey)! };
      }
      try {
        const res = await fetch(url);
        if (!res.ok) {
          return { ticker: etf.ticker, data: null };
        }
        const data: SeriesV2Data = await res.json();
        seriesCacheRef.current.set(cacheKey, data);
        return { ticker: etf.ticker, data };
      } catch {
        return { ticker: etf.ticker, data: null };
      }
    });

    Promise.allSettled(fetchPromises).then((results) => {
      if (!isMounted) return;
      const newMap: Record<string, SeriesV2Data | null> = {};
      for (const r of results) {
        if (r.status === "fulfilled") {
          newMap[r.value.ticker] = r.value.data;
        }
      }
      setSeriesMap(newMap);
      setLoadedKey(requestKey);
    });

    return () => {
      isMounted = false;
    };
  }, [mounted, basket, period, manifest]);



  const handleAddEtf = useCallback((etf: Etf | EtfSlim) => {
    addEtf(etf);
  }, [addEtf]);

  const handleRemoveEtf = useCallback((ticker: string) => {
    removeEtf(ticker);
  }, [removeEtf]);

  const handleClearBasket = useCallback(() => {
    clearBasket();
    setIsConfirmingClear(false);
  }, [clearBasket]);

  const handleSelectTheme = useCallback((themeEtfs: Etf[]) => {
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
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-1 sm:gap-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-strong">ETF 비교</h1>
        <p className="text-xs sm:text-sm text-muted">최대 {MAX_ITEMS}개의 ETF를 한눈에 비교해 보세요.</p>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4 rounded-xl sm:rounded-2xl bg-neutral-50 p-3.5 sm:p-6 border border-line">
        <CompareSearch etfs={etfs} onAdd={handleAddEtf} disabled={isFull} />
        <CompareThemes
          etfs={etfs}
          currentTickers={basket.map((e) => e.ticker)}
          onSelectTheme={handleSelectTheme}
        />
      </div>

      <div className="mt-2 sm:mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-3 sm:mb-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-strong">비교 종목</h2>
            <span className="rounded-full bg-brand-50 px-2 sm:px-2.5 py-0.5 text-xs sm:text-sm font-semibold text-brand-700">
              {basket.length}개 선택 <span className="text-brand-400 font-medium">/ 최대 {MAX_ITEMS}개</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Master TR Mode Toggle */}
            {basket.length > 0 && (
              <button
                type="button"
                role="switch"
                aria-checked={isTrMode}
                onClick={() => setIsTrMode((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 sm:gap-2 h-8 sm:h-[34px] px-2.5 sm:px-3.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all border shadow-xs ${
                  isTrMode
                    ? "bg-brand-50 border-brand-300 text-brand-800 ring-2 ring-brand-100"
                    : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
                title="배당금(분배금)을 재투자했을 때의 총수익률(Total Return)로 차트와 표를 일괄 전환합니다."
              >
                <span className={isTrMode ? "text-brand-700 font-extrabold" : "text-neutral-600"}>
                  TR (분배금 세전 재투자) {isTrMode ? "ON" : "OFF"}
                </span>
                <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${isTrMode ? 'bg-brand-600' : 'bg-neutral-300'}`}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isTrMode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
              </button>
            )}

            {/* Copy Share Link */}
            {basket.length > 0 && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="group flex items-center justify-center gap-1.5 h-8 sm:h-[34px] px-2.5 sm:px-3.5 text-[11px] sm:text-xs font-bold text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900 rounded-lg transition-all duration-200 shadow-xs active:scale-[0.97]"
                title="현재 비교 조합 링크를 클립보드에 복사합니다."
              >
                <svg className="size-[13px] text-neutral-500 transition-transform duration-200 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>링크 복사</span>
              </button>
            )}

            {/* Clear Basket with Safe 2-Step Confirmation */}
            {basket.length > 0 && (
              isConfirmingClear ? (
                <div className="flex items-center gap-1.5 h-8 sm:h-[34px] px-2 sm:px-2.5 bg-rose-50 border border-rose-200 rounded-lg animate-in fade-in duration-200">
                  <span className="text-[11px] sm:text-xs font-bold text-rose-700 mr-0.5 sm:mr-1">모두 비울까요?</span>
                  <button
                    type="button"
                    onClick={handleClearBasket}
                    className="h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-[11px] font-black text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors shadow-2xs active:scale-95"
                  >
                    확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClear(false)}
                    className="h-5 sm:h-6 px-1.5 text-[10px] sm:text-[11px] font-bold text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded transition-colors active:scale-95"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingClear(true)}
                  className="group flex items-center justify-center gap-1.5 h-8 sm:h-[34px] px-2.5 sm:px-3.5 text-[11px] sm:text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 hover:bg-rose-500 hover:text-white hover:border-rose-500 rounded-lg transition-all duration-200 shadow-xs active:scale-[0.97]"
                  title="비교함에 담긴 모든 종목을 삭제합니다."
                >
                  <svg className="size-[13px] sm:size-[14px] transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>모든 종목 지우기</span>
                </button>
              )
            )}
          </div>
        </div>
        
        {basket.length > 0 ? (
          <div className="animate-in fade-in duration-300">
            <EtfCompareTimeseriesChart
              basket={basket as Etf[]}
              isTrMode={isTrMode}
              baseTicker={basket[0]?.ticker}
              period={period}
              onPeriodChange={setPeriod}
              seriesMap={seriesMap}
              isLoading={isLoadingSeries}
              onHoverTicker={setHoveredTicker}
              focusedTicker={hoveredTicker}
            />
            <EtfCompareView
              basket={basket as Etf[]}
              onRemove={handleRemoveEtf}
              isTrMode={isTrMode}
              onToggleTr={() => setIsTrMode((prev) => !prev)}
              period={period}
              seriesMap={seriesMap}
              focusedTicker={hoveredTicker}
            />
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
