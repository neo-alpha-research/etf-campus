import {
  RETURN_PERIODS,
  type AssetClass,
  type Etf,
  type ReturnPeriod,
  type RiskType,
} from "./etf-types";

export const INVESTOR_MODES = ["general", "pension", "derivatives", "new"] as const;
export const AUM_SCOPES = ["1000plus", "500plus", "all"] as const;
export const SORT_KEYS = ["return", "tradeValue", "aum", "listingDate"] as const;
export const SORT_DIRECTIONS = ["desc", "asc"] as const;

export const GENERAL_RETURN_PERIODS = [...RETURN_PERIODS] as const satisfies readonly ReturnPeriod[];
export const NEW_RETURN_PERIODS = [...RETURN_PERIODS] as const satisfies readonly ReturnPeriod[];

export type InvestorMode = (typeof INVESTOR_MODES)[number];
export type AumScope = (typeof AUM_SCOPES)[number];
export type ExplorerSortKey = (typeof SORT_KEYS)[number];
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export type ExplorerFilters = {
  assetClasses: readonly AssetClass[];
  riskTypes: readonly RiskType[];
};

export type ExplorerState = ExplorerFilters & {
  mode: InvestorMode;
  scope: AumScope;
  period: ReturnPeriod;
  sort: ExplorerSortKey;
  direction: SortDirection;
  query: string;
  page: number;
};

export const DEFAULT_EXPLORER_STATE: ExplorerState = {
  mode: "general",
  scope: "1000plus",
  period: "1d",
  sort: "return",
  direction: "desc",
  query: "",
  page: 1,
  assetClasses: [],
  riskTypes: [],
};

const DAY_MS = 86_400_000;

function parseDate(value: string): number | null {
  if (!/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return timestamp;
}

export function getListingAgeDays(listingDate: string, asOfDate: string): number | null {
  const listing = parseDate(listingDate);
  const asOf = parseDate(asOfDate);
  if (listing === null || asOf === null) return null;
  return Math.floor((asOf - listing) / DAY_MS);
}

export function isWithinListingWindow(listingDate: string, asOfDate: string, maximumDays = 90): boolean {
  const age = getListingAgeDays(listingDate, asOfDate);
  return age !== null && age >= 0 && age <= maximumDays;
}

export function isNewListing(etf: Etf): boolean {
  if (etf.listingDate) return isWithinListingWindow(etf.listingDate, etf.asOfDate);
  if (etf.isNew90d !== null) return etf.isNew90d;
  return etf.isNew3m;
}

export function getReturnPeriods(mode: InvestorMode): readonly ReturnPeriod[] {
  return mode === "new" ? NEW_RETURN_PERIODS : GENERAL_RETURN_PERIODS;
}

export function getDefaultPeriod(mode: InvestorMode): ReturnPeriod {
  return mode === "new" ? "1m" : "1d";
}

export function filterEtfsByMode(etfs: readonly Etf[], mode: InvestorMode): Etf[] {
  if (mode === "general") return etfs.filter((etf) => etf.riskType === "normal");
  if (mode === "pension") return etfs.filter((etf) => etf.riskType === "normal" && etf.pension === "가능");
  if (mode === "derivatives") return etfs.filter((etf) => etf.riskType === "leverage" || etf.riskType === "inverse");
  return etfs.filter(isNewListing);
}

export function getEtfsByAumScope(etfs: readonly Etf[], scope: AumScope): Etf[] {
  if (scope === "1000plus") return etfs.filter((etf) => etf.aum >= 100_000_000_000);
  if (scope === "500plus") return etfs.filter((etf) => etf.aum >= 50_000_000_000);
  return [...etfs];
}

export function applyExplorerFilters(etfs: readonly Etf[], filters: ExplorerFilters): Etf[] {
  return etfs.filter((etf) => {
    if (filters.assetClasses.length && !filters.assetClasses.includes(etf.assetClass)) return false;
    if (filters.riskTypes.length && !filters.riskTypes.includes(etf.riskType)) return false;
    return true;
  });
}

export function searchEtfs(etfs: readonly Etf[], query: string): Etf[] {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  if (!normalized) return [...etfs];
  return etfs.filter((etf) => `${etf.name} ${etf.ticker} ${etf.baseIndex}`.toLocaleLowerCase("ko-KR").includes(normalized));
}

export function getEtfSearchSuggestions(etfs: readonly Etf[], query: string, limit = 8): Etf[] {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  if (!normalized) return [];

  return etfs
    .map((etf) => {
      const ticker = etf.ticker.toLocaleLowerCase("ko-KR");
      const name = etf.name.toLocaleLowerCase("ko-KR");
      const baseIndex = etf.baseIndex.toLocaleLowerCase("ko-KR");
      let rank = Number.POSITIVE_INFINITY;

      if (ticker === normalized) rank = 0;
      else if (ticker.startsWith(normalized)) rank = 1;
      else if (name.startsWith(normalized)) rank = 2;
      else if (name.includes(normalized)) rank = 3;
      else if (baseIndex.includes(normalized)) rank = 4;

      return { etf, rank };
    })
    .filter(({ rank }) => Number.isFinite(rank))
    .sort((a, b) => a.rank - b.rank || b.etf.tradeValue - a.etf.tradeValue || a.etf.ticker.localeCompare(b.etf.ticker))
    .slice(0, limit)
    .map(({ etf }) => etf);
}

function getSortValue(etf: Etf, sort: ExplorerSortKey, period: ReturnPeriod): number | null {
  if (sort === "return") return etf.returns[period];
  if (sort === "tradeValue" || sort === "aum") return etf[sort];
  return etf.listingDate ? parseDate(etf.listingDate) : null;
}

export function sortExplorerEtfs(
  etfs: readonly Etf[],
  sort: ExplorerSortKey,
  direction: SortDirection,
  period: ReturnPeriod,
): Etf[] {
  return [...etfs].sort((a, b) => {
    const aValue = getSortValue(a, sort, period);
    const bValue = getSortValue(b, sort, period);
    if (aValue === null) return bValue === null ? b.tradeValue - a.tradeValue || a.ticker.localeCompare(b.ticker) : 1;
    if (bValue === null) return -1;
    const compared = direction === "asc" ? aValue - bValue : bValue - aValue;
    return compared || b.tradeValue - a.tradeValue || a.ticker.localeCompare(b.ticker);
  });
}

function validValue<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && allowed.includes(value as T) ? value as T : fallback;
}

