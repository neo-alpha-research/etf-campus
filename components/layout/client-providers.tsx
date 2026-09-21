"use client";

import dynamic from "next/dynamic";

const StyleOnboarding = dynamic(
  () => import("@/components/onboarding/style-onboarding").then((mod) => mod.StyleOnboarding),
  { ssr: false }
);

const AppPushInitializer = dynamic(
  () => import("@/components/native/app-push-initializer").then((mod) => mod.AppPushInitializer),
  { ssr: false }
);

const AppBackButtonHandler = dynamic(
  () => import("@/components/native/app-back-button-handler").then((mod) => mod.AppBackButtonHandler),
  { ssr: false }
);

export function ClientProviders() {
  return (
    <>
      <AppPushInitializer />
      <AppBackButtonHandler />
      <StyleOnboarding />
    </>
  );
}
