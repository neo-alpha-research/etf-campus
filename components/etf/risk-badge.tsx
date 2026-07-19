import type { RiskType } from "@/lib/domain/etf-types";

const labels: Record<RiskType, string> = {
  normal: "일반",
  leverage: "레버리지",
  inverse: "인버스",
};

export function RiskBadge({ riskType }: { riskType: RiskType }) {
  return <span className="inline-flex rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-700">{labels[riskType]}</span>;
}

