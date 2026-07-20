import type { Metadata } from "next";
import { Suspense } from "react";

import { GuidesIndex } from "@/components/learning/guides-index";
import { loadGuides } from "@/lib/content/learning-content";

export const metadata: Metadata = { title: "자산군 가이드", description: "특정 종목 조합이 아닌 자산군의 역할과 판단 기준을 배웁니다." };

export default function GuidesPage() {
  return <main className="page-shell flex-1 py-8 sm:py-12">
    <p className="eyebrow">Campus Classroom</p>
    <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">자산군을 고르는 기준부터</h1>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">특정 ETF 조합을 제시하지 않습니다. 거의 변하지 않는 원칙, 정보에 따라 달라지는 판단, 오늘 확인할 데이터의 세 층으로 읽습니다.</p>
    <Suspense fallback={<div className="mt-8 h-48 animate-pulse rounded-2xl bg-neutral-100" />}><GuidesIndex guides={loadGuides()} /></Suspense>
  </main>;
}
