import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "비밀번호 재설정 | ETF 캠퍼스",
  robots: { index: false, follow: false, nocache: true },
};

export default function ResetPasswordPage() {
  redirect("/forgot-password/");
}
