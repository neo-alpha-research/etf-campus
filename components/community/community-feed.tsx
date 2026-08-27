/* eslint-disable react-hooks/set-state-in-effect -- Client-only authentication, draft restoration, and public data loading intentionally update state after hydration. */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CommunityAuthDialog } from "@/components/community/community-auth-dialog";
import { clearCommunitySession, communityFetch, getCommunitySession, refreshCommunitySession, signOutCommunity } from "@/lib/community/browser-client";
import { getCommunityBoardNotice } from "@/lib/community/community-notices";

const categories = [
  { slug: "", name: "전체" },
  { slug: "notice", name: "공지" },
  { slug: "pension-etf-qna", name: "연금 ETF Q&A" },
  { slug: "etf-questions", name: "ETF 정보·질문" },
  { slug: "challenge-30", name: "30일 챌린지" },
  { slug: "feedback", name: "오류·기능 제안" },
] as const;

const quickPaths = [
  { label: "질문하기", description: "연금 계좌와 ETF 판단 기준에서 막히는 점을 적어 보세요.", href: "/community/write/?category=pension-etf-qna", eyebrow: "01 · 질문" },
  { label: "ETF 읽기", description: "추종 대상·구조·비용·공시를 읽는 순서를 확인하세요.", href: "/community/learning-bundles/", eyebrow: "02 · 학습" },
  { label: "30일 기록", description: "수익 경쟁 없이 오늘 확인한 판단 기준을 남겨 보세요.", href: "/community/challenge/", eyebrow: "03 · 기록" },
  { label: "오류 제보", description: "화면·ETF 코드·확인 날짜를 바탕으로 재현 가능한 제보를 남겨 주세요.", href: "/community/write/?category=feedback", eyebrow: "04 · 개선" },
] as const;

type Post = {
  slug: string;
  title: string;
  excerpt?: string;
  bodyText?: string;
  category: { slug: string; name: string };
  authorNickname: string;
  createdAt: string;
  commentCount: number;
  upvoteCount?: number;
  isPinned?: boolean;
  isAuthorSeed?: boolean;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(value));
}

