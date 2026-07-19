export const STYLE_STORAGE_KEY = "etfcampus.style.v1";
export const STYLE_CHANGE_EVENT = "etfcampus-style-change";

export type AccountAnswer = "pension" | "general" | "both";
export type MarketMoveAnswer = "volatility" | "balance" | "context" | "data" | "rule";
export type PreferenceAnswer = "stability" | "allocation" | "breadth" | "criteria";
export type ExperienceAnswer = "basic" | "key-points" | "compare" | "advanced";
export type CampusRoomAnswer = "foundation" | "studio" | "exploration" | "lab";
export type StyleId = "fortress" | "compass" | "explorer" | "architect";

export type DiagnosisAnswers = {
  account: AccountAnswer;
  marketMove: MarketMoveAnswer;
  preference: PreferenceAnswer;
  experience: ExperienceAnswer;
  campusRoom: CampusRoomAnswer;
};

export type CompletedDiagnosis = { version: 1; status: "completed"; answers: DiagnosisAnswers; style: StyleId; completedAt: string };
export type SkippedDiagnosis = { version: 1; status: "skipped"; skippedAt: string };
export type StoredDiagnosis = CompletedDiagnosis | SkippedDiagnosis;

export const STYLE_PROFILES: Record<StyleId, { name: string; summary: string; habit: string }> = {
  fortress: { name: "천천히 쌓는 성벽형", summary: "안정성 설명과 일관된 원칙을 먼저 확인하는 편입니다.", habit: "숫자가 안정적으로 보여도 위험이 없는 것은 아닙니다." },
  compass: { name: "균형을 그리는 나침반형", summary: "한 종목보다 자산군의 역할과 균형을 먼저 살펴보는 편입니다.", habit: "자산군 비율 예시는 정답이 아니라 이해를 위한 사례입니다." },
  explorer: { name: "넓게 읽는 탐험가형", summary: "국내외 시장과 여러 자산군을 폭넓게 탐색하는 편입니다.", habit: "새롭고 흥미로운 자산을 보았다고 충분히 이해한 것은 아닙니다." },
  architect: { name: "숫자로 확인하는 설계자형", summary: "수익률·순자산·거래대금처럼 명확한 기준을 선호합니다.", habit: "숫자가 많아도 미래 결과를 예측할 수 있는 것은 아닙니다." },
};

const marketStyle: Record<MarketMoveAnswer, StyleId> = { volatility: "fortress", balance: "compass", context: "explorer", data: "architect", rule: "fortress" };
const preferenceStyle: Record<PreferenceAnswer, StyleId> = { stability: "fortress", allocation: "compass", breadth: "explorer", criteria: "architect" };
const roomStyle: Record<CampusRoomAnswer, StyleId> = { foundation: "fortress", studio: "compass", exploration: "explorer", lab: "architect" };

export function diagnoseStyle(answers: DiagnosisAnswers): StyleId {
  const scores: Record<StyleId, number> = { fortress: 0, compass: 0, explorer: 0, architect: 0 };
  scores[marketStyle[answers.marketMove]] += 1;
  scores[preferenceStyle[answers.preference]] += 1;
  const tieBreaker = roomStyle[answers.campusRoom];
  scores[tieBreaker] += 2;
  const highest = Math.max(...Object.values(scores));
  if (scores[tieBreaker] === highest) return tieBreaker;
  return (Object.keys(scores) as StyleId[]).find((style) => scores[style] === highest)!;
}

function isAnswers(value: unknown): value is DiagnosisAnswers {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["pension", "general", "both"].includes(String(item.account))
    && ["volatility", "balance", "context", "data", "rule"].includes(String(item.marketMove))
    && ["stability", "allocation", "breadth", "criteria"].includes(String(item.preference))
    && ["basic", "key-points", "compare", "advanced"].includes(String(item.experience))
    && ["foundation", "studio", "exploration", "lab"].includes(String(item.campusRoom));
}

export function parseStoredDiagnosis(raw: string | null): StoredDiagnosis | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.version !== 1) return null;
    if (value.status === "skipped" && typeof value.skippedAt === "string") return value as SkippedDiagnosis;
    if (value.status === "completed" && isAnswers(value.answers) && Object.hasOwn(STYLE_PROFILES, String(value.style)) && typeof value.completedAt === "string") return value as CompletedDiagnosis;
    return null;
  } catch { return null; }
}
