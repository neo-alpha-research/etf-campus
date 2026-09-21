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
  dividendYieldPct?: unknown;
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
  paymentCycle?: unknown;
  ttmAmountKrw?: unknown;
  ttmDividendYieldPct?: unknown;
  isTr?: unknown;
  updatedAt?: unknown;
};

type DistributionPayload = {
  summaries?: unknown;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asAmount(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
    return Math.round(value);
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
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
    dividendYieldPct: asNumber(record.dividendYieldPct),
    displayStatus: typeof record.displayStatus === "string" ? record.displayStatus : "official_seibro_krx",
    displayLabel,
    updatedAt: text(record.updatedAt),
  };
}

function toSummary(value: unknown): EtfDistributionSummary | null {
  if (!value || typeof value !== "object") return null;
  const record = value as DistributionSummaryRecord;
  const ticker = text(record.ticker);
  const sourceLabel = text(record.sourceLabel) ?? "예탁원(SEIBro) 공시 기반";
  const records = Array.isArray(record.records)
    ? record.records.map(toEvent).filter((item): item is EtfDistributionEvent => item !== null)
    : [];
  const latest = toEvent(record.latest) ?? (records.length > 0 ? records[0] : null);
  const eventCount = typeof record.eventCount === "number" && Number.isInteger(record.eventCount)
    ? record.eventCount
    : records.length;
  const updatedAt = text(record.updatedAt) ?? "";
  const paymentCycle = text(record.paymentCycle);
  const ttmAmountKrw = asNumber(record.ttmAmountKrw);
  const ttmDividendYieldPct = asNumber(record.ttmDividendYieldPct);
  const isTr = typeof record.isTr === "boolean" ? record.isTr : undefined;

  if (!ticker) return null;
  return {
    ticker,
    sourceStatus: typeof record.sourceStatus === "string" ? record.sourceStatus : "official_seibro_krx",
    sourceLabel,
    latest,
    records,
    eventCount,
    paymentCycle,
    ttmAmountKrw,
    ttmDividendYieldPct,
    isTr,
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