export function CommunityFeed() {
  const [selected, setSelected] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [withdrawalMode, setWithdrawalMode] = useState<"anonymize" | "delete">("anonymize");
  const [accountMessage, setAccountMessage] = useState("");
  const boardNotice = getCommunityBoardNotice(selected);

  useEffect(() => {
    refreshCommunitySession().then(setSignedIn);
  }, []);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setNextCursor(null);
    const params = new URLSearchParams({ limit: "12" });
    if (selected) params.set("category", selected);
    fetch(`/api/community/posts?${params.toString()}`)
      .then(async (response) => {
        const contentType = response.headers?.get ? response.headers.get("content-type") || "" : "application/json";
        if (!response.ok || (response.headers?.get && !contentType.includes("application/json"))) {
          const fallbackRes = await fetch("/mock-community-posts.json");
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            let list = fallbackData.posts || [];
            if (selected) {
              list = list.filter((p: { category?: { slug?: string } }) => p.category?.slug === selected);
            }
            return { posts: list, nextCursor: null };
          }
          throw new Error("게시물을 불러오지 못했습니다.");
        }
        return response.json();
      })
      .then((result) => {
        if (!active) return;
        setPosts(result.posts ?? []);
        setNextCursor(typeof result.nextCursor === "string" ? result.nextCursor : null);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });
    return () => { active = false; };
  }, [selected]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: "12", cursor: nextCursor });
      if (selected) params.set("category", selected);
      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error("게시물을 불러오지 못했습니다.");
      const result = await response.json();
      setPosts((current) => [...current, ...(result.posts ?? [])]);
      setNextCursor(typeof result.nextCursor === "string" ? result.nextCursor : null);
    } catch {
      setAccountMessage("추가 게시물을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoadingMore(false);
    }
  }

  function goToWrite() {
    if (!getCommunitySession()) {
      setAuthOpen(true);
      return;
    }
    window.location.assign("/community/write/");
  }

  async function logout() {
    await signOutCommunity();
    setSignedIn(false);
    setAccountOpen(false);
    setAccountMessage("로그아웃했습니다.");
  }

  async function withdraw() {
    setAccountMessage("");
    try {
      await communityFetch("/api/community/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ contentDisposition: withdrawalMode }),
      });
      clearCommunitySession();
      setSignedIn(false);
      setAccountOpen(false);
      setAccountMessage("탈퇴 요청을 처리했습니다.");
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "탈퇴 요청을 처리하지 못했습니다.");
    }
  }

  return (
    <div className="page-shell py-6 sm:py-8">
      {/* Community Top Header & Quick Paths */}
      <section className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white px-5 py-6 shadow-sm sm:px-8 sm:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-brand-700 uppercase">ETF Campus Community</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              ETF 지식 공유 & 토론 커뮤니티
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
              특정 종목 매수 권유가 아닌, 연금·상품 구조·실부담비용·위험 요소를 함께 공유하고 검증하는 공간입니다.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={goToWrite}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-800 transition cursor-pointer"
            >
              ✏️ 글 작성
            </button>
            {signedIn ? (
              <button
                onClick={() => setAccountOpen((current) => !current)}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                내 계정
              </button>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                이메일 로그인
              </button>
            )}
          </div>
        </div>

        {/* 목적별 퀵 가이드 (컴팩트 카드) */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {quickPaths.map((path) => (
            <Link
              key={path.label}
              href={path.href}
              className="group flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2.5 text-xs shadow-2xs hover:border-brand-300 hover:bg-white hover:shadow-xs transition"
            >
              <div className="truncate">
                <span className="text-[10px] font-bold text-brand-600 block">{path.eyebrow}</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-brand-800">{path.label}</span>
              </div>
              <span className="text-slate-400 text-xs group-hover:text-brand-700 transition">→</span>
            </Link>
          ))}
        </div>

        {/* 운영 공지 */}
        <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2 text-xs leading-5 text-amber-950">
          <p>
            <span className="font-bold">운영 공지</span><span className="mx-2 text-amber-400">|</span>게시물은 공개로 읽을 수 있으며, 작성·댓글은 이메일 인증 회원만 가능합니다. 매수·매도 강요, 목표가, 수익 보장, 리딩방·광고 유도는 허용하지 않습니다.
          </p>
        </div>
      </section>

      {accountOpen ? (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950">내 계정</h2>
              <p className="mt-1 text-sm text-slate-600">세션은 이 브라우저 탭에만 보관됩니다.</p>
            </div>
            <button onClick={logout} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">로그아웃</button>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-sm font-bold text-slate-900">회원 탈퇴</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">탈퇴하면 세션이 즉시 폐기되고 이메일 식별자·닉네임·선택 프로필은 최대 7일 안에 삭제됩니다.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                <input checked={withdrawalMode === "anonymize"} onChange={() => setWithdrawalMode("anonymize")} className="mr-2" type="radio" name="withdraw" />
                글·댓글은 “탈퇴한 사용자”로 익명화 유지
              </label>
              <label className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                <input checked={withdrawalMode === "delete"} onChange={() => setWithdrawalMode("delete")} className="mr-2" type="radio" name="withdraw" />
                글·댓글 공개 노출 중단 후 삭제
              </label>
            </div>
            <button onClick={withdraw} className="mt-3 rounded-xl border border-rose-300 px-3 py-2 text-sm font-bold text-rose-700">탈퇴 요청</button>
          </div>
        </section>
      ) : null}

      {accountMessage ? <p role="status" className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{accountMessage}</p> : null}

      {/* 게시판 카테고리 탭 (피드 직결) */}
      <nav aria-label="커뮤니티 게시판" className="mt-6 flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-slate-200/80">
        <div className="flex gap-1.5 sm:gap-2">
          {categories.map((category) => (
            <button
              key={category.slug}
              onClick={() => setSelected(category.slug)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
                selected === category.slug
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </nav>

      {boardNotice ? (
        <aside aria-live="polite" className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-3.5 text-xs sm:text-sm leading-6 text-brand-950 sm:px-5">
          <h2 className="font-extrabold">{boardNotice.title}</h2>
          <p className="mt-1 text-brand-900">{boardNotice.body}</p>
        </aside>
      ) : null}

      {/* 실시간 게시판 피드 목록 */}
      <section className="mt-4" aria-live="polite">
        {status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : null}

        {status === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
            <h2 className="font-bold text-rose-950">게시물을 불러오지 못했습니다.</h2>
            <p className="mt-2 text-sm text-rose-800">잠시 후 다시 시도해 주세요.</p>
            <button onClick={() => setSelected((value) => value)} className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white cursor-pointer">
              다시 시도
            </button>
          </div>
        ) : null}

        {status === "ready" && posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <h2 className="text-lg font-bold text-slate-900">아직 게시물이 없습니다.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">첫 질문이나 학습 기록을 남겨 ETF 판단 기준을 함께 확인해 보세요.</p>
            <button onClick={goToWrite} className="mt-5 rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white cursor-pointer">
              첫 글 작성하기
            </button>
          </div>
        ) : null}

        {status === "ready" && posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/community/read/?slug=${encodeURIComponent(post.slug)}`}
                className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-sm"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-brand-700">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{post.category.name}</span>
                  {post.isPinned ? (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800">📌 고정</span>
                    </>
                  ) : null}
                  {post.isAuthorSeed ? (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-indigo-800">저자 기록</span>
                    </>
                  ) : null}
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500 font-normal">{displayDate(post.createdAt)}</span>
                </div>
                <h2 className="mt-2.5 text-base sm:text-lg font-bold text-slate-950 group-hover:text-brand-800 transition">
                  {post.title}
                </h2>
                <p className="mt-1.5 line-clamp-2 text-xs sm:text-sm leading-6 text-slate-600">
                  {post.excerpt ?? post.bodyText}
                </p>
                <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{post.authorNickname}</span>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      👍 추천 <strong className="text-brand-700 font-bold">{post.upvoteCount ?? 0}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      💬 댓글 <strong className="text-slate-900 font-bold">{post.commentCount}</strong>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            {nextCursor ? (
              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 transition cursor-pointer"
                >
                  {loadingMore ? "불러오는 중…" : "게시물 더보기"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      <CommunityAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => { setSignedIn(true); setAuthOpen(false); }} />
    </div>
  );
}
