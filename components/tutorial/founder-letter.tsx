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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200/60 pb-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-100 text-brand-900 text-xs font-black tracking-wide">
              <span>🏛️</span>
              <span>FOUNDER&apos;S STORY | 설립자 이야기</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-neutral-600">
              <span className="px-2.5 py-1 rounded-lg bg-surface border border-neutral-200/80 shadow-2xs">
                💼 금융권 운용 경력
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface border border-neutral-200/80 shadow-2xs">
                📜 금융 전문 자격 다수
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface border border-neutral-200/80 shadow-2xs">
                📈 실전 DC 연금 운용
              </span>
            </div>
          </div>

          {/* Main Title */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-black tracking-tight text-strong break-keep leading-snug">
              &ldquo;왜 어른들에게도 투자 대학교가 필요할까요?&rdquo;
            </h1>
            <p className="text-sm sm:text-base font-semibold text-brand-800 break-keep">
              단타 소음과 리딩방 없는, 가장 투명하고 체계적인 정석 배움터를 열며
            </p>
          </div>

          {/* Letter Body */}
          <div className="space-y-4 text-sm sm:text-[15px] text-neutral-700 font-normal leading-relaxed break-keep">
            <p>
              안녕하세요, ETF 캠퍼스를 설립한 <strong className="font-extrabold text-neutral-950">Neo</strong>입니다.
            </p>
            <p>
              우리는 긴 정규 교육 과정을 거쳐 대학을 졸업하지만, 막상 사회에 나와 마주하는 진짜 삶 속에는 여전히 배워야 할 것들이 너무나도 많습니다. 그중에서도 <strong className="font-extrabold text-neutral-950 underline decoration-brand-300 decoration-2 underline-offset-4">&apos;내 자산을 지키고 키우는 투자&apos;는 이제 누구에게나 생존을 위한 필수 과목</strong>이 되었습니다.
            </p>
            <p>
              특히 주식과 ETF를 비롯한 증권 시장의 구조를 체계적으로 이해하고, 나의 소중한 자산을 원칙에 따라 굴릴 수 있다면 얼마나 좋을까 늘 생각했습니다.
            </p>
            <p>
              하지만 오늘날 우리가 마주하는 현실은 녹록지 않습니다. 수많은 영상과 서적, 강의가 넘쳐나지만 파편화된 정보 속에서 정작 기초부터 차근차근 배울 기회를 찾기는 어렵습니다. 오히려 검증되지 않은 단타 소음이나 자극적인 리딩방, 투자 사기로 이어져 소중한 자산을 잃는 안타까운 일들도 자주 목격하게 됩니다.
            </p>
            <div className="my-5 rounded-2xl bg-surface/90 border border-brand-200/80 p-5 shadow-2xs">
              <p className="text-base sm:text-[17px] font-extrabold text-brand-950 text-center sm:text-left leading-relaxed">
                &ldquo;그런 불안과 혼란 없이, 정말 대학교처럼 투자의 정석을 체계적으로 함께 공부해 나갈 수 있는 곳은 없을까?&rdquo;
              </p>
            </div>
            <p>
              이러한 고민 끝에, 제가 직접 금융 현업에서 펀드를 운용하고 강의하며, 개인적으로 <strong className="font-extrabold text-neutral-950">DC형 퇴직연금을 오랫동안 직접 운용해 온 실전 경험</strong>을 토대로 이 &apos;ETF 캠퍼스&apos;를 세우게 되었습니다.
            </p>
            <p>
              ETF 캠퍼스는 복잡한 금융 시장에서 여러분이 길을 잃지 않도록 돕는 체계적인 나침반이 되고자 합니다. 이곳에서 기초 개념부터 데이터 탐색, 종목 비교, 자산배분 전략까지 <strong className="font-extrabold text-brand-900">&apos;국내 상장 ETF 투자에 필요한 모든 것&apos;</strong>을 한곳에서 끝내실 수 있기를 바랍니다.
            </p>
            <p>
              투자는 긴 호흡으로 이어가는 평생의 여정입니다. 앞으로 여러분과 함께 이 배움의 공간을 더욱 단단하고 풍요롭게 가꾸어 나가고 싶습니다. 신입생 여러분의 입학을 진심으로 환영합니다.
            </p>
          </div>

          {/* Signature */}
          <div className="pt-4 border-t border-brand-200/60 flex justify-end">
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
