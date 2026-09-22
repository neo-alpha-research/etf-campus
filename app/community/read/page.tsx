import type { Metadata } from "next";
import { Suspense } from "react";
import { CommunityPostDetail } from "@/components/community/community-post-detail";

export const metadata: Metadata = {
  title: "커뮤니티 글",
  description: "ETF Campus 커뮤니티의 공개 게시물입니다.",
  robots: { index: false, follow: false, nocache: true },
};

export default function CommunityReadPage() {
  return <Suspense fallback={<div className="page-shell py-7 sm:py-10"><div className="h-10 w-2/3 animate-pulse rounded bg-slate-100" /><div className="mt-5 h-64 animate-pulse rounded-2xl bg-slate-100" /></div>}><CommunityPostDetail /></Suspense>;
}
