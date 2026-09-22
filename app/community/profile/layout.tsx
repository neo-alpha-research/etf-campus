import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 프로필 | ETF 캠퍼스",
  robots: { index: false, follow: false, nocache: true },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
