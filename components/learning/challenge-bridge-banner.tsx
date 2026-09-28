"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, BookOpen, ShieldCheck } from "lucide-react";

import { ChallengeWaitlistModal } from "./challenge-waitlist-modal";

interface ChallengeBridgeBannerProps {
  source?: string;
}

export function ChallengeBridgeBanner({
  source = "compare_bridge",
}: ChallengeBridgeBannerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <aside
        className="my-8 sm:my-12 overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-brand-200 bg-linear-to-br from-brand-50/90 via-surface to-brand-50/40 p-5 sm:p-7 shadow-xs"
        aria-label="ETF 비용과 계좌별 규칙 자가 점검 가이드 안내"
      >
        {/* 상단 뱃지 & 안내 라벨 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-brand-100/80 pb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2.5 py-1 text-xs font-extrabold text-white">
              <Sparkles className="h-3.5 w-3.5" />
              실전 교육 가이드 준비 중
            </span>
            <span className="text-xs font-bold text-brand-800">
              추천 없는 100% 자기주도 루틴
            </span>
          </div>
          <span className="text-[11px] font-semibold text-neutral-500">
            실무 기반 자가 점검 가이드
          </span>
        </div>

        {/* 메인 메시지: 담백하고 신뢰감 있는 교육 안내 */}
        <div className="mt-4">
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-[-0.03em] text-strong leading-snug">
            ETF 비용과 계좌별 규칙을 차근차근 확인해 보세요
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-3xl">
            ETF 투자 시 표기된 총보수 외에도 기타비용과 매매중개수수료가 발생하며, 연금(DC/IRP)과 절세 계좌(ISA)마다 편입 가능한 위험자산 한도가 다릅니다. 복잡한 수치와 규칙을 차분하게 파악하고 내 계좌 상황에 맞춰 스스로 점검하는 교육 가이드를 준비하고 있습니다.
          </p>
        </div>

        {/* 3대 핵심 점검 기둥 (3 Pillars: 실부담비용 이해, 계좌별 편입 규칙, 자가 점검 루틴) */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-brand-100/90 bg-white/80 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-brand-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px]">
                1
              </span>
              <span>실부담비용 항목 이해</span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
              단순 표기 보수뿐 아니라 기타비용과 매매중개수수료율을 공시 자료에서 확인하는 방법을 배웁니다.
            </p>
          </div>

          <div className="rounded-xl border border-brand-100/90 bg-white/80 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-brand-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px]">
                2
              </span>
              <span>계좌별 편입 규칙 점검</span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
              DC/IRP의 70% 위험자산 한도와 ISA 절세 규칙을 내 투자 목적에 맞춰 차분히 점검합니다.
            </p>
          </div>

          <div className="rounded-xl border border-brand-100/90 bg-white/80 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-brand-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px]">
                3
              </span>
              <span>단계별 자가 점검 루틴</span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
              외부 추천에 의존하지 않고 브라우저에서 스스로 작성해보는 단계별 점검표를 구축합니다.
            </p>
          </div>
        </div>

        {/* 하단 행동 유도 (CTA) 영역: 유료 패키지 판매 약속 제거, 사전 안내 명시 */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-brand-100/70">
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>실무 기반 자가 점검 교육 가이드 및 체크리스트 준비 중 <strong className="text-emerald-700 font-bold">(무료 출시 알림)</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/books"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors shadow-2xs cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-neutral-500" />
              <span>가이드 둘러보기</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-brand-800 px-4 sm:px-5 py-2 text-xs sm:text-sm font-extrabold text-white hover:bg-brand-900 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            >
              <span>출시 알림 신청하기</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>

        {/* 자본시장법 제101조 컴플라이언스 면책 문구 */}
        <p className="mt-4 text-[11px] text-neutral-400 text-center leading-relaxed">
          * 본 가이드와 점검 루틴은 투자 판단을 돕기 위한 교육·정보 제공용이며, 자본시장법 제101조에 따라 특정 종목의 매수·매도를 권유하지 않습니다.
        </p>
      </aside>

      {/* 출시 알림 대기자 등록 모달 */}
      <ChallengeWaitlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        source={source}
      />
    </>
  );
}
