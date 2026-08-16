import fs from "node:fs";
import path from "node:path";

import {
  ASSET_CLASSES,
  PENSION_STATUSES,
  RISK_TYPES,
  type AssetClass,
  type Etf,
  type EtfClassification,
  type PensionStatus,
  type RiskType,
} from "../domain/etf-types";
import { resolveIssuer } from "./etf-amc-mapping";
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

function parseOptionalNullableNumber(row: CsvRow, field: string, source: string): number | null {
  const raw = row[field];
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${source}: ${field} 값이 숫자가 아닙니다: ${raw}`);
  return value;
}

function optionalText(row: CsvRow, field: string): string | null {
  const value = row[field]?.trim();
  return value || null;
}

function loadClassificationIndex(dataDirectory: string): Map<string, CsvRow> {
  const classificationPath = path.join(dataDirectory, "classification", "etf_classification_review_draft.csv");
  if (!fs.existsSync(classificationPath)) return new Map();
  return indexUnique(readCsv(classificationPath), "ticker", "etf_classification_review_draft.csv");
}

function parseClassification(row: CsvRow | undefined): EtfClassification | null {
  if (!row) return null;

  const reviewStatus = optionalText(row, "review_status") ?? "미검수";
  const published = ["자동확정", "수기확정"].includes(reviewStatus);
  const resolved = (finalField: string, suggestedField: string) =>
    optionalText(row, finalField) ?? (published ? optionalText(row, suggestedField) : null);
  const fxHedge = resolved("final_fx_hedge", "suggested_fx_hedge");

  return {
    published,
    marketScope: resolved("final_market_scope", "suggested_market_scope"),
    assetClass: resolved("final_asset_class", "suggested_asset_class"),
    assetDetail: resolved("final_asset_detail", "suggested_asset_detail"),
    strategy: optionalText(row, "suggested_strategy"),
    fxHedge: fxHedge && !["미확인", "해당없음"].includes(fxHedge) ? fxHedge : null,
    reviewStatus,
    reviewPriority: optionalText(row, "review_priority") ?? "",
    sourceUrl: optionalText(row, "official_source_url"),
    evidenceSummary: optionalText(row, "evidence_summary"),
  };
}

export function loadEtfs(dataDirectory = DATA_DIRECTORY): Etf[] {
  const masterRows = readCsv(path.join(dataDirectory, "etf_master_draft.csv"));
  const returnRows = readCsv(path.join(dataDirectory, "etf_returns_draft.csv"));
  const pensionRows = readCsv(path.join(dataDirectory, "pension_verify_sheet.csv"));

  const masterByTicker = indexUnique(masterRows, "ticker", "etf_master_draft.csv");
  const returnsByTicker = indexUnique(returnRows, "ticker", "etf_returns_draft.csv");
  const pensionByTicker = indexUnique(pensionRows, "ticker", "pension_verify_sheet.csv");
  const classificationByTicker = loadClassificationIndex(dataDirectory);
  const tickers = new Set(masterByTicker.keys());

  assertCompleteJoin(returnsByTicker, tickers, "etf_returns_draft.csv");
  assertCompleteJoin(pensionByTicker, tickers, "pension_verify_sheet.csv");

  return masterRows.map((master) => {
    const ticker = requireField(master, "ticker", "etf_master_draft.csv");
    const returns = returnsByTicker.get(ticker)!;
    const pension = pensionByTicker.get(ticker)!;

    const changePct = parseNumberField(master, "change_pct", `master:${ticker}`);

    const name = requireField(master, "name", `master:${ticker}`);
    return {
      isin: requireField(master, "isin_cd", `master:${ticker}`),
      ticker,
      name,
      baseIndex: requireField(master, "base_index", `master:${ticker}`),
      close: parseNumberField(master, "close", `master:${ticker}`),
      changePct,
      tradeValue: parseNumberField(master, "trade_value", `master:${ticker}`),
      aum: parseNumberField(master, "aum", `master:${ticker}`),
      fee: null,

      issuer: resolveIssuer(ticker, requireField(master, "isin_cd", `master:${ticker}`), name),
      riskType: assertMember(requireField(master, "risk_type", `master:${ticker}`), RISK_TYPES, "risk_type") as RiskType,
      assetClass: assertMember(requireField(master, "asset_class", `master:${ticker}`), ASSET_CLASSES, "asset_class") as AssetClass,
      pension: assertMember(requireField(pension, "final_pension", `pension:${ticker}`), PENSION_STATUSES, "final_pension") as PensionStatus,
      pensionSource: requireField(pension, "final_src", `pension:${ticker}`),
      liquidity: requireField(master, "liquidity", `master:${ticker}`),
      asOfDate: requireField(master, "bas_dt", `master:${ticker}`),
      listingDate: optionalText(master, "listing_date"),
      listingDateSource: optionalText(master, "listing_date_source"),
      listingDateStatus: optionalText(master, "listing_date_status") as Etf["listingDateStatus"],
      firstTradedDate: optionalText(master, "first_traded_date"),
      firstTradedDateSource: optionalText(master, "first_traded_date_source"),
      listingDateVerifiedAt: optionalText(master, "listing_date_verified_at"),
      listingDateEvidenceId: optionalText(master, "listing_date_evidence_id"),

      returns: {
        "1d": returns.r_1d === undefined ? changePct : parseOptionalNullableNumber(returns, "r_1d", `returns:${ticker}`),
        "1w": parseOptionalNullableNumber(returns, "r_1w", `returns:${ticker}`),
        "2w": parseOptionalNullableNumber(returns, "r_2w", `returns:${ticker}`),
        "1m": parseNullableNumber(returns, "r_1m", `returns:${ticker}`),
        "2m": parseNullableNumber(returns, "r_2m", `returns:${ticker}`),
        "3m": parseNullableNumber(returns, "r_3m", `returns:${ticker}`),
        "6m": parseNullableNumber(returns, "r_6m", `returns:${ticker}`),
        ytd: parseOptionalNullableNumber(returns, "r_ytd", `returns:${ticker}`),
        "12m": parseNullableNumber(returns, "r_12m", `returns:${ticker}`),
        "24m": parseOptionalNullableNumber(returns, "r_24m", `returns:${ticker}`),
        "36m": parseOptionalNullableNumber(returns, "r_36m", `returns:${ticker}`),
        itd: parseOptionalNullableNumber(returns, "r_itd", `returns:${ticker}`),
      },
      isNew90d: returns.new_90d === undefined || returns.new_90d === "" ? null : returns.new_90d === "Y",
      isNew3m: returns.new_3m === "Y",
      classification: parseClassification(classificationByTicker.get(ticker)),
    };
  });
}
