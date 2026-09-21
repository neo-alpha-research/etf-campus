import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearCommunitySession,
  communityFetch,
} from "../browser-client";

describe("browser-client communityFetch - Public Auth Whitelist & CSRF Protection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearCommunitySession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearCommunitySession();
  });

  it("비로그인 상태에서 카카오 OAuth 시작(/api/community/auth/oauth/kakao/start) 호출 시 세션 만료 에러 없이 정상 요청을 전송한다", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/community/auth/session") {
        return new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 });
      }
      if (url === "/api/community/auth/oauth/kakao/start") {
        return new Response(
          JSON.stringify({ authorizationUrl: "https://kauth.kakao.com/oauth/authorize?client_id=123" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    });
    global.fetch = mockFetch;

    const result = await communityFetch<{ authorizationUrl: string }>("/api/community/auth/oauth/kakao/start", {
      method: "POST",
      body: JSON.stringify({ returnTo: "/", rememberMe: true }),
    });

    expect(result.authorizationUrl).toContain("kauth.kakao.com");
    // 세션 검증(/api/community/auth/session)이 사전에 호출되지 않아야 함
    expect(mockFetch).not.toHaveBeenCalledWith("/api/community/auth/session", expect.anything());
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/community/auth/oauth/kakao/start",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
      })
    );
  });

  it("비로그인 상태에서 네이버 OAuth 시작(/api/community/auth/oauth/naver/start) 호출 시 세션 만료 에러 없이 정상 요청을 전송한다", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/community/auth/session") {
        return new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 });
      }
      if (url === "/api/community/auth/oauth/naver/start") {
        return new Response(
          JSON.stringify({ authorizationUrl: "https://nid.naver.com/oauth2.0/authorize?client_id=456" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    });
    global.fetch = mockFetch;

    const result = await communityFetch<{ authorizationUrl: string }>("/api/community/auth/oauth/naver/start", {
      method: "POST",
      body: JSON.stringify({ returnTo: "/profile", rememberMe: true }),
    });

    expect(result.authorizationUrl).toContain("nid.naver.com");
    expect(mockFetch).not.toHaveBeenCalledWith("/api/community/auth/session", expect.anything());
  });

  it("비로그인 상태에서 비밀번호 로그인(/api/community/auth/login-password) 호출 시에도 CSRF 검사 없이 요청된다", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/community/auth/login-password") {
        return new Response(
          JSON.stringify({ success: true, profileConfigured: true }),
          { status: 200, headers: { "Content-Type": "application/json", "X-Community-CSRF": "new-csrf-token" } }
        );
      }
      return new Response(null, { status: 404 });
    });
    global.fetch = mockFetch;

    const result = await communityFetch<{ success: boolean }>("/api/community/auth/login-password", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "pwd" }),
    });

    expect(result.success).toBe(true);
    expect(mockFetch).not.toHaveBeenCalledWith("/api/community/auth/session", expect.anything());
  });

  it("인증이 필요한 일반 POST 요청(/api/community/posts)은 비로그인 시 세션 만료 에러를 발생시킨다", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/community/auth/session") {
        return new Response(JSON.stringify({ authenticated: false }), { status: 401 });
      }
      return new Response(null, { status: 404 });
    });
    global.fetch = mockFetch;

    await expect(
      communityFetch("/api/community/posts", {
        method: "POST",
        body: JSON.stringify({ title: "새 글", bodyText: "본문" }),
      })
    ).rejects.toThrow("로그인 상태가 만료되었습니다. 다시 로그인해 주세요.");

    expect(mockFetch).toHaveBeenCalledWith("/api/community/auth/session", expect.anything());
  });

  it("지정된 timeoutMs 내에 응답이 없으면 408 TIMEOUT 에러를 발생시키고 요청을 취소한다", async () => {
    const mockFetch = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      return new Promise((resolve, reject) => {
        // options.signal에 abort 이벤트 리스너 등록
        options.signal?.addEventListener("abort", () => {
          const abortError = new Error("This operation was aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });
    global.fetch = mockFetch;

    await expect(
      communityFetch("/api/community/auth/profile", {
        method: "GET",
        timeoutMs: 50,
      })
    ).rejects.toMatchObject({
      status: 408,
      code: "TIMEOUT",
      message: expect.stringContaining("요청 시간이 초과되었습니다"),
    });
  });

  it("외부 AbortSignal이 취소되면 즉시 요청을 중단하고 취소 에러를 발생시킨다", async () => {
    const controller = new AbortController();
    const mockFetch = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      return new Promise((resolve, reject) => {
        options.signal?.addEventListener("abort", () => {
          const abortError = new Error("External aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });
    global.fetch = mockFetch;

    const fetchPromise = communityFetch("/api/community/auth/profile", {
      method: "GET",
      signal: controller.signal,
    });

    controller.abort(new Error("사용자가 작업을 취소했습니다."));

    await expect(fetchPromise).rejects.toMatchObject({
      status: 408,
      code: "ABORTED",
      message: "사용자가 작업을 취소했습니다.",
    });
  });
});
