"use client";

import { useState } from "react";
import { tutorialSteps } from "@/data/tutorial-content";
import Link from "next/link";

export default function TutorialPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [showFeedback, setShowFeedback] = useState<Record<string, boolean>>({});

  const stepData = tutorialSteps.find((s) => s.step === currentStep);

  const handleAnswer = (questionId: string, answer: boolean) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setShowFeedback((prev) => ({ ...prev, [questionId]: true }));
  };

  const isStepComplete = stepData?.questions.every(
    (q) => answers[q.id] === q.answer
  );

  const nextStep = () => {
    if (currentStep === 3) {
      // Simulate Email Signup Gate
      alert("진행 상황을 저장하기 위해 이메일 가입이 필요합니다!");
      // In a real app, open a modal or redirect to signup
    }
    setCurrentStep((prev) => Math.min(prev + 1, 10));
  };

  if (!stepData) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full"
          style={{ width: `${(currentStep / 10) * 100}%` }}
        ></div>
      </div>
      <p className="text-sm text-gray-500 font-bold">Step {currentStep} / 10</p>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{stepData.title}</h1>
        <p className="text-gray-700 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
          {stepData.intro}
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {stepData.questions.map((q, idx) => {
          const isCorrect = answers[q.id] === q.answer;
          const hasAnswered = answers[q.id] !== undefined;

          return (
            <div key={q.id} className="p-4 border rounded-lg shadow-sm bg-white">
              <p className="font-semibold mb-4">
                Q{idx + 1}. {q.text}
              </p>
              <div className="flex space-x-4 mb-4">
                <button
                  onClick={() => handleAnswer(q.id, true)}
                  className={`px-6 py-2 rounded-lg font-bold ${
                    answers[q.id] === true
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  O
                </button>
                <button
                  onClick={() => handleAnswer(q.id, false)}
                  className={`px-6 py-2 rounded-lg font-bold ${
                    answers[q.id] === false
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  X
                </button>
              </div>

              {/* Feedback */}
              {showFeedback[q.id] && (
                <div
                  className={`p-3 rounded-md text-sm ${
                    isCorrect
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {isCorrect ? "⭕ " + q.correctFeedback : "❌ " + q.incorrectFeedback}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Next Step Action */}
      <div className="pt-6 border-t">
        {isStepComplete ? (
          currentStep === 10 ? (
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-green-600">🎉 축하합니다! 모든 과정을 마쳤습니다.</h2>
              <a
                href="/downloads/leadmagnet.pdf"
                download="연금_ETF_핵심요약.pdf"
                className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:scale-105 transition-transform"
              >
                📄 연금 ETF 핵심 Summary PDF 다운로드
              </a>
            </div>
          ) : (
            <button
              onClick={nextStep}
              className="w-full bg-black text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition"
            >
              모두 맞혔습니다! 다음 단계로 넘어가기 👉
            </button>
          )
        ) : (
          <p className="text-center text-gray-500 text-sm">
            3문제를 모두 맞혀야 다음 스텝이 열립니다. (틀리면 다시 풀 수 있습니다)
          </p>
        )}
      </div>
    </div>
  );
}
