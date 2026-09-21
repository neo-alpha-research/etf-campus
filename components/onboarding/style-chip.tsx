"use client";

import { useSyncExternalStore } from "react";

import {
  parseStoredDiagnosis,
  STYLE_CHANGE_EVENT,
  STYLE_PROFILES,
  STYLE_STORAGE_KEY,
  STYLE_STORAGE_KEY_V3,
} from "@/lib/onboarding/style-diagnosis";

export function openStyleDiagnosis() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STYLE_CHANGE_EVENT, { detail: { open: true } }));
  }
}

export function useStyleDiagnosis() {
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

  const stored = raw !== "__server__" ? parseStoredDiagnosis(raw) : null;
  const completedDiagnosis = stored?.status === "completed" ? stored : null;
  const profile = completedDiagnosis ? STYLE_PROFILES[completedDiagnosis.style] : null;
  const isLoaded = raw !== "__server__";

  return {
    isLoaded,
    hasCompleted: Boolean(completedDiagnosis && profile),
    profile,
    label: profile ? "적성 리포트" : "적성 진단",
  };
}

export function StyleChip({ className = "" }: { className?: string }) {
  const { isLoaded, hasCompleted, profile, label } = useStyleDiagnosis();

  if (!isLoaded) {
    return (
      <div
        aria-hidden="true"
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-400 opacity-60 shrink-0 ${className}`}
      >
        <span className="grid size-5.5 shrink-0 place-items-center rounded-full bg-white text-xs shadow-2xs">
          🧭
        </span>
        <span className="h-3 w-14 rounded bg-neutral-200" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={openStyleDiagnosis}
      aria-label={
        hasCompleted
          ? `ETF 전공 적성 리포트 확인 및 다시 진단 (${profile?.name})`
          : "ETF 전공 적성 진단 시작하기"
      }
      title={hasCompleted ? `전공 적성: ${profile?.name}` : "나에게 맞는 ETF 투자 스타일 진단"}
      className={`group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50/90 px-2.5 py-1 text-xs font-extrabold text-brand-900 transition-all hover:border-brand-400 hover:bg-brand-100 hover:shadow-xs cursor-pointer ${className}`}
    >
      <span
        aria-hidden="true"
        className="grid size-5.5 shrink-0 place-items-center rounded-full border border-brand-200/90 bg-white text-xs shadow-2xs overflow-hidden transition-transform group-hover:scale-105"
      >
        {profile ? (
          <img src={profile.imagePath} alt="" className="size-full object-cover" />
        ) : (
          "🧭"
        )}
      </span>
      <span className="whitespace-nowrap tracking-tight">{label}</span>
    </button>
  );
}
