import type { PensionStatus } from "@/lib/domain/etf-types";

const statusClass: Record<PensionStatus, string> = {
  가능: "border-brand-200 bg-brand-50 text-brand-800",
  불가: "border-neutral-200 bg-neutral-50 text-neutral-400",
  확인중: "border-amber-200 bg-amber-50 text-amber-800",
};

const compactLabel: Record<PensionStatus, string> = {
  가능: "O",
  불가: "X",
  확인중: "",
};

export function PensionBadge({ status, compact = false }: { status: PensionStatus; compact?: boolean }) {
  const accessibleLabel = status === "확인중" ? "연금 확인 필요" : `연금 ${status}`;

  if (compact) {
    if (status === "확인중") {
      return <span aria-label={accessibleLabel} className="inline-block min-h-7 min-w-7" title={accessibleLabel} />;
    }
    return (
      <span
        aria-label={accessibleLabel}
        className={`inline-flex min-h-7 min-w-7 items-center justify-center rounded-full border px-1.5 text-xs font-extrabold ${statusClass[status]}`}
        title={accessibleLabel}
      >
        {compactLabel[status]}
      </span>
    );
  }

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${statusClass[status]}`}>연금 {status}</span>;
}
