import type { Metadata } from "next";

import { CompareClient } from "@/components/compare/compare-client";
import { loadEtfs } from "@/lib/data/etf-repository";

export const metadata: Metadata = {
  title: "ETF 비교",
  description: "여러 ETF의 수익률, 보수, 순자산을 한눈에 비교해 보세요.",
  robots: { index: true, follow: true },
};

export default function ComparePage() {
  const etfs = loadEtfs();
  const searchIndex = etfs.map((etf) => ({
    ticker: etf.ticker,
    name: etf.name,
    baseIndex: etf.baseIndex,
    assetClass: etf.assetClass,
    riskType: etf.riskType,
    pension: etf.pension,
    tradeValue: etf.tradeValue,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 flex-1 py-8 sm:py-12">
      <CompareClient etfs={searchIndex} />
    </main>
  );
}
