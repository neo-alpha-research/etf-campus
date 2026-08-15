"use client";

export type CommunitySession = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
};

export type CommunityDraft = {
  categorySlug: string;
  title: string;
  bodyText: string;
  savedAt: string;
};

const SESSION_KEY = "etf-campus:community:session";
const DRAFT_KEY = "etf-campus:community:write-draft";

function browserStorage(type: "session" | "local") {
  if (typeof window === "undefined") return null;
  return type === "session" ? window.sessionStorage : window.localStorage;
}

export function getCommunitySession(): CommunitySession | null {
  try {
    const value = browserStorage("session")?.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as CommunitySession;
    if (!session.accessToken || !session.refreshToken) return null;
    return session;
  } catch {
    return null;
  }
}

export function saveCommunitySession(session: CommunitySession) {
  browserStorage("session")?.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearCommunitySession() {
  browserStorage("session")?.removeItem(SESSION_KEY);
}

export function loadCommunityDraft(): CommunityDraft | null {
  try {
    const value = browserStorage("local")?.getItem(DRAFT_KEY);
    if (!value) return null;
    const draft = JSON.parse(value) as CommunityDraft;
    if (!draft.categorySlug || typeof draft.title !== "string" || typeof draft.bodyText !== "string") return null;
    return draft;
  } catch {
    return null;
  }
}

export function saveCommunityDraft(draft: Omit<CommunityDraft, "savedAt">) {
  browserStorage("local")?.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
}

export function clearCommunityDraft() {
  browserStorage("local")?.removeItem(DRAFT_KEY);
}

export async function communityFetch(path: string, init: RequestInit = {}) {
  const session = getCommunitySession();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);

  const response = await fetch(path, { ...init, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? "요청을 처리하지 못했습니다.");
  }
  return body;
}

export async function signOutCommunity() {
  try {
    await communityFetch("/api/community/auth/account", { method: "POST" });
  } finally {
    clearCommunitySession();
  }
}
