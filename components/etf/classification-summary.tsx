import { getClassificationParts } from "@/lib/domain/etf-classification";
import type { Etf } from "@/lib/domain/etf-types";

export function ClassificationSummary({
  detailed = false,
  etf,
}: {
  detailed?: boolean;
  etf: Etf;
}) {
  const parts = getClassificationParts(etf, detailed);

  return (
    <span
      aria-label={`분류: ${parts.join(", ")}`}
      className="inline-flex max-w-full items-center gap-1 whitespace-nowrap text-xs font-bold text-neutral-700"
      title={parts.join(" · ")}
    >
      {parts.map((part, index) => (
        <span className="contents" key={part}>
          {index ? <span aria-hidden="true" className="text-neutral-300">·</span> : null}
          <span>{part}</span>
        </span>
      ))}
    </span>
  );
}
