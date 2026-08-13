import Link from "next/link";

import { AsOfDate, PensionBadge, RiskBadge, ReturnCell } from "@/components/etf";
import { siteConfig } from "@/config/site";
import { formatMoney, formatWon } from "@/lib/domain/etf-format";
import { getReturnPeriods, isNewListing } from "@/lib/domain/etf-explorer";
import { RETURN_PERIOD_LABELS, type Etf, type ReturnPeriod } from "@/lib/domain/etf-types";
import { getClassificationStatusLabel, getEtfCautions, getFxImpactNotice } from "@/lib/domain/etf-classification";
import { EtfDetailClient, CompareActionButton } from "./etf-detail-client";

function getPensionDescription(etf: Etf, newListing: boolean): string {
  if (etf.pension === "가능") {
    return "DC·IRP 편입 가능 상품으로 확인되었습니다. 실제 매수 가능 여부와 위험자산 한도는 가입한 금융회사의 상품 목록을 확인해 주세요.";
  }
  if (etf.pension === "확인중") {
    if (newListing) return "확인 중인 이유: 신규 상장 후 공식 연금 상품 목록 반영을 기다리고 있습니다. 확인 방법: 매수 전 가입한 금융회사의 DC·IRP 상품 검색에서 종목코드를 확인해 주세요.";
    return "확인 중인 이유: 공개된 연금 편입 정보에서 해당 종목을 확인하지 못했습니다. 확인 방법: 매수 전 가입한 금융회사의 DC·IRP 상품 검색에서 종목코드를 확인해 주세요.";
  }
  if (etf.riskType === "leverage") return "기초지수 변동률의 1배를 초과해 추종하는 레버리지 구조이므로 DC·IRP 편입 대상에서 제외됩니다.";
  if (etf.riskType === "inverse") return "기초지수 변동률에 음의 배율로 연동하는 인버스 구조이므로 DC·IRP 편입 대상에서 제외됩니다.";
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

  const marketScope = etf.classification?.marketScope;
  const assetClass = etf.classification?.assetClass;
  const oneLineDesc = marketScope && assetClass ? `${etf.baseIndex}를 기준으로 운용되는 ${marketScope} ${assetClass} ETF입니다.` : etf.baseIndex;

  const defaultPeriods: ReturnPeriod[] = ["1m", "3m", "6m", "ytd", "12m", "36m"];
  const allPeriods = returnPeriods;
  // Fold periods logic will be handled by detail/summary if needed, but for simplicity let's use a details tag for all returns table

  return (
    <main className="page-shell flex-1 py-6 sm:py-8">
      <Link className="text-sm font-bold text-brand-700" href="/">← 목록으로 돌아가기</Link>
      
      <div className="mt-5 flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <p className="tabular-nums text-sm font-bold text-muted">{etf.ticker}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-strong sm:text-3xl">{etf.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{oneLineDesc}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {marketScope && <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-semibold text-strong">{marketScope}</span>}
            {assetClass && <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-semibold text-strong">{assetClass}</span>}
            {etf.classification?.fxHedge && <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-semibold text-strong">{etf.classification.fxHedge}</span>}
            <RiskBadge riskType={etf.riskType} />
            <PensionBadge status={etf.pension} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <CompareActionButton etf={etf} />
          <AsOfDate value={etf.asOfDate} />
        </div>
      </div>

      <EtfDetailClient etf={etf}>
        <section aria-labelledby="overview-title" className="py-6">
          <h2 className="sr-only" id="overview-title">핵심 정보</h2>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
            <div className="bg-surface p-4 sm:p-5"><dt className="text-xs font-bold text-muted">기준일 종가</dt><dd className="tabular-nums mt-1 sm:mt-2 text-lg sm:text-xl font-extrabold">{formatWon(etf.close)}</dd></div>
            <div className="bg-surface p-4 sm:p-5"><dt className="text-xs font-bold text-muted">전일 대비</dt><dd className="mt-1 sm:mt-2 text-lg sm:text-xl"><ReturnCell value={etf.changePct} /></dd></div>
            <div className="bg-surface p-4 sm:p-5"><dt className="text-xs font-bold text-muted">거래대금</dt><dd className="tabular-nums mt-1 sm:mt-2 text-lg sm:text-xl font-extrabold">{formatMoney(etf.tradeValue)}</dd></div>
            <div className="bg-surface p-4 sm:p-5"><dt className="text-xs font-bold text-muted">순자산</dt><dd className="tabular-nums mt-1 sm:mt-2 text-lg sm:text-xl font-extrabold">{formatMoney(etf.aum)}</dd></div>
          </dl>
        </section>

        <section aria-labelledby="classification-title" className="border-t border-line py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-strong" id="classification-title">ETF 한눈에 보기</h2>
            <span className="text-xs font-semibold text-muted">
              {etf.classification?.reviewStatus === "자동확정" ? "자동확정" : getClassificationStatusLabel(etf)}
            </span>
          </div>
          <div className="mt-4 rounded-2xl border border-line bg-neutral-50 p-5">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
              <div><dt className="font-bold text-muted">기초지수</dt><dd className="mt-1 font-semibold text-strong">{etf.baseIndex || "-"}</dd></div>
              {etf.amc !== "기타" && <div><dt className="font-bold text-muted">운용사</dt><dd className="mt-1 font-semibold text-strong">{etf.amc}</dd></div>}
              <div><dt className="font-bold text-muted">투자 지역</dt><dd className="mt-1 font-semibold text-strong">{marketScope || "-"}</dd></div>
              <div><dt className="font-bold text-muted">자산군</dt><dd className="mt-1 font-semibold text-strong">{assetClass || "-"}</dd></div>
              {etf.classification?.assetDetail && <div><dt className="font-bold text-muted">세부 자산 분류</dt><dd className="mt-1 font-semibold text-strong">{etf.classification.assetDetail}</dd></div>}
              {marketScope && marketScope !== "국내" && etf.classification?.fxHedge && (
                <div><dt className="font-bold text-muted">환헤지</dt><dd className="mt-1 font-semibold text-strong">{etf.classification.fxHedge}</dd></div>
              )}
              {etf.classification?.published && etf.classification.sourceUrl && (
                <div className="sm:col-span-2"><dt className="font-bold text-muted">공식 자료</dt><dd className="mt-1"><a className="inline-block font-bold text-brand-700 hover:underline" href={etf.classification.sourceUrl} rel="noreferrer" target="_blank">운용사 상품 페이지 열기</a></dd></div>
              )}
            </dl>
            
            {fxImpactNotice ? <p className="mt-4 text-xs leading-5 text-muted">{fxImpactNotice}</p> : null}
            {cautions.length > 0 ? (
              <div aria-label="살펴볼 특성" className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-line/50">
                {cautions.map((caution) => (
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800" key={caution}>{caution}</span>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="returns-title" className="border-t border-line py-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-strong" id="returns-title">기간별 가격수익률</h2>
              <p className="mt-1 text-xs font-bold text-brand-700">가격수익률(PR) · 분배금 미포함</p>
            </div>
            <p className="max-w-md text-right text-xs font-semibold leading-5 text-muted">1일은 직전 거래일, 주·개월은 기준일에서 해당 달력 기간 전 날짜의 당일 또는 직전 거래일 종가 대비{newListing ? " · 상장 후는 첫 거래일 종가 대비" : ""}</p>
          </div>
          
          <div className="mt-4 overflow-hidden rounded-2xl border border-line">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-center text-sm">
                <caption className="sr-only">{etf.name} 기본 기간별 가격 수익률</caption>
                <thead className="bg-neutral-50 text-xs font-bold text-muted">
                  <tr>{defaultPeriods.map((period) => <th className="px-2 py-3 w-1/6" key={period} scope="col">{RETURN_PERIOD_LABELS[period]}</th>)}</tr>
                </thead>
                <tbody>
                  <tr>
                    {defaultPeriods.map((period) => (
                      <td className="px-2 py-5" key={period}>
                        {etf.returns[period] === null ? <span aria-label="데이터 없음" className="text-muted">—</span> : <ReturnCell value={etf.returns[period]!} />}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <details className="mt-3 group">
            <summary className="cursor-pointer text-sm font-bold text-brand-700 hover:underline inline-flex items-center gap-1">전체 기간 보기 <svg className="w-4 h-4 transition-transform group-open:-rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></summary>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-center text-sm">
                  <caption className="sr-only">{etf.name} 전체 기간별 가격 수익률</caption>
                  <thead className="bg-neutral-50 text-xs font-bold text-muted">
                    <tr>{allPeriods.map((period) => <th className="px-2 py-3 min-w-[60px]" key={period} scope="col">{RETURN_PERIOD_LABELS[period]}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr>
                      {allPeriods.map((period) => (
                        <td className="px-2 py-5" key={period}>
                          {etf.returns[period] === null ? <span aria-label="데이터 없음" className="text-muted">—</span> : <ReturnCell value={etf.returns[period]!} />}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          <p className="mt-4 text-xs leading-5 text-muted">과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다</p>
        </section>

        <section aria-labelledby="pension-title" className="border-t border-line py-8">
          <h2 className="text-xl font-extrabold text-strong" id="pension-title">연금 편입 정보</h2>
          <div className="mt-4 rounded-2xl bg-neutral-50 p-5"><PensionBadge status={etf.pension} /><p className="mt-3 text-sm leading-6 text-muted">{getPensionDescription(etf, newListing)}</p></div>
        </section>
      </EtfDetailClient>

      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />
    </main>
  );
}
