import Link from "next/link";

import { AsOfDate, PensionBadge, RiskBadge, ReturnCell } from "@/components/etf";
import { siteConfig } from "@/config/site";
import { formatMoney, formatWon } from "@/lib/domain/etf-format";
import { getReturnPeriods, isNewListing } from "@/lib/domain/etf-explorer";
import { RETURN_PERIOD_LABELS, type Etf, type ReturnPeriod } from "@/lib/domain/etf-types";
import { getClassificationStatusLabel, getEtfCautions, getFxImpactNotice } from "@/lib/domain/etf-classification";
import { EtfDetailClient } from "./etf-detail-client";
import { PriceHistoryChart } from "./price-history-chart";
import type { PeerComparison } from "@/lib/data/etf-peer-groups";

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  
  const match = dateString.match(/^(\d{4}-?\d{2}-?\d{2})/);
  if (!match) return dateString;

  const datePart = match[1];
  if (datePart.length === 8 && !datePart.includes("-")) {
    return `${datePart.slice(0, 4)}.${datePart.slice(4, 6)}.${datePart.slice(6, 8)}`;
  }
  return datePart.replace(/-/g, ".");
}

export function EtfDetail({ etf, peerComparison }: { etf: Etf; peerComparison?: PeerComparison }) {
  const resolvedPeerComparison: PeerComparison = peerComparison ?? {
    profile: null,
    state: "unverified",
    groups: [],
  };
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

  const defaultPeriods: ReturnPeriod[] = ["1d", "1w", "2w", "1m", "2m", "3m", "6m", "12m", "24m", "36m", "ytd"];
  if (etf.returns.itd !== null) {
    defaultPeriods.push("itd");
  }

  const fee = etf.fee;
  const isFeeVerified = fee?.verificationStatus === "verified_official";

  const getFeeStatusText = (status: string | undefined) => {
    switch(status) {
      case "seed_unverified": return "검증 전 데이터";
      case "conflict": return "출처 간 정보 불일치";
      case "pending_review": return "공식 데이터 확인 중";
      case "stale": return "최신화 필요";
      default: return "공식 데이터 확인 중";
    }
  };

  return (
    <main className="page-shell flex-1 py-6 sm:py-8 space-y-12">
      {/* 1. 상품 헤더 */}
      <section aria-labelledby="header-title">
        <h2 className="sr-only" id="header-title">상품 헤더</h2>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-4">
            
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <Link className="inline-flex items-center justify-center rounded-md bg-neutral-100 p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 transition-colors mr-1" href="/" aria-label="목록으로 돌아가기">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </Link>
                {marketScope && <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">{marketScope}</span>}
                {assetClass && <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{assetClass}</span>}
                {etf.classification?.fxHedge && <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">{etf.classification.fxHedge}</span>}
                <RiskBadge riskType={etf.riskType} />
                <PensionBadge status={etf.pension} />
                {cautions.map(caution => (
                  <span key={caution} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">{caution}</span>
                ))}
                {fxImpactNotice && (
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800" title={fxImpactNotice}>환율변동위험</span>
                )}
              </div>

              <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-3xl font-extrabold tracking-tight text-strong sm:text-4xl">
                {etf.name}
                <span className="text-lg font-bold text-neutral-400 tabular-nums tracking-normal">{etf.ticker}</span>
              </h1>
            </div>
            
            {(etf.riskType === "leverage" || etf.riskType === "inverse") && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-bold text-rose-700">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {etf.riskType === "leverage" ? "레버리지 (고위험)" : "인버스 (고위험)"} 상품입니다. 투자 전 구조를 반드시 이해하세요.
              </div>
            )}

            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 pt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-brand-700 tabular-nums tracking-tight">{formatWon(etf.close)}</span>
                <span className="text-lg font-bold"><ReturnCell value={etf.changePct} /></span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-muted pb-1">
                <AsOfDate value={etf.asOfDate} />
                <span className="h-3 w-px bg-neutral-300"></span>
                <span>운용사: {etf.issuer.issuerName}</span>
                <span className="h-3 w-px bg-neutral-300"></span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>상장일: {formatDate(etf.listingDate) || "-"}</span>
                  {etf.listingDateSource && (
                    <span className="text-[11px] font-semibold text-brand-700">
                      {etf.listingDateSource}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 sm:justify-end">
          </div>
        </div>
      </section>

      <EtfDetailClient etf={etf} peerComparison={resolvedPeerComparison}>
        {/* 2. ETF 핵심 요약 */}
        <section aria-labelledby="classification-title" className="scroll-mt-24 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold text-strong" id="classification-title">ETF 핵심 요약</h2>
          </div>
          <p className="mt-2 text-base font-medium text-strong">{oneLineDesc}</p>
          
          {/* 4대 핵심 투자 지표 */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl border border-line bg-surface shadow-sm">
            <div className="flex flex-col justify-center">
              <dt className="text-sm font-bold text-gray-500">순자산</dt>
              <dd className="mt-1 text-lg font-bold text-strong">{formatMoney(etf.aum)}</dd>
            </div>
            <div className="flex flex-col justify-center">
              <dt className="text-sm font-bold text-gray-500">거래대금</dt>
              <dd className="mt-1 text-lg font-bold text-strong">{formatMoney(etf.tradeValue)}</dd>
            </div>
            <div className="flex flex-col justify-center group relative cursor-help">
              <dt className="text-sm font-bold text-gray-500 flex items-center gap-1">
                실질 부담 비용
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </dt>
              <dd className="mt-1 text-lg font-bold text-strong">
                {isFeeVerified && fee?.totalFeePct !== null ? `${fee.totalFeePct}%` : <span className="text-sm font-semibold text-neutral-500">{getFeeStatusText(fee?.verificationStatus)}</span>}
              </dd>
              
              {/* Tooltip */}
              <div className="absolute left-0 sm:-left-12 top-full mt-2 w-64 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
                <div className="bg-strong text-white text-xs rounded-xl p-4 shadow-lg border border-neutral-700">
                  <div className="font-bold mb-2 text-[13px] border-b border-neutral-600 pb-2">비용 상세 내역</div>
                  <div className="space-y-1.5 font-medium">
                    <div className="flex justify-between">
                      <span className="text-neutral-300">총보수</span>
                      <span>{isFeeVerified && fee?.totalFeePct !== null ? `${fee.totalFeePct}%` : getFeeStatusText(fee?.verificationStatus)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-300">기타비용</span>
                      <span>{isFeeVerified && fee?.otherCostPct !== null ? `${fee.otherCostPct}%` : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-300">매매·중개 관련 비용</span>
                      <span>{isFeeVerified && fee?.tradingCostPct !== null ? `${fee.tradingCostPct}%` : "-"}</span>
                    </div>
                  </div>
                  {fee?.verifiedAt && <div className="mt-3 pt-2 border-t border-neutral-600 text-[10px] text-neutral-400">공식 검증일: {formatDate(fee.verifiedAt)}</div>}
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <dt className="text-sm font-bold text-gray-500">연금 투자</dt>
              <dd className="mt-1 text-lg font-bold text-strong">
                <span className={`${etf.pension === "가능" ? "text-emerald-600" : etf.pension === "불가" ? "text-rose-600" : "text-neutral-500"}`}>{etf.pension}</span>
              </dd>
            </div>
          </div>

          {/* 상품 기본 속성 */}
          <div className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="flex flex-col sm:flex-row sm:items-start sm:gap-2">
                <dt className="text-sm font-bold text-muted sm:w-28 shrink-0">기초지수</dt>
                <dd className="font-bold text-strong leading-snug">{etf.baseIndex || "-"}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start sm:gap-2">
                <dt className="text-sm font-bold text-muted sm:w-28 shrink-0">투자 지역</dt>
                <dd className="font-bold text-strong">{marketScope || "-"}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start sm:gap-2">
                <dt className="text-sm font-bold text-muted sm:w-28 shrink-0">자산군</dt>
                <dd className="font-bold text-strong">{assetClass || "-"}</dd>
              </div>
              {etf.classification?.assetDetail && (
                <div className="flex flex-col sm:flex-row sm:items-start sm:gap-2">
                  <dt className="text-sm font-bold text-muted sm:w-28 shrink-0">세부 자산 분류</dt>
                  <dd className="font-bold text-strong">{etf.classification.assetDetail}</dd>
                </div>
              )}
              {etf.classification?.strategy && (
                <div className="flex flex-col sm:flex-row sm:items-start sm:gap-2">
                  <dt className="text-sm font-bold text-muted sm:w-28 shrink-0">운용 전략</dt>
                  <dd className="font-bold text-strong">{etf.classification.strategy}</dd>
                </div>
              )}
              {marketScope && marketScope !== "국내" && etf.classification?.fxHedge && (
                <div className="flex flex-col sm:flex-row sm:items-start sm:gap-2">
                  <dt className="text-sm font-bold text-muted sm:w-28 shrink-0">환헤지 여부</dt>
                  <dd className="font-bold text-strong">{etf.classification.fxHedge}</dd>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-start sm:gap-2">
                <dt className="text-sm font-bold text-muted sm:w-28 shrink-0">운용사</dt>
                <dd className="font-bold text-strong">{etf.issuer.issuerStatus !== "needs_review" ? etf.issuer.issuerName : "운용사 확인 필요"}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start sm:gap-2">
                <dt className="text-sm font-bold text-muted sm:w-28 shrink-0">상장일</dt>
                <dd className="font-bold text-strong">{formatDate(etf.listingDate) || "-"}</dd>
              </div>
              
              {etf.classification?.published && etf.classification.sourceUrl && (
                <div className="sm:col-span-2 pt-2">
                  <a className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand-800 transition-colors" href={etf.classification.sourceUrl} rel="noreferrer" target="_blank">
                    <span>공식 상품 페이지 열기</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                </div>
              )}
            </dl>
          </div>
        </section>


        {/* 3. 수익률 차트 및 표 */}
        <section aria-labelledby="returns-title" className="scroll-mt-24 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold text-strong" id="returns-title">과거 수익률</h2>
            </div>
          </div>
          <div className="mt-5">
            <PriceHistoryChart ticker={etf.ticker} asOfDate={etf.asOfDate} />
          </div>


          <div className="mt-2 overflow-hidden rounded-xl border border-line bg-surface">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full min-w-[1000px] table-fixed text-center">
                <caption className="sr-only">{etf.name} 기본 기간별 가격 수익률</caption>
                <thead className="bg-neutral-50 text-base font-bold text-muted border-b border-line">
                  <tr>{defaultPeriods.map((period) => <th className="px-4 py-3 whitespace-nowrap" key={period} scope="col">{RETURN_PERIOD_LABELS[period]}</th>)}</tr>
                </thead>
                <tbody>
                  <tr>
                    {defaultPeriods.map((period) => (
                      <td className="px-4 py-4 tabular-nums" key={period}>
                        {etf.returns[period] === null ? <span aria-label="데이터 없음" className="text-muted font-medium text-lg">—</span> : <span className="font-bold text-lg tracking-tight"><ReturnCell value={etf.returns[period]!} /></span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
        
      </EtfDetailClient>

      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />
    </main>
  );
}
