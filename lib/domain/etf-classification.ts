import type { Etf } from "./etf-types";

const ASSET_LABELS: Record<string, string> = {
  "주식-국내": "주식",
  "주식-해외": "주식",
  "금리·파킹": "금리/파킹",
  "리츠·인프라": "리츠/인프라",
  "혼합·자산배분": "혼합자산",
};

export function getClassificationParts(etf: Etf, detailed = false): string[] {
  const classification = etf.classification?.published ? etf.classification : null;
  const parts = [
    classification?.marketScope,
    classification?.assetClass ?? ASSET_LABELS[etf.assetClass] ?? etf.assetClass,
  ];

  if (detailed && classification?.assetDetail) parts.push(classification.assetDetail);
  if (classification?.fxHedge) parts.push(classification.fxHedge);
  if (etf.riskType === "leverage") parts.push("레버리지");
  if (etf.riskType === "inverse") parts.push("인버스");

  return [...new Set(parts.filter((value): value is string => Boolean(value)))];
}

export function getEtfCautions(etf: Etf): string[] {
  const text = `${etf.name} ${etf.baseIndex} ${etf.classification?.strategy ?? ""}`;
  const cautions: string[] = [];

  if (etf.aum < 10_000_000_000) cautions.push("소규모");
  if (etf.isNew90d) cautions.push("상장 90일 이내");
  if (/합성/.test(text)) cautions.push("합성형");
  if (/선물/.test(text)) cautions.push("선물형");
  if (/커버드콜/.test(text)) cautions.push("커버드콜");
  if (etf.riskType === "leverage") cautions.push("레버리지");
  if (etf.riskType === "inverse") cautions.push("인버스");

  return [...new Set(cautions)];
}

export function isClassificationReviewed(etf: Etf): boolean {
  return etf.classification?.reviewStatus === "수기확정";
}

export function getClassificationStatusLabel(etf: Etf): string {
  if (isClassificationReviewed(etf)) return "공식 자료 검수 완료";
  if (etf.classification?.reviewStatus === "자동확정") return "분류 규칙 자동확정";
  return "자동 검수 대기";
}
