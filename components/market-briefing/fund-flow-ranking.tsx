import { useState } from "react";
import Link from "next/link";
import { Info, ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
import { FundFlowRow } from "@/lib/hooks/use-market-briefing";

function InfoTooltip({ text }: { text: React.ReactNode }) {
  return (
    <div className="group relative inline-flex items-center justify-center">
      <button
        type="button"
        aria-label="도움말 보기"
        className="text-neutral-400 cursor-help transition-colors group-hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B4C28] rounded-full p-0.5"
      >
        <Info className="h-4 w-4" />
      </button>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-xl bg-neutral-900/95 p-3 text-[12px] leading-relaxed text-white opacity-0 shadow-xl backdrop-blur-xs transition-all group-hover:pointer-events-auto group-hover:opacity-100">
        {text}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900/95" />
      </div>
    </div>
  );
}

function formatAmount(value: number) {
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000_000) {
    const jo = (absValue / 1_000_000_000_000).toFixed(1);
    return `${jo}조`;
  }
  const amountIn100M = Math.round(absValue / 100_000_000);
  return new Intl.NumberFormat("ko-KR").format(amountIn100M);
}

type FundFlowData = { topInflows: FundFlowRow[]; topOutflows: FundFlowRow[] };

export function FundFlowRanking({
  fundFlow,
}: {
  fundFlow: { general: FundFlowData; all: FundFlowData } | FundFlowData;
}) {
  const [activeTab, setActiveTab] = useState<"general" | "all">("general");

  if (!fundFlow) return null;
  const generalData = "general" in fundFlow ? fundFlow.general : fundFlow;
  const allData = "all" in fundFlow ? fundFlow.all : fundFlow;
  const currentData = activeTab === "general" ? generalData : allData;

  if (!currentData || (!currentData.topInflows?.length && !currentData.topOutflows?.length)) {
    return null;
  }

  const maxInflow = Math.max(...currentData.topInflows.map((r) => Math.abs(r.netInflowValue || 0)), 1);
  const maxOutflow = Math.max(...currentData.topOutflows.map((r) => Math.abs(r.netInflowValue || 0)), 1);

  return (
    <section aria-labelledby="fund-flow-title" className="space-y-4">
      {/* 1. 상단 컨트롤 바: 세그먼트 탭 & 안내 툴팁 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAF6] border border-[#E8ECE1] rounded-2xl p-2.5 sm:px-4">
        {/* Segmented Control Tab */}
        <div className="inline-flex bg-neutral-200/80 p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === "general"
                ? "bg-white text-[#2B4C28] shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            일반 테마 ETF
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === "all"
                ? "bg-white text-[#2B4C28] shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            전체 ETF <span className="text-[10.5px] font-normal opacity-80">(파킹·레버리지·인버스 포함)</span>
          </button>
        </div>

        {/* 메타 안내 */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-[12px] text-neutral-500 font-medium">
          <span className="inline-flex items-center gap-1">
            <span>실질 자금 순유입·순유출 기준</span>
            <InfoTooltip text="주가 등락에 따른 평가액 변동을 제외하고, 운용사-기관(LP) 간 1차 시장 펀드 설정·환매(발행좌수 증감: ΔShares × NAV)로 인해 실제 오고 간 순수 자금 규모입니다. (장내 단순 매매대금이 아님)" />
          </span>
          <span className="text-neutral-300">|</span>

          <span className="font-semibold text-neutral-600">단위: 억원</span>
        </div>
      </div>

      {/* 2. 좌/우 2단 카드 그리드 */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* [좌측] TOP 5 순유입 카드 */}
        <div className="overflow-hidden rounded-[22px] border border-[#DCE7D0] bg-white shadow-[0_4px_16px_rgba(27,38,26,0.03)] flex flex-col hover:border-[#B5DED1] transition-colors">
          <div className="flex items-center justify-between border-b border-[#EDF2DE] bg-gradient-to-r from-[#F4F9EE] to-white px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E3F2D3] text-[#3B6D22]">
                <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
              </span>
              <h4 className="text-[14px] font-black text-neutral-900 tracking-tight">자금 순유입 TOP 5</h4>
            </div>
            <span className="text-[11px] font-bold text-[#3B6D22] bg-[#EBF7DF] px-2.5 py-0.5 rounded-full border border-[#D4EBBF]">
              일간 순유입
            </span>
          </div>

          <div className="divide-y divide-neutral-100 flex-1 flex flex-col justify-between">
            {currentData.topInflows.slice(0, 5).map((row, idx) => {
              const widthPct = Math.min((Math.abs(row.netInflowValue) / maxInflow) * 100, 100);

              return (
                <Link
                  key={row.ticker}
                  href={`/etf/${row.ticker}`}
                  className="group relative flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-[#F9FBFC]"
                >
                  {/* Background Bar Gauge */}
                  <div
                    className="absolute inset-y-1 right-0 bg-[#F0F8E8] opacity-60 rounded-l-lg transition-all group-hover:opacity-90"
                    style={{ width: `${widthPct * 0.4}%` }}
                  />

                  {/* 종목 정보 */}
                  <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3 pr-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold tabular-nums bg-neutral-100 text-neutral-600 border border-neutral-200/70">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-neutral-900 group-hover:text-[#2B4C28] group-hover:underline">
                        {row.etfName}
                      </p>
                      <p className="text-[11px] font-semibold text-neutral-400 tabular-nums mt-0.5">
                        {row.ticker}
                      </p>
                    </div>
                  </div>

                  {/* 금액 수치 */}
                  <div className="relative z-10 flex shrink-0 items-center gap-1.5 pl-2 text-right">
                    <div className="flex items-baseline justify-end gap-0.5">
                      <span className="text-[15px] font-black tabular-nums tracking-tight text-[#2E6819]">
                        +{formatAmount(row.netInflowValue)}
                      </span>
                      <span className="text-[11px] font-bold text-neutral-500">억원</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-600" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* [우측] TOP 5 순유출 카드 */}
        <div className="overflow-hidden rounded-[22px] border border-[#D2DFE6] bg-white shadow-[0_4px_16px_rgba(27,38,26,0.03)] flex flex-col hover:border-[#ADC7D6] transition-colors">
          <div className="flex items-center justify-between border-b border-[#E1ECF0] bg-gradient-to-r from-[#F0F6F9] to-white px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#DEECF2] text-[#1E5F74]">
                <ArrowDownRight className="h-4 w-4 stroke-[2.5]" />
              </span>
              <h4 className="text-[14px] font-black text-neutral-900 tracking-tight">자금 순유출 TOP 5</h4>
            </div>
            <span className="text-[11px] font-bold text-[#1E5F74] bg-[#E5F1F5] px-2.5 py-0.5 rounded-full border border-[#CDE3EC]">
              일간 순유출
            </span>
          </div>

          <div className="divide-y divide-neutral-100 flex-1 flex flex-col justify-between">
            {currentData.topOutflows.slice(0, 5).map((row, idx) => {
              const widthPct = Math.min((Math.abs(row.netInflowValue) / maxOutflow) * 100, 100);

              return (
                <Link
                  key={row.ticker}
                  href={`/etf/${row.ticker}`}
                  className="group relative flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-[#F9FBFC]"
                >
                  {/* Background Bar Gauge */}
                  <div
                    className="absolute inset-y-1 right-0 bg-[#EAF2F6] opacity-60 rounded-l-lg transition-all group-hover:opacity-90"
                    style={{ width: `${widthPct * 0.4}%` }}
                  />

                  {/* 종목 정보 */}
                  <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3 pr-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold tabular-nums bg-neutral-100 text-neutral-600 border border-neutral-200/70">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-neutral-900 group-hover:text-[#1E5F74] group-hover:underline">
                        {row.etfName}
                      </p>
                      <p className="text-[11px] font-semibold text-neutral-400 tabular-nums mt-0.5">
                        {row.ticker}
                      </p>
                    </div>
                  </div>

                  {/* 금액 수치 */}
                  <div className="relative z-10 flex shrink-0 items-center gap-1.5 pl-2 text-right">
                    <div className="flex items-baseline justify-end gap-0.5">
                      <span className="text-[15px] font-black tabular-nums tracking-tight text-[#175CD3]">
                        -{formatAmount(row.netInflowValue)}
                      </span>
                      <span className="text-[11px] font-bold text-neutral-500">억원</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-600" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
