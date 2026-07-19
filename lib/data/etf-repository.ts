import path from "node:path";

import {
  ASSET_CLASSES,
  PENSION_STATUSES,
  RISK_TYPES,
  type AssetClass,
  type Etf,
  type PensionStatus,
  type RiskType,
} from "../domain/etf-types";
import {
  indexUnique,
  parseNullableNumber,
  parseNumberField,
  readCsv,
  requireField,
  type CsvRow,
} from "./csv";

const DATA_DIRECTORY = path.join(process.cwd(), "data");

function assertMember<T extends string>(value: string, allowed: readonly T[], field: string): T {
  if (!allowed.includes(value as T)) throw new Error(`${field}에 허용되지 않은 값이 있습니다: ${value}`);
  return value as T;
}

function assertCompleteJoin(index: Map<string, CsvRow>, tickers: Set<string>, source: string): void {
  if (index.size !== tickers.size) {
    throw new Error(`${source}: 마스터와 행 수가 다릅니다 (${index.size}/${tickers.size}).`);
  }
  for (const ticker of tickers) {
    if (!index.has(ticker)) throw new Error(`${source}: ticker ${ticker}가 누락됐습니다.`);
  }
}

export function loadEtfs(dataDirectory = DATA_DIRECTORY): Etf[] {
  const masterRows = readCsv(path.join(dataDirectory, "etf_master_draft.csv"));
  const returnRows = readCsv(path.join(dataDirectory, "etf_returns_draft.csv"));
  const pensionRows = readCsv(path.join(dataDirectory, "pension_verify_sheet.csv"));

  const masterByTicker = indexUnique(masterRows, "ticker", "etf_master_draft.csv");
  const returnsByTicker = indexUnique(returnRows, "ticker", "etf_returns_draft.csv");
  const pensionByTicker = indexUnique(pensionRows, "ticker", "pension_verify_sheet.csv");
  const tickers = new Set(masterByTicker.keys());

  assertCompleteJoin(returnsByTicker, tickers, "etf_returns_draft.csv");
  assertCompleteJoin(pensionByTicker, tickers, "pension_verify_sheet.csv");

  return masterRows.map((master) => {
    const ticker = requireField(master, "ticker", "etf_master_draft.csv");
    const returns = returnsByTicker.get(ticker)!;
    const pension = pensionByTicker.get(ticker)!;

    return {
      isin: requireField(master, "isin_cd", `master:${ticker}`),
      ticker,
      name: requireField(master, "name", `master:${ticker}`),
      baseIndex: requireField(master, "base_index", `master:${ticker}`),
      close: parseNumberField(master, "close", `master:${ticker}`),
      changePct: parseNumberField(master, "change_pct", `master:${ticker}`),
      tradeValue: parseNumberField(master, "trade_value", `master:${ticker}`),
      aum: parseNumberField(master, "aum", `master:${ticker}`),
      riskType: assertMember(requireField(master, "risk_type", `master:${ticker}`), RISK_TYPES, "risk_type") as RiskType,
      assetClass: assertMember(requireField(master, "asset_class", `master:${ticker}`), ASSET_CLASSES, "asset_class") as AssetClass,
      pension: assertMember(requireField(pension, "final_pension", `pension:${ticker}`), PENSION_STATUSES, "final_pension") as PensionStatus,
      pensionSource: requireField(pension, "final_src", `pension:${ticker}`),
      liquidity: requireField(master, "liquidity", `master:${ticker}`),
      asOfDate: requireField(master, "bas_dt", `master:${ticker}`),
      returns: {
        "1m": parseNullableNumber(returns, "r_1m", `returns:${ticker}`),
        "2m": parseNullableNumber(returns, "r_2m", `returns:${ticker}`),
        "3m": parseNullableNumber(returns, "r_3m", `returns:${ticker}`),
        "6m": parseNullableNumber(returns, "r_6m", `returns:${ticker}`),
        "12m": parseNullableNumber(returns, "r_12m", `returns:${ticker}`),
      },
      isNew3m: returns.new_3m === "Y",
    };
  });
}

