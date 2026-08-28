import path from "node:path";
import type { Etf } from "@/lib/domain/etf-types";
import { readCsv, type CsvRow } from "./csv";


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
  tier?: string;
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
      profile.primaryPeerGroupId
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
  if (sameNonEmpty(target.indexFamily, candidate.indexFamily) && !target.indexFamily.startsWith("미확인")) score += 30;
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
    if (candidate.strategyStyle === "passive") {
      reasons.push("동일 지수추종형 구조");
    } else if (candidate.strategyStyle === "active") {
      reasons.push("동일 액티브형 구조");
    }
  }
  if (
    sameNonEmpty(target.fxHedge, candidate.fxHedge) &&
    (candidate.fxHedge === "hedged" || candidate.fxHedge === "unhedged")
  ) {
    const hedgeLabel = candidate.fxHedge === "hedged" ? "환헤지형" : "환노출형";
    reasons.push(`같은 ${hedgeLabel} 유형`);
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
  if (!group) return [];
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
        tier: "same_peer_group"
      };
    });
  return sortPeerCandidates(candidates).slice(0, MAX_PEERS);
}


const isUnconfirmed = (s: string) => !s || s.includes("미확인") || s.includes("unknown");
const STOP_WORDS = new Set(["미확인", "주식전략", "국내", "미국", "글로벌", "기타", "일반", "지수", "전략", "투자"]);

function normalizedTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[\s|,;·/()\-]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
  );
}

function sharesTopic(left: ComparisonProfile, right: ComparisonProfile): boolean {
  if (!left.comparisonTopic || !right.comparisonTopic) return false;
  if (isUnconfirmed(left.comparisonTopic) || isUnconfirmed(right.comparisonTopic)) return false;
  if (left.comparisonTopic === right.comparisonTopic) return true;
  const leftTokens = normalizedTokens(`${left.comparisonTopic} ${isUnconfirmed(left.comparisonSubtopic) ? "" : left.comparisonSubtopic}`);
  const rightTokens = normalizedTokens(`${right.comparisonTopic} ${isUnconfirmed(right.comparisonSubtopic) ? "" : right.comparisonSubtopic}`);
  return [...leftTokens].some((token) => rightTokens.has(token));
}

function hasCompatibleStructure(left: ComparisonProfile, right: ComparisonProfile): boolean {
  return left.assetFamily === right.assetFamily
    && left.regionPrimary === right.regionPrimary
    && left.strategyStyle === right.strategyStyle
    && left.payoffStructure === right.payoffStructure
    && left.direction === right.direction
    && left.leverageMultiple === right.leverageMultiple;
}

function structureReferenceTier(
  target: ComparisonProfile,
  candidate: ComparisonProfile,
): PeerCandidate["tier"] | null {
  const sameCoreStructure =
    target.assetFamily === candidate.assetFamily &&
    target.payoffStructure === candidate.payoffStructure &&
    target.direction === candidate.direction &&
    target.leverageMultiple === candidate.leverageMultiple;
  if (!sameCoreStructure) return null;
  return target.payoffStructure === "inverse" ||
    target.payoffStructure === "covered_call"
    ? "structure_reference"
    : null;
}

function investmentReferenceTier(
  target: ComparisonProfile,
  candidate: ComparisonProfile,
): PeerCandidate["tier"] | null {
  const inverseStrategy =
    target.payoffStructure === "inverse" &&
    target.direction === "short" &&
    (target.leverageMultiple === "1X" || target.leverageMultiple === "2X") &&
    candidate.payoffStructure === "inverse" &&
    candidate.direction === "short" &&
    (candidate.leverageMultiple === "1X" || candidate.leverageMultiple === "2X");
  if (inverseStrategy) return "investment_reference";

  const commodityFuturesStrategy =
    target.assetFamily === candidate.assetFamily &&
    target.payoffStructure === "futures" &&
    target.leverageMultiple === "2X" &&
    candidate.payoffStructure === "futures" &&
    candidate.strategyStyle !== "active";
  if (commodityFuturesStrategy) return "investment_reference";

  const sameThemeReference =
    target.assetFamily === candidate.assetFamily &&
    target.direction === candidate.direction &&
    target.leverageMultiple === candidate.leverageMultiple &&
    ((sameNonEmpty(target.comparisonTopic, candidate.comparisonTopic) && !isUnconfirmed(target.comparisonTopic)) ||
      (sameNonEmpty(target.comparisonCategory, candidate.comparisonCategory) && !isUnconfirmed(target.comparisonCategory)));
  if (sameThemeReference) return "investment_reference";

  const sameAssetStructureReference =
    target.assetFamily === candidate.assetFamily &&
    target.direction === candidate.direction &&
    target.leverageMultiple === candidate.leverageMultiple;
  if (sameAssetStructureReference) return "investment_reference";

  const directionReference =
    target.assetFamily === candidate.assetFamily &&
    target.leverageMultiple === candidate.leverageMultiple &&
    target.direction !== candidate.direction &&
    (target.comparisonTopic === candidate.comparisonTopic || target.comparisonCategory === candidate.comparisonCategory);
  if (directionReference) return "direction_reference";

  const leverageReference =
    target.assetFamily === candidate.assetFamily &&
    target.direction === candidate.direction &&
    target.leverageMultiple !== candidate.leverageMultiple &&
    (target.comparisonTopic === candidate.comparisonTopic || target.comparisonCategory === candidate.comparisonCategory);
  if (leverageReference) return "leverage_reference";

  return null;
}

