import type { Metadata } from "next";
import { CommunityPostDetail } from "@/components/community/community-post-detail";

export const metadata: Metadata = {
  title: "커뮤니티 글",
  description: "ETF Campus 커뮤니티의 공개 게시물입니다.",
  robots: { index: false, follow: false },
};

export default function CommunityReadPage() {
  return <CommunityPostDetail />;
}
