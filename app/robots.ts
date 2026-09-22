import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export const dynamic = "force-static";

// Only non-HTML / machine API endpoints are disallowed in robots.txt.
// HTML pages containing <meta name="robots" content="noindex"> (such as /admin, /login, /register, etc.)
// must NOT be disallowed in robots.txt so that search crawlers (e.g. Googlebot) can fetch the page
// and read the noindex directive, preventing stray/orphan URL indexing.
export const DISALLOWED_ROBOTS_PATHS = [
  "/api/",
] as const;

export interface RobotsConfigOptions {
  canonicalBaseUrl: string;
  allowSearchIndexing: boolean;
}

export function createRobots({ canonicalBaseUrl, allowSearchIndexing }: RobotsConfigOptions): MetadataRoute.Robots {
  const normalizedUrl = canonicalBaseUrl.replace(/\/$/, "");

  if (!allowSearchIndexing) {
    // When search indexing is disallowed (e.g. preview, non-production, or opt-out):
    // 1. Allow crawling of public content so search engines can access pages to read `<meta name="robots" content="noindex">`
    //    and Cloudflare's preview HTTP header `X-Robots-Tag: noindex`.
    // 2. Disallow machine API endpoints.
    // 3. Omit `sitemap` and `host` declarations to avoid crawler sitemap submission.
    return {
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOWED_ROBOTS_PATHS],
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...DISALLOWED_ROBOTS_PATHS],
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
