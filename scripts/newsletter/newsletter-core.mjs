import fs from "node:fs";

import { parse } from "csv-parse/sync";

export const NEWSLETTER_SCHEMA_VERSION = 1;
export const DEFAULT_AUM_FLOOR = 100_000_000_000;
export const RANKING_LIMIT = 5;
export const MAP_LIMIT = 20;
export const NEW_LISTING_LIMIT = 6;

const UNIVERSES = {
  general: {
    label: "일반 계좌",
    matches: (record) => record.riskType === "normal",
  },
  pension: {
    label: "연금 계좌",
    matches: (record) => record.riskType === "normal" && record.pensionStatus === "가능",
  },
  leveraged: {
    label: "레버리지·인버스",
    matches: (record) => record.riskType === "leverage" || record.riskType === "inverse",
  },
};

function requireValue(row, field, source) {
  const value = row[field]?.trim();
  if (!value) throw new Error(`${source}: ${field} 값이 없습니다.`);
  return value;
}

function parseNumber(value, field, source) {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`${source}: ${field} 값이 숫자가 아닙니다: ${value}`);
  return result;
}

function parseNullableNumber(value, field, source) {
  if (value === undefined || value === null || value.trim() === "") return null;
  return parseNumber(value, field, source);
}

function indexUnique(rows, field, source) {
  const index = new Map();
  for (const row of rows) {
    const key = requireValue(row, field, source);
    if (index.has(key)) throw new Error(`${source}: ${field} 중복 값이 있습니다: ${key}`);
    index.set(key, row);
  }
  return index;
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`날짜는 YYYY-MM-DD 형식이어야 합니다: ${value}`);
  return value;
}

export function readCsvFile(filePath) {
  return parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_quotes: false,
    trim: false,
  });
}

export function buildSnapshot({ masterRows, returnRows, pensionRows, snapshotDate }) {
  parseIsoDate(snapshotDate);
  const returnsByTicker = indexUnique(returnRows, "ticker", "etf_returns_draft.csv");
  const pensionByTicker = pensionRows ? indexUnique(pensionRows, "ticker", "pension_rows") : null;

  if (masterRows.length !== returnRows.length) {
    throw new Error(`데이터 행 수가 일치하지 않습니다: master=${masterRows.length}, returns=${returnRows.length}`);
  }

  const records = masterRows.map((master) => {
    const ticker = requireValue(master, "ticker", "etf_master_draft.csv");
    const source = `ticker:${ticker}`;
    const returns = returnsByTicker.get(ticker);
    if (!returns) throw new Error(`${source}: 수익률 행이 누락됐습니다.`);
    const pension = pensionByTicker?.get(ticker);
    const pensionStatus = master.pension_eligible?.trim() || pension?.final_pension || "불가";

    return {
      ticker,
      name: requireValue(master, "name", source),
      aum: parseNumber(master.aum, "aum", source),
      assetClass: requireValue(master, "asset_class", source),
      riskType: requireValue(master, "risk_type", source),
      pensionStatus,
      asOfDate: requireValue(master, "bas_dt", source),
      listingDate: master.listing_date?.trim() || null,
      return1w: parseNullableNumber(returns.r_1w, "r_1w", source),
      returnItd: parseNullableNumber(returns.r_itd, "r_itd", source),
      isNew90d: returns.new_90d === "Y",
    };
  });

  const dataDates = [...new Set(records.map((record) => record.asOfDate))];
  if (dataDates.length !== 1) throw new Error(`마스터 기준일이 하나가 아닙니다: ${dataDates.join(", ")}`);

  return {
    schemaVersion: NEWSLETTER_SCHEMA_VERSION,
    snapshotDate,
    dataAsOf: dataDates[0],
    recordCount: records.length,
    records,
  };
}

export function rankUniverse(snapshot, universe, aumFloor = DEFAULT_AUM_FLOOR) {
  const definition = UNIVERSES[universe];
  if (!definition) throw new Error(`알 수 없는 순위 구분입니다: ${universe}`);

  return snapshot.records
    .filter((record) => definition.matches(record))
    .filter((record) => record.aum >= aumFloor && record.return1w !== null)
    .sort((a, b) => {
      if (b.return1w !== a.return1w) return b.return1w - a.return1w;
      if (b.aum !== a.aum) return b.aum - a.aum;
      return a.ticker.localeCompare(b.ticker, "ko");
    })
    .map((record, index) => ({ ...record, rank: index + 1 }));
}

