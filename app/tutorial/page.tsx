"use client";

import { useState, useEffect, useSyncExternalStore, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { tutorialSteps } from "@/data/tutorial-content";
import { useAuthSession } from "@/components/auth/use-auth-session";
import { FounderLetter } from "@/components/tutorial/founder-letter";
import { CampusTour } from "@/components/tutorial/campus-tour";

const emptySubscribe = () => () => {};

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function TutorialContent() {
  const isMounted = useIsMounted();
  const { authenticated } = useAuthSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAutoDownloadIntent = searchParams.get("download") === "auto";

  const [activeTab, setActiveTab] = useState<"tour" | "quiz" | "letter">(() => {
    const tab = searchParams.get("tab");
    if (tab === "quiz" || tab === "letter" || tab === "tour") return tab;
    return "quiz";
  });

  const [maxUnlockedStep, setMaxUnlockedStep] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const saved =
      localStorage.getItem("tutorial_max_unlocked_step") ||
      localStorage.getItem("tutorial_progress");
    if (saved) {
      const step = parseInt(saved, 10);
      return Math.min(Math.max(step, 1), 5);
    }
    return 1;
  });

  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const savedStep = localStorage.getItem("tutorial_progress");
    if (savedStep) {
      const step = parseInt(savedStep, 10);
      return Math.min(Math.max(step, 1), 5);
    }
    return 1;
  });

  const [answers, setAnswers] = useState<Record<string, boolean | null>>(() => {
    if (typeof window === "undefined") return {};
    const savedAnswers = localStorage.getItem("tutorial_answers");
    if (savedAnswers) {
      try {
        return JSON.parse(savedAnswers);
      } catch {
        return {};
      }
    }
    return {};
  });

  // 전체 5단계 10문항 정답 여부 엄격 판정
  const isQuizAllCompleted = tutorialSteps.every((s) =>
    s.questions.every((q) => answers[q.id] === q.answer)
  );

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

  // 로그인/회원가입 후 ?download=auto 로 복귀 시 안전한 자동 PDF 다운로드 실행
  // - 10문항 전체 완주 + 로그인 인증이 확인된 경우에만 실행
  // - 브라우저 팝업/다운로드 차단 시에도 수동 다운로드 버튼이 상시 노출되어 안전하게 수령 가능
  // - 완주하지 않은 상태의 쿼리는 무시하고 안전하게 제거
  useEffect(() => {
    if (!isAutoDownloadIntent) return;

    if (authenticated && isQuizAllCompleted) {
      queueMicrotask(() => {
        setCurrentStep(5);
      });
      if (typeof document !== "undefined") {
        const link = document.createElement("a");
        link.href = "/downloads/2026_직장인_3대절세계좌_완벽운용_치트시트.pdf";
        link.download = "2026_직장인_3대절세계좌_완벽운용_치트시트.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    }

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("download");
      window.history.replaceState({}, "", url.toString());
    }
  }, [isAutoDownloadIntent, authenticated, isQuizAllCompleted]);

  // 답변 선택 핸들러 (선택 즉시 실시간 피드백 및 로컬스토리지 저장)
  const handleSelectAnswer = (qId: string, value: boolean) => {
    const newAnswers = { ...answers, [qId]: value };
    setAnswers(newAnswers);
    localStorage.setItem("tutorial_answers", JSON.stringify(newAnswers));

    if (!stepData) return;
    const allCorrect = stepData.questions.every((q) => newAnswers[q.id] === q.answer);
    if (allCorrect) {
      const nextUnlocked = Math.min(
        Math.max(maxUnlockedStep, currentStep < 5 ? currentStep + 1 : 5),
        5
      );
      setMaxUnlockedStep(nextUnlocked);
      localStorage.setItem("tutorial_max_unlocked_step", nextUnlocked.toString());
      localStorage.setItem("tutorial_progress", currentStep.toString());
    }
  };

  // 다음 단계로 이동
  const nextStep = () => {
    if (currentStep < 5) {
      const next = currentStep + 1;
      setCurrentStep(next);
      const nextMax = Math.max(maxUnlockedStep, next);
      setMaxUnlockedStep(nextMax);
      localStorage.setItem("tutorial_max_unlocked_step", nextMax.toString());
      localStorage.setItem("tutorial_progress", next.toString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // 이전 단계로 이동 (기존 최고 달성 단계를 보존하여 비파괴적 복습 지원)
  const prevStep = () => {
    if (currentStep > 1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      localStorage.setItem("tutorial_progress", prev.toString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // 특정 단계로 직접 이동 (해금된 단계만 접근 가능)
  const goToStep = (step: number) => {
    if (step >= 1 && step <= 5 && step <= maxUnlockedStep) {
      setCurrentStep(step);
      localStorage.setItem("tutorial_progress", step.toString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // 팩트체크 처음부터 다시 풀기 (초기화)
  const handleResetQuiz = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        "지금까지의 팩트체크 답변 기록을 초기화하고 1단계부터 다시 시작하시겠습니까?"
      )
    ) {
      setAnswers({});
      setCurrentStep(1);
      setMaxUnlockedStep(1);
      localStorage.removeItem("tutorial_answers");
      localStorage.removeItem("tutorial_progress");
      localStorage.removeItem("tutorial_max_unlocked_step");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!isMounted || !stepData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="size-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-muted font-medium text-sm">팩트체크 불러오는 중...</p>
      </div>
    );
  }

  // 현재 단계 2문항의 정답 여부 실시간 판정
  const isAllAnswered = stepData.questions.every(
    (q) => answers[q.id] !== undefined && answers[q.id] !== null
  );
  const isStepCompleted = stepData.questions.every((q) => answers[q.id] === q.answer);

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 pt-2 pb-24 sm:pt-6 sm:pb-32 space-y-4 sm:space-y-6">
      {/* 🏛️ Top 3-Tab Segmented Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 p-1.5 rounded-2xl bg-neutral-100/90 border border-neutral-200/90 shadow-inner">
        <div className="w-full sm:w-auto grid grid-cols-[1fr_1fr_auto] sm:flex items-center gap-1">
          {/* 1st Tab: Founder's Mission Letter */}
          <button
            type="button"
            onClick={() => handleTabChange("letter")}
            className={`min-h-[44px] inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer touch-manipulation active:scale-[0.98] ${
              activeTab === "letter"
                ? "bg-brand-700 text-white shadow-sm"
                : "text-muted hover:text-strong"
            }`}
          >
            <span>🏛️</span>
            <span className="hidden sm:inline">설립 취지문</span>
            <span className="sm:hidden">설립 취지</span>
          </button>

          {/* 2nd Tab: Campus Facility Tour */}
          <button
            type="button"
            onClick={() => handleTabChange("tour")}
            className={`min-h-[44px] inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer touch-manipulation active:scale-[0.98] ${
              activeTab === "tour"
                ? "bg-brand-700 text-white shadow-sm"
                : "text-muted hover:text-strong"
            }`}
          >
            <span>🗺️</span>
            <span className="hidden sm:inline">캠퍼스 시설 안내</span>
            <span className="sm:hidden">시설 안내</span>
          </button>

          {/* 3rd Tab: 5-Step Fact Check Challenge */}
          <button
            type="button"
            onClick={() => handleTabChange("quiz")}
            className={`min-h-[44px] inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer touch-manipulation active:scale-[0.98] ${
              activeTab === "quiz"
                ? "bg-brand-700 text-white shadow-sm"
                : "text-muted hover:text-strong"
            }`}
          >
            <span>🎓</span>
            <span className="hidden sm:inline">팩트체크</span>
            <span className="sm:hidden">팩트체크</span>
            <span
              className={`ml-0.5 sm:ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                activeTab === "quiz"
                  ? "bg-brand-800 text-brand-100"
                  : "bg-neutral-200 text-neutral-600"
              }`}
            >
              {isQuizAllCompleted ? "완료" : `${currentStep}/5`}
            </span>
          </button>
        </div>

        {/* Quick Motivation Tag */}
        <div className="text-xs text-muted font-medium flex items-center gap-1.5 px-2 self-center sm:self-auto">
          <span>🎁</span>
          <span>
            5단계 완주 시{" "}
            <strong className="text-amber-800 font-bold underline decoration-amber-300">
              A4 치트시트 PDF
            </strong>{" "}
            100% 증정
          </span>
        </div>
      </div>

      {/* Tab 1: Campus Facility Tour */}
      {activeTab === "tour" && (
        <CampusTour
          onStartQuiz={() => handleTabChange("quiz")}
        />
      )}

      {/* Tab 2: 5-Step Master Fact Check Challenge (Option A: Full Premium Redesign) */}
      {activeTab === "quiz" && (
        <div className="space-y-5 sm:space-y-6 animate-fade-in-up">
          {/* 🎮 EXP Bar, Step Chips & Academic Progress */}
          <div className="relative pt-1 space-y-2.5">
            <div className="flex mb-1 items-end justify-between">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold inline-flex items-center gap-1 py-1 px-3 rounded-full text-brand-700 bg-brand-100/90 border border-brand-200">
                  <span>⚡</span> 5대 절세 팩트체크 {currentStep}/5단계
                </span>
              </div>
              <div className="text-right flex flex-col items-end">
                {!isQuizAllCompleted && (
                  <span className="text-[10px] sm:text-[11px] font-semibold text-amber-700 mb-0.5">
                    🎁 완주 시 <span className="underline underline-offset-2">치트시트 PDF</span> 즉시 수여!
                  </span>
                )}
                <span className="text-xs sm:text-sm font-extrabold inline-block text-muted">
                  진행률 {currentStep * 20}%
                </span>
              </div>
            </div>

            {/* Linear Progress Bar */}
            <div className="overflow-hidden h-2.5 text-xs flex rounded-full bg-neutral-200/90">
              <div
                style={{ width: `${(currentStep / 5) * 100}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-brand-600 via-indigo-600 to-emerald-600 transition-all duration-500"
              />
            </div>

            {/* Non-destructive Step Quick-Jump Chips */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 pt-1">
              {tutorialSteps.map((s) => {
                const isCurrent = s.step === currentStep;
                const isStepAllCorrect = s.questions.every((q) => answers[q.id] === q.answer);
                const isUnlocked = s.step <= maxUnlockedStep;

                return (
                  <button
                    key={s.step}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => goToStep(s.step)}
                    className={`py-1.5 sm:py-2 px-1 rounded-xl text-center transition-all touch-manipulation cursor-pointer active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${
                      isCurrent
                        ? "bg-brand-900 text-white shadow-sm ring-2 ring-brand-600 font-black"
                        : isStepAllCorrect
                        ? "bg-emerald-100/90 text-emerald-900 hover:bg-emerald-200 font-bold border border-emerald-300/80"
                        : isUnlocked
                        ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold border border-neutral-300"
                        : "bg-neutral-100/60 text-neutral-400 border border-neutral-200/70"
                    }`}
                  >
                    <div className="text-[10px] sm:text-xs tracking-tight">
                      {isStepAllCorrect ? `0${s.step} ✓` : `0${s.step}단계`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 📜 Premium Step Card */}
          <div className="bg-surface rounded-3xl p-5 sm:p-8 shadow-sm border border-neutral-200/90 space-y-6">
            {/* Header: Step Indicator, Benefit Badge & Navigation */}
            <div className="space-y-3.5 border-b border-neutral-100 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-brand-900 text-brand-100 text-[11px] sm:text-xs font-black tracking-wider uppercase shadow-2xs">
                    CHALLENGE 0{currentStep} / 05
                  </span>
                  <span className="px-3 py-1 rounded-full bg-amber-100/90 text-amber-950 border border-amber-300/80 text-[11px] sm:text-xs font-black shadow-2xs">
                    {stepData.benefitBadge}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetQuiz}
                    className="hidden sm:inline-block px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-700 font-medium transition-colors cursor-pointer"
                    title="답변 기록을 초기화하고 1단계부터 다시 시작합니다"
                  >
                    🔄 다시 풀기
                  </button>
                  <button
                    type="button"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    className="px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    ◀ 이전 단계
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={currentStep === 5 || !isStepCompleted}
                    className="px-3 py-1.5 rounded-xl border border-brand-200 bg-brand-50 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    다음 단계 ▶
                  </button>
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight break-keep leading-snug">
                {stepData.title}
              </h2>
            </div>

            {/* Intro Quote Box */}
            <div className="bg-gradient-to-r from-neutral-50 via-brand-50/20 to-neutral-50 p-4 sm:p-5 rounded-2xl border-l-4 border-brand-600 text-neutral-800 text-sm sm:text-base font-medium leading-relaxed break-keep">
              💡 {stepData.intro}
            </div>

            {/* ❓ Interactive Question Cards (Instant Micro-Feedback) */}
            <div className="space-y-5 sm:space-y-6">
              {stepData.questions.map((q, idx) => {
                const userAns = answers[q.id];
                const hasAnswered = userAns !== undefined && userAns !== null;
                const isCorrect = hasAnswered && userAns === q.answer;
                const isSelectedTrue = userAns === true;
                const isSelectedFalse = userAns === false;

                return (
                  <div
                    key={q.id}
                    className={`p-5 sm:p-6 rounded-2xl border transition-all duration-300 ${
                      hasAnswered
                        ? isCorrect
                          ? "bg-emerald-50/40 border-emerald-300/80 shadow-xs"
                          : "bg-amber-50/40 border-amber-300/80 shadow-xs"
                        : "bg-surface border-neutral-200/90 hover:border-neutral-300 shadow-2xs"
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Question Header & Short Title */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2">
                          <span className="size-6 rounded-full bg-brand-100 text-brand-900 font-black text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-extrabold text-brand-800 tracking-wide">
                            {q.shortTitle}
                          </span>
                        </div>

                        {hasAnswered && (
                          <span
                            className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border animate-fade-in-up ${
                              isCorrect
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                : "bg-amber-100 text-amber-900 border-amber-300"
                            }`}
                          >
                            {isCorrect ? "✅ 팩트 확인 완료" : "💡 힌트 확인"}
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      <p className="text-base sm:text-lg font-extrabold text-neutral-900 break-keep leading-snug">
                        {q.text}
                      </p>

                      {/* Modern Tactile Option Selectors */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Option 1: True (그렇다 / 맞습니다) */}
                        <button
                          type="button"
                          onClick={() => handleSelectAnswer(q.id, true)}
                          className={`p-4 rounded-2xl text-left border-2 transition-all active:scale-[0.98] cursor-pointer touch-manipulation flex items-center justify-between gap-3 ${
                            isSelectedTrue
                              ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-blue-600 shadow-md ring-2 ring-blue-300"
                              : "bg-surface hover:bg-neutral-50 text-neutral-800 border-neutral-200/90 hover:border-blue-300"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-2xl leading-none shrink-0">⭕</span>
                            <div className="min-w-0">
                              <span className="block text-base font-black truncate">
                                {q.options.trueLabel}
                              </span>
                              <span
                                className={`block text-xs font-medium truncate ${
                                  isSelectedTrue ? "text-blue-100" : "text-neutral-500"
                                }`}
                              >
                                {q.options.trueHint}
                              </span>
                            </div>
                          </div>
                          {isSelectedTrue && (
                            <span className="shrink-0 size-5 rounded-full bg-white/20 text-white text-xs flex items-center justify-center font-black">
                              ✓
                            </span>
                          )}
                        </button>

                        {/* Option 2: False (아니다 / 아닙니다) */}
                        <button
                          type="button"
                          onClick={() => handleSelectAnswer(q.id, false)}
                          className={`p-4 rounded-2xl text-left border-2 transition-all active:scale-[0.98] cursor-pointer touch-manipulation flex items-center justify-between gap-3 ${
                            isSelectedFalse
                              ? "bg-gradient-to-r from-rose-600 to-pink-700 text-white border-rose-600 shadow-md ring-2 ring-rose-300"
                              : "bg-surface hover:bg-neutral-50 text-neutral-800 border-neutral-200/90 hover:border-rose-300"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-2xl leading-none shrink-0">❌</span>
                            <div className="min-w-0">
                              <span className="block text-base font-black truncate">
                                {q.options.falseLabel}
                              </span>
                              <span
                                className={`block text-xs font-medium truncate ${
                                  isSelectedFalse ? "text-rose-100" : "text-neutral-500"
                                }`}
                              >
                                {q.options.falseHint}
                              </span>
                            </div>
                          </div>
                          {isSelectedFalse && (
                            <span className="shrink-0 size-5 rounded-full bg-white/20 text-white text-xs flex items-center justify-center font-black">
                              ✓
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Instant Feedback Reveal (Slides down on answer selection) */}
                      {hasAnswered && (
                        <div
                          className={`mt-3 p-4 sm:p-5 rounded-2xl text-xs sm:text-sm font-medium break-keep leading-relaxed animate-fade-in-up ${
                            isCorrect
                              ? "bg-emerald-100/90 text-emerald-950 border border-emerald-300/80 shadow-2xs"
                              : "bg-amber-100/90 text-amber-950 border border-amber-300/80 shadow-2xs"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="shrink-0 text-lg sm:text-xl mt-0.5">
                              {isCorrect ? "✅" : "💡"}
                            </span>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm sm:text-base">
                                  {isCorrect ? "완벽합니다! 확실한 팩트체크" : "90%의 투자자가 놓치는 핵심 포인트"}
                                </span>
                              </div>
                              <p className="leading-relaxed">
                                {isCorrect ? q.correctFeedback : q.incorrectFeedback}
                              </p>
                              {!isCorrect && (
                                <p className="text-xs font-bold text-amber-900/80 pt-1">
                                  💡 위의 정답 보기를 다시 탭하시면 정답으로 즉시 갱신됩니다.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🎯 Bottom Action: Smooth Progression or Grand Graduation */}
            {!isStepCompleted ? (
              <div className="pt-2 text-center p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs sm:text-sm font-bold text-neutral-600 break-keep">
                {!isAllAnswered
                  ? "💡 위 2문항의 보기를 선택해 보세요. 즉시 실전 팩트 해설이 펼쳐집니다."
                  : "💡 놓친 포인트의 정답 보기를 다시 선택하시면 다음 단계로 이동할 수 있습니다."}
              </div>
            ) : currentStep === 5 ? (
              /* Grand Graduation & Cheat Sheet Reward Card */
              isQuizAllCompleted ? (
                <div className="text-center space-y-6 bg-gradient-to-br from-amber-50/95 via-orange-50/70 to-brand-50/90 p-6 sm:p-10 rounded-3xl border-2 border-amber-300 shadow-md animate-fade-in-up">
                  <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-black bg-amber-200/90 text-amber-950 border border-amber-400 shadow-2xs">
                    <span>🎯</span>
                    <span>5대 핵심 절세 마스터 코스 100% 이수 완료</span>
                  </div>

                  <div className="text-5xl sm:text-6xl animate-bounce">🏆</div>
                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight break-keep">
                      축하합니다! 팩트체크 완주!
                    </h2>
                    <p className="text-neutral-700 font-medium text-sm sm:text-base break-keep leading-relaxed max-w-xl mx-auto">
                      설립자 Neo가 제작한 <strong className="text-brand-900 font-extrabold underline decoration-amber-400">[2026 직장인 3대 절세계좌 완벽 운용 치트시트 (A4 1장 PDF)]</strong>를 다운로드하여 실전에 활용하십시오.
                    </p>
                  </div>

                  {/* 🔒 End-Funnel Authentication Gate */}
                  {authenticated ? (
                    <div className="pt-2 space-y-3">
                      <div className="p-3.5 bg-emerald-100/90 text-emerald-950 border border-emerald-300 rounded-2xl text-xs sm:text-sm font-bold animate-fade-in-up">
                        🎉 5대 팩트체크 완주 및 로그인 인증 완료! 치트시트 수령 자격이 확인되었습니다.
                      </div>
                      <a
                        href="/downloads/2026_직장인_3대절세계좌_완벽운용_치트시트.pdf"
                        download="2026_직장인_3대절세계좌_완벽운용_치트시트.pdf"
                        className="block w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-4 sm:py-5 rounded-2xl shadow-lg transition-all text-base sm:text-lg text-center active:scale-[0.99] ring-2 ring-emerald-400/40 cursor-pointer"
                      >
                        🎁 [치트시트 수동 다운로드] 2026 직장인 3대 절세계좌 완벽 운용 치트시트 (PDF)
                      </a>
                      <p className="text-xs text-neutral-500 font-medium">
                        💡 브라우저 다운로드 차단 시 위의 버튼을 직접 탭하시면 즉시 다운로드됩니다.
                      </p>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handleResetQuiz}
                          className="text-xs text-neutral-400 hover:text-neutral-700 underline underline-offset-2 transition-colors cursor-pointer"
                        >
                          🔄 팩트체크 처음부터 다시 풀기
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 space-y-3">
                      <p className="text-xs sm:text-sm font-bold text-amber-900 bg-amber-100/80 border border-amber-200/80 p-3.5 rounded-2xl break-keep">
                        💡 5단계 완주를 축하합니다! 치트시트 PDF 다운로드는 무료 회원가입 후 로그인 시 즉시 제공됩니다.
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push(`/login?returnTo=${encodeURIComponent("/tutorial/?tab=quiz&download=auto")}`)}
                        className="w-full bg-gradient-to-r from-brand-700 via-brand-800 to-indigo-900 hover:from-brand-600 hover:to-indigo-800 text-white font-black py-4 sm:py-5 rounded-2xl shadow-lg transition-all text-base sm:text-lg active:scale-[0.99] cursor-pointer"
                      >
                        🔒 무료 회원가입하고 치트시트 PDF 받기 ➔
                      </button>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handleResetQuiz}
                          className="text-xs text-neutral-400 hover:text-neutral-700 underline underline-offset-2 transition-colors cursor-pointer"
                        >
                          🔄 팩트체크 처음부터 다시 풀기
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-6 bg-amber-50/90 rounded-2xl border border-amber-300 text-xs sm:text-sm font-bold text-amber-900 space-y-2">
                  <p>🎉 제5단계 정답을 맞추셨습니다!</p>
                  <p className="font-normal text-neutral-600">
                    단, 이전 단계(1~4단계) 중 다시 확인해야 할 문항이 있습니다. 상단의 단계 칩(01~04)을 눌러 모든 단계를 통과하시면 치트시트가 수여됩니다.
                  </p>
                </div>
              )
            ) : (
              /* Next Step Success Banner */
              <div className="pt-2 animate-fade-in-up">
                <button
                  type="button"
                  onClick={nextStep}
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-brand-700 via-brand-800 to-indigo-900 hover:from-brand-600 hover:to-indigo-800 text-white font-black py-4 sm:py-5 px-6 rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.99] transition-all text-base sm:text-lg cursor-pointer"
                >
                  <span>🎉 제{currentStep}단계 마스터 완료! 다음 제{currentStep + 1}단계로 이동</span>
                  <span aria-hidden="true">👉</span>
                </button>
              </div>
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
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.35s ease-out forwards; }
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
          🏛️ ETF 캠퍼스 팩트체크 불러오는 중...
        </div>
      }
    >
      <TutorialContent />
    </Suspense>
  );
}
