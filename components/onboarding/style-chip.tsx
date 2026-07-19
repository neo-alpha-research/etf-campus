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
  const label = stored?.status === "completed" ? STYLE_PROFILES[stored.style].name : "내 스타일";
  return <button className="chip max-w-36 truncate" onClick={() => window.dispatchEvent(new CustomEvent(STYLE_CHANGE_EVENT, { detail: { open: true } }))} type="button">{label}</button>;
}
