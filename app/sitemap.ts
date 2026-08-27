import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { loadBriefings } from "@/lib/content/briefings";
import { loadBooks, loadExternalBooks, loadGuides } from "@/lib/content/learning-content";
import { loadEtfs } from "@/lib/data/etf-repository";
import { STYLE_PROFILES } from "@/lib/onboarding/style-diagnosis";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url.replace(/\/$/, "");
  const etfs = loadEtfs();
  const lastModified = etfs[0] ? new Date(`${etfs[0].asOfDate.slice(0, 4)}-${etfs[0].asOfDate.slice(4, 6)}-${etfs[0].asOfDate.slice(6, 8)}T00:00:00+09:00`) : new Date();
  const pages = ["", "/briefing", "/guides", "/books"].map((path, index) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: index === 0 ? 1 : 0.7,
  }));
  const detailPages = etfs.map((etf) => ({
    url: `${baseUrl}/etf/${etf.ticker}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));
  const briefingPages = loadBriefings().map((briefing) => ({ url: `${baseUrl}/briefing/${briefing.date}`, lastModified: new Date(`${briefing.date}T00:00:00+09:00`), changeFrequency: "never" as const, priority: 0.7 }));
  const guidePages = loadGuides().map((guide) => ({ url: `${baseUrl}/guides/${guide.slug}`, lastModified, changeFrequency: "monthly" as const, priority: 0.7 }));
  const bookPages = loadBooks().map((book) => ({ url: `${baseUrl}/books/${book.slug}`, lastModified, changeFrequency: "monthly" as const, priority: 0.6 }));
  const externalBookPages = loadExternalBooks().map((book) => ({ url: `${baseUrl}/books/review/${book.slug}`, lastModified, changeFrequency: "monthly" as const, priority: 0.6 }));
  const stylePages = Object.keys(STYLE_PROFILES).map((style) => ({ url: `${baseUrl}/style/${style}`, lastModified, changeFrequency: "monthly" as const, priority: 0.7 }));
  return [...pages, ...detailPages, ...briefingPages, ...guidePages, ...bookPages, ...externalBookPages, ...stylePages];
}
