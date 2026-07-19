import Link from "next/link";

import { loadBriefings } from "@/lib/content/briefings";

export default function BriefingPage() {
  const briefings = loadBriefings();
  return <main className="page-shell flex-1 py-8 sm:py-12"><p className="eyebrow">Market Briefing</p><h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">시황 브리핑</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">공시 데이터에 근거한 사실 중심의 기록을 날짜별 영구 URL로 보존합니다.</p><div className="mt-8 space-y-3">{briefings.map((briefing) => <article className="rounded-2xl border border-line p-5 transition-colors hover:border-brand-300" key={briefing.date}><div className="flex items-center gap-2"><time className="tabular-nums text-xs font-bold text-muted" dateTime={briefing.date}>{briefing.date.replaceAll("-", ".")}</time>{briefing.isSample ? <span className="rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">SAMPLE</span> : null}</div><h2 className="mt-2 text-xl font-extrabold text-strong"><Link className="hover:text-brand-700" href={`/briefing/${briefing.date}`}>{briefing.title}</Link></h2><p className="mt-2 text-sm leading-6 text-muted">{briefing.summary}</p></article>)}</div></main>;
}
