import { describe, expect, it, vi } from "vitest";
import { onRequest } from "./_middleware.js";

const mocks = vi.hoisted(() => ({
  authenticatedSession: vi.fn(),
  requestSessionTokens: vi.fn(() => ({ accessToken: "test-token", refreshToken: null })),
}));

vi.mock("./_lib/session", () => ({
  mergeSessionHeaders: (response, _session) => {
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
  requestSessionTokens: mocks.requestSessionTokens,
}));

function createContext(pathname, method, headers = {}) {
  const url = new URL(`https://example.com${pathname}`);
  const reqHeaders = new Headers(headers);
  return {
    request: new Request(url, { method, headers: reqHeaders }),
    next: vi.fn(async () => {
      return new Response("ok", { 
        status: 200, 
        headers: { "X-Community-CSRF": "new-csrf-from-handler" }
      });
    }),
  };
}

describe("커뮤니티 미들웨어", () => {
  it("T-6: CSRF 요구 경로에서 CSRF 헤더가 없으면 403을 반환한다 (posts)", async () => {
    const ctx = createContext("/api/community/posts", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json"
    });
    mocks.authenticatedSession.mockResolvedValue({ error: null });
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
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Community-CSRF")).toBe("new-csrf-from-handler");
  });

  it("T-7: 트레일링 슬래시가 있어도 정규화되어 동일하게 판정한다", async () => {
    const ctx1 = createContext("/api/community/posts", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json"
    });
    mocks.authenticatedSession.mockResolvedValue({ error: null });
    const res1 = await onRequest(ctx1);
    expect(res1.status).toBe(403);

    const ctx2 = createContext("/api/community/posts/", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json"
    });
    const res2 = await onRequest(ctx2);
    expect(res2.status).toBe(403);
  });

  it("T-8: set-password는 PUBLIC_AUTH_PATHS이므로 액세스 토큰 없이도 401을 반환하지 않고 핸들러에 도달한다", async () => {
    const ctx = createContext("/api/community/auth/set-password", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json",
      "X-Community-CSRF": "valid",
      "Cookie": "__Host-etf-campus-community-csrf=valid"
    });
    await onRequest(ctx);
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

  it("T-10: Refresh 쿠키만 있고 Access 쿠키가 없을 때 보호 API 요청 시 401로 조기 거부하지 않고 authenticatedSession을 호출해 갱신을 시도한다", async () => {
    mocks.requestSessionTokens.mockReturnValueOnce({ accessToken: null, refreshToken: "valid-refresh-token" });
    const fakeSession = { accessToken: "new-access-token", user: { id: "user-123" } };
    mocks.authenticatedSession.mockResolvedValueOnce(fakeSession);

    const ctx = createContext("/api/community/posts", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json",
      "X-Community-CSRF": "valid-csrf",
    });

    const response = await onRequest(ctx as any);
    expect(mocks.authenticatedSession).toHaveBeenCalled();
    expect(response.status).toBe(200);
    // context.data.session에 세션 정보가 정상 캐싱되었는지 확인
    expect((ctx as any).data?.session).toEqual(fakeSession);
  });

  it("T-11: Access/Refresh 쿠키가 둘 다 없는 경우 보호 API 요청 시 authenticatedSession 호출 없이 즉시 401을 반환한다", async () => {
    mocks.requestSessionTokens.mockReturnValueOnce({ accessToken: null, refreshToken: null });
    mocks.authenticatedSession.mockClear();

    const ctx = createContext("/api/community/posts", "POST", {
      Origin: "https://example.com",
      "Content-Type": "application/json",
      "X-Community-CSRF": "valid-csrf",
    });

    const response = await onRequest(ctx as any);
    expect(response.status).toBe(401);
    expect(mocks.authenticatedSession).not.toHaveBeenCalled();
  });
});
