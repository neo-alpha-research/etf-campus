import type { Metadata } from "next";
import { CommunityChallenge } from "@/components/community/community-challenge";
import { CommunityNoticeBanner } from "@/components/community/community-notice-banner";

export const metadata: Metadata = {
  title: "30일 과제 챌린지",
  description: "ETF 판단 기준을 매일 학습하며 기록하는 30일 챌린지입니다.",
};

export default function ChallengePage() {
  return (
    <>
      <CommunityNoticeBanner />
      <CommunityChallenge />
    </>
  );
}
