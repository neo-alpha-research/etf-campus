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
            {ctx.nominalFee?.toFixed(3)}%
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
  const otherCost = (etf.fee?.terPct ?? nominalFee) - nominalFee;
  const tradingCost = etf.fee?.tradingCostPct ?? 0;
  const syntheticFee = ctx.syntheticFee ?? nominalFee;

  const isZeroOtherCosts = otherCost <= 0.0001 && tradingCost <= 0.0001;

  // 1000만원 10년 투자 시뮬레이션 (단순 합산 기준, 복리 효과 무시 약식)
  const simulatedCost10y = Math.round(10000000 * (syntheticFee / 100) * 10);
  
  return (
    <div className="relative group flex items-center justify-center w-full px-1 cursor-help">
      {/* Inline row: number + [최저] badge in a single compact line */}
      <div className="flex items-center justify-center gap-1.5 py-0.5">
        <span className={`text-[12.5px] font-bold tabular-nums font-mono ${isLowest ? "text-emerald-600 font-extrabold" : "text-strong"}`}>
          {syntheticFee.toFixed(3)}%
        </span>
        {isLowest && (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300/80 px-1.5 py-0.5 rounded leading-none shrink-0 shadow-xs">
            최저
          </span>
        )}
        {ctx.isStale && (
          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded leading-none shrink-0" title={ctx.staleMessage}>
            과거
          </span>
        )}
      </div>
      
      {/* Rich Breakdown Tooltip on hover */}
      <div className={`absolute top-[calc(100%+6px)] ${positionClass} w-72 sm:w-80 p-4 rounded-xl bg-neutral-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-neutral-700/90 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100]`}>
        <div className={`absolute -top-1.5 ${arrowClass} border-[6px] border-transparent border-b-neutral-900/98`} />
        
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-neutral-700/80">
          <span className="font-extrabold text-[13px] text-white">실부담 비용 상세 내역</span>
          <span className="text-[10px] text-neutral-400 font-mono bg-neutral-800 px-1.5 py-0.5 rounded">연환산 기준</span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center text-neutral-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-brand-500 shrink-0" />
              <span>명목보수 (운용/판매)</span>
            </span>
            <span className="font-mono font-bold tabular-nums text-white">{nominalFee.toFixed(3)}%</span>
          </div>

          <div className="flex justify-between items-center text-neutral-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 shrink-0" />
              <span>기타비용 (예탁/사무 등)</span>
            </span>
            <span className="font-mono font-bold tabular-nums text-white">{Math.max(0, otherCost).toFixed(3)}%</span>
          </div>

          <div className="flex justify-between items-center text-neutral-200 pb-2.5 border-b border-neutral-700/80">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-400 shrink-0" />
              <span>매매·중개수수료율</span>
            </span>
            <span className="font-mono font-bold tabular-nums text-white">{Math.max(0, tradingCost).toFixed(3)}%</span>
          </div>

          <div className="flex justify-between items-center pt-0.5">
            <span className="font-extrabold text-[13px] text-emerald-400">합성 총보수 (실부담비용)</span>
            <span className="font-mono font-black tabular-nums text-[15px] text-emerald-400">{syntheticFee.toFixed(3)}%</span>
          </div>
        </div>

        {isZeroOtherCosts && (
          <p className="mt-2.5 text-[10.5px] text-neutral-400 leading-snug bg-neutral-800/80 p-2 rounded-lg border border-neutral-700/50">
            ℹ️ 금리·파킹·파생형 등 직접 주식 매매가 발생하지 않는 상품은 기타비용과 매매수수료가 0%로 공시되어 명목보수와 실부담비용이 동일합니다.
          </p>
        )}
        
        <div className="mt-3 bg-neutral-800/95 p-2.5 rounded-lg text-[11px] leading-relaxed text-neutral-300 border border-neutral-700/60">
          <div className="text-white font-bold mb-0.5 flex items-center gap-1">
            <span>💡 1천만 원 10년 투자 시 누적 예상 비용</span>
          </div>
          단순 합산 시 약 <strong className="text-amber-400 font-mono font-bold">{simulatedCost10y.toLocaleString()}원</strong>이 차감됩니다.
        </div>
      </div>
    </div>
  );
}
