"use client";

import React, { useState, useRef, useEffect } from "react";
import { getFeeDisplayContext, type FeeInputEtf } from "../../lib/domain/etf-fee-utils";

type Props = {
  etf: FeeInputEtf;
  className?: string;
};

export function FeeDoubleStack({ etf, className = "" }: Props) {
  const ctx = getFeeDisplayContext(etf);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  if (ctx.type === "unknown") {
    return <div className={`text-right ${className}`}>-</div>;
  }

  if (ctx.type === "masked_new") {
    return (
      <div className={`text-right flex items-center justify-end ${className}`}>
        <div
          ref={containerRef}
          className="relative inline-flex items-center group/fee"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }}
            className="inline-flex items-center gap-0.5 text-[11.5px] text-muted hover:text-neutral-800 transition-colors cursor-pointer tabular-nums py-0.5"
            aria-label="결산 전 명목보수 안내 툴팁 보기"
            aria-expanded={isOpen}
          >
            {/* 모바일 2단 마이크로 스택 (< sm: 36px 이내로 압축) */}
            <div className="flex flex-col items-end sm:hidden leading-tight" aria-hidden="true">
              <span className="text-[8px] font-bold text-amber-700 tracking-tight">명목</span>
              <span className="text-[10px] font-semibold tabular-nums text-slate-700 flex items-center gap-0.5">
                {ctx.nominalFee !== null && ctx.nominalFee !== undefined ? `${ctx.nominalFee.toFixed(2)}%` : "-"}
                <span className="text-[8.5px] text-neutral-400">ⓘ</span>
              </span>
            </div>

            {/* 데스크톱 가로 1줄 (>= sm) */}
            <span className="hidden sm:inline underline decoration-dotted decoration-neutral-300 group-hover/fee:decoration-neutral-500 underline-offset-2">
              명목 {ctx.nominalFee !== null && ctx.nominalFee !== undefined ? `${ctx.nominalFee.toFixed(2)}%` : "-"}
            </span>
            <span className="hidden sm:inline text-[10px] text-neutral-400 group-hover/fee:text-amber-600 transition-colors" aria-hidden="true">ⓘ</span>
          </button>

          {/* 데스크톱 호버/클릭 팝오버 툴팁 (>= sm) */}
          <div
            className={`hidden sm:block absolute top-[calc(100%+8px)] right-0 w-72 max-w-[calc(100vw-32px)] p-3.5 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 transition-all duration-200 z-[140] whitespace-normal break-keep ${
              isOpen ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1 group-hover/fee:opacity-100 group-hover/fee:pointer-events-auto group-hover/fee:translate-y-0"
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

          {/* 모바일 바텀시트 모달 (< sm: 터치 친화적 & 제로 이탈) */}
          {isOpen && (
            <div
              className="fixed inset-0 z-[200] flex items-end sm:hidden bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full bg-slate-900 text-white rounded-t-2xl p-5 border-t border-slate-700 shadow-2xl text-left whitespace-normal break-keep max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold text-sm">
                    <span aria-hidden="true">💡</span>
                    <span>결산 전 ETF 명목보수 안내</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-md bg-slate-800"
                  >
                    닫기
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-slate-200 mb-3">
                  상장 1년 미만으로 첫 회계연도 결산 전인 ETF는 초기 자산 편입 과정의 일회성 비용 왜곡 방지를 위해 기타비용 및 매매수수료가 미산정된 상태입니다.
                </p>
                <div className="p-3 bg-slate-800/90 rounded-lg text-xs text-slate-300 leading-relaxed border border-slate-700/50">
                  <span className="text-amber-400 font-semibold">공시 기준: </span>
                  투자자 왜곡 방지를 위해 금융투자협회 공시 원칙에 따라 회계 결산 전까지 <strong className="text-white">기본 운용보수(명목 보수)</strong>로 안내합니다.
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full mt-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  확인
                </button>
              </div>
            </div>
          )}
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
              className="relative inline-flex items-center group/fee"
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

              {/* 데스크톱 호버/클릭 팝오버 툴팁 (>= sm) */}
              <div
                className={`hidden sm:block absolute top-[calc(100%+8px)] right-0 w-72 max-w-[calc(100vw-32px)] p-3.5 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 transition-all duration-200 z-[140] whitespace-normal break-keep ${
                  isOpen ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1 group-hover/fee:opacity-100 group-hover/fee:pointer-events-auto group-hover/fee:translate-y-0"
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

              {/* 모바일 바텀시트 모달 (< sm) */}
              {isOpen && (
                <div
                  className="fixed inset-0 z-[200] flex items-end sm:hidden bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  role="dialog"
                  aria-modal="true"
                >
                  <div
                    className="w-full bg-slate-900 text-white rounded-t-2xl p-5 border-t border-slate-700 shadow-2xl text-left whitespace-normal break-keep max-h-[85vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-3" />
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold text-sm">
                        <span aria-hidden="true">⚠️</span>
                        <span>숨은 비용(기타비용·매매수수료) 주의</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-md bg-slate-800"
                      >
                        닫기
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-200 mb-3">
                      명목 운용보수에 비해 기타비용과 매매중개수수료 비중이 높아 실부담 총비용이 크게 발생하는 종목입니다. 투자 시 실부담비용을 반드시 확인하세요.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="w-full mt-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      확인
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <span className="text-[11.5px] sm:text-[12px] font-bold text-strong tabular-nums">{ctx.syntheticFee?.toFixed(2)}%</span>
        </div>
        <span className="text-[9.5px] sm:text-[10px] text-muted tabular-nums mt-0.5">
          명목 {ctx.nominalFee?.toFixed(2)}%
        </span>
      </div>
    );
  }

  // nominal_only
  return (
    <div className={`text-right flex flex-col items-end justify-center ${className}`}>
      <span className="text-[11.5px] sm:text-[12px] font-bold text-strong tabular-nums">{ctx.nominalFee?.toFixed(2)}%</span>
    </div>
  );
}