function previousRanks(snapshot, universe, aumFloor) {
  if (!snapshot) return new Map();
  return new Map(rankUniverse(snapshot, universe, aumFloor).map((record) => [record.ticker, record.rank]));
}

function topAssetClasses(ranking, previousRanking) {
  const count = (items) => {
    const result = new Map();
    for (const item of items.slice(0, MAP_LIMIT)) {
      result.set(item.assetClass, (result.get(item.assetClass) ?? 0) + 1);
    }
    return result;
  };

  const currentCounts = count(ranking);
  const previousCounts = count(previousRanking);
  return [...currentCounts.entries()]
    .map(([assetClass, currentCount]) => ({
      assetClass,
      currentCount,
      previousCount: previousRanking.length ? (previousCounts.get(assetClass) ?? 0) : null,
    }))
    .sort((a, b) => b.currentCount - a.currentCount || a.assetClass.localeCompare(b.assetClass, "ko"));
}

function pensionChanges(current, previous) {
  if (!previous) return [];
  const before = new Map(previous.records.map((record) => [record.ticker, record.pensionStatus]));
  return current.records
    .filter((record) => before.has(record.ticker) && before.get(record.ticker) !== record.pensionStatus)
    .map((record) => ({
      ticker: record.ticker,
      name: record.name,
      before: before.get(record.ticker),
      after: record.pensionStatus,
    }));
}

export function buildNewsletterModel(current, previous = null, options = {}) {
  const aumFloor = options.aumFloor ?? DEFAULT_AUM_FLOOR;
  const rankingLimit = options.rankingLimit ?? RANKING_LIMIT;
  const rankings = {};

  for (const universe of Object.keys(UNIVERSES)) {
    const fullRanking = rankUniverse(current, universe, aumFloor);
    const before = previousRanks(previous, universe, aumFloor);
    rankings[universe] = {
      label: UNIVERSES[universe].label,
      eligibleCount: fullRanking.length,
      items: fullRanking.slice(0, rankingLimit).map((record) => ({
        ...record,
        previousRank: before.get(record.ticker) ?? null,
        rankChange: before.has(record.ticker) ? before.get(record.ticker) - record.rank : null,
      })),
    };
  }

  const currentGeneral = rankUniverse(current, "general", aumFloor);
  const previousGeneral = previous ? rankUniverse(previous, "general", aumFloor) : [];
  const newListings = current.records
    .filter((record) => record.isNew90d)
    .sort((a, b) => {
      const dateOrder = (b.listingDate ?? "").localeCompare(a.listingDate ?? "");
      return dateOrder || b.aum - a.aum || a.ticker.localeCompare(b.ticker, "ko");
    });

  return {
    schemaVersion: NEWSLETTER_SCHEMA_VERSION,
    issueDate: current.snapshotDate,
    dataAsOf: current.dataAsOf,
    previousIssueDate: previous?.snapshotDate ?? null,
    aumFloor,
    rankings,
    assetMap: topAssetClasses(currentGeneral, previousGeneral),
    newListings: {
      totalCount: newListings.length,
      items: newListings.slice(0, options.newListingLimit ?? NEW_LISTING_LIMIT),
    },
    pensionChanges: pensionChanges(current, previous),
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!/^\d{8}$/.test(value)) return value;
  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
}

function formatIssueDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function issueWeek(value) {
  const [, month, day] = value.split("-").map(Number);
  return `${month}월 ${Math.ceil(day / 7)}주`;
}

