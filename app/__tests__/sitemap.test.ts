import { describe, expect, it } from "vitest";

import { siteConfig } from "@/config/site";
import { loadBriefings } from "@/lib/content/briefings";
import { loadBooks, loadExternalBooks, loadGuides } from "@/lib/content/learning-content";
import { loadEtfs } from "@/lib/data/etf-repository";
import { STYLE_PROFILES } from "@/lib/onboarding/style-diagnosis";
import sitemap from "../sitemap";

describe("sitemap", () => {
  it("전체 ETF 상세 URL을 포함하고 canonical 기준 주소를 사용한다", () => {
    const entries = sitemap();
    const etfCount = loadEtfs().length;
    const briefingCount = loadBriefings().length;
    const guideCount = loadGuides().length;
    const bookCount = loadBooks().length;
    const externalBookCount = loadExternalBooks().length;
    const styleCount = Object.keys(STYLE_PROFILES).length;
    const staticPageCount = 5; // "", "/briefing", "/guides", "/guides/self-check", "/books"

    const expectedTotal = staticPageCount + etfCount + briefingCount + guideCount + bookCount + externalBookCount + styleCount;

    expect(entries).toHaveLength(expectedTotal);
    expect(entries).toHaveLength(1208);

    // 모든 URL이 canonicalBaseUrl(https://etf-campus.pages.dev)로 시작하는지 검증
    expect(entries.every((entry) => entry.url.startsWith("https://etf-campus.pages.dev"))).toBe(true);
    expect(entries.every((entry) => entry.url.startsWith(siteConfig.canonicalBaseUrl))).toBe(true);

    // ETF 상세 페이지 검증
    const etfEntries = entries.filter((entry) => entry.url.includes("/etf/"));
    expect(etfEntries).toHaveLength(etfCount);

    // 신규 자가 점검 가이드(/guides/self-check)가 sitemap에 정상 포함되었는지 검증
    const selfCheckEntry = entries.find((entry) => entry.url === "https://etf-campus.pages.dev/guides/self-check");
    expect(selfCheckEntry).toBeDefined();
    expect(selfCheckEntry?.priority).toBe(0.8);
    expect(selfCheckEntry?.changeFrequency).toBe("daily");

    // 기타 섹션 대표 URL 포함 검증
    expect(entries.some((entry) => entry.url.endsWith("/guides/foundation-first"))).toBe(true);
    expect(entries.some((entry) => entry.url.includes("/books/review/"))).toBe(true);
    expect(entries.some((entry) => entry.url.endsWith("/style/turtle"))).toBe(true);
    expect(entries.some((entry) => entry.url.endsWith("/style/fox"))).toBe(true);
    expect(entries.filter((entry) => entry.url.includes("/style/"))).toHaveLength(10);

    // 비공개/API/인증 경로가 sitemap에 포함되지 않는지 검증 (Zero-Leaking)
    expect(entries.some((entry) => entry.url.includes("/api/"))).toBe(false);
    expect(entries.some((entry) => entry.url.includes("/auth/"))).toBe(false);
    expect(entries.some((entry) => entry.url.includes("/admin/"))).toBe(false);
  });
});
