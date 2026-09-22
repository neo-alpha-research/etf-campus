import { describe, expect, it } from "vitest";

import robots, { createRobots, DISALLOWED_SEARCH_PATHS } from "../robots";

describe("robots", () => {
  it("색인 허용 시(운영): 크롤링을 허용하고 관리자·계정·API 경로를 disallow에 포함하며 사이트맵 및 호스트를 명시한다", () => {
    const value = createRobots({
      canonicalBaseUrl: "https://etf-campus.pages.dev",
      allowSearchIndexing: true,
    });
    expect(value.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: [...DISALLOWED_SEARCH_PATHS],
    });
    expect(value.sitemap).toBe("https://etf-campus.pages.dev/sitemap.xml");
    expect(value.host).toBe("https://etf-campus.pages.dev");

    // 핵심 비공개/계정/관리자 경로가 disallow에 포함되어 있는지 검증
    expect(DISALLOWED_SEARCH_PATHS).toContain("/admin/");
    expect(DISALLOWED_SEARCH_PATHS).toContain("/login");
    expect(DISALLOWED_SEARCH_PATHS).toContain("/register");
    expect(DISALLOWED_SEARCH_PATHS).toContain("/forgot-password");
    expect(DISALLOWED_SEARCH_PATHS).toContain("/reset-password");
    expect(DISALLOWED_SEARCH_PATHS).toContain("/community/profile");
  });

  it("색인 불허 시(미리보기/미확인): 크롤러가 noindex 메타와 HTTP 헤더를 읽을 수 있도록 페이지 접근은 허용하되 사이트맵은 제출하지 않는다", () => {
    const value = createRobots({
      canonicalBaseUrl: "https://etf-campus.pages.dev",
      allowSearchIndexing: false,
    });
    expect(value.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: [...DISALLOWED_SEARCH_PATHS],
    });
    expect(value.sitemap).toBeUndefined();
    expect(value.host).toBeUndefined();
  });

  it("기본 robots() 함수는 siteConfig 정책을 올바르게 반영한다", () => {
    const value = robots();
    expect(value.rules).toBeDefined();
    // 로컬 기본 환경에서는 CF_PAGES_BRANCH가 없으므로 fail-closed(색인 불허)로 동작
    expect(value.sitemap).toBeUndefined();
  });
});
