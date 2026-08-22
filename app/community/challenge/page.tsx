import type { Metadata } from "next";
import { CommunityChallenge } from "@/components/community/community-challenge";

export const metadata: Metadata = {
  title: "30일 챌린지",
  description: "수익 경쟁이 아닌 ETF 판단 기준 학습 기록을 위한 ETF Campus 30일 챌린지입니다.",
};

export default function CommunityChallengePage() {
  return <CommunityChallenge />;
}
