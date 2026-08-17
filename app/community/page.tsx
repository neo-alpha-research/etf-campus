import type { Metadata } from "next";
import { CommunityFeed } from "@/components/community/community-feed";

export const metadata: Metadata = {
  title: "커뮤니티",
  description: "ETF 판단 기준을 함께 배우고 검증하는 ETF Campus 커뮤니티입니다.",
};

export default function CommunityPage() {
  return <CommunityFeed />;
}
