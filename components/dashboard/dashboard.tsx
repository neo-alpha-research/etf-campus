"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AsOfDate, AssetClassTag, PensionBadge, ReturnCell, RiskBadge } from "@/components/etf";
import { formatMoney, formatWon } from "@/lib/domain/etf-format";
import { RETURN_PERIODS, type Etf, type ReturnPeriod } from "@/lib/domain/etf-types";
import { getDefaultEtfs, getNewEtfs, isSmallEtf } from "@/lib/domain/etf-visibility";

type ViewMode = "default" | "all" | "new";
type SortKey = "tradeValue" | "aum" | ReturnPeriod;

const periodLabels: Record<ReturnPeriod, string> = {
  "1m": "1개월",
  "2m": "2개월",
  "3m": "3개월",
  "6m": "6개월",
  "12m": "12개월",
};

const viewOptions: { key: ViewMode; label: string }[] = [
  { key: "default", label: "기본" },
  { key: "all", label: "전체 보기" },
  { key: "new", label: "신규 상장" },
];

function getSortValue(etf: Etf, sortKey: SortKey): number | null {
  if (sortKey === "tradeValue" || sortKey === "aum") return etf[sortKey];
  return etf.returns[sortKey];
}

function sortEtfs(etfs: Etf[], sortKey: SortKey): Etf[] {
  return [...etfs].sort((a, b) => {
    const aValue = getSortValue(a, sortKey);
    const bValue = getSortValue(b, sortKey);
    if (aValue === null) return bValue === null ? a.ticker.localeCompare(b.ticker) : 1;
    if (bValue === null) return -1;
    return bValue - aValue || a.ticker.localeCompare(b.ticker);
  });
}

export function Dashboard({ etfs }: { etfs: Etf[] }) {
  const [view, setView] = useState<ViewMode>("default");
  const [period, setPeriod] = useState<ReturnPeriod>("1m");
  const [sortKey, setSortKey] = useState<SortKey>("tradeValue");

  const visibleEtfs = useMemo(() => {
    const filtered = view === "default" ? getDefaultEtfs(etfs) : view === "new" ? getNewEtfs(etfs) : etfs;
    return sortEtfs(filtered, sortKey);
  }, [etfs, sortKey, view]);

  const asOfDate = etfs[0]?.asOfDate;

  return (
    <section aria-labelledby="dashboard-title" className="page-shell flex-1 py-8 sm:py-12">
      <div className="max-w-3xl">
        <p className="eyebrow">ETF Dashboard</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl" id="dashboard-title">
          의미 있는 ETF를 한눈에
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
          기본 화면은 순자산 500억원 이상 종목을 보여줍니다. 전체 보기에서는 모든 종목을 확인할 수 있습니다.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-line bg-neutral-50 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div aria-label="ETF 목록 범위" className="flex rounded-xl bg-surface p-1 shadow-sm" role="group">
            {viewOptions.map((option) => (
              <button
                aria-pressed={view === option.key}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${view === option.key ? "bg-brand-700 text-white" : "text-muted hover:text-strong"}`}
                key={option.key}
                onClick={() => setView(option.key)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="tabular-nums text-sm font-extrabold text-strong">{visibleEtfs.length.toLocaleString("ko-KR")}종목</span>
            {asOfDate ? <AsOfDate value={asOfDate} /> : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div aria-label="모바일 수익률 기간" className="scrollbar-none flex gap-1 overflow-x-auto" role="group">
            {RETURN_PERIODS.map((item) => (
              <button
                aria-pressed={period === item}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${period === item ? "bg-brand-100 text-brand-800" : "text-muted"}`}
                key={item}
                onClick={() => setPeriod(item)}
                type="button"
              >
                {periodLabels[item]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-muted">
            정렬
            <select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-strong" onChange={(event) => setSortKey(event.target.value as SortKey)} value={sortKey}>
              <option value="tradeValue">거래대금</option>
              <option value="aum">순자산</option>
              {RETURN_PERIODS.map((item) => <option key={item} value={item}>{periodLabels[item]} 수익률</option>)}
            </select>
          </label>
        </div>
      </div>

      <p className="mt-4 text-xs font-semibold text-muted">수익률: 가격 기준·분배금 미포함</p>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-bold text-muted">
              <tr>
                <th className="min-w-44 px-4 py-3 sm:px-5" scope="col">종목명</th>
                <th className="w-24 px-2 py-3 text-right" scope="col">등락률</th>
                <th className="w-28 px-4 py-3 text-right md:hidden" scope="col">{periodLabels[period]} 수익률</th>
                <th className="hidden px-3 py-3 text-right md:table-cell" scope="col">종가</th>
                <th className="hidden px-3 py-3 text-right lg:table-cell" scope="col">거래대금</th>
                <th className="hidden px-3 py-3 text-right lg:table-cell" scope="col">순자산</th>
                {RETURN_PERIODS.map((item) => <th className="hidden px-3 py-3 text-right md:table-cell" key={item} scope="col">{periodLabels[item]}</th>)}
                <th className="hidden px-3 py-3 md:table-cell" scope="col">분류</th>
                <th className="hidden px-4 py-3 md:table-cell" scope="col">연금</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleEtfs.map((etf) => (
                <tr className="transition-colors hover:bg-brand-50/50" key={etf.ticker}>
                  <th className="px-4 py-4 font-normal sm:px-5" scope="row">
                    <Link className="block font-bold leading-5 text-strong hover:text-brand-700" href={`/etf/${etf.ticker}`}>{etf.name}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span className="tabular-nums">{etf.ticker}</span>
                      {view === "all" && isSmallEtf(etf) ? <span className="rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-800">소규모 유의</span> : null}
                    </div>
                  </th>
                  <td className="px-2 py-4 text-right"><ReturnCell value={etf.changePct} /></td>
                  <td className="px-4 py-4 text-right md:hidden"><ReturnCell value={etf.returns[period]} /></td>
                  <td className="tabular-nums hidden px-3 py-4 text-right font-semibold md:table-cell">{formatWon(etf.close)}</td>
                  <td className="tabular-nums hidden px-3 py-4 text-right lg:table-cell">{formatMoney(etf.tradeValue)}</td>
                  <td className="tabular-nums hidden px-3 py-4 text-right lg:table-cell">{formatMoney(etf.aum)}</td>
                  {RETURN_PERIODS.map((item) => <td className="hidden px-3 py-4 text-right md:table-cell" key={item}><ReturnCell value={etf.returns[item]} /></td>)}
                  <td className="hidden min-w-36 px-3 py-4 md:table-cell"><div className="flex flex-wrap gap-1"><AssetClassTag assetClass={etf.assetClass} /><RiskBadge riskType={etf.riskType} /></div></td>
                  <td className="hidden px-4 py-4 md:table-cell"><PensionBadge status={etf.pension} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다</p>
    </section>
  );
}

