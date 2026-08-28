import type { Metadata } from "next";

import { Dashboard } from "@/components/dashboard/dashboard";
import { loadEtfs } from "@/lib/data/etf-repository";

export const metadata: Metadata = { title: "빠른 ETF 검색", description: "일반, 연금, 레버리지, 신규 상장 등 빠른 필터링을 제공합니다.", robots: { index: false, follow: true } };

export default function QuickSearchPage() {
  const etfs = loadEtfs().map((etf) => {
    const { distributionSummary, itdAnchor, ...rest } = etf;
    return rest as unknown as typeof etf;
  });
  return <Dashboard etfs={etfs} />;
}
