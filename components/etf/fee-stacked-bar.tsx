import React from "react";
import type { Etf } from "../../lib/domain/etf-types";
import { getFeeDisplayContext, getSyntheticFee } from "../../lib/domain/etf-fee-utils";

type Props = {
  etf: Etf;
  isLowest?: boolean;
  maxFee?: number; // for scaling the bar
};

export function FeeStackedBar({ etf, isLowest, maxFee = 1.0 }: Props) {
  const ctx = getFeeDisplayContext(etf);
  
  if (ctx.type === "unknown") {
    return <div className="text-center text-muted font-semibold">-</div>;
  }

  if (ctx.type === "masked_new") {
    return (
      <div className="relative group flex flex-col items-center justify-center cursor-help">
        <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-1 py-0.5 rounded tracking-tighter mb-1">신규상장</span>
        <span className="text-[11.5px] font-bold text-muted tabular-nums font-mono">{ctx.nominalFee?.toFixed(3)}%</span>
        
        <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-64 p-3 rounded-lg bg-neutral-900/95 backdrop-blur-md text-white text-left shadow-xl border border-neutral-700/80 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100]">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 border-[6px] border-transparent border-b-neutral-900/95" />
          <p className="text-[11px] leading-snug">
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

  // scaling logic
  const scale = Math.max(0.1, maxFee);
  const nominalPct = Math.min(100, (nominalFee / scale) * 100);
  const otherPct = Math.min(100, (Math.max(0, otherCost) / scale) * 100);
  const tradingPct = Math.min(100, (Math.max(0, tradingCost) / scale) * 100);

  // 1000만원 10년 투자 시뮬레이션 (단순 합산 기준, 복리 효과 무시 약식)
  const simulatedCost10y = Math.round(10000000 * (syntheticFee / 100) * 10);
  
  return (
    <div className="relative group flex flex-col items-center w-full px-1 cursor-help">
      <div className="flex items-center gap-1 mb-1">
        {ctx.isStale && (
          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full whitespace-nowrap" title={ctx.staleMessage}>과거 데이터</span>
        )}
        {isLowest && (
          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">★ 최저 비용</span>
        )}
      </div>
      
      <div className={`text-[12px] font-bold tabular-nums font-mono mb-1 ${isLowest ? "text-emerald-600" : "text-strong"}`}>
        {syntheticFee.toFixed(3)}%
      </div>
      
      {/* Stacked Bar */}
      <div className="w-full h-1.5 flex rounded overflow-hidden bg-neutral-100 border border-neutral-200">
        {nominalPct > 0 && <div className="bg-brand-500 h-full" style={{ width: `${nominalPct}%` }} />}
        {otherPct > 0 && <div className="bg-sky-400 h-full" style={{ width: `${otherPct}%` }} />}
        {tradingPct > 0 && <div className="bg-orange-400 h-full" style={{ width: `${tradingPct}%` }} />}
      </div>
      
      <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-64 p-3 rounded-lg bg-neutral-900/95 backdrop-blur-md text-white text-left shadow-xl border border-neutral-700/80 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100]">
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 border-[6px] border-transparent border-b-neutral-900/95" />
        <div className="font-bold text-sm mb-2 border-b border-neutral-700 pb-1">실부담 비용 상세</div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-brand-300 flex items-center gap-1"><span className="w-2 h-2 rounded bg-brand-500 inline-block" /> 명목보수</span>
          <span className="font-mono tabular-nums">{nominalFee.toFixed(3)}%</span>
        </div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-sky-300 flex items-center gap-1"><span className="w-2 h-2 rounded bg-sky-400 inline-block" /> 기타비용</span>
          <span className="font-mono tabular-nums">{Math.max(0, otherCost).toFixed(3)}%</span>
        </div>
        <div className="flex justify-between text-xs mb-2 border-b border-neutral-700 pb-2">
          <span className="text-orange-300 flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-400 inline-block" /> 매매중개수수료</span>
          <span className="font-mono tabular-nums">{Math.max(0, tradingCost).toFixed(3)}%</span>
        </div>
        <div className="flex justify-between text-xs font-bold text-emerald-300 mb-3">
          <span>합성 총보수(실질)</span>
          <span className="font-mono tabular-nums text-sm">{syntheticFee.toFixed(3)}%</span>
        </div>
        
        <div className="bg-neutral-800 p-2 rounded text-[11px] leading-tight text-neutral-300">
          <span className="text-white font-bold block mb-1">💡 1천만 원 10년 투자 시 예상 비용</span>
          단순 계산 시 약 <strong className="text-amber-400">{simulatedCost10y.toLocaleString()}원</strong>이 비용으로 차감됩니다. (명목수익률 0% 가정)
        </div>
      </div>
    </div>
  );
}
