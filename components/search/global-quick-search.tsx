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
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-950/45 backdrop-blur-xs p-3 sm:p-4 pt-12 sm:pt-20 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-line overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
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
            onKeyDown={handleKeyDown}
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
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors mr-1"
              aria-label="검색어 지우기"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500 select-none">
            ESC
          </kbd>
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
                  const isActive = activeIndex === idx;
                  return (
                    <li
                      key={item.ticker}
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => handleSelect(item.ticker)}
                      className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-brand-50/90 text-brand-900 ring-1 ring-brand-300 shadow-2xs"
                          : "hover:bg-neutral-50 text-strong"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="font-mono text-xs font-bold text-neutral-600 bg-neutral-100 group-hover:bg-white px-1.5 py-0.5 rounded shrink-0 border border-neutral-200">
                          {item.ticker}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold truncate group-hover:text-brand-800">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted">
                            <span className="truncate">{item.assetClass}</span>
                            {item.pensionLimit && (
                              <>
                                <span>·</span>
                                <span className={item.pensionLimit.includes("100%") ? "text-emerald-700 font-bold" : "text-neutral-500"}>
                                  {item.pensionLimit.includes("100%") ? "안전자산 100%" : item.pensionLimit.includes("70%") ? "위험자산 70%" : item.pensionLimit}
                                </span>
                              </>
                            )}
                            {item.feePct !== null && item.feePct !== undefined && (
                              <>
                                <span>·</span>
                                <span>보수 {item.feePct.toFixed(2)}%</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className="hidden sm:inline text-xs font-bold text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity">
                          상세보기
                        </span>
                        <svg
                          className="size-4 text-neutral-400 group-hover:text-brand-700 group-hover:translate-x-0.5 transition-all"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-10">
                <p className="text-sm font-bold text-neutral-700">검색 결과가 없습니다</p>
                <p className="text-xs text-neutral-400 mt-1">
                  &apos;{query}&apos;에 일치하는 ETF를 찾지 못했습니다. 종목명이나 6자리 코드를 확인해 보세요.
                </p>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-4 py-2">
              {/* Recent Searches */}
              {recentEtfs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-xs font-bold text-neutral-500">최근 본 종목</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRecentTickers([]);
                        localStorage.removeItem(RECENT_SEARCHES_KEY);
                      }}
                      className="text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                      기록 삭제
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentEtfs.map((etf) => (
                      <button
                        key={etf.ticker}
                        type="button"
                        onClick={() => handleSelect(etf.ticker)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-surface hover:border-brand-300 hover:bg-brand-50/50 text-xs font-bold text-strong transition-all shadow-2xs"
                      >
                        <span className="font-mono text-[11px] text-brand-700">{etf.ticker}</span>
                        <span className="truncate max-w-[140px]">{etf.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Benchmark ETFs */}
              <div>
                <span className="block text-xs font-bold text-neutral-500 px-1 mb-2">
                  대표 인기 ETF
                </span>
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
