import type { Metadata } from "next";

import { Screener } from "@/components/screener/screener";
// loadEtfs removed to reduce HTML payload size


export const metadata: Metadata = { 
  title: "ETF 탐색 | ETF Campus", 
  description: "계좌유형·자산군·위험유형·순자산 기준으로 국내 상장 ETF를 살펴봅니다.",
  alternates: { canonical: "/explore/" },
};

export default function ExplorePage() {
  return <Screener />;
}

