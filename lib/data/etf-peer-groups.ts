import path from "node:path";
import type { Etf } from "@/lib/domain/etf-types";
import { readCsv, type CsvRow } from "./csv";

const AUTOMATIC_STATUSES = new Set([
  "verified_official",
  "auto_high_confidence",
]);
const MAX_PEERS = 4;

export type ComparisonProfile = {
  ticker: string;
  primaryPeerGroupId: string;
  alternatePeerGroupIds: string[];
  classificationStatus: string;
  assetFamily: string;
  regionPrimary: string;
  comparisonCategory: string;
  comparisonTopic: string;
  comparisonSubtopic: string;
  indexFamily: string;
  strategyStyle: string;
  payoffStructure: string;
  direction: string;
  leverageMultiple: string;
  fxHedge: string;
  replicationMethod: string;
  concentrationBucket: string;
};

type GroupRegistry = {
  id: string;
  label: string;
  description: string;
  requiredStructure: string;
  automaticEligible: boolean;
};

export type PeerCandidate = {
  etf: Etf;
  similarityScore: number;
  reasons: string[];
  profile: ComparisonProfile;
};

export type PeerGroupOption = {
  id: string;
  label: string;
  description: string;
  totalCount: number;
  candidates: PeerCandidate[];
  isPrimary: boolean;
};

export type PeerComparison = {
  profile: ComparisonProfile | null;
  state: "ready" | "unverified" | "no_peers";
  groups: PeerGroupOption[];
};

function value(row: CsvRow, key: string): string {
  return (row[key] ?? "").trim();
}

function parseGroupIds(raw: string): string[] {
  return [...new Set(raw.split(/[|,;\s]+/).map((id) => id.trim()).filter(Boolean))];
}

function parseProfile(row: CsvRow): ComparisonProfile {
  return {
    ticker: value(row, "ticker"),
    primaryPeerGroupId: value(row, "primary_peer_group_id"),
    alternatePeerGroupIds: parseGroupIds(value(row, "alternate_peer_group_ids")),
    classificationStatus: value(row, "classification_status"),
    assetFamily: value(row, "asset_family"),
    regionPrimary: value(row, "region_primary"),
    comparisonCategory: value(row, "comparison_category"),
    comparisonTopic: value(row, "comparison_topic"),
    comparisonSubtopic: value(row, "comparison_subtopic"),
    indexFamily: value(row, "index_family"),
    strategyStyle: value(row, "strategy_style"),
    payoffStructure: value(row, "payoff_structure"),
    direction: value(row, "direction"),
    leverageMultiple: value(row, "leverage_multiple"),
    fxHedge: value(row, "fx_hedge"),
    replicationMethod: value(row, "replication_method"),
    concentrationBucket: value(row, "concentration_bucket"),
  };
}

function parseRegistry(row: CsvRow): GroupRegistry {
  return {
    id: value(row, "primary_peer_group_id") || value(row, "peer_group_id"),
    label: value(row, "peer_group_name") || value(row, "peer_group_label"),
    description: value(row, "classification_rationale") || value(row, "description"),
    requiredStructure: value(row, "strategy_structure") || value(row, "required_payoff_structure"),
    automaticEligible:
      value(row, "automatic_comparison_eligible") === "Y" ||
      value(row, "automatic_comparison_eligible").toLowerCase() === "true",
  };
}

function loadData(): {
  profiles: ReadonlyMap<string, ComparisonProfile>;
  groups: ReadonlyMap<string, GroupRegistry>;
} {
  const classificationPath = path.join(
    process.cwd(),
    "data",
    "comparison",
    "etf_comparison_classification.csv",
  );
  const registryPath = path.join(
    process.cwd(),
    "data",
    "comparison",
    "peer_group_registry.csv",
  );
  const profiles = readCsv(classificationPath)
    .map(parseProfile)
    .filter((profile) => profile.ticker.length > 0);
  const groups = readCsv(registryPath)
    .map(parseRegistry)
    .filter((group) => group.id.length > 0);

  const profileMap = new Map<string, ComparisonProfile>();
  for (const profile of profiles) {
    if (profileMap.has(profile.ticker)) {
      throw new Error(`comparison classification: duplicated ticker ${profile.ticker}`);
    }
    profileMap.set(profile.ticker, profile);
  }
  const groupMap = new Map<string, GroupRegistry>();
  for (const group of groups) {
    if (groupMap.has(group.id)) {
      throw new Error(`peer group registry: duplicated group ${group.id}`);
    }
    groupMap.set(group.id, group);
  }
  for (const profile of profiles) {
    if (profile.primaryPeerGroupId && !groupMap.has(profile.primaryPeerGroupId)) {
      throw new Error(
        `comparison classification: missing registry group ${profile.primaryPeerGroupId} for ${profile.ticker}`,
      );
    }
  }
  return { profiles: profileMap, groups: groupMap };
}

const data = loadData();

export function isAutomaticProfile(profile: ComparisonProfile | undefined): profile is ComparisonProfile {
  return Boolean(
    profile &&
      profile.primaryPeerGroupId &&
      AUTOMATIC_STATUSES.has(profile.classificationStatus),
  );
}

function hasUsableMarketData(etf: Etf): boolean {
  return Number.isFinite(etf.close) && etf.close > 0 &&
    Number.isFinite(etf.aum) && etf.aum >= 0 &&
    Number.isFinite(etf.tradeValue) && etf.tradeValue >= 0;
}

