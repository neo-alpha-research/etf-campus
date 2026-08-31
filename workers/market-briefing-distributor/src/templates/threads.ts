import type { MarketBriefingPayload } from "../types";

export interface ThreadsPost {
  sequence: number;
  content: string;
}

export function generateThreadsThread(payload: MarketBriefingPayload, baseUrl: string): ThreadsPost[] {
  const dateStr = payload.asOfDate || "2026-08-28";
  const kospiChangePct = payload.kospiChangePct ?? -1.79;
  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.86;
  const etfSign = etfReturn > 0 ? "+" : "";
  const sign = kospiChangePct > 0 ? "+" : "";
  const strongThemes = payload.peerGroups?.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 2) || [];
  const strongThemeText = strongThemes.length > 0 
    ? strongThemes.map(t => `${t.peerGroup}(+${t.cappedAumWeightedReturnPct.toFixed(2)}%)`).join(', ') 
    : "필수소비재, 배당 등 방어형 자산";
  const topInflow = payload.periodicFlows?.dailyFundFlows?.topInflows?.[0];
  const topInflowName = topInflow?.name || "KODEX 200";
  const topInflowAmount = topInflow?.inflow ? topInflow.inflow.toLocaleString() : "5,325";

  const mainPost = `출근길 ETF 모닝 브리핑

지난 장 코스피가 ${sign}${kospiChangePct.toFixed(2)}% 출렁였지만, 한국 ETF 시장 평균은 ${etfSign}${etfReturn.toFixed(2)}%로 든든한 방어력을 보여줬습니다.
하락장 속에서도 ${strongThemeText} 테마는 환하게 웃었네요.

외국인과 기관은 ${topInflowName} 등을 ${topInflowAmount}억원 담으며, 고변동성 종목에서 필수소비재와 고배당 등 방어형 자산으로의 뚜렷한 자금 이동을 보여줬습니다.

Q. 장 시작 전, 여러분의 오늘 포지션은?
1. "조정은 바겐세일!" (우량 ETF 분할 매수)
2. "방패를 들 시간!" (안전자산 및 배당 확대)
3. "일단 팝콘각!" (현금 쥐고 관망)

든든한 하루 보내세요!`;

  const replyPost = `내 계좌 속 ETF는 지난 장에서 어디쯤 있었을까요?

외국인이 쓸어 담은 종목부터 주도 테마 상세 분석까지,
프로필 링크에서 바로 확인해 보세요!`;

  return [
    { sequence: 1, content: mainPost },
    { sequence: 2, content: replyPost }
  ];
}

export function generateThreadsImageSvg(payload: MarketBriefingPayload): string {
  const dateStr = payload.asOfDate || "2026.08.28";
  const formattedDate = dateStr.replace(/-/g, '.');
  
  const winners = payload.peerGroups?.filter(p => p.cappedAumWeightedReturnPct > 0)
    .sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct).slice(0, 3) || [];
  const losers = payload.peerGroups?.filter(p => p.cappedAumWeightedReturnPct < 0)
    .sort((a, b) => a.cappedAumWeightedReturnPct - b.cappedAumWeightedReturnPct).slice(0, 3) || [];

  const formatNum = (n: number) => (n > 0 ? "+" : "") + n.toFixed(2) + "%";

  let winnersSvg = "";
  if (winners.length > 0) {
    const w1 = winners[0];
    winnersSvg += `
      <rect x="60" y="225" width="600" height="505" rx="24" fill="#EF4444" opacity="0.95" />
      <text x="360" y="465" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="44" font-weight="800" text-anchor="middle">${w1.peerGroup}</text>
      <text x="360" y="540" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="76" font-weight="900" text-anchor="middle">${formatNum(w1.cappedAumWeightedReturnPct)}</text>
    `;
  }
  if (winners.length > 1) {
    const w2 = winners[1];
    winnersSvg += `
      <rect x="680" y="225" width="340" height="242" rx="20" fill="#EF4444" opacity="0.8" />
      <text x="850" y="335" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="32" font-weight="800" text-anchor="middle">${w2.peerGroup}</text>
      <text x="850" y="390" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="46" font-weight="900" text-anchor="middle">${formatNum(w2.cappedAumWeightedReturnPct)}</text>
    `;
  }
  if (winners.length > 2) {
    const w3 = winners[2];
    winnersSvg += `
      <rect x="680" y="487" width="340" height="243" rx="20" fill="#EF4444" opacity="0.65" />
      <text x="850" y="597" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="30" font-weight="800" text-anchor="middle">${w3.peerGroup}</text>
      <text x="850" y="652" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="40" font-weight="900" text-anchor="middle">${formatNum(w3.cappedAumWeightedReturnPct)}</text>
    `;
  }

  let losersSvg = "";
  if (losers.length > 0) {
    const l1 = losers[0];
    losersSvg += `
      <rect x="60" y="745" width="600" height="505" rx="24" fill="#3B82F6" opacity="0.95" />
      <text x="360" y="985" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="44" font-weight="800" text-anchor="middle">${l1.peerGroup}</text>
      <text x="360" y="1060" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="76" font-weight="900" text-anchor="middle">${formatNum(l1.cappedAumWeightedReturnPct)}</text>
    `;
  }
  if (losers.length > 1) {
    const l2 = losers[1];
    losersSvg += `
      <rect x="680" y="745" width="340" height="242" rx="20" fill="#3B82F6" opacity="0.8" />
      <text x="850" y="855" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="32" font-weight="800" text-anchor="middle">${l2.peerGroup}</text>
      <text x="850" y="910" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="46" font-weight="900" text-anchor="middle">${formatNum(l2.cappedAumWeightedReturnPct)}</text>
    `;
  }
  if (losers.length > 2) {
    const l3 = losers[2];
    losersSvg += `
      <rect x="680" y="1007" width="340" height="243" rx="20" fill="#3B82F6" opacity="0.65" />
      <text x="850" y="1117" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="30" font-weight="800" text-anchor="middle">${l3.peerGroup}</text>
      <text x="850" y="1172" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-size="40" font-weight="900" text-anchor="middle">${formatNum(l3.cappedAumWeightedReturnPct)}</text>
    `;
  }

  return `<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="#0F172A" />
    <rect x="60" y="75" width="240" height="42" rx="10" fill="#1E293B" stroke="#334155" stroke-width="1.5" />
    <text x="180" y="103" fill="#38BDF8" font-family="'Pretendard', sans-serif" font-size="20" font-weight="800" text-anchor="middle">기준일 : ${formattedDate} 종가</text>
    <text x="60" y="178" fill="#F8FAFC" font-family="'Pretendard', sans-serif" font-size="54" font-weight="900">상승/하락 주도 테마 히트맵</text>
    ${winnersSvg}
    ${losersSvg}
    <rect x="60" y="1265" width="960" height="54" rx="27" fill="#1E293B" stroke="#475569" stroke-width="1.5" />
    <text x="540" y="1300" fill="#F8FAFC" font-family="'Pretendard', sans-serif" font-size="23" font-weight="700" text-anchor="middle">전체 시장 브리핑 리포트는 프로필 링크 확인  ·  etf-campus.pages.dev</text>
  </svg>`;
}
