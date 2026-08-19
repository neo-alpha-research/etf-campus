export function SampleBadge() {
  return <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[0.6875rem] font-extrabold text-brand-800">학습용 예시</span>;
}

export function SampleNotice() {
  return (
    <aside className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold leading-6 text-brand-950">
      현재 표시된 콘텐츠는 ETF 판단 기준을 익히기 위한 학습용 예시입니다. 특정 ETF의 매수·매도·보유를 권유하지 않으며, 개인의 계좌 조건·목표·위험 감내 수준에 따라 확인 항목과 판단은 달라질 수 있습니다.
    </aside>
  );
}
