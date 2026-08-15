import fs from "node:fs";
import path from "node:path";

export type TrStatus = "not_applicable" | "pending" | "blocked_conflict" | "partial" | "available";
export type EstimatedReturnStatus = "not_available" | "partial" | "blocked_conflict" | "available";

export type EtfReturnDisplayStatus = {
  ticker: string;
  isIncomeEtf: boolean;
  priorityTier: string;
  prAvailable: boolean;
  trStatus: TrStatus;
  trAvailablePeriods: string[];
  trUnavailableReason: string;
  lastVerifiedAt: string;
  estimatedReturnStatus: EstimatedReturnStatus;
  estimatedAvailablePeriods: string[];
  estimatedCoverageMonths: number;
  estimatedUnavailableReason: string;
  estimatedFirstCoveredDate: string;
  estimatedLastCoveredDate: string;
};

type StatusSnapshot = {
  statuses: EtfReturnDisplayStatus[];
};

const STATUS_PATH = path.join(process.cwd(), "data", "returns", "etf_return_display_status.json");

function readSnapshot(): StatusSnapshot {
  if (!fs.existsSync(STATUS_PATH)) return { statuses: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(STATUS_PATH, "utf8")) as StatusSnapshot;
    return { statuses: Array.isArray(parsed.statuses) ? parsed.statuses : [] };
  } catch {
    return { statuses: [] };
  }
}

export function getEtfReturnDisplayStatus(ticker: string): EtfReturnDisplayStatus {
  const status = readSnapshot().statuses.find((item) => item.ticker === ticker);
  return status ?? {
    ticker,
    isIncomeEtf: false,
    priorityTier: "",
    prAvailable: true,
    trStatus: "not_applicable",
    trAvailablePeriods: [],
    trUnavailableReason: "TR 상태 정보가 없습니다.",
    lastVerifiedAt: "",
    estimatedReturnStatus: "not_available",
    estimatedAvailablePeriods: [],
    estimatedCoverageMonths: 0,
    estimatedUnavailableReason: "",
    estimatedFirstCoveredDate: "",
    estimatedLastCoveredDate: "",
  };
}
