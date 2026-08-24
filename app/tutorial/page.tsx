"use client";

import { useState } from "react";
import { tutorialSteps } from "@/data/tutorial-content";
import Link from "next/link";

export default function TutorialPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [isGraded, setIsGraded] = useState(false);
  const [gradeError, setGradeError] = useState(false);
  const [shake, setShake] = useState(false);

  const stepData = tutorialSteps.find((s) => s.step === currentStep);

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
    if (currentStep === 3) {
      alert("🔒 [시스템] 진행 데이터 저장을 위해 이메일 연동(가입)이 필요합니다!");
    }
    setCurrentStep((prev) => Math.min(prev + 1, 10));
    setAnswers({});
    setIsGraded(false);
    setGradeError(false);
  };

  if (!stepData) return <div>Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 select-none">
      {/* 🎮 EXP Bar */}
      <div className="relative pt-1">
        <div className="flex mb-2 items-center justify-between">
          <div>
            <span className="text-sm font-bold inline-block py-1.5 px-3 uppercase rounded-full text-brand-600 bg-brand-100">
              LV.{currentStep} 퀘스트
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

      {/* 🎮 Compact Quiz List - Larger Fonts */}
      <div className="bg-white border-2 border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {stepData.questions.map((q, idx) => {
            const isSelectedO = answers[q.id] === true;
            const isSelectedX = answers[q.id] === false;

            return (
              <div key={q.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex-1">
                  <p className="font-bold text-base sm:text-lg text-gray-800 leading-snug flex items-start gap-2 break-keep">
                    <span className="text-brand-500 font-black">Q{idx + 1}.</span>
                    {q.text}
                  </p>
                  
                  {isGraded && (
                    <div className="mt-3 text-sm sm:text-base font-semibold text-green-700 bg-green-50 p-3 rounded-lg border border-green-100 break-keep">
                      💡 {q.correctFeedback.replace("정답입니다! ", "")}
                    </div>
                  )}
                </div>

                {/* Game-like Toggle Buttons - Larger */}
                <div className="flex shrink-0 gap-3 sm:self-center self-end">
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
              </div>
            );
          })}
        </div>
      </div>

      {/* 🎮 Grading & Action Area */}
      <div className="pt-2">
        {!isGraded ? (
          <div className={`space-y-3 transition-transform ${shake ? 'animate-shake' : ''}`}>
            <button
              onClick={handleGrade}
              className="w-full bg-gradient-to-b from-gray-800 to-gray-900 border-b-4 border-gray-950 text-white font-black py-4 sm:py-5 rounded-2xl hover:brightness-110 active:border-b-0 active:translate-y-1 transition-all shadow-lg text-lg tracking-wide"
            >
              🎯 퀘스트 채점하기
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
              <p className="text-yellow-700 font-medium text-base mt-2 break-keep">10개의 퀘스트를 모두 완벽히 클리어하셨습니다.</p>
            </div>
            <a
              href="/downloads/연금_ETF_핵심요약.md"
              download="연금_ETF_핵심요약.md"
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
            🎉 클리어! 다음 퀘스트로 이동 👉
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
