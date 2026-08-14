"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { BRAND_TO_AMC, LEGACY_BRAND_TO_AMC } from "../../lib/data/etf-amc-mapping";

interface IssuerInfo {
  id: string;
  name: string;
  count: number;
}

interface IssuerMultiSelectProps {
  allIssuers: IssuerInfo[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

// Build a reverse map from issuerId to a list of its brands (current + legacy)
const ISSUER_BRANDS = new Map<string, string[]>();
for (const [brand, amc] of Object.entries(BRAND_TO_AMC)) {
  const current = ISSUER_BRANDS.get(amc.issuerId) || [];
  if (!current.includes(brand)) current.push(brand);
  ISSUER_BRANDS.set(amc.issuerId, current);
}
for (const [brand, amc] of Object.entries(LEGACY_BRAND_TO_AMC)) {
  const current = ISSUER_BRANDS.get(amc.issuerId) || [];
  if (!current.includes(brand)) current.push(brand);
  ISSUER_BRANDS.set(amc.issuerId, current);
}

export function IssuerMultiSelect({ allIssuers, selectedIds, onChange }: IssuerMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  const filteredIssuers = useMemo(() => {
    let list = [...allIssuers];

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().replace(/\s+/g, "");
      list = list.filter(issuer => {
        const nameMatch = issuer.name.toLowerCase().replace(/\s+/g, "").includes(q);
        const brands = ISSUER_BRANDS.get(issuer.id) || [];
        const brandMatch = brands.some(b => b.toLowerCase().replace(/\s+/g, "").includes(q));
        return nameMatch || brandMatch;
      });
    }

    // Sort: selected first, then by count descending, then by name ascending
    list.sort((a, b) => {
      const aSelected = selectedIds.includes(a.id);
      const bSelected = selectedIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, 'ko');
    });

    return list;
  }, [allIssuers, searchQuery, selectedIds]);

  const getButtonText = () => {
    if (selectedIds.length === 0) return "전체 운용사";
    if (selectedIds.length === 1) {
      const issuer = allIssuers.find(i => i.id === selectedIds[0]);
      return issuer ? issuer.name : selectedIds[0];
    }
    if (selectedIds.length === 2) {
      const issuer = allIssuers.find(i => i.id === selectedIds[0]);
      return issuer ? `${issuer.name} 외 1곳` : `운용사 2곳 선택`;
    }
    return `운용사 ${selectedIds.length}곳 선택`;
  };

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(v => v !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <span className="truncate">{getButtonText()}</span>
        <svg className="ml-2 h-4 w-4 shrink-0 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-2 w-full sm:w-80 overflow-hidden rounded-xl border border-line bg-white shadow-xl 
            max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:mt-0 max-sm:w-full max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-6"
        >
          {/* Handle mobile top drag indicator */}
          <div className="sm:hidden flex justify-center py-3">
            <div className="h-1 w-10 rounded-full bg-neutral-300"></div>
          </div>

          <div className="flex items-center justify-between border-b border-line p-3">
            <label htmlFor="issuer-search" className="sr-only">운용사 또는 ETF 브랜드 검색</label>
            <input
              id="issuer-search"
              ref={inputRef}
              type="text"
              className="w-full rounded bg-neutral-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="운용사 또는 ETF 브랜드 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center justify-between px-3 py-2 text-xs border-b border-line bg-neutral-50">
            <button
              type="button"
              className="text-brand-600 hover:text-brand-700 font-bold"
              onClick={() => onChange([])}
            >
              모두 해제
            </button>
            <span className="text-muted font-medium">{selectedIds.length}개 선택됨</span>
          </div>

          <div 
            className="max-h-72 overflow-y-auto overscroll-contain p-2 space-y-1 sm:max-h-80" 
            role="listbox"
            aria-multiselectable="true"
          >
            {filteredIssuers.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">
                검색 결과가 없습니다
              </div>
            ) : (
              filteredIssuers.map(issuer => {
                const isSelected = selectedIds.includes(issuer.id);
                // Find primary brand to display
                const brands = ISSUER_BRANDS.get(issuer.id) || [];
                // Prioritize CURRENT brand if available.
                const currentBrands = brands.filter(b => Object.keys(BRAND_TO_AMC).includes(b));
                const displayBrand = currentBrands.length > 0 ? currentBrands[0] : (brands[0] || "");

                return (
                  <label 
                    key={issuer.id} 
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-neutral-50 cursor-pointer transition-colors"
                    role="option"
                    aria-selected={isSelected}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(issuer.id)}
                      className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                    />
                    <div className="flex flex-1 items-baseline justify-between min-w-0 gap-2">
                      <div className="flex items-baseline gap-2 truncate">
                        <span className="text-sm font-semibold text-strong truncate">{issuer.name}</span>
                        {displayBrand && (
                          <span className="text-xs text-muted truncate shrink-0">{displayBrand}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted shrink-0">{issuer.count.toLocaleString("ko-KR")}</span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
      
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 sm:hidden" 
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
