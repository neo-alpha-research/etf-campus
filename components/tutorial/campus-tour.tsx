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
    professorQuote:
      "성공 투자의 출발점은 나만의 투자 성향(DNA)을 아는 것입니다. 10가지 동물 전공 진단으로 나의 투자 본능을 파악하고, 맞춤형 연금 포트폴리오와 추천 도서를 처방받아 보세요.",
    features: [
      "10가지 동물 전공(투자 스타일) 1분 정밀 진단",
      "계좌별 맞춤형 ETF 자산배분 포트폴리오 처방",
      "성향별 투자 약점 보완 가이드 및 추천 도서 연계",
    ],
    actionType: "modal",
    actionLabel: "내 전공 적성 검사하러 가기",
    fallbackHref: "/style/turtle",
    theme: "from-teal-500/10 to-emerald-500/5 border-teal-200/90 text-teal-950",
    buttonTheme: "bg-teal-700 hover:bg-teal-800 text-white shadow-teal-700/20",
  },
  {
    id: "briefing",
    badge: "제1교양관 대강의실",
    tag: "⚡ 매일 1분 출석체크",
    icon: "📰",
    title: "오늘의 시사 교양 & 출석체크 (마켓 브리핑)",
    subtitle: "매일 아침 글로벌 시황과 ETF 주요 지표 점검",
    professorQuote:
      "단기 시황에 흔들리지 않고 거시적 흐름을 읽는 안목이 중요합니다. 매일 아침 12대 핵심 거시지표와 7대 자산군 385조 원 ETF 자금 흐름을 7단계 브리핑으로 확인해 보세요.",
    features: [
      "12대 글로벌 거시경제 지표 및 신호등 진단",
      "7대 자산군별 ETF 등락 순위 & 385조 원 자금 유출입",
      "매일 아침 자동으로 분석·발행되는 7단계 심층 시황",
    ],
    actionType: "link",
    actionLabel: "오늘의 시사 교양(마켓 브리핑) 확인하기",
    href: "/",
    theme: "from-blue-500/10 to-indigo-500/5 border-blue-200/90 text-blue-950",
    buttonTheme: "bg-blue-700 hover:bg-blue-800 text-white shadow-blue-700/20",
  },
  {
    id: "library",
    badge: "중앙도서관 정보열람실",
    tag: "🔍 실전 ETF 검색 도구",
    icon: "📚",
    title: "전공 도서관 (ETF 탐색·스크리너)",
    subtitle: "국내 900+개 ETF 조건별·계좌별 정밀 탐색",
    professorQuote:
      "국내 상장된 900여 개 ETF 중 내 계좌에 꼭 맞는 보석을 찾는 곳입니다. 연금·IRP·ISA 계좌별 세제 혜택과 숨은 실질 총비용, 월배당 여부를 꼼꼼하게 필터링해 보세요.",
    features: [
      "일반 · 연금저축 · IRP · ISA 계좌별 맞춤 필터링",
      "총보수 + 기타비용 + 매매중개수수료 합산 '실질 총비용' 확인",
      "월배당 주기, 환노출(UH)/환헤지(H), 순자산(AUM) 정밀 정렬",
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
    tag: "🔬 1:1 정밀 대조 분석",
    icon: "🔬",
    title: "전공 비교 분석실 (1:1 ETF 비교)",
    subtitle: "헷갈리는 두 ETF의 보수, 배당, 기초지수 현미경 대조",
    professorQuote:
      "이름이 비슷하다고 같은 ETF가 아닙니다. 두 종목을 나란히 올려두고 표기 보수 뒤에 숨은 기타비용, 괴리율, 과거 수익률과 분배금을 현미경처럼 대조해 보세요.",
    features: [
      "헷갈리는 2개 ETF 핵심 스펙 1:1 나란히 맞대조",
      "숨은 기타비용 및 매매중개수수료 포함 '실질 비용' 비교",
      "기초지수 추적오차, 괴리율, 구간별 수익률 및 분배금 검증",
    ],
    actionType: "link",
    actionLabel: "ETF 1:1 비교 분석하러 가기",
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
    professorQuote:
      "존 보글, 벤저민 그레이엄 등 검증된 대가들의 투자 고전과 연금 바이블이 모인 서재입니다. 나의 동물 성향에 꼭 맞는 추천 도서를 읽고 실전 투자 철학을 확립해 보세요.",
    features: [
      "월가 거장들의 투자 고전 & 실전 연금 바이블 핵심 요약",
      "나의 동물 투자 성향(전공)별 1:1 맞춤 추천 도서 매핑",
      "챕터별 핵심 인사이트 노트 및 동문 도서 리뷰 토론",
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
    subtitle: "함께 공부하고 실전 인사이트를 나누는 동문 커뮤니티",
    professorQuote:
      "연금 투자는 수십 년을 이어가는 긴 마라톤입니다. 혼자 외롭게 고민하지 마시고, 동문들과 함께 포트폴리오를 상담하고 주간 학습 챌린지에 참여해 보세요.",
    features: [
      "실전 연금 ETF 포트폴리오 상담 및 리밸런싱 후기 공유",
      "주간 · 월간 투자 학습 챌린지 및 완주 인증",
      "주제별 학습 번들(Learning Bundles)을 통한 동문 집단지성 스터디",
    ],
    actionType: "link",
    actionLabel: "동아리방(커뮤니티) 입장하기",
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
          &ldquo;ETF 캠퍼스 6대 시설, 이렇게 200% 활용해 보세요!&rdquo;
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

              {/* Professor Owl's Speech Box (High Contrast & Respectful) */}
              <div className="relative rounded-2xl bg-surface p-4 border border-current/15 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 text-lg select-none">🦉</span>
                  <p className="text-xs sm:text-sm font-semibold text-neutral-900 break-keep leading-relaxed">
                    &ldquo;{facility.professorQuote}&rdquo;
                  </p>
                </div>
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

      {/* Graduation Challenge Callout Banner */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-brand-300 bg-gradient-to-r from-brand-800 via-brand-900 to-indigo-950 p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-brand-700 text-brand-100">
              <span>🎓</span> 신입생 필수 졸업 미션
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight break-keep">
              캠퍼스 투어를 마치셨습니까? <br className="hidden sm:inline" />
              이제 <span className="text-amber-400">신입생 필수 10강 퀴즈</span>에 도전해 보십시오!
            </h3>
            <p className="text-xs sm:text-sm text-brand-100/90 font-medium break-keep">
              10단계를 모두 통과한 학우에게는 부엉이 교수님이 특별 졸업 선물로 <br className="hidden sm:inline" />
              <strong className="text-white font-bold underline decoration-amber-400">
                🎁 [연금 ETF 운용 체크리스트 PDF]
              </strong>
              를 즉시 수여합니다.
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
