"use client";

import { useEffect, useCallback } from "react";
import { X, ArrowRight, Compass, Sparkles } from "lucide-react";

interface MarketBriefingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStep?: (stepId: string) => void;
}

export function MarketBriefingGuideModal({
  isOpen,
  onClose,
  onNavigateToStep,
}: MarketBriefingGuideModalProps) {
  // ESC 키 닫기 핸들러
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  // 모달 열림 시 배경 스크롤 방지 & ESC 리스너 등록
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleStepClick = (stepId: string) => {
    onClose();
    if (onNavigateToStep) {
      setTimeout(() => {
        onNavigateToStep(stepId);
      }, 100);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-neutral-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-guide-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[24px] sm:rounded-[28px] bg-white shadow-2xl border border-[#D7EABB] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-[#EDF2DE] bg-gradient-to-r from-[#FAFDF6] to-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3DF] text-[#2E6819] shadow-xs border border-[#D7EABB]">
              <Compass className="h-5 w-5 stroke-[2.2]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  id="briefing-guide-title"
                  className="font-extrabold text-neutral-900 text-base sm:text-lg tracking-tight"
                >
                  마켓 브리핑 100% 활용 가이드
                </h3>
                <span className="hidden xs:inline-flex items-center text-[10.5px] font-black text-[#2E6819] bg-[#FAFDF4] px-2.5 py-0.5 rounded-full border border-[#D7EABB]">
                  7 STEP 완성형
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">
                전문가 스타일 4단계 Top-Down 분석 워크플로우 &amp; 7 STEP 가이드
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="가이드 닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6819]/30"
          >
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>

        {/* 모달 스크롤 바디 */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 text-neutral-700">
          {/* 인트로 알림 배너 */}
          <div className="rounded-2xl bg-[#FAFDF4] p-3.5 sm:p-4 border border-[#D7EABB] flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#2E6819] mt-0.5 shrink-0" />
            <p className="text-xs sm:text-[12.5px] text-neutral-700 leading-relaxed">
              ETF 마켓 브리핑은 <b>거시 지표(Macro)부터 세부 테마(Micro), 그리고 실질 펀드 플로우(Fund Flow)까지</b> 
              시장의 전체적인 맥락을 논리적으로 추적할 수 있도록 <b>7단계 체계</b>로 설계되었습니다.
            </p>
          </div>

          {/* 4단계 Top-Down 워크플로우 카드 그리드 */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-neutral-400 tracking-wider uppercase flex items-center gap-1.5 px-0.5">
              <span>Top-Down 4단계 분석 워크플로우</span>
            </h4>

            {/* 1단계: 거시 판도 & 시장 체온 (STEP 1~2) */}
            <div className="rounded-2xl bg-[#F8FAFC] p-4 border border-[#E2E8F0] hover:border-[#CBD5E1] transition-all">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DBEAFE] text-[11px] font-black text-[#1E40AF]">
                    1
                  </span>
                  <h5 className="font-extrabold text-[#1D4ED8] text-[13px] sm:text-[13.5px]">
                    STEP 1~2. 거시 판도 &amp; 시장 체온
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={() => handleStepClick("step-macro")}
                  className="text-[11px] font-bold text-[#1D4ED8] hover:text-[#1E40AF] bg-white px-2.5 py-0.5 rounded-lg border border-[#BFDBFE] hover:bg-[#EFF6FF] transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>STEP 1·2 보기</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-neutral-600 text-xs leading-relaxed">
                환율·금리·유가·VIX 등 <b>12개 거시 지표</b>로 글로벌 위험 선호도를 진단하고, 
                1,000+개 일반 ETF의 <b>상승 체온계(상승/보합/하락 비율)</b>와 <b>상위 10개 거래 쏠림도(3-Zone 건전성)</b>로 
                오늘 장세의 온도를 판별합니다.
              </p>
            </div>

            {/* 2단계: 자산 배분 & 주도 테마 (STEP 3) */}
            <div className="rounded-2xl bg-[#F4F9EE] p-4 border border-[#DCEDC8] hover:border-[#C5E1A5] transition-all">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DCEDC8] text-[11px] font-black text-[#1B5E20]">
                    2
                  </span>
                  <h5 className="font-extrabold text-[#2E6819] text-[13px] sm:text-[13.5px]">
                    STEP 3. 자산 배분 &amp; 주도 테마
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={() => handleStepClick("step-micro")}
                  className="text-[11px] font-bold text-[#2E6819] hover:text-[#1B5E20] bg-white px-2.5 py-0.5 rounded-lg border border-[#C5E1A5] hover:bg-[#EBF5DC] transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>STEP 3 보기</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-neutral-600 text-xs leading-relaxed">
                <b>7대 자산군 기여도 매트릭스</b>(가중수익률 × AUM 비중)로 시장 지수 등락을 견인한 자금 축을 찾고, 
                국내·해외·채권·원자재 <b>세부 테마의 롱숏(Top 3 vs Worst 3) 성과</b>로 오늘 장의 주도주를 선별합니다.
              </p>
            </div>

            {/* 3단계: 실질 자금 흐름(Fund Flow) & 수급 트렌드 (STEP 4~5) */}
            <div className="rounded-2xl bg-[#FEF6EE] p-4 border border-[#FADEC9] hover:border-[#F7C6A0] transition-all">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFEDD5] text-[11px] font-black text-[#9A3412]">
                    3
                  </span>
                  <h5 className="font-extrabold text-[#C2410C] text-[13px] sm:text-[13.5px]">
                    STEP 4~5. 실질 자금 흐름(Fund Flow) &amp; 수급 트렌드
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={() => handleStepClick("step-money")}
                  className="text-[11px] font-bold text-[#C2410C] hover:text-[#9A3412] bg-white px-2.5 py-0.5 rounded-lg border border-[#FED7AA] hover:bg-[#FFF7ED] transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>STEP 4·5 보기</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-neutral-600 text-xs leading-relaxed">
                단순 주가 변동에 따른 장부상 AUM 착시(가격 효과)를 배제하고, 1차 시장의 실제 발행·환매(Creation &amp; Redemption) 좌수 증감에 기반한 <b>당일 실질 순유입 TOP 5</b>와 
                <b>주간(5일)·월간(20일) 중기 펀드 플로우</b>를 비교하여 기관/대형 자금의 지속적 매집 여부를 검증합니다.
              </p>
            </div>

            {/* 4단계: 시장 구조 & 펀더멘털 성장 (STEP 6~7) */}
            <div className="rounded-2xl bg-[#F9F5FF] p-4 border border-[#E9D7FE] hover:border-[#D6BBFB] transition-all">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F4EBFF] text-[11px] font-black text-[#53389E]">
                    4
                  </span>
                  <h5 className="font-extrabold text-[#6941C6] text-[13px] sm:text-[13.5px]">
                    STEP 6~7. 시장 구조 &amp; 성장 궤적
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={() => handleStepClick("step-scale")}
                  className="text-[11px] font-bold text-[#6941C6] hover:text-[#53389E] bg-white px-2.5 py-0.5 rounded-lg border border-[#D6BBFB] hover:bg-[#F9F5FF] transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>STEP 6·7 보기</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-neutral-600 text-xs leading-relaxed">
                4대 유형(일반·파킹·레버리지·인버스) <b>듀얼 게이지 &amp; 회전율</b>로 시장의 투기적 체질을 진단하고, 
                일·주·월·연 <b>AUM 브릿지 분해</b>로 자산 성장이 &apos;단순 주가 상승(가격효과)&apos;인지 &apos;실제 신규 자금 유입(진성수급)&apos;인지 정밀하게 분해합니다.
              </p>
            </div>
          </div>

          {/* 3대 투자자 페르소나별 실전 활용 루틴 */}
          <div className="mt-6 rounded-2xl bg-[#F7FAEE] p-4 sm:p-5 border border-[#D7EABB] space-y-3">
            <h4 className="text-xs font-black text-[#2E6819] uppercase tracking-wider flex items-center gap-1.5">
              <span>🎯 투자자 페르소나별 실전 활용 루틴</span>
            </h4>

            <div className="space-y-2.5 text-xs">
              {/* 루틴 1: 30초 출근길 스캔 */}
              <div className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-[#E2EBD6]">
                <span className="text-xs font-black shrink-0 px-2 py-0.5 bg-[#EAF3DF] rounded-md text-[#224E12] flex items-center gap-1">
                  <span>⚡</span> 30초 퀵스캔
                </span>
                <p className="text-neutral-700 leading-snug">
                  <b>바쁜 장전/출근길</b>: 상단 <b>‘3줄 요약’</b> ➔ <b>‘STEP 2 시장 체온계’</b> ➔ <b>‘당일 수급 1위 ETF’</b>만 빠르게 스캔하여 장 시작 전 핵심 분위기를 파악하세요.
                </p>
              </div>

              {/* 루틴 2: 3분 장마감 딥다이브 */}
              <div className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-[#E2EBD6]">
                <span className="text-xs font-black shrink-0 px-2 py-0.5 bg-[#E8EDDF] rounded-md text-[#33442B] flex items-center gap-1">
                  <span>🔍</span> 3분 딥다이브
                </span>
                <p className="text-neutral-700 leading-snug">
                  <b>장마감 후 저녁</b>: <b>STEP 3 테마 롱숏</b>으로 주도 테마를 찾고, <b>STEP 5 주·월간 트렌드</b>와 <b>STEP 7 AUM 브릿지</b>로 실질 자금 순유입을 확인하여 내일 전략을 세우세요.
                </p>
              </div>

              {/* 루틴 3: 프로 애널리스트 팩트체크 */}
              <div className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-[#E2EBD6]">
                <span className="text-xs font-black shrink-0 px-2 py-0.5 bg-[#F0FDF4] rounded-md text-[#166534] border border-[#BBF7D0] flex items-center gap-1">
                  <span>🏛️</span> 프로 분석
                </span>
                <p className="text-neutral-700 leading-snug">
                  <b>기관·전문 투자자</b>: <b>STEP 3 자산군 기여도 합산</b>과 <b>STEP 6 레버리지 투기 회전율</b>, <b>STEP 7 가격효과 vs 진성수급</b> 분해를 통해 시장 왜곡 없는 정밀 분석을 수행하세요.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 모달 하단 푸터 액션 */}
        <div className="px-5 sm:px-7 py-3.5 sm:py-4 border-t border-[#EDF2DE] bg-neutral-50 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-neutral-400 font-medium hidden sm:block">
            ※ KRX 공시 데이터 기반 ETF 캠퍼스 금융 전문가 집계 및 검증
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#2E6819] px-6 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-sm hover:bg-[#235213] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6819]/40 cursor-pointer"
          >
            확인했습니다
          </button>
        </div>
      </div>
    </div>
  );
}
