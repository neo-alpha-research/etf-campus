import type { Etf } from "./etf-types";

export const DEFAULT_AUM_MIN = 50_000_000_000;
export const SMALL_ETF_AUM_MAX = 10_000_000_000;

export function getDefaultEtfs(etfs: readonly Etf[]): Etf[] {
  return etfs.filter((etf) => etf.aum >= DEFAULT_AUM_MIN);
}

export function isSmallEtf(etf: Etf): boolean {
  return etf.aum < SMALL_ETF_AUM_MAX;
}

export function getNewEtfs(etfs: readonly Etf[]): Etf[] {
  return etfs.filter((etf) => etf.isNew3m && etf.aum >= SMALL_ETF_AUM_MAX);
}

