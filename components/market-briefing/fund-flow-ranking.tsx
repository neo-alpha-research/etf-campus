import { useState } from "react";
import { Info } from "lucide-react";
import { FundFlowRow } from "@/lib/hooks/use-market-briefing";

function InfoTooltip({ text }: { text: React.ReactNode }) {
  return (
    <div className="group relative inline-flex items-center justify-center ml-1">
      <Info className="h-4 w-4 text-neutral-400 cursor-help transition-colors group-hover:text-neutral-600" />
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl bg-neutral-900 p-3 text-xs leading-5 text-white opacity-0 shadow-xl transition-all group-hover:pointer-events-auto group-hover:opacity-100">
        {text}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
      </div>
    </div>
  );
}
function money(value: number) {
  const decimal = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 1_000_000_000_000) return `${decimal.format(value / 1_000_000_000_000)}조 원`;
  if (Math.abs(value) >= 100_000_000) return `${decimal.format(value / 100_000_000)}억 원`;
  if (Math.abs(value) >= 10_000) return `${decimal.format(value / 10_000)}만 원`;
  return `${decimal.format(value)}원`;
}

type FundFlowData = { topInflows: FundFlowRow[]; topOutflows: FundFlowRow[] };

export function FundFlowRanking({ fundFlow }: { fundFlow: { general: FundFlowData; all: FundFlowData } | FundFlowData }) {
  const [activeTab, setActiveTab] = useState<"general" | "all">("general");

  if (!fundFlow) return null;

  // Handle old format or new format gracefully
  const generalData = "general" in fundFlow ? fundFlow.general : fundFlow;
  const allData = "all" in fundFlow ? fundFlow.all : fundFlow;
  const currentData = activeTab === "general" ? generalData : allData;

  if (!currentData || (!currentData.topInflows?.length && !currentData.topOutflows?.length)) return null;

  return (
    <section aria-labelledby="fund-flow-title">
      <div className="mb-3 flex items-center gap-1">
        <h3 id="fund-flow-title" className="text-lg font-extrabold tracking-tight text-neutral-900">ETF 자금 순유입 순위</h3>
        <InfoTooltip text="주가 변동에 의한 착시를 배제하고, 실제 ETF 발행 좌수 증감을 기준으로 계산한 실질 자금 유입/유출액입니다." />
      </div>

      <div className="mb-4 flex space-x-2">
        <button
          onClick={() => setActiveTab("general")}
          className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
            activeTab === "general"
              ? "bg-[#5A7050] text-white shadow-sm"
              : "bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200"
          }`}
        >
          일반 테마 ETF
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
            activeTab === "all"
              ? "bg-[#5A7050] text-white shadow-sm"
              : "bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200"
          }`}
        >
          전체 ETF (레버리지·인버스·파킹 포함)
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-[22px] border border-[#D7EABB] bg-white shadow-[0_8px_24px_rgba(27,38,26,0.05)]">
          <h3 className="border-b border-[#EDF2DE] bg-[#F9FBFC] px-4 py-3 text-sm font-bold text-neutral-800 sm:px-6">TOP 5 순유입</h3>
          <ul className="divide-y divide-[#EDF2DE]">
            {currentData.topInflows.map((row, idx) => (
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
            {currentData.topOutflows.map((row, idx) => (
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
