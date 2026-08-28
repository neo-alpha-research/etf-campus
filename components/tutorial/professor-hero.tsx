"use client";

import Image from "next/image";

interface ProfessorHeroProps {
  activeTab: "tour" | "quiz";
  onTabChange: (tab: "tour" | "quiz") => void;
  quizProgress?: number; // 1 ~ 10
}

export function ProfessorHero({
  activeTab,
  onTabChange,
  quizProgress = 1,
}: ProfessorHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-brand-200/80 bg-gradient-to-br from-brand-50/70 via-surface to-brand-50/40 p-5 sm:p-8 shadow-sm">
      {/* Background decorative campus motif */}
      <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-brand-100/50 blur-2xl" />
      <div className="pointer-events-none absolute -left-8 -bottom-8 size-36 rounded-full bg-amber-100/40 blur-xl" />

      <div className="relative flex flex-col md:flex-row items-center md:items-start gap-5 sm:gap-6">
        {/* Professor Owl Avatar with Badge */}
        <div className="relative shrink-0 flex flex-col items-center">
          <div className="relative size-24 sm:size-28 rounded-2xl overflow-hidden border-3 border-brand-500/20 shadow-md ring-4 ring-brand-100/80 bg-surface">
            <Image
              src="/images/professor_owl.jpg"
              alt="ETF 캠퍼스 부엉이 교수님"
              width={160}
              height={160}
              className="size-full object-cover object-center transition-transform duration-300 hover:scale-105"
              priority
            />
          </div>
          <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-700 text-white shadow-2xs">
            <span>🎓</span> 부엉이 교수
          </span>
        </div>

        {/* Speech Bubble & Welcome Message */}
        <div className="flex-1 text-center md:text-left space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-brand-100/80 text-brand-800 text-xs font-bold">
            <span className="size-2 rounded-full bg-brand-500 animate-pulse" />
            2026학년도 신입생 오리엔테이션 (OT)
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-strong break-keep leading-tight">
            &ldquo;어른들의 투자 대학교, <br className="hidden sm:inline" />
            <span className="text-brand-700 underline decoration-brand-300 decoration-wavy decoration-2 underline-offset-4">
              ETF 캠퍼스
            </span>에 오신 것을 환영하네!&rdquo;
          </h1>

          <p className="text-sm sm:text-base text-muted font-medium break-keep leading-relaxed">
            복잡한 금융 시장에서 길을 잃지 않도록 내가 직접 캠퍼스를 안내해 주겠네.
            먼저 <strong className="text-strong font-semibold">캠퍼스 투어</strong>로 주요 시설을 익히고,
            <strong className="text-strong font-semibold"> 10강 퀴즈</strong>를 마스터하여
            <span className="text-amber-700 font-bold"> 🎁 [연금 ETF 운용 체크리스트 PDF]</span>를 수여받게나.
          </p>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="mt-6 pt-5 border-t border-brand-100/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-auto inline-flex p-1 rounded-2xl bg-neutral-100/90 border border-neutral-200/80 text-xs sm:text-sm font-bold shadow-inner">
          <button
            type="button"
            onClick={() => onTabChange("tour")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl transition-all ${
              activeTab === "tour"
                ? "bg-surface text-brand-800 shadow-sm ring-1 ring-neutral-200"
                : "text-muted hover:text-strong"
            }`}
          >
            <span>🏛️</span>
            <span>캠퍼스 투어 (시설 안내)</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange("quiz")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl transition-all ${
              activeTab === "quiz"
                ? "bg-brand-700 text-white shadow-sm"
                : "text-muted hover:text-strong"
            }`}
          >
            <span>🎓</span>
            <span>신입생 필수 10강 퀴즈</span>
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeTab === "quiz" ? "bg-brand-800 text-brand-100" : "bg-neutral-200 text-neutral-600"
            }`}>
              LV.{quizProgress}
            </span>
          </button>
        </div>

        {/* Quick hint / motivation badge */}
        <div className="text-xs text-muted font-medium flex items-center gap-1.5 self-center sm:self-auto">
          <span>🎁</span>
          <span>10강 수료 시 <strong className="text-amber-800 font-bold underline decoration-amber-300">체크리스트 PDF</strong> 100% 무료 증정</span>
        </div>
      </div>
    </div>
  );
}
