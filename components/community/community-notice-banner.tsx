"use client";

export function CommunityNoticeBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 p-4 text-center text-amber-800">
      <p className="text-sm font-medium">
        🚧 현재 커뮤니티 및 챌린지 기능은 <strong>개발 및 테스트 진행 중</strong>입니다. 
        입력하신 데이터는 테스트용으로 처리되며 추후 초기화될 수 있습니다. 이용에 참고 부탁드립니다.
      </p>
    </div>
  );
}