function sameNonEmpty(left: string, right: string): boolean {
  return left.length > 0 && right.length > 0 && left === right;
}

export function calculateSimilarityScore(target: ComparisonProfile, candidate: ComparisonProfile): PeerCandidate["similarityScore"] {
  let score = 0;
  if (sameNonEmpty(target.indexFamily, candidate.indexFamily)) score += 30;
  if (sameNonEmpty(target.comparisonSubtopic, candidate.comparisonSubtopic)) score += 25;
  if (sameNonEmpty(target.strategyStyle, candidate.strategyStyle)) score += 15;
  if (sameNonEmpty(target.fxHedge, candidate.fxHedge)) score += 10;
  if (sameNonEmpty(target.concentrationBucket, candidate.concentrationBucket)) score += 10;
  if (sameNonEmpty(target.replicationMethod, candidate.replicationMethod)) score += 5;
  if (candidate.classificationStatus === "verified_official") score += 5;
  return score;
}

function candidateReasons(target: ComparisonProfile, candidate: ComparisonProfile): string[] {
  const reasons = [`같은 ${candidate.comparisonSubtopic || "동종"} 비교그룹`];
  if (sameNonEmpty(target.strategyStyle, candidate.strategyStyle)) {
    reasons.push(`동일 ${candidate.strategyStyle} 구조`);
  }
  if (sameNonEmpty(target.fxHedge, candidate.fxHedge)) {
    reasons.push(`같은 ${candidate.fxHedge} 유형`);
  }
  if (candidate.classificationStatus === "verified_official") {
    reasons.push("공식 확인 분류");
  }
  return reasons;
}

export function sortPeerCandidates(candidates: readonly PeerCandidate[]): PeerCandidate[] {
  return [...candidates].sort(
    (left, right) =>
      right.similarityScore - left.similarityScore ||
      right.etf.aum - left.etf.aum ||
      right.etf.tradeValue - left.etf.tradeValue ||
      left.etf.ticker.localeCompare(right.etf.ticker),
  );
}

function meetsRequiredStructure(profile: ComparisonProfile, group: GroupRegistry): boolean {
  if (!group.requiredStructure) return true;
  const required = group.requiredStructure.split("|");
  if (required.length < 3) return true;
  return (
    (!required[0] || profile.payoffStructure === required[0]) &&
    (!required[1] || profile.direction === required[1]) &&
    (!required[2] || profile.leverageMultiple === required[2])
  );
}

function candidatesForGroup(
  target: Etf,
  targetProfile: ComparisonProfile,
  universe: readonly Etf[],
  groupId: string,
): PeerCandidate[] {
  const group = data.groups.get(groupId);
  if (!group || !group.automaticEligible) return [];
  const candidates = universe
    .filter((candidate) => {
      if (candidate.ticker === target.ticker || !hasUsableMarketData(candidate)) return false;
      const profile = data.profiles.get(candidate.ticker);
      return Boolean(
        isAutomaticProfile(profile) &&
          profile.primaryPeerGroupId === groupId &&
          meetsRequiredStructure(profile, group),
      );
    })
    .map((etf) => {
      const profile = data.profiles.get(etf.ticker)!;
      return {
        etf,
        profile,
        similarityScore: calculateSimilarityScore(targetProfile, profile),
        reasons: candidateReasons(targetProfile, profile),
      };
    });
  return sortPeerCandidates(candidates).slice(0, MAX_PEERS);
}

function groupOption(
  target: Etf,
  profile: ComparisonProfile,
  universe: readonly Etf[],
  groupId: string,
  isPrimary: boolean,
): PeerGroupOption | null {
  const group = data.groups.get(groupId);
  if (!group || !group.automaticEligible) return null;
  const memberCount = universe.filter((etf) => {
    const memberProfile = data.profiles.get(etf.ticker);
    return isAutomaticProfile(memberProfile) && memberProfile.primaryPeerGroupId === groupId;
  }).length;
  if (memberCount === 0) return null;
  return {
    id: groupId,
    label: group.label || profile.comparisonSubtopic || "동종 ETF",
    description: group.description,
    totalCount: memberCount,
    candidates: candidatesForGroup(target, profile, universe, groupId),
    isPrimary,
  };
}

export function getPeerComparison(target: Etf, universe: readonly Etf[]): PeerComparison {
  const profile = data.profiles.get(target.ticker);
  if (!isAutomaticProfile(profile) || !hasUsableMarketData(target)) {
    return { profile: profile ?? null, state: "unverified", groups: [] };
  }
  const primary = groupOption(target, profile, universe, profile.primaryPeerGroupId, true);
  if (!primary) return { profile, state: "unverified", groups: [] };
  const alternates = profile.alternatePeerGroupIds
    .filter((id) => id !== profile.primaryPeerGroupId)
    .map((id) => groupOption(target, profile, universe, id, false))
    .filter((option): option is PeerGroupOption => option !== null);
  return {
    profile,
    state: primary.candidates.length > 0 ? "ready" : "no_peers",
    groups: [primary, ...alternates],
  };
}

export function getComparableEtfs(target: Etf, universe: readonly Etf[], limit = MAX_PEERS): {
  peers: Etf[];
  peerGroup: PeerGroupOption | null;
} {
  const comparison = getPeerComparison(target, universe);
  const primary = comparison.groups.find((group) => group.isPrimary) ?? null;
  return {
    peers: (primary?.candidates ?? []).slice(0, limit).map((candidate) => candidate.etf),
    peerGroup: primary,
  };
}
