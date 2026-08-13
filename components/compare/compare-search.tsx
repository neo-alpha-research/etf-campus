"use client";

import { useState, useRef, useEffect, useDeferredValue } from "react";
import type { Etf, EtfSlim } from "@/lib/domain/etf-types";
import { getEtfSearchSuggestions } from "@/lib/domain/etf-explorer";

export function CompareSearch({ etfs, onAdd, disabled }: { etfs: readonly EtfSlim[]; onAdd: (etf: EtfSlim) => void; disabled?: boolean }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [focused, setFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = getEtfSearchSuggestions(etfs, deferredQuery);
  const showSuggestions = focused && deferredQuery.length > 0 && suggestions.length > 0 && !disabled;

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
    if (disabled) return;
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
      if (activeSuggestion >= 0 && activeSuggestion < suggestions.length) {
        handleAdd(suggestions[activeSuggestion]);
      } else if (suggestions.length > 0) {
        handleAdd(suggestions[0]);
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
        type="search"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls="compare-search-suggestions"
        aria-activedescendant={activeSuggestion >= 0 && suggestions[activeSuggestion] ? `suggestion-${suggestions[activeSuggestion].ticker}` : undefined}
        disabled={disabled}
        value={query}
        onChange={(e) => {
          if (!disabled) {
            setQuery(e.target.value);
            setActiveSuggestion(-1);
          }
        }}
        onFocus={() => {
          if (!disabled) setFocused(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "최대 5개 선택됨 · ETF를 제외한 뒤 추가하세요" : "비교할 ETF 종목명 또는 티커 검색"}
        className="w-full appearance-none rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-strong shadow-sm outline-none placeholder:font-normal placeholder:text-neutral-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      {showSuggestions && (
        <ul id="compare-search-suggestions" role="listbox" aria-label="ETF 검색 결과" className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          {suggestions.map((etf, i) => (
            <li
              key={etf.ticker}
              id={`suggestion-${etf.ticker}`}
              role="option"
              aria-selected={activeSuggestion === i}
              onMouseEnter={() => setActiveSuggestion(i)}
              onClick={() => handleAdd(etf)}
              className={`cursor-pointer border-b border-line px-4 py-3 last:border-b-0 ${activeSuggestion === i ? "bg-brand-50" : "hover:bg-neutral-50"}`}
            >
              <div className="flex flex-col">
                <span className="text-xs text-brand-700 font-bold">{etf.ticker}</span>
                <span className="font-semibold text-strong">{etf.name}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
