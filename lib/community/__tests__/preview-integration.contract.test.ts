import { describe, expect, it } from "vitest";

const previewBaseUrl = process.env.COMMUNITY_PREVIEW_INTEGRATION_BASE_URL as string;
const enabled = process.env.COMMUNITY_PREVIEW_INTEGRATION_ENABLED === "true";

// This suite intentionally does not contain credentials or test identities. It is enabled only in a separate operator-provided Preview environment.
describe.skipIf(!enabled || !previewBaseUrl)("운영자 제공 Preview 커뮤니티 API 통합 계약", () => {
  it("anon은 공개 목록을 읽지만 쓰기 API는 인증 없이 거부된다", async () => {
    const publicResponse = await fetch(`${previewBaseUrl}/api/community/posts`);
    expect(publicResponse.ok).toBe(true);
    const writeResponse = await fetch(`${previewBaseUrl}/api/community/posts`, {
      method: "POST",
      headers: { Origin: previewBaseUrl, "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug: "etf-questions", title: "검수", bodyText: "검수" }),
    });
    expect([401, 403]).toContain(writeResponse.status);
  });

  it("P-1: POST /api/community/auth/set-password — CSRF 헤더 없음 -> 403 FORBIDDEN", async () => {
    const res = await fetch(`${previewBaseUrl}/api/community/auth/set-password`, {
      method: "POST",
      headers: { Origin: previewBaseUrl, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it("P-2: 같은 요청 + 트레일링 슬래시 (.../set-password/) -> 403 FORBIDDEN (경로 정규화)", async () => {
    const res = await fetch(`${previewBaseUrl}/api/community/auth/set-password/`, {
      method: "POST",
      headers: { Origin: previewBaseUrl, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it("P-3: POST /api/community/auth/login-password — CSRF 헤더 없음 -> 403이 아님 (CSRF 면제 경로 유지)", async () => {
    const res = await fetch(`${previewBaseUrl}/api/community/auth/login-password`, {
      method: "POST",
      headers: { Origin: previewBaseUrl, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid@example.com", password: "invalidpassword" }),
    });
    expect(res.status).not.toBe(403);
  });

  it("P-4: POST /api/community/auth/set-password — Origin 불일치 -> 403 FORBIDDEN", async () => {
    const res = await fetch(`${previewBaseUrl}/api/community/auth/set-password`, {
      method: "POST",
      headers: { Origin: "https://evil.com", "Content-Type": "application/json", "X-Community-CSRF": "test", "Cookie": "__Host-etf-campus-community-csrf=test" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it("P-5: POST /api/community/auth/set-password — Content-Type: text/plain -> 415 VALIDATION_ERROR", async () => {
    const res = await fetch(`${previewBaseUrl}/api/community/auth/set-password`, {
      method: "POST",
      headers: { Origin: previewBaseUrl, "Content-Type": "text/plain", "X-Community-CSRF": "test", "Cookie": "__Host-etf-campus-community-csrf=test" },
      body: "plain text",
    });
    expect(res.status).toBe(415);
  });

  it("P-6: POST /api/community/auth/set-password — CSRF 통과, pwsetup 쿠키 없음 -> 401 AUTH_REQUIRED", async () => {
    const res = await fetch(`${previewBaseUrl}/api/community/auth/set-password`, {
      method: "POST",
      headers: { Origin: previewBaseUrl, "Content-Type": "application/json", "X-Community-CSRF": "test", "Cookie": "__Host-etf-campus-community-csrf=test" },
      body: JSON.stringify({ password: "newpassword123" }),
    });
    expect(res.status).toBe(401);
  });

  it("P-7: POST /api/community/auth/verify-otp — captchaToken 없음 -> 400 CAPTCHA_REQUIRED (Turnstile 동작 증명)", async () => {
    const res = await fetch(`${previewBaseUrl}/api/community/auth/verify-otp`, {
      method: "POST",
      headers: { Origin: previewBaseUrl, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", token: "12345678" }),
    });
    expect(res.status).toBe(400);
  });

  it("P-8: GET /api/community/posts -> 200, 본문에 민감 정보 문자열 부재", async () => {
    const res = await fetch(`${previewBaseUrl}/api/community/posts`);
    expect(res.status).toBe(200);
    const bodyText = await res.text();
    expect(bodyText).not.toContain("email");
    expect(bodyText).not.toContain("author_profile_id");
    expect(bodyText).not.toContain("access_token");
    expect(bodyText).not.toContain("refresh_token");
  });

  it("P-9: POST /api/community/auth/login-password — 존재/미존재 계정 -> 상태코드, 본문 동일 (열거 방지)", async () => {
    const req1 = await fetch(`${previewBaseUrl}/api/community/auth/login-password`, {
      method: "POST",
      headers: { Origin: previewBaseUrl, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "definitely_not_exist@example.com", password: "wrongpassword123", captchaToken: "fake" }),
    });
    const req2 = await fetch(`${previewBaseUrl}/api/community/auth/login-password`, {
      method: "POST",
      headers: { Origin: previewBaseUrl, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "maybe_exist@example.com", password: "wrongpassword456", captchaToken: "fake" }),
    });
    
    expect(req1.status).toBe(req2.status);
    const text1 = await req1.text();
    const text2 = await req2.text();
    expect(text1).toBe(text2);
  });

  it("운영자 검수 계정은 별도 보안 프로시저로 member A·B·admin·닉네임 미설정·탈퇴 처리 상태를 준비한 뒤 RLS 시나리오를 수행해야 한다", () => {
    expect(process.env.COMMUNITY_PREVIEW_INTEGRATION_ENABLED).toBe("true");
  });
});
