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

        <div className="relative space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-brand-200/60 pb-3.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-900 text-xs font-black tracking-wide">
              <span>🏛️</span>
              <span>설립자 인사말</span>
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
            <span>신입생 오리엔테이션 퀴즈</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === "quiz"
                  ? "bg-brand-800 text-brand-100"
                  : "bg-neutral-200 text-neutral-600"
              }`}
            >
              {quizProgress}/10
            </span>
          </button>
        </div>

        {/* Quick hint / motivation badge */}
        <div className="text-xs text-muted font-medium flex items-center gap-1.5 self-center sm:self-auto">
          <span>🎁</span>
          <span>
            퀴즈 완료 시{" "}
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
