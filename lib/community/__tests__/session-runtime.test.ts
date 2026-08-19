import { describe, expect, it } from "vitest";
import { clearSessionHeaders, clearSessionResponse, mergeSessionHeaders, sessionHeaders } from "../../../functions/api/community/_lib/session.js";

function setCookies(headers: Headers) {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  return typeof withGetSetCookie.getSetCookie === "function" ? withGetSetCookie.getSetCookie() : (headers.get("Set-Cookie") ?? "").split(/,(?=__Host-)/).filter(Boolean);
}

describe("커뮤니티 HttpOnly 세션 런타임 계약", () => {
  it("성공 세션은 access·refresh·CSRF를 서로 분리된 세 쿠키로 설정한다", () => {
    const headers = sessionHeaders({ access_token: "access", refresh_token: "refresh" }, "csrf");
    const cookies = setCookies(headers);
    expect(cookies).toHaveLength(4);
    expect(cookies[0]).toContain("__Host-etf-campus-community-at=access");
    expect(cookies[1]).toContain("__Host-etf-campus-community-rt=refresh");
    expect(cookies[2]).toContain("__Host-etf-campus-community-csrf=csrf");
    for (const cookie of cookies) {
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).not.toContain("Domain=");
    }
    expect(cookies[0]).toContain("HttpOnly");
    expect(cookies[1]).toContain("HttpOnly");
    expect(cookies[2]).not.toContain("HttpOnly");
    expect(headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("세션 갱신 헤더와 기존 응답의 복수 Set-Cookie를 합치지 않는다", () => {
    const response = new Response(JSON.stringify({ ok: true }), { headers: { "Set-Cookie": "existing=value; Path=/" } });
    const session = { headers: new Headers({ "Cache-Control": "private, no-store", "X-Community-CSRF": "csrf" }), cookies: ["a=1; Path=/", "b=2; Path=/", "c=3; Path=/"] };
    const merged = mergeSessionHeaders(response, session);
    expect(setCookies(merged.headers)).toEqual(expect.arrayContaining(["existing=value; Path=/", "a=1; Path=/", "b=2; Path=/", "c=3; Path=/"]));
  });

  it("로그아웃·만료 처리 시 세 쿠키를 모두 즉시 만료한다", () => {
    const headers = clearSessionHeaders();
    const cookies = setCookies(headers);
    expect(cookies).toHaveLength(4);
    expect(cookies.every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
    const response = clearSessionResponse(new Response(JSON.stringify({ error: true }), { status: 401 }));
    expect(setCookies(response.headers)).toHaveLength(4);
  });
});
