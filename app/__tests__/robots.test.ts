import { describe, expect, it } from "vitest";

import robots, { createRobots, DISALLOWED_ROBOTS_PATHS } from "../robots";

describe("robots", () => {
  it("noindex를 가진 HTML 경로가 robots.txt의 Disallow 규칙에 의해 크롤링 차단되지 않아야 한다 (noindex-Disallow 정책 충돌 회귀 검출)", () => {
    const value = createRobots({
      canonicalBaseUrl: "https://etf-campus.pages.dev",
      allowSearchIndexing: true,
    });

    const disallowedRules = Array.isArray(value.rules)
      ? value.rules.flatMap((r) => (Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : []))
      : Array.isArray(value.rules.disallow)
        ? value.rules.disallow
        : value.rules.disallow
          ? [value.rules.disallow]
          : [];

    // noindex 메타데이터가 적용된 HTML 경로 목록
    const noindexHtmlPaths = [
      "/admin/",
      "/admin/market-briefings",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/community/profile",
      "/community/write",
      "/community/read",
    ];

    // Google 지침: 검색봇이 noindex 지시어를 읽을 수 있도록 HTML 페이지는 robots.txt에서 Disallow되면 안 됨
    for (const htmlPath of noindexHtmlPaths) {
      const isBlockedByRobots = disallowedRules.some((rule) => {
        if (rule.endsWith("/")) {
          return htmlPath.startsWith(rule);
        }
        return htmlPath === rule || htmlPath.startsWith(rule + "/");
      });
      expect(isBlockedByRobots).toBe(false);
    }
  });

  it("색인 허용 시(운영): 비HTML API 경로는 disallow하되 HTML 페이지는 크롤링을 허용하고 사이트맵 및 호스트를 명시한다", () => {
    const value = createRobots({
      canonicalBaseUrl: "https://etf-campus.pages.dev",
      allowSearchIndexing: true,
    });
    expect(value.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: [...DISALLOWED_ROBOTS_PATHS],
    });
    expect(value.sitemap).toBe("https://etf-campus.pages.dev/sitemap.xml");
    expect(value.host).toBe("https://etf-campus.pages.dev");

    // 비HTML API 엔드포인트는 disallow에 포함되어야 함
    expect(DISALLOWED_ROBOTS_PATHS).toContain("/api/");
  });

  it("색인 불허 시(미리보기/미확인): 크롤러가 noindex 메타와 HTTP 헤더를 읽을 수 있도록 페이지 접근은 허용하되 사이트맵은 제출하지 않는다", () => {
    const value = createRobots({
      canonicalBaseUrl: "https://etf-campus.pages.dev",
      allowSearchIndexing: false,
    });
    expect(value.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: [...DISALLOWED_ROBOTS_PATHS],
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
