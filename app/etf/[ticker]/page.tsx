import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AuthGate } from "@/components/auth/auth-gate";
import { EtfDetail } from "@/components/etf-detail/etf-detail";
import { siteConfig } from "@/config/site";
import { loadEtfs } from "@/lib/data/etf-repository";
import { getPeerComparison } from "@/lib/data/etf-peer-groups";

type Props = { params: Promise<{ ticker: string }> };

export const dynamicParams = true;
export const revalidate = 86400;

export function generateStaticParams() {
  return loadEtfs().map((etf) => ({ ticker: etf.ticker }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const etf = loadEtfs().find((item) => item.ticker === ticker);
  if (!etf) return {};

  const description = `${etf.name}??ì¢…ê?, ê¸°ê°„ ?˜ìµë¥? ?ì‚°êµ? ?„í—˜? í˜•, ?°ê¸ˆ ê³„ì¢Œ ?¸ìž… ?¬ë?ë¥??•ì¸?˜ì„¸??`;
  return {
    title: `${etf.name} (${etf.ticker})`,
    description,
    alternates: { canonical: `/etf/${etf.ticker}` },
    openGraph: {
      title: `${etf.name} | ${siteConfig.name}`,
      description,
      type: "website",
      url: `/etf/${etf.ticker}`,
    },
  };
}

export default async function EtfPage({ params }: Props) {
  const { ticker } = await params;
  const etfs = loadEtfs();
  const etf = etfs.find((item) => item.ticker === ticker);
  if (!etf) notFound();

  const peerComparison = getPeerComparison(etf, etfs);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="h-36 animate-pulse rounded-2xl border border-line bg-brand-50/60" />}>
        <AuthGate
          featureLabel="ETF ?ì„¸ ë¶„ì„"
          title="ETF ?ì„¸ ë¶„ì„???´ì–´ ë³´ì„¸??
          description="êµ¬ì„± ì¢…ëª©, ?˜ìµë¥?ë¹„êµ?€ ì£¼ìš” ì§€??ë¶„ì„?€ ë¬´ë£Œ ?Œì›ê°€?????´ìš©?????ˆìŠµ?ˆë‹¤. ê°€?…ì„ ë§ˆì¹˜ë©???ETF ?ì„¸ ?”ë©´?¼ë¡œ ë°”ë¡œ ?Œì•„?µë‹ˆ??"
        >
          <EtfDetail etf={etf} peerComparison={peerComparison} />
        </AuthGate>
      </Suspense>
    </main>
  );
}
