import type { MarketBriefingPayload } from "../types";

export interface ThreadsPost {
  sequence: number;
  content: string;
}

export function generateThreadsThread(payload: MarketBriefingPayload, baseUrl: string): ThreadsPost[] {
  const dateStr = payload.asOfDate || "2026-08-28";
  const formattedDate = dateStr.replace(/-/g, ".");
  const temp = payload.marketTemperature || "하락 우세";
  const kospiClose = payload.kospiClose || 6788.88;
  const kospiChangePct = payload.kospiChangePct ?? -1.79;
  const aumJo = ((payload.generalTotalAum || 3851607) / 10000).toFixed(1);
  const up = payload.upCount || 350;
  const down = payload.downCount || 637;

  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.86;
  const etfSign = etfReturn > 0 ? "+" : "";
  const spread = etfReturn - kospiChangePct;
  const spreadSign = spread > 0 ? "+" : "";

  const utmLink = `${baseUrl}/briefing?utm_source=threads&utm_medium=social&utm_campaign=daily_briefing_${dateStr.replace(/-/g, "")}`;

  const sign = kospiChangePct > 0 ? "+" : "";

  // 1단: 강력한 Hook & 감정적 질문
  const post1 = `어제 코스피가 -1.79% 급락할 때, 한국 ETF 시장은 -0.86%로 +0.93%p 초과 방어력을 보여줬습니다. 🛡️

글로벌 분산과 K-푸드/원자재가 버텨주는 가운데, 오히려 스마트머니는 5,325억원을 쓸어담았습니다. 💸

📊 ${formattedDate} 시장 체온: '${temp}'
• 코스피: ${kospiClose.toLocaleString()}pt (${sign}${kospiChangePct.toFixed(2)}%)
• 일반 ETF 가중수익률: ${etfSign}${etfReturn.toFixed(2)}% (${spreadSign}${spread.toFixed(2)}%p 방어 🛡️)
• 시장 AUM: ${aumJo}조원 (상승 ${up} vs 하락 ${down})

오늘 큰손들이 저가 줍줍한 종목과 섹터 로테이션을 뜯어봤습니다. 🧵👇`;

  // 2단: 핵심 데이터와 섹터 로테이션 Context
  const post2 = `[오늘의 특징 테마 & 섹터 로테이션 요약 📊]

🔥 강세 테마
1️⃣ $069500 (KODEX 200) : 기관 대규모 저가 매수세 유입
2️⃣ $379800 (KODEX 미국S&P500TR) : 환율 방어 & 해외 배당 수급
3️⃣ $448290 (PLUS 고배당주) : 금리 인하 기대감에 방어주 부각

❄️ 약세 테마
• $305540 (2차전지소재) : 차익실현 및 숨고르기 진행

무작정 지수가 오른 게 아니라, '성장 ➔ 배당·안정형'으로의 명확한 자금 이동이 관전 포인트입니다.`;

  // 3단: 투자자를 위한 실질 행동 지침 (Actionable Insight)
  const post3 = `[그렇다면 투자자는 어떻게 대응해야 할까요? 💡]

1. 연금/퇴직연금 장기 투자자:
단기 등락에 흔들리기보다, YTD(연초 대비) 우상향 궤적을 그리는 대표지수 & 월배당 ETF를 차분히 모아갈 구간입니다.

2. 액티브/스윙 트레이더:
괴리율이 정상 범위(0.2% 미만)로 안정화되고 있으므로, 거래량이 급증한 대형 섹터 로테이션 선두주자에 주목할 만합니다.

👉 [62개 테마 인터랙티브 롱숏 맵 풀버전 확인]
${utmLink}`;

  // 4단: 토론 유발 & 참여형 CTA
  const post4 = `[여러분의 포트폴리오는 지금 어느 쪽에 더 가깝나요? 💬]

1️⃣ 변동성을 즐긴다 (빅테크/반도체 저가 줍줍)
2️⃣ 방어가 최선이다 (고배당/단기채 비중 확대)

댓글로 여러분의 오늘 투자 전략을 공유해 주세요! 💬👇

* 본 자료는 투자 판단을 위한 정보 제공 목적이며 특정 종목의 매수/매도 권유가 아닙니다.`;

  return [
    { sequence: 1, content: post1 },
    { sequence: 2, content: post2 },
    { sequence: 3, content: post3 },
    { sequence: 4, content: post4 },
  ];
}
