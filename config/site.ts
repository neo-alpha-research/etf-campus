export interface SitePolicy {
  canonicalBaseUrl: string;
  deployUrl: string;
  isProduction: boolean;
  allowSearchIndexing: boolean;
  showBetaBanner: boolean;
}

export function resolveSitePolicy(env: Record<string, string | undefined> = process.env): SitePolicy {
  // 1. Canonical Base URL: Official operational address.
  // Defaults to the active production host 'https://etf-campus.pages.dev'.
  const rawSiteUrl = env.NEXT_PUBLIC_SITE_URL?.trim();
  const canonicalBaseUrl = (rawSiteUrl && rawSiteUrl.length > 0 ? rawSiteUrl : "https://etf-campus.pages.dev").replace(/\/$/, "");

  // 2. Deploy URL: Actual deployment URL (e.g. preview branch URL in Cloudflare Pages)
  const deployUrl = env.CF_PAGES_URL?.trim().replace(/\/$/, "") || canonicalBaseUrl;

  // 3. Production Environment Confirmation:
  // In Cloudflare Pages, CF_PAGES_BRANCH provides the triggering branch name ('main').
  // When building with wrangler.toml, COMMUNITY_ENVIRONMENT provides the environment ('production' vs 'preview').
  // Fail-closed: Must be confirmed production.
  // If branch is provided, only 'main' is production. Any other branch is strictly non-production.
  // If branch is absent, check COMMUNITY_ENVIRONMENT === 'production'.
  // If both are absent or unconfirmed, strictly treat as non-production (fail-closed).
  const branch = env.CF_PAGES_BRANCH?.trim();
  const communityEnv = env.COMMUNITY_ENVIRONMENT?.trim();

  let isProduction = false;
  if (branch) {
    isProduction = branch === "main";
  } else if (communityEnv) {
    isProduction = communityEnv === "production";
  }

  // 4. Search Engine Indexing Permission:
  // Fail-closed: Must be confirmed production AND indexing explicitly turned on via flag.
  // In preview environments, indexing is ALWAYS disallowed even if the flag is mistakenly set.
  const indexingFlag = (env.NEXT_PUBLIC_ALLOW_INDEXING ?? env.ALLOW_INDEXING)?.trim().toLowerCase();
  const allowSearchIndexing = isProduction && indexingFlag === "true";

  // 5. Visual Beta Banner:
  // Independent flag. Defaults to false (hidden on production).
  const showBetaBanner = env.NEXT_PUBLIC_BETA_MODE?.trim().toLowerCase() === "true";

  return {
    canonicalBaseUrl,
    deployUrl,
    isProduction,
    allowSearchIndexing,
    showBetaBanner,
  };
}

const currentPolicy = resolveSitePolicy();

export const siteConfig = {
  name: "ETF 캠퍼스",
  description: "국내 상장 ETF를 기준과 맥락으로 살펴보는 독립 정보 서비스",
  canonicalBaseUrl: currentPolicy.canonicalBaseUrl,
  url: currentPolicy.canonicalBaseUrl,
  deployUrl: currentPolicy.deployUrl,
  isProduction: currentPolicy.isProduction,
  allowSearchIndexing: currentPolicy.allowSearchIndexing,
  showBetaBanner: currentPolicy.showBetaBanner,
} as const;
