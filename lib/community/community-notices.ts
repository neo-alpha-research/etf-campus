export const COMMUNITY_BOARD_NOTICES = {
  "free-qna": {
    title: "자유·질문을 남기기 전에",
    body: "ETF 투자나 계좌 운용에서 궁금한 점을 편하게 질문해 주세요. 계좌 유형(연금저축/IRP/ISA/일반)과 상황을 함께 적어주시면 더욱 구체적이고 유익한 답변을 받을 수 있습니다. 특정 종목 매수·매도 유도나 리딩방 홍보는 제한됩니다.",
  },
  "strategy-portfolio": {
    title: "전략·포트폴리오를 공유하기 전에",
    body: "단순 수익률 자랑보다는 목표 자산배분 비중(%), 적립 주기, 리밸런싱 및 분배금 재투자 규칙 등 '나만의 투자 기준'을 중심으로 공유해 주세요. 서로의 장기 투자 원칙을 점검하는 데 큰 도움이 됩니다.",
  },
  "stock-cost-analysis": {
    title: "종목·비용 분석을 작성하기 전에",
    body: "특정 ETF를 다룰 때는 본문에 6자리 종목코드(예: $069500)를 입력하면 해당 종목의 상세 분석 페이지가 자동 연결됩니다. 총보수(운용보수), 기타비용, 괴리율, 분배금 구조 등 객관적 데이터와 출처를 중심으로 분석해 주세요.",
  },
  "pension-etf-qna": {
    title: "연금 ETF Q&A를 시작하기 전에",
    body: "연금계좌의 제도와 ETF 구조를 확인하는 공간입니다. 계좌 잔액·개인 소득·은퇴 계획은 쓰지 말고, 계좌 유형·확인한 공식 자료·헷갈리는 기준을 중심으로 질문해 주세요.",
  },
  "etf-questions": {
    title: "ETF 정보·질문을 남기기 전에",
    body: "기초지수·비용·분배 정책·환헤지·유동성·공시처럼 확인 가능한 기준을 다루며, 목표가·수익 보장·매수 유도는 허용하지 않습니다.",
  },
  "challenge-30": {
    title: "30일 챌린지 안내",
    body: "30일 학습 챌린지는 상단 '알림·참여' 메뉴에서 매일 학습 기록 및 인증을 진행하실 수 있습니다.",
  },
  feedback: {
    title: "오류·기능 제안 작성 안내",
    body: "재현 가능한 사실을 알려 주세요. 화면 경로, ETF 식별자 또는 표시명, 확인 시각, 기대한 결과와 실제 결과를 적으면 도움이 됩니다. 로그인 코드·이메일·개인 거래 내역은 작성하지 마세요.",
  },
} as const;

export type CommunityBoardSlug = keyof typeof COMMUNITY_BOARD_NOTICES;

export function getCommunityBoardNotice(slug: string) {
  return Object.hasOwn(COMMUNITY_BOARD_NOTICES, slug)
    ? COMMUNITY_BOARD_NOTICES[slug as CommunityBoardSlug]
    : null;
}

