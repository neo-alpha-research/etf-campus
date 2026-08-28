"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { tutorialSteps } from "@/data/tutorial-content";
import { useAuthSession } from "@/components/auth/use-auth-session";
import { ProfessorHero } from "@/components/tutorial/professor-hero";
import { CampusTour } from "@/components/tutorial/campus-tour";

function TutorialContent() {
  const { authenticated, isLoading, isValidating } = useAuthSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"tour" | "quiz">(() => {
    return searchParams.get("tab") === "quiz" ? "quiz" : "tour";
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [isGraded, setIsGraded] = useState(false);
  const [gradeError, setGradeError] = useState(false);
  const [shake, setShake] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

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

  // 진행 상태가 바뀔 때마다 로컬스토리지에 저장
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("tutorial_progress", currentStep.toString());
      localStorage.setItem("tutorial_answers", JSON.stringify(answers));
      localStorage.setItem("tutorial_isGraded", isGraded.toString());
    }
  }, [currentStep, answers, isGraded, isLoaded]);

  const handleAnswer = (questionId: string, answer: boolean) => {
    if (isGraded) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setGradeError(false);
  };

  const handleGrade = () => {
    if (!stepData) return;

    const allAnswered = stepData.questions.every(
      (q) => answers[q.id] !== undefined
    );
    if (!allAnswered) {
      alert("모든 문항을 선택(O/X)해야 채점할 수 있습니다.");
      return;
    }

    const allCorrect = stepData.questions.every(
      (q) => answers[q.id] === q.answer
    );
    if (allCorrect) {
      setIsGraded(true);
      setGradeError(false);
    } else {
      setGradeError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const nextStep = () => {
    // 3단계 완료 후 미로그인 상태라면 강제 로그인/회원가입 유도
    if (currentStep === 3 && !authenticated) {
      const confirmSignup = window.confirm(
        "🔒 [학사 행정 안내] 4강부터는 나의 학습 데이터 보존을 위해 학생 등록(로그인/회원가입)이 필요합니다.\n\n로그인/회원가입 화면으로 이동하시겠습니까?"
      );
      if (confirmSignup) {
        // 성공적으로 로그인 후 돌아오면 4단계부터 시작하도록 미리 세팅
        localStorage.setItem("tutorial_progress", "4");
        localStorage.removeItem("tutorial_answers");
        localStorage.removeItem("tutorial_isGraded");
        router.push("/login?returnTo=/tutorial?tab=quiz");
      }
      return; // UI 진행 차단
    }

    setCurrentStep((prev) => Math.min(prev + 1, 10));
    setAnswers({});
    setIsGraded(false);
    setGradeError(false);
  };

  // 클라이언트 렌더링 전 깜빡임 방지 (hydration)
  if (!isLoaded || !stepData) {
    return (
      <div className="p-16 text-center text-muted font-medium animate-pulse">
        🏛️ ETF 캠퍼스 신입생 오리엔테이션 자료 불러오는 중...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8 select-none">
      {/* 🦉 Professor Owl Hero Section */}
      <ProfessorHero
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        quizProgress={currentStep}
      />

      {/* Tab 1: Campus Tour (6 Facilities) */}
      {activeTab === "tour" && (
        <CampusTour
          onStartQuiz={() => {
            setActiveTab("quiz");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {/* Tab 2: 10-Lesson Orientation Quiz */}
      {activeTab === "quiz" && (
        <div className="space-y-6 animate-fade-in-up">
          {/* 🎮 EXP Bar & Academic Progress */}
          <div className="relative pt-1">
            <div className="flex mb-2 items-end justify-between">
              <div className="mb-0.5">
                <span className="text-xs sm:text-sm font-extrabold inline-flex items-center gap-1 py-1 px-3 rounded-full text-brand-700 bg-brand-100 border border-brand-200">
                  <span>📖</span> 제{currentStep}강 이수 중
                </span>
              </div>
              <div className="text-right flex flex-col items-end">
                {!(currentStep === 10 && isGraded) && (
                  <span className="text-[10px] sm:text-[11px] font-semibold text-amber-700 mb-1">
                    🎁 10강 완주 시 <span className="underline underline-offset-2">체크리스트 PDF</span> 수여!
                  </span>
                )}
                <span className="text-xs sm:text-sm font-extrabold inline-block text-muted">
                  학사 진도율 {currentStep * 10}%
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

          {/* 🎮 Lesson Header & Professor Owl Tip */}
          <div className="rounded-3xl border border-brand-200/80 bg-surface p-6 sm:p-8 space-y-3 shadow-sm text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-brand-50 text-brand-700 border border-brand-200/60">
              <span>제 {currentStep}강</span>
              <span className="text-neutral-300">|</span>
              <span>신입생 필수 기초 소양</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-strong break-keep">
              {stepData.title}
            </h2>
            <div className="relative rounded-2xl bg-brand-50/70 p-4 border border-brand-100/80 text-left">
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 text-base">🦉</span>
                <p className="text-xs sm:text-sm font-medium text-brand-900 break-keep leading-relaxed italic">
                  &ldquo;{stepData.intro}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* 🎮 Distinct Quiz Cards */}
          <div className="space-y-4">
            {stepData.questions.map((q, idx) => {
              const isSelectedO = answers[q.id] === true;
              const isSelectedX = answers[q.id] === false;
              const isAnswered = answers[q.id] !== undefined;

              const cardBg = isAnswered
                ? "bg-neutral-50/80 border-neutral-200 shadow-none"
                : "bg-surface border-brand-200 shadow-sm ring-1 ring-brand-50";
              const textColor = isAnswered ? "text-muted" : "text-strong";
              const badgeStyle = isAnswered
                ? "bg-neutral-200 text-muted"
                : "bg-brand-700 text-white shadow-2xs";

              return (
                <div
                  key={q.id}
                  className={`p-4 sm:p-5 border-2 rounded-2xl transition-all duration-300 ${cardBg}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 flex items-start gap-3">
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl font-black text-base mt-0.5 transition-colors ${badgeStyle}`}
                      >
                        {isGraded ? "⭕" : `Q${idx + 1}`}
                      </span>
                      <div className="flex-1">
                        {!isGraded ? (
                          <p
                            className={`font-bold text-base sm:text-lg leading-snug break-keep transition-colors mt-1.5 ${textColor}`}
                          >
                            {q.text}
                          </p>
                        ) : (
                          <div className="animate-fade-in-up mt-1">
                            <p className="text-xs sm:text-sm text-neutral-400 line-through mb-1 break-keep">
                              {q.text}
                            </p>
                            <p className="font-bold text-base sm:text-lg text-emerald-700 leading-snug break-keep">
                              💡 {q.correctFeedback.replace("정답입니다! ", "")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Game-like Toggle Buttons (Hidden when graded) */}
                    {!isGraded && (
                      <div className="flex shrink-0 gap-3 sm:self-center self-end pl-12 sm:pl-0">
                        <button
                          type="button"
                          onClick={() => handleAnswer(q.id, true)}
                          className={`w-16 h-12 rounded-xl font-black text-xl transition-all duration-200 ${
                            isSelectedO
                              ? "bg-blue-600 text-white shadow-inner scale-95 border-b-0 translate-y-1"
                              : "bg-surface text-neutral-400 border-2 border-b-4 border-neutral-200 hover:border-blue-300 hover:text-blue-600 active:translate-y-1 active:border-b-2"
                          }`}
                        >
                          O
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnswer(q.id, false)}
                          className={`w-16 h-12 rounded-xl font-black text-xl transition-all duration-200 ${
                            isSelectedX
                              ? "bg-red-600 text-white shadow-inner scale-95 border-b-0 translate-y-1"
                              : "bg-surface text-neutral-400 border-2 border-b-4 border-neutral-200 hover:border-red-300 hover:text-red-600 active:translate-y-1 active:border-b-2"
                          }`}
                        >
                          X
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 🎮 Grading & Action Area */}
          <div className="pt-4">
            {!isGraded ? (
              <div
                className={`space-y-3 transition-transform ${
                  shake ? "animate-shake" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={handleGrade}
                  className="w-full bg-gradient-to-b from-neutral-800 to-neutral-950 border-b-4 border-black text-white font-black py-4 sm:py-5 rounded-2xl hover:brightness-110 active:border-b-0 active:translate-y-1 transition-all shadow-lg text-lg tracking-wide"
                >
                  🎯 채점하고 해설 확인하기
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
                    축하합니다! 신입생 필수 10강 수료 완료!
                  </h2>
                  <p className="text-amber-800 font-medium text-base mt-2 break-keep">
                    부엉이 교수님이 수여하는 [연금 ETF 운용 체크리스트]를 다운로드하여 실전에 활용해 보십시오.
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
                🎉 {currentStep}강 통과! 다음 제{currentStep + 1}강으로 이동 👉
              </button>
            )}
          </div>
        </div>
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
