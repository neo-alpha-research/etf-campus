import type { RiskType } from "@/lib/domain/etf-types";

const labels: Record<RiskType, string> = {
  normal: "비레버리지",
  leverage: "레버리지",
  inverse: "인버스",
};

export function RiskBadge({ riskType }: { riskType: RiskType }) {
  if (riskType === "normal") return null;
  
  if (riskType === "leverage") {
    return <span className="inline-flex rounded-sm border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{labels[riskType]}</span>;
  }
  
  if (riskType === "inverse") {
    return <span className="inline-flex rounded-sm border border-red-300 bg-red-100 px-2 py-1 text-xs font-bold text-red-800">{labels[riskType]}</span>;
  }

  return null;
}

