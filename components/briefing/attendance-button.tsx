"use client";

import { useState, useEffect } from "react";
import { getSession } from "@/lib/auth/client";

export function AttendanceCheckButton({ briefingDate }: { briefingDate: string }) {
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if today matches the briefing date (briefingDate is YYYY-MM-DD string)
  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = briefingDate === todayStr;

  useEffect(() => {
    async function init() {
      const session = await getSession();
      setIsAuthenticated(session.authenticated);

      if (session.authenticated) {
        // Here we could check DB if already attended
        // For MVP, we can just use localStorage to fake it or rely on a simple check
        const attended = localStorage.getItem(`attendance_${briefingDate}`);
        if (attended) {
          setIsChecked(true);
        }
      }
    }
    init();
  }, [briefingDate]);

  const handleAttend = async () => {
    if (!isAuthenticated) {
      alert("로그인이 필요합니다.");
      return;
    }
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      localStorage.setItem(`attendance_${briefingDate}`, "true");
      setIsChecked(true);
      setIsLoading(false);
    }, 500);
  };

  if (!isToday && !isChecked) {
    return (
      <div className="mt-12 flex justify-center">
        <button
          disabled
          className="rounded-full bg-neutral-200 px-8 py-3 text-sm font-extrabold text-neutral-400 cursor-not-allowed"
        >
          마감된 출석입니다
        </button>
      </div>
    );
  }

  return (
    <div className="mt-12 flex flex-col items-center gap-3 border-t border-line pt-8">
      <p className="text-sm font-bold text-brand-800">
        오늘의 교양 뉴스를 다 읽으셨나요?
      </p>
      <button
        onClick={handleAttend}
        disabled={isChecked || isLoading}
        className={`rounded-full px-8 py-3 text-sm font-extrabold transition-all ${
          isChecked
            ? "bg-brand-50 text-brand-700 border border-brand-200 cursor-default"
            : "bg-brand-700 text-white hover:bg-brand-800 shadow-md hover:shadow-lg cursor-pointer"
        }`}
      >
        {isLoading
          ? "처리 중..."
          : isChecked
          ? "✅ 오늘의 출석 완료 (+1학점)"
          : "오늘의 출석 체크 (+1학점)"}
      </button>
    </div>
  );
}
