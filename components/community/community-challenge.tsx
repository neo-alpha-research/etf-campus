 
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
  slug: string;
  challengeDayNumber?: number;
  challengeMetricKey?: string;
  metric_key?: string;
  metric_value?: number;
  note?: string | null;
  bodyText?: string;
  excerpt?: string;
  authorNickname?: string;
  author_nickname?: string;
  createdAt?: string;
  created_at?: string;
};

const metricLabels: Record<string, string> = {
  study_checkin: "학습 기록",
  source_review: "출처 확인",
  criteria_check: "판단 기준 점검",
  learning_note: "학습 메모",
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function CommunityChallenge({ embedded = false }: { embedded?: boolean } = {}) {
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
    refreshCommunitySession().then((isValid) => {
      setSignedIn(isValid);
      if (isValid) {
        communityFetch("/api/community/auth/profile").then((profileRes) => {
          if (profileRes?.profile?.interestAccountType) {
            setInterestAccountType(profileRes.profile.interestAccountType);
          }
        }).catch(() => {});
      }
    });
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

  const content = (
    <>
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-700">ETF CAMPUS · 30-DAY LEARNING</p>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
            ⏳ 서비스 준비 중
          </span>
        </div>
        <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-strong">
          30일 동안 ETF 판단 기준을 기록합니다
        </h1>
        <p className="mt-2 max-w-3xl text-xs sm:text-sm leading-relaxed text-neutral-600">
          수익률·자산·매매 경쟁이 아닌 비용, 공시, 위험, 연금 계좌의 판단 기준을 체계적으로 학습하는 챌린지 프로그램입니다.
          현재 더 완성도 높은 학습 커리큘럼과 기능을 준비 중이며, 정식 오픈 일정은 공지사항 탭을 통해 안내해 드릴 예정입니다.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-strong">기수 선택 및 참가 신청</h2>
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">준비 중</span>
          </div>
          {loading ? <p className="mt-3 text-sm text-neutral-500">기수 정보를 불러오는 중입니다.</p> : null}
          {!loading && cohorts.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-5 text-center">
              <div className="text-2xl">⏳</div>
              <p className="mt-2 text-sm font-bold text-neutral-900">현재 다음 기수 오픈을 준비하고 있습니다.</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                파일럿 기수 모집 및 일정 확정 시 공지사항을 통해 가장 먼저 안내해 드리겠습니다.
              </p>
            </div>
          ) : null}
          {cohorts.length > 0 ? (
            <div className="mt-4 space-y-2">
              {cohorts.map((cohort) => (
                <button
                  type="button"
                  key={cohort.slug}
                  onClick={() => setSelectedSlug(cohort.slug)}
                  className={`w-full rounded-xl border p-4 text-left ${
                    selectedSlug === cohort.slug
                      ? "border-brand-600 bg-brand-50"
                      : "border-line hover:border-brand-200"
                  }`}
                >
                  <span className="text-xs font-bold text-brand-700">
                    {cohort.status === "recruiting" ? "모집 중" : cohort.status === "active" ? "진행 중" : "기수 안내"}
                  </span>
                  <strong className="mt-1 block text-strong">{cohort.title}</strong>
                  <span className="mt-1 block text-sm text-neutral-600">
                    {displayDate(cohort.starts_on)} ~ {displayDate(cohort.ends_on)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {selected?.status === "recruiting" ? (
            <form className="mt-5 border-t border-line pt-5" onSubmit={(event) => { event.preventDefault(); void apply(); }}>
              <p className="text-sm font-bold text-strong">{selected.title} 참가 신청</p>
              <label className="mt-3 block text-sm font-medium text-neutral-700">퇴직연금 유형 <span className="font-normal text-rose-600">(필수)</span>
                <select required value={interestAccountType} onChange={(event) => setInterestAccountType(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 bg-surface px-3 py-2">
                  <option value="none">해당 없음</option>
                  <option value="dc">DC</option>
                  <option value="irp">IRP</option>
                  <option value="both">둘 다</option>
                  <option value="unknown">모름</option>
                </select>
              </label>
              <label className="mt-3 block text-sm font-medium text-neutral-700">참여 목표 <span className="font-normal text-rose-600">(필수)</span>
                <textarea required value={goalNote} onChange={(event) => setGoalNote(event.target.value)} placeholder="한 문장으로 적어주세요." maxLength={240} rows={2} className="mt-1 w-full resize-y rounded-xl border border-neutral-300 px-3 py-2" />
              </label>
              <label className="mt-3 flex gap-2 text-sm leading-5 text-neutral-700">
                <input type="checkbox" required checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-1" />
                <span>30일간 매일 기록 가능하며 비공개 학습 기록 저장에 동의합니다.</span>
              </label>
              
              <p className="mt-4 rounded-xl bg-neutral-50 p-4 text-xs leading-5 text-neutral-600">
                <strong>도서 관련 안내:</strong> 2편과 3편은 현재 집필 중이며 출간 시기가 확정되지 않았습니다. 출간 시점에 완주자에게 무료로 제공되며, 신청 시 이 점에 동의한 것으로 봅니다.
              </p>

              <button disabled={submitting} className="mt-4 w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "신청 중…" : signedIn ? "참가 신청" : "로그인 후 참가 신청"}</button>
            </form>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-strong">공개 학습 기록</h2>
          <p className="mt-1 text-xs sm:text-sm leading-relaxed text-neutral-600">
            전체 공개를 선택한 비금전 학습 기록만 표시합니다. 응원 수는 순위나 인기 지표로 사용하지 않습니다.
          </p>
          <div className="mt-4 space-y-3">
            {records.length === 0 ? (
              <p className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">아직 공개된 학습 기록이 없습니다.</p>
            ) : (
              records.map((post) => (
                <article key={post.slug} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-brand-700">
                      {post.challengeDayNumber ?? 1}일차 · {post.challengeMetricKey ? (metricLabels[post.challengeMetricKey] ?? "학습 기록") : "학습 기록"}
                    </p>
                    <Link href={`/community/read/?slug=${encodeURIComponent(post.slug)}`} className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-800 hover:bg-brand-50">
                      자세히 보기
                    </Link>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700 line-clamp-3">{post.bodyText || post.excerpt || "학습 기록을 남겼습니다."}</p>
                  <p className="mt-3 text-xs text-neutral-500">{post.authorNickname || post.author_nickname || "익명"}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      {message ? <p role="status" className="rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">{message}</p> : null}
      <CommunityAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => { setSignedIn(true); setAuthOpen(false); }} />
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return (
    <main className="page-shell py-7 sm:py-10">
      <div className="space-y-6">{content}</div>
    </main>
  );
}
