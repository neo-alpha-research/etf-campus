export const STYLE_STORAGE_KEY = "etfcampus.style.v4";
export const STYLE_STORAGE_KEY_V3 = "etfcampus.style.v3";
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

export const PRESCRIPTION_QUESTIONS = [
  {
    id: "gap",
    scene: "처방 1 · 비어 있는 축",
    title: "지금 내 퇴직연금 계좌에서 가장 답답하거나 비어 있는 것은?",
    weight: 3,
    options: [
      { need: "signal", label: "무엇을 언제 살지 고르는 교체 신호가 없다", detail: "어느 ETF가 더 강한지 객관적인 신호로 비교하고 싶다" },
      { need: "map", label: "전체 자산을 얼마씩 나눌지 계좌 지도가 없다", detail: "국내·해외·안전자산의 목표 비율과 허용 밴드를 세우고 싶다" },
      { need: "income", label: "들어오는 분배금을 어떻게 다룰지 기준이 없다", detail: "높은 분배율의 함정을 거르고 지속 가능한 현금흐름을 만들고 싶다" },
    ],
  },
  {
    id: "regret",
    scene: "처방 2 · 아쉬웠던 장면",
    title: "최근 내 계좌를 돌아볼 때 가장 아쉬웠던 순간은?",
    weight: 2,
    options: [
      { need: "signal", label: "이미 많이 오른 뒤에 소식을 듣고 따라 들어갔다", detail: "진입과 교체의 명확한 규칙 없이 감정으로 움직였다" },
      { need: "map", label: "한쪽에 크게 쏠려 계좌가 흔들리는 걸 뒤늦게 알았다", detail: "계좌 전체의 자산 배분 비중을 미리 정해두지 못했다" },
      { need: "income", label: "단순히 분배율 숫자만 보고 골랐다가 원금이 깎였다", detail: "분배금의 지속 가능성과 지급 재원을 점검하지 못했다" },
    ],
  },
  {
    id: "goal",
    scene: "처방 3 · 앞으로의 12개월",
    title: "앞으로 12개월 동안 내 계좌에 가장 확실히 남기고 싶은 시스템은?",
    weight: 2,
    options: [
      { need: "signal", label: "시장 변화에 흔들리지 않는 객관적 ETF 교체 신호", detail: "강한 종목을 고르고 약해지면 정리하는 규칙 엔진" },
      { need: "map", label: "한 장의 운용 규정서로 정리된 자산 배분 지도", detail: "목표 비율, 허용 밴드, 정기 리밸런싱 점검일" },
      { need: "income", label: "월별·분기별로 예측 가능한 현금흐름 점검 루틴", detail: "배당 재원 검증, 함정 필터, 재투자 및 인출 원칙" },
    ],
  },
] as const;

export type PrescriptionQuestionId = (typeof PRESCRIPTION_QUESTIONS)[number]["id"];

export const BOOK_SLUG_BY_NEED = {
  signal: "momentum-etf-system",
  map: "index-asset-allocation",
  income: "dividend-cashflow",
} as const;

export type SeriesBookMetadata = {
  slug: string;
  seriesIndex: number;
  title: string;
  shortTitle: string;
  summary: string;
  topic: string;
  reader: string;
  status: "published" | "coming-soon";
  affiliateUrl?: string;
};

export const PRESCRIPTION_BOOK_METADATA: Record<string, SeriesBookMetadata> = {
  "momentum-etf-system": {
    slug: "momentum-etf-system",
    seriesIndex: 1,
    title: "감정을 끄고 시스템으로 ① 모멘텀",
    shortTitle: "① 모멘텀",
    summary: "강한 흐름을 읽되 신호가 없을 때는 기다리는 법을 30일에 걸쳐 정리합니다. 위험자산 안에서 후보를 비교하는 신호 엔진입니다.",
    topic: "모멘텀 판단 기준과 교체 조건",
    reader: "시장이 오르면 뒤늦게 따라가고, 흔들리면 급하게 판단하는 DC형 가입자",
    status: "published",
    affiliateUrl: "https://ctee.kr/item/store/99321",
  },
  "index-asset-allocation": {
    slug: "index-asset-allocation",
    seriesIndex: 2,
    title: "감정을 끄고 시스템으로 ② 지수·자산배분",
    shortTitle: "② 지수·자산배분",
    summary: "국내 주식·해외 주식·방어 축의 역할을 나누고, 목표 비율·허용 밴드·점검일을 한 장의 규정서에 적는 30일 DC형 퇴직연금 운용 규정서입니다.",
    topic: "목표 비율·허용 밴드·운용 규정서",
    reader: "ETF는 보지만 계좌 전체가 실제로 어떻게 나뉘어 있는지 모르는 DC형 가입자",
    status: "coming-soon",
  },
  "dividend-cashflow": {
    slug: "dividend-cashflow",
    seriesIndex: 3,
    title: "감정을 끄고 시스템으로 ③ 배당·현금흐름",
    shortTitle: "③ 배당·현금흐름",
    summary: "분배금의 재원·지급 이력·함정 필터·분기 루틴을 통해 배당을 현금흐름의 언어로 읽는 30일 DC형 퇴직연금 ETF 운용법입니다.",
    topic: "분배금 구조·현금흐름·함정 필터",
    reader: "높은 분배율과 월분배라는 말에 시선이 먼저 가는 DC형 가입자",
    status: "coming-soon",
  },
};

