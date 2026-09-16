import type { Metadata } from "next";

import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = { title: "빠른 ETF 검색", description: "일반, 연금, 레버리지, 신규 상장 등 빠른 필터링을 제공합니다.", robots: { index: false, follow: true } };

export default function QuickSearchPage() {
  return <Dashboard />;
}

