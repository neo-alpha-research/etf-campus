import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(process.cwd(), "functions", "api", "community", "_lib", "request-security.js"), "utf8");

describe("Turnstile 및 OTP 속도 제한 보안 계약", () => {
  it("외부 Preview·production에서 Turnstile 우회를 구성 오류로 거부한다", () => {
    expect(source).toContain('env.COMMUNITY_ENVIRONMENT === "preview"');
    expect(source).toContain('env.TURNSTILE_REQUIRED === "true"');
  });

  it("server verify 응답에서 success·hostname·action·토큰 만료를 검증한다", () => {
    expect(source).toContain("result.success !== true");
    expect(source).toContain("!hostMatch");
    expect(source).toContain("result.action !== expectedAction");
    expect(source).toContain("5 * 60 * 1000");
  });

  it("검증 완료한 Turnstile 토큰을 해시 기반 단일 사용 제한으로 다시 기록한다", () => {
    expect(source).toContain('"turnstile-token"');
    expect(source).toContain("token, 1, 600");
    expect(source).toContain("COMMUNITY_RATE_LIMIT_SALT");
  });

  it("OTP 요청이 이메일·IP의 별도 제한 키를 모두 사용한다", () => {
    const otp = fs.readFileSync(path.join(process.cwd(), "functions", "api", "community", "auth", "request-otp.js"), "utf8");
    expect(otp).toContain('"otp-request-email"');
    expect(otp).toContain('"otp-request-ip"');
    expect(otp).toContain("CF-Connecting-IP");
  });

  it("운영 환경에서 테스트용 Turnstile 시크릿 키 및 클라이언트 토큰을 엄격히 거부한다", () => {
    expect(source).toContain('env.COMMUNITY_ENVIRONMENT === "production" && env.TURNSTILE_SECRET_KEY === CLOUDFLARE_TEST_SECRET_KEY');
    expect(source).toContain("isProduction && CLOUDFLARE_TEST_TOKENS.has(token)");
    expect(source).toContain("isServerTestMode && (result.hostname === \"localhost\" || result.hostname === \"example.com\" || result.hostname === \"dummy\")");
  });
});
