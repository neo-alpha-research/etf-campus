"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { tutorialSteps } from "@/data/tutorial-content";
import { useAuthSession } from "@/components/auth/use-auth-session";

export default function TutorialPage() {
  const { authenticated, isLoading, isValidating } = useAuthSession();
  const router = useRouter();
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAnswers(JSON.parse(savedAnswers));
      } catch (e) {
        // parsing error fallback
      }
    }

    const savedGraded = localStorage.getItem("tutorial_isGraded");
    if (savedGraded === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsGraded(true);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    
    const allAnswered = stepData.questions.every((q) => answers[q.id] !== undefined);
    if (!allAnswered) {
      alert("모든 미션을 완료(O/X 선택)해야 채점할 수 있습니다.");
      return;
    }

    const allCorrect = stepData.questions.every((q) => answers[q.id] === q.answer);
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
      const confirmSignup = window.confirm("🔒 [시스템] 레벨 4부터는 진행 데이터 저장을 위해 로그인(회원가입)이 필요합니다.\n\n로그인/회원가입 화면으로 이동하시겠습니까?");
      if (confirmSignup) {
        // 성공적으로 로그인 후 돌아오면 4단계부터 시작하도록 미리 세팅
        localStorage.setItem("tutorial_progress", "4");
        localStorage.removeItem("tutorial_answers");
        localStorage.removeItem("tutorial_isGraded");
        router.push("/login?returnTo=/tutorial"); 
      }
      return; // UI 진행 차단
    }

    setCurrentStep((prev) => Math.min(prev + 1, 10));
    setAnswers({});
    setIsGraded(false);
    setGradeError(false);
  };

  // 클라이언트 렌더링 전 깜빡임 방지 (hydration)
  if (!isLoaded || !stepData) return <div className="p-10 text-center text-gray-500 font-medium">데이터 불러오는 중...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 select-none">
      {/* 🎮 EXP Bar */}
      <div className="relative pt-1">
        <div className="flex mb-2 items-center justify-between">
          <div>
            <span className="text-sm font-bold inline-block py-1.5 px-3 uppercase rounded-full text-brand-600 bg-brand-100">
              레벨 {currentStep}
            </span>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold inline-block text-gray-500">
              EXP {currentStep * 10}%
            </span>
          </div>
        </div>
        <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-gray-200">
          <div
            style={{ width: `${(currentStep / 10) * 100}%` }}
            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-700"
          ></div>
        </div>
      </div>

      {/* 🎮 Header */}
      <div className="text-center space-y-3 pb-2">
        <h1 className="text-3xl font-black tracking-tight text-gray-900 break-keep">{stepData.title}</h1>
        <p className="text-base sm:text-lg font-medium text-gray-700 break-keep">
          {stepData.intro}
        </p>
      </div>

      {/* 🎮 Distinct Quiz Cards */}
      <div className="space-y-4">
        {stepData.questions.map((q, idx) => {
          const isSelectedO = answers[q.id] === true;
          const isSelectedX = answers[q.id] === false;
          const isAnswered = answers[q.id] !== undefined;

          // 상태별 스타일링 (안 푼 문제 강조, 푼 문제는 차분하게)
          const cardBg = isAnswered ? "bg-gray-50/70 border-gray-200 shadow-none" : "bg-white border-brand-200 shadow-sm ring-1 ring-brand-50/50";
          const textColor = isAnswered ? "text-gray-500" : "text-gray-900";
          const badgeStyle = isAnswered ? "bg-gray-200 text-gray-500" : "bg-brand-500 text-white shadow-sm";

          return (
            <div key={q.id} className={`p-4 sm:p-5 border-2 rounded-2xl transition-all duration-300 ${cardBg}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 flex items-start gap-3">
                  <span className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl font-black text-base mt-0.5 transition-colors ${badgeStyle}`}>
                    {isGraded ? "⭕" : `Q${idx + 1}`}
                  </span>
                  <div className="flex-1">
                    {!isGraded ? (
                      <p className={`font-bold text-base sm:text-lg leading-snug break-keep transition-colors mt-1.5 ${textColor}`}>
                        {q.text}
                      </p>
                    ) : (
                      <div className="animate-fade-in-up mt-1">
                        <p className="text-xs sm:text-sm text-gray-400 line-through mb-1 break-keep">{q.text}</p>
                        <p className="font-bold text-base sm:text-lg text-green-700 leading-snug break-keep">
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
                      onClick={() => handleAnswer(q.id, true)}
                      className={`w-16 h-12 rounded-xl font-black text-xl transition-all duration-200 ${
                        isSelectedO
                          ? "bg-blue-500 text-white shadow-inner scale-95 border-b-0 translate-y-1"
                          : "bg-white text-gray-400 border-2 border-b-4 border-gray-200 hover:border-blue-300 hover:text-blue-500 active:translate-y-1 active:border-b-2"
                      }`}
                    >
                      O
                    </button>
                    <button
                      onClick={() => handleAnswer(q.id, false)}
                      className={`w-16 h-12 rounded-xl font-black text-xl transition-all duration-200 ${
                        isSelectedX
                          ? "bg-red-500 text-white shadow-inner scale-95 border-b-0 translate-y-1"
                          : "bg-white text-gray-400 border-2 border-b-4 border-gray-200 hover:border-red-300 hover:text-red-500 active:translate-y-1 active:border-b-2"
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
          <div className={`space-y-3 transition-transform ${shake ? 'animate-shake' : ''}`}>
            <button
              onClick={handleGrade}
              className="w-full bg-gradient-to-b from-gray-800 to-gray-900 border-b-4 border-gray-950 text-white font-black py-4 sm:py-5 rounded-2xl hover:brightness-110 active:border-b-0 active:translate-y-1 transition-all shadow-lg text-lg tracking-wide"
            >
              🎯 채점하기
            </button>
            {gradeError && (
              <div className="text-center p-3 sm:p-4 bg-red-50 rounded-xl border border-red-200 text-red-600 text-base font-bold animate-pulse break-keep">
                💥 삐빅! 함정에 빠진 문제가 있습니다. 다시 확인하세요!
              </div>
            )}
          </div>
        ) : currentStep === 10 ? (
          <div className="text-center space-y-5 bg-gradient-to-br from-yellow-50 to-orange-50 p-8 rounded-3xl border-2 border-yellow-200 shadow-sm animate-fade-in-up">
            <div className="text-5xl animate-bounce">🏆</div>
            <div>
              <h2 className="text-3xl font-black text-yellow-800 tracking-tight break-keep">마스터 등극!</h2>
              <p className="text-yellow-700 font-medium text-base mt-2 break-keep">10개의 레벨을 모두 완벽히 클리어하셨습니다.</p>
            </div>
            <a
              href="/downloads/연금_ETF_핵심요약.pdf"
              download="연금_ETF_핵심요약.pdf"
              className="block w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-black py-5 rounded-2xl shadow-[0_4px_0_rgb(194,65,12)] hover:brightness-110 active:shadow-none active:translate-y-1 transition-all text-lg"
            >
              🎁 최종 보상: 연금 ETF 규정서 다운로드
            </a>
          </div>
        ) : (
          <button
            onClick={nextStep}
            className="w-full bg-gradient-to-b from-brand-500 to-brand-600 border-b-4 border-brand-700 text-white font-black py-4 sm:py-5 rounded-2xl hover:brightness-110 active:border-b-0 active:translate-y-1 transition-all shadow-lg text-lg tracking-wide animate-fade-in-up"
          >
            🎉 클리어! 다음 레벨로 이동 👉
          </button>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px) rotate(-1deg); }
          75% { transform: translateX(5px) rotate(1deg); }
        }
        .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
      `}} />
    </div>
  );
}
