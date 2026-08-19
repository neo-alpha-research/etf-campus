import Link from "next/link";

import { AsOfDate, PensionBadge, RiskBadge, ReturnCell } from "@/components/etf";
import { siteConfig } from "@/config/site";
import { formatMoney, formatWon } from "@/lib/domain/etf-format";
import { isNewListing } from "@/lib/domain/etf-explorer";
import { RETURN_PERIOD_LABELS, type Etf, type ReturnPeriod } from "@/lib/domain/etf-types";
import { getEtfCautions, getFxImpactNotice } from "@/lib/domain/etf-classification";
import { EtfDetailClient } from "./etf-detail-client";
import { DistributionHistoryCard } from "./distribution-history-card";
import { PriceHistoryChart } from "./price-history-chart";

import type { PeerComparison } from "@/lib/data/etf-peer-groups";
import type { EtfReturnDisplayStatus } from "@/lib/data/etf-return-status";

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
  returnDisplayStatus,
}: {
  etf: Etf;
  peerComparison?: PeerComparison;
  returnDisplayStatus?: EtfReturnDisplayStatus;
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
  const defaultPeriods: ReturnPeriod[] = newListing
    ? ["1d", "1w", "2w", "1m", "2m", ...(itdAvailable ? ["itd" as const] : [])]
    : ["1d", "1w", "2w", "1m", "2m", "3m", "6m", "12m", "24m", "36m", "ytd"];

  const fee = etf.fee;
  const isFeeVerified = fee?.verificationStatus === "verified_official";
  const feeSource = fee?.dartReceiptNo
    ? {
        label: "\uAE08\uAC10\uC6D0 DART \uD22C\uC790\uC124\uBA85\uC11C",
        url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${fee.dartReceiptNo}`,
      }
    : fee?.primarySourceUrl
      ? { label: "\uC6B4\uC6A9\uC0AC \uACF5\uC2DD \uC790\uB8CC", url: fee.primarySourceUrl }
      : fee?.secondarySourceUrl
        ? { label: "\uACF5\uC2DD \uBCF4\uC870 \uC790\uB8CC", url: fee.secondarySourceUrl }
        : null;

  const getFeeStatusText = (status: string | undefined) => {
    switch(status) {
      case "seed_unverified": return "검증 전 데이터";
      case "conflict": return "출처 간 정보 불일치";
      case "pending_review": return "공식 데이터 확인 중";
      case "stale": return "최신화 필요";
      default: return "공식 데이터 확인 중";
    }
  };

  const EN_PERIOD_LABELS: Record<string, string> = { "1d": "1D", "1w": "1W", "2w": "2W", "1m": "1M", "2m": "2M", "3m": "3M", "6m": "6M", "12m": "1Y", "24m": "2Y", "36m": "3Y", "ytd": "YTD", "itd": "ITD" };

  return (
    <main className="page-shell flex-1 py-6 sm:py-8 space-y-6">
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
                {(etf.nav != null || etf.disparity != null) && (
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-600 bg-neutral-100/80 px-2.5 py-1 rounded-md max-w-fit">
                    {etf.nav != null && <span>NAV: {formatWon(etf.nav)}</span>}
                    {etf.nav != null && etf.disparity != null && <span className="w-px h-3 bg-neutral-300 mx-0.5"></span>}
                    {etf.disparity != null && (
                      <span className="flex items-center gap-1">
                        괴리율: <ReturnCell value={etf.disparity} />
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
              <PriceHistoryChart ticker={etf.ticker} etfName={etf.name} asOfDate={etf.asOfDate} listingDate={etf.listingDate} actualFirstTradingDate={etf.firstTradedDate} isNewListing={newListing} itdAnchor={etf.itdAnchor} />

              {newListing && !itdAvailable ? <p className="px-1 text-xs font-medium text-muted">상장일 기준 가격 확인 후 상장 후 수익률(PR)을 제공합니다.</p> : null}
              {itdPendingVerification ? <p className="px-1 text-xs font-medium text-amber-700">ITD는 상장일 기준 가격으로 산출한 PR이며, KRX 기준가격 공식 대조는 진행 중입니다.</p> : null}
              
              <div className="overflow-hidden rounded-xl border border-line bg-line">
                <div
                  role="table"
                  aria-label={`${etf.name} 기본 기간별 가격 수익률`}
                  data-testid="return-period-table"
                  className="grid gap-px"
                  style={{ gridTemplateColumns: `repeat(${defaultPeriods.length}, minmax(0, 1fr))` }}
                >
                  {defaultPeriods.map((period) => (
                    <div key={period} role="cell" className="bg-surface py-2.5 px-0.5 sm:px-1 flex flex-col items-center justify-center text-center">
                      <div className="text-[11px] font-bold text-muted mb-1" title={RETURN_PERIOD_LABELS[period]} aria-label={RETURN_PERIOD_LABELS[period]}>
                        <span aria-hidden="true">{EN_PERIOD_LABELS[period] || period}</span>
                      </div>
                      <div className="text-[11px] sm:text-[12px] font-bold tabular-nums tracking-tighter">
                        {etf.returns[period] === null ? (
                          <span aria-label="데이터 없음" className="text-muted font-medium">—</span>
                        ) : (
                          <ReturnCell value={etf.returns[period]!} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 오른쪽 영역 (약 30%): 투자 전 체크 지표 */}
            <div className="w-full lg:w-[30%] lg:min-w-[300px]">
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm h-full flex flex-col gap-5">
                <h3 className="text-base font-extrabold text-strong">투자 전 체크 지표</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-5">
                  <div className="flex flex-col justify-center">
                    <dt className="text-sm font-bold text-gray-500">순자산</dt>
                    <dd className="mt-1 text-lg font-bold text-strong">{formatMoney(etf.aum)}</dd>
                  </div>
                  <div className="flex flex-col justify-center">
                    <dt className="text-sm font-bold text-gray-500">1일 거래대금</dt>
                    <dd className="mt-1 text-lg font-bold text-strong">{formatMoney(etf.tradeValue)}</dd>
                  </div>
                  {etf.trackingError != null && (
                    <div className="flex flex-col justify-center group relative cursor-help">
                      <dt className="text-sm font-bold text-gray-500 flex items-center gap-1">
                        추적오차율
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </dt>
                      <dd className="mt-1 text-lg font-bold text-strong">{etf.trackingError.toFixed(2)}%</dd>
                      
                      {/* Tooltip */}
                      <div className="absolute right-0 sm:left-0 lg:-left-12 top-full mt-2 w-72 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
                        <div className="bg-strong text-white text-xs rounded-xl p-4 shadow-lg border border-neutral-700 font-medium leading-relaxed">
                          수치가 낮을수록 운용사가 기초지수를 오차 없이 잘 추종하고 있음을 의미합니다.
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col justify-center group relative cursor-help">
                    <dt className="text-sm font-bold text-gray-500 flex items-center gap-1">
                      실질 부담 비용
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </dt>
                    <dd className="mt-1 flex flex-wrap items-baseline gap-2 text-lg font-bold text-strong">
                      <span>
                        {(fee?.verificationStatus === "verified_official" || fee?.verificationStatus === "official_single_source") ? (
                          (fee?.totalFeePct != null && fee?.otherCostPct != null && fee?.tradingCostPct != null) ? (
                            `${(fee!.totalFeePct! + fee!.otherCostPct! + fee!.tradingCostPct!).toFixed(4).replace(/\\.?0+$/, '')}%`
                          ) : fee?.totalFeePct != null ? (
                            `${fee!.totalFeePct!}% (총보수)`
                          ) : (
                            <span className="text-sm font-semibold text-neutral-500">확인 중</span>
                          )
                        ) : (
                          <span className="text-sm font-semibold text-neutral-500">{getFeeStatusText(fee?.verificationStatus)}</span>
                        )}
                      </span>
                      {fee?.verificationStatus === "verified_official" && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">공식 검증 완료</span>
                      )}
                      {fee?.verificationStatus === "official_single_source" && (
                        <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">공식 원문 확인</span>
                      )}
                    </dd>
                    
                    {/* Tooltip */}
                    <div className="absolute right-0 sm:left-0 lg:-left-12 top-full mt-2 w-72 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
                      <div className="bg-strong text-white text-xs rounded-xl p-4 shadow-lg border border-neutral-700">
                        <div className="font-bold mb-2 text-[13px] border-b border-neutral-600 pb-2">비용 상세 내역</div>
                        <div className="space-y-1.5 font-medium">
                          <div className="flex justify-between">
                            <span className="text-neutral-300">총보수</span>
                            <span>{(fee?.verificationStatus === "verified_official" || fee?.verificationStatus === "official_single_source") && fee?.totalFeePct != null ? `${fee?.totalFeePct}%` : "확인 중"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-300">기타비용</span>
                            <span>{fee?.otherCostPct != null ? `${fee?.otherCostPct}%` : "확인 중"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-300">매매·중개 관련 비용</span>
                            <span>{fee?.tradingCostPct != null ? `${fee?.tradingCostPct}%` : "확인 중"}</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-neutral-600 space-y-1 text-[11px] text-neutral-300">
                          {fee?.effectiveDate ? (
                            <div>효력발생일: {fee.effectiveDate}</div>
                          ) : (
                            <div>공시·적용 기준일: 확인 중</div>
                          )}
                          {feeSource && (
                            <div>
                              <a href={feeSource.url} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
                                공식 출처 보기
                              </a>
                            </div>
                          )}
                        </div>
                        {fee?.verificationStatus === "official_single_source" && (
                          <div className="mt-2 text-[10px] text-amber-200 bg-amber-900/30 p-1.5 rounded">
                            * 추가 교차검증 진행 중 설명
                          </div>
                        )}
                        {(fee?.totalFeePct !== null && (fee?.otherCostPct === null || fee?.tradingCostPct === null)) && (
                          <div className="mt-2 text-[10px] text-neutral-400">
                            * 세부 비용이 모두 확인되지 않아 실질부담비용은 추정하지 않음.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center group relative cursor-help">
                    <dt className="text-sm font-bold text-gray-500 flex items-center gap-1">
                      기본 수익률 기준
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-neutral-500">분배금 미포함</dd>
                    
                    {/* Tooltip */}
                    <div className="absolute right-0 sm:left-0 lg:-left-12 top-full mt-3 w-72 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-2xl z-50 opacity-0 invisible group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-all duration-200 pointer-events-none">
                {feeSource && (
                  <div className="mt-3 border-t border-neutral-600 pt-2 text-[11px] text-neutral-300">
                    <span className="mr-1 text-neutral-400">\uB300\uD45C \uCD9C\uCC98:</span>
                    <a
                      className="underline decoration-neutral-500 underline-offset-2 hover:text-white"
                      href={feeSource.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {feeSource.label}
                    </a>
                  </div>
                )}
                      <div className="bg-strong text-white text-xs rounded-xl p-4 shadow-lg border border-neutral-700 font-medium leading-relaxed">
                                                상세페이지의 수익률은 모든 ETF에서 시장 종가 기준 누적 수익률(PR)이며 분배금을 포함하지 않습니다.

                      </div>
                    </div>
                  </div>
                </div>
                {etf.distributionSummary ? <DistributionHistoryCard summary={etf.distributionSummary} /> : null}
              </div>
            </div>
          </div>
        </section>


      </EtfDetailClient>

      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />
    </main>
  );
}
