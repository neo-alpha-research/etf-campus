"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { tutorialSteps } from "@/data/tutorial-content";
import { useAuthSession } from "@/components/auth/use-auth-session";
import { FounderLetter } from "@/components/tutorial/founder-letter";
import { CampusTour } from "@/components/tutorial/campus-tour";

function TutorialContent() {
  const { authenticated, isLoading, isValidating } = useAuthSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"tour" | "quiz" | "letter">(() => {
    const tab = searchParams.get("tab");
    if (tab === "quiz" || tab === "letter" || tab === "tour") return tab;
    return "tour";
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [isGraded, setIsGraded] = useState(false);
  const [gradeError, setGradeError] = useState(false);
  const [shake, setShake] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleTabChange = (tab: "tour" | "quiz" | "letter") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stepData = tutorialSteps.find((s) => s.step === currentStep);

  // 로컬스토리지에서 기존 진행 단계 및 답변 상태 불러오기 (최초 1회만 실행)
  useEffect(() => {
    const savedStep = localStorage.getItem("tutorial_progress");
    if (savedStep) {
      const step = parseInt(savedStep, 10);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentStep(step);
    }

    const savedAnswers = localStorage.getItem("tutorial_answers");
    if (savedAnswers) {
      try {
        setAnswers(JSON.parse(savedAnswers));
      } catch {
        // parsing error fallback
      }
    }

    const savedGraded = localStorage.getItem("tutorial_isGraded");
    if (savedGraded === "true") {
      setIsGraded(true);
    }

    setIsLoaded(true);
  }, []);

  // 인증이 완료되었는데 비로그인 상태로 4단계 이상 진입 시 3단계로 강등
  // SWR 캐시(stale data)로 인한 Race condition 방지를 위해 isValidating도 체크
  useEffect(() => {
    if (!isLoading && !isValidating && !authenticated && currentStep > 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentStep(3);
    }
  }, [isLoading, isValidating, authenticated, currentStep]);

  // 답변 선택 핸들러
  const handleSelectAnswer = (qId: string, value: boolean) => {
    if (isGraded) return; // 이미 채점 완료된 경우 수정 불가
    const newAnswers = { ...answers, [qId]: value };
    setAnswers(newAnswers);
    localStorage.setItem("tutorial_answers", JSON.stringify(newAnswers));
  };

  // 현재 단계 채점 핸들러
  const handleGrade = () => {
    if (!stepData) return;

    // 모든 문제에 답변했는지 확인
    const allAnswered = stepData.questions.every((q) => answers[q.id] !== undefined && answers[q.id] !== null);
    if (!allAnswered) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    // 모든 답변이 정답인지 검증
    const allCorrect = stepData.questions.every((q) => answers[q.id] === q.answer);

    if (allCorrect) {
      setIsGraded(true);
      setGradeError(false);
      localStorage.setItem("tutorial_isGraded", "true");
    } else {
      setGradeError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  // 다음 단계로 이동
  const nextStep = () => {
    // 3단계 완료 후 4단계로 넘어갈 때 로그인 체크
    if (currentStep === 3 && !authenticated) {
      router.push("/login?returnTo=/tutorial?tab=quiz");
      return;
    }

    if (currentStep < 10) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setIsGraded(false);
      setGradeError(false);
      localStorage.setItem("tutorial_progress", next.toString());
      localStorage.removeItem("tutorial_isGraded");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // 이전 단계로 이동
  const prevStep = () => {
    if (currentStep > 1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      setIsGraded(false);
      setGradeError(false);
      localStorage.setItem("tutorial_progress", prev.toString());
      localStorage.removeItem("tutorial_isGraded");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!isLoaded || !stepData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="size-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-muted font-medium text-sm">신입생 오리엔테이션 불러오는 중...</p>
      </div>
    );
  }

  const allCurrentAnswered = stepData.questions.every(
    (q) => answers[q.id] !== undefined && answers[q.id] !== null
  );

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* 🏛️ Top 3-Tab Segmented Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 p-1.5 rounded-2xl bg-neutral-100/90 border border-neutral-200/90 shadow-inner">
        <div className="w-full sm:w-auto grid grid-cols-3 sm:flex items-center gap-1">
          {/* 1st Tab: Campus Tour (Default) */}
          <button
            type="button"
            onClick={() => handleTabChange("tour")}
            className={`min-h-[44px] inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer touch-manipulation active:scale-[0.98] ${
              activeTab === "tour"
                ? "bg-surface text-brand-900 shadow-sm ring-1 ring-neutral-200"
                : "text-muted hover:text-strong"
            }`}
          >
            <span>🗺️</span>
            <span className="hidden sm:inline">캠퍼스 시설 안내</span>
            <span className="sm:hidden">시설 안내</span>
          </button>

          {/* 2nd Tab: Orientation Quiz */}
          <button
            type="button"
            onClick={() => handleTabChange("quiz")}
            className={`min-h-[44px] inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer touch-manipulation active:scale-[0.98] ${
              activeTab === "quiz"
                ? "bg-brand-700 text-white shadow-sm"
                : "text-muted hover:text-strong"
            }`}
          >
            <span>🎓</span>
            <span className="hidden sm:inline">신입생 OT 퀴즈</span>
            <span className="sm:hidden">OT 퀴즈</span>
            <span
              className={`ml-0.5 sm:ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === "quiz"
                  ? "bg-brand-800 text-brand-100"
                  : "bg-neutral-200 text-neutral-600"
              }`}
            >
              {currentStep}/10
            </span>
          </button>

          {/* 3rd Tab: Founder's Mission Letter */}
          <button
            type="button"
            onClick={() => handleTabChange("letter")}
            className={`min-h-[44px] inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer touch-manipulation active:scale-[0.98] ${
              activeTab === "letter"
                ? "bg-surface text-brand-900 shadow-sm ring-1 ring-neutral-200"
                : "text-muted hover:text-strong"
            }`}
          >
            <span>🏛️</span>
            <span>설립 취지문</span>
          </button>
        </div>

        {/* Quick Motivation Tag */}
        <div className="text-xs text-muted font-medium flex items-center gap-1.5 px-2 self-center sm:self-auto">
          <span>🎁</span>
          <span>
            퀴즈 완료 시{" "}
            <strong className="text-amber-800 font-bold underline decoration-amber-300">
              체크리스트 PDF
            </strong>{" "}
            100% 증정
          </span>
        </div>
      </div>

      {/* Tab 1: Campus Facility Tour (Default) */}
      {activeTab === "tour" && (
        <CampusTour
          onStartQuiz={() => handleTabChange("quiz")}
        />
      )}

      {/* Tab 2: 10-Lesson Orientation Quiz */}
      {activeTab === "quiz" && (
        <div className="space-y-5 sm:space-y-6 animate-fade-in-up">
          {/* 🎮 EXP Bar & Academic Progress */}
          <div className="relative pt-1">
            <div className="flex mb-2 items-end justify-between">
              <div className="mb-0.5">
                <span className="text-xs sm:text-sm font-extrabold inline-flex items-center gap-1 py-1 px-3 rounded-full text-brand-700 bg-brand-100 border border-brand-200">
                  <span>📖</span> OT 퀴즈 {currentStep}/10단계
                </span>
              </div>
              <div className="text-right flex flex-col items-end">
                {!(currentStep === 10 && isGraded) && (
                  <span className="text-[10px] sm:text-[11px] font-semibold text-amber-700 mb-1">
                    🎁 퀴즈 완주 시 <span className="underline underline-offset-2">체크리스트 PDF</span> 증정!
                  </span>
                )}
                <span className="text-xs sm:text-sm font-extrabold inline-block text-muted">
                  진행률 {currentStep * 10}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-neutral-200">
              <div
                style={{ width: `${(currentStep / 10) * 100}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 transition-all duration-700"
              />
            </div>
          </div>

          {/* 📜 Lesson Step Card */}
          <div className="bg-surface rounded-3xl p-6 sm:p-8 shadow-sm border border-neutral-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
              <div>
                <span className="text-xs font-bold text-brand-600 tracking-wider uppercase">
                  QUIZ {currentStep} / 10
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-strong mt-0.5 break-keep">
                  {stepData.title}
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="px-3.5 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ◀ 이전 퀴즈
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={currentStep === 10 || !isGraded}
                  className="px-3.5 py-1.5 rounded-xl border border-brand-200 bg-brand-50 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  다음 퀴즈 ▶
                </button>
              </div>
            </div>

            {/* Intro Quote Box */}
            <div className="bg-gradient-to-r from-neutral-50 to-brand-50/30 p-4 sm:p-5 rounded-2xl border-l-4 border-brand-600 text-neutral-800 text-sm sm:text-base font-medium leading-relaxed break-keep">
              💡 {stepData.intro}
            </div>

            {/* ❓ Question Items */}
            <div className="space-y-6">
              {stepData.questions.map((q, idx) => {
                const userAns = answers[q.id];
                const isSelectedTrue = userAns === true;
                const isSelectedFalse = userAns === false;
                const isCorrect = userAns === q.answer;

                return (
                  <div
                    key={q.id}
                    className={`p-5 rounded-2xl border transition-all duration-200 ${
                      isGraded
                        ? isCorrect
                          ? "bg-emerald-50/50 border-emerald-200"
                          : "bg-rose-50/50 border-rose-200"
                        : "bg-surface border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 size-6 rounded-full bg-neutral-100 text-neutral-700 font-black text-xs flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-4">
                        <p className="text-base sm:text-lg font-bold text-strong break-keep leading-snug">
                          {q.text}
                        </p>

                        {/* O / X Selection Buttons */}
                        <div className="grid grid-cols-2 gap-3 max-w-sm">
                          <button
                            type="button"
                            onClick={() => handleSelectAnswer(q.id, true)}
                            disabled={isGraded}
                            className={`py-3.5 px-4 rounded-xl font-black text-lg sm:text-xl flex items-center justify-center gap-2 border-2 transition-all active:scale-[0.98] ${
                              isSelectedTrue
                                ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200"
                                : "bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                            } ${isGraded ? "cursor-default" : ""}`}
                          >
                            <span className="text-2xl leading-none">⭕</span>
                            <span>그렇다</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectAnswer(q.id, false)}
                            disabled={isGraded}
                            className={`py-3.5 px-4 rounded-xl font-black text-lg sm:text-xl flex items-center justify-center gap-2 border-2 transition-all active:scale-[0.98] ${
                              isSelectedFalse
                                ? "bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-200"
                                : "bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                            } ${isGraded ? "cursor-default" : ""}`}
                          >
                            <span className="text-2xl leading-none">❌</span>
                            <span>아니다</span>
                          </button>
                        </div>

                        {/* Feedback Banner */}
                        {isGraded && (
                          <div
                            className={`p-3.5 rounded-xl text-xs sm:text-sm font-semibold break-keep leading-relaxed animate-fade-in-up ${
                              isCorrect
                                ? "bg-emerald-100/80 text-emerald-900 border border-emerald-200"
                                : "bg-rose-100/80 text-rose-900 border border-rose-200"
                            }`}
                          >
                            {isCorrect ? q.correctFeedback : q.incorrectFeedback}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🎯 Bottom Action (Grading or Navigation) */}
            {!isGraded ? (
              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={handleGrade}
                  disabled={!allCurrentAnswered}
                  className={`w-full py-4 sm:py-5 rounded-2xl font-black text-lg tracking-wide transition-all shadow-md active:scale-[0.99] ${
                    allCurrentAnswered
                      ? "bg-brand-700 hover:bg-brand-800 text-white shadow-brand-700/20"
                      : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                  } ${shake ? "animate-shake" : ""}`}
                >
                  {allCurrentAnswered ? "제출하고 채점하기 🎯" : "모든 문제의 O / X를 선택해 주세요"}
                </button>
                {gradeError && (
                  <div className="text-center p-3 sm:p-4 bg-red-50 rounded-xl border border-red-200 text-red-700 text-base font-bold animate-pulse break-keep">
                    💥 앗! 오답이 포함되어 있습니다. 문제를 다시 검토해 보십시오!
                  </div>
                )}
              </div>
            ) : currentStep === 10 ? (
              <div className="text-center space-y-5 bg-gradient-to-br from-amber-50 to-orange-50 p-8 rounded-3xl border-2 border-amber-200 shadow-sm animate-fade-in-up">
                <div className="text-5xl animate-bounce">🏆</div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-amber-900 tracking-tight break-keep">
                    축하합니다! 신입생 오리엔테이션 퀴즈 완료!
                  </h2>
                  <p className="text-amber-800 font-medium text-base mt-2 break-keep">
                    설립자 Neo가 제공하는 [연금 ETF 운용 체크리스트]를 다운로드하여 실전에 활용해 보십시오.
                  </p>
                </div>
                <a
                  href="/downloads/연금_ETF_운용_체크리스트.pdf"
                  download="연금_ETF_운용_체크리스트.pdf"
                  className="block w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black py-5 rounded-2xl shadow-[0_4px_0_rgb(180,83,9)] hover:brightness-110 active:shadow-none active:translate-y-1 transition-all text-lg"
                >
                  🎁 최종 보상: 연금 ETF 운용 체크리스트 (PDF) 다운로드
                </a>
              </div>
            ) : (
              <button
                type="button"
                onClick={nextStep}
                className="w-full bg-gradient-to-b from-brand-600 to-brand-700 border-b-4 border-brand-900 text-white font-black py-4 sm:py-5 rounded-2xl hover:brightness-110 active:border-b-0 active:translate-y-1 transition-all shadow-lg text-lg tracking-wide animate-fade-in-up"
              >
                🎉 {currentStep}단계 통과! 다음 제{currentStep + 1}단계로 이동 👉
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Founder's Mission Letter */}
      {activeTab === "letter" && (
        <FounderLetter
          onNavigateTour={() => handleTabChange("tour")}
          onNavigateQuiz={() => handleTabChange("quiz")}
        />
      )}

      {/* Global Animation Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px) rotate(-1deg); }
          75% { transform: translateX(5px) rotate(1deg); }
        }
        .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.4s ease-out forwards; }
      `,
        }}
      />
    </div>
  );
}

export default function TutorialPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-muted font-medium animate-pulse">
          🏛️ ETF 캠퍼스 신입생 오리엔테이션 불러오는 중...
        </div>
      }
    >
      <TutorialContent />
    </Suspense>
  );
}
