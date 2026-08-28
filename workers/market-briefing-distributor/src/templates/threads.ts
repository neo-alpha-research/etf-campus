import type { MarketBriefingPayload } from "../types";

export interface ThreadsPost {
  sequence: number;
  content: string;
}

export function generateThreadsThread(payload: MarketBriefingPayload, baseUrl: string): ThreadsPost[] {
  const dateStr = payload.asOfDate || "2026-08-27";
  const formattedDate = dateStr.replace(/-/g, ".");
  const temp = payload.marketTemperature || "혼조";
  const kospiChange = payload.kospiChangePct ?? 0;
  const kospiSign = kospiChange > 0 ? "+" : "";
  const kosdaqChange = payload.kosdaqChangePct ?? 0;
  const kosdaqSign = kosdaqChange > 0 ? "+" : "";

  const aumJo = ((payload.generalTotalAum || 3851607) / 10000).toFixed(1);
  const tradeJo = ((payload.generalTotalTradeValue || 99147) / 10000).toFixed(1);

  const up = payload.upCount || 0;
  const down = payload.downCount || 0;

  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 3) || [];
  const peerGroups = payload.peerGroups || [];
  const sortedPeers = [...peerGroups].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
  const bestPeers = sortedPeers.slice(0, 3);
  const worstPeers = sortedPeers.slice(-2).reverse();

  const utmLink = `${baseUrl}/briefing?utm_source=threads&utm_medium=social&utm_campaign=daily_briefing_${dateStr.replace(/-/g, "")}`;

  // Post 1: Hook & Narrative
  const post1 = `[${formattedDate} 마켓 브리핑 🧵 (1/4)]

오늘 대한민국 ETF 시장 체온은 '${temp}'입니다.

📊 코스피: ${(payload.kospiClose || 0).toLocaleString()} (${kospiSign}${kospiChange.toFixed(2)}%)
📊 코스닥: ${(payload.kosdaqClose || 0).toLocaleString()} (${kosdaqSign}${kosdaqChange.toFixed(2)}%)
💰 시장 AUM: ${aumJo}조원 | 거래대금: ${tradeJo}조원
📈 등락 비율: ${up}종목 상승 vs ${down}종목 하락

"${payload.headlineText || '대형 지수형 ETF의 안정적 방어 속 기관의 실질 진성수급 유입이 두드러졌습니다.'}"

오늘 스마트머니가 베팅한 곳은 어디였을까요? 타래로 이어집니다 👇`;

  // Post 2: Theme Battle
  const post2 = `[오늘의 롱숏 테마 배틀 🔥 (2/4)]

🔥 최고 상승 테마 TOP 3
${bestPeers.map((p, i) => `${i + 1}. ${p.peerGroup} (+${p.cappedAumWeightedReturnPct.toFixed(2)}%)`).join("\n")}

❄️ 최다 하락 테마
${worstPeers.map((p, i) => `• ${p.peerGroup} (${p.cappedAumWeightedReturnPct.toFixed(2)}%)`).join("\n")}

전체 62개 피어그룹 간 수익률 양극화가 뚜렷했습니다. 단기 지수 등락보다 테마별 수급 분화에 주목할 시점입니다.`;

  // Post 3: Smart Money Flow
  const post3 = `[스마트머니 순유입 TOP 3 💰 (3/4)]

오늘 실질 자금(순유입)이 가장 많이 몰린 ETF:
${topInflows.map((item, i) => `${i + 1}. ${item.name} (${item.ticker}) : +${((item.inflow || item.inflowAmount || 0)).toLocaleString()}억원`).join("\n")}

💡 단순 거래대금 쏠림이 아닌, 신규 설정액 기준의 '진성수급' 유입 상위 종목들입니다.`;

  // Post 4: CTA & Disclaimer
  const post4 = `[풀버전 인터랙티브 맵 보기 🌐 (4/4)]

✓ 62개 테마 인터랙티브 롱숏 맵
✓ 5개 시점(일/주/월/연) AUM 브릿지 주가/수급 분해
✓ 1,164개 전 종목 괴리율 & 거래대금 랭킹

👉 지금 웹에서 확인하기:
${utmLink}

* 본 자료는 정보 제공 목적이며 특정 금융투자상품의 매수·매도를 권유하지 않습니다. (투자 책임은 본인에게 있습니다)`;

  return [
    { sequence: 1, content: post1 },
    { sequence: 2, content: post2 },
    { sequence: 3, content: post3 },
    { sequence: 4, content: post4 },
  ];
}
