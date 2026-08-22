import type { Metadata } from "next";
import { CommunityLearningBundles } from "@/components/community/community-learning-bundles";

export const metadata: Metadata = {
  title: "ETF 판단 기준 학습 번들",
  description: "ETF 비용·공시·위험·연금 계좌 판단 기준을 위한 ETF Campus 학습 자료입니다.",
};

export default function CommunityLearningBundlesPage() {
  return <CommunityLearningBundles />;
}
