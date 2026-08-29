import type { Metadata } from "next";

import { Dashboard } from "@/components/dashboard/dashboard";
import { loadEtfs } from "@/lib/data/etf-repository";

export const metadata: Metadata = { title: "빠른 ETF 검색", description: "일반, 연금, 레버리지, 신규 상장 등 빠른 필터링을 제공합니다.", robots: { index: false, follow: true } };

export default function QuickSearchPage() {
  const etfs = loadEtfs().map((etf) => {
    // 🔥 [최적화] 웹뷰 메모리 크래시 방지 및 페이로드 다이어트를 위한 DTO (Data Transfer Object)
    // - distributionSummary, itdAnchor 등 불필요하게 거대한 메타 데이터를 제거합니다.
    const {
      distributionSummary,
      itdAnchor,
      listingDateSource,
      firstTradedDateSource,
      listingDateVerifiedAt,
      listingDateEvidenceId,
      pensionSource,
      ...rest
    } = etf;
    return rest as unknown as typeof etf;
  });
  return <Dashboard etfs={etfs} />;
}
