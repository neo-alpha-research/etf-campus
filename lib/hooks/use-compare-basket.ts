import { useState, useEffect, useCallback } from "react";
import type { Etf } from "@/lib/domain/etf-types";

const STORAGE_KEY = "etfcampus_compare_basket";
const STORAGE_VERSION = 1;
const MAX_ITEMS = 5;

type CompareBasketV1 = {
  version: number;
  tickers: string[];
};

let cachedEtfs: Etf[] | null = null;
async function fetchEtfsByTickers(tickers: string[]): Promise<Etf[]> {
  if (tickers.length === 0) return [];
  if (!cachedEtfs) {
    const res = await fetch("/api/etfs?v=" + Date.now());
    cachedEtfs = await res.json();
  }
  const tickerSet = new Set(tickers);
  const foundEtfs = cachedEtfs!.filter(e => tickerSet.has(e.ticker));
  return foundEtfs.sort((a, b) => tickers.indexOf(a.ticker) - tickers.indexOf(b.ticker));
}

export function useCompareBasket() {
  const [basket, setBasket] = useState<Etf[]>([]);
  const [mounted, setMounted] = useState(false);

  // Helper to persist only tickers
  const persistTickers = (tickers: string[]) => {
    const payload: CompareBasketV1 = { version: STORAGE_VERSION, tickers };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    // Dispatch custom event for cross-tab sync if needed, though 'storage' event handles other tabs.
    window.dispatchEvent(new Event("local-storage-sync"));
  };

  const loadBasket = useCallback(async () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.tickers)) {
        localStorage.removeItem(STORAGE_KEY);
        setBasket([]);
        return;
      }
      const tickers: string[] = parsed.tickers;
      if (tickers.length > 0) {
        const freshEtfs = await fetchEtfsByTickers(tickers);
        // Clean up stale tickers (e.g. delisted)
        if (freshEtfs.length !== tickers.length) {
          persistTickers(freshEtfs.map((e) => e.ticker));
        }
        setBasket(freshEtfs);
      } else {
        setBasket([]);
      }
    } catch (e) {
      console.error("Failed to parse compare basket:", e);
      localStorage.removeItem(STORAGE_KEY);
      setBasket([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    loadBasket();
    
    // Cross-tab sync
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) loadBasket();
    };
    const handleLocalSync = () => loadBasket(); // for same-tab sync if multiple hooks exist

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("local-storage-sync", handleLocalSync);
    return () => {
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("local-storage-sync", handleLocalSync);
    };
  }, [loadBasket]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const addEtf = useCallback(async (tickerOrEtf: string | Etf | { ticker: string }) => {
    const ticker = typeof tickerOrEtf === "string" ? tickerOrEtf : tickerOrEtf.ticker;
    
    // Check limit first
    let limitReached = false;
    setBasket((current) => {
      if (!current.some(item => item.ticker === ticker) && current.length >= MAX_ITEMS) {
        limitReached = true;
      }
      return current;
    });

    if (limitReached) {
      showToast(`비교 바구니는 최대 ${MAX_ITEMS}개까지만 담을 수 있습니다.`);
      return;
    }

    // Fetch fresh data
    const fresh = await fetchEtfsByTickers([ticker]);
    if (fresh.length > 0) {
      setBasket((current) => {
        if (current.some((item) => item.ticker === ticker)) return current;
        if (current.length >= MAX_ITEMS) return current; // Safe guard
        const next = [...current, fresh[0]];
        persistTickers(next.map(e => e.ticker));
        return next;
      });
    }
  }, [showToast]);

  const removeEtf = useCallback((ticker: string) => {
    setBasket((current) => {
      const next = current.filter((item) => item.ticker !== ticker);
      persistTickers(next.map(e => e.ticker));
      return next;
    });
  }, []);

  const clearBasket = useCallback(() => {
    setBasket([]);
    persistTickers([]);
  }, []);

  const overwriteBasket = useCallback(async (tickersOrEtfs: (string | Etf | { ticker: string })[]) => {
    const tickers = tickersOrEtfs.map((t) => (typeof t === "string" ? t : t.ticker));
    const limited = tickers.slice(0, MAX_ITEMS);
    if (tickers.length > MAX_ITEMS) {
      showToast(`최대 ${MAX_ITEMS}개까지만 추가할 수 있습니다.`);
    }
    const fresh = await fetchEtfsByTickers(limited);
    setBasket(fresh);
    persistTickers(fresh.map(e => e.ticker));
  }, [showToast]);

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
