"use client";

interface FounderLetterProps {
  onNavigateTour: () => void;
  onNavigateQuiz: () => void;
}

export function FounderLetter({
  onNavigateTour,
  onNavigateQuiz,
}: FounderLetterProps) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Founder's Letter Card */}
      <div className="relative overflow-hidden rounded-3xl border border-brand-200/90 bg-gradient-to-br from-brand-50/80 via-surface to-brand-50/40 p-6 sm:p-10 shadow-sm">
        {/* Decorative background blur */}
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 size-48 rounded-full bg-amber-100/40 blur-2xl" />

        <div className="relative space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-brand-200/60 pb-3.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-100 text-brand-900 text-xs font-black tracking-wide">
              <span>🏛️</span>
              <span>설립 취지문 | FOUNDER&apos;S MISSION</span>
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
              금융 현업에서 투자하고 강의하며, 개인적으로 <strong className="font-extrabold text-neutral-950 underline decoration-brand-400 decoration-2 underline-offset-4">DC형 퇴직연금을 오랫동안 직접 운용해 온 실전 경험</strong>을 토대로 이 배움의 공간을 세우게 되었습니다.
            </p>
            <p>
              기초 개념부터 데이터 탐색, 종목 비교, 자산배분 전략까지 <strong className="font-extrabold text-brand-900 underline decoration-brand-400 decoration-2 underline-offset-4">&apos;국내 상장 ETF 투자에 필요한 모든 것&apos;</strong>을 한곳에서 체계적으로 알아 갈 수 있는 공간이 되었으면 합니다.
            </p>
            <p>
              투자는 긴 호흡으로 이어가는 평생의 여정입니다. 여러분의 입학을 진심으로 환영합니다.
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

          {/* Next Action CTAs */}
          <div className="pt-4 border-t border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs sm:text-sm font-semibold text-neutral-600">
              다음 단계로 이동해 캠퍼스를 탐방해 보세요 👉
            </p>
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                onClick={onNavigateTour}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white text-xs sm:text-sm font-black shadow-md shadow-brand-700/20 transition-all active:scale-[0.98]"
              >
                <span>🗺️ 캠퍼스 시설 둘러보기</span>
                <span>➔</span>
              </button>
              <button
                type="button"
                onClick={onNavigateQuiz}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-surface border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs sm:text-sm font-black shadow-2xs transition-all active:scale-[0.98]"
              >
                <span>🎓 바로 OT 퀴즈 풀기</span>
                <span>➔</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
