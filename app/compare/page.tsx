import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareClient } from "@/components/compare/compare-client";
import { ChallengeBridgeBanner } from "@/components/learning/challenge-bridge-banner";
import { loadEtfs } from "@/lib/data/etf-repository";

export const metadata: Metadata = {
  title: "ETF 비교",
  description: "여러 ETF의 수익률, 보수, 순자산을 한눈에 비교해 보세요.",
  robots: { index: true, follow: true },
};

export default function ComparePage() {
  const etfs = loadEtfs();

  return (
    <main className="mx-auto w-full max-w-6xl xl:max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="h-36 animate-pulse rounded-2xl border border-line bg-brand-50/60" />}>
        <CompareClient etfs={etfs} />
      </Suspense>
      <ChallengeBridgeBanner source="compare_page" />
    </main>
  );
}
