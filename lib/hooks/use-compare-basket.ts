import { useState, useEffect, useCallback, useMemo } from "react";
import type { Etf } from "@/lib/domain/etf-types";

const STORAGE_KEY = "etfcampus_compare_basket";
const STORAGE_VERSION = 1;
const MAX_ITEMS = 5;
const DEFAULT_TICKERS = ["069500", "229200", "245340", "360750", "133690"];

type CompareBasketV1 = {
  version: number;
  tickers: string[];
};

let cachedEtfs: Etf[] | null = null;
async function fetchEtfsByTickers(tickers: string[]): Promise<Etf[]> {
  if (tickers.length === 0) return [];
  try {
    if (!cachedEtfs) {
      const res = await fetch("/api/etfs");
      if (res.ok) {
        cachedEtfs = await res.json();
      }
    }
    if (cachedEtfs && Array.isArray(cachedEtfs)) {
      const tickerSet = new Set(tickers);
      return cachedEtfs.filter(e => tickerSet.has(e.ticker)).sort((a, b) => tickers.indexOf(a.ticker) - tickers.indexOf(b.ticker));
    }
  } catch {
    // ignore
  }
  return [];
}

export function useCompareBasket(allEtfs?: readonly Etf[]) {
  const [basket, setBasket] = useState<Etf[]>([]);
  const [mounted, setMounted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const etfMap = useMemo(() => {
    if (!allEtfs || allEtfs.length === 0) return null;
    return new Map(allEtfs.map((e) => [e.ticker, e]));
  }, [allEtfs]);

  // Helper to persist only tickers
  const persistTickers = useCallback((tickers: string[]) => {
    const payload: CompareBasketV1 = { version: STORAGE_VERSION, tickers };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event("local-storage-sync"));
  }, []);

  const resolveEtfs = useCallback(async (tickers: string[]): Promise<Etf[]> => {
    if (tickers.length === 0) return [];
    if (etfMap) {
      return tickers.map((t) => etfMap.get(t)).filter((e): e is Etf => e !== undefined);
    }
    return fetchEtfsByTickers(tickers);
  }, [etfMap]);

  const loadBasket = useCallback(async () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    let tickers: string[] = [];

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.version === STORAGE_VERSION && Array.isArray(parsed.tickers)) {
          tickers = parsed.tickers;
        }
      } catch (e) {
        console.error("Failed to parse compare basket:", e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // If nothing was stored on fresh first-time visit, default to 5 representative index ETFs
    if (stored === null) {
      tickers = DEFAULT_TICKERS;
    }

    const freshEtfs = await resolveEtfs(tickers);
    if (freshEtfs.length > 0) {
      setBasket(freshEtfs);
      if (stored === null) {
        persistTickers(freshEtfs.map((e) => e.ticker));
      }
    } else {
      setBasket([]);
    }
  }, [resolveEtfs, persistTickers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    loadBasket();
    
    // Cross-tab sync
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) loadBasket();
    };
    const handleLocalSync = () => loadBasket(); // for same-tab sync

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("local-storage-sync", handleLocalSync);
    return () => {
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("local-storage-sync", handleLocalSync);
    };
  }, [loadBasket]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const addEtf = useCallback(async (tickerOrEtf: string | Etf | { ticker: string }) => {
    const ticker = typeof tickerOrEtf === "string" ? tickerOrEtf : tickerOrEtf.ticker;
    
    let etfObj: Etf | undefined;
    if (typeof tickerOrEtf === "object" && "name" in tickerOrEtf && "aum" in tickerOrEtf) {
      etfObj = tickerOrEtf as Etf;
    } else if (etfMap) {
      etfObj = etfMap.get(ticker);
    }

    if (!etfObj) {
      const fetched = await resolveEtfs([ticker]);
      etfObj = fetched[0];
    }

    if (!etfObj) return;

    setBasket((current) => {
      if (current.some((item) => item.ticker === ticker)) return current;
      if (current.length >= MAX_ITEMS) {
        showToast(`비교 종목은 최대 ${MAX_ITEMS}개까지만 담을 수 있습니다.`);
        return current;
      }
      const next = [...current, etfObj!];
      persistTickers(next.map((e) => e.ticker));
      return next;
    });
  }, [etfMap, resolveEtfs, persistTickers, showToast]);

  const removeEtf = useCallback((ticker: string) => {
    setBasket((current) => {
      const next = current.filter((item) => item.ticker !== ticker);
      persistTickers(next.map((e) => e.ticker));
      return next;
    });
  }, [persistTickers]);

  const clearBasket = useCallback(() => {
    setBasket([]);
    persistTickers([]);
    showToast("비교 종목을 모두 비웠습니다.");
  }, [persistTickers, showToast]);

  const overwriteBasket = useCallback(async (tickersOrEtfs: (string | Etf | { ticker: string })[]) => {
    const limited = tickersOrEtfs.slice(0, MAX_ITEMS);
    if (tickersOrEtfs.length > MAX_ITEMS) {
      showToast(`최대 ${MAX_ITEMS}개까지만 추가할 수 있습니다.`);
    }

    const resolved: Etf[] = [];
    for (const item of limited) {
      if (typeof item === "object" && "name" in item && "aum" in item) {
        resolved.push(item as Etf);
      } else {
        const ticker = typeof item === "string" ? item : item.ticker;
        const found = etfMap?.get(ticker);
        if (found) {
          resolved.push(found);
        } else {
          const fetched = await resolveEtfs([ticker]);
          if (fetched[0]) resolved.push(fetched[0]);
        }
      }
    }

    setBasket(resolved);
    persistTickers(resolved.map((e) => e.ticker));
  }, [etfMap, resolveEtfs, persistTickers, showToast]);

  const isStored = useCallback((ticker: string) => {
    return basket.some((item) => item.ticker === ticker);
  }, [basket]);

  return {
    basket,
    mounted,
    toastMessage,
    addEtf,
    removeEtf,
    clearBasket,
    overwriteBasket,
    isStored,
    MAX_ITEMS,
  };
}
