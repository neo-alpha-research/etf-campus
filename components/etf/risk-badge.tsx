import type { RiskType } from "@/lib/domain/etf-types";

const labels: Record<RiskType, string> = {
  normal: "일반",
  leverage: "레버리지",
  inverse: "인버스",
};

export function RiskBadge({ riskType }: { riskType: RiskType }) {
  if (riskType === "normal") {
    return <span className="inline-flex rounded-sm border border-neutral-300 bg-surface px-2 py-1 text-xs font-semibold text-neutral-700">{labels[riskType]}</span>;
  }
  
  if (riskType === "leverage") {
    return <span className="inline-flex rounded-sm border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{labels[riskType]}</span>;
  }
  
  if (riskType === "inverse") {
    return <span className="inline-flex rounded-sm border border-red-300 bg-red-100 px-2 py-1 text-xs font-bold text-red-800">{labels[riskType]}</span>;
  }

  return null;
}

