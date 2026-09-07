"use client";

import React, { useState, useRef, useEffect } from "react";
import { getFeeDisplayContext } from "../../lib/domain/etf-fee-utils";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  etf: any;
  className?: string;
};

export function FeeDoubleStack({ etf, className = "" }: Props) {
  const ctx = getFeeDisplayContext(etf);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (ctx.type === "unknown") {
    return <div className={`text-right ${className}`}>-</div>;
  }

  if (ctx.type === "masked_new") {
    return (
      <div className={`text-right flex items-center justify-end ${className}`}>
        <div
          ref={containerRef}
          className="relative inline-flex items-center"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }}
            className="inline-flex items-center gap-0.5 text-[11.5px] text-muted hover:text-neutral-800 transition-colors cursor-pointer tabular-nums py-0.5 group/fee"
            aria-label="결산 전 명목보수 안내 툴팁 보기"
            aria-expanded={isOpen}
          >
            <span className="underline decoration-dotted decoration-neutral-300 group-hover/fee:decoration-neutral-500 underline-offset-2">
              명목 {ctx.nominalFee?.toFixed(2)}%
            </span>
            <span className="text-[10px] text-neutral-400 group-hover/fee:text-amber-600 transition-colors" aria-hidden="true">ⓘ</span>
          </button>

          {/* 고해상도 가독성 개선 툴팁 (결산 전 ETF 명목보수 안내) */}
          <div
            className={`absolute top-[calc(100%+8px)] right-0 w-72 max-w-[calc(100vw-32px)] p-3.5 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 transition-all duration-200 z-[140] whitespace-normal break-keep ${
              isOpen ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1"
            }`}
            role="tooltip"
          >
            {/* 결함 없는 45도 회전 정밀 화살표 */}
            <div className="absolute -top-1.5 right-4 w-3 h-3 rotate-45 bg-slate-900 border-t border-l border-slate-700/90" />
            
            <div className="flex items-center gap-1.5 mb-1.5 text-amber-300 font-bold text-[12px]">
              <span aria-hidden="true">💡</span>
              <span>결산 전 ETF 명목보수 안내</span>
            </div>
            
            <p className="text-[11.5px] leading-relaxed text-neutral-200 mb-2">
              상장 1년 미만으로 첫 회계연도 결산 전인 ETF는 초기 자산 편입 과정의 일회성 비용 왜곡 방지를 위해 기타비용 및 매매수수료가 미산정된 상태입니다.
            </p>
            
            <div className="pt-2 border-t border-neutral-700/60 text-[11px] text-neutral-300 flex items-start gap-1">
              <span className="text-amber-400 font-semibold shrink-0">공시 기준:</span>
              <span>투자자 왜곡 방지를 위해 금융투자협회 공시 원칙에 따라 회계 결산 전까지 <strong>기본 운용보수(명목 보수)</strong>로 안내합니다.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (ctx.type === "synthetic") {
    return (
      <div className={`text-right flex flex-col items-end justify-center ${className}`}>
        <div className="flex items-center gap-1">
          {ctx.hasHiddenCostWarning && (
            <div
              ref={containerRef}
              className="relative inline-flex items-center"
              onMouseEnter={() => setIsOpen(true)}
              onMouseLeave={() => setIsOpen(false)}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen((prev) => !prev);
                }}
                className="inline-flex items-center text-[11px] hover:opacity-80 transition-opacity cursor-pointer"
                aria-label="숨은 비용 주의 안내 툴팁 보기"
                aria-expanded={isOpen}
              >
                <span aria-hidden="true">⚠️</span>
              </button>

              <div
                className={`absolute top-[calc(100%+8px)] right-0 w-72 max-w-[calc(100vw-32px)] p-3.5 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 transition-all duration-200 z-[140] whitespace-normal break-keep ${
                  isOpen ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1"
                }`}
                role="tooltip"
              >
                <div className="absolute -top-1.5 right-2 w-3 h-3 rotate-45 bg-slate-900 border-t border-l border-slate-700/90" />
                <div className="flex items-center gap-1.5 mb-1 text-amber-300 font-bold text-[12px]">
                  <span aria-hidden="true">⚠️</span>
                  <span>숨은 비용(기타비용·매매수수료) 주의</span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-neutral-200">
                  명목 운용보수에 비해 기타비용과 매매중개수수료 비중이 높아 실부담 총비용이 크게 발생하는 종목입니다. 투자 시 실부담비용을 반드시 확인하세요.
                </p>
              </div>
            </div>
          )}
          <span className="text-[12px] font-bold text-strong tabular-nums">{ctx.syntheticFee?.toFixed(2)}%</span>
        </div>
        <span className="text-[10px] text-muted tabular-nums mt-0.5">명목 {ctx.nominalFee?.toFixed(2)}%</span>
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