export type NeedId = keyof typeof BOOK_SLUG_BY_NEED;
export type NeedScores = Record<NeedId, number>;
export type PrescriptionAnswers = Record<PrescriptionQuestionId, NeedId>;

export type PrescriptionResult = {
  answers: PrescriptionAnswers;
  needScores: NeedScores;
  primaryBookSlug: string;
  order: string[];
};

export type QuestionId = (typeof DIAGNOSIS_QUESTIONS)[number]["id"];
export type DiagnosisAnswers = Record<QuestionId, ScaleAnswer>;
export type StyleId = "turtle" | "owl" | "squirrel" | "dolphin" | "elephant" | "fox" | "octopus" | "eagle" | "hedgehog" | "otter";

export type StyleProfile = {
  animal: string;
  name: string;
  emoji: string;
  imagePath: string;
  tagline: string;
  punchline: string;
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
      imagePath: "/images/animals/turtle.jpg",
    tagline: "서두르지 않고 익숙한 기준부터 확인해요",
    punchline: "숫자가 춤을 춰도 내가 정한 점검 날짜가 되기 전엔 움직이지 않습니다.",
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
      imagePath: "/images/animals/owl.jpg",
    tagline: "변화가 보이면 세부 수치를 끝까지 살펴봐요",
    punchline: "설명글보다 숫자 표를 먼저 열고, 작은 소수점 차이까지 확인해야 잠이 옵니다.",
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
      imagePath: "/images/animals/squirrel.jpg",
    tagline: "정한 날마다 필요한 숫자를 꼼꼼히 모아요",
    punchline: "매월 정한 날마다 지난달 메모와 오늘 숫자를 나란히 두고 차곡차곡 모아갑니다.",
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
      imagePath: "/images/animals/dolphin.jpg",
    tagline: "새로운 시장의 움직임을 빠르게 연결해요",
    punchline: "새로운 테마나 시장 소식이 들려오면 관련된 ETF부터 지도처럼 빠르게 펼쳐봅니다.",
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
      imagePath: "/images/animals/elephant.jpg",
    tagline: "전체 맥락을 기억하며 여러 기준을 차분히 엮어요",
    punchline: "단기 등락보다 이 자산군이 내 계좌에서 맡은 원래 역할을 먼저 떠올립니다.",
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
      imagePath: "/images/animals/fox.jpg",
    tagline: "새로운 변화 속에서 비교 기준을 빠르게 조합해요",
    punchline: "변화가 감지되면 필터와 정렬 기준을 바꿔가며 숨은 차이와 후보를 빠르게 좁힙니다.",
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
      imagePath: "/images/animals/octopus.jpg",
    tagline: "다양한 시장과 숫자를 한 번에 차분히 조율해요",
    punchline: "서로 다른 시장과 여러 지표를 한 화면에 띄워두고 종합적인 균형을 맞춥니다.",
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
      imagePath: "/images/animals/eagle.jpg",
    tagline: "큰 흐름을 보면서 중요한 변화를 놓치지 않아요",
    punchline: "개별 종목의 잔물결보다 글로벌 거시 흐름과 자산군 전체의 큰 방향을 먼저 봅니다.",
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
      imagePath: "/images/animals/hedgehog.jpg",
    tagline: "중요한 변화가 보이면 경계와 근거부터 확인해요",
    punchline: "화려한 수익률 문구보다 공시와 투자설명서의 원문 근거부터 꼼꼼히 확인합니다.",
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
      imagePath: "/images/animals/otter.jpg",
    tagline: "새로운 시장에서도 중요한 흐름을 가볍게 건져요",
    punchline: "복잡한 수치에 얽매이기보다 핵심 요약과 간결한 질문으로 중요한 맥락만 건져냅니다.",
    summary: "새로운 자산군을 넓게 탐색하면서 핵심 요약과 간결한 기준으로 정보를 정리하는 편입니다. 정기적인 탐색을 부담 없이 이어 갑니다.",
    strengths: ["낯선 정보에서도 핵심을 빠르게 찾아요", "복잡한 시장을 간결한 질문으로 바꿔요"],
    habit: "요약이 편할수록 상품 구조의 예외를 놓칠 수 있어요. 관심이 생긴 ETF는 상세 설명과 기준일을 한 번 더 확인해 보세요.",
    traits: ["핵심 요약", "새로운 범위"],
    vector: { view: -1, range: 1, timing: -1, criteria: -1, depth: -1 },
  },
};

