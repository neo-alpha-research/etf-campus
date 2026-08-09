"use client";

import React, { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type Etf, type ReturnPeriod, RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import { ReturnCell } from "@/components/etf/return-cell";
import { formatMoney } from "@/lib/domain/etf-format";

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CopyTicker = ({ ticker }: { ticker: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(ticker);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [ticker]);

  return (
    <button 
      onClick={handleCopy} 
      className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-brand-700 active:scale-95 transition-transform" 
      aria-label={`${ticker} 복사`} 
      type="button"
    >
      <span>{ticker}</span>
      <span className={copied ? "text-emerald-600" : ""}>
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ) : (
          <CopyIcon />
        )}
      </span>
    </button>
  );
};

const TableRow = React.memo(({ etf, selectedPeriod }: { etf: Etf, selectedPeriod: ReturnPeriod }) => {
  const isHedge = etf.classification?.fxHedge?.includes("헤지") || etf.classification?.fxHedge === "환헤지 적용";
  const isPension = etf.pension === "가능";
  
  return (
    <div className="grid h-[72px] grid-cols-[minmax(180px,2.5fr)_minmax(80px,1fr)_minmax(90px,1.2fr)_minmax(70px,1fr)_minmax(90px,1.2fr)_minmax(90px,1.2fr)_minmax(100px,1.2fr)_minmax(80px,1fr)] items-center gap-3 border-b border-line px-4 text-[13px] transition-colors hover:bg-brand-50/50">
      {/* 1. 종목명(종목코드) */}
      <div className="flex flex-col gap-1 overflow-hidden pr-2">
        <Link href={`/etf/${etf.ticker}`} prefetch={false} className="truncate font-bold text-strong hover:text-brand-700 hover:underline">
          {etf.name}
        </Link>
        <div>
          <CopyTicker ticker={etf.ticker} />
        </div>
      </div>

      {/* 2. 종가 */}
      <div className="text-right font-semibold tabular-nums text-strong">
        {etf.close.toLocaleString("ko-KR")}원
      </div>

      {/* 3. 선택 기간 수익률 */}
      <div className="text-right">
        <ReturnCell value={etf.returns[selectedPeriod]} />
      </div>

      {/* 4. 총보수(TER) */}
      <div className="text-right tabular-nums text-muted font-medium">
        {(etf.ter * 100).toFixed(2)}%
      </div>

      {/* 5. 순자산 */}
      <div className="text-right tabular-nums font-medium text-strong">
        {formatMoney(etf.aum)}
      </div>

      {/* 6. 거래대금 */}
      <div className="text-right tabular-nums font-medium text-strong">
        {formatMoney(etf.tradeValue)}
      </div>

      {/* 7. 지역/자산 카테고리 병합 */}
      <div className="text-center">
        <span className="inline-block truncate max-w-full rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-600">
          {etf.assetClass}
        </span>
      </div>

      {/* 8. 특이사항(태그) */}
      <div className="flex flex-wrap justify-center gap-1">
        {isHedge && <span className="rounded bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">환헤지</span>}
        {isPension && <span className="rounded bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">연금</span>}
        {!isHedge && !isPension && <span className="text-muted text-[10px]">-</span>}
      </div>
    </div>
  );
});
TableRow.displayName = "TableRow";

export function EtfTable({ etfs, selectedPeriod }: { etfs: Etf[]; selectedPeriod: ReturnPeriod }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: etfs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, 
    overscan: 10,
  });

  if (etfs.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface">
        <p className="text-sm font-semibold text-muted">검색 결과가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div 
        ref={parentRef} 
        className="max-h-[600px] overflow-auto" 
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="min-w-[860px]">
          {/* Header (Sticky) */}
          <div className="sticky top-0 z-10 grid grid-cols-[minmax(180px,2.5fr)_minmax(80px,1fr)_minmax(90px,1.2fr)_minmax(70px,1fr)_minmax(90px,1.2fr)_minmax(90px,1.2fr)_minmax(100px,1.2fr)_minmax(80px,1fr)] items-center gap-3 border-b-2 border-neutral-200 bg-neutral-100 px-4 py-3 text-[12px] font-extrabold text-neutral-600">
            <div>종목명(코드)</div>
            <div className="text-right">현재가</div>
            <div className="text-right">{RETURN_PERIOD_LABELS[selectedPeriod]} 수익률</div>
            <div className="text-right">총보수</div>
            <div className="text-right">순자산</div>
            <div className="text-right">거래대금</div>
            <div className="text-center">분류</div>
            <div className="text-center">특이사항</div>
          </div>
          
          {/* Body (Virtualized) */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <TableRow etf={etfs[virtualRow.index]} selectedPeriod={selectedPeriod} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
