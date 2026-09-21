import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedSession: vi.fn(),
  adminSupabase: vi.fn(),
}));

vi.mock("../_lib/session", () => ({
  authenticatedSession: mocks.authenticatedSession,
  clearSessionHeaders: () => new Headers({ "Set-Cookie": "clear" }),
}));

vi.mock("../_lib/supabase", () => ({
  adminSupabase: mocks.adminSupabase,
}));

vi.mock("../_lib/api-security", () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

import { onRequestGet, onRequestDelete } from "./session.js";

describe("GET /api/community/auth/session", () => {
  it("미들웨어에서 전달된 context.data.session이 있으면 authenticatedSession을 중복 호출하지 않는다", async () => {
    mocks.authenticatedSession.mockClear();
    mocks.adminSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { public_nickname: "미들웨어캐시유저" } }),
          }),
        }),
      }),
    });

    const cachedSession = {
      user: { id: "user-cache-1", email: "test@example.com" },
      accessToken: "token-cache",
    };

    const context = {
      request: new Request("https://example.com/api/community/auth/session"),
      env: {},
      data: { session: cachedSession },
    };

    const response = await onRequestGet(context as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.authenticated).toBe(true);
    expect(body.user.displayName).toBe("미들웨어캐시유저");
    expect(body.user.email).toBe("test@example.com");
    // 중복 인증 조회가 방지되었는지 확인
    expect(mocks.authenticatedSession).not.toHaveBeenCalled();
  });

  it("context.data.session이 없으면 authenticatedSession을 직접 호출하여 인증을 수행한다", async () => {
    mocks.authenticatedSession.mockResolvedValueOnce({
      user: { id: "user-direct-1", email: "direct@example.com" },
      accessToken: "token-direct",
    });
    mocks.adminSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { public_nickname: "직접조회유저" } }),
          }),
        }),
      }),
    });

    const context = {
      request: new Request("https://example.com/api/community/auth/session"),
      env: {},
      data: {},
    };

    const response = await onRequestGet(context as any);
    expect(response.status).toBe(200);
    expect(mocks.authenticatedSession).toHaveBeenCalled();
    const body = await response.json();
    expect(body.user.displayName).toBe("직접조회유저");
  });

  it("OAuth 내부 이메일은 노출하지 않고 isOAuth: true로 응답한다", async () => {
    const oauthSession = {
      user: { id: "user-oauth-1", email: "kakao_12345@oauth.etfcampus.kr" },
      accessToken: "token-oauth",
    };

    mocks.adminSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { public_nickname: "카카오투자자" } }),
          }),
        }),
      }),
    });

    const context = {
      request: new Request("https://example.com/api/community/auth/session"),
      env: {},
      data: { session: oauthSession },
    };

    const response = await onRequestGet(context as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.isOAuth).toBe(true);
    expect(body.user.email).toBeNull();
  });

  it("session.error가 존재하는 경우 해당 에러 응답을 그대로 반환한다", async () => {
    const errorResponse = Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    mocks.authenticatedSession.mockResolvedValueOnce({ error: errorResponse });

    const context = {
      request: new Request("https://example.com/api/community/auth/session"),
      env: {},
      data: {},
    };

    const response = await onRequestGet(context as any);
    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/community/auth/session", () => {
  it("로그아웃 시 signedOut: true와 쿠키 만료 헤더를 반환한다", async () => {
    const response = await onRequestDelete();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.signedOut).toBe(true);
    expect(response.headers.get("Set-Cookie")).toBe("clear");
  });
});
