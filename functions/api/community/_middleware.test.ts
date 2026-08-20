import { describe, expect, it, vi } from "vitest";
import { onRequest } from "./_middleware.js";

const mocks = vi.hoisted(() => ({
  authenticatedSession: vi.fn(),
}));

vi.mock("./_lib/session", () => ({
  mergeSessionHeaders: (response, session) => {
    const merged = new Headers(response.headers);
    merged.set("X-Community-CSRF", "old-csrf-from-session");
    merged.set("Set-Cookie", "session-cookie=val; HttpOnly");
    return new Response(response.body, { status: response.status, headers: merged });
  },
  authenticatedSession: mocks.authenticatedSession,
  enforceCsrf: vi.fn((context) => {
    if (!context.request.headers.get("X-Community-CSRF")) {
      return new Response("Forbidden", { status: 403 });
    }
    return null;
  }),
  requestSessionTokens: vi.fn(() => ({ accessToken: "test-token" })),
}));

function createContext(pathname, method, headers = {}) {
  const url = new URL(`https://example.com${pathname}`);
  const reqHeaders = new Headers(headers);
  return {
    request: new Request(url, { method, headers: reqHeaders }),
    next: vi.fn(async (req) => {
      return new Response("ok", { 
        status: 200, 
        headers: { "X-Community-CSRF": "new-csrf-from-handler" }
      });
    }),
  };
}

describe("커뮤니티 미들웨어", () => {
  it("T-6: CSRF 요구 경로에서 CSRF 헤더가 없으면 403을 반환한다 (set-password)", async () => {
    const ctx = createContext("/api/community/auth/set-password", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json"
    });
    const response = await onRequest(ctx);
    expect(response.status).toBe(403);
  });

  it("T-6: CSRF 면제 경로에서는 CSRF 헤더가 없어도 통과한다 (login-password)", async () => {
    const ctx = createContext("/api/community/auth/login-password", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json"
    });
    mocks.authenticatedSession.mockResolvedValue({ accessToken: "token", user: {} });
    const response = await onRequest(ctx);
    expect(response.status).toBe(200); // Calls next() and returns response directly (mergeSessionHeaders is skipped for PUBLIC_AUTH_PATHS)
    expect(response.headers.get("X-Community-CSRF")).toBe("new-csrf-from-handler"); // T-9: mergeSessionHeaders not applied
  });

  it("T-7: 트레일링 슬래시가 있어도 정규화되어 동일하게 판정한다", async () => {
    const ctx1 = createContext("/api/community/auth/set-password/", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json"
    });
    const res1 = await onRequest(ctx1);
    expect(res1.status).toBe(403);

    const ctx2 = createContext("/api/community/auth/login-password/", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json"
    });
    const res2 = await onRequest(ctx2);
    expect(res2.status).toBe(200);
  });

  it("T-8: set-password는 PUBLIC_AUTH_PATHS이므로 액세스 토큰 없이도 401을 반환하지 않고 핸들러에 도달한다", async () => {
    const ctx = createContext("/api/community/auth/set-password", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json",
      "X-Community-CSRF": "valid",
      "Cookie": "__Host-etf-campus-community-csrf=valid"
    });
    const response = await onRequest(ctx);
    expect(ctx.next).toHaveBeenCalled();
  });

  it("T-9: 액세스 쿠키를 가진 요청으로 set-password 성공 시 핸들러의 새 CSRF 토큰을 유지한다 (mergeSessionHeaders가 무시됨)", async () => {
    const ctx = createContext("/api/community/auth/set-password", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json",
      "X-Community-CSRF": "valid",
      "Cookie": "__Host-etf-campus-community-csrf=valid; __Host-etf-campus-community-session=old-access"
    });
    mocks.authenticatedSession.mockResolvedValue({ accessToken: "old-access", user: {} });
    const response = await onRequest(ctx);
    // Because it's PUBLIC_AUTH_PATHS, mergeSessionHeaders is skipped
    expect(response.headers.get("X-Community-CSRF")).toBe("new-csrf-from-handler");
  });
});
