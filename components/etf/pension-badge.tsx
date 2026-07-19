import type { PensionStatus } from "@/lib/domain/etf-types";

const statusClass: Record<PensionStatus, string> = {
  가능: "border-brand-200 bg-brand-50 text-brand-800",
  불가: "border-neutral-200 bg-neutral-50 text-neutral-600",
  확인중: "border-amber-200 bg-amber-50 text-amber-800",
};

export function PensionBadge({ status }: { status: PensionStatus }) {
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${statusClass[status]}`}>연금 {status}</span>;
}

