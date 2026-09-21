"use client";

import { useState, useEffect, useRef, useDeferredValue, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface SearchEtfItem {
  ticker: string;
  name: string;
  baseIndex?: string;
  assetClass: string;
  aum?: number;
  tradeValue?: number;
  pensionLimit?: string;
  feePct?: number | null;
}

const BENCHMARK_ETFS = [
  { ticker: "069500", name: "KODEX 200", badge: "국내대표" },
  { ticker: "379800", name: "TIGER 미국S&P500", badge: "해외대표" },
  { ticker: "133690", name: "TIGER 미국나스닥100", badge: "미국성장" },
  { ticker: "465580", name: "ACE 미국30년국채액티브", badge: "미국채권" },
  { ticker: "458730", name: "TIGER 미국배당다우존스", badge: "월배당" },
];

const RECENT_SEARCHES_KEY = "etf_campus_recent_searches";

export function GlobalQuickSearch({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [activeIndex, setActiveIndex] = useState(0);
  const [etfs, setEtfs] = useState<SearchEtfItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentTickers, setRecentTickers] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  // Focus trap, restoration & scroll lock
  useEffect(() => {
    if (isOpen) {
      previousFocusedElementRef.current = (document.activeElement as HTMLElement) || null;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else if (previousFocusedElementRef.current) {
      const el = previousFocusedElementRef.current;
      previousFocusedElementRef.current = null;
      setTimeout(() => {
        if (el && typeof el.focus === "function") {
          el.focus();
        }
      }, 10);
    }
  }, [isOpen]);

  // Load index data on mount or open
  useEffect(() => {
    if (!isOpen) return;

    // Load recent searches from localStorage
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRecentTickers(JSON.parse(stored).slice(0, 5));
      }
    } catch {
      // ignore
    }

    if (etfs.length === 0) {
      setLoading(true);
      const url = typeof window !== "undefined" && window.location.origin
        ? `${window.location.origin}/data/etf-search-index.json`
        : "/data/etf-search-index.json";
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load search index");
          return res.json();
        })
        .then((data: SearchEtfItem[]) => {
          setEtfs(data);
        })
        .catch(() => {
          // In unit test or offline fallback
        })
        .finally(() => {
          setLoading(false);
        });
    }

    // Auto focus input
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, etfs.length]);

  // Reset query and index on close
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Compute matched suggestions
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const suggestions: SearchEtfItem[] = etfs.length > 0 && normalizedQuery.length > 0
    ? etfs
        .map((etf) => {
          const ticker = etf.ticker.toLowerCase();
          const name = etf.name.toLowerCase();
          const baseIndex = (etf.baseIndex || "").toLowerCase();
          let rank = Number.POSITIVE_INFINITY;

          if (ticker === normalizedQuery) rank = 0;
          else if (ticker.startsWith(normalizedQuery)) rank = 1;
          else if (name.startsWith(normalizedQuery)) rank = 2;
          else if (name.includes(normalizedQuery)) rank = 3;
          else if (baseIndex.includes(normalizedQuery)) rank = 4;

          return { etf, rank };
        })
        .filter(({ rank }) => Number.isFinite(rank))
        .sort(
          (a, b) =>
            a.rank - b.rank ||
            (b.etf.tradeValue ?? 0) - (a.etf.tradeValue ?? 0) ||
            (b.etf.aum ?? 0) - (a.etf.aum ?? 0)
        )
        .slice(0, 8)
        .map(({ etf }) => etf)
    : [];

  // Recent ETF objects
  const recentEtfs = recentTickers
    .map((ticker) => etfs.find((e) => e.ticker === ticker))
    .filter((e): e is SearchEtfItem => e !== undefined);

  // Add to recent searches
  const saveRecentSearch = useCallback((ticker: string) => {
    try {
      setRecentTickers((prev) => {
        const next = [ticker, ...prev.filter((t) => t !== ticker)].slice(0, 5);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
        return next;
      });
    } catch {
      // ignore
    }
  }, []);

  const handleSelect = useCallback(
    (ticker: string) => {
      saveRecentSearch(ticker);
      onClose();
      router.push(`/etf/${ticker}`);
    },
    [router, onClose, saveRecentSearch]
  );

  // Key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    // Modal Focus Trap
    if (e.key === "Tab") {
      if (dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          const firstEl = focusables[0];
          const lastEl = focusables[focusables.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === firstEl) {
              e.preventDefault();
              lastEl.focus();
            }
          } else {
            if (document.activeElement === lastEl) {
              e.preventDefault();
              firstEl.focus();
            }
          }
        }
      }
    }

    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions[activeIndex]) {
        handleSelect(suggestions[activeIndex].ticker);
      } else if (suggestions[0]) {
        handleSelect(suggestions[0].ticker);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ETF 통합 퀵 검색"
      className="fixed inset-0 z-[200] flex items-start justify-center bg-neutral-950/45 backdrop-blur-xs p-3 sm:p-4 pt-12 sm:pt-20 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div ref={dialogRef} className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-line overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-line px-3 sm:px-4 py-2.5 sm:py-3 bg-white">
          <svg
            className="size-5 text-neutral-400 shrink-0 mr-2.5 sm:mr-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="global-search-results"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="ETF 종목명 또는 6자리 코드 검색 (예: KODEX 200, 069500)"
            className="w-full bg-transparent text-sm sm:text-base font-bold text-strong placeholder:font-medium placeholder:text-neutral-400 outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveIndex(0);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors mr-1 shrink-0 cursor-pointer"
              aria-label="검색어 지우기"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500 select-none shrink-0">
            ESC
          </kbd>
          {/* Mobile Explicit Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="sm:hidden flex items-center justify-center p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors ml-1 shrink-0 cursor-pointer"
            aria-label="검색창 닫기"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="max-h-[60vh] sm:max-h-[420px] overflow-y-auto p-2 sm:p-3">
          {loading && normalizedQuery.length > 0 ? (
            <div className="flex items-center justify-center py-10 text-xs font-semibold text-neutral-400">
              <svg className="animate-spin size-4 mr-2 text-brand-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              ETF 검색 인덱스 불러오는 중...
            </div>
          ) : normalizedQuery.length > 0 ? (
            suggestions.length > 0 ? (
              <ul id="global-search-results" ref={listRef} role="listbox" className="flex flex-col gap-1">
                {suggestions.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <li
                      key={item.ticker}
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      onClick={() => handleSelect(item.ticker)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl cursor-pointer transition-colors ${
                        isActive
                          ? "bg-brand-50 border border-brand-200 text-brand-950"
                          : "hover:bg-neutral-50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs font-black text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0">
                          {item.ticker}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs sm:text-sm font-bold truncate text-strong">
                            {item.name}
                          </span>
                          {item.baseIndex ? (
                            <span className="text-[11px] text-muted truncate">
                              기초: {item.baseIndex}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {item.assetClass ? (
                          <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                            {item.assetClass}
                          </span>
                        ) : null}
                        {item.feePct !== null && item.feePct !== undefined ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {(item.feePct * 100).toFixed(2)}%
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="py-12 text-center text-sm text-neutral-500">
                <p className="font-bold text-neutral-800 mb-1">검색 결과가 없습니다</p>
                <p className="text-xs text-neutral-400">
                  종목명(예: TIGER 미국나스닥100)이나 6자리 코드(133690)를 확인해 보세요.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-4 py-2">
              {/* Recent Searches */}
              {recentEtfs.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between px-2 mb-1.5">
                    <span className="text-xs font-bold text-neutral-500">최근 본 종목</span>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem(RECENT_SEARCHES_KEY);
                        setRecentTickers([]);
                      }}
                      className="text-[11px] text-neutral-400 hover:text-neutral-700 transition-colors"
                    >
                      전체 삭제
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {recentEtfs.map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() => handleSelect(item.ticker)}
                        className="flex items-center justify-between p-2 rounded-xl border border-line bg-neutral-50/50 hover:bg-brand-50 hover:border-brand-200 transition-all text-left group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-bold text-neutral-500 group-hover:text-brand-700">
                            {item.ticker}
                          </span>
                          <span className="text-xs font-bold text-strong truncate group-hover:text-brand-800">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-400 group-hover:text-brand-600 shrink-0">
                          이동 →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Benchmark / Recommended ETFs */}
              <div>
                <div className="px-2 mb-1.5">
                  <span className="text-xs font-bold text-neutral-500">대표 인기 ETF</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {BENCHMARK_ETFS.map((bench) => (
                    <button
                      key={bench.ticker}
                      type="button"
                      onClick={() => handleSelect(bench.ticker)}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-line bg-neutral-50/60 hover:bg-brand-50 hover:border-brand-200 transition-all text-left group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-bold text-neutral-500 group-hover:text-brand-700">
                          {bench.ticker}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-strong truncate group-hover:text-brand-800">
                          {bench.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold text-neutral-600 bg-white border border-neutral-200 px-1.5 py-0.5 rounded shrink-0">
                        {bench.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between border-t border-line bg-neutral-50 px-3 sm:px-4 py-2 text-[11px] text-neutral-500">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">
              <kbd className="font-sans font-bold">↑↓</kbd> 이동
            </span>
            <span className="hidden sm:inline">
              <kbd className="font-sans font-bold">Enter</kbd> 선택
            </span>
            <span>
              <kbd className="font-sans font-bold">ESC</kbd> 닫기
            </span>
          </div>
          <Link
            href="/explore"
            onClick={onClose}
            className="text-brand-700 font-bold hover:underline flex items-center gap-0.5"
          >
            <span>전체 ETF 탐색 열기</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
