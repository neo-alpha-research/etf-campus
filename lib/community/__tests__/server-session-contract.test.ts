import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (...segments: string[]) => fs.readFileSync(path.join(root, ...segments), "utf8");

describe("커뮤니티 서버 관리 세션 계약", () => {
  it("브라우저 클라이언트는 access 또는 refresh token을 저장하지 않는다", () => {
    const source = read("lib", "community", "browser-client.ts");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("accessToken:");
    expect(source).not.toContain("refreshToken:");
    expect(source).toContain("credentials: \"same-origin\"");
  });

  it("OTP 검증 응답은 토큰 JSON이 아닌 HttpOnly 보안 쿠키만 설정한다", () => {
    const source = read("functions", "api", "community", "auth", "verify-otp.js");
    expect(source).toContain("sessionHeaders(data.session)");
    expect(source).toContain("authenticated: true");
    expect(source).not.toContain("accessToken:");
    expect(source).not.toContain("refreshToken:");
  });

  it("세션 쿠키는 host-only, Secure, HttpOnly, SameSite=Lax로 설정한다", () => {
    const source = read("functions", "api", "community", "_lib", "session.js");
    expect(source).toContain("__Host-etf-campus-community-at");
    expect(source).toContain("serializeCookie");
    expect(source).toContain('"Secure"');
    expect(source).toContain('"SameSite=Lax"');
    expect(source).toContain("HttpOnly");
    expect(source).toContain("Cache-Control\": \"private, no-store");
  });

  it("변경 요청 미들웨어는 동일 출처·JSON·CSRF 검증을 요구한다", () => {
    const source = read("functions", "api", "community", "_middleware.js");
    expect(source).toContain("isSameOrigin");
    expect(source).toContain("application/json");
    expect(source).toContain("enforceCsrf");
  });
});
