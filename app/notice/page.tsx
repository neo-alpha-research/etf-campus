import type { Metadata } from "next";
import { Suspense } from "react";
import { NoticeHub } from "@/components/notice/notice-hub";

export const metadata: Metadata = {
  title: "알림·참여",
  description: "ETF Campus 공식 공지사항, 30일 학습 챌린지, 서비스 오류 및 기능 제안 공간입니다.",
};

export default function NoticePage() {
  return (
    <Suspense fallback={<div className="page-shell py-12 text-center text-sm text-slate-500">불러오는 중...</div>}>
      <NoticeHub />
    </Suspense>
  );
}
