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
        aria-label="30일 자기주도 연금 점검 가이드 브릿지"
      >
        {/* 상단 뱃지 & 헤드라인 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-brand-100/80 pb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2.5 py-1 text-xs font-extrabold text-white">
              <Sparkles className="h-3.5 w-3.5" />
              다음 단계 실전 가이드
            </span>
            <span className="text-xs font-bold text-brand-800">
              추천 없는 100% 자기주도 루틴
            </span>
          </div>
          <span className="text-[11px] font-semibold text-neutral-500">
            17년 자산운용 실무 노하우
          </span>
        </div>

        {/* 메인 메시지: Astra 전환 카피 */}
        <div className="mt-4">
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-[-0.03em] text-strong leading-snug">
            비교는 끝났습니다. 다음은 내 계좌를 스스로 점검할 차례입니다.
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-3xl">
            퇴직연금 378조 원의 87%가 원리금 보장(연 3.1%)에 방치되는 이유, 추천이 없어서가 아니라 <span className="font-semibold text-neutral-800">내 계좌 점검 순서를 모르기 때문</span>입니다. 이제 광고 수수료 뒤에 숨은 실부담비용과 계좌 규칙을 내 손으로 직접 확인하세요.
          </p>
        </div>

        {/* 3대 핵심 점검 기둥 (3 Pillars) */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-brand-100/90 bg-white/80 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-brand-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px]">
                1
              </span>
              <span>숨은 실부담비용 역산</span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
              광고 보수와 최대 38배 차이나는 기타비용·매매중개수수료율을 공시 원장에서 직접 읽어냅니다.
            </p>
          </div>

          <div className="rounded-xl border border-brand-100/90 bg-white/80 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-brand-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px]">
                2
              </span>
              <span>70% 위험자산 한도 점검</span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
              DC/IRP 계좌의 법적 편입 한도와 ISA 절세 규칙을 내 자산 비율에 맞춰 스스로 계산합니다.
            </p>
          </div>

          <div className="rounded-xl border border-brand-100/90 bg-white/80 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-brand-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px]">
                3
              </span>
              <span>30일 자기주도 체크리스트</span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
              서버 저장 없이 브라우저 로컬에서 안전하게 완성하는 연금 리밸런싱 실전 점검표를 구축합니다.
            </p>
          </div>
        </div>

        {/* 하단 행동 유도 (CTA) 영역 */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-brand-100/70">
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>전자책 3권 + 30일 챌린지 패키지 출시 전 <strong className="text-emerald-700 font-bold">50% 얼리버드 혜택</strong> 제공</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/books"
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors shadow-2xs"
            >
              <BookOpen className="h-3.5 w-3.5 text-neutral-500" />
              <span>가이드 둘러보기</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-brand-800 px-4 sm:px-5 py-2 text-xs sm:text-sm font-extrabold text-white hover:bg-brand-900 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            >
              <span>얼리버드 50% 혜택 알림 받기</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>

        {/* 자본시장법 제101조 컴플라이언스 면책 문구 */}
        <p className="mt-4 text-[11px] text-neutral-400 text-center leading-relaxed">
          * 본 가이드와 챌린지는 투자 판단을 돕기 위한 교육·정보 제공용이며, 자본시장법 제101조에 따라 특정 종목의 매수·매도를 권유하지 않습니다.
        </p>
      </aside>

      {/* 얼리버드 대기자 등록 모달 */}
      <ChallengeWaitlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        source={source}
      />
    </>
  );
}
