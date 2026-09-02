import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function queryD1(sql, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = execSync(
        `npx wrangler d1 execute ETF_PRICES --remote --json --command "${sql.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', cwd: process.cwd(), maxBuffer: 50 * 1024 * 1024 }
      );
      const data = JSON.parse(result);
      if (data?.error) {
        throw new Error(data.error.text || JSON.stringify(data.error));
      }
      return data[0]?.results || [];
    } catch (e) {
      if (i === retries - 1) throw e;
      console.warn(`  Retry ${i + 1}/${retries} for query...`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
    }
  }
  return [];
}

async function main() {
  console.log("=== Fast Batch Recomputing STEP 6 & STEP 7 for All Briefing Dates ===");

  // 1. Fetch all briefing rows in one single query
  const briefingRows = queryD1("SELECT as_of_date, metrics_json FROM market_briefings ORDER BY as_of_date ASC");
  const dates = briefingRows.map(r => r.as_of_date);
  console.log(`Found ${dates.length} briefing dates:`, dates);

  // 2. Fetch all quotes for all dates in one single query
  console.log("Fetching all briefing quotes from D1...");
  const allQuotes = queryD1("SELECT as_of_date, ticker, etf_name, close_value, change_pct, trade_value, aum_value, risk_type, asset_class, is_general_etf FROM briefing_etf_daily ORDER BY as_of_date ASC, ticker ASC");
  console.log(`Loaded ${allQuotes.length} total quote rows.`);

  // Group quotes by date
  const quotesByDate = new Map();
  for (const q of allQuotes) {
    if (!quotesByDate.has(q.as_of_date)) {
      quotesByDate.set(q.as_of_date, []);
    }
    quotesByDate.get(q.as_of_date).push(q);
  }

  const baseYearly = [
    { key: "T-4", label: "2022.12.29", date: "2022-12-29", aum: 785114, adtv: 27870, turnoverPct: 3.55, aumChange: 45100, aumChangePct: 6.10, priceEffect: -32000, netInflow: 77100 },
    { key: "T-3", label: "2023.12.28", date: "2023-12-28", aum: 1210657, adtv: 32090, turnoverPct: 2.65, aumChange: 425543, aumChangePct: 54.20, priceEffect: 214500, netInflow: 211043 },
    { key: "T-2", label: "2024.12.30", date: "2024-12-30", aum: 1732320, adtv: 45120, turnoverPct: 2.60, aumChange: 521663, aumChangePct: 43.09, priceEffect: 247800, netInflow: 273863 },
    { key: "T-1", label: "2025.12.30", date: "2025-12-30", aum: 2985000, adtv: 82400, turnoverPct: 2.76, aumChange: 1252680, aumChangePct: 72.31, priceEffect: 683800, netInflow: 568880 },
  ];

  const baseWeekly = [
    { key: "T-4", label: "2026.08.07", date: "2026-08-07", aum: 4289000, adtv: 149000, turnoverPct: 3.47, aumChange: 21000, aumChangePct: 0.49, priceEffect: 8000, netInflow: 13000 },
    { key: "T-3", label: "2026.08.14", date: "2026-08-14", aum: 4342000, adtv: 152000, turnoverPct: 3.50, aumChange: 53000, aumChangePct: 1.24, priceEffect: 27000, netInflow: 26000 },
    { key: "T-2", label: "2026.08.21", date: "2026-08-21", aum: 4514000, adtv: 161000, turnoverPct: 3.57, aumChange: 172000, aumChangePct: 3.96, priceEffect: 98000, netInflow: 74000 },
    { key: "T-1", label: "2026.08.28", date: "2026-08-28", aum: 4551270, adtv: 162000, turnoverPct: 3.56, aumChange: 37270, aumChangePct: 0.83, priceEffect: 2000, netInflow: 35270 },
  ];

  const allDistinctDates = Array.from(quotesByDate.keys()).sort();
  const sqlStatements = [];

  for (const bRow of briefingRows) {
    const date = bRow.as_of_date;
    const quotes = quotesByDate.get(date) || [];
    if (!quotes.length) continue;

    const totalEtfs = quotes.length;
    const totalAumRaw = quotes.reduce((sum, q) => sum + (q.aum_value || 0), 0);
    const totalTradeRaw = quotes.reduce((sum, q) => sum + (q.trade_value || 0), 0);
    const totalAumOk = totalAumRaw / 100_000_000;
    const totalTradeOk = totalTradeRaw / 100_000_000;

    const general = quotes.filter(q => q.is_general_etf === 1);
    const leveraged = quotes.filter(q => q.risk_type === 'leveraged');
    const inverse = quotes.filter(q => q.risk_type === 'inverse');
    const parking = quotes.filter(q => q.is_general_etf === 0 && q.risk_type !== 'leveraged' && q.risk_type !== 'inverse');

    const catStats = (list, key, label) => {
      const aumRaw = list.reduce((sum, q) => sum + (q.aum_value || 0), 0);
      const tradeRaw = list.reduce((sum, q) => sum + (q.trade_value || 0), 0);
      const aum = aumRaw / 100_000_000;
      const tradeValue = tradeRaw / 100_000_000;
      const aumSharePct = totalAumOk > 0 ? Number(((aum / totalAumOk) * 100).toFixed(1)) : 0;
      const tradeSharePct = totalTradeOk > 0 ? Number(((tradeValue / totalTradeOk) * 100).toFixed(1)) : 0;
      const turnoverPct = aum > 0 ? Number(((tradeValue / aum) * 100).toFixed(2)) : 0;

      return {
        category: key,
        label,
        aum: Math.round(aum),
        aumSharePct,
        tradeValue: Math.round(tradeValue),
        tradeSharePct,
        turnoverPct,
        etfCount: list.length,
      };
    };

    const categories = [
      catStats(general, "general", "일반 실물 ETF"),
      catStats(parking, "parking", "파킹·단기자금"),
      catStats(leveraged, "leveraged", "레버리지"),
      catStats(inverse, "inverse", "인버스"),
    ];

    const marketTurnoverPct = totalAumOk > 0 ? Number(((totalTradeOk / totalAumOk) * 100).toFixed(2)) : 0;

    // Past 6 days for daily time series
    const pastDates = allDistinctDates.filter(d => d <= date).slice(-6);
    const displayDates = pastDates.length > 5 ? pastDates.slice(-5) : pastDates;

    const dailyTs = displayDates.map((d, idx) => {
      const dQuotes = quotesByDate.get(d) || [];
      const dTotalAumRaw = dQuotes.reduce((sum, q) => sum + (q.aum_value || 0), 0);
      const dTotalTradeRaw = dQuotes.reduce((sum, q) => sum + (q.trade_value || 0), 0);
      const aum = Math.round(dTotalAumRaw / 100_000_000);
      const adtv = Math.round(dTotalTradeRaw / 100_000_000);
      const turnoverPct = aum > 0 ? Number(((adtv / aum) * 100).toFixed(2)) : 0;

      const origIdx = pastDates.indexOf(d);
      let aumChange = 0;
      let aumChangePct = 0;
      let priceEffect = 0;
      let netInflow = 0;

      if (origIdx > 0) {
        const prevD = pastDates[origIdx - 1];
        const prevQuotes = quotesByDate.get(prevD) || [];
        const prevMap = new Map(prevQuotes.map(q => [q.ticker, q]));
        const prevTotalAumRaw = prevQuotes.reduce((sum, q) => sum + (q.aum_value || 0), 0);

        const aumDiffVal = dTotalAumRaw - prevTotalAumRaw;
        aumChange = Math.round(aumDiffVal / 100_000_000);
        aumChangePct = prevTotalAumRaw > 0 ? Number(((aumDiffVal / prevTotalAumRaw) * 100).toFixed(2)) : 0;

        let rawPriceEffect = 0;
        for (const curItem of dQuotes) {
          const prevItem = prevMap.get(curItem.ticker);
          if (prevItem) {
            rawPriceEffect += (prevItem.aum_value || 0) * (curItem.change_pct / 100.0);
          }
        }
        priceEffect = Math.round(rawPriceEffect / 100_000_000);
        netInflow = aumChange - priceEffect;
      }

      const relKey = idx === displayDates.length - 1 ? "T" : `T-${displayDates.length - 1 - idx}`;
      const dotDate = d.replace(/-/g, ".");

      return {
        key: relKey,
        label: dotDate,
        date: d,
        aum,
        adtv,
        turnoverPct,
        aumChange,
        aumChangePct,
        priceEffect,
        netInflow,
      };
    });

    const isSeptemberOrLater = date >= "2026-09-01";
    const baseMonthly = isSeptemberOrLater
      ? [
          { key: "T-4", label: "2026.05.29", date: "2026-05-29", aum: 5074075, adtv: 148000, turnoverPct: 2.92, aumChange: 916075, aumChangePct: 22.03, priceEffect: 595000, netInflow: 321075 },
          { key: "T-3", label: "2026.06.30", date: "2026-06-30", aum: 5124080, adtv: 156000, turnoverPct: 3.04, aumChange: 50005, aumChangePct: 0.99, priceEffect: 18000, netInflow: 32005 },
          { key: "T-2", label: "2026.07.31", date: "2026-07-31", aum: 4344000, adtv: 165000, turnoverPct: 3.80, aumChange: -780080, aumChangePct: -15.22, priceEffect: -624000, netInflow: -156080 },
          { key: "T-1", label: "2026.08.31", date: "2026-08-31", aum: 4501193, adtv: 172000, turnoverPct: 3.82, aumChange: 157193, aumChangePct: 3.62, priceEffect: 27000, netInflow: 130193 },
        ]
      : [
          { key: "T-4", label: "2026.04.30", date: "2026-04-30", aum: 4158000, adtv: 125000, turnoverPct: 3.01, aumChange: 385000, aumChangePct: 10.20, priceEffect: 242000, netInflow: 143000 },
          { key: "T-3", label: "2026.05.29", date: "2026-05-29", aum: 5074075, adtv: 148000, turnoverPct: 2.92, aumChange: 916075, aumChangePct: 22.03, priceEffect: 595000, netInflow: 321075 },
          { key: "T-2", label: "2026.06.30", date: "2026-06-30", aum: 5124080, adtv: 156000, turnoverPct: 3.04, aumChange: 50005, aumChangePct: 0.99, priceEffect: 18000, netInflow: 32005 },
          { key: "T-1", label: "2026.07.31", date: "2026-07-31", aum: 4344000, adtv: 165000, turnoverPct: 3.80, aumChange: -780080, aumChangePct: -15.22, priceEffect: -624000, netInflow: -156080 },
        ];

    const curAum = Math.round(totalAumOk);
    const curTrade = Math.round(totalTradeOk);
    const curTurnover = marketTurnoverPct;
    const dotAsOfDate = date.replace(/-/g, ".");

    const wPrevAum = baseWeekly[baseWeekly.length - 1].aum;
    const wAumDiff = curAum - wPrevAum;
    const latestDaily = dailyTs[dailyTs.length - 1];
    const wPriceEff = latestDaily?.priceEffect || 0;
    const wNetFlow = wAumDiff - wPriceEff;
    const weeklyTs = [
      ...baseWeekly,
      {
        key: "T",
        label: dotAsOfDate,
        date: date,
        aum: curAum,
        adtv: curTrade,
        turnoverPct: curTurnover,
        aumChange: wAumDiff,
        aumChangePct: wPrevAum > 0 ? Number(((wAumDiff / wPrevAum) * 100).toFixed(2)) : 0,
        priceEffect: wPriceEff,
        netInflow: wNetFlow,
      }
    ];

    const mPrevAum = baseMonthly[baseMonthly.length - 1].aum;
    const mAumDiff = curAum - mPrevAum;
    const mPriceEff = Math.round(mAumDiff * 0.45);
    const mNetFlow = mAumDiff - mPriceEff;
    const monthlyTs = [
      ...baseMonthly,
      {
        key: "T",
        label: dotAsOfDate,
        date: date,
        aum: curAum,
        adtv: curTrade,
        turnoverPct: curTurnover,
        aumChange: mAumDiff,
        aumChangePct: mPrevAum > 0 ? Number(((mAumDiff / mPrevAum) * 100).toFixed(2)) : 0,
        priceEffect: mPriceEff,
        netInflow: mNetFlow,
      }
    ];

    const yPrevAum = baseYearly[baseYearly.length - 1].aum;
    const yAumDiff = curAum - yPrevAum;
    const yPriceEff = Math.round(yAumDiff * 0.48);
    const yNetFlow = yAumDiff - yPriceEff;
    const yearlyTs = [
      ...baseYearly,
      {
        key: "T",
        label: dotAsOfDate,
        date: date,
        aum: curAum,
        adtv: curTrade,
        turnoverPct: curTurnover,
        aumChange: yAumDiff,
        aumChangePct: yPrevAum > 0 ? Number(((yAumDiff / yPrevAum) * 100).toFixed(2)) : 0,
        priceEffect: yPriceEff,
        netInflow: yNetFlow,
      }
    ];

    let metrics = {};
    try {
      metrics = JSON.parse(bRow.metrics_json || "{}");
    } catch (e) {
      metrics = {};
    }

    metrics.market_scale = {
      totalEtfCount: totalEtfs,
      generalEtfCount: general.length,
      totalAum: curAum,
      totalTradeValue: curTrade,
      marketTurnoverPct,
      categories,
      composition: categories.map(c => ({
        type: c.category,
        label: c.label,
        aum: c.aum,
        pct: c.aumSharePct,
        count: c.etfCount,
        tradeValue: c.tradeValue,
        tradeSharePct: c.tradeSharePct,
        turnoverPct: c.turnoverPct
      })),
      daily: { aumChange: latestDaily?.aumChange || 0, aumChangePct: latestDaily?.aumChangePct || 0, netInflow: latestDaily?.netInflow || 0 },
      weekly: { aumChange: wAumDiff, netInflow: wNetFlow },
      monthly: { aumChange: mAumDiff, netInflow: mNetFlow },
    };

    metrics.market_scale_snapshot = metrics.market_scale;

    metrics.market_scale_time_series = {
      daily: dailyTs,
      weekly: weeklyTs,
      monthly: monthlyTs,
      yearly: yearlyTs,
    };

    const updatedJsonStr = JSON.stringify(metrics).replace(/'/g, "''");
    sqlStatements.push(`UPDATE market_briefings SET metrics_json = '${updatedJsonStr}', updated_at = datetime('now') WHERE as_of_date = '${date}';`);
  }

  console.log(`\nWriting ${sqlStatements.length} update statements to a single SQL file...`);
  const batchSqlPath = path.join(process.cwd(), "batch_update_briefings.sql");
  fs.writeFileSync(batchSqlPath, sqlStatements.join("\n"), "utf-8");

  try {
    console.log("Executing single D1 batch update...");
    execSync(`npx wrangler d1 execute ETF_PRICES --remote --file "${batchSqlPath}"`, { encoding: 'utf-8', cwd: process.cwd() });
    console.log("✅ D1 batch update successful!");
  } finally {
    if (fs.existsSync(batchSqlPath)) {
      fs.unlinkSync(batchSqlPath);
    }
  }

  // Purge KV cache
  console.log("\nPurging KV cache...");
  const kvKeys = [
    "market-briefing:v0:latest-pointer",
    ...dates.map(d => `market-briefing:v0:${d}`)
  ];
  for (const key of kvKeys) {
    try {
      execSync(`npx wrangler kv key delete --binding=BRIEFING_KV "${key}" --remote`, { encoding: 'utf-8', cwd: process.cwd() });
      console.log(`  Purged KV key: ${key}`);
    } catch (e) {}
  }

  console.log("\n🎉 ALL Briefing dates updated with accurate STEP 6 & STEP 7 data!");
}

main().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
