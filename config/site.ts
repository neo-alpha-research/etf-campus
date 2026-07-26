const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://etfcampus.kr";

export function isBetaSiteUrl(url: string): boolean {
  return process.env.NEXT_PUBLIC_BETA_MODE === "true" || new URL(url).hostname.endsWith(".pages.dev");
}

export const siteConfig = {
  name: "ETF 캠퍼스",
  description: "국내 상장 ETF를 기준과 맥락으로 살펴보는 독립 정보 서비스",
  url: siteUrl,
  isBeta: isBetaSiteUrl(siteUrl),
} as const;
