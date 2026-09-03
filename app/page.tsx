import type { Metadata } from "next";

import { MarketBriefing } from "@/components/market-briefing/market-briefing";

export const metadata: Metadata = {
  title: "ETF Campus | 대한민국 ETF 마켓 브리핑 & 투자 인텔리전스",
  description: "검증된 일간 ETF·시장 데이터를 시각화해 날짜별로 확인할 수 있는 자동 마켓 브리핑입니다.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <div className="page-shell flex-1 pt-4 pb-6 sm:pt-6 sm:pb-10 w-full max-w-full overflow-x-hidden">
      <MarketBriefing />
    </div>
  );
}
