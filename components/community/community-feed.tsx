/* eslint-disable react-hooks/set-state-in-effect -- Client-only authentication, draft restoration, and public data loading intentionally update state after hydration. */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { refreshCommunitySession } from "@/lib/community/browser-client";
import { getCommunityBoardNotice } from "@/lib/community/community-notices";

const categories = [
  { slug: "", name: "전체" },
  { slug: "notice", name: "공지" },
  { slug: "pension-etf-qna", name: "연금 ETF Q&A" },
  { slug: "etf-questions", name: "ETF 정보·질문" },
  { slug: "challenge-30", name: "30일 챌린지" },
  { slug: "feedback", name: "오류·기능 제안" },
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
  const boardNotice = getCommunityBoardNotice(selected);

  useEffect(() => {
    refreshCommunitySession();
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
        if (!response.ok || !contentType.includes("application/json")) {
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
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }

  function goToWrite() {
    window.location.assign("/community/write/");
  }

  return (
    <div className="page-shell py-6 sm:py-8">
      {/* Community Top Header (Clean & Board-First) */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            커뮤니티
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
            특정 종목 매수 권유가 아닌, 연금·상품 구조·실부담비용·판단 기준을 자유롭게 공유하고 토론하는 공간입니다.
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            onClick={goToWrite}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-800 transition cursor-pointer"
          >
            ✏️ 글 작성
          </button>
        </div>
      </section>

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
    </div>
  );
}
