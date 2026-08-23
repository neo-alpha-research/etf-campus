"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Post = {
  slug: string;
  title: string;
  bodyText?: string;
  excerpt?: string;
  category: { slug: string; name: string };
  authorNickname: string;
  createdAt: string;
  commentCount: number;
  isPinned?: boolean;
  isAuthorSeed?: boolean;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(value));
}

export function LatestCommunityPosts({ limit = 3 }: { limit?: number }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/community/posts?limit=${limit}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (active) {
          setPosts(data.posts || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [limit]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return <p className="text-sm text-slate-500">아직 등록된 게시물이 없습니다.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <Link
          key={post.slug}
          href={`/community/read/?slug=${encodeURIComponent(post.slug)}`}
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-brand-700">
            <span>{post.category.name}</span>
            {post.isPinned ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">고정</span>
              </>
            ) : null}
            {post.isAuthorSeed ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">저자 기록</span>
              </>
            ) : null}
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">{displayDate(post.createdAt)}</span>
          </div>
          <h3 className="mt-2 text-base font-bold text-slate-950 line-clamp-1">{post.title}</h3>
          <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-600">
            {post.excerpt ?? post.bodyText}
          </p>
          <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
            <span>{post.authorNickname}</span>
            <span>댓글 {post.commentCount}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
