import fs from "node:fs";
import path from "node:path";

import {
  ASSET_CLASSES,
  PENSION_STATUSES,
  RISK_TYPES,
  type AssetClass,
  type Etf,
  type EtfClassification,
  type EtfReturns,
  type ListingDateStatus,
  type PensionStatus,
  type PensionLimit,
  type PensionSourceType,
  type PensionConfidenceLevel,
  type IsaStatus,
  type IsaTaxType,
  type IsaTaxBenefit,
  type RiskType,
} from "../domain/etf-types";
import { resolveIssuer } from "./etf-amc-mapping";
import { loadOfficialEtfFeeIndex } from "./etf-fee-registry";
import { loadDistributionSummaryIndex } from "./etf-distribution-registry";

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

function deriveIso6166Isin(ticker: string): string {
  const cleanTk = ticker.trim().toUpperCase();
  if (cleanTk.length !== 6) return `KR7${cleanTk}000`;
  const isin11 = `KR7${cleanTk}00`;
  let converted = "";
  for (const c of isin11) {
    if (c >= "0" && c <= "9") {
      converted += c;
    } else {
      converted += String(c.charCodeAt(0) - 55);
    }
  }
  const digits = converted.split("").map(Number);
  let total = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = digits[digits.length - 1 - i];
    if (i % 2 === 0) {
      const doubled = d * 2;
      total += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      total += d;
    }
  }
  const check = (10 - (total % 10)) % 10;
  return isin11 + check;
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

function loadTrReturnsIndex(dataDirectory: string): Map<string, { tr: Record<string, number | null>, netTr: Record<string, number | null> }> {
  const trPath = path.join(dataDirectory, "returns", "etf_total_return_metrics.csv");
  if (!fs.existsSync(trPath)) return new Map();
  
  const rows = readCsv(trPath);
  const result = new Map<string, { tr: Record<string, number | null>, netTr: Record<string, number | null> }>();
  
  for (const row of rows) {
    const ticker = row.ticker?.trim();
    if (!ticker) continue;
    
    if (!result.has(ticker)) {
      result.set(ticker, {
        tr: {
          "1d": null, "1w": null, "2w": null, "1m": null, "2m": null, "3m": null, "6m": null,
          "12m": null, "24m": null, "36m": null, "ytd": null, "itd": null
        },
        netTr: {
          "1d": null, "1w": null, "2w": null, "1m": null, "2m": null, "3m": null, "6m": null,
          "12m": null, "24m": null, "36m": null, "ytd": null, "itd": null
        }
      });
    }
    
    const period = row.period?.trim();
    const status = row.calculation_status?.trim();
    const pctStr = row.total_return_pct?.trim();
    const netPctStr = row.net_total_return_pct?.trim();
    
    let mappedPeriod: string | undefined;
    if (period === "1y") mappedPeriod = "12m";
    else if (period === "2y") mappedPeriod = "24m";
    else if (period === "3y") mappedPeriod = "36m";
    else if (["1d", "1w", "2w", "1m", "2m", "3m", "6m", "ytd", "itd"].includes(period || "")) mappedPeriod = period;
    
    if (mappedPeriod && status === "calculated" && pctStr) {
      const parsed = parseFloat(pctStr);
      if (!isNaN(parsed)) {
        result.get(ticker)!.tr[mappedPeriod] = parsed;
      }
      if (netPctStr) {
        const netParsed = parseFloat(netPctStr);
        if (!isNaN(netParsed)) {
          result.get(ticker)!.netTr[mappedPeriod] = netParsed;
        }
      }
    }
  }
  return result;
}

