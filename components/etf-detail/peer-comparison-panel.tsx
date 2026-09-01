"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EtfCompareView } from "./etf-compare-view";
import type { Etf } from "@/lib/domain/etf-types";
import type { PeerComparison } from "@/lib/data/etf-peer-groups";
import { formatAsOfDate } from "@/lib/domain/etf-format";

type Props = {
  etf: Etf;
  comparison: PeerComparison;
};

const INVALID_CODES = new Set(["unknown", "해당없음", "unspecified", "plain", "null"]);
const CODE_TRANSLATIONS: Record<string, string> = {
  "concentrated": "집중형",
  "broad": "분산형",
};

function formatDisplayValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  
  if (!trimmed || INVALID_CODES.has(lower)) return null;

  if (CODE_TRANSLATIONS[lower]) {
    return CODE_TRANSLATIONS[lower];
  }

  // 만약 순수 영문/기호 조합인데 번역이 없다면 내부 코드로 간주하여 노출하지 않음
  if (/^[a-z_-\s]+$/i.test(trimmed)) {
    return null;
  }

  return trimmed.replaceAll("_", " ");
}

export function PeerComparisonPanel({ etf, comparison }: Props) {
  const primary = comparison.groups.find((group) => group.isPrimary);
  const [selectedGroupId, setSelectedGroupId] = useState(primary?.id ?? "");
  const selected = useMemo(
    () => comparison.groups.find((group) => group.id === selectedGroupId) ?? primary,
    [comparison.groups, primary, selectedGroupId],
  );
  const profile = comparison.profile;
  
  const chips = useMemo(() => {
    const rawChips = [
      profile?.regionPrimary,
      profile?.assetFamily,
      profile?.comparisonCategory,
      profile?.comparisonSubtopic,
      profile?.strategyStyle,
      profile?.concentrationBucket,
    ].map(formatDisplayValue).filter((val): val is string => Boolean(val));
    
    return Array.from(new Set(rawChips)); // 중복 제거
  }, [profile]);

  const comparisonProfiles = useMemo(() => new Map([
    ...(profile ? [[etf.ticker, profile] as const] : []),
    ...(selected?.candidates ?? []).map((candidate) => [candidate.etf.ticker, candidate.profile] as const),
  ]), [etf.ticker, profile, selected]);

  if (comparison.state === "unverified" || !selected || !profile) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="peer-comparison-title">
        <p className="text-sm font-semibold text-brand-700">동종 ETF 분류를 확인하고 있습니다.</p>
        <h2 id="peer-comparison-title" className="mt-2 text-xl font-extrabold text-strong">동종 ETF 분류를 확인하고 있습니다.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">정확하지 않은 후보를 자동으로 제시하지 않습니다. ETF 비교 화면에서 직접 종목을 선택할 수 있습니다.</p>
        <Link href={`/compare?tickers=${encodeURIComponent(etf.ticker)}&base=${encodeURIComponent(etf.ticker)}`} className="mt-5 inline-flex rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700">ETF 직접 비교하기</Link>
      </section>
    );
  }

  const displayedCount = 1 + selected.candidates.length;
  const comparisonTickers = [etf.ticker, ...selected.candidates.map((candidate) => candidate.etf.ticker)].filter(Boolean);
  const comparisonHref = `/compare?tickers=${encodeURIComponent(comparisonTickers.join(","))}&base=${encodeURIComponent(etf.ticker)}&group=${encodeURIComponent(selected.id)}`;
  
  // 제목 생성
  let title = "동종 ETF 비교";
  const region = formatDisplayValue(profile.regionPrimary) || "";
  const subtopic = formatDisplayValue(profile.comparisonSubtopic) || "";
  const topic = formatDisplayValue(profile.comparisonTopic) || "";
  const concentration = formatDisplayValue(profile.concentrationBucket) || "";
  
  const mainTopic = subtopic || topic || selected.label;
  const titleParts = [];
  
  if (region && !mainTopic.includes(region)) {
    titleParts.push(region);
  }
  titleParts.push(mainTopic);
  if (concentration) {
    titleParts.push(concentration);
  }
  
  const combinedTitle = titleParts.filter(Boolean).join(" ").trim();
  if (combinedTitle) {
    title = `${combinedTitle} ETF 비교`.replace(/\s+/g, " ");
  }

  // 보조 문구 생성
  const directPeerCount = selected.candidates.filter(
    (candidate) => candidate.tier === "same_peer_group",
  ).length;

  // 헤더 생성
  let headerLabel = "직접 비교그룹";
  if (directPeerCount === 0) {
    headerLabel = "자동 추천 비교그룹";
  } else if (directPeerCount < selected.candidates.length) {
    headerLabel = "직접/유사 비교그룹 (확장됨)";
  } else {
    headerLabel = "검증된 직접 비교그룹";
  }

  return (
    <section className="space-y-5" aria-labelledby="peer-comparison-title">
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-700">{headerLabel}</p>
            <h2 id="peer-comparison-title" className="mt-1 text-xl font-extrabold text-strong sm:text-2xl">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">현재 ETF와 투자대상 및 수익 구조가 유사한 ETF를 비교합니다.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-800">현재 ETF 포함 {displayedCount}개</span>
        </div>
        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="비교 분류">
            {chips.map((chip) => <span key={chip} className="rounded-full border border-line bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700">{chip}</span>)}
          </div>
        )}
        {comparison.groups.length > 1 && (
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="비교그룹 선택">
            {comparison.groups.map((group) => (
              <button key={group.id} type="button" onClick={() => setSelectedGroupId(group.id)} aria-pressed={selected.id === group.id} className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm font-bold transition-colors ${selected.id === group.id ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-neutral-700 hover:border-brand-300 hover:bg-brand-50"}`}>
                <span className="block whitespace-nowrap">{group.label} {group.totalCount}개</span>
                {group.isPrimary && <span className="mt-0.5 block text-[11px] opacity-80">기본 비교그룹</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {comparison.state === "no_peers" ? (
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h3 className="text-lg font-extrabold text-strong">현재 기준으로 직접 비교할 수 있는 동종 ETF가 없습니다.</h3>
          <p className="mt-2 text-sm leading-6 text-muted">후보 수를 채우기 위해 관련성이 낮은 ETF를 표시하지 않습니다.</p>
          <Link href={comparisonHref} className="mt-5 inline-flex rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-bold text-brand-800 transition-colors hover:bg-brand-100">ETF 직접 비교하기</Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 mb-2 mt-4">
            <div className="text-[15px] font-extrabold text-emerald-800 tracking-tight">
              기준일 {formatAsOfDate(etf.asOfDate)}
            </div>
            <Link href={comparisonHref} className="shrink-0 inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-[12px] font-bold text-brand-700 transition-colors hover:bg-brand-100 hover:text-brand-800">
              ETF 직접 비교하기
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <EtfCompareView mainEtf={etf} basket={selected.candidates.map((candidate) => candidate.etf)} mode="peer-readonly" selectionReasons={new Map(selected.candidates.map((candidate) => [candidate.etf.ticker, candidate.reasons]))} comparisonProfiles={comparisonProfiles} />
        </>
      )}
    </section>
  );
}