function calculateRelativeDistance(
  target: ComparisonProfile,
  candidate: ComparisonProfile,
): { score: number; tier: PeerCandidate["tier"]; reasons: string[] } | null {
  let score = 0;

  const sameAssetFamily = sameNonEmpty(target.assetFamily, candidate.assetFamily);
  const sameRegion = sameNonEmpty(target.regionPrimary, candidate.regionPrimary);
  const sameCategory = sameNonEmpty(target.comparisonCategory, candidate.comparisonCategory) && !isUnconfirmed(target.comparisonCategory);
  const sameTopic = sameNonEmpty(target.comparisonTopic, candidate.comparisonTopic) && !isUnconfirmed(target.comparisonTopic);
  const sameSubtopic = sameNonEmpty(target.comparisonSubtopic, candidate.comparisonSubtopic) && !isUnconfirmed(target.comparisonSubtopic);
  const sameIndex = sameNonEmpty(target.indexFamily, candidate.indexFamily) && !isUnconfirmed(target.indexFamily);
  const samePayoff = sameNonEmpty(target.payoffStructure, candidate.payoffStructure);
  const sameDirection = sameNonEmpty(target.direction, candidate.direction);
  const sameLeverage = sameNonEmpty(target.leverageMultiple, candidate.leverageMultiple);
  const sameStyle = sameNonEmpty(target.strategyStyle, candidate.strategyStyle);

  if (sameIndex) score += 40;
  if (sameSubtopic) score += 30;
  if (sameTopic) score += 40;
  else if (sharesTopic(target, candidate)) score += 25;
  if (sameCategory) score += 15;
  if (sameAssetFamily && sameRegion) score += 15;
  else if (sameAssetFamily) score += 5;

  if (samePayoff) score += 10;
  if (sameDirection) score += 10;
  if (sameLeverage) score += 10;
  if (sameStyle) score += 5;
  if (sameNonEmpty(target.fxHedge, candidate.fxHedge)) score += 5;

  if (!sameAssetFamily && !sameCategory && !sameTopic && !sharesTopic(target, candidate)) return null;
  if (score < 20) return null;

  let tier: PeerCandidate["tier"] = "similar_category";
  const reasons: string[] = [];

  const existingTier = investmentReferenceTier(target, candidate) ?? structureReferenceTier(target, candidate);
  if (existingTier) {
    tier = existingTier;
    if (tier === "investment_reference") reasons.push("투자 참고 구조");
    else if (tier === "structure_reference") reasons.push("동일 자산군 참고");
    else if (tier === "direction_reference") reasons.push("방향성 참고");
    else if (tier === "leverage_reference") reasons.push("레버리지 참고");
  } else if (sameTopic || sharesTopic(target, candidate)) {
    tier = "similar_topic";
    reasons.push("유사 투자 주제");
  } else if (sameCategory) {
    tier = "similar_category";
    reasons.push("동일 비교 카테고리");
  } else if (sameAssetFamily && sameRegion) {
    tier = "similar_category";
    reasons.push("동일 지역/자산군 대안");
  } else {
    tier = "similar_category";
  }

  if (sameIndex) reasons.push("동일 지수 계열");
  else if (samePayoff && sameDirection && sameLeverage) reasons.push("동일 상품 구조");
  else if (sameAssetFamily && sameRegion) reasons.push("동일 자산군 대안");

  const validFx = (fx: string) => fx === "hedged" || fx === "unhedged";
  if (validFx(target.fxHedge) && validFx(candidate.fxHedge) && target.fxHedge !== candidate.fxHedge) {
    reasons.push("환헤지/환노출 불일치");
  }

  if (target.payoffStructure !== candidate.payoffStructure && (target.payoffStructure === "covered_call" || candidate.payoffStructure === "covered_call")) {
    reasons.push("커버드콜 ↔ 일반형 (총수익 비교 주의)");
  } else if (!samePayoff || !sameDirection || !sameLeverage) {
    reasons.push("수익 구조 다름 (비교 주의)");
  }

  if (target.assetFamily === "채권" && candidate.assetFamily === "채권" && !sameSubtopic) {
    reasons.push("만기 구간 다름");
  }

  if (reasons.length === 0) reasons.push("대체 투자 참고");

  return { score, tier, reasons: Array.from(new Set(reasons)) };
}

