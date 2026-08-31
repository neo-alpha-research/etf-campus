import React from "react";
import type { Etf } from "../../lib/domain/etf-types";
import { getFeeDisplayContext } from "../../lib/domain/etf-fee-utils";

type Props = {
  etf: any;
  className?: string;
};

export function FeeDoubleStack({ etf, className = "" }: Props) {
  const ctx = getFeeDisplayContext(etf);

  if (ctx.type === "unknown") {
    return <div className={`text-right ${className}`}>-</div>;
  }

  if (ctx.type === "masked_new") {
    return (
      <div className={`text-right flex flex-col items-end justify-center ${className}`}>
        <div className="relative group flex items-center gap-1 cursor-help">
          <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-1 py-0.5 rounded tracking-tighter">신규상장</span>
          
          <div className="absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2 w-56 p-2 rounded-lg bg-neutral-900/95 backdrop-blur-md text-white text-left shadow-xl border border-neutral-700/80 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100]">
            <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 border-[6px] border-transparent border-l-neutral-900/95" />
            <p className="text-[11px] leading-snug">
              상장 1년 미만의 신규 ETF는 초기 설정 비용이 연환산되어 실부담 비용이 과다 계상될 수 있으므로 표기를 생략합니다.
            </p>
          </div>
        </div>
        <span className="text-[11px] text-muted tabular-nums mt-0.5">명목 {ctx.nominalFee?.toFixed(3)}%</span>
      </div>
    );
  }

  if (ctx.type === "synthetic") {
    return (
      <div className={`text-right flex flex-col items-end justify-center ${className}`}>
        <div className="flex items-center gap-1">
          {ctx.hasHiddenCostWarning && (
            <div className="relative group cursor-help flex items-center">
              <span className="text-[11px]" aria-label="숨은 비용 주의">⚠️</span>
              <div className="absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2 w-56 p-2 rounded-lg bg-neutral-900/95 backdrop-blur-md text-white text-left shadow-xl border border-neutral-700/80 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100]">
                <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 border-[6px] border-transparent border-l-neutral-900/95" />
                <p className="text-[11px] leading-snug">
                  명목 보수에 비해 기타비용과 매매중개수수료가 높게 발생하여 주의가 필요한 종목입니다.
                </p>
              </div>
            </div>
          )}
          <span className="text-[12px] font-bold text-strong tabular-nums">{ctx.syntheticFee?.toFixed(2)}%</span>
        </div>
        <span className="text-[10px] text-muted tabular-nums mt-0.5">명목 {ctx.nominalFee?.toFixed(3)}%</span>
      </div>
    );
  }

  // nominal_only
  return (
    <div className={`text-right flex flex-col items-end justify-center ${className}`}>
      <span className="text-[12px] font-bold text-strong tabular-nums">{ctx.nominalFee?.toFixed(2)}%</span>
    </div>
  );
}
