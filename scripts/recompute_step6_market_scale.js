import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DATES = [
  "2026-08-24",
  "2026-08-25",
  "2026-08-26",
  "2026-08-27",
  "2026-08-28",
  "2026-08-31"
];

function queryD1(sql) {
  const result = execSync(
    `npx wrangler d1 execute ETF_PRICES --remote --json --command "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', cwd: process.cwd(), maxBuffer: 50 * 1024 * 1024 }
  );
  const data = JSON.parse(result);
  return data[0]?.results || [];
}

async function main() {
  console.log("=== Recomputing STEP 6 Market Structure Snapshot (4 Categories) ===");

  for (const date of DATES) {
    console.log(`\nProcessing ${date}...`);

    // 1. Fetch all quotes for this date
    const quotes = queryD1(`SELECT ticker, etf_name, close_value, change_pct, trade_value, aum_value, risk_type, asset_class, is_general_etf FROM briefing_etf_daily WHERE as_of_date = '${date}'`);
    if (!quotes.length) {
      console.warn(`No quotes found for ${date}`);
      continue;
    }

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

    // Ensure sum of share percentages equals 100.0%
    const marketTurnoverPct = totalAumOk > 0 ? Number(((totalTradeOk / totalAumOk) * 100).toFixed(2)) : 0;

    console.log(`  Total AUM: ${(totalAumOk / 10000).toFixed(1)}조원, Total Trade: ${(totalTradeOk / 10000).toFixed(1)}조원, Turnover: ${marketTurnoverPct}%`);
    for (const c of categories) {
      console.log(`    - ${c.label} (${c.category}): AUM ${c.aumSharePct}% (${(c.aum / 10000).toFixed(1)}조), Trade ${c.tradeSharePct}% (${(c.tradeValue / 10000).toFixed(1)}조), Turnover ${c.turnoverPct}%, Count: ${c.etfCount}`);
    }

    // 2. Fetch existing metrics_json
    const briefingRows = queryD1(`SELECT metrics_json FROM market_briefings WHERE as_of_date = '${date}'`);
    if (!briefingRows.length) continue;

    let metrics = {};
    try {
      metrics = JSON.parse(briefingRows[0].metrics_json);
    } catch (e) {
      metrics = {};
    }

    metrics.market_scale = {
      totalEtfCount: totalEtfs,
      generalEtfCount: general.length,
      totalAum: Math.round(totalAumOk),
      totalTradeValue: Math.round(totalTradeOk),
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
      daily: metrics.market_scale?.daily || { aumChange: 0, aumChangePct: 0, netInflow: 0 },
      weekly: metrics.market_scale?.weekly || { aumChange: 0, netInflow: 0 },
      monthly: metrics.market_scale?.monthly || { aumChange: 0, netInflow: 0 },
    };

    // 3. Write SQL to temp file and update D1
    const updatedJsonStr = JSON.stringify(metrics).replace(/'/g, "''");
    const tempSqlPath = path.join(process.cwd(), `temp_update_${date}.sql`);
    const updateSql = `UPDATE market_briefings SET metrics_json = '${updatedJsonStr}', updated_at = datetime('now') WHERE as_of_date = '${date}';`;
    fs.writeFileSync(tempSqlPath, updateSql, 'utf-8');

    try {
      execSync(`npx wrangler d1 execute ETF_PRICES --remote --file "${tempSqlPath}"`, { encoding: 'utf-8', cwd: process.cwd() });
      console.log(`  ✅ Successfully updated D1 for ${date}`);
    } finally {
      if (fs.existsSync(tempSqlPath)) {
        fs.unlinkSync(tempSqlPath);
      }
    }
  }

  // 4. Invalidate KV caches
  console.log("\nPurging KV Cache...");
  const kvKeys = [
    "market-briefing:v0:latest-pointer",
    ...DATES.map(d => `market-briefing:v0:${d}`)
  ];
  for (const key of kvKeys) {
    try {
      execSync(`npx wrangler kv key delete --binding=BRIEFING_KV "${key}" --remote`, { encoding: 'utf-8', cwd: process.cwd() });
      console.log(`  Deleted KV key: ${key}`);
    } catch (e) {
      // ignore
    }
  }


  console.log("\n✅ All 6 briefing dates updated with full 4-category market scale & trade volume metrics!");
}

main().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