function loadIssuerPensionDisclosureDates(dataDirectory: string): Map<string, string> {
  const manifestPath = path.join(dataDirectory, "regulatory", "sources", "evidence_manifest.json");
  const datesByIssuerId = new Map<string, string>();
  if (!fs.existsSync(manifestPath)) return datesByIssuerId;

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Record<string, { collected_at?: string }>;
    for (const [key, meta] of Object.entries(manifest)) {
      if (!key.startsWith("issuers/")) continue;
      const parts = key.split("/");
      if (parts.length >= 3) {
        const issuerDir = parts[1];
        const issuerId = issuerDir === "ace" ? "koreainvestment" : issuerDir;

        let dateStr: string | null = null;
        if (meta && typeof meta.collected_at === "string") {
          dateStr = meta.collected_at.slice(0, 10);
        } else {
          const match = parts[2].match(/(\d{4})(\d{2})(\d{2})/);
          if (match) {
            dateStr = `${match[1]}-${match[2]}-${match[3]}`;
          }
        }
        if (dateStr) {
          datesByIssuerId.set(issuerId, dateStr);
          datesByIssuerId.set(issuerDir, dateStr);
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  return datesByIssuerId;
}

export function loadEtfs(dataDirectory = DATA_DIRECTORY): Etf[] {
  const masterRows = readCsv(path.join(dataDirectory, "etf_master_draft.csv"));
  const feeByTicker = loadOfficialEtfFeeIndex(dataDirectory);
  const distributionByTicker = loadDistributionSummaryIndex(dataDirectory);

  const returnRows = readCsv(path.join(dataDirectory, "etf_returns_draft.csv"));

  const masterByTicker = indexUnique(masterRows, "ticker", "etf_master_draft.csv");
  const returnsByTicker = indexUnique(returnRows, "ticker", "etf_returns_draft.csv");
  const classificationByTicker = loadClassificationIndex(dataDirectory);
  const trReturnsByTicker = loadTrReturnsIndex(dataDirectory);
  const issuerPensionDates = loadIssuerPensionDisclosureDates(dataDirectory);
  const tickers = new Set(masterByTicker.keys());

  assertCompleteJoin(returnsByTicker, tickers, "etf_returns_draft.csv");

  return masterRows.map((master) => {
    const ticker = requireField(master, "ticker", "etf_master_draft.csv");
    const returns = returnsByTicker.get(ticker)!;
    const trData = trReturnsByTicker.get(ticker) || { tr: {}, netTr: {} };

    const changePct = parseNumberField(master, "change_pct", `master:${ticker}`);

    const name = requireField(master, "name", `master:${ticker}`);
    const isin = master.isin_cd?.trim() || deriveIso6166Isin(ticker);
    const issuer = resolveIssuer(ticker, isin, name);

    return {
      isin,
      ticker,
      name,
      baseIndex: requireField(master, "base_index", `master:${ticker}`),
      close: parseNumberField(master, "close", `master:${ticker}`),
      changePct,
      tradeValue: parseNumberField(master, "trade_value", `master:${ticker}`),
      aum: parseNumberField(master, "aum", `master:${ticker}`),
      nav: parseOptionalNullableNumber(master, "nav", `master:${ticker}`),
      disparity: parseOptionalNullableNumber(master, "disparity", `master:${ticker}`),
      trackingError: parseOptionalNullableNumber(master, "tracking_error", `master:${ticker}`),
      fee: feeByTicker.get(ticker) ?? null,
      distributionSummary: distributionByTicker.get(ticker) ?? null,
      distributionYield: distributionByTicker.get(ticker)?.ttmDividendYieldPct ?? null,
      distributionCycle: distributionByTicker.get(ticker)?.paymentCycle ?? null,
      lastDistributionDate: distributionByTicker.get(ticker)?.latest?.exDate ?? null,

      issuer,
      riskType: assertMember(requireField(master, "risk_type", `master:${ticker}`), RISK_TYPES, "risk_type") as RiskType,
      assetClass: assertMember(requireField(master, "asset_class", `master:${ticker}`), ASSET_CLASSES, "asset_class") as AssetClass,
      pension: assertMember(
        (optionalText(master, "pension_eligible") || "불가") as string,
        PENSION_STATUSES,
        "pension_eligible"
      ) as PensionStatus,
      pensionSource: (optionalText(master, "pension_source") || "미확인") as string,
      pensionLimit: optionalText(master, "pension_limit") as PensionLimit | null,
      pensionSourceType: optionalText(master, "pension_source") as PensionSourceType | null,
      pensionVerified: optionalText(master, "pension_verified") as "Y" | "N" | null,
      pensionConfidence: optionalText(master, "pension_confidence") as PensionConfidenceLevel | null,
      personalPension: (optionalText(master, "personal_pension") || null) as "가능" | "불가" | null,
      personalPensionLimit: (optionalText(master, "personal_pension_limit") || null) as "100%" | "불가" | null,
      personalPensionAsOfDate: issuerPensionDates.get(issuer.issuerId) ?? null,
      isaEligible: optionalText(master, "isa_eligible") as IsaStatus | null,
      isaEducationRequired: optionalText(master, "isa_education_required") as "Y" | "N" | null,
      isaTaxType: (optionalText(master, "isa_tax_type") || null) as IsaTaxType | null,
      isaTaxBenefit: (optionalText(master, "isa_tax_benefit") || null) as IsaTaxBenefit | null,
      liquidity: requireField(master, "liquidity", `master:${ticker}`),
      asOfDate: requireField(master, "bas_dt", `master:${ticker}`),
      listingDate: optionalText(master, "listing_date"),
      listingDateSource: optionalText(master, "listing_date_source"),
      listingDateStatus: optionalText(master, "listing_date_status") as ListingDateStatus | null,
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
      returnsTr: Object.keys(trData.tr).length > 0 ? (trData.tr as EtfReturns) : undefined,
      returnsNetTr: Object.keys(trData.netTr).length > 0 ? (trData.netTr as EtfReturns) : undefined,
      itdAnchor: {
        price: parseOptionalNullableNumber(returns, "itd_anchor_close", `returns:${ticker}`),
        date: optionalText(returns, "itd_anchor_date"),
        source: optionalText(returns, "itd_source"),
        qualityStatus: optionalText(returns, "itd_quality_status"),
        verified: optionalText(returns, "itd_quality_status") === "official_verified"
          && optionalText(returns, "itd_source") === "KRX_KIND_LISTING_REFERENCE_PRICE",
      },
      isNew90d: returns.new_90d === undefined || returns.new_90d === "" ? null : returns.new_90d === "Y",
      isNew3m: returns.new_3m === "Y",
      classification: parseClassification(classificationByTicker.get(ticker)),
    };
  });
}
