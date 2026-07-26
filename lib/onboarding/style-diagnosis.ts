export const STYLE_STORAGE_KEY = "etfcampus.style.v3";
export const STYLE_CHANGE_EVENT = "etfcampus-style-change";

export const SCALE_ANSWERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type ScaleAnswer = (typeof SCALE_ANSWERS)[number];

export type AxisId = "view" | "range" | "timing" | "criteria" | "depth";
export type AxisScores = Record<AxisId, number>;

export const AXIS_DEFINITIONS: readonly {
  id: AxisId;
  name: string;
  lowLabel: string;
  highLabel: string;
}[] = [
  { id: "view", name: "정보 시야", lowLabel: "큰 그림", highLabel: "세부 비교" },
  { id: "range", name: "탐색 범위", lowLabel: "익숙한 범위", highLabel: "새로운 범위" },
  { id: "timing", name: "점검 리듬", lowLabel: "정기 점검", highLabel: "변화 대응" },
  { id: "criteria", name: "비교 방식", lowLabel: "핵심 기준", highLabel: "다각도 비교" },
  { id: "depth", name: "확인 깊이", lowLabel: "핵심 요약", highLabel: "원문·근거" },
] as const;

export const DIAGNOSIS_QUESTIONS = [
  {
    id: "marketTable",
    axis: "view",
    scene: "장면 1 · 아침 알림",
    title: "시장이 크게 움직인 날, ETF 화면을 열었다.",
    left: { emoji: "🗺️", label: "자산군 전체 흐름부터 본다", detail: "어느 시장이 함께 움직였는지 먼저 살핀다" },
    right: { emoji: "🔎", label: "종목별 숫자 차이부터 본다", detail: "수익률과 거래대금을 항목별로 비교한다" },
  },
  {
    id: "newTheme",
    axis: "range",
    scene: "장면 2 · 낯선 테마",
    title: "처음 보는 주제의 ETF가 눈에 들어왔다.",
    left: { emoji: "🏡", label: "잘 아는 자산군부터 다시 본다", detail: "익숙한 범위와 무엇이 다른지 확인한다" },
    right: { emoji: "🌏", label: "관련 시장까지 넓게 둘러본다", detail: "낯선 자산군과 연결된 시장도 탐색한다" },
  },
  {
    id: "reviewDay",
    axis: "timing",
    scene: "장면 3 · 포트폴리오 점검",
    title: "ETF 정보를 다시 확인하는 나의 리듬은?",
    left: { emoji: "📅", label: "정해 둔 날에 차분히 본다", detail: "매주 또는 매월 같은 주기로 점검한다" },
    right: { emoji: "🔔", label: "큰 변화가 있을 때 먼저 본다", detail: "시장 이슈나 가격 변화가 점검 신호가 된다" },
  },
  {
    id: "sameIndex",
    axis: "criteria",
    scene: "장면 4 · 비슷한 ETF",
    title: "같은 유형의 ETF가 여러 개라면?",
    left: { emoji: "🎯", label: "핵심 기준 몇 가지로 좁힌다", detail: "계좌 가능 여부와 규모처럼 꼭 볼 항목부터 본다" },
    right: { emoji: "🧩", label: "여러 조건을 나란히 놓는다", detail: "지수·규모·거래·수익률을 함께 비교한다" },
  },
  {
    id: "structureDepth",
    axis: "depth",
    scene: "장면 5 · 상세 화면",
    title: "처음 보는 ETF의 구조를 이해할 때 나는?",
    left: { emoji: "📝", label: "핵심 설명을 먼저 읽는다", detail: "무엇을 추종하고 어떤 위험이 있는지 요약부터 본다" },
    right: { emoji: "📄", label: "기초지수와 구조까지 확인한다", detail: "상세 설명과 기준이 되는 원문까지 살펴본다" },
  },
  {
    id: "rankingView",
    axis: "view",
    scene: "장면 6 · 수익률 순위",
    title: "기간 수익률 상위 목록을 볼 때 먼저 궁금한 것은?",
    left: { emoji: "🌊", label: "어떤 자산군이 움직였는가", detail: "순위 뒤에 있는 시장의 공통 흐름을 본다" },
    right: { emoji: "📊", label: "종목마다 얼마나 달랐는가", detail: "같은 기간의 수치 차이를 세밀하게 본다" },
  },
  {
    id: "guideRange",
    axis: "range",
    scene: "장면 7 · 가이드 선택",
    title: "한 편의 자산군 가이드를 읽는다면?",
    left: { emoji: "📚", label: "아는 분야를 더 깊게 읽는다", detail: "이미 이해한 자산군의 기준을 다듬는다" },
    right: { emoji: "🧭", label: "모르는 분야의 문을 연다", detail: "새로운 자산군의 역할부터 알아본다" },
  },
  {
    id: "briefingHabit",
    axis: "timing",
    scene: "장면 8 · 시장 브리핑",
    title: "시장 소식을 읽기 가장 편한 때는?",
    left: { emoji: "🗓️", label: "한 주를 정리하는 일정한 때", detail: "정해진 리듬으로 핵심 변화를 모아 본다" },
    right: { emoji: "⚡", label: "중요한 이슈가 생긴 바로 그때", detail: "변화가 생긴 시점에 맥락을 확인한다" },
  },
  {
    id: "pensionFilter",
    axis: "criteria",
    scene: "장면 9 · DC·IRP ETF 찾기",
    title: "연금 계좌에서 살펴볼 ETF를 좁힌다면?",
    left: { emoji: "✅", label: "연금 가능과 규모부터 고른다", detail: "핵심 조건으로 목록을 간결하게 만든다" },
    right: { emoji: "🧮", label: "가능 종목의 여러 수치를 함께 본다", detail: "자산군·규모·거래·기간 수익률을 비교한다" },
  },
  {
    id: "sourceDepth",
    axis: "depth",
    scene: "장면 10 · 마지막 확인",
    title: "시장 설명 한 문장을 더 확인하고 싶다면?",
    left: { emoji: "💡", label: "핵심 맥락을 다시 읽는다", detail: "요약된 설명 안에서 뜻과 주의점을 정리한다" },
    right: { emoji: "🔗", label: "기준일과 근거까지 찾아본다", detail: "사용한 데이터와 원문의 범위를 함께 확인한다" },
  },
] as const satisfies readonly {
  id: string;
  axis: AxisId;
  scene: string;
  title: string;
  left: { emoji: string; label: string; detail: string };
  right: { emoji: string; label: string; detail: string };
}[];