function validValues<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((value): value is T => allowed.includes(value as T));
}

export function parseExplorerQuery(query: URLSearchParams): ExplorerState {
  const mode = validValue(query.get("mode"), INVESTOR_MODES, DEFAULT_EXPLORER_STATE.mode);
  const periods = getReturnPeriods(mode);
  const period = validValue(query.get("period"), periods, getDefaultPeriod(mode));
  const parsedPage = Number(query.get("page"));
  return {
    mode,
    scope: validValue(query.get("scope"), AUM_SCOPES, DEFAULT_EXPLORER_STATE.scope),
    period,
    sort: validValue(query.get("sort"), SORT_KEYS, mode === "new" ? "listingDate" : DEFAULT_EXPLORER_STATE.sort),
    direction: validValue(query.get("direction"), SORT_DIRECTIONS, DEFAULT_EXPLORER_STATE.direction),
    query: query.get("q")?.trim() ?? "",
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    assetClasses: validValues(query.getAll("asset"), ["주식-국내", "주식-해외", "채권", "금리·파킹", "원자재", "리츠·인프라", "혼합·자산배분"]),
    riskTypes: validValues(query.getAll("risk"), ["normal", "leverage", "inverse"]),
  };
}

export function serializeExplorerQuery(state: ExplorerState): string {
  const query = new URLSearchParams();
  query.set("mode", state.mode);
  query.set("scope", state.scope);
  query.set("period", state.period);
  query.set("sort", state.sort);
  query.set("direction", state.direction);
  if (state.query) query.set("q", state.query);
  if (state.page > 1) query.set("page", String(state.page));
  state.assetClasses.forEach((value) => query.append("asset", value));
  state.riskTypes.forEach((value) => query.append("risk", value));
  return query.toString();
}

export function isReturnPeriod(value: string): value is ReturnPeriod {
  return RETURN_PERIODS.includes(value as ReturnPeriod);
}
