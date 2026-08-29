"use client";

import Link from "next/link";
import { STYLE_CHANGE_EVENT } from "@/lib/onboarding/style-diagnosis";

interface CampusTourProps {
  onStartQuiz: () => void;
}

const campusFacilities = [
  {
    id: "diagnosis",
    badge: "입학처 & 상담센터",
    tag: "🎯 첫 방문 필수 코스",
    icon: "🧭",
    title: "전공 적성 검사 (투자 성향 진단)",
    subtitle: "내 투자 DNA를 진단하고 최적의 ETF 전공 찾기",
    description:
      "투자의 출발점은 나만의 투자 성향을 명확히 아는 것입니다. 10가지 동물 성향 진단을 통해 나의 투자 스타일을 점검하고, 맞춤형 자산배분 포트폴리오와 추천 도서를 확인해 보세요.",
    features: [
      "10가지 동물 유형 기반 투자 성향 진단",
      "성향별 자산배분 방향 및 포트폴리오 가이드",
      "투자 성향 맞춤 추천 도서 및 독서 가이드",
    ],
    actionType: "modal",
    actionLabel: "내 전공 적성 검사하러 가기",
    fallbackHref: "/style/turtle",
    theme: "from-teal-500/10 to-emerald-500/5 border-teal-200/90 text-teal-950",
    buttonTheme: "bg-teal-700 hover:bg-teal-800 text-white shadow-teal-700/20",
  },
  {
    id: "briefing",
    badge: "시장 동향 세미나실",
    tag: "⚡ 매일 아침 시장 점검",
    icon: "📈",
    title: "데일리 마켓 브리핑 (오늘의 ETF 시황)",
    subtitle: "매일 아침 거시 지표와 ETF 데이터로 읽는 단기 시장 흐름",
    description:
      "매일 아침 업데이트되는 거시경제 지표와 ETF 등락 데이터를 통해 단기 시장 흐름과 자금 동향을 빠르고 객관적으로 해석합니다. ETF 시장의 숫자를 통해 오늘의 시장 맥락을 짚어보세요.",
    features: [
      "12대 글로벌 거시경제 지표 및 신호등 요약",
      "주요 자산군별 ETF 일간 등락 순위 및 자금 동향",
      "ETF 시장 숫자로 단기 흐름을 해석하는 데일리 브리핑",
    ],
    actionType: "link",
    actionLabel: "오늘의 마켓 브리핑 확인하기",
    href: "/",
    theme: "from-blue-500/10 to-indigo-500/5 border-blue-200/90 text-blue-950",
    buttonTheme: "bg-blue-700 hover:bg-blue-800 text-white shadow-blue-700/20",
  },
  {
    id: "library",
    badge: "중앙도서관 정보열람실",
    tag: "🔍 조건 검색 & 6대 퀵 탐색",
    icon: "📚",
    title: "전공 도서관 (ETF 탐색 & 퀵 탐색)",
    subtitle: "국내 1,160+개 ETF 조건별 정밀 검색 및 계좌별 6대 퀵 탐색",
    description:
      "국내 1,160여 개 ETF를 내 투자 목적에 맞춰 스마트하게 찾는 곳입니다. 10대 인기 테마 조건 검색부터 [일반·연금·혼합채권·TDF·레버리지·신규상장] 6대 맞춤 퀵 탐색과 비교함 담기 기능까지 한 번에 경험해 보세요.",
    features: [
      "조건 검색: DC·IRP 연금 편입, 10대 인기 테마, 총보수·순자산 다차원 필터",
      "6대 퀵 탐색: 일반·연금·혼합채권·TDF(내나이맞춤)·레버리지·신규상장 프리셋",
      "비교함 담기: 탐색 리스트에서 [+] 버튼으로 관심 종목을 담아 1:1 심층 비교",
    ],
    actionType: "link",
    actionLabel: "전공 도서관(ETF 탐색) 둘러보기",
    href: "/explore/",
    theme: "from-purple-500/10 to-violet-500/5 border-purple-200/90 text-purple-950",
    buttonTheme: "bg-purple-700 hover:bg-purple-800 text-white shadow-purple-700/20",
  },
  {
    id: "lab",
    badge: "금융공학 랩실",
    tag: "⚡ 1종목 선택 시 동종 4종 정밀 추천",
    icon: "🔬",
    title: "전공 비교 분석실 (ETF 비교)",
    subtitle: "관심 종목 1개만 골라도 가장 가까운 동종 4종 자동 추천 & 정밀 대조",
    description:
      "이름이 비슷하다고 같은 ETF가 아닙니다. 표기가 달라도 AI전력·2차전지·반도체 등 실제 투자 테마를 정밀 분석해 진짜 동종 ETF 4종을 즉시 추천하며, [최저 보수 🥇]·[거래대금 1위 💧] 등 핵심 강점을 3초 만에 짚어드립니다.",
    features: [
      "연관 산업·키워드 정밀 분석으로 가장 가까운 동종 ETF 4종 즉시 자동 추천",
      "최저 보수·거래대금·순자산 1위 '스마트 장점 칩' & 기간별 1위 성과 하이라이트",
      "총보수·괴리율(NAV) 정밀 대조 & 환헤지·커버드콜 구조 차이 주의 배지",
    ],
    actionType: "link",
    actionLabel: "ETF 비교 분석하러 가기",
    href: "/compare",
    theme: "from-amber-500/10 to-orange-500/5 border-amber-200/90 text-amber-950",
    buttonTheme: "bg-amber-700 hover:bg-amber-800 text-white shadow-amber-700/20",
  },
  {
    id: "books",
    badge: "인문사회관 서재",
    tag: "📖 대가들의 투자 지혜",
    icon: "📖",
    title: "캠퍼스 필독서 서재 (도서·리뷰)",
    subtitle: "검증된 투자 대가들의 고전과 실전 연금 가이드",
    description:
      "존 보글, 벤저민 그레이엄 등 검증된 대가들의 투자 고전과 연금 관련 도서가 모인 서재입니다. 나의 투자 성향에 맞는 도서를 살펴보고 원칙 중심의 투자 철학을 정립해 보세요.",
    features: [
      "투자 대가들의 고전 및 연금 도서 핵심 리뷰",
      "나의 동물 투자 성향(전공)별 맞춤 도서 안내",
      "챕터별 핵심 인사이트 요약 및 서평",
    ],
    actionType: "link",
    actionLabel: "필독서 서재 둘러보기",
    href: "/books/",
    theme: "from-rose-500/10 to-pink-500/5 border-rose-200/90 text-rose-950",
    buttonTheme: "bg-rose-700 hover:bg-rose-800 text-white shadow-rose-700/20",
  },
  {
    id: "community",
    badge: "학생회관 라운지",
    tag: "💬 동문 집단지성 공간",
    icon: "☕",
    title: "학생회 & 동아리방 (ETF 이야기)",
    subtitle: "연금 전략과 실전 ETF 종목 분석을 함께 나누는 공간",
    description:
      "연금 투자는 수십 년을 이어가는 긴 마라톤입니다. 혼자 고민하지 마시고, 동문들과 함께 나만의 자산배분 포트폴리오와 ETF 종목코드($069500) 기반의 실전 분석을 자유롭게 나누어 보세요.",
    features: [
      "ISA·연금 포트폴리오 비중 및 리밸런싱 전략 공유",
      "종목코드($티커) 연결을 통한 ETF 보수·수익구조 분석",
      "초보 질문부터 절세 노하우까지 묻고 답하는 자유 소통",
    ],
    actionType: "link",
    actionLabel: "ETF 이야기(동아리방) 입장하기",
    href: "/community/",
    theme: "from-sky-500/10 to-cyan-500/5 border-sky-200/90 text-sky-950",
    buttonTheme: "bg-sky-700 hover:bg-sky-800 text-white shadow-sky-700/20",
  },
];

