"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Etf } from "@/lib/domain/etf-types";
import { getFeeDisplayContext } from "@/lib/domain/etf-fee-utils";
import { formatFeePct } from "@/lib/domain/etf-format";

type Props = {
  etf: Etf;
};

export function FeeMetricItem({ etf }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fee = etf.fee;
  const feeCtx = getFeeDisplayContext(etf);
  const isFeeVerified = fee?.verificationStatus === "verified_official" || fee?.verificationStatus === "official_single_source";

  const feeSource = fee?.dartReceiptNo
    ? {
        label: "금감원 DART 투자설명서",
        url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${fee.dartReceiptNo}`,
      }
    : fee?.primarySourceUrl
      ? { label: "운용사 공식 자료", url: fee.primarySourceUrl }
      : fee?.secondarySourceUrl
        ? { label: "공시 보조 자료", url: fee.secondarySourceUrl }
        : null;

  const getFeeStatusText = (status: string | undefined) => {
    switch (status) {
      case "seed_unverified": return "검증 전 데이터";
      case "conflict": return "출처 간 정보 불일치";
      case "pending_review": return "공식 데이터 확인 중";
      case "stale": return "최신화 필요";
      default: return "공식 데이터 확인 중";
    }
  };

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Fee value for 10M won calculation
  const activeFeeRate = feeCtx.syntheticFee ?? feeCtx.nominalFee ?? (fee?.totalFeePct ?? 0);
  const annualDrag10M = Math.round((10_000_000 * activeFeeRate) / 100);

  return (
    <div
      ref={containerRef}
      className="flex flex-col justify-center relative group"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <dt className="text-sm font-bold text-gray-500 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500 rounded p-0.5"
          aria-expanded={isOpen}
          aria-label="실부담비용 상세 정보 열기"
        >
          <span>실부담비용</span>
          <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </dt>

      <dd className="mt-1 flex flex-wrap items-baseline gap-1.5">
        {isFeeVerified ? (
          feeCtx.type === "synthetic" && feeCtx.syntheticFee != null ? (
            <>
              <span className="text-lg sm:text-xl font-black text-strong font-mono tabular-nums tracking-tight">
                {feeCtx.syntheticFee.toFixed(2)}%
              </span>
              {feeCtx.nominalFee != null && (
                <span className="text-[11px] font-semibold text-neutral-600 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded tabular-nums font-mono">
                  총보수 {feeCtx.nominalFee.toFixed(2)}%
                </span>
              )}
              {feeCtx.hasHiddenCostWarning && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 leading-tight">
                  <span>⚠️</span>
                  <span>숨은비용 주의</span>
                </span>
              )}
            </>
          ) : feeCtx.type === "masked_new" ? (
            <>
              <span className="text-lg sm:text-xl font-black text-strong font-mono tabular-nums tracking-tight">
                {feeCtx.nominalFee?.toFixed(2)}%
              </span>
              <span className="text-[10.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded leading-tight">
                결산전 (총보수)
              </span>
            </>
          ) : (
            <>
              <span className="text-lg sm:text-xl font-black text-strong font-mono tabular-nums tracking-tight">
                {feeCtx.nominalFee != null ? `${feeCtx.nominalFee.toFixed(2)}%` : formatFeePct(fee?.totalFeePct)}
              </span>
              <span className="text-[10.5px] font-medium text-neutral-500 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded leading-tight">
                총보수 기준
              </span>
            </>
          )
        ) : (
          <span className="text-sm font-medium text-amber-600 font-sans">
            {getFeeStatusText(fee?.verificationStatus)}
          </span>
        )}
      </dd>

      {/* Tooltip / Popover */}
      {/* Anchored right-0 so it opens leftwards into center screen on desktop; width clamped on mobile */}
      <div
        className={`absolute right-0 top-full mt-2 w-[calc(100vw-40px)] max-w-[340px] z-30 transition-all duration-200 ${
          isOpen ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"
        }`}
        role="dialog"
        aria-label="실부담비용 상세 내역"
      >
        <div className="bg-neutral-900/98 backdrop-blur-md text-white text-xs rounded-2xl p-4 sm:p-4.5 shadow-2xl border border-neutral-700/90 font-medium leading-relaxed">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-neutral-700/80">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-[13.5px] text-brand-300">실부담 비용 상세 내역</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-neutral-400 font-mono bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700">
                {fee?.effectiveDate ? `${fee.effectiveDate} 공시` : "최신 공시 기준"}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="text-neutral-400 hover:text-white sm:hidden p-1 rounded -mr-1"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
          </div>

          {isFeeVerified ? (
            <>
              {/* 1,000만 원 투자 시 연간 차감액 시뮬레이터 */}
              <div className="bg-emerald-950/70 border border-emerald-700/60 rounded-xl p-2.5 mb-3 text-emerald-200">
                <div className="flex items-center justify-between text-[11.5px] font-bold mb-1">
                  <span className="flex items-center gap-1">
                    <span>💡</span>
                    <span>1,000만 원 투자 시 연간 차감</span>
                  </span>
                  <span className="text-emerald-300 font-mono font-extrabold text-[13px] tabular-nums">
                    약 {annualDrag10M.toLocaleString()}원
                  </span>
                </div>
                <p className="text-[10.5px] text-emerald-300/80 leading-tight">
                  별도 납부 없이 매일 순자산(NAV)에서 1/365씩 자동 차감됩니다.
                </p>
              </div>

              {/* 3-Tier Breakdown */}
              <div className="space-y-2 mb-3 bg-neutral-800/60 p-2.5 rounded-xl border border-neutral-700/50">
                <div className="flex justify-between items-center text-neutral-200 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-brand-400 shrink-0" />
                    <span>명목 총보수 (운용/판매/수탁)</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums text-white">
                    {fee?.totalFeePct != null ? `${fee.totalFeePct.toFixed(2)}%` : "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-neutral-200 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 shrink-0" />
                    <span>기타비용 (예탁원/지수사용료 등)</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums text-white">
                    {fee?.otherCostPct != null ? `${fee.otherCostPct.toFixed(2)}%` : (fee?.terPct != null && fee?.totalFeePct != null ? `${Math.max(0, fee.terPct - fee.totalFeePct).toFixed(2)}%` : "공시 전")}
                  </span>
                </div>

                <div className="flex justify-between items-center text-neutral-200 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 shrink-0" />
                    <span>매매수수료 (자산 교체 거래비용)</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums text-white">
                    {fee?.tradingCostPct != null ? `${fee.tradingCostPct.toFixed(2)}%` : "공시 전"}
                  </span>
                </div>
              </div>

              {/* Legal & Regulatory Explanation */}
              <div className="text-[11px] text-neutral-300 bg-neutral-800/40 rounded-lg p-2 leading-relaxed border border-neutral-700/40 mb-2">
                {feeCtx.type === "masked_new" ? (
                  "상장 1년 미만으로 첫 결산 전인 ETF는 초기 설정 비용 왜곡 방지를 위해 회계 결산 전까지 기본 운용보수만 표기합니다."
                ) : (
                  "총비용비율(TER: 총보수+기타비용)에 주식 매매중개수수료율을 모두 합산한 투자자 실질부담 총비용입니다."
                )}
              </div>

              <div className="text-[10px] text-neutral-400 leading-snug mb-2">
                ※ 개인 투자자가 증권사 앱에서 거래 시 발생하는 위탁매매수수료와는 별개입니다.
              </div>
            </>
          ) : (
            <div className="text-[11px] text-neutral-300 leading-relaxed mb-2">
              {getFeeStatusText(fee?.verificationStatus)}: 금융투자협회 및 운용사 공시 원장의 수수료 교차 검증이 진행 중입니다.
            </div>
          )}

          {feeSource && (
            <div className="border-t border-neutral-700/60 pt-2 text-[10.5px] text-neutral-400 flex items-center justify-between">
              <span>대표 출처:</span>
              <a
                className="underline decoration-neutral-500 underline-offset-2 hover:text-white pointer-events-auto"
                href={feeSource.url}
                rel="noreferrer"
                target="_blank"
              >
                {feeSource.label}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