export type QuestionId = (typeof DIAGNOSIS_QUESTIONS)[number]["id"];
export type DiagnosisAnswers = Record<QuestionId, ScaleAnswer>;
export type StyleId = "turtle" | "owl" | "squirrel" | "dolphin" | "elephant" | "fox" | "octopus" | "eagle" | "hedgehog" | "otter";

export type StyleProfile = {
  animal: string;
  name: string;
  emoji: string;
  tagline: string;
  summary: string;
  strengths: readonly [string, string];
  habit: string;
  traits: readonly [string, string];
  vector: AxisScores;
};

export const STYLE_PROFILES: Record<StyleId, StyleProfile> = {
  turtle: {
    animal: "거북이",
    name: "원칙을 지키는 거북이",
    emoji: "🐢",
    tagline: "서두르지 않고 익숙한 기준부터 확인해요",
    summary: "큰 흐름과 핵심 조건을 정해진 리듬으로 살피는 편입니다. 복잡한 목록에서도 먼저 확인할 순서를 스스로 만들어 갑니다.",
    strengths: ["복잡한 화면에서도 핵심을 놓치지 않아요", "한 번 세운 확인 순서를 꾸준히 지켜요"],
    habit: "익숙한 범위만 보면 새로운 자산군의 역할을 놓칠 수 있어요. 가끔은 가이드로 시야를 넓혀 보세요.",
    traits: ["큰 그림", "정기 점검"],
    vector: { view: -1, range: -1, timing: -1, criteria: -1, depth: -1 },
  },
  owl: {
    animal: "부엉이",
    name: "숫자를 읽는 부엉이",
    emoji: "🦉",
    tagline: "변화가 보이면 세부 수치를 끝까지 살펴봐요",
    summary: "익숙한 시장 안에서도 종목별 차이를 세밀하게 비교하는 편입니다. 숫자와 조건을 나란히 놓을 때 판단 재료가 또렷해집니다.",
    strengths: ["같아 보이는 ETF의 차이를 잘 발견해요", "변화가 생기면 필요한 수치를 빠르게 찾아요"],
    habit: "세부 수치에 집중할수록 자산군 전체 흐름을 놓칠 수 있어요. 비교 전에 큰 맥락을 한 번 확인해 보세요.",
    traits: ["세부 비교", "변화 대응"],
    vector: { view: 1, range: -1, timing: 1, criteria: 1, depth: 1 },
  },
  squirrel: {
    animal: "다람쥐",
    name: "차곡차곡 살피는 다람쥐",
    emoji: "🐿️",
    tagline: "정한 날마다 필요한 숫자를 꼼꼼히 모아요",
    summary: "익숙한 자산군을 중심으로 여러 기준을 꾸준히 점검하는 편입니다. 비교한 내용을 차곡차곡 쌓을수록 탐색이 편해집니다.",
    strengths: ["정기 점검을 생활 리듬으로 만들기 쉬워요", "조건별 차이를 기록하고 다시 확인해요"],
    habit: "점검 항목이 너무 많아지면 중요한 변화가 묻힐 수 있어요. 이번 점검의 핵심 질문을 먼저 정해 보세요.",
    traits: ["세부 비교", "정기 점검"],
    vector: { view: 1, range: -1, timing: -1, criteria: 1, depth: 1 },
  },
  dolphin: {
    animal: "돌고래",
    name: "흐름을 타는 돌고래",
    emoji: "🐬",
    tagline: "새로운 시장의 움직임을 빠르게 연결해요",
    summary: "새로운 자산군을 넓게 둘러보고 시장 변화의 공통 흐름을 찾는 편입니다. 핵심 기준이 간결할수록 탐색이 가벼워집니다.",
    strengths: ["낯선 시장도 부담 없이 살펴봐요", "여러 시장의 움직임을 빠르게 연결해요"],
    habit: "넓게 보는 동안 상품 구조의 세부 조건을 지나칠 수 있어요. 관심 항목은 상세 화면에서 다시 확인해 보세요.",
    traits: ["새로운 범위", "변화 대응"],
    vector: { view: -1, range: 1, timing: 1, criteria: -1, depth: -1 },
  },
  elephant: {
    animal: "코끼리",
    name: "큰 그림을 기억하는 코끼리",
    emoji: "🐘",
    tagline: "전체 맥락을 기억하며 여러 기준을 차분히 엮어요",
    summary: "익숙한 자산군의 역할을 중심에 두고 여러 조건을 정기적으로 확인하는 편입니다. 이전 점검과 달라진 점을 비교할 때 강점이 드러납니다.",
    strengths: ["자산군의 역할과 과거 맥락을 잘 기억해요", "하나의 수치보다 여러 조건을 함께 봐요"],
    habit: "익숙한 설명이 지금도 유효한지는 별도 확인이 필요해요. 모든 수치의 기준일을 함께 살펴보세요.",
    traits: ["큰 그림", "다각도 비교"],
    vector: { view: -1, range: -1, timing: -1, criteria: 1, depth: 1 },
  },
  fox: {
    animal: "여우",
    name: "조건을 엮는 여우",
    emoji: "🦊",
    tagline: "새로운 변화 속에서 비교 기준을 빠르게 조합해요",
    summary: "넓은 시장을 탐색하면서 종목별 수치와 여러 조건을 함께 보는 편입니다. 필터와 정렬을 바꾸며 차이를 찾는 과정에 익숙합니다.",
    strengths: ["새로운 정보에서 비교할 조건을 빨리 찾아요", "여러 필터를 조합해 목록을 구조화해요"],
    habit: "조건을 많이 바꾸면 처음 세운 질문이 흐려질 수 있어요. 비교 목적과 기준 기간을 먼저 고정해 보세요.",
    traits: ["새로운 범위", "다각도 비교"],
    vector: { view: 1, range: 1, timing: 1, criteria: 1, depth: 1 },
  },
  octopus: {
    animal: "문어",
    name: "여러 기준을 다루는 문어",
    emoji: "🐙",
    tagline: "다양한 시장과 숫자를 한 번에 차분히 조율해요",
    summary: "새로운 자산군을 넓게 탐색하면서도 정한 리듬 안에서 여러 비교 기준을 다루는 편입니다. 복잡한 정보를 자기 방식으로 정리합니다.",
    strengths: ["여러 조건을 동시에 놓고 관계를 살펴봐요", "새로운 분야도 정기 점검 체계에 담아내요"],
    habit: "확인할 기준이 늘어날수록 결론보다 과정이 길어질 수 있어요. 가장 중요한 기준부터 순서를 붙여 보세요.",
    traits: ["새로운 범위", "정기 점검"],
    vector: { view: 1, range: 1, timing: -1, criteria: 1, depth: 1 },
  },
  eagle: {
    animal: "독수리",
    name: "시장을 넓게 보는 독수리",
    emoji: "🦅",
    tagline: "큰 흐름을 보면서 중요한 변화를 놓치지 않아요",
    summary: "새로운 시장을 넓은 시야로 살피고 변화가 있을 때 여러 조건을 확인하는 편입니다. 먼저 지도를 보고 필요한 곳에 집중합니다.",
    strengths: ["여러 자산군의 큰 흐름을 한눈에 봐요", "시장 변화와 세부 조건을 연결해요"],
    habit: "큰 흐름이 비슷해 보여도 ETF마다 구조와 위험은 다를 수 있어요. 최종 확인은 종목 상세에서 해보세요.",
    traits: ["큰 그림", "새로운 범위"],
    vector: { view: -1, range: 1, timing: 1, criteria: 1, depth: 1 },
  },
  hedgehog: {
    animal: "고슴도치",
    name: "근거를 확인하는 고슴도치",
    emoji: "🦔",
    tagline: "중요한 변화가 보이면 경계와 근거부터 확인해요",
    summary: "익숙한 시장 안에서 핵심 기준을 빠르게 좁히고, 필요한 원문과 근거를 깊이 확인하는 편입니다. 무엇을 더 확인해야 하는지 경계를 잘 세웁니다.",
    strengths: ["핵심 조건과 추가 확인 항목을 구분해요", "변화가 생겼을 때 근거를 놓치지 않아요"],
    habit: "확인해야 할 위험에 집중하다 보면 전체 자산군의 역할이 작게 보일 수 있어요. 상세 확인 전후로 큰 흐름도 함께 살펴보세요.",
    traits: ["원문·근거", "변화 대응"],
    vector: { view: 1, range: -1, timing: 1, criteria: -1, depth: 1 },
  },
  otter: {
    animal: "수달",
    name: "핵심을 건지는 수달",
    emoji: "🦦",
    tagline: "새로운 시장에서도 중요한 흐름을 가볍게 건져요",
    summary: "새로운 자산군을 넓게 탐색하면서 핵심 요약과 간결한 기준으로 정보를 정리하는 편입니다. 정기적인 탐색을 부담 없이 이어 갑니다.",
    strengths: ["낯선 정보에서도 핵심을 빠르게 찾아요", "복잡한 시장을 간결한 질문으로 바꿔요"],
    habit: "요약이 편할수록 상품 구조의 예외를 놓칠 수 있어요. 관심이 생긴 ETF는 상세 설명과 기준일을 한 번 더 확인해 보세요.",
    traits: ["핵심 요약", "새로운 범위"],
    vector: { view: -1, range: 1, timing: -1, criteria: -1, depth: -1 },
  },
};

