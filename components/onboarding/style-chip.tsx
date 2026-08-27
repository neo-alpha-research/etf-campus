"use client";

import { useSyncExternalStore } from "react";

import {
  parseStoredDiagnosis,
  STYLE_CHANGE_EVENT,
  STYLE_PROFILES,
  STYLE_STORAGE_KEY,
  STYLE_STORAGE_KEY_V3,
} from "@/lib/onboarding/style-diagnosis";

export function StyleChip() {
  const raw = useSyncExternalStore(
    (notify) => {
      window.addEventListener(STYLE_CHANGE_EVENT, notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener(STYLE_CHANGE_EVENT, notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => localStorage.getItem(STYLE_STORAGE_KEY) || localStorage.getItem(STYLE_STORAGE_KEY_V3),
    () => "__server__",
  );

  if (raw === "__server__") {
    return (
      <div
        aria-hidden="true"
        className="inline-flex h-11 w-40 items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 opacity-60 sm:w-52"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-200 text-sm text-neutral-400">
          🐾
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="h-2 w-16 rounded bg-neutral-200" />
          <div className="h-3 w-24 rounded bg-neutral-200" />
        </div>
      </div>
    );
  }

  const stored = parseStoredDiagnosis(raw);
  const completedDiagnosis = stored?.status === "completed" ? stored : null;
  const profile = completedDiagnosis ? STYLE_PROFILES[completedDiagnosis.style] : null;

  return (
    <button
      aria-label={profile ? `ETF 투자 스타일 결과 보기: ${profile.name}` : "ETF 투자 스타일 점검 시작하기"}
      className="group inline-flex min-h-11 w-40 items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-left text-brand-900 transition-all hover:border-brand-400 hover:bg-brand-100 hover:shadow-sm sm:w-52"
      onClick={() => window.dispatchEvent(new CustomEvent(STYLE_CHANGE_EVENT, { detail: { open: true } }))}
      type="button"
    >
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-700 text-base text-white">
        {profile?.emoji ?? "🐾"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-extrabold tracking-[0.04em] text-brand-700">
          {profile ? (completedDiagnosis?.prescription ? "내 ETF 투자 스타일" : "내 동물 확인 (처방 대기)") : "약 3분 · 13문항"}
        </span>
        <span className="block truncate text-xs font-extrabold sm:text-sm">
          {profile ? `${profile.animal} 유형` : "투자 스타일 점검"}
        </span>
      </span>
      <span aria-hidden="true" className="hidden shrink-0 text-brand-600 transition-transform group-hover:translate-x-0.5 sm:block">
        ›
      </span>
    </button>
  );
}
