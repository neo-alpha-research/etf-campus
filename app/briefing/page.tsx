import type { Metadata } from "next";

import { MarketBriefingV0 } from "@/components/market-briefing-v0";

export const metadata: Metadata = {
  title: "마켓 브리핑 | ETF Campus",
  description: "검증된 일간 ETF·시장 데이터를 시각화해 날짜별로 확인할 수 있는 자동 마켓 브리핑입니다.",
  alternates: { canonical: "/briefing/" },
};

/**
 * `output: "export"`를 쓰는 Cloudflare Pages route이므로
 * 동적 렌더링되는 MarketBriefingV0가 Pages API(/api/briefings/latest)에서 가져오며
 * 개별 source snapshot 이 Queue publisher를 거쳐 ready briefing이 생성되면 자동으로 화면에 반영됩니다.
 */
export default function BriefingPage() {
  return (
    <main className="page-shell flex-1 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">마켓 브리핑</h1>
      </div>

      <section className="mt-2" aria-label="자동 마켓 데일리 대시보드">
        <MarketBriefingV0 />
      </section>
    </main>
  );
}
