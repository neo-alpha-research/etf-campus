import type { Metadata } from "next";

import { Screener } from "@/components/screener/screener";
import { loadEtfs } from "@/lib/data/etf-repository";
import type { ScreenerEtf } from "@/lib/domain/etf-screener";

export const metadata: Metadata = { 
  title: "ETF 탐색 | ETF Campus", 
  description: "계좌유형·자산군·위험유형·순자산 기준으로 국내 상장 ETF를 살펴봅니다.",
  alternates: { canonical: "/explore/" },
};

export default function ExplorePage() {
  const fullEtfs = loadEtfs();
  // DTO Pattern: Strip heavy fields not needed by Screener to reduce HTML payload
  const screenerEtfs: ScreenerEtf[] = fullEtfs.map((etf) => ({
    ticker: etf.ticker,
    name: etf.name,
    baseIndex: etf.baseIndex,
    close: etf.close,
    tradeValue: etf.tradeValue,
    aum: etf.aum,
    fee: etf.fee ? {
      totalFeePct: etf.fee.totalFeePct,
      verificationStatus: etf.fee.verificationStatus,
    } : null,
    issuer: etf.issuer,
    riskType: etf.riskType,
    assetClass: etf.assetClass,
    pension: etf.pension,
    asOfDate: etf.asOfDate,
    returns: etf.returns,
    classification: etf.classification ? {
      marketScope: etf.classification.marketScope,
      fxHedge: etf.classification.fxHedge,
      strategy: etf.classification.strategy,
    } : null,
  })) as ScreenerEtf[];

  return <Screener etfs={screenerEtfs} />;
}
