import fs from "node:fs";
import path from "node:path";
import type { EtfFeeInfo } from "../domain/etf-types";

type FeeRegistryRecord = {
  ticker: string;
  total_fee_pct?: number | null;
  ter_pct?: number | null;
  other_cost_pct?: number | null;
  trading_cost_pct?: number | null;
  effective_date?: string | null;
  verified_at?: string | null;
  verification_status?: string | null;
  primary_source_type?: string | null;
  primary_source_url?: string | null;
  dart_receipt_no?: string | null;
  secondary_source_url?: string | null;
  source_note?: string | null;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toFeeInfo(record: FeeRegistryRecord): EtfFeeInfo {
  return {
    totalFeePct: asNumber(record.total_fee_pct),
    terPct: asNumber(record.ter_pct),
    otherCostPct: asNumber(record.other_cost_pct),
    tradingCostPct: asNumber(record.trading_cost_pct),
    effectiveDate: record.effective_date ?? null,
    verifiedAt: record.verified_at ?? null,
    verificationStatus: "verified_official",
    primarySourceType: record.primary_source_type ?? null,
    primarySourceUrl: record.primary_source_url ?? null,
    dartReceiptNo: record.dart_receipt_no ?? null,
    secondarySourceUrl: record.secondary_source_url ?? null,
    sourceNote: record.source_note ?? null,
  };
}

export function loadOfficialEtfFeeIndex(dataDirectory: string): Map<string, EtfFeeInfo> {
  const registryPath = path.join(dataDirectory, "fees", "etf_fee_registry.json");
  if (!fs.existsSync(registryPath)) return new Map();

  const payload: unknown = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  if (!Array.isArray(payload)) return new Map();

  const entries = payload
    .filter((value): value is FeeRegistryRecord =>
      typeof value === "object" && value !== null && typeof (value as FeeRegistryRecord).ticker === "string",
    )
    .filter((record) => record.verification_status === "verified_official")
    .map((record) => [record.ticker, toFeeInfo(record)] as const);

  return new Map(entries);
}