export function CampusTour({ onStartQuiz }: CampusTourProps) {
  const handleOpenDiagnosis = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(STYLE_CHANGE_EVENT, { detail: { open: true } })
      );
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Tour Intro Header */}
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-brand-100 text-brand-800">
          🗺️ 캠퍼스 6대 핵심 시설 안내
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-strong tracking-tight break-keep">
          ETF 캠퍼스 6대 시설, 이렇게 200% 활용해 보세요!
        </h2>
        <p className="text-sm sm:text-base text-muted font-medium max-w-2xl mx-auto break-keep">
          신입생 여러분이 성공적인 연금 및 ETF 투자자로 거듭날 수 있도록 설계된 캠퍼스 주요 시설입니다.
          각 시설의 특징을 확인하고 필요한 곳으로 바로 이동해 보십시오.
        </p>
      </div>

      {/* Facility Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {campusFacilities.map((facility) => (
          <div
            key={facility.id}
            className={`relative flex flex-col justify-between rounded-3xl border bg-gradient-to-br p-6 sm:p-7 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${facility.theme}`}
          >
            <div className="space-y-4">
              {/* Card Top: Badge & Tag */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-surface shadow-2xs border border-current/20">
                  <span>{facility.icon}</span>
                  <span>{facility.badge}</span>
                </span>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-white/80 border border-current/15 text-neutral-700">
                  {facility.tag}
                </span>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-lg sm:text-xl font-black text-strong tracking-tight break-keep">
                  {facility.title}
                </h3>
                <p className="text-xs sm:text-sm font-semibold text-muted mt-0.5 break-keep">
                  {facility.subtitle}
                </p>
              </div>

              {/* Clean Descriptive Box */}
              <div className="relative rounded-2xl bg-surface p-4 border border-current/15 shadow-2xs">
                <p className="text-xs sm:text-sm font-medium text-neutral-800 break-keep leading-relaxed">
                  {facility.description}
                </p>
              </div>

              {/* Key Feature Bullets */}
              <ul className="space-y-1.5 pt-1">
                {facility.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-xs sm:text-sm text-neutral-800 font-medium"
                  >
                    <span className="size-1.5 rounded-full bg-current shrink-0" />
                    <span className="break-keep">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action CTA Button */}
            <div className="pt-6 mt-auto">
              {facility.actionType === "modal" ? (
                <button
                  type="button"
                  onClick={handleOpenDiagnosis}
                  className={`w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl font-black text-sm tracking-wide shadow-md transition-all active:scale-[0.98] ${facility.buttonTheme}`}
                >
                  <span>{facility.actionLabel}</span>
                  <span aria-hidden="true">➔</span>
                </button>
              ) : (
                <Link
                  href={facility.href || "#"}
                  className={`w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl font-black text-sm tracking-wide shadow-md transition-all active:scale-[0.98] ${facility.buttonTheme}`}
                >
                  <span>{facility.actionLabel}</span>
                  <span aria-hidden="true">➔</span>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Celebratory Admission & Orientation Quiz Callout Banner */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-amber-300/90 bg-gradient-to-br from-amber-50/95 via-orange-50/60 to-brand-50/80 p-6 sm:p-9 shadow-md">
        {/* Subtle festive background glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-amber-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 size-44 rounded-full bg-brand-100/60 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2.5 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs">
              <span>🎉</span>
              <span>신입생 입학 축하 & OT 퀴즈</span>
            </div>

            <h3 className="text-xl sm:text-2xl lg:text-[26px] font-black text-neutral-950 tracking-tight break-keep leading-snug">
              캠퍼스 시설을 모두 둘러보셨나요? <br className="hidden sm:inline" />
              이제 <span className="text-brand-700 underline decoration-amber-400 decoration-wavy decoration-2 underline-offset-4">&lsquo;신입생 오리엔테이션 퀴즈&rsquo;</span>에 도전해 보세요!
            </h3>

            <p className="text-xs sm:text-sm text-neutral-700 font-medium break-keep leading-relaxed">
              10문항의 퀴즈를 모두 완료하신 신입생 학우분께는 입학 축하 선물로 <br className="hidden sm:inline" />
              <strong className="text-brand-900 font-bold underline decoration-amber-500">
                🎁 [연금 ETF 운용 체크리스트 PDF]
              </strong>
              를 즉시 수여합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartQuiz}
            className="shrink-0 w-full md:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-brand-700 via-brand-800 to-indigo-900 hover:from-brand-600 hover:to-indigo-800 text-white font-black px-7 py-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all text-base tracking-wide"
          >
            <span>🎯 OT 퀴즈 풀고 선물 받기</span>
            <span>➔</span>
          </button>
        </div>
      </div>
    </div>
  );
}
