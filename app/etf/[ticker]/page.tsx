import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EtfDetail } from "@/components/etf-detail/etf-detail";
import { siteConfig } from "@/config/site";
import { loadEtfs } from "@/lib/data/etf-repository";

const etfs = loadEtfs();
const etfByTicker = new Map(etfs.map((etf) => [etf.ticker, etf]));

type Props = { params: Promise<{ ticker: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return etfs.map((etf) => ({ ticker: etf.ticker }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const etf = etfByTicker.get(ticker);
  if (!etf) return {};
  const description = `${etf.name}의 종가, 기간 수익률, 자산군, 위험유형, 연금 편입 정보를 확인합니다. 가격 기준·분배금 미포함.`;
  return {
    title: `${etf.name} (${etf.ticker})`,
    description,
    alternates: { canonical: `/etf/${etf.ticker}` },
    openGraph: { title: `${etf.name} | ${siteConfig.name}`, description, type: "website", url: `/etf/${etf.ticker}` },
  };
}

export default async function EtfPage({ params }: Props) {
  const { ticker } = await params;
  const etf = etfByTicker.get(ticker);
  if (!etf) notFound();

  // Find similar ETFs by AUM
  const marketScope = etf.classification?.marketScope;
  const assetClass = etf.assetClass; // Always populated from master data
  
  const similarTopEtfs = etfs
    .filter(e => {
      if (e.ticker === etf.ticker) return false;
      const scopeMatch = e.classification?.marketScope === marketScope;
      const classMatch = e.assetClass === assetClass;
      return scopeMatch && classMatch;
    })
    .sort((a, b) => (b.aum || 0) - (a.aum || 0))
    .slice(0, 4)
    .map(e => ({ ticker: e.ticker, name: e.name }));

  return <EtfDetail etf={etf} similarTopEtfs={similarTopEtfs} />;
}
