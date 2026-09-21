import { formatAsOfDate } from "@/lib/domain/etf-format";

export function AsOfDate({ value, className = "text-xs text-muted" }: { value?: string | null, className?: string }) {
  if (!value) return null;
  const clean = value.replace(/-/g, "");
  const dateTime = clean.length >= 8 ? `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}` : value;
  return <time className={className} dateTime={dateTime}>기준일 {formatAsOfDate(value)}</time>;
}

