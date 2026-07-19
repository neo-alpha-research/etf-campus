import { ASSET_CLASSES, RISK_TYPES, type AssetClass, type Etf, type RiskType } from "./etf-types";

export const AUM_RANGES = ["under100", "100to500", "500plus"] as const;
export type AumRange = (typeof AUM_RANGES)[number];

export type ScreenerFilters = {
  pensionOnly: boolean;
  assetClasses: readonly AssetClass[];
  riskTypes: readonly RiskType[];
  aumRanges: readonly AumRange[];
};

export const DEFAULT_SCREENER_FILTERS: ScreenerFilters = {
  pensionOnly: false,
  assetClasses: [],
  riskTypes: [],
  aumRanges: [],
};

function inAumRange(aum: number, range: AumRange): boolean {
  if (range === "under100") return aum < 10_000_000_000;
  if (range === "100to500") return aum >= 10_000_000_000 && aum < 50_000_000_000;
  return aum >= 50_000_000_000;
}

export function filterEtfs(etfs: readonly Etf[], filters: ScreenerFilters): Etf[] {
  return etfs.filter((etf) => {
    if (filters.pensionOnly && etf.pension !== "가능") return false;
    if (filters.assetClasses.length && !filters.assetClasses.includes(etf.assetClass)) return false;
    if (filters.riskTypes.length && !filters.riskTypes.includes(etf.riskType)) return false;
    if (filters.aumRanges.length && !filters.aumRanges.some((range) => inAumRange(etf.aum, range))) return false;
    return true;
  });
}

export function serializeScreenerQuery(filters: ScreenerFilters): string {
  const query = new URLSearchParams();
  if (filters.pensionOnly) query.set("pension", "eligible");
  filters.assetClasses.forEach((value) => query.append("asset", value));
  filters.riskTypes.forEach((value) => query.append("risk", value));
  filters.aumRanges.forEach((value) => query.append("aum", value));
  return query.toString();
}

function validValues<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((value): value is T => allowed.includes(value as T));
}

export function parseScreenerQuery(query: URLSearchParams): ScreenerFilters {
  return {
    pensionOnly: query.get("pension") === "eligible",
    assetClasses: validValues(query.getAll("asset"), ASSET_CLASSES),
    riskTypes: validValues(query.getAll("risk"), RISK_TYPES),
    aumRanges: validValues(query.getAll("aum"), AUM_RANGES),
  };
}
