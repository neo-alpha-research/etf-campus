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

  const post1 = `[${formattedDate} 마켓 브리핑 🧵 (1/4)]

오늘 대한민국 ETF 시장 체온은 '${temp}'입니다.

📊 코스피: ${kospiClose.toLocaleString()} (+${kospiChangePct.toFixed(2)}%)
📊 코스닥: ${kosdaqClose.toLocaleString()} (+${kosdaqChangePct.toFixed(2)}%)
💰 시장 AUM: ${aumJo}조원 | 거래대금: ${tradeJo}조원
📈 등락 비율: ${up}종목 상승 vs ${down}종목 하락

"${briefing?.headline_text || '대형 지수형 ETF의 안정적 방어 속 기관의 실질 진성수급 유입이 두드러졌습니다.'}"

오늘 스마트머니가 베팅한 곳은 어디였을까요? 타래로 이어집니다 👇`;

  const post2 = `[오늘의 롱숏 테마 배틀 🔥 (2/4)]

🔥 최고 상승 테마 TOP 3
1. 반도체 및 소부장 (+3.42%)
2. 미국 빅테크 Top10 (+2.85%)
3. 조선·방산 (+2.15%)

❄️ 최다 하락 테마
• 2차전지 소재 (-2.85%)
• 중국 전기차·태양광 (-1.95%)

전체 62개 피어그룹 간 수익률 양극화가 뚜렷했습니다. 단기 지수 등락보다 테마별 수급 분화에 주목할 시점입니다.`;

  const post3 = `[스마트머니 순유입 TOP 3 💰 (3/4)]

오늘 실질 자금(순유입)이 가장 많이 몰린 ETF:
1. KODEX 200 (069500) : +4,250억원
2. KODEX 미국S&P500TR (379800) : +3,120억원
3. TIGER 미국나스닥100 (133690) : +2,850억원

💡 단순 거래대금 쏠림이 아닌, 신규 설정액 기준의 '진성수급' 유입 상위 종목들입니다.`;

  const post4 = `[풀버전 인터랙티브 맵 보기 🌐 (4/4)]

✓ 62개 테마 인터랙티브 롱숏 맵
✓ 5개 시점(일/주/월/연) AUM 브릿지 주가/수급 분해
✓ 1,164개 전 종목 괴리율 & 거래대금 랭킹

👉 지금 웹에서 확인하기:
https://etf-campus.pages.dev/briefing?utm_source=threads&utm_medium=social&utm_campaign=daily_briefing_${targetDate.replace(/-/g, "")}

* 본 자료는 정보 제공 목적이며 특정 금융투자상품의 매수·매도를 권유하지 않습니다.`;

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
    .card { background: #111827; border: 1px solid #1F2937; border-radius: 16px; padding: 20px; margin-bottom: 16px; white-space: pre-wrap; font-size: 15px; line-height: 1.6; }
    .badge { background: #1E293B; color: #4ADE80; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 9999px; display: inline-block; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="margin: 0 0 8px; color: #4ADE80;">🧵 Threads 마켓 브리핑 타래 미리보기</h2>
      <div style="color: #94A3B8; font-size: 14px;">${formattedDate} 기준</div>
    </div>
    <div class="card"><span class="badge">POST 1/4 (HOOK)</span>\n${post1}</div>
    <div class="card"><span class="badge">POST 2/4 (THEMES)</span>\n${post2}</div>
    <div class="card"><span class="badge">POST 3/4 (FLOW)</span>\n${post3}</div>
    <div class="card"><span class="badge">POST 4/4 (CTA)</span>\n${post4}</div>
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
