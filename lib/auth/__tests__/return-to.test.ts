import { describe, expect, it } from "vitest";
import { safeReturnTo, withReturnTo } from "../return-to";

describe("safeReturnTo", () => {
  it("allows safe internal paths and query parameters", () => {
    expect(safeReturnTo("/compare")).toBe("/compare");
    expect(safeReturnTo("/etf/069500")).toBe("/etf/069500");
    expect(safeReturnTo("/explore?q=kodex&tab=returns#chart")).toBe("/explore?q=kodex&tab=returns#chart");
  });

  it("falls back for null, undefined, or empty values", () => {
    expect(safeReturnTo(null)).toBe("/");
    expect(safeReturnTo(undefined)).toBe("/");
    expect(safeReturnTo("")).toBe("/");
    expect(safeReturnTo("   ")).toBe("/");
    expect(safeReturnTo(null, "/fallback")).toBe("/fallback");
  });

  it("blocks protocol-relative URLs and open redirect attempts", () => {
    expect(safeReturnTo("//evil.com")).toBe("/");
    expect(safeReturnTo("//evil.com/phishing")).toBe("/");
    expect(safeReturnTo("https://evil.com")).toBe("/");
    expect(safeReturnTo("http://evil.com")).toBe("/");
    expect(safeReturnTo("javascript:alert(1)")).toBe("/");
  });

  it("blocks backslash and encoded backslash tricks", () => {
    expect(safeReturnTo("/\\evil.com")).toBe("/");
    expect(safeReturnTo("/%5cevil.com")).toBe("/");
    expect(safeReturnTo("/test\\path")).toBe("/");
  });

  it("blocks control characters and null bytes", () => {
    expect(safeReturnTo("/test\x00path")).toBe("/");
    expect(safeReturnTo("/test%00path")).toBe("/");
    expect(safeReturnTo("/test\r\nheader")).toBe("/");
  });

  it("blocks sensitive auth and API endpoints from returnTo", () => {
    expect(safeReturnTo("/api/community/auth/session")).toBe("/");
    expect(safeReturnTo("/api/some-endpoint")).toBe("/");
    expect(safeReturnTo("/login")).toBe("/");
    expect(safeReturnTo("/login/")).toBe("/");
    expect(safeReturnTo("/register")).toBe("/");
    expect(safeReturnTo("/auth/callback")).toBe("/");
  });

  it("enforces max length constraint", () => {
    const tooLong = "/" + "a".repeat(600);
    expect(safeReturnTo(tooLong)).toBe("/");
  });

  it("properly formats withReturnTo", () => {
    expect(withReturnTo("/login", "/etf/069500")).toBe("/login?returnTo=%2Fetf%2F069500");
    expect(withReturnTo("/login", "//evil.com")).toBe("/login?returnTo=%2F");
  });
});
