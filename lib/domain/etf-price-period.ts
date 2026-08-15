const DAY_MS = 24 * 60 * 60 * 1000;

export type PricePeriod =
  | "1d"
  | "1w"
  | "2w"
  | "1m"
  | "2m"
  | "3m"
  | "6m"
  | "12m"
  | "24m"
  | "36m"
  | "ytd"
  | "itd";

export type ItdRangeContext = {
  /** Official listing date, when available. */
  listingDate?: string | null;
  /** First observed valid closing-price date; preferred over a calendar listing date. */
  actualFirstTradingDate?: string | null;
};

export type PricePeriodRange =
  | { start: string; end: string; dataStatus?: undefined }
  | { start: null; end: string; dataStatus: "listing_date_unavailable" };

function parseAsOfDate(value?: string): Date {
  const parsed = parseIsoDate(value);
  return parsed ?? new Date();
}

function parseIsoDate(value?: string | null): Date | null {
  if (!value) return null;
  const compact = value.replaceAll("-", "");
  if (!/^\d{8}$/.test(compact)) return null;

  const year = Number(compact.slice(0, 4));
  const month = Number(compact.slice(4, 6));
  const day = Number(compact.slice(6, 8));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function subtractCalendarMonths(value: Date, months: number): Date {
  const sourceYear = value.getUTCFullYear();
  const sourceMonth = value.getUTCMonth();
  const sourceDay = value.getUTCDate();
  const targetMonthIndex = sourceYear * 12 + sourceMonth - months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex - targetYear * 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(sourceDay, lastDay)));
}

/**
 * Returns the requested date interval for a price chart.  For MAX/ITD, an ETF
 * must supply an actual first trading date or official listing date; an epoch
 * fallback would be a false request and is therefore deliberately prohibited.
 */
export function getPricePeriodRange(
  period: PricePeriod,
  asOfDate?: string,
  itdContext?: ItdRangeContext,
): PricePeriodRange {
  const end = parseAsOfDate(asOfDate);
  let start: Date;

  if (period === "itd") {
    const actualFirstTrade = parseIsoDate(itdContext?.actualFirstTradingDate);
    const listingDate = parseIsoDate(itdContext?.listingDate);
    const anchor = actualFirstTrade ?? listingDate;
    if (!anchor) {
      return {
        start: null,
        end: formatIsoDate(end),
        dataStatus: "listing_date_unavailable",
      };
    }
    return { start: formatIsoDate(anchor), end: formatIsoDate(end) };
  }

  if (period === "1d") start = new Date(end.getTime() - DAY_MS);
  else if (period === "1w") start = new Date(end.getTime() - 7 * DAY_MS);
  else if (period === "2w") start = new Date(end.getTime() - 14 * DAY_MS);
  else if (period === "1m") start = subtractCalendarMonths(end, 1);
  else if (period === "2m") start = subtractCalendarMonths(end, 2);
  else if (period === "3m") start = subtractCalendarMonths(end, 3);
  else if (period === "6m") start = subtractCalendarMonths(end, 6);
  else if (period === "12m") start = subtractCalendarMonths(end, 12);
  else if (period === "24m") start = subtractCalendarMonths(end, 24);
  else if (period === "36m") start = subtractCalendarMonths(end, 36);
  else start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));

  return { start: formatIsoDate(start), end: formatIsoDate(end) };
}
