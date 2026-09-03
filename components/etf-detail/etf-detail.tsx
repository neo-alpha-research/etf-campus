import Link from "next/link";

import { AsOfDate, PensionBadge, RiskBadge, ReturnCell } from "@/components/etf";
import { siteConfig } from "@/config/site";
import { formatMoney, formatWon } from "@/lib/domain/etf-format";
import { isNewListing } from "@/lib/domain/etf-explorer";
import { type Etf } from "@/lib/domain/etf-types";
import { getEtfCautions, getFxImpactNotice } from "@/lib/domain/etf-classification";
import { getFeeDisplayContext } from "@/lib/domain/etf-fee-utils";
import { EtfDetailClient } from "./etf-detail-client";
import { FeeMetricItem } from "./fee-metric-item";
import { DistributionHistoryCard } from "./distribution-history-card";
import { PriceHistoryChart } from "./price-history-chart";
import { EtfHoldings } from "./etf-holdings";
import { ReturnPeriodGrid } from "./return-period-grid";

import type { PeerComparison } from "@/lib/data/etf-peer-groups";

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const datePart = dateString.split(" ")[0];
  if (datePart.length === 8 && !datePart.includes("-") && !datePart.includes(".")) {
    return `${datePart.slice(0, 4)}.${datePart.slice(4, 6)}.${datePart.slice(6, 8)}`;
  }
  return datePart.replace(/-/g, ".");
}

const INDEX_CATEGORY_LABELS: Record<string, string> = {
  "대표지수": "시장대표 지수",
  "산업·섹터": "섹터 지수",
  "테마": "테마 지수",
  "채권": "채권 지수",
  "스타일·팩터": "스타일·팩터 지수",
  "규모": "규모 지수",
  "기업집단": "기업집단 지수",
  "배당·주주환원": "배당·주주환원 지수",
};

function formatStrategyLabel(
  strategy: string | null | undefined,
  baseIndex: string,
  comparisonCategory: string | null | undefined,
): string {
  if (!strategy) return "";
  if (strategy === "일반" || strategy === "passive") {
    return INDEX_CATEGORY_LABELS[comparisonCategory ?? ""] ?? (baseIndex ? "지수 추종" : "일반 전략");
  }
  return strategy;
}

