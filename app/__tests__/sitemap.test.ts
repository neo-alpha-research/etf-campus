import { describe, expect, it } from "vitest";

import { siteConfig } from "@/config/site";
import { loadBriefings } from "@/lib/content/briefings";
import { loadBooks, loadExternalBooks, loadGuides } from "@/lib/content/learning-content";
import { loadEtfs } from "@/lib/data/etf-repository";
import { STYLE_PROFILES } from "@/lib/onboarding/style-diagnosis";
import sitemap from "../sitemap";

describe("sitemap", () => {
  it("동적 예상 개수·URL 중복 배제·자가 점검 가이드 포함·검색 비대상 경로 제외를 검증한다", () => {
    const entries = sitemap();
    const etfCount = loadEtfs().length;
    const briefingCount = loadBriefings().length;
    const guideCount = loadGuides().length;
    const bookCount = loadBooks().length;
    const externalBookCount = loadExternalBooks().length;
    const styleCount = Object.keys(STYLE_PROFILES).length;
    const staticPageCount = 5; // "", "/briefing", "/guides", "/guides/self-check", "/books"

    // 1. 동적 계산된 예상 개수 단언 (하드코딩 숫자 지양, 데이터 증분 자동 수용)
    const expectedTotal = staticPageCount + etfCount + briefingCount + guideCount + bookCount + externalBookCount + styleCount;
    expect(entries).toHaveLength(expectedTotal);

    // 2. URL 중복 여부 검증 (Set 크기와 배열 길이 일치)
    const urls = entries.map((entry) => entry.url);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(urls.length);

    // 3. 모든 URL이 canonicalBaseUrl(https://etf-campus.pages.dev)로 시작하는지 검증
    expect(entries.every((entry) => entry.url.startsWith("https://etf-campus.pages.dev"))).toBe(true);
    expect(entries.every((entry) => entry.url.startsWith(siteConfig.canonicalBaseUrl))).toBe(true);

    // 4. ETF 상세 페이지 수 정합성 검증
    const etfEntries = entries.filter((entry) => entry.url.includes("/etf/"));
    expect(etfEntries).toHaveLength(etfCount);

    // 5. 신규 자가 점검 가이드(/guides/self-check)가 sitemap에 정상 포함되었는지 검증
    const selfCheckEntry = entries.find((entry) => entry.url === "https://etf-campus.pages.dev/guides/self-check");
    expect(selfCheckEntry).toBeDefined();
    expect(selfCheckEntry?.priority).toBe(0.8);
    expect(selfCheckEntry?.changeFrequency).toBe("daily");

    // 6. 기타 섹션 대표 URL 포함 검증
    expect(entries.some((entry) => entry.url.endsWith("/guides/foundation-first"))).toBe(true);
    expect(entries.some((entry) => entry.url.includes("/books/review/"))).toBe(true);
    expect(entries.some((entry) => entry.url.endsWith("/style/turtle"))).toBe(true);
    expect(entries.some((entry) => entry.url.endsWith("/style/fox"))).toBe(true);
    expect(entries.filter((entry) => entry.url.includes("/style/"))).toHaveLength(10);

    // 7. 관리자·계정·인증·API 등 검색 비대상 경로의 완벽한 배제 검증 (Zero-Leaking)
    const nonSearchablePaths = [
      "/api/",
      "/auth/",
      "/admin/",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/community/profile",
      "/community/write",
    ];
    for (const path of nonSearchablePaths) {
      expect(entries.some((entry) => entry.url.includes(path))).toBe(false);
    }
  });
});
