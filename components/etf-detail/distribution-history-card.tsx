import type { EtfDistributionEvent, EtfDistributionSummary } from "@/lib/domain/etf-types";

function formatDate(value: string | null): string {
  if (!value) return "확인 중";
  const compact = value.replace(/[^0-9]/g, "");
  if (compact.length === 8) return `${compact.slice(0, 4)}.${compact.slice(4, 6)}.${compact.slice(6, 8)}`;
  return value;
}

function formatAmount(value: number): string {
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
        <p className="text-[12px] font-bold text-strong">{scheduleDateLabel(event)} {formatDate(scheduleDateValue(event))}</p>
        <p className="mt-0.5 text-[11px] font-medium text-muted">
          지급일 {formatDate(event.payDate)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-extrabold tabular-nums text-strong">{formatAmount(event.amountKrw)}</p>
        <p className="mt-0.5 text-[10px] font-semibold text-sky-700">{event.displayLabel}</p>
      </div>
    </li>
  );
}

export function DistributionHistoryCard({ summary }: { summary: EtfDistributionSummary }) {
  const recentEvents = summary.records.slice(0, 3);

  return (
    <section aria-labelledby="distribution-history-title" className="border-t border-line pt-4">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
          <div>
            <h3 id="distribution-history-title" className="text-base font-extrabold text-strong">분배금 지급 이력</h3>
            <p className="mt-1 text-[11px] font-medium text-muted">주당 세전 분배금 · 실제 공지 기준</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">
              {summary.sourceLabel}
            </span>
            <svg className="mt-1 h-4 w-4 text-muted transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>
        </summary>

        <div className="pt-4">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-neutral-50 p-3">
        <div>
          <dt className="text-[11px] font-bold text-muted">최근 주당 분배금</dt>
          <dd className="mt-1 text-lg font-extrabold tabular-nums text-strong">{formatAmount(summary.latest.amountKrw)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold text-muted">{scheduleDateLabel(summary.latest)}</dt>
          <dd className="mt-1 text-sm font-extrabold tabular-nums text-strong">{formatDate(scheduleDateValue(summary.latest))}</dd>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-3 border-t border-neutral-200 pt-3">
          <dt className="text-[11px] font-bold text-muted">지급일</dt>
          <dd className="text-sm font-extrabold tabular-nums text-strong">{formatDate(summary.latest.payDate)}</dd>
        </div>
          </dl>

          <div className="mt-4">
            <p className="mb-2 text-[12px] font-extrabold text-strong">최근 지급 내역</p>
            <ul aria-label="최근 분배금 지급 내역" className="rounded-xl border border-line bg-surface px-3 py-3">
              {recentEvents.map((event) => <EventRow key={event.eventId ?? `${scheduleDateValue(event)}-${event.amountKrw}`} event={event} />)}
            </ul>
          </div>

          {summary.eventCount > recentEvents.length && (
            <details className="group mt-3">
          <summary className="cursor-pointer list-none text-right text-[12px] font-bold text-brand-700 hover:text-brand-800">
            <span className="group-open:hidden">전체 {summary.eventCount}건 보기</span>
            <span className="hidden group-open:inline">접기</span>
          </summary>
          <ul aria-label="전체 분배금 지급 내역" className="mt-3 rounded-xl border border-line bg-surface px-3 py-3">
            {summary.records.slice(recentEvents.length).map((event) => <EventRow key={event.eventId ?? `${scheduleDateValue(event)}-${event.amountKrw}`} event={event} />)}
          </ul>
            </details>
          )}

          <p className="mt-3 text-[10px] font-medium leading-relaxed text-muted">
        {summary.sourceStatus === "krx_official_partial"
          ? "한국거래소 KIND 공식 공시에서 확인된 분배금·분배락 일정입니다. 운용사 별도 공지와 TR 검증이 연결되기 전까지는 참고용 공식 원문으로 표시합니다."
          : summary.sourceStatus === "mixed_official_sources"
            ? "운용사 및 한국거래소 KIND 공식 공시에서 확인된 지급 일정입니다. 지급일·기준일은 공지 기준이며, 변경 공시는 다음 데이터 갱신 때 반영됩니다."
            : "운용사 공식 공지에서 확인된 지급 일정입니다. 지급일·기준일은 공지 기준이며, 변경 공시는 다음 데이터 갱신 때 반영됩니다."}
          </p>
        </div>
      </details>
    </section>
  );
}
