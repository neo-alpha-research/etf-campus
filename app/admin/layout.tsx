import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "관리자 | ETF 캠퍼스",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
