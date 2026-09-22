import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export const dynamic = "force-static";

export const DISALLOWED_SEARCH_PATHS = [
  "/api/",
  "/auth/",
  "/admin/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/community/profile",
  "/community/write",
  "/community/read",
] as const;

export interface RobotsConfigOptions {
  canonicalBaseUrl: string;
  allowSearchIndexing: boolean;
}

export function createRobots({ canonicalBaseUrl, allowSearchIndexing }: RobotsConfigOptions): MetadataRoute.Robots {
  const normalizedUrl = canonicalBaseUrl.replace(/\/$/, "");

  if (!allowSearchIndexing) {
    // When search indexing is disallowed (e.g. preview, non-production, or opt-out):
    // 1. Allow crawling of public content so search engines can access the page to read `<meta name="robots" content="noindex">`
    //    and Cloudflare's preview HTTP header `X-Robots-Tag: noindex`.
    // 2. Disallow private API, admin, and account routes.
    // 3. Omit `sitemap` and `host` declarations to avoid crawler sitemap submission.
    return {
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOWED_SEARCH_PATHS],
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...DISALLOWED_SEARCH_PATHS],
    },
    sitemap: `${normalizedUrl}/sitemap.xml`,
    host: normalizedUrl,
  };
}

export default function robots(): MetadataRoute.Robots {
  return createRobots({
    canonicalBaseUrl: siteConfig.canonicalBaseUrl,
    allowSearchIndexing: siteConfig.allowSearchIndexing,
  });
}
