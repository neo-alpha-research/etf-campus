import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StyleOnboarding } from "@/components/onboarding/style-onboarding";
import { siteConfig } from "@/config/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col antialiased">
        <a className="sr-only z-[100] rounded-lg bg-brand-800 px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3" href="#main-content">본문으로 건너뛰기</a>
        <Suspense fallback={<div aria-hidden="true" className="h-[132px] border-b border-line bg-surface sm:h-[121px]" />}>
          <SiteHeader />
        </Suspense>
        <div className="flex flex-1 flex-col" id="main-content">{children}</div>
        <SiteFooter />
        <StyleOnboarding />
        <Analytics debug={false} />
      </body>
    </html>
  );
}
