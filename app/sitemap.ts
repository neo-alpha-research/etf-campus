import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { loadEtfs } from "@/lib/data/etf-repository";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url.replace(/\/$/, "");
  const etfs = loadEtfs();
  const lastModified = etfs[0] ? new Date(`${etfs[0].asOfDate.slice(0, 4)}-${etfs[0].asOfDate.slice(4, 6)}-${etfs[0].asOfDate.slice(6, 8)}T00:00:00+09:00`) : new Date();
  const pages = ["", "/screener", "/briefing", "/guides", "/books"].map((path, index) => ({
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
  return [...pages, ...detailPages];
}
