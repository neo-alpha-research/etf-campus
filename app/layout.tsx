import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MarketTicker } from "@/components/market-ticker";
import { AppBottomTab } from "@/components/app-bottom-tab";
import { StyleOnboarding } from "@/components/onboarding/style-onboarding";
import { siteConfig } from "@/config/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  robots: siteConfig.isBeta ? { index: false, follow: false, nocache: true } : undefined,
};

import { UtmTracker } from "@/components/utm-tracker";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (navigator.userAgent.includes('ETFCampusApp')) {
                document.documentElement.classList.add('is-app');
              }
            `,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <Suspense fallback={null}>
          <UtmTracker />
        </Suspense>
        <a className="sr-only z-[100] rounded-lg bg-brand-800 px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3" href="#main-content">본문으로 건너뛰기</a>
        <MarketTicker />
        {siteConfig.isBeta ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-bold leading-5 text-amber-900" role="status">
            베타 테스트 중 · 데이터와 콘텐츠를 검수하고 있습니다. 투자 판단 자료로 단독 사용하지 마세요.
          </div>
        ) : null}
        <Suspense fallback={<div aria-hidden="true" className="h-[132px] border-b border-line bg-surface sm:h-[121px]" />}>
          <SiteHeader />
        </Suspense>
        <div className="flex flex-1 flex-col" id="main-content">{children}</div>
        <SiteFooter />
        <AppBottomTab />
        <StyleOnboarding />
      </body>
      {process.env.NEXT_PUBLIC_GA_ID ? <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} /> : null}
    </html>
  );
}
