import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MarketTicker } from "@/components/market-ticker";
import { AppPushInitializer } from "@/components/native/app-push-initializer";
import { AppBackButtonHandler } from "@/components/native/app-back-button-handler";
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
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (
                  navigator.userAgent.includes('ETFCampusApp') ||
                  window.location.search.includes('app=1') ||
                  localStorage.getItem('etfcampus_app_mode') === '1'
                ) {
                  document.documentElement.classList.add('is-app');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col antialiased w-full max-w-full overflow-x-clip">
        <Suspense fallback={null}>
          <UtmTracker />
        </Suspense>
        <a className="sr-only z-[110] rounded-lg bg-brand-800 px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3" href="#main-content">본문으로 건너뛰기</a>
        <div id="site-fixed-header" className="fixed top-0 w-full max-w-full shrink-0 z-[100] bg-white border-b border-line shadow-xs">
          <div className="hidden sm:block">
            <MarketTicker />
          </div>
          {siteConfig.isBeta ? (
            <div className="hidden sm:block border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-bold leading-5 text-amber-900" role="status">
              베타 테스트 중 · 사이트의 콘텐츠는 검증하고 있습니다. 투자 판단 자료로 단독 사용하지 마세요.
            </div>
          ) : null}
          <Suspense fallback={<div aria-hidden="true" className="h-[96px] border-b border-line bg-white sm:h-[121px]" />}>
            <SiteHeader />
          </Suspense>
        </div>
        <main className="flex flex-1 flex-col pt-[var(--site-header-height,168px)] sm:pt-[var(--site-header-height,140px)] w-full max-w-full overflow-x-clip" id="main-content">{children}</main>
        <SiteFooter />
        <AppPushInitializer />
        <AppBackButtonHandler />
        <StyleOnboarding />
      </body>
      {process.env.NEXT_PUBLIC_GA_ID ? <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} /> : null}
    </html>
  );
}
