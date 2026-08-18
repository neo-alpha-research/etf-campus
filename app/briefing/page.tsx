import type { Metadata } from "next";
import { MarketBriefingV0 } from "@/components/market-briefing-v0";

export const metadata: Metadata = {
  title: "마켓 브리핑 | ETF Campus",
  description: "ETF 흐름으로 읽는 국내 시장의 일일 자동 브리핑입니다.",
};

export default function BriefingPage() {
  return (
    <main className="page-shell flex-1 py-8 sm:py-12">
      <MarketBriefingV0 />
    </main>
  );
}
