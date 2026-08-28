export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const targetDate = url.searchParams.get("date") || "2026-08-27";
  const formattedDate = targetDate.replace(/-/g, ".");

  let briefing = null;
  if (env.ETF_PRICES) {
    briefing = await env.ETF_PRICES.prepare(
      `SELECT * FROM market_briefings WHERE as_of_date = ? OR as_of_date <= ? ORDER BY as_of_date DESC LIMIT 1`
    ).bind(targetDate, targetDate).first();
  }

  const temp = briefing?.market_temperature || "상승 우세";
  const kospiClose = briefing?.kospi_close || 3185.42;
  const kospiChangePct = briefing?.kospi_change_pct ?? 1.07;
  const kosdaqClose = briefing?.kosdaq_close || 837.65;
  const kosdaqChangePct = briefing?.kosdaq_change_pct ?? 1.30;
  const aumJo = ((briefing?.general_total_aum || 385160700000000) / 1000000000000).toFixed(1);
  const tradeJo = ((briefing?.general_total_trade_value || 9914700000000) / 1000000000000).toFixed(1);
  const up = briefing?.up_count || 642;
  const down = briefing?.down_count || 288;

  const utmLink = `https://etf-campus.pages.dev/briefing?utm_source=threads&utm_medium=social&utm_campaign=daily_briefing_${targetDate.replace(/-/g, "")}`;

  // 1단: 강력한 Hook & 감정적 질문
  const post1 = `어제 나스닥 조정받을 때 한국 ETF 시장에서 오히려 뭉칫돈이 쏠린 곳이 있습니다. 💸

반도체는 차익실현 매물이 나왔는데, 배당주와 대표지수로 갈아타는 흐름... 단순한 일시적 피난처일까요?

📊 ${formattedDate} 시장 체온: '${temp}'
• 코스피: ${kospiClose.toLocaleString()} (+${kospiChangePct.toFixed(2)}%)
• 시장 AUM: ${aumJo}조원 돌파 (상승 ${up} vs 하락 ${down})

오늘 Smart Money가 움직인 방향을 뜯어봤습니다. 🧵👇`;

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

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Threads 타래 미리보기 - ${formattedDate}</title>
  <style>
    body { background: #0A0F1D; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px 16px; margin: 0; }
    .container { max-width: 580px; margin: 0 auto; }
    .card { background: #111827; border: 1px solid #1F2937; border-radius: 16px; padding: 22px; margin-bottom: 18px; white-space: pre-wrap; font-size: 15px; line-height: 1.65; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .badge { background: #1E293B; color: #34D399; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 9999px; display: inline-block; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="margin: 0 0 8px; color: #34D399;">🧵 Threads 바이럴 마케팅 타래 (고도화 버전)</h2>
      <div style="color: #94A3B8; font-size: 14px;">${formattedDate} 마켓 브리핑</div>
    </div>
    <div class="card"><span class="badge">POST 1/4 (EMOTIONAL HOOK)</span>\n${post1}</div>
    <div class="card"><span class="badge">POST 2/4 (SECTOR ROTATION DATA)</span>\n${post2}</div>
    <div class="card"><span class="badge">POST 3/4 (ACTIONABLE INSIGHT)</span>\n${post3}</div>
    <div class="card"><span class="badge">POST 4/4 (COMMUNITY POLL &amp; CTA)</span>\n${post4}</div>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
