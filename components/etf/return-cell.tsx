import { formatReturn, formatReturnNumber, getValueTone } from "@/lib/domain/etf-format";

const toneClass = {
  rise: "text-rise",
  fall: "text-fall",
  neutral: "text-muted",
} as const;

export function ReturnCell({ value, showUnit = true }: { value: number | null; showUnit?: boolean }) {
  const accessibleValue = formatReturn(value);
  const formatted = showUnit ? accessibleValue : formatReturnNumber(value);
  return (
    <span
      aria-label={`${accessibleValue}, 가격 기준·분배금 미포함`}
      className={`tabular-nums font-semibold ${toneClass[getValueTone(value)]}`}
    >
      {formatted}
    </span>
  );
}
