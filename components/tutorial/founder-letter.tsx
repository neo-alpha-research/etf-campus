"use client";

interface FounderLetterProps {
  activeTab: "tour" | "quiz";
  onTabChange: (tab: "tour" | "quiz") => void;
  quizProgress?: number; // 1 ~ 10
}

export function FounderLetter({
  activeTab,
  onTabChange,
  quizProgress = 1,
}: FounderLetterProps) {
  return (
    <div className="space-y-6">
      {/* Founder's Letter Card */}
      <div className="relative overflow-hidden rounded-3xl border border-brand-200/90 bg-gradient-to-br from-brand-50/80 via-surface to-brand-50/40 p-6 sm:p-10 shadow-sm">
        {/* Decorative background blur */}
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 size-48 rounded-full bg-amber-100/40 blur-2xl" />

        <div className="relative space-y-6">
          {/* Header & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200/60 pb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-900 text-xs font-black tracking-wide">
              <span>🏛️</span>
              <span>설립자 인사말</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-neutral-600">
              <span className="px-2.5 py-1 rounded-lg bg-surface border border-neutral-200/80 shadow-2xs">
                💼 금융권 운용 경력
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface border border-neutral-200/80 shadow-2xs">
                📈 실전 DC 연금 운용
              </span>
            </div>
          </div>

          {/* Letter Body */}
          <div className="space-y-3.5 text-sm sm:text-[15px] text-neutral-700 font-normal leading-relaxed break-keep">
            <p>
              안녕하세요, ETF 캠퍼스를 설립한 <strong className="font-extrabold text-neutral-950">Neo</strong>입니다.
            </p>
            <p>
              사회에 나와 마주하는 삶 속에서 <strong className="font-extrabold text-neutral-950 underline decoration-brand-400 decoration-2 underline-offset-4">&apos;내 자산을 지키고 키우는 투자&apos;는 이제 누구에게나 생존을 위한 필수 과목</strong>이 되었습니다.
            </p>
            <p>
              금융 현업에서 펀드를 운용하고 강의하며, 개인적으로 <strong className="font-extrabold text-neutral-950 underline decoration-brand-400 decoration-2 underline-offset-4">DC형 퇴직연금을 오랫동안 직접 운용해 온 실전 경험</strong>을 토대로 이 배움의 공간을 세우게 되었습니다.
            </p>
            <p>
              기초 개념부터 데이터 탐색, 종목 비교, 자산배분 전략까지 <strong className="font-extrabold text-brand-900 underline decoration-brand-400 decoration-2 underline-offset-4">&apos;국내 상장 ETF 투자에 필요한 모든 것&apos;</strong>을 한곳에서 체계적으로 배울 수 있도록 돕겠습니다.
            </p>
            <p>
              투자는 긴 호흡으로 이어가는 평생의 여정입니다. 신입생 여러분의 입학을 진심으로 환영합니다.
            </p>
          </div>

          {/* Signature */}
          <div className="pt-3 border-t border-brand-200/60 flex justify-end">
            <div className="text-right">
              <span className="text-sm sm:text-base font-black text-brand-900">
                ETF 캠퍼스 설립자 Neo 드림
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
        <div className="w-full sm:w-auto inline-flex p-1 rounded-2xl bg-neutral-100 border border-neutral-200/90 text-xs sm:text-sm font-bold shadow-inner">
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
            <span>캠퍼스 시설 안내</span>
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
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === "quiz"
                  ? "bg-brand-800 text-brand-100"
                  : "bg-neutral-200 text-neutral-600"
              }`}
            >
              LV.{quizProgress}
            </span>
          </button>
        </div>

        {/* Quick hint / motivation badge */}
        <div className="text-xs text-muted font-medium flex items-center gap-1.5 self-center sm:self-auto">
          <span>🎁</span>
          <span>
            10강 수료 시{" "}
            <strong className="text-amber-800 font-bold underline decoration-amber-300">
              체크리스트 PDF
            </strong>{" "}
            100% 무료 증정
          </span>
        </div>
      </div>
    </div>
  );
}
