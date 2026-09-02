"use client";

import type { EtfDistributionEvent, EtfDistributionSummary } from "@/lib/domain/etf-types";

function formatDate(value: string | null | undefined): string {
  if (!value) return "확인 중";
  const compact = value.replace(/[^0-9]/g, "");
  if (compact.length >= 8) return `${compact.slice(0, 4)}.${compact.slice(4, 6)}.${compact.slice(6, 8)}`;
  return value;
}

function formatAmount(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function scheduleDateLabel(event: EtfDistributionEvent): string {
  return event.exDate ? "분배락일" : "지급기준일";
}

function scheduleDateValue(event: EtfDistributionEvent): string | null {
  return event.exDate ?? event.recordDate;
}

function EventRow({ event }: { event: EtfDistributionEvent }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[12px] font-bold text-strong">
            {scheduleDateLabel(event)} {formatDate(scheduleDateValue(event))}
          </p>
          {event.dividendYieldPct != null && event.dividendYieldPct > 0 && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
              분배율 {event.dividendYieldPct.toFixed(2)}%
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] font-medium text-muted">
          지급일 {formatDate(event.payDate)}
          {event.recordDate && event.exDate && event.recordDate !== event.exDate && (
            <span className="ml-1.5 text-neutral-400">· 기준일 {formatDate(event.recordDate)}</span>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-extrabold tabular-nums text-strong">{formatAmount(event.amountKrw)}</p>
        <p className="mt-0.5 text-[10px] font-semibold text-neutral-500">{event.displayLabel}</p>
      </div>
    </li>
  );
}

interface DistributionHistoryCardProps {
  summary?: EtfDistributionSummary | null;
  etfName?: string;
  isTr?: boolean;
  isNewListing?: boolean;
}

export function DistributionHistoryCard({
  summary,
  etfName = "",
  isTr: isTrProp,
  isNewListing = false,
}: DistributionHistoryCardProps) {
  const isTr = isTrProp ?? summary?.isTr ?? (etfName.includes("(TR)") || etfName.includes(" TR") || etfName.endsWith("TR"));
  const records = summary?.records ?? [];
  const recentEvents = records.slice(0, 3);
  const hasEvents = records.length > 0;
  const latest = summary?.latest ?? (hasEvents ? records[0] : null);

  const paymentCycle = summary?.paymentCycle ?? (isTr ? "TR (재투자)" : isNewListing ? "신규 상장" : "미지급");
  const ttmAmount = summary?.ttmAmountKrw;
  const ttmYield = summary?.ttmDividendYieldPct;
  const sourceLabel = summary?.sourceLabel ?? "예탁원(SEIBro) 공시 기반";

  return (
    <section aria-labelledby="distribution-history-title" className="border-t border-line pt-4">
      <details className="group" open>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 id="distribution-history-title" className="text-base font-extrabold text-strong">
                분배금(배당) 지급 현황
              </h3>
              {isTr ? (
                <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                  토탈리턴 (TR)
                </span>
              ) : paymentCycle && paymentCycle !== "미지급" ? (
                <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                  🗓️ {paymentCycle}
                </span>
              ) : (
                <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-600">
                  {paymentCycle}
                </span>
              )}
              {ttmYield != null && ttmYield > 0 && !isTr && (
                <span
                  title="최근 12개월 주당 누적 분배금을 현재 종가로 나눈 연환산 분배율"
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700 cursor-help"
                >
                  연 {ttmYield.toFixed(2)}% (TTM)
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] font-medium text-muted">
              주당 세전 분배금 · 한국예탁결제원(SEIBro) 공시 기준
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden sm:inline-block rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">
              {sourceLabel}
            </span>
            <svg
              className="mt-1 h-4 w-4 text-muted transition-transform group-open:rotate-180"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </summary>

        <div className="pt-4 space-y-4">
          {/* TR / 신규 상장 / 무분배 상태별 Graceful Fallback 배너 */}
          {isTr ? (
            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
              <div className="flex items-start gap-2.5">
                <span className="text-base" aria-hidden="true">💡</span>
                <div>
                  <p className="text-[13px] font-bold text-purple-950">
                    토탈리턴(TR) 자동 재투자 펀드
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-purple-800">
                    본 ETF는 분배금을 현금으로 지급하지 않고 전액 지수 자산에 자동 재투자하는 토탈리턴(TR) 펀드입니다. 배당 수익이 기준가격(NAV) 및 TR 지수에 복리로 지속 반영됩니다.
                  </p>
                </div>
              </div>
            </div>
          ) : !hasEvents && isNewListing ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
              <div className="flex items-start gap-2.5">
                <span className="text-base" aria-hidden="true">🌱</span>
                <div>
                  <p className="text-[13px] font-bold text-amber-950">
                    신규 상장 종목
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
                    상장 초기 종목으로, 첫 분배금 지급 일정 공시를 대기 중입니다. 공시 즉시 지급 내역이 자동 갱신됩니다.
                  </p>
                </div>
              </div>
            </div>
          ) : !hasEvents ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-start gap-2.5">
                <span className="text-base" aria-hidden="true">ℹ️</span>
                <div>
                  <p className="text-[13px] font-bold text-neutral-800">
                    최근 1년간 지급된 분배금 내역이 없습니다.
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">
                    무배당 또는 자산 재투자형 상품의 경우 정기 분배금이 발생하지 않을 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 핵심 지표 4분할 카드 */}
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl bg-neutral-50 p-3">
                <div className="flex flex-col justify-between">
                  <dt className="text-[11px] font-bold text-muted">최근 주당 분배금</dt>
                  <dd className="mt-1 text-base sm:text-lg font-extrabold tabular-nums text-strong">
                    {latest ? formatAmount(latest.amountKrw) : "—"}
                  </dd>
                </div>
                <div className="flex flex-col justify-between">
                  <dt className="text-[11px] font-bold text-muted">
                    {latest ? scheduleDateLabel(latest) : "분배락일"}
                  </dt>
                  <dd className="mt-1 text-xs sm:text-sm font-extrabold tabular-nums text-strong">
                    {latest ? formatDate(scheduleDateValue(latest)) : "—"}
                  </dd>
                </div>
                <div className="flex flex-col justify-between">
                  <dt className="text-[11px] font-bold text-muted">실제 지급일</dt>
                  <dd className="mt-1 text-xs sm:text-sm font-extrabold tabular-nums text-strong">
                    {latest?.payDate ? formatDate(latest.payDate) : "확인 중"}
                  </dd>
                </div>
                <div className="flex flex-col justify-between">
                  <dt className="text-[11px] font-bold text-muted">최근 1년 누적 분배금</dt>
                  <dd className="mt-1 text-base sm:text-lg font-extrabold tabular-nums text-brand-700">
                    {ttmAmount != null ? formatAmount(ttmAmount) : "—"}
                  </dd>
                </div>
              </dl>

              {/* 최근 지급 내역 테이블 */}
              <div>
                <p className="mb-2 text-[12px] font-extrabold text-strong">최근 지급 내역</p>
                <ul aria-label="최근 분배금 지급 내역" className="rounded-xl border border-line bg-surface px-3 py-3">
                  {recentEvents.map((event) => (
                    <EventRow
                      key={event.eventId ?? `${scheduleDateValue(event)}-${event.amountKrw}`}
                      event={event}
                    />
                  ))}
                </ul>
              </div>

              {/* 과거 전체 지급 이력 아코디언 */}
              {records.length > recentEvents.length && (
                <details className="group/all">
                  <summary className="cursor-pointer list-none text-right text-[12px] font-bold text-brand-700 hover:text-brand-800">
                    <span className="group-open/all:hidden">전체 {records.length}건 보기</span>
                    <span className="hidden group-open/all:inline">접기</span>
                  </summary>
                  <ul
                    aria-label="전체 분배금 지급 내역"
                    className="mt-3 rounded-xl border border-line bg-surface px-3 py-3"
                  >
                    {records.slice(recentEvents.length).map((event) => (
                      <EventRow
                        key={event.eventId ?? `${scheduleDateValue(event)}-${event.amountKrw}`}
                        event={event}
                      />
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}

          {/* 컴플라이언스 및 법정 고지 푸터 */}
          <p className="text-[10px] font-medium leading-relaxed text-muted border-t border-line/60 pt-2.5">
            ※ 한국예탁결제원(SEIBro) 및 한국거래소(KRX) 공식 공시 기준 세전 분배금입니다. 과거 분배금 지급 내역이 미래 수익이나 지속적인 분배금 지급을 보장하지 않습니다.
          </p>
        </div>
      </details>
    </section>
  );
}
