import Link from "next/link";

import { AsOfDate, AssetClassTag, PensionBadge, ReturnCell, RiskBadge } from "@/components/etf";
import { siteConfig } from "@/config/site";
import { formatMoney, formatWon } from "@/lib/domain/etf-format";
import { RETURN_PERIODS, type Etf, type ReturnPeriod } from "@/lib/domain/etf-types";

const periodLabels: Record<ReturnPeriod, string> = {
  "1m": "1개월",
  "2m": "2개월",
  "3m": "3개월",
  "6m": "6개월",
  "12m": "12개월",
};

const pensionDescriptions = {
  가능: "확인된 기준에 따라 DC·IRP 편입 가능으로 분류된 상품입니다.",
  불가: "확인된 기준에 따라 DC·IRP 편입 불가로 분류된 상품입니다.",
  확인중: "공식 정보 또는 구조 기준 확인이 진행 중인 상품입니다.",
} as const;

export function EtfDetail({ etf }: { etf: Etf }) {
  const canonicalUrl = `${siteConfig.url.replace(/\/$/, "")}/etf/${etf.ticker}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    name: etf.name,
    identifier: [etf.ticker, etf.isin],
    category: "ETF",
    url: canonicalUrl,
    additionalProperty: [
      { "@type": "PropertyValue", name: "기초지수", value: etf.baseIndex },
      { "@type": "PropertyValue", name: "자산군", value: etf.assetClass },
      { "@type": "PropertyValue", name: "위험유형", value: etf.riskType },
      { "@type": "PropertyValue", name: "연금 편입", value: etf.pension },
    ],
  };

  return (
    <main className="page-shell flex-1 py-8 sm:py-12">
      <Link className="text-sm font-bold text-brand-700" href="/">← ETF 대시보드</Link>
      <div className="mt-7 flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="tabular-nums text-sm font-bold text-muted">{etf.ticker} · {etf.isin}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">{etf.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{etf.baseIndex}</p>
          <div className="mt-4 flex flex-wrap gap-2"><AssetClassTag assetClass={etf.assetClass} /><RiskBadge riskType={etf.riskType} /><PensionBadge status={etf.pension} /></div>
        </div>
        <AsOfDate value={etf.asOfDate} />
      </div>

      <section aria-labelledby="overview-title" className="py-8">
        <h2 className="text-xl font-extrabold text-strong" id="overview-title">종목 개요</h2>
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
          <div className="bg-surface p-5"><dt className="text-xs font-bold text-muted">종가</dt><dd className="tabular-nums mt-2 text-lg font-extrabold">{formatWon(etf.close)}</dd></div>
          <div className="bg-surface p-5"><dt className="text-xs font-bold text-muted">등락률</dt><dd className="mt-2 text-lg"><ReturnCell value={etf.changePct} /></dd></div>
          <div className="bg-surface p-5"><dt className="text-xs font-bold text-muted">거래대금</dt><dd className="tabular-nums mt-2 text-lg font-extrabold">{formatMoney(etf.tradeValue)}</dd></div>
          <div className="bg-surface p-5"><dt className="text-xs font-bold text-muted">순자산</dt><dd className="tabular-nums mt-2 text-lg font-extrabold">{formatMoney(etf.aum)}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="returns-title" className="border-t border-line py-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-xl font-extrabold text-strong" id="returns-title">기간 수익률</h2><p className="text-xs font-semibold text-muted">가격 기준·분배금 미포함</p></div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-line">
          <table className="w-full table-fixed text-center text-sm">
            <thead className="bg-neutral-50 text-xs font-bold text-muted"><tr>{RETURN_PERIODS.map((period) => <th className="px-2 py-3" key={period} scope="col">{periodLabels[period]}</th>)}</tr></thead>
            <tbody><tr>{RETURN_PERIODS.map((period) => <td className="px-2 py-5" key={period}><ReturnCell value={etf.returns[period]} /></td>)}</tr></tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다</p>
      </section>

      <section aria-labelledby="pension-title" className="border-t border-line py-8">
        <h2 className="text-xl font-extrabold text-strong" id="pension-title">연금 편입 정보</h2>
        <div className="mt-4 rounded-2xl bg-neutral-50 p-5"><PensionBadge status={etf.pension} /><p className="mt-3 text-sm leading-6 text-muted">{pensionDescriptions[etf.pension]}</p><p className="mt-2 text-xs text-muted">판정 출처: {etf.pensionSource}</p></div>
      </section>

      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />
    </main>
  );
}
