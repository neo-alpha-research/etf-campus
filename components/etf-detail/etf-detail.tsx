import Link from "next/link";

import { AsOfDate, ClassificationSummary, PensionBadge, ReturnCell } from "@/components/etf";
import { siteConfig } from "@/config/site";
import { formatMoney, formatWon } from "@/lib/domain/etf-format";
import { getReturnPeriods, isNewListing } from "@/lib/domain/etf-explorer";
import { RETURN_PERIOD_LABELS, type Etf } from "@/lib/domain/etf-types";
import { getClassificationStatusLabel, getEtfCautions, getFxImpactNotice } from "@/lib/domain/etf-classification";

function getPensionDescription(etf: Etf, newListing: boolean): string {
  if (etf.pension === "가능") {
    return "DC·IRP 편입 가능 상품으로 확인되었습니다. 실제 매수 가능 여부와 위험자산 한도는 가입한 금융회사의 상품 목록을 확인해 주세요.";
  }

  if (etf.pension === "확인중") {
    if (newListing) {
      return "확인 중인 이유: 신규 상장 후 공식 연금 상품 목록 반영을 기다리고 있습니다. 확인 방법: 매수 전 가입한 금융회사의 DC·IRP 상품 검색에서 종목코드를 확인해 주세요.";
    }

    return "확인 중인 이유: 공개된 연금 편입 정보에서 해당 종목을 확인하지 못했습니다. 확인 방법: 매수 전 가입한 금융회사의 DC·IRP 상품 검색에서 종목코드를 확인해 주세요.";
  }

  if (etf.riskType === "leverage") {
    return "기초지수 변동률의 1배를 초과해 추종하는 레버리지 구조이므로 DC·IRP 편입 대상에서 제외됩니다.";
  }

  if (etf.riskType === "inverse") {
    return "기초지수 변동률에 음의 배율로 연동하는 인버스 구조이므로 DC·IRP 편입 대상에서 제외됩니다.";
  }

  return "DC·IRP 편입 불가 상품으로 확인되었습니다. 공개 정보만으로 구체적인 제한 사유를 확정할 수 없는 경우 가입한 금융회사에서 확인해 주세요.";
}

export function EtfDetail({ etf }: { etf: Etf }) {
  const newListing = isNewListing(etf);
  const returnPeriods = getReturnPeriods(newListing ? "new" : etf.riskType === "normal" ? "general" : "derivatives");
  const canonicalUrl = `${siteConfig.url.replace(/\/$/, "")}/etf/${etf.ticker}`;
  const cautions = getEtfCautions(etf);
  const fxImpactNotice = getFxImpactNotice(etf);
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
      <Link className="text-sm font-bold text-brand-700" href="/?mode=general">← ETF 찾기</Link>
      <div className="mt-7 flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="tabular-nums text-sm font-bold text-muted">{etf.ticker} · {etf.isin}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">{etf.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{etf.baseIndex}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2"><ClassificationSummary detailed etf={etf} /></span>
            <PensionBadge status={etf.pension} />
          </div>
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

      <section aria-labelledby="classification-title" className="border-t border-line py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-strong" id="classification-title">ETF 한눈에 보기</h2>
          <span className="text-xs font-semibold text-muted">
            {getClassificationStatusLabel(etf)}
          </span>
        </div>
        <div className="mt-4 rounded-2xl border border-line bg-neutral-50 p-5">
          <ClassificationSummary detailed etf={etf} />
          {fxImpactNotice ? <p className="mt-3 text-xs leading-5 text-muted">{fxImpactNotice}</p> : null}
          {cautions.length ? (
            <div aria-label="살펴볼 특성" className="mt-4 flex flex-wrap gap-2">
              {cautions.map((caution) => (
                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800" key={caution}>{caution}</span>
              ))}
            </div>
          ) : null}
          <details className="mt-4 text-xs leading-5 text-muted">
            <summary className="cursor-pointer font-bold text-brand-700">분류 기준 보기</summary>
            <p className="mt-2">기초지수와 상품명, 공식 상품 문서를 기준으로 지역·자산·상품 구조·환헤지를 서로 나누어 확인합니다.</p>
            {etf.classification?.published && etf.classification.evidenceSummary ? <p className="mt-1">{etf.classification.evidenceSummary}</p> : null}
            {etf.classification?.published && etf.classification.sourceUrl ? <a className="mt-1 inline-block font-bold text-brand-700" href={etf.classification.sourceUrl} rel="noreferrer" target="_blank">공식 자료 확인</a> : null}
          </details>
        </div>
      </section>

      <section aria-labelledby="returns-title" className="border-t border-line py-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-xl font-extrabold text-strong" id="returns-title">기간 수익률</h2><p className="max-w-2xl text-xs font-semibold leading-5 text-muted">가격 기준·분배금 미포함 · 1일은 직전 거래일, 주·개월은 기준일에서 해당 달력 기간 전 날짜의 당일 또는 직전 거래일 종가 대비{newListing ? " · 상장 후(ITD)는 첫 거래일 종가 대비" : ""}</p></div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-line">
          <table className="w-full table-fixed text-center text-sm"><caption className="sr-only">{etf.name} 기간별 가격 수익률</caption>
            <thead className="bg-neutral-50 text-xs font-bold text-muted"><tr>{returnPeriods.map((period) => <th className="min-w-20 px-2 py-3" key={period} scope="col">{RETURN_PERIOD_LABELS[period]}</th>)}</tr></thead>
            <tbody><tr>{returnPeriods.map((period) => <td className="px-2 py-5" key={period}><ReturnCell value={etf.returns[period]} /></td>)}</tr></tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다</p>
      </section>

      <section aria-labelledby="pension-title" className="border-t border-line py-8">
        <h2 className="text-xl font-extrabold text-strong" id="pension-title">연금 편입 정보</h2>
        <div className="mt-4 rounded-2xl bg-neutral-50 p-5"><PensionBadge status={etf.pension} /><p className="mt-3 text-sm leading-6 text-muted">{getPensionDescription(etf, newListing)}</p></div>
      </section>

      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />
    </main>
  );
}
