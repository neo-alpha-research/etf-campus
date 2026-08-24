import { FundFlowRow } from "@/lib/hooks/use-market-briefing";

function money(value: number) {
  const decimal = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 1_000_000_000_000) return `${decimal.format(value / 1_000_000_000_000)}조 원`;
  if (Math.abs(value) >= 100_000_000) return `${decimal.format(value / 100_000_000)}억 원`;
  if (Math.abs(value) >= 10_000) return `${decimal.format(value / 10_000)}만 원`;
  return `${decimal.format(value)}원`;
}

export function FundFlowRanking({ fundFlow }: { fundFlow: { topInflows: FundFlowRow[]; topOutflows: FundFlowRow[] } }) {
  if (!fundFlow || (!fundFlow.topInflows?.length && !fundFlow.topOutflows?.length)) return null;

  return (
    <section aria-labelledby="fund-flow-title">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">FUND FLOW</p>
          <h2 id="fund-flow-title" className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">오늘 가장 돈이 많이 몰린 ETF</h2>
        </div>
        <p className="text-xs text-neutral-500">실질 자금 순유입/순유출 (발행 좌수 증감 기반)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-[22px] border border-[#D7EABB] bg-white shadow-[0_8px_24px_rgba(27,38,26,0.05)]">
          <h3 className="border-b border-[#EDF2DE] bg-[#F9FBFC] px-4 py-3 text-sm font-bold text-neutral-800 sm:px-6">TOP 5 순유입</h3>
          <ul className="divide-y divide-[#EDF2DE]">
            {fundFlow.topInflows.map((row, idx) => (
              <li key={row.ticker} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-neutral-50/50">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E5F5D5] text-[11px] font-bold text-[#4B7C2A]">{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-900">{row.etfName}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-neutral-500">{row.ticker}</p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-extrabold tabular-nums text-[#62913A]">+{money(row.netInflowValue)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-[22px] border border-[#D7EABB] bg-white shadow-[0_8px_24px_rgba(27,38,26,0.05)]">
          <h3 className="border-b border-[#EDF2DE] bg-[#F9FBFC] px-4 py-3 text-sm font-bold text-neutral-800 sm:px-6">TOP 5 순유출</h3>
          <ul className="divide-y divide-[#EDF2DE]">
            {fundFlow.topOutflows.map((row, idx) => (
              <li key={row.ticker} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-neutral-50/50">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E9F3F6] text-[11px] font-bold text-[#2C7B90]">{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-900">{row.etfName}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-neutral-500">{row.ticker}</p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-extrabold tabular-nums text-[#358BA3]">{money(row.netInflowValue)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
