import { PeerGroup } from "@/lib/hooks/use-market-briefing";

function changeTone(value: number) {
  if (value > 0) return "text-[#62913A]";
  if (value < 0) return "text-[#358BA3]";
  return "text-neutral-500";
}

function signed(value: number, unit = "%") {
  const decimal = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value > 0 ? "+" : ""}${decimal.format(value)}${unit}`;
}

export function PeerGroupReturns({ groups }: { groups: PeerGroup[] }) {
  if (!groups || groups.length === 0) return null;

  const topGroups = groups.slice(0, 5);
  const bottomGroups = groups.slice().reverse().slice(0, 5).filter(g => !topGroups.find(t => t.peerGroup === g.peerGroup));

  return (
    <section aria-labelledby="peer-group-title" className="mt-8">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">THEMATIC RETURNS</p>
          <h2 id="peer-group-title" className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">테마별 수익률 랭킹</h2>
        </div>
        <p className="text-xs text-neutral-500">최소 5개 이상 구성된 테마 기준</p>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-[#D7EABB] bg-white shadow-[0_8px_24px_rgba(27,38,26,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#EDF2DE] bg-[#F9FBFC]">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-semibold text-neutral-600 sm:px-6">테마 (유사 집단)</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-neutral-600 sm:px-6">종목 수</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-neutral-600 sm:px-6">동일 가중 평균</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-neutral-600 sm:px-6">
                  시총 가중 평균
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-700" title="초대형 종목의 지배를 방지하기 위해 단일 종목 최대 비중을 30%로 제한했습니다.">Cap</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2DE]">
              {topGroups.map((row, idx) => (
                <tr key={row.peerGroup} className="transition-colors hover:bg-neutral-50/50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-900 sm:px-6">
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5F5D5] text-[10px] font-bold text-[#4B7C2A]">{idx + 1}</span>
                    {row.peerGroup}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-neutral-500 sm:px-6">{row.etfCount}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums sm:px-6 ${changeTone(row.equalWeightReturnPct)}`}>
                    {signed(row.equalWeightReturnPct)}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums sm:px-6 ${changeTone(row.cappedAumWeightedReturnPct)}`}>
                    {signed(row.cappedAumWeightedReturnPct)}
                  </td>
                </tr>
              ))}
              {bottomGroups.length > 0 && (
                <tr className="bg-neutral-50/50">
                  <td colSpan={4} className="px-4 py-2 text-center text-xs text-neutral-400 sm:px-6">...</td>
                </tr>
              )}
              {bottomGroups.map((row, idx) => (
                <tr key={row.peerGroup} className="transition-colors hover:bg-neutral-50/50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-900 sm:px-6">
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E9F3F6] text-[10px] font-bold text-[#2C7B90]">▼</span>
                    {row.peerGroup}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-neutral-500 sm:px-6">{row.etfCount}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums sm:px-6 ${changeTone(row.equalWeightReturnPct)}`}>
                    {signed(row.equalWeightReturnPct)}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums sm:px-6 ${changeTone(row.cappedAumWeightedReturnPct)}`}>
                    {signed(row.cappedAumWeightedReturnPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
