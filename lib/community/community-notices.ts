export const COMMUNITY_BOARD_NOTICES = {
  "pension-etf-qna": {
    title: "연금 ETF Q&A를 시작하기 전에",
    body: "연금계좌의 제도와 ETF 구조를 확인하는 공간입니다. 계좌 잔액·개인 소득·은퇴 계획은 쓰지 말고, 계좌 유형·확인한 공식 자료·헷갈리는 기준을 중심으로 질문해 주세요. 개인별 매수 결정을 요청하는 글은 답변 범위를 벗어납니다.",
  },
  "etf-questions": {
    title: "ETF 정보·질문을 남기기 전에",
    body: "상품명이나 티커를 언급할 때는 무엇을 확인하려는지와 데이터 기준일을 함께 적어 주세요. 기초지수·비용·분배 정책·환헤지·유동성·공시처럼 확인 가능한 기준을 다루며, 목표가·수익 보장·매수 유도는 허용하지 않습니다.",
  },
  "challenge-30": {
    title: "30일 챌린지를 기록하는 방법",
    body: "이곳은 투자 성과가 아니라 학습 습관을 기록하는 공간입니다. 오늘 읽은 공시·가이드, 이해한 용어, 다음에 확인할 질문을 남겨 주세요. 수익률·매수 인증·보유 금액·순위 비교는 게시하지 않습니다.",
  },
  feedback: {
    title: "오류·기능 제안 작성 안내",
    body: "재현 가능한 사실을 알려 주세요. 화면 경로, ETF 식별자 또는 표시명, 확인 시각, 기대한 결과와 실제 결과를 적으면 도움이 됩니다. 로그인 코드·이메일·계좌 화면·개인 거래 내역은 작성하지 마세요.",
  },
} as const;

export type CommunityBoardSlug = keyof typeof COMMUNITY_BOARD_NOTICES;

export function getCommunityBoardNotice(slug: string) {
  return Object.hasOwn(COMMUNITY_BOARD_NOTICES, slug)
    ? COMMUNITY_BOARD_NOTICES[slug as CommunityBoardSlug]
    : null;
}
