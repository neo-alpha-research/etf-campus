"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from "react";
import { CommunityAuthDialog } from "@/components/community/community-auth-dialog";
import { communityFetch, getCommunitySession, refreshCommunitySession } from "@/lib/community/browser-client";

type Cohort = {
  slug: string;
  title: string;
  description: string;
  status: "recruiting" | "locked" | "active" | "grace_review" | "completed";
  capacity: number | null;
  starts_on: string;
  ends_on: string;
};

type PublicRecord = {
  public_id: string;
  day_number: number;
  metric_key: string;
  metric_value: number;
  note: string | null;
  author_nickname: string;
  created_at: string;
};

const topics = [
  { value: "cost_comparison", label: "ETF 비용 비교 기준 정리" },
  { value: "distribution_notice", label: "분배금·공시 읽기" },
  { value: "pension_account", label: "연금 계좌 ETF 판단 기준 점검" },
  { value: "risk_check", label: "위험·구조 확인 기준 점검" },
  { value: "weekly_learning", label: "주간 학습 기록 유지" },
] as const;

const metricLabels: Record<string, string> = {
  study_checkin: "학습 기록",
  source_review: "출처 확인",
  criteria_check: "판단 기준 점검",
  learning_note: "학습 메모",
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function CommunityChallenge() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [records, setRecords] = useState<PublicRecord[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [interestAccountType, setInterestAccountType] = useState("none");
  const [goalNote, setGoalNote] = useState("");
  const [consented, setConsented] = useState(false);

  const selected = useMemo(() => cohorts.find((cohort) => cohort.slug === selectedSlug) ?? null, [cohorts, selectedSlug]);

  useEffect(() => {
    refreshCommunitySession().then(setSignedIn);
    fetch("/api/community/challenges")
      .then(async (response) => {
        if (!response.ok) throw new Error("챌린지 기수를 불러오지 못했습니다.");
        return response.json();
      })
      .then((result) => {
        const next = result.cohorts ?? [];
        setCohorts(next);
        setSelectedSlug(next[0]?.slug ?? "");
      })
      .catch(() => setMessage("챌린지 기수를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSlug) {
      setTimeout(() => setRecords([]), 0);
      return;
    }
    fetch(`/api/community/posts?category=challenge-30`)
      .then(async (response) => {
        if (!response.ok) throw new Error("공개 학습 기록을 불러오지 못했습니다.");
        return response.json();
      })
      .then((result) => setRecords(result.posts ?? []))
      .catch(() => setMessage("공개 학습 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."));
  }, [selectedSlug]);

  async function apply() {
    if (!selected) return;
    if (!getCommunitySession()) {
      setAuthOpen(true);
      return;
    }
    if (!consented) {
      setMessage("매일 기록 동의가 있어야 참가 신청할 수 있습니다.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      await communityFetch("/api/community/challenges", {
        method: "POST",
        body: JSON.stringify({
          cohortSlug: selected.slug,
          interestAccountType,
          goalNote,
          privateRecordConsentVersion: "challenge-private-record-v2",
          agreedToDailyRecord: consented
        }),
      });
      setMessage("참가 신청을 접수했습니다. 운영자가 기수를 시작하면 비공개 학습 기록을 남길 수 있습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "참가 신청을 처리하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function support(publicId: string) {
    if (!getCommunitySession()) {
      setAuthOpen(true);
      return;
    }
    try {
      await communityFetch(`/api/community/challenges/records/${encodeURIComponent(publicId)}/support`, { method: "POST", body: JSON.stringify({}) });
      setMessage("응원을 남겼습니다. 응원 수는 순위나 인기 지표로 사용하지 않습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "응원을 남기지 못했습니다.");
    }
  }

  return (
    <main className="page-shell py-7 sm:py-10">
      <section className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white px-5 py-7 shadow-sm sm:px-8 sm:py-10">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-700">ETF CAMPUS · 30-DAY LEARNING</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">30일 동안 ETF 판단 기준을 기록합니다</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">수익률·자산·매매 경쟁이 아닌 비용, 공시, 위험, 연금 계좌의 판단 기준을 학습하는 소규모 챌린지입니다. 내 기록은 기본 비공개이며, 공개를 직접 선택한 기록만 다른 이용자에게 보입니다.</p>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">기수 선택 및 참가 신청</h2>
          {loading ? <p className="mt-3 text-sm text-slate-500">기수를 불러오는 중입니다.</p> : null}
          {!loading && cohorts.length === 0 ? <p className="mt-3 text-sm leading-6 text-slate-600">현재 모집 중이거나 공개된 기수가 없습니다. 다음 파일럿 기수 공지를 기다려 주세요.</p> : null}
          {cohorts.length > 0 ? <div className="mt-4 space-y-2">{cohorts.map((cohort) => <button type="button" key={cohort.slug} onClick={() => setSelectedSlug(cohort.slug)} className={`w-full rounded-xl border p-4 text-left ${selectedSlug === cohort.slug ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-brand-200"}`}><span className="text-xs font-bold text-brand-700">{cohort.status === "recruiting" ? "모집 중" : cohort.status === "active" ? "진행 중" : "기수 안내"}</span><strong className="mt-1 block text-slate-950">{cohort.title}</strong><span className="mt-1 block text-sm text-slate-600">{displayDate(cohort.starts_on)} ~ {displayDate(cohort.ends_on)}</span></button>)}</div> : null}

          {selected?.status === "recruiting" ? <form className="mt-5 border-t border-slate-100 pt-5" onSubmit={(event) => { event.preventDefault(); void apply(); }}>
            <p className="text-sm font-bold text-slate-900">{selected.title} 참가 신청</p>
            <label className="mt-3 block text-sm font-medium text-slate-700">퇴직연금 유형 <span className="font-normal text-rose-600">(필수)</span>
              <select required value={interestAccountType} onChange={(event) => setInterestAccountType(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                <option value="none">해당 없음</option>
                <option value="dc">DC</option>
                <option value="irp">IRP</option>
                <option value="both">둘 다</option>
                <option value="unknown">모름</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium text-slate-700">참여 목표 <span className="font-normal text-rose-600">(필수)</span>
              <textarea required value={goalNote} onChange={(event) => setGoalNote(event.target.value)} placeholder="한 문장으로 적어주세요." maxLength={240} rows={2} className="mt-1 w-full resize-y rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <label className="mt-3 flex gap-2 text-sm leading-5 text-slate-700">
              <input type="checkbox" required checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-1" />
              <span>30일간 매일 기록 가능하며 비공개 학습 기록 저장에 동의합니다.</span>
            </label>
            
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
              <strong>도서 관련 안내:</strong> 2편과 3편은 현재 집필 중이며 출간 시기가 확정되지 않았습니다. 출간 시점에 완주자에게 무료로 제공되며, 신청 시 이 점에 동의한 것으로 봅니다.
            </p>

            <button disabled={submitting} className="mt-4 w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "신청 중…" : signedIn ? "참가 신청" : "로그인 후 참가 신청"}</button>
          </form> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">공개 학습 기록</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">전체 공개를 선택한 비금전 학습 기록만 표시합니다. 응원 수는 순위나 인기 지표로 사용하지 않습니다.</p>
          <div className="mt-4 space-y-3">{records.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">아직 공개된 학습 기록이 없습니다.</p> : records.map((post: any) => <article key={post.slug} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-brand-700">{post.challengeDayNumber}일차 · {metricLabels[post.challengeMetricKey] ?? "학습 기록"}</p><Link href={`/community/read/?slug=${encodeURIComponent(post.slug)}`} className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-800 hover:bg-brand-50">자세히 보기</Link></div><p className="mt-2 text-sm leading-6 text-slate-700 line-clamp-3">{post.bodyText || post.excerpt || "학습 기록을 남겼습니다."}</p><p className="mt-3 text-xs text-slate-500">{post.authorNickname}</p></article>)}</div>
        </div>
      </section>

      {message ? <p role="status" className="mt-5 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{message}</p> : null}
      <CommunityAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => { setSignedIn(true); setAuthOpen(false); }} />
    </main>
  );
}
