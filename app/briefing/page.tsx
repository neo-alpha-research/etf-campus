import type { Metadata } from "next";
import Link from "next/link";

import { Tickery } from "@/components/brand/tickery";
import { SampleNotice } from "@/components/learning/sample-badge";
import { loadBriefings } from "@/lib/content/briefings";

export const metadata: Metadata = { title: "마켓 데일리", description: "공시 데이터에 근거한 ETF 시장 기록을 날짜별로 확인합니다.", alternates: { canonical: "/briefing" } };

export default function BriefingPage() {
  const briefings = loadBriefings();
  return <main className="page-shell flex-1 py-8 sm:py-12">
    <div className="flex items-center justify-between gap-5 rounded-3xl bg-brand-50/70 px-5 py-5 sm:px-7">
      <div><p className="eyebrow">Market Briefing</p><h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">마켓 데일리</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">공시 데이터에 근거한 사실 중심의 기록을 날짜별 영구 URL로 보존합니다.</p></div>
      <Tickery className="h-24 w-24 shrink-0 sm:h-32 sm:w-32" pose="briefing" priority sizes="(max-width: 640px) 96px, 128px" />
    </div>
    <div className="mt-6"><SampleNotice /></div>
    <div className="mt-8 space-y-3">{briefings.map((briefing) => <article className="rounded-2xl border border-line p-5 transition-colors hover:border-brand-300" key={briefing.date}><div className="flex items-center gap-2"><time className="tabular-nums text-xs font-bold text-muted" dateTime={briefing.date}>{briefing.date.replaceAll("-", ".")}</time>{briefing.isLearningExample ? <span className="rounded border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-bold text-brand-800">학습용 예시</span> : null}</div><h2 className="mt-2 text-xl font-extrabold text-strong"><Link className="hover:text-brand-700" href={`/briefing/${briefing.date}`}>{briefing.title}</Link></h2><p className="mt-2 text-sm leading-6 text-muted">{briefing.summary}</p></article>)}</div>
  </main>;
}
