import type { Metadata } from "next";
import Link from "next/link";

import { MarkdownContent } from "@/components/markdown/markdown-content";
import { SelfCheckChecklist } from "@/components/learning/self-check-checklist";
import { loadGuideDraft } from "@/lib/education/guide-draft-parser";

export const metadata: Metadata = {
  title: "ETF 비용·계좌별 규칙 자가 점검 가이드",
  description:
    "실부담비용 공시 읽기, 5대 계좌별 세제·감독 규정, 10문항 인지 확인 자가 점검 체크리스트",
  alternates: { canonical: "/guides/self-check" },
};

export default function SelfCheckGuidePage() {
  const { topContent, bottomContent } = loadGuideDraft();

  return (
    <main className="page-shell flex-1 py-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link
          className="text-sm font-extrabold text-brand-700 hover:text-brand-900"
          href="/guides"
        >
          ← 자산군 가이드 목록
        </Link>

        {/* Top Content: Intro, Part 1 (비용 공시), Part 2 (계좌별 규칙) */}
        <article className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-8">
          <MarkdownContent source={topContent} />
        </article>

        {/* Interactive 10-Question Checklist Component */}
        <SelfCheckChecklist />

        {/* Bottom Content: Part 4 (출처, 시행일 및 적용 조건 Provenance) */}
        {bottomContent ? (
          <article className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-8">
            <MarkdownContent source={bottomContent} />
          </article>
        ) : null}
      </div>
    </main>
  );
}
