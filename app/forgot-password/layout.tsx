import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "비밀번호 찾기 | ETF 캠퍼스",
  robots: { index: false, follow: false, nocache: true },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
