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
    icon: "🧭",
    title: "전공 적성 검사 (투자 성향 진단)",
    subtitle: "내 투자 DNA를 진단하고 최적의 ETF 전공 찾기",
    professorQuote:
      "투자의 첫걸음은 나 자신을 아는 것일세! 1분 동물 성향 검사를 통해 자신의 투자 본능(거북이, 여우 등)과 맞춤형 포트폴리오를 처방받게나.",
    features: [
      "1분 만에 끝나는 10가지 동물 전공 진단",
      "성향 맞춤형 ETF 포트폴리오 처방",
      "취약점 보완 가이드 및 추천 도서 매핑",
    ],
    actionType: "modal",
    actionLabel: "내 전공 적성 검사하러 가기",
    fallbackHref: "/style/turtle",
    theme: "from-teal-500/10 to-emerald-500/5 border-teal-200/80 text-teal-900",
    buttonTheme: "bg-teal-700 hover:bg-teal-800 text-white shadow-teal-700/20",
  },
  {
    id: "briefing",
    badge: "제1교양관 대강의실",
    icon: "📰",
    title: "오늘의 시사 교양 & 출석체크 (마켓 브리핑)",
    subtitle: "매일 아침 글로벌 시황과 ETF 주요 지표 점검",
    professorQuote:
      "시장에 일희일비하지 않고 맥락을 읽는 훈련이 바로 매일의 출석체크라네. 장단기 금리차와 ETF 자금 흐름을 한눈에 브리핑받게.",
    features: [
      "미국 장단기 금리차 & 거시 경제 시그널 요약",
      "국내 상장 ETF 자산군별 일간 등락 순위",
      "매일 아침 자동으로 분석되는 시황 브리핑",
    ],
    actionType: "link",
    actionLabel: "오늘의 시사 교양(마켓 브리핑) 확인하기",
    href: "/",
    theme: "from-blue-500/10 to-indigo-500/5 border-blue-200/80 text-blue-900",
    buttonTheme: "bg-blue-700 hover:bg-blue-800 text-white shadow-blue-700/20",
  },
  {
    id: "library",
    badge: "중앙도서관 정보열람실",
    icon: "📚",
    title: "전공 도서관 (ETF 탐색·스크리너)",
    subtitle: "국내 900+개 ETF 조건별·계좌별 정밀 탐색",
    professorQuote:
      "국내 상장된 900여 개 ETF를 일반계좌, 연금저축, IRP, 혼합채권 등 내 계좌 목적에 맞게 쏙쏙 골라낼 수 있는 지식의 보고일세.",
    features: [
      "일반 / 연금 / IRP 계좌별 원클릭 필터링",
      "실제 총보수(TER), 순자산총액(AUM), 분배율 정렬",
      "월배당, 배당성장, 환노출/환헤지 세부 태그",
    ],
    actionType: "link",
    actionLabel: "전공 도서관(ETF 탐색) 둘러보기",
    href: "/explore/",
    theme: "from-purple-500/10 to-violet-500/5 border-purple-200/80 text-purple-900",
    buttonTheme: "bg-purple-700 hover:bg-purple-800 text-white shadow-purple-700/20",
  },
  {
    id: "lab",
    badge: "금융공학 랩실",
    icon: "🔬",
    title: "전공 비교 분석실 (1:1 ETF 비교)",
    subtitle: "헷갈리는 두 ETF의 보수, 배당, 기초지수 현미경 대조",
    professorQuote:
      "이름이 비슷하다고 같은 상품이 아니라네. 두 종목을 나란히 두고 숨겨진 비용, 과거 수익률, 분배금을 꼼꼼하게 대조해보게.",
    features: [
      "1:1 종목 핵심 스펙 나란히 맞비교",
      "숨은 기타비용 및 매매중개수수료 합산 분석",
      "기초지수 추종력 및 괴리율 정밀 검증",
    ],
    actionType: "link",
    actionLabel: "ETF 1:1 비교 분석하러 가기",
    href: "/compare",
    theme: "from-amber-500/10 to-orange-500/5 border-amber-200/80 text-amber-900",
    buttonTheme: "bg-amber-700 hover:bg-amber-800 text-white shadow-amber-700/20",
  },
  {
    id: "books",
    badge: "인문사회관 서재",
    icon: "📖",
    title: "캠퍼스 필독서 서재 (도서·리뷰)",
    subtitle: "검증된 투자 대가들의 고전과 실전 연금 가이드",
    professorQuote:
      "존 보글, 벤저민 그레이엄 등 검증된 대가들의 투자 원칙과 캠퍼스가 엄선한 연금 바이블을 읽고 독후감을 나눠보게.",
    features: [
      "월가 대가들의 핵심 투자 철학 요약 노트",
      "실전 연금 ETF 포트폴리오 운용 가이드",
      "동문들의 도서 리뷰 및 챕터별 핵심 토론",
    ],
    actionType: "link",
    actionLabel: "필독서 서재 둘러보기",
    href: "/books/",
    theme: "from-rose-500/10 to-pink-500/5 border-rose-200/80 text-rose-900",
    buttonTheme: "bg-rose-700 hover:bg-rose-800 text-white shadow-rose-700/20",
  },
  {
    id: "community",
    badge: "학생회관 라운지",
    icon: "☕",
    title: "학생회 & 동아리방 (ETF 이야기)",
    subtitle: "함께 공부하고 실전 인사이트를 나누는 동문 커뮤니티",
    professorQuote:
      "투자 여정은 긴 마라톤이라네. 외롭게 혼자 고민하지 말고, 동문들과 함께 스터디하고 인사이트를 나누게나.",
    features: [
      "실전 연금 포트폴리오 고민 상담 게시판",
      "동문들의 생생한 ETF 투자 및 리밸런싱 후기",
      "주간/월간 학습 챌린지 및 참여 인증",
    ],
    actionType: "link",
    actionLabel: "동아리방(커뮤니티) 입장하기",
    href: "/community/",
    theme: "from-sky-500/10 to-cyan-500/5 border-sky-200/80 text-sky-900",
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
          &ldquo;어른들의 투자 대학교, 이렇게 활용하게!&rdquo;
        </h2>
        <p className="text-sm sm:text-base text-muted font-medium max-w-2xl mx-auto break-keep">
          신입생 여러분이 성공적인 연금 및 ETF 투자자로 거듭날 수 있도록 설계된 캠퍼스 주요 시설입니다.
          각 시설의 팁을 읽어보고 필요한 곳으로 바로 이동해 보십시오.
        </p>
      </div>

      {/* Facility Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {campusFacilities.map((facility) => (
          <div
            key={facility.id}
            className={`relative flex flex-col justify-between rounded-3xl border bg-gradient-to-br p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${facility.theme}`}
          >
            <div className="space-y-4">
              {/* Card Top: Badge & Icon */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-surface/90 shadow-2xs border border-current/15">
                  <span>{facility.icon}</span>
                  <span>{facility.badge}</span>
                </span>
                <span className="text-2xl select-none" aria-hidden="true">
                  {facility.icon}
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

              {/* Professor Owl's Speech Box */}
              <div className="relative rounded-2xl bg-surface/95 p-4 border border-current/10 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 text-base">🦉</span>
                  <p className="text-xs sm:text-sm font-medium text-neutral-800 break-keep leading-relaxed italic">
                    &ldquo;{facility.professorQuote}&rdquo;
                  </p>
                </div>
              </div>

              {/* Key Feature Bullets */}
              <ul className="space-y-1.5 pt-1">
                {facility.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs sm:text-sm text-neutral-700 font-medium">
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

      {/* Graduation Challenge Callout Banner */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-brand-300 bg-gradient-to-r from-brand-800 via-brand-900 to-indigo-950 p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-brand-700/80 text-brand-100">
              <span>🎓</span> 신입생 필수 졸업 미션
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight break-keep">
              캠퍼스 투어를 마치셨습니까? <br className="hidden sm:inline" />
              이제 <span className="text-amber-400">신입생 필수 10강 퀴즈</span>에 도전해 보십시오!
            </h3>
            <p className="text-xs sm:text-sm text-brand-100/90 font-medium break-keep">
              10단계를 모두 통과한 학우에게는 부엉이 교수님이 특별 졸업 선물로 <br className="hidden sm:inline" />
              <strong className="text-white font-bold underline decoration-amber-400">🎁 [연금 ETF 운용 체크리스트 PDF]</strong>를 즉시 수여합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartQuiz}
            className="shrink-0 w-full md:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-neutral-950 font-black px-7 py-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-base"
          >
            <span>🎯 10강 퀴즈 풀고 체크리스트 받기</span>
            <span>➔</span>
          </button>
        </div>
      </div>
    </div>
  );
}
