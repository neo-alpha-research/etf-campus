import { formatReturn, formatReturnNumber, getValueTone } from "@/lib/domain/etf-format";

const toneClass = {
  rise: "text-rise",
  fall: "text-fall",
  neutral: "text-muted",
} as const;

export function ReturnCell({ value, showUnit = true }: { value: number | null; showUnit?: boolean }) {
  const accessibleValue = formatReturn(value);
  const formatted = showUnit ? accessibleValue : formatReturnNumber(value);
  const ariaLabel = value === null || value === undefined 
    ? "데이터 없음" 
    : `${accessibleValue}, 가격 기준·분배금 미포함`;
    
  return (
    <span
      aria-label={ariaLabel}
      className={`tabular-nums font-semibold ${toneClass[getValueTone(value)]}`}
    >
      {formatted}
    </span>
  );
}
