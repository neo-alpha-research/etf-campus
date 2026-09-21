"use client";

import { useState } from "react";
import { type Etf } from "@/lib/domain/etf-types";
import { ReturnCell } from "@/components/etf";
import { RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import { GENERAL_RETURN_PERIODS, NEW_RETURN_PERIODS, isNewListing } from "@/lib/domain/etf-explorer";

const EN_PERIOD_LABELS: Record<string, string> = {
  "1d": "1D", "1w": "1W", "2w": "2W", "1m": "1M", "2m": "2M", "3m": "3M",
  "6m": "6M", "ytd": "YTD", "12m": "1Y", "24m": "2Y", "36m": "3Y", "itd": "ITD"
};

export function ReturnPeriodGrid({ etf }: { etf: Etf }) {
  const [isTrMode, setIsTrMode] = useState(false);
  const trReturns = etf.returnsTr || etf.returnsNetTr;
  const activeReturns = isTrMode && trReturns ? trReturns : etf.returns;
  const isNew = isNewListing(etf);
  const periods = (isNew && etf.returns.itd !== null) ? NEW_RETURN_PERIODS : GENERAL_RETURN_PERIODS;
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[13px] font-extrabold text-strong flex items-center gap-1.5">
          기간별 수익률
        </h3>
        {trReturns && (
          <button 
            type="button"
            role="switch"
            aria-checked={isTrMode}
            onClick={() => setIsTrMode(!isTrMode)}
            className="flex items-center gap-2 cursor-pointer group bg-transparent border-none p-0 outline-none select-none"
          >
            <span className={`text-[12px] font-bold transition-colors ${isTrMode ? 'text-brand-700' : 'text-neutral-500 group-hover:text-neutral-700'}`}>
              TR (배당 재투자)
            </span>
            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isTrMode ? 'bg-brand-600' : 'bg-neutral-300'}`}>
              <span className={`inline-block size-4 transform rounded-full bg-white shadow-xs transition-transform ${isTrMode ? 'translate-x-4' : 'translate-x-1'}`} />
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
          style={{ gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))` }}
        >
          {periods.map((period) => (
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
      
      <div className="min-h-[22px] sm:min-h-[18px] px-1 flex items-center">
        <p className="text-[11px] text-neutral-500 leading-tight transition-opacity duration-150">
          {isTrMode ? (
            <span>
              💡 <strong className="text-neutral-700">TR (배당 재투자)</strong>: 분배금 100% 전액을 배당락일에 복리 재투자한 총수익률입니다 (ISA·연금저축 등 과세이연 계좌 기준).
            </span>
          ) : (
            <span className="text-neutral-400">
              💡 기본 표는 분배금을 제외한 가격 수익률(PR) 기준입니다. 상단 토글로 배당 재투자(TR) 수익률을 확인할 수 있습니다.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
