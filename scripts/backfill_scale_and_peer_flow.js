import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DATES = [
  '2026-08-24',
  '2026-08-25',
  '2026-08-26',
  '2026-08-27',
  '2026-08-28',
  '2026-08-31',
  '2026-09-01'
];

function queryD1(sql, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = execSync(
        `npx wrangler d1 execute etf-prices --remote --json --command "${sql.replace(/"/g, '\\"')}"`,
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

function executeD1Sql(sqlFile) {
  execSync(
    `npx wrangler d1 execute etf-prices --remote --file "${sqlFile}"`,
    { encoding: 'utf-8', cwd: process.cwd(), stdio: 'inherit' }
  );
}

function calculateConstituentFlowAndPriceEffect(current, previous) {
  const c0 = current.close_value || 0;
  const nav0 = current.nav_value || c0;
  const aum0 = current.aum_value || 0;
  const shares0 = current.shares ? Number(current.shares) : (nav0 > 0 ? aum0 / nav0 : 0);

  if (!previous || (!previous.aum_value && !previous.nav_value)) {
    return {
      ticker: current.ticker,
      etfName: current.etf_name,
      isGeneralEtf: current.is_general_etf === 1,
      netInflowValue: 0,
      priceEffectValue: 0,
      returnPct: current.change_pct || 0,
    };
  }

  const cPrev = previous.close_value || c0;
  const navPrev = previous.nav_value || cPrev;
  const aumPrev = previous.aum_value || 0;
  const sharesPrev = previous.shares ? Number(previous.shares) : (navPrev > 0 ? aumPrev / navPrev : shares0);

  const netInflowValue = (shares0 - sharesPrev) * nav0;
  const returnPct = cPrev > 0 ? ((c0 - cPrev) / cPrev) * 100 : (current.change_pct || 0);
  const priceEffectValue = aumPrev * (returnPct / 100.0);

  return {
    ticker: current.ticker,
    etfName: current.etf_name,
    isGeneralEtf: current.is_general_etf === 1,
    netInflowValue,
    priceEffectValue,
    returnPct,
  };
}

async function main() {
  console.log('=== Backfilling and Synchronizing market_scale_daily & peer_flow_daily ===');

  const sqlStatements = [];

  for (const asOfDate of DATES) {
    console.log(`\n[Processing Date: ${asOfDate}]`);

    const bRows = queryD1(`SELECT as_of_date, general_total_aum, general_etf_count, metrics_json FROM market_briefings WHERE as_of_date = '${asOfDate}'`);
    if (!bRows.length) {
      console.warn(`  ⚠ No briefing found for ${asOfDate}, skipping...`);
      continue;
    }

    const b = bRows[0];
    const metrics = JSON.parse(b.metrics_json || '{}');
    const scale = metrics.market_scale || {};
    const ts = metrics.market_scale_time_series || {};

    const latestDaily = ts.daily?.[ts.daily.length - 1] || {};
    const latestWeekly = ts.weekly?.[ts.weekly.length - 1] || {};
    const latestMonthly = ts.monthly?.[ts.monthly.length - 1] || {};

    const totalAum = scale.totalAum || 0;
    const totalEtfCount = scale.totalEtfCount || 0;
    const generalAum = b.general_total_aum || 0;
    const generalEtfCount = b.general_etf_count || 0;

    const dailyAumChange = latestDaily.aumChange || 0;
    const dailyNetInflow = latestDaily.netInflow || 0;
    const weeklyAumChange = latestWeekly.aumChange || 0;
    const weeklyNetInflow = latestWeekly.netInflow || 0;
    const monthlyAumChange = latestMonthly.aumChange || 0;
    const monthlyNetInflow = latestMonthly.netInflow || 0;

    sqlStatements.push(`INSERT INTO market_scale_daily (
      as_of_date, total_aum, total_etf_count, general_aum, general_etf_count,
      daily_aum_change, daily_net_inflow, weekly_aum_change, weekly_net_inflow,
      monthly_aum_change, monthly_net_inflow, updated_at
    ) VALUES (
      '${asOfDate}', ${totalAum}, ${totalEtfCount}, ${generalAum}, ${generalEtfCount},
      ${dailyAumChange}, ${dailyNetInflow}, ${weeklyAumChange}, ${weeklyNetInflow},
      ${monthlyAumChange}, ${monthlyNetInflow}, CURRENT_TIMESTAMP
    ) ON CONFLICT(as_of_date) DO UPDATE SET
      total_aum = excluded.total_aum,
      total_etf_count = excluded.total_etf_count,
      general_aum = excluded.general_aum,
      general_etf_count = excluded.general_etf_count,
      daily_aum_change = excluded.daily_aum_change,
      daily_net_inflow = excluded.daily_net_inflow,
      weekly_aum_change = excluded.weekly_aum_change,
      weekly_net_inflow = excluded.weekly_net_inflow,
      monthly_aum_change = excluded.monthly_aum_change,
      monthly_net_inflow = excluded.monthly_net_inflow,
      updated_at = CURRENT_TIMESTAMP;`);

    const quotes = queryD1(`SELECT ticker, etf_name, close_value, change_pct, trade_value, aum_value, risk_type, asset_class, is_general_etf, asset_detail, nav_value, shares FROM briefing_etf_daily WHERE as_of_date = '${asOfDate}'`);
    const generalQuotes = quotes.filter(q => q.is_general_etf === 1);

    const allDates = queryD1(`SELECT DISTINCT as_of_date FROM briefing_etf_daily WHERE as_of_date <= '${asOfDate}' ORDER BY as_of_date DESC LIMIT 25`).map(r => r.as_of_date);
    const t5Date = allDates[5] || allDates[allDates.length - 1];
    const t20Date = allDates[20] || allDates[allDates.length - 1];

    let qT5Map = new Map();
    let qT20Map = new Map();
    if (t5Date && t5Date !== asOfDate) {
      const q5 = queryD1(`SELECT ticker, aum_value, nav_value, close_value, shares FROM briefing_etf_daily WHERE as_of_date = '${t5Date}'`);
      qT5Map = new Map(q5.map(r => [r.ticker, r]));
    }
    if (t20Date && t20Date !== asOfDate) {
      const q20 = queryD1(`SELECT ticker, aum_value, nav_value, close_value, shares FROM briefing_etf_daily WHERE as_of_date = '${t20Date}'`);
      qT20Map = new Map(q20.map(r => [r.ticker, r]));
    }

    const groups = new Map();
    for (const q of generalQuotes) {
      const detail = q.asset_detail?.trim();
      if (!detail || detail === '미확인 주식전략' || detail === '미분류') continue;
      const assetClass = q.asset_class?.trim() || '미분류';
      if (!groups.has(detail)) {
        groups.set(detail, { peerGroup: detail, assetClass, members: [] });
      }
      groups.get(detail).members.push(q);
    }

    const weeklyList = [];
    const monthlyList = [];

    for (const [, g] of groups.entries()) {
      if (g.members.length < 3) continue;

      let gFlow5Won = 0;
      let gFlow20Won = 0;
      const ret5List = [];
      const ret20List = [];

      for (const m of g.members) {
        const q5 = qT5Map.get(m.ticker);
        const flow5 = calculateConstituentFlowAndPriceEffect(m, q5);
        ret5List.push(flow5.returnPct);
        gFlow5Won += flow5.netInflowValue;

        const q20 = qT20Map.get(m.ticker);
        const flow20 = calculateConstituentFlowAndPriceEffect(m, q20);
        ret20List.push(flow20.returnPct);
        gFlow20Won += flow20.netInflowValue;
      }

      const avgRet5 = ret5List.length > 0 ? ret5List.reduce((a, b) => a + b, 0) / ret5List.length : 0;
      const avgRet20 = ret20List.length > 0 ? ret20List.reduce((a, b) => a + b, 0) / ret20List.length : 0;

      const netInflow5Ok = Math.round(gFlow5Won / 100000000);
      const netInflow20Ok = Math.round(gFlow20Won / 100000000);

      weeklyList.push({
        peerGroup: g.peerGroup,
        assetClass: g.assetClass,
        etfCount: g.members.length,
        netInflow: netInflow5Ok,
        returnPct: Number(avgRet5.toFixed(2)),
      });

      monthlyList.push({
        peerGroup: g.peerGroup,
        assetClass: g.assetClass,
        etfCount: g.members.length,
        netInflow: netInflow20Ok,
        returnPct: Number(avgRet20.toFixed(2)),
      });
    }

    weeklyList.sort((a, b) => b.netInflow - a.netInflow);
    monthlyList.sort((a, b) => b.netInflow - a.netInflow);

    sqlStatements.push(`DELETE FROM peer_flow_daily WHERE as_of_date = '${asOfDate}';`);

    weeklyList.forEach((item, idx) => {
      const escapedGroup = item.peerGroup.replace(/'/g, "''");
      const escapedClass = (item.assetClass || "").replace(/'/g, "''");
      sqlStatements.push(`INSERT INTO peer_flow_daily (
        as_of_date, period, peer_group, asset_class, etf_count, net_inflow, cumulative_return_pct, rank
      ) VALUES (
        '${asOfDate}', 'weekly', '${escapedGroup}', '${escapedClass}', ${item.etfCount}, ${item.netInflow}, ${item.returnPct}, ${idx + 1}
      );`);
    });

    monthlyList.forEach((item, idx) => {
      const escapedGroup = item.peerGroup.replace(/'/g, "''");
      const escapedClass = (item.assetClass || "").replace(/'/g, "''");
      sqlStatements.push(`INSERT INTO peer_flow_daily (
        as_of_date, period, peer_group, asset_class, etf_count, net_inflow, cumulative_return_pct, rank
      ) VALUES (
        '${asOfDate}', 'monthly', '${escapedGroup}', '${escapedClass}', ${item.etfCount}, ${item.netInflow}, ${item.returnPct}, ${idx + 1}
      );`);
    });

    console.log(`  ✅ Prepared ${weeklyList.length} weekly + ${monthlyList.length} monthly peer flow rankings for ${asOfDate}`);
  }

  const tmpSql = path.join(process.cwd(), 'temp_sync_scale_peer_flow.sql');
  fs.writeFileSync(tmpSql, sqlStatements.join('\n'), 'utf-8');
  console.log(`\n🚀 Executing ${sqlStatements.length} SQL statements on remote D1 database...`);

  try {
    executeD1Sql(tmpSql);
    console.log(`\n✅ Successfully synced market_scale_daily and peer_flow_daily for all dates!`);
  } finally {
    if (fs.existsSync(tmpSql)) {
      fs.unlinkSync(tmpSql);
    }
  }
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
