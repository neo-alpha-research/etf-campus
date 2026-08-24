"use client";

import { useState } from "react";
import { tutorialSteps } from "@/data/tutorial-content";
import Link from "next/link";

export default function TutorialPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [isGraded, setIsGraded] = useState(false);
  const [gradeError, setGradeError] = useState(false);

  const stepData = tutorialSteps.find((s) => s.step === currentStep);

  const handleAnswer = (questionId: string, answer: boolean) => {
    // Prevent changing answers after successful grading
    if (isGraded) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setGradeError(false); // Hide error if user is changing an answer
  };

  const handleGrade = () => {
    if (!stepData) return;
    
    // Check if all questions are answered
    const allAnswered = stepData.questions.every((q) => answers[q.id] !== undefined);
    if (!allAnswered) {
      alert("모든 문제의 O/X를 선택해 주세요.");
      return;
    }

    // Check if all are correct
    const allCorrect = stepData.questions.every((q) => answers[q.id] === q.answer);
    if (allCorrect) {
      setIsGraded(true);
      setGradeError(false);
    } else {
      setGradeError(true);
    }
  };

  const nextStep = () => {
    if (currentStep === 3) {
      alert("진도 저장을 위해 이메일 가입이 필요합니다! (가입 게이트 시뮬레이션)");
    }
    setCurrentStep((prev) => Math.min(prev + 1, 10));
    setAnswers({});
    setIsGraded(false);
    setGradeError(false);
  };

  if (!stepData) return <div>Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-brand-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${(currentStep / 10) * 100}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500 font-bold tracking-wide">Step {currentStep} / 10</p>

      {/* Header - Compacted */}
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{stepData.title}</h1>
        <p className="text-sm text-gray-700 bg-brand-50/50 p-3 rounded-md border-l-4 border-brand-500">
          {stepData.intro}
        </p>
      </div>

      {/* Questions - Compacted */}
      <div className="space-y-3">
        {stepData.questions.map((q, idx) => {
          const isSelectedO = answers[q.id] === true;
          const isSelectedX = answers[q.id] === false;

          return (
            <div key={q.id} className="p-3 border rounded-lg shadow-sm bg-white transition-colors hover:border-gray-300">
              <p className="font-semibold text-sm text-gray-800 mb-3 leading-snug">
                <span className="text-brand-600 mr-1">Q{idx + 1}.</span> {q.text}
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleAnswer(q.id, true)}
                  className={`flex-1 py-1.5 rounded-md font-bold text-sm transition-colors border ${
                    isSelectedO
                      ? "bg-brand-600 border-brand-600 text-white"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  O
                </button>
                <button
                  onClick={() => handleAnswer(q.id, false)}
                  className={`flex-1 py-1.5 rounded-md font-bold text-sm transition-colors border ${
                    isSelectedX
                      ? "bg-red-500 border-red-500 text-white"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  X
                </button>
              </div>

              {/* Feedback only shows when successfully graded */}
              {isGraded && (
                <div className="mt-3 p-2 rounded bg-green-50 text-xs text-green-800 border border-green-100">
                  <span className="font-bold mr-1">⭕ 정답입니다!</span> 
                  {q.correctFeedback.replace("정답입니다! ", "")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Area */}
      <div className="pt-4 border-t">
        {!isGraded ? (
          <div className="space-y-3">
            <button
              onClick={handleGrade}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition shadow-sm text-sm"
            >
              채점하기
            </button>
            {gradeError && (
              <p className="text-center text-red-500 text-sm font-bold animate-pulse">
                ❌ 오답이 포함되어 있습니다. 정답을 수정하고 다시 채점해 보세요!
              </p>
            )}
          </div>
        ) : currentStep === 10 ? (
          <div className="text-center space-y-4 bg-yellow-50 p-6 rounded-xl border border-yellow-200">
            <h2 className="text-xl font-bold text-yellow-700">🎉 축하합니다! 10단계를 모두 완주하셨습니다!</h2>
            <a
              href="/downloads/연금_ETF_핵심요약.md"
              download="연금_ETF_핵심요약.md"
              className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-3 px-6 rounded-full shadow-md hover:scale-105 transition-transform text-sm"
            >
              📄 연금 ETF 핵심 Summary 다운로드
            </a>
          </div>
        ) : (
          <button
            onClick={nextStep}
            className="w-full bg-brand-600 text-white font-bold py-3 rounded-lg hover:bg-brand-700 transition shadow-md text-sm"
          >
            모두 맞혔습니다! 다음 단계로 넘어가기 👉
          </button>
        )}
      </div>
    </div>
  );
}
