import { formatAsOfDate } from "@/lib/domain/etf-format";

export function AsOfDate({ value, className = "text-xs text-muted" }: { value: string, className?: string }) {
  return <time className={className} dateTime={`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`}>기준일 {formatAsOfDate(value)}</time>;
}

