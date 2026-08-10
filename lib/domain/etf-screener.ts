import { ASSET_CLASSES, RISK_TYPES, DIVIDEND_FREQUENCIES, AMC_TYPES, MARKET_SCOPES, STRATEGIES, FX_HEDGES, type AssetClass, type Etf, type RiskType, type DividendFrequency, type AmcType, type MarketScope, type Strategy, type FxHedge } from "./etf-types";
import { getEtfMarketScope, getEtfStrategies, getEtfFxHedge } from "./etf-classification";
import { type AumScope, AUM_SCOPES } from "./etf-explorer";

export const TER_RANGES = ["under0.1", "0.1to0.5", "over0.5"] as const;
export type TerRange = (typeof TER_RANGES)[number];

export type ScreenerFilters = {
  keyword: string;
  pensionOnly: boolean;
  marketScopes: readonly MarketScope[];
  assetClasses: readonly AssetClass[];
  riskTypes: readonly RiskType[];
  strategies: readonly Strategy[];
  fxHedges: readonly FxHedge[];
  aumScope: AumScope;
  terRanges: readonly TerRange[];
  dividendFrequencies: readonly DividendFrequency[];
  amcs: readonly AmcType[];
};

export const DEFAULT_SCREENER_FILTERS: ScreenerFilters = {
  keyword: "",
  pensionOnly: false,
  marketScopes: [],
  assetClasses: [],
  riskTypes: ["normal"],
  strategies: [],
  fxHedges: [],
  aumScope: "1000plus",
  terRanges: [],
  dividendFrequencies: [],
  amcs: [],
};

function inTerRange(ter: number, range: TerRange): boolean {
  if (range === "under0.1") return ter < 0.001;
  if (range === "0.1to0.5") return ter >= 0.001 && ter < 0.005;
  return ter >= 0.005;
}

export function filterEtfs(etfs: readonly Etf[], filters: ScreenerFilters): Etf[] {
  return etfs.filter((etf) => {
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      if (!etf.name.toLowerCase().includes(kw) && !etf.baseIndex.toLowerCase().includes(kw)) return false;
    }
    if (filters.pensionOnly && etf.pension !== "가능") return false;
    
    if (filters.marketScopes.length > 0) {
      const scope = getEtfMarketScope(etf);
      if (!scope || !filters.marketScopes.includes(scope)) return false;
    }

    if (filters.assetClasses.length && !filters.assetClasses.includes(etf.assetClass)) return false;
    if (filters.riskTypes.length && !filters.riskTypes.includes(etf.riskType)) return false;
    
    if (filters.strategies.length > 0) {
      const strategies = getEtfStrategies(etf);
      if (!filters.strategies.some(s => strategies.includes(s))) return false;
    }

    if (filters.fxHedges.length > 0) {
      const fx = getEtfFxHedge(etf);
      if (!fx || !filters.fxHedges.includes(fx)) return false;
    }
    if (filters.aumScope === "1000plus" && etf.aum < 100_000_000_000) return false;
    if (filters.aumScope === "500plus" && etf.aum < 50_000_000_000) return false;
    if (filters.terRanges.length && !filters.terRanges.some((range) => inTerRange(etf.ter, range))) return false;
    if (filters.dividendFrequencies.length && !filters.dividendFrequencies.includes(etf.dividendFrequency)) return false;
    if (filters.amcs.length && !filters.amcs.includes(etf.amc)) return false;
    return true;
  });
}

export function serializeScreenerQuery(filters: ScreenerFilters): string {
  const isDefault = filters.keyword === "" &&
    filters.pensionOnly === DEFAULT_SCREENER_FILTERS.pensionOnly &&
    filters.marketScopes.length === 0 &&
    filters.assetClasses.length === 0 &&
    filters.riskTypes.length === 1 && filters.riskTypes[0] === "normal" &&
    filters.strategies.length === 0 &&
    filters.fxHedges.length === 0 &&
    filters.aumScope === "1000plus" &&
    filters.terRanges.length === 0 &&
    filters.dividendFrequencies.length === 0 &&
    filters.amcs.length === 0;

  if (isDefault) return "";

  const query = new URLSearchParams();
  if (filters.keyword) query.set("q", filters.keyword);
  if (filters.pensionOnly) query.set("pension", "eligible");
  filters.marketScopes.forEach((value) => query.append("market", value));
  filters.assetClasses.forEach((value) => query.append("asset", value));
  filters.riskTypes.forEach((value) => query.append("risk", value));
  filters.strategies.forEach((value) => query.append("strategy", value));
  filters.fxHedges.forEach((value) => query.append("fx", value));
  if (filters.aumScope !== "all") query.set("aum", filters.aumScope);
  filters.terRanges.forEach((value) => query.append("ter", value));
  filters.dividendFrequencies.forEach((value) => query.append("div", value));
  filters.amcs.forEach((value) => query.append("amc", value));

  if (Array.from(query.keys()).length === 0) {
    query.set("custom", "1");
  }

  return query.toString();
}

function validValues<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((value): value is T => allowed.includes(value as T));
}

function validValue<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

export function parseScreenerQuery(query: URLSearchParams): ScreenerFilters {
  if (Array.from(query.keys()).length === 0) {
    return { ...DEFAULT_SCREENER_FILTERS };
  }
  return {
    keyword: query.get("q") || "",
    pensionOnly: query.get("pension") === "eligible",
    marketScopes: validValues(query.getAll("market"), MARKET_SCOPES),
    assetClasses: validValues(query.getAll("asset"), ASSET_CLASSES),
    riskTypes: validValues(query.getAll("risk"), RISK_TYPES),
    strategies: validValues(query.getAll("strategy"), STRATEGIES),
    fxHedges: validValues(query.getAll("fx"), FX_HEDGES),
    aumScope: validValue(query.get("aum"), AUM_SCOPES, "all"),
    terRanges: validValues(query.getAll("ter"), TER_RANGES),
    dividendFrequencies: validValues(query.getAll("div"), DIVIDEND_FREQUENCIES),
    amcs: validValues(query.getAll("amc"), AMC_TYPES),
  };
}
