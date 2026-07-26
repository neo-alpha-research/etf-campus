export function SampleBadge() {
  return <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.6875rem] font-extrabold text-amber-800">샘플 · 출시 전 교체</span>;
}

export function SampleNotice() {
  return (
    <aside className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-950">
      현재 표시된 콘텐츠는 화면과 연결 기능을 검수하기 위한 중립 샘플입니다. 실제 운영 콘텐츠가 아니며 출시 전에 전량 교체됩니다.
    </aside>
  );
}
