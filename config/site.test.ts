import { describe, expect, it } from "vitest";

import { resolveSitePolicy, siteConfig } from "./site";

describe("siteConfig defaults", () => {
  it("keeps the service name and canonical defaults in one shared config", () => {
    expect(siteConfig.name).toBe("ETF 캠퍼스");
    expect(siteConfig.canonicalBaseUrl).toBe("https://etf-campus.pages.dev");
    expect(siteConfig.url).toBe("https://etf-campus.pages.dev");
  });
});

describe("resolveSitePolicy - Comprehensive Decision Matrix", () => {
  it("Case 1 [운영 허용]: 운영 브랜치(main)이고 색인 플래그가 명시적으로 true인 경우 색인을 허용한다", () => {
    const policy = resolveSitePolicy({
      CF_PAGES_BRANCH: "main",
      NEXT_PUBLIC_ALLOW_INDEXING: "true",
    });
    expect(policy.isProduction).toBe(true);
    expect(policy.allowSearchIndexing).toBe(true);
    expect(policy.showBetaBanner).toBe(false);
  });

  it("Case 2 [운영 차단 - 명시적 거부]: 운영 브랜치(main)라도 색인 플래그가 false이면 색인을 차단한다", () => {
    const policy = resolveSitePolicy({
      CF_PAGES_BRANCH: "main",
      NEXT_PUBLIC_ALLOW_INDEXING: "false",
    });
    expect(policy.isProduction).toBe(true);
    expect(policy.allowSearchIndexing).toBe(false);
  });

  it("Case 3 [운영 차단 - 플래그 누락 Fail-Closed]: 운영 브랜치(main)라도 색인 플래그가 누락되면 색인을 차단한다", () => {
    const policy = resolveSitePolicy({
      CF_PAGES_BRANCH: "main",
    });
    expect(policy.isProduction).toBe(true);
    expect(policy.allowSearchIndexing).toBe(false);
  });

  it("Case 4 [미리보기 차단 - 잘못된 플래그 주입 Fail-Closed]: 미리보기 브랜치에서는 색인 허용 플래그가 주입되어도 noindex를 강제한다", () => {
    const policy = resolveSitePolicy({
      CF_PAGES_BRANCH: "feature/preview-test",
      NEXT_PUBLIC_ALLOW_INDEXING: "true",
      ALLOW_INDEXING: "true",
    });
    expect(policy.isProduction).toBe(false);
    expect(policy.allowSearchIndexing).toBe(false);
  });

  it("Case 5 [미리보기 기본 차단]: 미리보기 브랜치에서는 기본적으로 색인이 차단된다", () => {
    const policy = resolveSitePolicy({
      CF_PAGES_BRANCH: "staging",
    });
    expect(policy.isProduction).toBe(false);
    expect(policy.allowSearchIndexing).toBe(false);
  });

  it("Case 6 [환경 누락 Fail-Closed]: CF_PAGES_BRANCH가 없는 환경(미확인)은 운영으로 간주하지 않고 색인을 차단한다", () => {
    const policy = resolveSitePolicy({
      NEXT_PUBLIC_ALLOW_INDEXING: "true",
    });
    expect(policy.isProduction).toBe(false);
    expect(policy.allowSearchIndexing).toBe(false);
  });

  it("Case 7 [잘못된 플래그 조합]: yes, 1, allowed 등 임의 문자열은 true로 인정하지 않고 차단한다", () => {
    expect(resolveSitePolicy({ CF_PAGES_BRANCH: "main", NEXT_PUBLIC_ALLOW_INDEXING: "yes" }).allowSearchIndexing).toBe(false);
    expect(resolveSitePolicy({ CF_PAGES_BRANCH: "main", NEXT_PUBLIC_ALLOW_INDEXING: "1" }).allowSearchIndexing).toBe(false);
    expect(resolveSitePolicy({ CF_PAGES_BRANCH: "main", NEXT_PUBLIC_ALLOW_INDEXING: "allowed" }).allowSearchIndexing).toBe(false);
    expect(resolveSitePolicy({ CF_PAGES_BRANCH: "main", NEXT_PUBLIC_ALLOW_INDEXING: " true " }).allowSearchIndexing).toBe(true);
  });

  it("Case 8 [비공개 ALLOW_INDEXING 폴백]: 운영 환경에서 ALLOW_INDEXING 환경변수로도 색인 허용이 가능하다", () => {
    const policy = resolveSitePolicy({
      CF_PAGES_BRANCH: "main",
      ALLOW_INDEXING: "true",
    });
    expect(policy.isProduction).toBe(true);
    expect(policy.allowSearchIndexing).toBe(true);
  });

  it("Case 9 [베타 배너 독립성]: NEXT_PUBLIC_BETA_MODE는 색인 정책 및 호스트명과 무관하게 독립 제어된다", () => {
    // 1. pages.dev 주소라도 베타 모드가 꺼져 있으면 배너 미노출
    const defaultPagesDev = resolveSitePolicy({
      NEXT_PUBLIC_SITE_URL: "https://etf-campus.pages.dev",
    });
    expect(defaultPagesDev.showBetaBanner).toBe(false);

    // 2. 명시적으로 켠 경우 배너 노출
    const betaEnabled = resolveSitePolicy({
      NEXT_PUBLIC_BETA_MODE: "true",
    });
    expect(betaEnabled.showBetaBanner).toBe(true);
    expect(betaEnabled.allowSearchIndexing).toBe(false); // 색인 정책에 영향을 주지 않음
  });

  it("Case 10 [Canonical Base URL 결정]: 기본값은 etf-campus.pages.dev이며 환경변수로 재정의 가능하다", () => {
    expect(resolveSitePolicy({}).canonicalBaseUrl).toBe("https://etf-campus.pages.dev");
    expect(resolveSitePolicy({ NEXT_PUBLIC_SITE_URL: "https://etfcampus.kr/" }).canonicalBaseUrl).toBe("https://etfcampus.kr");
  });

  it("Case 11 [배포 URL과 Canonical 분리]: 실제 배포 URL(CF_PAGES_URL)과 Canonical URL을 구분한다", () => {
    const policy = resolveSitePolicy({
      CF_PAGES_BRANCH: "feature/auth-preview",
      CF_PAGES_URL: "https://auth-preview.etf-campus.pages.dev/",
      NEXT_PUBLIC_SITE_URL: "https://etf-campus.pages.dev",
    });
    expect(policy.canonicalBaseUrl).toBe("https://etf-campus.pages.dev");
    expect(policy.deployUrl).toBe("https://auth-preview.etf-campus.pages.dev");
    expect(policy.isProduction).toBe(false);
    expect(policy.allowSearchIndexing).toBe(false);
  });
});
