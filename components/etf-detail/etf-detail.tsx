import Link from "next/link";

import { AsOfDate, PensionBadge, RiskBadge, ReturnCell } from "@/components/etf";
import { siteConfig } from "@/config/site";
import { formatMoney, formatWon } from "@/lib/domain/etf-format";
import { getReturnPeriods, isNewListing } from "@/lib/domain/etf-explorer";
import { RETURN_PERIOD_LABELS, type Etf, type ReturnPeriod } from "@/lib/domain/etf-types";
import { getClassificationStatusLabel, getEtfCautions, getFxImpactNotice } from "@/lib/domain/etf-classification";
import { EtfDetailClient, CompareActionButton } from "./etf-detail-client";
import { PriceHistoryChart } from "./price-history-chart";

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

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  if (dateString.length === 8) {
    return `${dateString.slice(0, 4)}.${dateString.slice(4, 6)}.${dateString.slice(6, 8)}`;
  }
  return dateString;
}

export function EtfDetail({ etf, similarTopEtfs = [] }: { etf: Etf, similarTopEtfs?: { ticker: string, name: string }[] }) {
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
            <CompareActionButton etf={etf} />
          </div>
        </div>
      </section>

      <EtfDetailClient etf={etf} similarTopEtfs={similarTopEtfs}>
        {/* 2. ETF 핵심 요약 */}
        <section aria-labelledby="classification-title" className="scroll-mt-24 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold text-strong" id="classification-title">ETF 핵심 요약</h2>
            <span className="text-xs font-semibold text-muted">
              {etf.classification?.reviewStatus === "자동확정" ? "자동확정" : getClassificationStatusLabel(etf)}
            </span>
          </div>
          <p className="mt-2 text-base font-medium text-strong">{oneLineDesc}</p>
          
          <div className="mt-5 rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-xs font-bold text-muted">기초지수</dt><dd className="mt-1.5 font-bold text-strong text-base">{etf.baseIndex || "-"}</dd></div>
              <div><dt className="text-xs font-bold text-muted">투자 지역</dt><dd className="mt-1.5 font-bold text-strong text-base">{marketScope || "-"}</dd></div>
              <div><dt className="text-xs font-bold text-muted">자산군</dt><dd className="mt-1.5 font-bold text-strong text-base">{assetClass || "-"}</dd></div>
              {etf.classification?.assetDetail && <div><dt className="text-xs font-bold text-muted">세부 자산 분류</dt><dd className="mt-1.5 font-bold text-strong text-base">{etf.classification.assetDetail}</dd></div>}
              {etf.classification?.strategy && <div><dt className="text-xs font-bold text-muted">운용 전략</dt><dd className="mt-1.5 font-bold text-strong text-base">{etf.classification.strategy}</dd></div>}
              {marketScope && marketScope !== "국내" && etf.classification?.fxHedge && (
                <div><dt className="text-xs font-bold text-muted">환헤지 여부</dt><dd className="mt-1.5 font-bold text-strong text-base">{etf.classification.fxHedge}</dd></div>
              )}
              {etf.issuer.issuerStatus !== "needs_review" && <div><dt className="text-xs font-bold text-muted">운용사</dt><dd className="mt-1.5 font-bold text-strong text-base">{etf.issuer.issuerName}</dd></div>}
              {etf.issuer.issuerStatus === "needs_review" && <div><dt className="text-xs font-bold text-muted">운용사</dt><dd className="mt-1.5 font-bold text-strong text-base">운용사 확인 필요</dd></div>}
              <div><dt className="text-xs font-bold text-muted">상장일</dt><dd className="mt-1.5 font-bold text-strong text-base">{formatDate(etf.listingDate) || "-"}</dd></div>
              
              {etf.classification?.published && etf.classification.sourceUrl && (
                <div className="sm:col-span-2 lg:col-span-3 pt-2">
                  <a className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand-800 transition-colors" href={etf.classification.sourceUrl} rel="noreferrer" target="_blank">
                    <span>공식 상품 페이지 열기</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                </div>
              )}
            </dl>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-center shadow-sm">
              <dt className="text-xs font-bold text-muted">순자산</dt>
              <dd className="mt-1.5 text-lg font-extrabold text-brand-800">{formatMoney(etf.aum)}</dd>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-center shadow-sm">
              <dt className="text-xs font-bold text-muted">거래대금</dt>
              <dd className="mt-1.5 text-lg font-extrabold text-brand-800">{formatMoney(etf.tradeValue)}</dd>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-center shadow-sm">
              <dt className="text-xs font-bold text-muted">총보수</dt>
              <dd className="mt-1.5 text-lg font-extrabold text-brand-800">
                {isFeeVerified && fee?.totalFeePct !== null ? `${fee.totalFeePct}%` : <span className="text-sm font-semibold text-neutral-500">{getFeeStatusText(fee?.verificationStatus)}</span>}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-center shadow-sm">
              <dt className="text-xs font-bold text-muted">연금 투자</dt>
              <dd className="mt-1.5 text-lg font-extrabold">
                <span className={`${etf.pension === "가능" ? "text-emerald-600" : etf.pension === "불가" ? "text-rose-600" : "text-neutral-500"}`}>{etf.pension}</span>
              </dd>
            </div>
          </div>
        </section>

        {/* 3. 수익률 차트 및 표 */}
        <section aria-labelledby="returns-title" className="scroll-mt-24 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold text-strong" id="returns-title">최근 성과 확인</h2>
              <p className="mt-1.5 text-sm font-bold text-brand-700">가격수익률(PR) · 분배금 미포함</p>
            </div>
          </div>
          <div className="mt-5">
            <PriceHistoryChart ticker={etf.ticker} asOfDate={etf.asOfDate} />
          </div>

          <div className="mt-6 flex justify-end">
            <p className="text-xs font-semibold leading-5 text-muted">1일은 직전 거래일, 주·개월은 기준일에서 해당 달력 기간 전 날짜의 당일 또는 직전 거래일 종가 대비{newListing ? " · 상장 후는 첫 거래일 종가 대비" : ""}</p>
          </div>
          <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-center text-sm">
                <caption className="sr-only">{etf.name} 기본 기간별 가격 수익률</caption>
                <thead className="bg-neutral-50 text-xs font-bold text-muted border-b border-line">
                  <tr>{defaultPeriods.map((period) => <th className="px-3 py-3.5 min-w-[60px]" key={period} scope="col">{RETURN_PERIOD_LABELS[period]}</th>)}</tr>
                </thead>
                <tbody>
                  <tr>
                    {defaultPeriods.map((period) => (
                      <td className="px-3 py-5" key={period}>
                        {etf.returns[period] === null ? <span aria-label="데이터 없음" className="text-muted font-medium">—</span> : <span className="font-bold text-[15px]"><ReturnCell value={etf.returns[period]!} /></span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>


        </section>

        {/* 4. 비용 자세히 보기 */}
        <section aria-labelledby="cost-title" className="scroll-mt-24 pt-4">
          <h3 className="text-lg font-extrabold text-strong mb-4" id="cost-title">비용 자세히 보기</h3>
          
          <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">ETF 상세 비용 정보</caption>
              <tbody className="divide-y divide-line">
                <tr className="bg-neutral-50/50">
                  <th scope="row" className="px-5 py-4 font-bold text-strong w-1/2">총보수</th>
                  <td className="px-5 py-4 text-right font-extrabold text-brand-800">
                    {isFeeVerified && fee?.totalFeePct !== null ? `${fee.totalFeePct}%` : <span className="text-muted font-semibold">{getFeeStatusText(fee?.verificationStatus)}</span>}
                  </td>
                </tr>
                {isFeeVerified && fee?.totalFeePct !== null && (
                  <tr className="bg-brand-50/30">
                    <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-brand-800 text-center">
                      💡 1,000만원 투자 시 총보수만 단순 적용하면 연간 약 {formatWon(10000000 * (fee.totalFeePct / 100))}
                    </td>
                  </tr>
                )}
                <tr>
                  <th scope="row" className="px-5 py-4 font-bold text-strong w-1/2">총보수 및 기타비용 (TER)</th>
                  <td className="px-5 py-4 text-right font-bold text-strong">
                    {isFeeVerified && fee?.terPct !== null ? `${fee.terPct}%` : <span className="text-muted font-medium">{getFeeStatusText(fee?.verificationStatus)}</span>}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="px-5 py-4 font-bold text-strong text-neutral-600 w-1/2 pl-8 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-l border-b border-neutral-400"></span>
                    기타비용
                  </th>
                  <td className="px-5 py-4 text-right font-semibold text-strong">
                    {isFeeVerified && fee?.otherCostPct !== null ? `${fee.otherCostPct}%` : <span className="text-muted font-medium">{getFeeStatusText(fee?.verificationStatus)}</span>}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="px-5 py-4 font-bold text-strong w-1/2">매매·중개 관련 비용</th>
                  <td className="px-5 py-4 text-right font-bold text-strong">
                    {isFeeVerified && fee?.tradingCostPct !== null ? `${fee.tradingCostPct}%` : <span className="text-muted font-medium">{getFeeStatusText(fee?.verificationStatus)}</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-muted">
            <p>총보수만 단순 환산한 값으로, 실제 비용에는 기타비용과 매매·중개 관련 비용 등이 추가될 수 있습니다.</p>
            {fee?.verifiedAt && <p>공식 검증일: {formatDate(fee.verifiedAt)}</p>}
            {fee?.dartReceiptNo && <p>DART 접수번호: {fee.dartReceiptNo}</p>}
          </div>
        </section>

        {/* 6. 위험 및 주의사항 / 연금 편입 상세 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6">
          <section aria-labelledby="cautions-title">
            <h3 className="text-lg font-extrabold text-strong mb-4" id="cautions-title">위험 및 주의사항</h3>
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm h-full flex flex-col">
              {cautions.length > 0 ? (
                <div aria-label="살펴볼 특성" className="flex flex-wrap gap-2 mb-4">
                  {cautions.map((caution) => (
                    <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[13px] font-bold text-amber-800 border border-amber-100" key={caution}>{caution}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-medium text-muted mb-4">특별히 안내할 주의사항이 없습니다.</p>
              )}
              {fxImpactNotice && <p className="text-[13px] leading-relaxed text-muted bg-neutral-50 p-3 rounded-lg mt-auto">{fxImpactNotice}</p>}
              <p className="mt-auto pt-4 text-[11px] text-muted font-medium">과거 수익률은 미래 수익을 보장하지 않으며 본 정보는 투자 추천이 아닙니다.</p>
            </div>
          </section>

          <section aria-labelledby="pension-detail-title">
            <h3 className="text-lg font-extrabold text-strong mb-4" id="pension-detail-title">연금 편입 안내</h3>
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm h-full flex flex-col">
              <div className="mb-4">
                <PensionBadge status={etf.pension} />
              </div>
              <p className="text-[13px] leading-relaxed text-strong font-medium bg-neutral-50 p-3 rounded-lg flex-1">
                {getPensionDescription(etf, newListing)}
              </p>
            </div>
          </section>
        </div>
        
      </EtfDetailClient>

      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />
    </main>
  );
}
