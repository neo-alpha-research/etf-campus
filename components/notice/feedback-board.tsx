/* eslint-disable react-hooks/set-state-in-effect -- Client-only data loading and local storage sync intentionally update state after hydration. */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { refreshCommunitySession } from "@/lib/community/browser-client";

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
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function FeedbackBoard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    refreshCommunitySession();
  }, []);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setNextCursor(null);

    const loadPosts = async () => {
      try {
        const params = new URLSearchParams({ category: "feedback", limit: "10" });
        const response = await fetch(`/api/community/posts?${params.toString()}`);
        const contentType = response.headers?.get ? response.headers.get("content-type") || "" : "application/json";

        if (!response.ok || !contentType.includes("application/json")) {
          throw new Error("API 요청 실패");
        }

        const result = await response.json();
        if (!active) return;

        // LocalStorage에 저장된 로컬 글이 있다면 함께 병합
        let localPosts: Post[] = [];
        if (typeof window !== "undefined") {
          try {
            const stored = localStorage.getItem("etf-campus:local-posts");
            if (stored) {
              const allLocal = JSON.parse(stored);
              localPosts = allLocal.filter((p: { category?: { slug?: string } }) => p.category?.slug === "feedback");
            }
          } catch {}
        }

        const combined = [...localPosts, ...(result.posts ?? [])];
        // 중복 제거 (slug 기준)
        const uniquePosts = combined.filter(
          (post, index, self) => index === self.findIndex((p) => p.slug === post.slug)
        );

        setPosts(uniquePosts);
        setNextCursor(typeof result.nextCursor === "string" ? result.nextCursor : null);
        setStatus("ready");
      } catch {
        // Fallback to mock data and local storage
        try {
          let fallbackList: Post[] = [];
          const fallbackRes = await fetch("/mock-community-posts.json");
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            const allPosts = fallbackData.posts || [];
            fallbackList = allPosts.filter(
              (p: { category?: { slug?: string } }) => p.category?.slug === "feedback"
            );
          }

          if (typeof window !== "undefined") {
            try {
              const stored = localStorage.getItem("etf-campus:local-posts");
              if (stored) {
                const allLocal = JSON.parse(stored);
                const localFeedback = allLocal.filter(
                  (p: { category?: { slug?: string } }) => p.category?.slug === "feedback"
                );
                fallbackList = [...localFeedback, ...fallbackList];
              }
            } catch {}
          }

          if (!active) return;
          setPosts(fallbackList);
          setNextCursor(null);
          setStatus("ready");
        } catch {
          if (!active) return;
          setStatus("error");
        }
      }
    };

    loadPosts();
    return () => {
      active = false;
    };
  }, []);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ category: "feedback", limit: "10", cursor: nextCursor });
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

  return (
    <div className="space-y-6">
      {/* Board Top Header Banner */}
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-800 border border-brand-200">
                의견 및 오류 제보
              </span>
              <span className="text-xs text-neutral-400">서비스 피드백 창구</span>
            </div>
            <h2 className="mt-2 text-lg sm:text-xl font-extrabold text-strong">
              ETF Campus 개선 제안 및 오류 제보
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-2xl">
              서비스 이용 중 발견하신 데이터 이상, 계산 오류, 사용 불편이나 새로운 기능 제안을 남겨주세요.
              운영팀이 신속히 확인하여 데이터 검증 및 서비스 개선에 적극 반영하겠습니다.
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href="/community/write?category=feedback"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-xs transition-colors hover:bg-brand-800"
            >
              ✏️ 의견·오류 제보하기
            </Link>
          </div>
        </div>

        {/* Tip Box */}
        <div className="mt-5 rounded-xl border border-amber-200/80 bg-amber-50/70 p-4 text-xs text-amber-900 leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <span>💡</span>
            <span>신속하고 정확한 처리를 위한 제보 작성 팁</span>
          </div>
          <ul className="mt-2 space-y-1 text-amber-900/90 pl-5 list-disc">
            <li>
              <strong>발생 위치</strong>: 오류나 이상 현상이 발생한 <strong>화면명 또는 웹페이지 주소(URL)</strong>를 적어주세요.
            </li>
            <li>
              <strong>종목 정보</strong>: 특정 ETF 데이터 문의 시 <strong>종목명(예: KODEX 200)</strong> 또는 <strong>6자리 종목코드(예: 069500)</strong>를 함께 기재해 주세요.
            </li>
            <li>
              <strong>현상 설명</strong>: 화면에 잘못 표시된 수치나 기대하셨던 정상 동작 내용을 간략히 남겨주시면 원인 파악이 훨씬 빨라집니다.
            </li>
          </ul>
        </div>
      </section>

      {/* Posts List Section */}
      <section aria-label="의견 및 오류 제보 목록" className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-extrabold text-strong">
            접수된 제보 목록 ({posts.length})
          </h3>
          <span className="text-xs text-neutral-400">최신순 정렬</span>
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl border border-line bg-surface/50" />
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
            <p className="font-bold text-rose-950">게시물을 불러오지 못했습니다.</p>
            <p className="mt-1 text-xs text-rose-800">네트워크 상태를 확인하신 후 다시 시도해 주세요.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white cursor-pointer hover:bg-rose-800"
            >
              새로고침
            </button>
          </div>
        )}

        {status === "ready" && posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-xl">
              📋
            </div>
            <h4 className="mt-3 text-base font-bold text-strong">
              아직 등록된 제보가 없습니다.
            </h4>
            <p className="mt-1.5 text-xs sm:text-sm text-neutral-600">
              ETF Campus를 더 신뢰할 수 있는 서비스로 만들기 위한 소중한 첫 의견을 남겨주세요!
            </p>
            <div className="mt-5">
              <Link
                href="/community/write?category=feedback"
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2 text-xs sm:text-sm font-extrabold text-white transition-colors hover:bg-brand-800"
              >
                ✏️ 첫 제보 작성하기
              </Link>
            </div>
          </div>
        )}

        {status === "ready" && posts.length > 0 && (
          <div className="space-y-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/community/read/?slug=${encodeURIComponent(post.slug)}`}
                className="group block rounded-2xl border border-line bg-surface p-5 shadow-2xs transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-xs"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-brand-700">
                  <span className="rounded-md bg-brand-50 px-2 py-0.5 text-brand-800 border border-brand-100">
                    {post.category?.name || "의견·오류 제보"}
                  </span>
                  {post.isPinned ? (
                    <>
                      <span className="text-neutral-300">·</span>
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800">📌 고정</span>
                    </>
                  ) : null}
                  <span className="text-neutral-300">·</span>
                  <span className="text-neutral-400 font-normal">{displayDate(post.createdAt)}</span>
                </div>

                <h4 className="mt-2.5 text-base font-extrabold text-strong group-hover:text-brand-800 transition">
                  {post.title}
                </h4>

                <p className="mt-1.5 line-clamp-2 text-xs sm:text-sm leading-relaxed text-neutral-600">
                  {post.excerpt ?? post.bodyText}
                </p>

                <div className="mt-3.5 flex items-center justify-between border-t border-line/60 pt-3 text-xs text-neutral-500">
                  <span className="font-medium text-neutral-700">{post.authorNickname || "익명 회원"}</span>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 font-semibold text-neutral-600">
                      👍 추천 <strong className="text-brand-700 font-bold">{post.upvoteCount ?? 0}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-neutral-600">
                      💬 댓글 <strong className="text-strong font-bold">{post.commentCount ?? 0}</strong>
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
                  className="rounded-xl border border-line bg-surface px-5 py-2.5 text-xs sm:text-sm font-bold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 transition cursor-pointer"
                >
                  {loadingMore ? "불러오는 중…" : "제보 더보기"}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
