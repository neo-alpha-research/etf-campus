import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AuthGate } from "@/components/auth/auth-gate";
import { EtfDetail } from "@/components/etf-detail/etf-detail";
import { siteConfig } from "@/config/site";
import { loadEtfs } from "@/lib/data/etf-repository";
import { getPeerComparison } from "@/lib/data/etf-peer-groups";

type Props = { params: Promise<{ ticker: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return loadEtfs().map((etf) => ({ ticker: etf.ticker }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const etf = loadEtfs().find((item) => item.ticker === ticker);
  if (!etf) return {};

  const description = `${etf.name}의 종가, 기간 수익률, 자산군, 위험유형, 연금 계좌 편입 여부를 확인하세요.`;
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
    <main className="mx-auto w-full max-w-6xl xl:max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="h-36 animate-pulse rounded-2xl border border-line bg-brand-50/60" />}>
        <AuthGate
          featureLabel="ETF 상세 분석"
          title="ETF 상세 분석을 열어 보세요"
          description="구성 종목, 수익률 비교와 주요 지표 분석은 무료 회원가입 후 이용할 수 있습니다. 가입을 마치면 이 ETF 상세 화면으로 바로 돌아옵니다."
        >
          <EtfDetail etf={etf} peerComparison={peerComparison} />
        </AuthGate>
      </Suspense>
    </main>
  );
}
