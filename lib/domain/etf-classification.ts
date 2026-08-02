import type { Etf } from "./etf-types";

const ASSET_LABELS: Record<string, string> = {
  "주식-국내": "주식",
  "주식-해외": "주식",
  "금리·파킹": "금리/파킹",
  "리츠·인프라": "리츠/인프라",
  "혼합·자산배분": "혼합자산",
};

export type ClassificationFields = {
  marketScope: string;
  assetClass: string;
  fxHedge: string | null;
  riskLabel: "레버리지" | "인버스" | null;
};

function fallbackMarketScope(assetClass: string): string {
  if (assetClass === "주식-국내") return "국내";
  if (assetClass === "주식-해외") return "해외";
  return "-";
}

function compactFxHedge(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, "");
  if (["미확인", "확인필요", "해당없음"].includes(normalized)) return null;
  if (normalized === "환노출" || normalized === "노출") return "노출";
  if (normalized === "환헤지" || normalized === "헤지") return "헤지";
  if (normalized.includes("부분")) return "부분";
  if (normalized.includes("탄력")) return "탄력";
  return null;
}

export function getClassificationFields(etf: Etf): ClassificationFields {
  const classification = etf.classification?.published ? etf.classification : null;
  return {
    marketScope: classification?.marketScope ?? fallbackMarketScope(etf.assetClass),
    assetClass: classification?.assetClass ?? ASSET_LABELS[etf.assetClass] ?? etf.assetClass,
    fxHedge: compactFxHedge(classification?.fxHedge),
    riskLabel: etf.riskType === "leverage" ? "레버리지" : etf.riskType === "inverse" ? "인버스" : null,
  };
}

export function getClassificationParts(etf: Etf, detailed = false): string[] {
  const classification = etf.classification?.published ? etf.classification : null;
  const fields = getClassificationFields(etf);
  const parts = [
    fields.marketScope,
    fields.assetClass,
  ];

  if (detailed && classification?.assetDetail) parts.push(classification.assetDetail);
  if (fields.fxHedge) parts.push(fields.fxHedge);
  if (fields.riskLabel) parts.push(fields.riskLabel);

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
