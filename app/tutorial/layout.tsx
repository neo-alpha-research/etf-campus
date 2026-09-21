import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "신입생 오리엔테이션 (캠퍼스 투어)",
  description: "어른들의 투자 대학교, ETF 캠퍼스 신입생을 위한 6대 시설 투어 및 5대 절세 팩트체크 가이드입니다.",
  alternates: { canonical: "/tutorial/" },
};

export default function TutorialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