function expandPrimaryCandidates(
  target: Etf,
  targetProfile: ComparisonProfile,
  universe: readonly Etf[],
  existing: PeerCandidate[],
): PeerCandidate[] {
  if (existing.length >= MAX_PEERS) return existing.slice(0, MAX_PEERS);

  const direct = sortPeerCandidates(existing).slice(0, MAX_PEERS);
  
  const brandCounts = new Map<string, number>();
  const baseIndexSet = new Set<string>();
  
  brandCounts.set(target.issuer.brand, 1);
  if (target.baseIndex) baseIndexSet.add(target.baseIndex);
  
  for (const peer of direct) {
    brandCounts.set(peer.etf.issuer.brand, (brandCounts.get(peer.etf.issuer.brand) ?? 0) + 1);
    if (peer.etf.baseIndex) baseIndexSet.add(peer.etf.baseIndex);
  }

  const seen = new Set([target.ticker, ...direct.map((c) => c.etf.ticker)]);
  
  const additionsRaw = universe.flatMap((candidate) => {
    if (seen.has(candidate.ticker) || !hasUsableMarketData(candidate)) return [];
    const profile = data.profiles.get(candidate.ticker);
    if (!isAutomaticProfile(profile)) return [];
    
    const distance = calculateRelativeDistance(targetProfile, profile);
    if (!distance) return [];
    
    return [{
      etf: candidate,
      profile,
      tier: distance.tier,
      similarityScore: distance.score,
      reasons: distance.reasons,
    } as PeerCandidate];
  });
  
  const additionsSorted = sortPeerCandidates(additionsRaw);
  const additionsFiltered: PeerCandidate[] = [];
  
  for (const cand of additionsSorted) {
    const brand = cand.etf.issuer.brand;
    const baseIndex = cand.etf.baseIndex;
    
    const currentBrandCount = brandCounts.get(brand) ?? 0;
    
    if (currentBrandCount >= 2) continue;
    if (baseIndex && baseIndexSet.has(baseIndex)) continue;
    
    additionsFiltered.push(cand);
    brandCounts.set(brand, currentBrandCount + 1);
    if (baseIndex) baseIndexSet.add(baseIndex);
  }
  
  const remaining = Math.max(0, MAX_PEERS - direct.length);
  return [...direct, ...additionsFiltered.slice(0, remaining)];
}

function groupOption(
  target: Etf,
  profile: ComparisonProfile,
  universe: readonly Etf[],
  groupId: string,
  isPrimary: boolean,
): PeerGroupOption | null {
  const group = data.groups.get(groupId);
  if (!group) return null;
  const memberCount = universe.filter((etf) => {
    const memberProfile = data.profiles.get(etf.ticker);
    return isAutomaticProfile(memberProfile) && memberProfile.primaryPeerGroupId === groupId;
  }).length;
  if (memberCount === 0) return null;
  let candidates = candidatesForGroup(target, profile, universe, groupId);
  if (isPrimary) {
    candidates = expandPrimaryCandidates(target, profile, universe, candidates);
  }

  return {
    id: groupId,
    label: group.label || profile.comparisonSubtopic || "동종 ETF",
    description: group.description,
    totalCount: memberCount,
    candidates,
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
