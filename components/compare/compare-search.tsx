"use client";

import { useState, useRef, useEffect, useDeferredValue } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Etf, EtfSlim } from "@/lib/domain/etf-types";
import { getEtfSearchSuggestions } from "@/lib/domain/etf-explorer";

export function CompareSearch({ etfs, onAdd, disabled }: { etfs: readonly Etf[]; onAdd: (etf: EtfSlim) => void; disabled?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [focused, setFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = getEtfSearchSuggestions(etfs, deferredQuery);
  const showSuggestions = focused && deferredQuery.length > 0 && suggestions.length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions && e.key !== "ArrowDown") return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocused(true);
      setActiveSuggestion(c => Math.min(c + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion(c => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const targetEtf = activeSuggestion >= 0 && activeSuggestion < suggestions.length
        ? suggestions[activeSuggestion]
        : suggestions[0];
      if (targetEtf) {
        if (!disabled) {
          handleAdd(targetEtf);
        } else {
          router.push(`/etf/${targetEtf.ticker}`);
        }
      }
    } else if (e.key === "Escape") {
      setFocused(false);
    }
  };

  const handleAdd = (etf: EtfSlim) => {
    if (disabled) return;
    onAdd(etf);
    setQuery("");
    setFocused(false);
    setActiveSuggestion(-1);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <input
        id="compare-search-input"
        type="search"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls="compare-search-suggestions"
        aria-activedescendant={activeSuggestion >= 0 && suggestions[activeSuggestion] ? `suggestion-${suggestions[activeSuggestion].ticker}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveSuggestion(-1);
        }}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "종목 검색 (최대 5개 비교 중 · 상세페이지 이동 가능)" : "비교할 ETF 종목명 또는 티커 검색"}
        className="w-full appearance-none rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-strong shadow-sm outline-none placeholder:font-normal placeholder:text-neutral-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      {showSuggestions && (
        <ul id="compare-search-suggestions" role="listbox" aria-label="ETF 검색 결과" className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <li className="bg-neutral-50 px-3.5 py-1.5 text-[11px] font-bold text-neutral-500 border-b border-line flex items-center justify-between">
            <span>검색 결과 ({suggestions.length}개)</span>
            <span className="text-[10px] text-brand-700 font-semibold">종목 클릭 시 상세 분석으로 이동</span>
          </li>
          {suggestions.map((etf, i) => (
            <li
              key={etf.ticker}
              id={`suggestion-${etf.ticker}`}
              role="option"
              aria-selected={activeSuggestion === i}
              onMouseEnter={() => setActiveSuggestion(i)}
              className={`flex items-center justify-between border-b border-line px-3.5 py-2.5 last:border-b-0 transition-colors ${activeSuggestion === i ? "bg-brand-50" : "hover:bg-neutral-50"}`}
            >
              <Link
                href={`/etf/${etf.ticker}`}
                className="flex-1 flex flex-col min-w-0 pr-2 group"
                onClick={() => setFocused(false)}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-brand-700 font-bold font-mono">{etf.ticker}</span>
                  <span className="text-[10px] text-neutral-400 group-hover:text-brand-700 transition-colors">상세보기 ↗</span>
                </div>
                <span className="font-semibold text-strong text-xs sm:text-sm truncate group-hover:text-brand-800">{etf.name}</span>
              </Link>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => handleAdd(etf)}
                  className="px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold shrink-0 border border-brand-200 transition-all active:scale-95 cursor-pointer"
                >
                  + 비교 추가
                </button>
              ) : (
                <span className="text-[10.5px] font-medium text-neutral-400 shrink-0 px-2 py-0.5 bg-neutral-100 rounded">
                  비교함 가득 참
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

