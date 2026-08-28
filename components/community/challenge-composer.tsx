"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { CommunityAuthDialog } from "@/components/community/community-auth-dialog";
import { communityFetch, getCommunitySession, refreshCommunitySession } from "@/lib/community/browser-client";

// Placeholder for the 30-day tasks since the original file was missing
const CHALLENGE_TASKS: Record<number, { task: string, metricLabel: string }> = {
  1: { task: "연금 계좌(DC, IRP 등)에서 매수 가능한 ETF 목록을 확인해 보셨나요? 어떤 점이 가장 어려웠는지 남겨주세요.", metricLabel: "보유 현금 비중(%)" },
  // 2~30 will fallback to a default
};

function getTaskForDay(day: number) {
  return CHALLENGE_TASKS[day] ?? { 
    task: `[Day ${day}] 오늘의 과제가 아직 시스템에 등록되지 않았습니다. 자유롭게 오늘의 ETF 학습 내용을 기록해 주세요. (추후 과제 원문 업데이트 필요)`, 
    metricLabel: "오늘의 숫자" 
  };
}

interface CohortItem {
  id: string;
  title: string;
  name?: string;
  status: string;
  starts_on?: string;
}

export function ChallengeComposer() {
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [bodyText, setBodyText] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [visibility, setVisibility] = useState<"cohort" | "public">("cohort");
  
  const [signedIn, setSignedIn] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [cohorts, setCohorts] = useState<CohortItem[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");

  useEffect(() => {
    refreshCommunitySession().then(setSignedIn);
    
    // 복원 로직
    const saved = localStorage.getItem("challenge_write_prefs");
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        if (prefs.visibility) setTimeout(() => setVisibility(prefs.visibility), 0);
      } catch {}
    }

    // 기수 목록 불러오기 (시작일 기반 Day 자동 계산용)
    fetch("/api/community/challenges")
      .then(r => r.ok ? r.json() : { cohorts: [] })
      .then(result => {
        const activeCohorts = ((result.cohorts as CohortItem[]) ?? []).filter((c) => c.status === "active" || c.status === "recruiting");
        setCohorts(activeCohorts);
        if (activeCohorts.length > 0) {
          setSelectedCohortId(activeCohorts[0].id);
          
          // Day 자동 계산 로직
          const start = new Date(activeCohorts[0].starts_on + "T00:00:00");
          const now = new Date();
          const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          setDayNumber(Math.max(1, Math.min(diffDays, 30)));
        }
      });
  }, []);

  const currentTask = useMemo(() => getTaskForDay(dayNumber), [dayNumber]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (bodyText.includes("만원") || bodyText.includes("억") || bodyText.includes("천원")) {
      if (!window.confirm("본문에 금액(만원, 억 등)이 포함되어 있습니다. 특정 금액이나 수익률보다는 비율(%)이나 기준을 중점으로 작성하는 것을 권장합니다. 이대로 등록할까요?")) {
        return;
      }
    }

    if (!getCommunitySession() && !(await refreshCommunitySession())) {
      setMessage("이메일 인증 후 등록할 수 있습니다.");
      setAuthOpen(true);
      return;
    }
    
    setLoading(true);
    setMessage("");

    try {
      const payload = {
        categorySlug: "challenge-30",
        title: `${dayNumber}일차 기록`, // 백엔드 검증을 위해 임의 제목
        bodyText,
        challengeDayNumber: dayNumber,
        challengeCohortId: selectedCohortId || undefined,
        challengeVisibility: visibility,
        ...(metricValue && {
          challengeMetricKey: "learning_note", // Default whitelist key
          challengeMetricValue: parseInt(metricValue, 10)
        })
      };

      const result = await communityFetch("/api/community/posts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // 설정 저장
      localStorage.setItem("challenge_write_prefs", JSON.stringify({ visibility }));
      
      window.location.assign(`/community/read/?slug=${encodeURIComponent(result.post.slug)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시물을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell py-7 sm:py-10">
      <Link href="/community/challenge" className="text-sm font-bold text-brand-700 hover:underline">← 챌린지 홈으로</Link>
      <section className="mt-5 max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-700">DAY {dayNumber}</p>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-950">오늘의 학습 기록하기</h1>
        
        <form onSubmit={submit} className="mt-6 space-y-6">
          
          <div className="flex gap-4">
            <label className="block flex-1 text-sm font-bold text-slate-800">진행 기수
              <select value={selectedCohortId} onChange={e => setSelectedCohortId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none">
                {cohorts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className="block w-24 text-sm font-bold text-slate-800">Day
              <input type="number" min={1} max={30} value={dayNumber} onChange={e => setDayNumber(parseInt(e.target.value) || 1)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none text-center" />
            </label>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
            <p className="text-sm font-bold text-brand-950">오늘의 과제</p>
            <p className="mt-1 text-sm leading-6 text-brand-900">{currentTask.task}</p>
          </div>

          <label className="block text-sm font-bold text-slate-800">본문 <span className="font-normal text-rose-600">(필수)</span>
            <textarea value={bodyText} onChange={(event) => setBodyText(event.target.value)} minLength={30} maxLength={1000} required rows={8} className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-base leading-7 outline-none focus:border-brand-600" placeholder={`오늘 확인한 내용을 편하게 적어주세요.\n[저자 시드 기록 보기] (링크 추후 삽입 예정)`} />
          </label>

          <label className="block text-sm font-bold text-slate-800">{currentTask.metricLabel} <span className="font-normal text-slate-500">(선택)</span>
            <input type="number" min={0} max={10} value={metricValue} onChange={e => setMetricValue(e.target.value)} placeholder="0~10 사이 정수" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none" />
          </label>
          <p className="text-xs text-slate-500">※ 절대금액(원) 단위는 입력할 수 없습니다. 필요한 경우 본문에 작성해 주세요.</p>

          <label className="block text-sm font-bold text-slate-800">공개 범위
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="visibility" value="cohort" checked={visibility === "cohort"} onChange={() => setVisibility("cohort")} />
                같은 기수에게만 공개
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="visibility" value="public" checked={visibility === "public"} onChange={() => setVisibility("public")} />
                전체 공개
              </label>
            </div>
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-4">
            <Link href="/community/challenge" className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700">취소</Link>
            <button disabled={loading} className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? "등록 중…" : signedIn ? "기록 등록" : "로그인 후 등록"}</button>
          </div>
        </form>
        {message ? <p role="status" className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
      </section>
      <CommunityAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => { setSignedIn(true); setAuthOpen(false); }} />
    </div>
  );
}
