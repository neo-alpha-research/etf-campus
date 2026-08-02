export type ValueTone = "rise" | "fall" | "neutral";

export function getValueTone(value: number | null): ValueTone {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "rise" : "fall";
}

export function formatReturn(value: number | null): string {
  if (value === null) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatReturnNumber(value: number | null): string {
  return formatReturn(value).replace("%", "");
}

export function formatMoney(value: number): string {
  const eok = value / 100_000_000;
  const fractionDigits = eok < 100 ? 1 : 0;
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(eok)}억원`;
}

export function formatMoneyNumber(value: number): string {
  return formatMoney(value).replace("억원", "");
}

export function formatTradeValueNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value / 100_000_000);
}

export function formatAumNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value / 100_000_000);
}

export function formatWon(value: number): string {
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value)}원`;
}

export function formatWonNumber(value: number): string {
  return formatWon(value).replace("원", "");
}

export function formatAsOfDate(value: string): string {
  if (!/^\d{8}$/.test(value)) throw new Error(`잘못된 기준일 형식: ${value}`);
  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
}
