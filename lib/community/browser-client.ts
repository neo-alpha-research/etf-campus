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

const UNAUTHENTICATED_AUTH_PATHS = new Set([
  "/api/community/auth/request-otp",
  "/api/community/auth/verify-otp",
  "/api/community/auth/set-password",
  "/api/community/auth/login-password",
  "/api/community/auth/oauth/kakao/start",
  "/api/community/auth/oauth/naver/start",
]);

export type CommunityFetchOptions = RequestInit & {
  timeoutMs?: number;
};

export async function communityFetch<T = any>(path: string, init: CommunityFetchOptions = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const unsafe = ["POST", "PATCH", "PUT", "DELETE"].includes(method);
  
  const cleanPath = path.split("?")[0];
  const isAuthStart = UNAUTHENTICATED_AUTH_PATHS.has(cleanPath);
                      
  if (unsafe && !isAuthStart) await ensureCsrf();

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (unsafe && csrfToken) headers.set("X-Community-CSRF", csrfToken);

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutMs = init.timeoutMs;

  if (typeof timeoutMs === "number" && timeoutMs > 0) {
    timer = setTimeout(() => {
      const timeoutError = new Error(`요청 시간이 초과되었습니다 (${timeoutMs}ms).`);
      timeoutError.name = "TimeoutError";
      controller.abort(timeoutError);
    }, timeoutMs);
  }

  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort(init.signal.reason);
    } else {
      init.signal.addEventListener("abort", () => {
        controller.abort(init.signal?.reason);
      }, { once: true });
    }
  }

  let response: Response;
  let body: any = null;

  try {
    const { timeoutMs: _ignored, ...fetchInit } = init;
    response = await fetch(path, { ...fetchInit, method, headers, credentials: "same-origin", signal: controller.signal });
    acceptCsrf(response);
    const contentType = response.headers?.get ? response.headers.get("content-type") || "" : "";
    if (contentType.includes("application/json")) {
      body = await response.json().catch(() => null);
    }
  } catch (fetchErr: unknown) {
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      const isTimeout =
        (reason instanceof Error && (reason.name === "TimeoutError" || reason.message.includes("초과"))) ||
        (fetchErr instanceof Error && (fetchErr.name === "TimeoutError" || fetchErr.message.includes("timeout")));
      const message = isTimeout
        ? "요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
        : reason instanceof Error
        ? reason.message
        : "요청이 취소되었습니다.";
      const timeoutErr = new Error(message) as Error & { status?: number; code?: string };
      timeoutErr.status = 408;
      timeoutErr.code = isTimeout ? "TIMEOUT" : "ABORTED";
      throw timeoutErr;
    }
    response = new Response(null, { status: 500 });
  } finally {
    if (timer) clearTimeout(timer);
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

    if (path.startsWith("/api/community/auth/oauth/") && method === "POST") {
      const provider = path.includes("naver") ? "naver" : "kakao";
      return {
        authorizationUrl: `https://mock-oauth.${provider}.com/oauth/authorize?state=mock-local-state`,
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
