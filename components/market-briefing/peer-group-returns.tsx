import { PeerGroup } from "@/lib/hooks/use-market-briefing";

function changeTone(value: number) {
  if (value > 0) return "text-[#EE4B58]";
  if (value < 0) return "text-[#4682EC]";
  return "text-neutral-500";
}

function signed(value: number, unit = "%") {
  const decimal = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value > 0 ? "+" : ""}${decimal.format(value)}${unit}`;
}

export function PeerGroupReturns({ groups }: { groups: PeerGroup[] }) {
  if (!groups || groups.length === 0) return null;

  const domestic = groups.filter(g => g.assetClass === "주식-국내" || g.assetClass?.includes("국내"));
  const overseas = groups.filter(g => g.assetClass === "주식-해외" || g.assetClass?.includes("해외"));

  const renderCard = (title: string, data: PeerGroup[]) => {
    if (data.length === 0) return null;
    const sorted = [...data].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
    const top = sorted.slice(0, 3);
    const bottom = sorted.slice().reverse().slice(0, 3).filter(g => !top.find(t => t.peerGroup === g.peerGroup));

    return (
      <div className="overflow-hidden rounded-[22px] border border-[#D7EABB] bg-white shadow-[0_8px_24px_rgba(27,38,26,0.05)]">
        <div className="border-b border-[#EDF2DE] bg-[#F9FBFC] px-4 py-3 sm:px-6 flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-800">{title} 주도 테마</h3>
          <span className="text-[10px] text-neutral-500 font-medium bg-[#EDF2DE] px-2 py-0.5 rounded-full">TOP / BOTTOM 3</span>
        </div>
        <div className="divide-y divide-[#EDF2DE]">
          {top.map((row, idx) => (
            <div key={row.peerGroup} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-neutral-50/50">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-[12px] font-bold text-[#EE4B58]">{idx + 1}</span>
                <p className="truncate text-sm font-bold text-neutral-900">{row.peerGroup}</p>
                <span className="text-[11px] text-neutral-400 font-medium">({row.etfCount}종목)</span>
              </div>
              <span className={`shrink-0 text-sm font-extrabold tabular-nums ${changeTone(row.cappedAumWeightedReturnPct)}`}>{signed(row.cappedAumWeightedReturnPct)}</span>
            </div>
          ))}
          {bottom.length > 0 && <div className="h-2 bg-[#F9FBFC] border-y border-[#EDF2DE]"></div>}
          {bottom.map((row, idx) => (
            <div key={row.peerGroup} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-neutral-50/50">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-[12px] font-bold text-[#4682EC]">▼</span>
                <p className="truncate text-sm font-bold text-neutral-900">{row.peerGroup}</p>
                <span className="text-[11px] text-neutral-400 font-medium">({row.etfCount}종목)</span>
              </div>
              <span className={`shrink-0 text-sm font-extrabold tabular-nums ${changeTone(row.cappedAumWeightedReturnPct)}`}>{signed(row.cappedAumWeightedReturnPct)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section aria-labelledby="peer-group-title" className="mt-8">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 id="peer-group-title" className="text-lg font-extrabold tracking-tight text-neutral-900">오늘 가장 성과가 좋았던 주식 섹터는?</h3>
          <p className="mt-1 text-sm text-neutral-500">국내외 주요 주식 테마(피어그룹)의 상승/하락률을 확인해 보세요.</p>
        </div>
        <p className="text-xs text-neutral-500">동일 테마 ETF 5개 이상 그룹 기준 (캡 가중수익률)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {renderCard("국내 주식", domestic)}
        {renderCard("해외 주식", overseas)}
      </div>
    </section>
  );
}
