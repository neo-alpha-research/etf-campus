import fs from "node:fs";
import path from "node:path";

import type { EtfDistributionEvent, EtfDistributionSummary } from "../domain/etf-types";

type DistributionEventRecord = {
  eventId?: unknown;
  sourceId?: unknown;
  sourceOwner?: unknown;
  amountKrw?: unknown;
  exDate?: unknown;
  recordDate?: unknown;
  payDate?: unknown;
  distributionType?: unknown;
  displayStatus?: unknown;
  displayLabel?: unknown;
  updatedAt?: unknown;
};

type DistributionSummaryRecord = {
  ticker?: unknown;
  sourceStatus?: unknown;
  sourceLabel?: unknown;
  latest?: unknown;
  records?: unknown;
  eventCount?: unknown;
  updatedAt?: unknown;
};

type DistributionPayload = {
  summaries?: unknown;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function toEvent(value: unknown): EtfDistributionEvent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as DistributionEventRecord;
  const amountKrw = asAmount(record.amountKrw);
  const exDate = text(record.exDate);
  const recordDate = text(record.recordDate);
  const displayLabel = text(record.displayLabel);
  if (amountKrw === null || !(exDate || recordDate) || !displayLabel) return null;

  return {
    eventId: text(record.eventId),
    sourceId: text(record.sourceId),
    sourceOwner: text(record.sourceOwner),
    amountKrw,
    exDate,
    recordDate,
    payDate: text(record.payDate),
    distributionType: text(record.distributionType) ?? "ordinary_cash",
    displayStatus: record.displayStatus === "krx_official_partial" ? "krx_official_partial" : "issuer_notice",
    displayLabel,
    updatedAt: text(record.updatedAt),
  };
}

function toSummary(value: unknown): EtfDistributionSummary | null {
  if (!value || typeof value !== "object") return null;
  const record = value as DistributionSummaryRecord;
  const ticker = text(record.ticker);
  const sourceLabel = text(record.sourceLabel);
  const latest = toEvent(record.latest);
  const records = Array.isArray(record.records)
    ? record.records.map(toEvent).filter((item): item is EtfDistributionEvent => item !== null)
    : [];
  const eventCount = typeof record.eventCount === "number" && Number.isInteger(record.eventCount)
    ? record.eventCount
    : records.length;
  const updatedAt = text(record.updatedAt) ?? "";

  if (!ticker || !sourceLabel || !latest || records.length === 0) return null;
  return {
    ticker,
    sourceStatus: record.sourceStatus === "krx_official_partial" || record.sourceStatus === "mixed_official_sources"
      ? record.sourceStatus
      : "issuer_notice",
    sourceLabel,
    latest,
    records,
    eventCount,
    updatedAt,
  };
}

export function loadDistributionSummaryIndex(dataDirectory: string): Map<string, EtfDistributionSummary> {
  const summaryPath = path.join(dataDirectory, "distributions", "etf_distribution_summaries.json");
  if (!fs.existsSync(summaryPath)) return new Map();

  let payload: unknown = null;
  try {
    payload = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
  } catch (err) {
    console.error(`Error parsing JSON in ${summaryPath}:`, err);
    return new Map();
  }
  const summaries = (payload as DistributionPayload)?.summaries;
  if (!Array.isArray(summaries)) return new Map();

  return new Map(
    summaries
      .map(toSummary)
      .filter((item): item is EtfDistributionSummary => item !== null)
      .map((item) => [item.ticker, item] as const),
  );
}
