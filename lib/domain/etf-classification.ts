import type { Etf, MarketScope, Strategy, FxHedge } from "./etf-types";
import { MARKET_SCOPES } from "./etf-types";

const ASSET_LABELS: Record<string, string> = {
  "주식-국내": "주식",
  "주식-해외": "주식",
  "금리·파킹": "금리/파킹",
  "리츠·인프라": "리츠/인프라",
  "혼합·자산배분": "혼합",
};

export type ClassificationFields = {
  marketScope: string | null;
  assetClass: string;
  fxHedge: string | null;
  riskLabel: "레버리지" | "인버스" | null;
};

function fallbackMarketScope(assetClass: string): string {
  if (assetClass === "주식-국내") return "국내";
  if (assetClass === "주식-해외") return "해외";
  return "-";
}

function compactMarketScope(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (["해당없음", "미확인", "확인필요", "-"].includes(normalized.replace(/\s+/g, ""))) return null;
  return normalized;
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

function compactAssetClass(value: string): string {
  if (value === "혼합자산" || value === "혼합·자산배분") return "혼합";
  return value;
}

export function getClassificationFields(etf: Etf): ClassificationFields {
  const classification = etf.classification?.published ? etf.classification : null;
  return {
    marketScope: compactMarketScope(classification?.marketScope ?? fallbackMarketScope(etf.assetClass)),
    assetClass: compactAssetClass(classification?.assetClass ?? ASSET_LABELS[etf.assetClass] ?? etf.assetClass),
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

/** 해외 상품에만 환율 영향 안내를 표시하기 위한 조건부 문구입니다. */
export function getFxImpactNotice(etf: Etf): string | null {
  const fields = getClassificationFields(etf);
  if (fields.marketScope !== "해외" || !fields.fxHedge) return null;
  if (fields.fxHedge === "헤지") return null;
  if (fields.fxHedge === "부분" || fields.fxHedge === "탄력") {
    return "부분 헤지 상품으로 환율 영향이 일부 발생할 수 있습니다.";
  }
  if (fields.fxHedge === "노출") {
    return "환헤지가 없어 환율 변동의 영향을 받을 수 있습니다.";
  }
  return null;
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

export function getEtfMarketScope(etf: Etf): MarketScope | null {
  if (!etf.classification?.published || !etf.classification.marketScope) return null;
  const compact = compactMarketScope(etf.classification.marketScope);
  if (!compact) return null;
  if ((MARKET_SCOPES as readonly string[]).includes(compact)) {
    return compact as MarketScope;
  }
  return null;
}

export function getEtfStrategies(etf: Etf): Strategy[] {
  const strategyStr = etf.classification?.strategy;
  if (!strategyStr) return [];
  const parts = strategyStr.split("·");
  const result: Strategy[] = [];
  if (parts.some(p => p.trim() === "액티브")) result.push("액티브");
  if (parts.some(p => p.trim() === "커버드콜")) result.push("커버드콜");
  return result;
}

export function getEtfFxHedge(etf: Etf): FxHedge | null {
  const compact = compactFxHedge(etf.classification?.fxHedge);
  if (compact === "노출") return "비헤지";
  if (compact === "헤지") return "헤지";
  if (compact === "부분") return "부분 헤지";
  if (compact === "탄력") return "탄력 헤지";
  return null;
}
