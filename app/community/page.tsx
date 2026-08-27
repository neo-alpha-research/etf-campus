import type { Metadata } from "next";
import { CommunityFeed } from "@/components/community/community-feed";
import { CommunityNoticeBanner } from "@/components/community/community-notice-banner";

export const metadata: Metadata = {
  title: "ETF 이야기",
  description: "연금·절세부터 실전 ETF 투자 전략과 종목 판단 기준을 나누는 ETF 이야기 공간입니다.",
};

export default function CommunityPage() {
  return (
    <>
      <CommunityNoticeBanner />
      <CommunityFeed />
    </>
  );
}
