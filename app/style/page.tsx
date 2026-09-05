import type { Metadata } from "next";
import { StylePageClient } from "./style-client";

export const metadata: Metadata = {
  title: "ETF 투자 스타일 진단 (10종 동물 & 3대 결손 처방) | ETF Campus",
  description: "로그인 없이 3분 만에 확인하는 나의 ETF 정보 탐색 성향(10종 동물)과 3대 계좌 결손(신호·지도·현금흐름) 맞춤 처방",
  alternates: { canonical: "/style" },
  openGraph: {
    title: "ETF 투자 스타일 진단 | ETF Campus",
    description: "로그인 없이 3분 만에 확인하는 나의 ETF 정보 탐색 성향과 3대 계좌 결손 맞춤 처방",
    url: "/style",
    type: "website",
  },
};

export default function StylePage() {
  return <StylePageClient />;
}
