"use client";

import type { Etf } from "@/lib/domain/etf-types";

const THEMES = [
  { name: "대표지수", tickers: ["069500", "229200", "245340", "360750", "133690"] },
  { name: "국내 AI·반도체", tickers: ["396500", "091160", "0167A0", "395160", "469150"] },
  { name: "미국 AI·반도체", tickers: ["381180", "446770", "390390", "423170", "0151S0"] },
  { name: "미국 빅테크", tickers: ["381170", "465580", "485540", "481190", "314250"] },
  { name: "국내외 고배당", tickers: ["458730", "161510", "472150", "441640", "498410"] },
  { name: "한국·미국 채권", tickers: ["453850", "484790", "385560", "439870", "365780"] },
  { name: "한국·미국 파킹형", tickers: ["459580", "423160", "357870", "456610", "455030"] },
];

export function CompareThemes({
  etfs,
  currentTickers = [],
  onSelectTheme,
}: {
  etfs: readonly Etf[];
  currentTickers?: string[];
  onSelectTheme: (etfs: Etf[]) => void;
}) {
  const handleTheme = (tickers: string[]) => {
    // Find matching ETFs, keep the order defined in the tickers array
    const themeEtfs = tickers.map(t => etfs.find(e => e.ticker === t)).filter((e): e is Etf => e !== undefined);
    onSelectTheme(themeEtfs);
  };

  const isThemeActive = (themeTickers: string[]) => {
    if (currentTickers.length !== themeTickers.length || currentTickers.length === 0) return false;
    return themeTickers.every((t) => currentTickers.includes(t));
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <span className="text-sm font-extrabold text-neutral-800 whitespace-nowrap flex items-center">
        🔥 인기 비교 조합 <span className="text-neutral-300 font-normal ml-2">|</span>
      </span>
      {/* Scrollable on small screens, wrap on larger ones */}
      <div className="flex overflow-x-auto sm:flex-wrap items-center gap-2 pb-2 sm:pb-0 hide-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0">
        {THEMES.map(theme => {
          const active = isThemeActive(theme.tickers);
          return (
            <button
              key={theme.name}
              onClick={() => handleTheme(theme.tickers)}
              aria-pressed={active}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs whitespace-nowrap shrink-0 active:scale-95 flex items-center gap-1.5 ${
                active
                  ? "border border-indigo-600 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200 font-black"
                  : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600"
              }`}
            >
              {active && <span className="text-[11px] font-black leading-none" aria-hidden="true">✓</span>}
              <span>{theme.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
