import { describe, expect, it } from "vitest";
import {
  clearOAuthStateCookie,
  constantTimeEqual,
  createOAuthStateCookie,
  generateTxId,
  hashTxId,
  OAUTH_STATE_COOKIE,
  parseOAuthCookie,
  signOAuthState,
  verifyOAuthState,
} from "./oauth-state";

describe("oauth-state", () => {
  const secret = "test-super-secret-key-for-oauth-state-123456";

  it("generates unique 64-char hex txIds and hashes them", async () => {
    const tx1 = generateTxId();
    const tx2 = generateTxId();
    expect(tx1).toHaveLength(64);
    expect(tx2).toHaveLength(64);
    expect(tx1).not.toBe(tx2);

    const hash1 = await hashTxId(tx1);
    expect(hash1).toHaveLength(64);
    expect(hash1).not.toBe(tx1);
  });

  it("constantTimeEqual accurately tests equality", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });

  it("signs and verifies valid OAuth state", async () => {
    const txId = generateTxId();
    const payload = {
      version: 1,
      txId,
      provider: "kakao",
      origin: "https://www.etfcampus.kr",
      expiresAt: Date.now() + 60_000,
    };

    const signed = await signOAuthState(secret, payload);
    expect(signed).toContain(".");

    const verified = await verifyOAuthState(secret, signed, txId);
    expect(verified).not.toBeNull();
    expect(verified?.provider).toBe("kakao");
    expect(verified?.origin).toBe("https://www.etfcampus.kr");
    expect(verified?.txId).toBe(txId);
  });

  it("rejects tampered signature or payload", async () => {
    const txId = generateTxId();
    const payload = { version: 1, txId, provider: "kakao", expiresAt: Date.now() + 60_000 };
    const signed = await signOAuthState(secret, payload);
    const [body, sig] = signed.split(".");

    // Tamper body
    const tamperedBody = body.slice(0, -2) + "==";
    const res1 = await verifyOAuthState(secret, `${tamperedBody}.${sig}`, txId);
    expect(res1).toBeNull();

    // Tamper signature
    const tamperedSig = sig.replace(/[0-9]/, "a");
    const res2 = await verifyOAuthState(secret, `${body}.${tamperedSig}`, txId);
    expect(res2).toBeNull();
  });

  it("rejects expired state or mismatched txId", async () => {
    const txId = generateTxId();
    const expiredPayload = { version: 1, txId, provider: "naver", expiresAt: Date.now() - 1000 };
    const signedExpired = await signOAuthState(secret, expiredPayload);

    const res1 = await verifyOAuthState(secret, signedExpired, txId);
    expect(res1).toBeNull();

    const validPayload = { version: 1, txId, provider: "naver", expiresAt: Date.now() + 60_000 };
    const signedValid = await signOAuthState(secret, validPayload);

    const res2 = await verifyOAuthState(secret, signedValid, "different-tx-id");
    expect(res2).toBeNull();
  });

  it("serializes, parses and clears cookies correctly", () => {
    const signedValue = "testpayload.testsig";
    const cookie = createOAuthStateCookie(signedValue, 600);
    expect(cookie).toContain(`${OAUTH_STATE_COOKIE}=${signedValue}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=600");

    const parsed = parseOAuthCookie(`other=123; ${OAUTH_STATE_COOKIE}=${signedValue}; another=456`);
    expect(parsed).toBe(signedValue);

    const cleared = clearOAuthStateCookie();
    expect(cleared).toContain("Max-Age=0");
  });
});
