"use client";

export type CommunityDraft = {
  categorySlug: string;
  title: string;
  bodyText: string;
  savedAt: string;
};

const DRAFT_KEY = "etf-campus:community:write-draft";
let authenticated = false;
let csrfToken: string | null = null;

function browserStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getCommunitySession() {
  return authenticated ? { authenticated: true } : null;
}

export function markCommunitySession() {
  authenticated = true;
}

export function clearCommunitySession() {
  authenticated = false;
  csrfToken = null;
}

function acceptCsrf(response: Response) {
  const token = response.headers.get("X-Community-CSRF");
  if (token) csrfToken = token;
}

export async function refreshCommunitySession() {
  const response = await fetch("/api/community/auth/session", { credentials: "same-origin", headers: { Accept: "application/json" } });
  acceptCsrf(response);
  if (!response.ok) {
    clearCommunitySession();
    return false;
  }
  authenticated = true;
  return true;
}

async function ensureCsrf() {
  if (csrfToken) return;
  const active = await refreshCommunitySession();
  if (!active || !csrfToken) throw new Error("로그인 상태가 만료되었습니다. 다시 로그인해 주세요.");
}

export function loadCommunityDraft(): CommunityDraft | null {
  try {
    const value = browserStorage()?.getItem(DRAFT_KEY);
    if (!value) return null;
    const draft = JSON.parse(value) as CommunityDraft;
    if (!draft.categorySlug || typeof draft.title !== "string" || typeof draft.bodyText !== "string") return null;
    return draft;
  } catch { return null; }
}

export function saveCommunityDraft(draft: Omit<CommunityDraft, "savedAt">) {
  browserStorage()?.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
}

export function clearCommunityDraft() {
  browserStorage()?.removeItem(DRAFT_KEY);
}

export async function communityFetch(path: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const unsafe = ["POST", "PATCH", "PUT", "DELETE"].includes(method);
  
  const isAuthStart = path.startsWith("/api/community/auth/request-otp") || 
                      path.startsWith("/api/community/auth/verify-otp") || 
                      path.startsWith("/api/community/auth/set-password") || 
                      path.startsWith("/api/community/auth/login-password");
                      
  if (unsafe && !isAuthStart) await ensureCsrf();

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (unsafe && csrfToken) headers.set("X-Community-CSRF", csrfToken);

  const response = await fetch(path, { ...init, method, headers, credentials: "same-origin" });
  acceptCsrf(response);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "요청을 처리하지 못했습니다.");
  return body;
}

export async function signOutCommunity() {
  try { await communityFetch("/api/community/auth/account", { method: "POST", body: JSON.stringify({}) }); }
  finally { clearCommunitySession(); }
}
