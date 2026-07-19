import { formatReturn, getValueTone } from "@/lib/domain/etf-format";

const toneClass = {
  rise: "text-rise",
  fall: "text-fall",
  neutral: "text-muted",
} as const;

export function ReturnCell({ value }: { value: number | null }) {
  const formatted = formatReturn(value);
  return (
    <span
      aria-label={`${formatted}, 가격 기준·분배금 미포함`}
      className={`tabular-nums font-semibold ${toneClass[getValueTone(value)]}`}
    >
      {formatted}
    </span>
  );
}

