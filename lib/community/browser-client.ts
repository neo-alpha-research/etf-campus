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
  browserStorage()?.removeItem("etf-campus:local-session");
}

function acceptCsrf(response: Response) {
  const token = response.headers?.get ? response.headers.get("X-Community-CSRF") : null;
  if (token) csrfToken = token;
}

export async function refreshCommunitySession() {
  try {
    const response = await fetch("/api/community/auth/session", { credentials: "same-origin", headers: { Accept: "application/json" } });
    acceptCsrf(response);
    if (!response.ok) {
      const local = browserStorage()?.getItem("etf-campus:local-session");
      if (local && typeof window !== "undefined" && window.location.hostname === "localhost") {
        authenticated = true;
        csrfToken = "local-dev-csrf-token";
        return true;
      }
      clearCommunitySession();
      return false;
    }
    authenticated = true;
    return true;
  } catch {
    const local = browserStorage()?.getItem("etf-campus:local-session");
    if (local && typeof window !== "undefined" && window.location.hostname === "localhost") {
      authenticated = true;
      csrfToken = "local-dev-csrf-token";
      return true;
    }
    clearCommunitySession();
    return false;
  }
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

export async function communityFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
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

  let response: Response;
  let body: any = null;

  try {
    response = await fetch(path, { ...init, method, headers, credentials: "same-origin" });
    acceptCsrf(response);
    const contentType = response.headers?.get ? response.headers.get("content-type") || "" : "";
    if (contentType.includes("application/json")) {
      body = await response.json().catch(() => null);
    }
  } catch {
    response = new Response(null, { status: 500 });
  }

  // Local development mock fallback when backend Cloudflare Pages Functions are not bound in next dev
  if ((!response.ok || !body) && typeof window !== "undefined" && window.location.hostname === "localhost") {
    if (path === "/api/community/auth/login-password" && method === "POST") {
      let parsedBody: Record<string, unknown> = {};
      try { parsedBody = typeof init.body === "string" ? JSON.parse(init.body) : ((init.body as unknown) as Record<string, unknown>) || {}; } catch {}
      const userEmail = typeof parsedBody?.email === "string" ? parsedBody.email : "user@etfcampus.com";
      const nickname = userEmail.split("@")[0] || "테스트투자자";
      browserStorage()?.setItem("etf-campus:local-session", JSON.stringify({ email: userEmail, nickname, authenticated: true }));
      authenticated = true;
      csrfToken = "local-dev-csrf-token";
      return { success: true } as unknown as T;
    }

    if (path === "/api/community/auth/profile" && method === "GET") {
      const localStr = browserStorage()?.getItem("etf-campus:local-session");
      const local = localStr ? JSON.parse(localStr) : null;
      return {
        profileConfigured: true,
        profile: {
          nickname: local?.nickname || "테스트투자자",
          email: local?.email || "user@etfcampus.com",
        }
      } as unknown as T;
    }

    if (path === "/api/community/auth/session" && method === "GET") {
      const localStr = browserStorage()?.getItem("etf-campus:local-session");
      if (localStr) {
        authenticated = true;
        csrfToken = "local-dev-csrf-token";
        return { authenticated: true } as unknown as T;
      }
    }

    if (path.startsWith("/api/community/posts") && method === "POST") {
      return { success: true, slug: "local-new-post-" + Date.now() } as unknown as T;
    }

    if (path.includes("/upvote") && method === "POST") {
      return { success: true, upvoteCount: 43, isUpvoted: true } as unknown as T;
    }

    if (path.includes("/comments") && method === "POST") {
      let parsedBody: Record<string, unknown> = {};
      try { parsedBody = typeof init.body === "string" ? JSON.parse(init.body) : ((init.body as unknown) as Record<string, unknown>) || {}; } catch {}
      return {
        success: true,
        comment: {
          publicId: "c-" + Date.now(),
          bodyText: typeof parsedBody?.bodyText === "string" ? parsedBody.bodyText : "",
          authorNickname: "내닉네임",
          createdAt: new Date().toISOString(),
        },
      } as unknown as T;
    }
  }

  if (!response.ok) {
    const errBody = body as { error?: { message?: string; code?: string } } | null;
    const error = new Error(errBody?.error?.message ?? "요청을 처리하지 못했습니다.") as Error & { status?: number; code?: string; body?: unknown };
    error.status = response.status;
    error.code = errBody?.error?.code;
    error.body = body;
    throw error;
  }
  return body as T;
}

export async function signOutCommunity() {
  try { await communityFetch("/api/community/auth/account", { method: "POST", body: JSON.stringify({}) }); }
  catch {}
  finally { clearCommunitySession(); }
}
