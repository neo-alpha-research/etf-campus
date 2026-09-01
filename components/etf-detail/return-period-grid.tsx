'use client';

import { useState } from "react";
import { type Etf } from "@/lib/domain/etf-types";
import { ReturnCell } from "@/components/etf";
import { RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";

const EN_PERIOD_LABELS: Record<string, string> = {
  "1d": "1D", "1w": "1W", "2w": "2W", "1m": "1M", "2m": "2M", "3m": "3M",
  "6m": "6M", "ytd": "YTD", "12m": "1Y", "24m": "2Y", "36m": "3Y", "itd": "상장후"
};

const defaultPeriods = ["1m", "3m", "6m", "ytd", "12m", "36m"] as const;

export function ReturnPeriodGrid({ etf }: { etf: Etf }) {
  const [isTrMode, setIsTrMode] = useState(false);
  const activeReturns = isTrMode && etf.returnsTr ? etf.returnsTr : etf.returns;
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[13px] font-extrabold text-strong flex items-center gap-1.5">
          기간별 수익률
        </h3>
        {etf.returnsTr && (
          <button 
            type="button"
            onClick={() => setIsTrMode(!isTrMode)}
            className="flex items-center gap-2 cursor-pointer group bg-transparent border-none p-0 outline-none"
          >
            <span className={`text-[12px] font-bold transition-colors ${isTrMode ? 'text-brand-600' : 'text-neutral-400 group-hover:text-neutral-500'}`}>
              TR (배당 재투자)
            </span>
            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isTrMode ? 'bg-brand-600' : 'bg-neutral-300'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isTrMode ? 'translate-x-4.5' : 'translate-x-1'}`} style={{ transform: isTrMode ? 'translateX(18px)' : 'translateX(4px)' }} />
            </div>
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-line">
        <div
          role="table"
          aria-label={`${etf.name} 기본 기간별 ${isTrMode ? '총수익률(TR)' : '가격 수익률(PR)'}`}
          data-testid="return-period-table"
          className="grid gap-px transition-colors duration-300"
          style={{ gridTemplateColumns: `repeat(${defaultPeriods.length}, minmax(0, 1fr))` }}
        >
          {defaultPeriods.map((period) => (
            <div key={period} role="cell" className={`py-2.5 px-0.5 sm:px-1 flex flex-col items-center justify-center text-center transition-colors duration-300 ${isTrMode ? 'bg-brand-50/30' : 'bg-surface'}`}>
              <div className="text-[11px] font-bold text-muted mb-1" title={RETURN_PERIOD_LABELS[period]} aria-label={RETURN_PERIOD_LABELS[period]}>
                <span aria-hidden="true">{EN_PERIOD_LABELS[period] || period}</span>
              </div>
              <div className="text-[11px] sm:text-[12px] font-bold tabular-nums tracking-tighter">
                {activeReturns[period] === null ? (
                  <span aria-label="데이터 없음" className="text-muted font-medium">—</span>
                ) : (
                  <ReturnCell value={activeReturns[period]!} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {isTrMode && (
        <p className="text-[11px] text-neutral-400 px-1 leading-tight">
          💡 <strong>TR(총수익률)</strong>: 분배금(배당금)을 배당락일에 재투자했다고 가정한 총수익률입니다. 거래소 공식 TR 및 실제 계좌 수익률(세금 공제)과 오차가 있을 수 있습니다.
        </p>
      )}
    </div>
  );
}
