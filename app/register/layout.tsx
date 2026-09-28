import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회원가입 | ETF 캠퍼스",
  robots: { index: false, follow: false, nocache: true },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
