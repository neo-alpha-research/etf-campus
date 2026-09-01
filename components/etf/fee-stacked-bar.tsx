import React from "react";
import type { Etf } from "../../lib/domain/etf-types";
import { getFeeDisplayContext } from "../../lib/domain/etf-fee-utils";

type Props = {
  etf: Etf;
  isLowest?: boolean;
  maxFee?: number; // for scaling if needed
  align?: "left" | "center" | "right";
};

export function FeeStackedBar({ etf, isLowest, align = "center" }: Props) {
  const ctx = getFeeDisplayContext(etf);
  
  // Dynamic alignment classes to prevent edge cutoff
  const positionClass = 
    align === "right" 
      ? "right-0 translate-x-0" 
      : align === "left" 
      ? "left-0 translate-x-0" 
      : "left-1/2 -translate-x-1/2";

  const arrowClass = 
    align === "right" 
      ? "right-6" 
      : align === "left" 
      ? "left-6" 
      : "left-1/2 -translate-x-1/2";

  if (ctx.type === "unknown") {
    return <div className="text-center text-muted font-semibold">-</div>;
  }

  if (ctx.type === "masked_new") {
    return (
      <div className="relative group flex items-center justify-center w-full cursor-help">
        <div className="flex items-center justify-center gap-1 py-0.5">
          <span className="text-[12px] font-bold text-muted tabular-nums font-mono">
            {ctx.nominalFee?.toFixed(2)}%
          </span>
          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/80 px-1 py-0.5 rounded leading-none shrink-0">
            신규
          </span>
        </div>
        
        <div className={`absolute top-[calc(100%+6px)] ${positionClass} w-72 p-3.5 rounded-xl bg-neutral-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-neutral-700/90 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100]`}>
          <div className={`absolute -top-1.5 ${arrowClass} border-[6px] border-transparent border-b-neutral-900/98`} />
          <p className="text-[11.5px] leading-relaxed text-neutral-200">
            상장 1년 미만의 신규 ETF는 초기 설정 비용이 연환산되어 실부담 비용이 과다 계상될 수 있으므로 기본 운용보수만 표기합니다.
          </p>
        </div>
      </div>
    );
  }

  const nominalFee = etf.fee?.totalFeePct ?? 0;
  // Fix: 직접 otherCostPct를 읽고, 없으면 terPct에서 nominalFee를 뺌
  const otherCost = etf.fee?.otherCostPct ?? (etf.fee?.terPct != null ? Math.max(0, etf.fee.terPct - nominalFee) : 0);
  const tradingCost = etf.fee?.tradingCostPct ?? 0;
  const syntheticFee = ctx.syntheticFee ?? (nominalFee + otherCost + tradingCost);

  return (
    <div className="relative group flex items-center justify-center w-full px-1 cursor-help">
      {/* Inline row: number + [최저] badge in a single compact line */}
      <div className="flex items-center justify-center gap-1.5 py-0.5">
        <span className={`text-[12.5px] font-bold tabular-nums font-mono ${isLowest ? "text-emerald-600 font-extrabold" : "text-strong"}`}>
          {syntheticFee.toFixed(2)}%
        </span>
        {isLowest && (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300/80 px-1.5 py-0.5 rounded leading-none shrink-0 shadow-xs">
            최저
          </span>
        )}
      </div>
      
      {/* Clean 3-Tier Breakdown Tooltip on hover (Pops upwards into spacious return rows above) */}
      <div className={`absolute bottom-[calc(100%+6px)] ${positionClass} w-72 p-3.5 rounded-xl bg-neutral-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-neutral-700/90 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100]`}>
        <div className={`absolute -bottom-1.5 ${arrowClass} border-[6px] border-transparent border-t-neutral-900/98`} />
        
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-700/80">
          <span className="font-extrabold text-[13px] text-white">실부담 비용 상세 내역</span>
          <span className="text-[10px] text-neutral-400 font-mono bg-neutral-800 px-1.5 py-0.5 rounded">
            {etf.fee?.effectiveDate ? `${etf.fee.effectiveDate} 공시` : "연환산 기준"}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center text-neutral-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-brand-500 shrink-0" />
              <span>명목보수 (운용/판매)</span>
            </span>
            <span className="font-mono font-bold tabular-nums text-white">{nominalFee.toFixed(2)}%</span>
          </div>

          <div className="flex justify-between items-center text-neutral-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 shrink-0" />
              <span>기타비용 (예탁/사무 등)</span>
            </span>
            <span className="font-mono font-bold tabular-nums text-white">{otherCost.toFixed(2)}%</span>
          </div>

          <div className="flex justify-between items-center text-neutral-200 pb-2 border-b border-neutral-700/80">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-400 shrink-0" />
              <span>매매·중개수수료율</span>
            </span>
            <span className="font-mono font-bold tabular-nums text-white">{tradingCost.toFixed(2)}%</span>
          </div>

          <div className="flex justify-between items-center pt-0.5">
            <span className="font-extrabold text-[13px] text-emerald-400">합성 총보수 (실부담비용)</span>
            <span className="font-mono font-black tabular-nums text-[15px] text-emerald-400">{syntheticFee.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