function formatAum(value) {
  const eok = value / 100_000_000;
  if (eok >= 10_000) return `${(eok / 10_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조원`;
  return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: eok < 100 ? 1 : 0 })}억원`;
}

function formatReturn(value) {
  if (value === null || value === undefined) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function rankChangeLabel(item) {
  if (item.previousRank === null) return `<span class="rank-new">첫 집계</span>`;
  if (item.rankChange > 0) return `<span class="rank-up">▲ ${item.rankChange}</span>`;
  if (item.rankChange < 0) return `<span class="rank-down">▼ ${Math.abs(item.rankChange)}</span>`;
  return `<span class="rank-same">—</span>`;
}

function rankingTable(section, universe, siteUrl) {
  const rows = section.items.map((item) => `
    <tr>
      <td class="rank">${item.rank}</td>
      <td class="fund">
        <a href="${escapeHtml(siteUrl)}/etf/${encodeURIComponent(item.ticker)}">${escapeHtml(item.name)}</a>
        <span>${escapeHtml(item.ticker)} · ${escapeHtml(item.assetClass)}</span>
      </td>
      <td class="change">${rankChangeLabel(item)}</td>
      <td class="number return ${item.return1w >= 0 ? "positive" : "negative"}">${formatReturn(item.return1w)}</td>
      <td class="number aum">${formatAum(item.aum)}</td>
    </tr>`).join("");

  const mode = universe === "leveraged" ? "derivatives" : universe;
  return `
    <section class="ranking-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">${escapeHtml(section.label)}</p>
          <h3>1주 가격수익률 상위 5</h3>
        </div>
        <a class="text-link" href="${escapeHtml(siteUrl)}/quick?mode=${mode}&scope=1000plus&period=1w&sort=return&direction=desc">전체 보기</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>순위</th><th>ETF</th><th>전주</th><th>1주</th><th>순자산</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${universe === "leveraged" ? `<p class="risk-note">레버리지·인버스 ETF는 일간 수익률을 목표로 운용되며 기간 누적수익률은 기초지수 배수와 달라질 수 있습니다. DC·IRP에서는 편입할 수 없습니다.</p>` : ""}
      ${universe === "pension" ? `<p class="risk-note">DC·IRP 가능으로 확인된 ETF만 집계했습니다. 실제 취급 여부는 금융회사별로 다를 수 있습니다.</p>` : ""}
      <p class="ranking-disclaimer">과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다</p>
    </section>`;
}

function assetMap(model) {
  const max = Math.max(...model.assetMap.map((item) => item.currentCount), 1);
  return model.assetMap.slice(0, 5).map((item) => {
    const delta = item.previousCount === null ? "첫 집계" : `${item.currentCount - item.previousCount > 0 ? "+" : ""}${item.currentCount - item.previousCount}`;
    return `
      <li>
        <div class="map-label"><strong>${escapeHtml(item.assetClass)}</strong><span>상위 20개 중 ${item.currentCount}개 · ${delta}</span></div>
        <div class="bar"><span style="width:${Math.max(8, Math.round((item.currentCount / max) * 100))}%"></span></div>
      </li>`;
  }).join("");
}

function newListingCards(model, siteUrl) {
  return model.newListings.items.map((item) => `
    <article class="listing-card">
      <div>
        <span class="listing-date">${item.listingDate ? formatDate(item.listingDate.replaceAll("-", "")) : "상장일 확인 중"}</span>
        <h3><a href="${escapeHtml(siteUrl)}/etf/${encodeURIComponent(item.ticker)}">${escapeHtml(item.name)}</a></h3>
        <p>${escapeHtml(item.ticker)} · ${escapeHtml(item.assetClass)}</p>
      </div>
      <dl>
        <div><dt>순자산</dt><dd>${formatAum(item.aum)}</dd></div>
        <div><dt>상장 후(ITD)</dt><dd class="${(item.returnItd ?? 0) >= 0 ? "positive" : "negative"}">${formatReturn(item.returnItd)}</dd></div>
      </dl>
    </article>`).join("");
}

export function renderNewsletterHtml(model, options = {}) {
  const siteUrl = options.siteUrl ?? "http://localhost:3000";
  const generalTopClass = model.assetMap[0];
  const summary = [
    `일반 계좌 순위 상위 20개 중 ${generalTopClass ? `${generalTopClass.assetClass}가 ${generalTopClass.currentCount}개로 가장 많았습니다.` : "집계 가능한 종목이 없습니다."}`,
    `연금 계좌는 순자산 1,000억원 이상·1주 수익률 확인 가능 ETF ${model.rankings.pension.eligibleCount}종목을 집계했습니다.`,
    `상장 90일 이내 ETF는 총 ${model.newListings.totalCount}종목이며, 최근 상장 6종목을 아래에 담았습니다.`,
  ];

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>[ETF 캠퍼스 주간노트] ${issueWeek(model.issueDate)}｜주간 ETF 순위·신규 상장</title>
  <style>
    :root{--green:#255b50;--green-dark:#173f37;--mint:#d9eee7;--mint-soft:#f2f8f6;--ink:#17201e;--muted:#66736f;--line:#dfe6e3;--paper:#fff;--bg:#f3f6f5;--red:#e6362b;--blue:#2563d9}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55}
    a{color:inherit} .shell{width:min(760px,100%);margin:0 auto;background:var(--paper)} .header{position:relative;overflow:hidden;padding:34px 38px 30px;background:linear-gradient(135deg,#173f37,#2d6b5e);color:#fff}
    .draft{display:inline-flex;padding:5px 10px;border:1px solid rgba(255,255,255,.45);border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.08em}
    .header h1{max-width:500px;margin:18px 0 8px;font-size:32px;line-height:1.15;letter-spacing:-.04em}.header p{max-width:510px;margin:0;color:#dcebe6}.header img{position:absolute;right:18px;bottom:-14px;width:155px;height:155px;object-fit:contain}
    .content{padding:34px 38px}.meta{margin:0 0 24px;color:var(--muted);font-size:13px}.summary{margin:0 0 38px;padding:22px 24px;border:1px solid #bdd8cf;border-radius:18px;background:var(--mint-soft)}
    .summary h2,.section-title h2{margin:0;font-size:22px;letter-spacing:-.03em}.summary ol{margin:15px 0 0;padding-left:22px}.summary li+li{margin-top:8px}
    .section-title{margin:40px 0 16px}.section-title p{margin:6px 0 0;color:var(--muted);font-size:14px}.ranking-card{margin:0 0 24px;border:1px solid var(--line);border-radius:18px;overflow:hidden}
    .section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:15px;padding:21px 22px 15px}.eyebrow{margin:0 0 3px;color:var(--green);font-size:13px;font-weight:800}.section-heading h3{margin:0;font-size:19px}.text-link{color:var(--green);font-size:13px;font-weight:800;text-decoration:none}
    .table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}th{padding:10px 8px;background:#f5f7f6;color:var(--muted);font-size:11px;text-align:center}th:nth-child(1){width:9%}th:nth-child(2){width:43%}th:nth-child(3){width:12%}th:nth-child(4){width:17%}th:nth-child(5){width:19%}
    td{padding:13px 8px;border-top:1px solid #edf0ef;text-align:center;vertical-align:middle}.rank{font-size:16px;font-weight:900}.fund{text-align:left}.fund a{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:800;text-decoration:none}.fund span{display:block;color:var(--muted);font-size:11px}.number{font-variant-numeric:tabular-nums;font-weight:800}.positive{color:var(--red)}.negative{color:var(--blue)}
    .rank-new,.rank-up,.rank-down,.rank-same{font-size:10px;font-weight:800}.rank-new{color:var(--muted)}.rank-up{color:var(--red)}.rank-down{color:var(--blue)}.rank-same{color:#9aa4a1}
    .risk-note,.ranking-disclaimer{margin:0;padding:11px 18px;border-top:1px solid var(--line);font-size:11px}.risk-note{background:#fbfcfc;color:var(--muted)}.ranking-disclaimer{background:#f7faf9;color:#43504c;font-weight:700}
    .map{margin:0;padding:22px;border:1px solid var(--line);border-radius:18px;list-style:none}.map li+li{margin-top:17px}.map-label{display:flex;justify-content:space-between;gap:15px;margin-bottom:7px}.map-label span{color:var(--muted);font-size:12px}.bar{height:8px;border-radius:999px;background:#edf2f0;overflow:hidden}.bar span{display:block;height:100%;border-radius:inherit;background:var(--green)}
    .listing-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.listing-card{display:flex;flex-direction:column;justify-content:space-between;min-height:182px;padding:18px;border:1px solid var(--line);border-radius:16px}.listing-date{color:var(--green);font-size:11px;font-weight:800}.listing-card h3{margin:8px 0 3px;font-size:15px;line-height:1.35}.listing-card h3 a{text-decoration:none}.listing-card p{margin:0;color:var(--muted);font-size:11px}.listing-card dl{margin:18px 0 0}.listing-card dl div{display:flex;justify-content:space-between;gap:10px}.listing-card dl div+div{margin-top:5px}.listing-card dt{color:var(--muted);font-size:11px}.listing-card dd{margin:0;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
    .cta{margin:38px 0 0;padding:26px;border-radius:18px;background:var(--green-dark);color:#fff;text-align:center}.cta h2{margin:0;font-size:21px}.cta p{margin:7px 0 18px;color:#d8e7e2;font-size:13px}.button{display:inline-block;padding:12px 20px;border-radius:10px;background:#fff;color:var(--green-dark);font-weight:900;text-decoration:none}
    .method{margin-top:32px;padding-top:24px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}.method strong{color:var(--ink)}.footer{padding:25px 38px 36px;background:#eef3f1;color:#52605c;font-size:11px}.footer p{margin:0}.footer p+p{margin-top:10px}.footer a{color:var(--green)}
    @media(max-width:620px){.header{padding:26px 20px 24px}.header h1{max-width:75%;font-size:26px}.header p{max-width:70%;font-size:13px}.header img{right:-4px;width:128px;height:128px}.content{padding:25px 16px}.meta{font-size:12px}.summary{padding:18px}.summary h2,.section-title h2{font-size:20px}.section-heading{align-items:flex-start;padding:18px 14px 12px}.section-heading h3{font-size:17px}.text-link{max-width:76px;text-align:right}table{font-size:12px}th:nth-child(1){width:9%}th:nth-child(2){width:43%}th:nth-child(3){width:12%}th:nth-child(4){width:17%}th:nth-child(5){width:19%}td{padding:12px 5px}.fund span{font-size:10px}.change{font-size:9px}.aum{font-size:11px}.listing-grid{grid-template-columns:1fr}.listing-card{min-height:0}.map-label{align-items:flex-start}.map-label span{max-width:55%;text-align:right}.footer{padding:22px 18px 30px}}
  </style>
</head>
<body>
  <main class="shell">
    <header class="header">
      <span class="draft">발송 전 시제품</span>
      <h1>ETF 캠퍼스<br>주간노트</h1>
      <p>국내 상장 ETF의 한 주를 숫자와 기준으로 정리합니다.</p>
      <img src="assets/tickery-briefing.png" alt="주간 데이터를 정리하는 티커리">
    </header>
    <div class="content">
      <p class="meta">${formatIssueDate(model.issueDate)} · 데이터 기준일 ${formatDate(model.dataAsOf)} · 가격 기준·분배금 미포함</p>
      <section class="summary">
        <h2>이번 주 3줄 요약</h2>
        <ol>${summary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
      </section>

      <div class="section-title"><h2>주간 ETF 순위</h2><p>순자산 1,000억원 이상, 1주 가격수익률 높은 순입니다.</p></div>
      ${rankingTable(model.rankings.general, "general", siteUrl)}
      ${rankingTable(model.rankings.pension, "pension", siteUrl)}
      ${rankingTable(model.rankings.leveraged, "leveraged", siteUrl)}

      <div class="section-title"><h2>이번 주 ETF 지도</h2><p>일반 계좌 순위 상위 20개에서 자산군이 차지한 종목 수입니다.</p></div>
      <ul class="map">${assetMap(model)}</ul>

      <div class="section-title"><h2>신규 상장 ETF</h2><p>상장 90일 이내 ${model.newListings.totalCount}종목 중 최근 상장 ${model.newListings.items.length}종목입니다.</p></div>
      <div class="listing-grid">${newListingCards(model, siteUrl)}</div>

      <section class="cta">
        <h2>전체 ETF를 직접 정렬해 보세요</h2>
        <p>기간·계좌·순자산 기준을 바꿔 전체 목록을 확인할 수 있습니다.</p>
        <a class="button" href="${escapeHtml(siteUrl)}/quick?mode=general&scope=1000plus&period=1w&sort=return&direction=desc">ETF 캠퍼스에서 보기</a>
      </section>

      <div class="method">
        <p><strong>산정 기준</strong> 1주는 최신 종가와 달력 기준 7일 전 당일 또는 그 이전 가장 가까운 거래일 종가를 비교합니다. 값이 없으면 추정하지 않고 순위에서 제외합니다. 동일 수익률은 순자산, 종목코드 순으로 정렬합니다.</p>
        <p><strong>연금 계좌</strong> ETF 캠퍼스에서 DC·IRP 가능으로 최종 확인된 종목만 포함합니다. 금융회사별 실제 취급 여부는 주문 전 해당 금융회사에서 다시 확인해야 합니다.</p>
      </div>
    </div>
    <footer class="footer">
      <p>본 서비스는 투자 권유·종목 추천을 제공하지 않으며, 모든 투자 판단의 책임은 이용자 본인에게 있습니다</p>
      <p>이 화면은 발송 전 로컬 검수용 시제품입니다. 아직 구독자에게 발송되지 않았습니다.</p>
    </footer>
  </main>
</body>
</html>`;
}
