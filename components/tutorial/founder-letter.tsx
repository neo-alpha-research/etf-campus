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
              우리는 대학을 졸업하고 사회에 나온 후에도 실제로 살아가기 위해 끊임없이 배우고 공부해야 합니다. 그중에서도 <strong className="font-extrabold text-neutral-950 underline decoration-brand-400 decoration-2 underline-offset-4">&apos;내 자산을 지키고 키우는 투자&apos;는 이제 누구에게나 생존을 위한 필수 과목</strong>이 되었습니다.
            </p>
            <p>
              특히 주식과 ETF를 비롯한 증권 시장에 대한 이해와 정석 투자를 체계적으로 배울 수 있다면 얼마나 좋을까 늘 생각해 왔습니다.
            </p>
            <p>
              하지만 오늘날 현실에서는 수많은 동영상, 책, 강의가 넘쳐남에도 불구하고 기초부터 차근차근 배울 수 있는 신뢰할 만한 곳을 찾기 어렵습니다. 오히려 검증되지 않은 정보나 자극적인 단타 소음, 심지어 리딩방이나 투자 사기로 이어져 소중한 자산을 잃는 일들도 많아지고 있습니다.
            </p>
            <p>
              그런 우려와 불안 없이, 대학에서 투자의 기초와 원칙을 배우는 것처럼 믿음과 신뢰 속, 실전에 사용할 수 있는 지식을 공부하고 공유하는 공간으로 자리 잡길 기대하며 &apos;ETF 캠퍼스&apos;를 만들게 되었습니다. 금융 현업에서 운용, 강의, 글을 썼던 경험들이 이 공간을 더 가치있게 만들기를 소망합니다.
            </p>
            <p>
              그리고 여러분과 함께 이곳에서 기초 개념부터 데이터 확인, 종목 비교, 자산배분 전략까지 &apos;국내 상장 ETF 투자에 필요한 모든 것&apos;이 다루어지는 가치 있는 공간을 만들어보고 싶습니다.
            </p>
            <p>
              투자는 긴 호흡으로 이어가는 평생의 여정입니다. 그 여정에 출발을 함께하게 되어 진심으로 환영합니다.
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
                <span>🎓 바로 팩트체크 도전하기</span>
                <span>➔</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
