import fs from "node:fs";
import path from "node:path";
import type { EtfFeeInfo } from "../domain/etf-types";

type RegistryRow = {
  ticker: string;
  total_fee_pct?: number | null;
  ter_pct?: number | null;
  other_cost_pct?: number | null;
  trading_cost_pct?: number | null;
  effective_date?: string | null;
  source_document_date?: string | null;
  verified_at?: string | null;
  verification_status?: EtfFeeInfo["verificationStatus"] | string | null;
  primary_source_type?: string | null;
  primary_source_url?: string | null;
  dart_receipt_no?: string | null;
  secondary_source_url?: string | null;
  source_note?: string | null;
};

const toNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const toStatus = (value: unknown): EtfFeeInfo["verificationStatus"] => value === "official_single_source" ? "official_single_source" : value === "verified_official" ? "verified_official" : value === "pending_review" ? "pending_review" : value === "conflict" ? "conflict" : value === "stale" ? "stale" : "seed_unverified";
const loadRows = (filePath: string): RegistryRow[] => {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (Array.isArray(parsed)) return parsed as RegistryRow[];
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) return (parsed as { records: RegistryRow[] }).records;
    return [];
  } catch (error) {
    console.error(`Error parsing JSON in ${filePath}:`, error);
    return [];
  }
};
const toInfo = (row: RegistryRow): EtfFeeInfo => ({
  totalFeePct: toNumber(row.total_fee_pct), terPct: toNumber(row.ter_pct), otherCostPct: toNumber(row.other_cost_pct), tradingCostPct: toNumber(row.trading_cost_pct),
  effectiveDate: row.effective_date ?? row.source_document_date ?? null, verifiedAt: row.verified_at ?? null, verificationStatus: toStatus(row.verification_status),
  primarySourceType: row.primary_source_type ?? null, primarySourceUrl: row.primary_source_url ?? null, dartReceiptNo: row.dart_receipt_no ?? null, secondarySourceUrl: row.secondary_source_url ?? null, sourceNote: row.source_note ?? null,
});
export function loadOfficialEtfFeeIndex(dataDirectory: string): Map<string, EtfFeeInfo> {
  const filePath = path.join(dataDirectory, "fees", "etf_fee_registry.json");
  const rows = loadRows(filePath);
  const map = new Map<string, EtfFeeInfo>();
  for (const row of rows) {
    if (row.ticker) map.set(row.ticker, toInfo(row));
  }
  return map;
}
