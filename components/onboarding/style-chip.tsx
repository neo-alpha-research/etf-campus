"use client";

import { useSyncExternalStore } from "react";

import { parseStoredDiagnosis, STYLE_CHANGE_EVENT, STYLE_PROFILES, STYLE_STORAGE_KEY } from "@/lib/onboarding/style-diagnosis";

export function StyleChip() {
  const raw = useSyncExternalStore(
    (notify) => { window.addEventListener(STYLE_CHANGE_EVENT, notify); window.addEventListener("storage", notify); return () => { window.removeEventListener(STYLE_CHANGE_EVENT, notify); window.removeEventListener("storage", notify); }; },
    () => localStorage.getItem(STYLE_STORAGE_KEY),
    () => null,
  );
  const stored = parseStoredDiagnosis(raw);
  const completed = stored?.status === "completed";
  const profile = completed ? STYLE_PROFILES[stored.style] : null;

  return <button
    aria-label={profile ? `ETF 투자 스타일 결과 보기: ${profile.name}` : "ETF 투자 스타일 점검 시작하기"}
    className="group inline-flex min-h-11 max-w-[12rem] items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-left text-brand-900 transition-all hover:border-brand-400 hover:bg-brand-100 hover:shadow-sm sm:max-w-60"
    onClick={() => window.dispatchEvent(new CustomEvent(STYLE_CHANGE_EVENT, { detail: { open: true } }))}
    type="button"
  >
    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-700 text-base text-white">{profile?.emoji ?? "🐾"}</span>
    <span className="min-w-0">
      <span className="block text-[10px] font-extrabold tracking-[0.04em] text-brand-700">{profile ? "내 ETF 투자 스타일" : "약 2분 · 10문항"}</span>
      <span className="block truncate text-xs font-extrabold sm:text-sm">{profile ? `${profile.animal} 유형` : "투자 스타일 점검"}</span>
    </span>
    <span aria-hidden="true" className="hidden shrink-0 text-brand-600 transition-transform group-hover:translate-x-0.5 sm:block">›</span>
  </button>;
}
