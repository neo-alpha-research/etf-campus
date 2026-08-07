import type { Metadata } from "next";

import { Screener } from "@/components/screener/screener";
import { loadEtfs } from "@/lib/data/etf-repository";

export const metadata: Metadata = { title: "ETF 찾기", description: "계좌유형·자산군·위험유형·순자산 기준으로 국내 상장 ETF를 살펴봅니다." };

export default function HomePage() {
  return <Screener etfs={loadEtfs()} />;
}
