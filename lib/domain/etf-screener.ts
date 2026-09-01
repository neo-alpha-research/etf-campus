import { ASSET_CLASSES, RISK_TYPES, MARKET_SCOPES, STRATEGIES, FX_HEDGES, type AssetClass, type Etf, type RiskType, type MarketScope, type Strategy, type FxHedge } from "./etf-types";
import { getEtfMarketScope, getEtfStrategies, getEtfFxHedge } from "./etf-classification";
import { type AumScope, AUM_SCOPES } from "./etf-explorer";

const LEGACY_AMC_TO_ISSUER_ID: Record<string, string> = {
  "삼성": "samsung",
  "미래에셋": "miraeasset",
  "KB": "kb",
  "한국투자": "koreainvestment",
  "신한": "shinhan",
  "기타": "unknown"
};

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

  issuerIds: readonly string[];
};

export const DEFAULT_SCREENER_FILTERS: ScreenerFilters = {
  keyword: "",
  // ETF Campus의 기본 이용자는 DC·IRP 투자자이므로, 첫 진입에서는
  // 공식 확인된 연금 편입 가능 ETF만 보여준다.
  pensionOnly: true,
  marketScopes: [],
  assetClasses: [],
  riskTypes: ["normal"],
  strategies: [],
  fxHedges: [],
  aumScope: "1000plus",
  terRanges: [],

  issuerIds: [],
};

function inTerRange(ter: number, range: TerRange): boolean {
  if (range === "under0.1") return ter < 0.001;
  if (range === "0.1to0.5") return ter >= 0.001 && ter < 0.005;
  return ter >= 0.005;
}

export type ScreenerEtf = Pick<Etf,
  | "ticker"
  | "name"
  | "baseIndex"
  | "close"
  | "tradeValue"
  | "aum"
  | "fee"
  | "issuer"
  | "riskType"
  | "assetClass"
  | "pension"
  | "asOfDate"
  | "returns"
  | "returnsTr"
  | "classification"
> & {
  returnsNetTr?: Record<string, number | null>;
};

export function filterEtfs(etfs: readonly ScreenerEtf[], filters: ScreenerFilters): ScreenerEtf[] {
  return etfs.filter((etf) => {
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      if (!etf.name.toLowerCase().includes(kw) && !etf.baseIndex.toLowerCase().includes(kw)) return false;
    }
    if (filters.pensionOnly && etf.pension !== "가능") return false;
    
    if (filters.marketScopes.length > 0) {
      const scope = getEtfMarketScope(etf as unknown as Etf);
      if (!scope || !filters.marketScopes.includes(scope)) return false;
    }

    if (filters.assetClasses.length && !filters.assetClasses.includes(etf.assetClass)) return false;
    if (filters.riskTypes.length > 0) {
      const hasNormal = filters.riskTypes.includes("normal");
      const hasLeverage = filters.riskTypes.includes("leverage");
      const hasInverse = filters.riskTypes.includes("inverse");
      const hasParking = filters.riskTypes.includes("parking");

      const matches = (
        (hasNormal && etf.riskType === "normal" && etf.assetClass !== "금리·파킹") ||
        (hasLeverage && etf.riskType === "leverage") ||
        (hasInverse && etf.riskType === "inverse") ||
        (hasParking && etf.assetClass === "금리·파킹")
      );
      if (!matches) return false;
    }
    
    if (filters.strategies.length > 0) {
      const strategies = getEtfStrategies(etf as unknown as Etf);
      if (!filters.strategies.some(s => strategies.includes(s))) return false;
    }

    if (filters.fxHedges.length > 0) {
      const fx = getEtfFxHedge(etf as unknown as Etf);
      if (!fx || !filters.fxHedges.includes(fx)) return false;
    }
    if (filters.aumScope === "1000plus" && etf.aum < 100_000_000_000) return false;
    if (filters.aumScope === "500plus" && etf.aum < 50_000_000_000) return false;
    if (filters.terRanges.length && !filters.terRanges.some((range) => inTerRange(etf.fee?.totalFeePct ?? 0, range))) return false;

    if (filters.issuerIds.length && !filters.issuerIds.includes(etf.issuer.issuerId)) return false;
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
    filters.issuerIds.length === 0;

  if (isDefault) return "";

  const query = new URLSearchParams();
  if (filters.keyword) query.set("q", filters.keyword);
  // 기본값(true)은 URL을 짧게 유지한다. 사용자가 필터를 해제한 경우에만
  // 명시적으로 기록해 새로고침·공유 URL에서도 해제 상태를 보존한다.
  if (!filters.pensionOnly) query.set("pension", "all");
  filters.marketScopes.forEach((value) => query.append("market", value));
  filters.assetClasses.forEach((value) => query.append("asset", value));
  filters.riskTypes.forEach((value) => query.append("risk", value));
  filters.strategies.forEach((value) => query.append("strategy", value));
  filters.fxHedges.forEach((value) => query.append("fx", value));
  if (filters.aumScope !== "all") query.set("aum", filters.aumScope);
  filters.terRanges.forEach((value) => query.append("ter", value));
  filters.issuerIds.forEach((value) => query.append("issuer", value));

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
    // 기존의 pension=eligible 링크와, pension 파라미터가 없는 새 링크는
    // 모두 연금 ETF 기본 필터를 적용한다. pension=all만 해제 상태다.
    pensionOnly: query.get("pension") !== "all",
    marketScopes: validValues(query.getAll("market"), MARKET_SCOPES),
    assetClasses: validValues(query.getAll("asset"), ASSET_CLASSES),
    riskTypes: validValues(query.getAll("risk"), RISK_TYPES),
    strategies: validValues(query.getAll("strategy"), STRATEGIES),
    fxHedges: validValues(query.getAll("fx"), FX_HEDGES),
    aumScope: validValue(query.get("aum"), AUM_SCOPES, "all"),
    terRanges: validValues(query.getAll("ter"), TER_RANGES),
    issuerIds: Array.from(new Set([
      ...query.getAll("amc").map(amc => LEGACY_AMC_TO_ISSUER_ID[amc] || amc),
      ...query.getAll("issuer")
    ])),
  };
}