export type CompletedDiagnosis = {
  version: 3;
  status: "completed";
  answers: DiagnosisAnswers;
  style: StyleId;
  axisScores: AxisScores;
  completedAt: string;
};
export type SkippedDiagnosis = { version: 3; status: "skipped"; skippedAt: string };
export type StoredDiagnosis = CompletedDiagnosis | SkippedDiagnosis;

export function getAxisScores(answers: DiagnosisAnswers): AxisScores {
  return Object.fromEntries(
    AXIS_DEFINITIONS.map((axis) => {
      const axisQuestions = DIAGNOSIS_QUESTIONS.filter((question) => question.axis === axis.id);
      const total = axisQuestions.reduce((sum, question) => {
        const normalized = ((answers[question.id] - 1) / 9) * 2 - 1;
        return sum + normalized;
      }, 0);
      return [axis.id, Math.round((total / axisQuestions.length) * 10_000) / 10_000];
    }),
  ) as AxisScores;
}

export function diagnoseStyle(answers: DiagnosisAnswers): StyleId {
  const scores = getAxisScores(answers);
  let nearest = Object.keys(STYLE_PROFILES)[0] as StyleId;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [style, profile] of Object.entries(STYLE_PROFILES) as [StyleId, StyleProfile][]) {
    const distance = AXIS_DEFINITIONS.reduce(
      (sum, axis) => sum + (scores[axis.id] - profile.vector[axis.id]) ** 2,
      0,
    );
    if (distance < nearestDistance) {
      nearest = style;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function isScaleAnswer(value: unknown): value is ScaleAnswer {
  return SCALE_ANSWERS.includes(value as ScaleAnswer);
}

function isAnswers(value: unknown): value is DiagnosisAnswers {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return DIAGNOSIS_QUESTIONS.every((question) => isScaleAnswer(item[question.id]));
}

export function parseStoredDiagnosis(raw: string | null): StoredDiagnosis | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.version !== 3) return null;
    if (value.status === "skipped" && typeof value.skippedAt === "string") {
      return { version: 3, status: "skipped", skippedAt: value.skippedAt };
    }
    if (value.status !== "completed" || !isAnswers(value.answers) || typeof value.completedAt !== "string") {
      return null;
    }

    const style = diagnoseStyle(value.answers);
    if (value.style !== style) return null;
    return {
      version: 3,
      status: "completed",
      answers: value.answers,
      style,
      axisScores: getAxisScores(value.answers),
      completedAt: value.completedAt,
    };
  } catch {
    return null;
  }
}
