import type { Metadata } from "next";

import { Tickery } from "@/components/brand/tickery";
import { MarketBriefingV0 } from "@/components/market-briefing-v0";

export const metadata: Metadata = {
  title: "마켓 브리핑 | ETF Campus",
  description: "검증된 일간 ETF·시장 데이터를 시각화해 날짜별로 확인할 수 있는 자동 마켓 브리핑입니다.",
  alternates: { canonical: "/" },
};

/**
 * `output: "export"`를 쓰는 Cloudflare Pages route이므로
 * 동적 렌더링되는 MarketBriefingV0가 Pages API(/api/briefings/latest)에서 가져오며
 * 개별 source snapshot 이 Queue publisher를 거쳐 ready briefing이 생성되면 자동으로 화면에 반영됩니다.
 */
export default function HomePage() {
  return (
    <main className="page-shell flex-1 py-8 sm:py-12">
      <section className="flex flex-col justify-between gap-5 rounded-3xl bg-brand-50/70 px-5 py-5 sm:flex-row sm:items-center sm:px-7">
        <div>
          <p className="eyebrow">MARKET BRIEFING</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">마켓 브리핑</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            매일 거래소의 검증된 ETF·거시 시장 데이터를 시각화해 시장전체 자금 규모, 자산군별 흐름을 기록합니다.
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            데이터 수집·검증이 완료된 기준으로만 공개되며, 특정 ETF의 매수·매도·보유를 권유하지 않습니다.
          </p>
        </div>
        <Tickery
          className="h-24 w-24 shrink-0 self-end sm:h-32 sm:w-32 sm:self-auto"
          pose="briefing"
          priority
          sizes="(max-width: 640px) 96px, 128px"
        />
      </section>

      <section className="mt-8" aria-label="자동 마켓 데일리 대시보드">
        <MarketBriefingV0 />
      </section>
    </main>
  );
}