export type CompletedDiagnosis = {
  version: 4;
  status: "completed";
  resultId: string;
  answers: DiagnosisAnswers;
  style: StyleId;
  axisScores: AxisScores;
  prescription?: PrescriptionResult;
  completedAt: string;
};
export type SkippedDiagnosis = { version: 4; status: "skipped"; skippedAt: string };
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

export function getOppositeStyle(styleId: StyleId): StyleId {
  const currentProfile = STYLE_PROFILES[styleId];
  if (!currentProfile) return "turtle";

  let maxDistance = -1;
  let opposite = styleId;

  for (const [otherId, otherProfile] of Object.entries(STYLE_PROFILES) as [StyleId, StyleProfile][]) {
    if (otherId === styleId) continue;
    const distance = AXIS_DEFINITIONS.reduce(
      (sum, axis) => sum + (currentProfile.vector[axis.id] - otherProfile.vector[axis.id]) ** 2,
      0,
    );
    if (distance > maxDistance) {
      maxDistance = distance;
      opposite = otherId;
    }
  }

  return opposite;
}

export function prescribeBooks(answers: Partial<PrescriptionAnswers>): PrescriptionResult | null {
  if (!answers.gap || !answers.regret || !answers.goal) return null;
  const fullAnswers = answers as PrescriptionAnswers;

  const needScores: NeedScores = { signal: 0, map: 0, income: 0 };
  for (const question of PRESCRIPTION_QUESTIONS) {
    const chosenNeed = fullAnswers[question.id];
    if (chosenNeed && Object.hasOwn(needScores, chosenNeed)) {
      needScores[chosenNeed] += question.weight;
    }
  }

  const needs: NeedId[] = ["signal", "map", "income"];

  // Tie-breaking:
  // 1. Need chosen in "gap" question
  // 2. Map (Book 2 priority as higher-level roadmap)
  const compareNeeds = (a: NeedId, b: NeedId) => {
    if (needScores[b] !== needScores[a]) {
      return needScores[b] - needScores[a];
    }
    if (fullAnswers.gap === a) return -1;
    if (fullAnswers.gap === b) return 1;
    if (a === "map") return -1;
    if (b === "map") return 1;
    return 0;
  };

  const sortedNeeds = [...needs].sort(compareNeeds);
  const primaryNeed = sortedNeeds[0];
  const primaryBookSlug = BOOK_SLUG_BY_NEED[primaryNeed];
  const order = sortedNeeds.map((need) => BOOK_SLUG_BY_NEED[need]);

  return {
    answers: fullAnswers,
    needScores,
    primaryBookSlug,
    order,
  };
}

export function generateClientUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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

    // v4 parse
    if (value.version === 4) {
      if (value.status === "skipped" && typeof value.skippedAt === "string") {
        return { version: 4, status: "skipped", skippedAt: value.skippedAt };
      }
      if (value.status !== "completed" || !isAnswers(value.answers) || typeof value.completedAt !== "string") {
        return null;
      }

      const style = diagnoseStyle(value.answers);
      if (value.style !== style) return null;

      let prescription: PrescriptionResult | undefined;
      if (value.prescription && typeof value.prescription === "object") {
        const p = value.prescription as Record<string, unknown>;
        if (p.answers && typeof p.answers === "object") {
          const prescribed = prescribeBooks(p.answers as Partial<PrescriptionAnswers>);
          if (prescribed) {
            prescription = prescribed;
          }
        }
      }

      return {
        version: 4,
        status: "completed",
        resultId: typeof value.resultId === "string" && value.resultId ? value.resultId : generateClientUUID(),
        answers: value.answers,
        style,
        axisScores: getAxisScores(value.answers),
        prescription,
        completedAt: value.completedAt,
      };
    }

    // v3 lossless upgrade
    if (value.version === 3) {
      if (value.status === "skipped" && typeof value.skippedAt === "string") {
        return { version: 4, status: "skipped", skippedAt: value.skippedAt };
      }
      if (value.status !== "completed" || !isAnswers(value.answers) || typeof value.completedAt !== "string") {
        return null;
      }

      const style = diagnoseStyle(value.answers);
      if (value.style !== style) return null;

      return {
        version: 4,
        status: "completed",
        resultId: generateClientUUID(),
        answers: value.answers,
        style,
        axisScores: getAxisScores(value.answers),
        prescription: undefined,
        completedAt: value.completedAt,
      };
    }

    return null;
  } catch {
    return null;
  }
}
