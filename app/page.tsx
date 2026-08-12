import type { Metadata } from "next";

import { Dashboard } from "@/components/dashboard/dashboard";
import { loadEtfs } from "@/lib/data/etf-repository";

export const metadata: Metadata = { title: "ETF 탐색", description: "일반, 연금, 레버리지, 신규 상장 등 빠른 필터링을 제공합니다.", robots: { index: true, follow: true } };

export default function HomePage() {
  return <Dashboard etfs={loadEtfs()} />;
}
