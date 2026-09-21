import type { Metadata } from "next";

import { MarketBriefing } from "@/components/market-briefing/market-briefing";

export const metadata: Metadata = {
  title: "마켓 브리핑 | ETF Campus",
  description: "검증된 일간 ETF·시장 데이터를 시각화해 날짜별로 확인할 수 있는 자동 마켓 브리핑입니다.",
  alternates: { canonical: "/briefing/" },
};

/**
 * `output: "export"`를 쓰는 Cloudflare Pages route이므로
 * 동적 렌더링되는 MarketBriefing이 Pages API(/api/briefings/latest)에서 가져오며
 * 개별 source snapshot 이 Queue publisher를 거쳐 ready briefing이 생성되면 자동으로 화면에 반영됩니다.
 */
export default function BriefingPage() {
  return (
    <main className="page-shell flex-1 pt-4 pb-6 sm:pt-6 sm:pb-10">
      <MarketBriefing />
    </main>
  );
}