export function EtfDetail({
  etf,
  peerComparison,
}: {
  etf: Etf;
  peerComparison?: PeerComparison;
}) {

  const resolvedPeerComparison: PeerComparison = peerComparison ?? {
    profile: null,
    state: "unverified",
    groups: [],
  };
  const newListing = isNewListing(etf);
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
  const hasBaseIndexInDesc = Boolean(etf.baseIndex && marketScope && assetClass);
  const oneLineDesc = hasBaseIndexInDesc 
    ? `${etf.baseIndex}를 기준으로 운용되는 ${marketScope} ${assetClass} ETF입니다.` 
    : (marketScope && assetClass ? `${marketScope} ${assetClass} ETF입니다.` : "");

  const itdAvailable = Boolean(newListing && etf.itdAnchor?.price && etf.itdAnchor?.date && etf.returns.itd !== null);
  const itdPendingVerification = Boolean(itdAvailable && !etf.itdAnchor?.verified);

  return (
    <main className="page-shell flex-1 py-6 sm:py-8 space-y-3">
      {/* 1. 상품 헤더 */}
      <section aria-labelledby="header-title">
        <h2 className="sr-only" id="header-title">상품 헤더</h2>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-4">
            
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <Link className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-neutral-100 p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 transition-colors mr-1" href="/" aria-label="목록으로 돌아가기">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </Link>
                {marketScope && <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">{marketScope}</span>}
                {assetClass && <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{assetClass}</span>}
                {etf.classification?.strategy && <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700">{formatStrategyLabel(etf.classification.strategy, etf.baseIndex, peerComparison?.profile?.comparisonCategory)}</span>}
                {etf.classification?.fxHedge && <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">{etf.classification.fxHedge}</span>}
                <RiskBadge riskType={etf.riskType} />
                {etf.pension === "가능" && <PensionBadge status={etf.pension} />}
                {cautions.map(caution => (
                  <span key={caution} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">{caution}</span>
                ))}
                {fxImpactNotice && (
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800" title={fxImpactNotice}>환율변동위험</span>
                )}
              </div>

              <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-3xl font-extrabold tracking-tight text-strong sm:text-4xl">
                {etf.name}
                <span className="text-lg font-bold text-slate-500 tabular-nums tracking-normal">{etf.ticker}</span>
              </h1>
            </div>
            
            {(etf.riskType === "leverage" || etf.riskType === "inverse") && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-bold text-rose-700">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {etf.riskType === "leverage" ? "레버리지 (고위험)" : "인버스 (고위험)"} 상품입니다. 투자 전 구조를 반드시 이해하세요.
              </div>
            )}

            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 pt-1">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-brand-700 tabular-nums tracking-tight">{formatWon(etf.close)}</span>
                  <span className="text-lg font-bold"><ReturnCell value={etf.changePct} /></span>
                </div>
                {(etf.nav != null || etf.disparity != null || etf.trackingError != null) && (
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-600 bg-neutral-100/80 px-2.5 py-1 rounded-md max-w-fit flex-wrap">
                    {etf.nav != null && <span>NAV: {formatWon(etf.nav)}</span>}
                    {etf.nav != null && (etf.disparity != null || etf.trackingError != null) && <span className="w-px h-3 bg-neutral-300 mx-0.5 hidden sm:block"></span>}
                    {etf.disparity != null && (
                      <span className="flex items-center gap-1">
                        괴리율: <ReturnCell value={etf.disparity} />
                      </span>
                    )}
                    {etf.disparity != null && etf.trackingError != null && <span className="w-px h-3 bg-neutral-300 mx-0.5 hidden sm:block"></span>}
                    {etf.trackingError != null && (
                      <span className="flex items-center gap-1 group relative cursor-help text-neutral-700 font-mono">
                        <span className="font-sans font-semibold">추적오차율:</span> {etf.trackingError.toFixed(2)}%
                        <div className="absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-[calc(100%+8px)] w-72 p-3 rounded-xl bg-neutral-900/95 backdrop-blur-md text-white text-left shadow-2xl border border-neutral-700/80 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] font-sans font-normal">
                          <div className="absolute -top-1.5 left-4 sm:left-1/2 sm:-translate-x-1/2 border-[6px] border-transparent border-b-neutral-900/95" />
                          <div className="text-[12px] font-black text-brand-300 mb-1">추적 오차율 (Tracking Error)</div>
                          <div className="text-[11px] text-neutral-200 leading-tight mb-2">과거 1년간 ETF 순자산가치(NAV)와 기초지수 간의 일간 수익률 차이의 변동성입니다. 숫자가 낮을수록 지수를 안정적으로 잘 추종함을 의미합니다.</div>
                          <div className="text-[11px] text-emerald-300 bg-emerald-950/70 p-2 rounded border border-emerald-700/60 leading-snug mb-1.5">
                            <strong>배당금(분배금) 효과를 금융공학적으로 보정한 [순수 운용 추적오차(TR 기준)]입니다.</strong>
                          </div>
                          {etf.name.includes("액티브") && (
                            <div className="text-[10.5px] bg-brand-900/40 text-brand-200 p-1.5 rounded border border-brand-700/50 mt-1">
                              💡 <strong>액티브 ETF:</strong> 초과수익 추구로 추적오차율이 자연스럽게 높게 나타납니다.
                            </div>
                          )}
                        </div>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-[16px] font-semibold text-muted pb-1">
                <AsOfDate value={etf.asOfDate} />
                <span className="h-3 w-px bg-neutral-300"></span>
                <span>운용사: {etf.issuer.issuerName}</span>
                <span className="h-3 w-px bg-neutral-300"></span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {etf.listingDateStatus === "provisional_first_trade" ? (
                    <span>최초 종가 확인일: {formatDate(etf.listingDate) || "-"}</span>
                  ) : etf.listingDateStatus === "unavailable" ? (
                    <span>공식 상장일 확인 중</span>
                  ) : (
                    <span>상장일: {formatDate(etf.listingDate) || "-"}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 sm:justify-end">
          </div>
        </div>
      </section>

            <EtfDetailClient
              etf={etf}
              peerComparison={resolvedPeerComparison}
            >

        {/* ETF 핵심 요약 및 차트 */}
        <section aria-labelledby="classification-title" className="scroll-mt-24 pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold text-strong" id="classification-title">ETF 핵심 요약</h2>
          </div>
          {oneLineDesc && <p className="mt-2 text-base font-medium text-strong">{oneLineDesc}</p>}
          {!hasBaseIndexInDesc && etf.baseIndex && (
            <p className="mt-2 text-base font-medium text-strong">기초지수: {etf.baseIndex}</p>
          )}
          {etf.classification?.published && etf.classification.sourceUrl && (
            <div className="mt-2">
              <a className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand-800 transition-colors" href={etf.classification.sourceUrl} rel="noreferrer" target="_blank">
                <span>공식 상품 페이지 열기</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          )}
          
          <div className="mt-4 flex flex-col lg:flex-row gap-6 items-stretch">
            {/* 왼쪽 영역 (약 70%): 수익률 차트 및 표 */}
            <div className="flex-1 w-full lg:w-[70%] flex flex-col gap-2">
              <PriceHistoryChart ticker={etf.ticker} etfName={etf.name} asOfDate={etf.asOfDate} listingDate={etf.listingDate} actualFirstTradingDate={etf.firstTradedDate} isNewListing={newListing} itdAnchor={etf.itdAnchor} fixedReturns={etf.returns} />

              {newListing && !itdAvailable ? <p className="px-1 text-xs font-medium text-muted">상장일 기준 가격 확인 후 상장 후 수익률(PR)을 제공합니다.</p> : null}
              {itdPendingVerification ? <p className="px-1 text-xs font-medium text-amber-700">ITD는 상장일 기준 가격으로 산출한 PR이며, KRX 기준가격 공식 대조는 진행 중입니다.</p> : null}
              
              <ReturnPeriodGrid etf={etf} />

              <EtfHoldings ticker={etf.ticker} />
            </div>

            {/* 오른쪽 영역 (약 30%): 투자 전 체크 지표 */}
            <div className="w-full lg:w-[30%] lg:min-w-[300px]">
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm h-full flex flex-col gap-5">
                <h3 className="text-base font-extrabold text-strong">투자 전 체크 지표</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-1 gap-5">
                  <div className="flex flex-col justify-center">
                    <dt className="text-sm font-bold text-gray-500">순자산</dt>
                    <dd className="mt-1 text-lg font-bold text-strong">{formatMoney(etf.aum)}</dd>
                  </div>
                  <div className="flex flex-col justify-center">
                    <dt className="text-sm font-bold text-gray-500">1일 거래대금</dt>
                    <dd className="mt-1 text-lg font-bold text-strong">{formatMoney(etf.tradeValue)}</dd>
                  </div>

                  <FeeMetricItem etf={etf} />
                  
                  {/* 추적 오차율 추가 */}
                  {etf.trackingError != null && (
                    <div className="flex flex-col justify-center group relative cursor-help">
                      <dt className="text-sm font-bold text-gray-500 flex items-center gap-1">
                        추적 오차율
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </dt>
                      <dd className="mt-1 text-lg font-bold text-strong font-mono tabular-nums">
                        {etf.trackingError.toFixed(2)}%
                      </dd>
                      
                      <div className="absolute right-0 sm:left-0 lg:-left-12 top-full mt-2 w-72 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                        <div className="bg-strong text-white text-xs rounded-xl p-4 shadow-lg border border-neutral-700 font-medium leading-relaxed">
                          과거 1년간 ETF 순자산가치(NAV)와 기초지수 간의 일간 수익률 차이의 변동성입니다. 
                          <br/><br/>
                          <span className="text-brand-300 font-bold">숫자가 낮을수록</span> ETF가 목표 기초지수를 잘 추종하고 있음을 의미하는 신뢰 지표입니다.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col justify-center group relative cursor-help">
                    <dt className="text-sm font-bold text-gray-500 flex items-center gap-1">
                      기본 수익률 기준
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-neutral-500">
                      분배금 미포함 (PR)
                    </dd>

                    {/* Tooltip */}
                    <div className="absolute right-0 sm:left-0 lg:-left-12 top-full mt-2 w-72 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 pointer-events-none">
                      <div className="bg-strong text-white text-xs rounded-xl p-4 shadow-lg border border-neutral-700 font-medium leading-relaxed">
                        {etf.distributionSummary 
                          ? "상세페이지의 수익률은 분배금 재투자 여부를 반영하지 않은 시장 가격 기준 누적 수익률(PR)입니다. 배당/분배금이 지급되는 ETF의 경우, 실제 총수익률(TR)은 표기된 수익률보다 높을 수 있습니다." 
                          : "상세페이지의 수익률은 시장 가격 기준 누적 수익률(PR)입니다. 해당 ETF의 분배금(배당) 상세 내역은 현재 제공되지 않으며, 실제 분배금이 지급되었을 경우 이를 합산한 총수익률(TR)은 표기된 수익률보다 높을 수 있습니다."}
                      </div>
                    </div>
                  </div>
                </div>

                <DistributionHistoryCard
                  summary={etf.distributionSummary}
                  etfName={etf.name}
                  isTr={etf.returnsTr != null}
                  isNewListing={isNewListing(etf)}
                />
              </div>
            </div>
          </div>
        </section>

      </EtfDetailClient>

      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />
    </main>
  );
}
