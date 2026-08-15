import type { Metadata } from "next";
import { CommunityComposer } from "@/components/community/community-composer";

export const metadata: Metadata = {
  title: "커뮤니티 글 작성",
  description: "ETF 판단 기준을 함께 학습하는 커뮤니티 글을 작성합니다.",
  robots: { index: false, follow: false },
};

export default function CommunityWritePage() {
  return <CommunityComposer />;
}
