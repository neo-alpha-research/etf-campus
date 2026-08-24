import type { Metadata } from "next";
import { CommunityFeed } from "@/components/community/community-feed";
import { CommunityNoticeBanner } from "@/components/community/community-notice-banner";

export const metadata: Metadata = {
  title: "커뮤니티",
  description: "ETF 투자자들이 함께 성장하는 ETF Campus 커뮤니티입니다.",
};

export default function CommunityPage() {
  return (
    <>
      <CommunityNoticeBanner />
      <CommunityFeed />
    </>
  );
}
