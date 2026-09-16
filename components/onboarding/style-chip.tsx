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
        className="inline-flex h-9 sm:h-11 w-auto shrink-0 items-center gap-1.5 sm:gap-2.5 rounded-full border border-neutral-200 bg-neutral-50 p-1 sm:px-3 sm:py-1.5 opacity-60"
      >
        <span className="grid size-7 sm:size-8 shrink-0 place-items-center rounded-full border border-neutral-200 bg-white text-base text-neutral-400 shadow-2xs">
          🧭
        </span>
        <div className="hidden sm:flex min-w-0 flex-1 flex-col gap-1">
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
      aria-label={
        profile
          ? `ETF 캠퍼스 전공: ${profile.name} (클릭하여 결과 보기 및 다시 진단)`
          : "ETF 전공 적성 점검 시작하기"
      }
      className="group inline-flex min-h-9 xl:min-h-10 w-auto shrink-0 items-center gap-1.5 xl:gap-2 rounded-full border border-brand-200 bg-brand-50/90 p-1 xl:px-3 xl:py-1 text-left text-brand-900 transition-all hover:border-brand-400 hover:bg-brand-100 hover:shadow-sm"
      onClick={() => window.dispatchEvent(new CustomEvent(STYLE_CHANGE_EVENT, { detail: { open: true } }))}
      title={profile ? `${profile.name} - 클릭하여 결과 확인 및 다시 진단` : "ETF 전공 적성 점검 시작하기"}
      type="button"
    >
      <span
        aria-hidden="true"
        className="grid size-7 xl:size-7.5 shrink-0 place-items-center rounded-full border border-brand-200/90 bg-white text-base xl:text-lg shadow-2xs transition-transform group-hover:scale-105 overflow-hidden"
      >
        {profile ? (
          <img src={profile.imagePath} alt={profile.name} className="size-full object-cover" />
        ) : (
          "🧭"
        )}
      </span>
      <span className="hidden xl:block min-w-0 flex-1">
        <span className="hidden 2xl:block text-[9.5px] font-extrabold tracking-[0.04em] text-brand-700 leading-none mb-0.5">
          {profile
            ? completedDiagnosis?.prescription
              ? "전공 적성 리포트"
              : "내 동물 확인"
            : "약 3분 · 13문항"}
        </span>
        <span className="block truncate text-xs font-extrabold text-strong">
          {profile ? profile.name : "추천 전공 찾기"}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="hidden shrink-0 text-brand-600 transition-transform group-hover:translate-x-0.5 xl:block text-xs font-bold"
      >
        ›
      </span>
    </button>
  );
}
