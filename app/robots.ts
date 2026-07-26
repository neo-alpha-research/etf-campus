import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export const dynamic = "force-static";

export function createRobots(baseUrl: string, isBeta: boolean): MetadataRoute.Robots {
  const normalizedUrl = baseUrl.replace(/\/$/, "");
  if (isBeta) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${normalizedUrl}/sitemap.xml`,
    host: normalizedUrl,
  };
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteConfig.url.replace(/\/$/, "");
  return createRobots(baseUrl, siteConfig.isBeta);
}
