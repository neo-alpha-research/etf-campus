import { generateInstagramCarousel, generateInstagramCaption } from './src/templates/instagram';
import type { MarketBriefingPayload } from './src/types';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

const baseUrl = 'https://etf-campus.pages.dev';

function getChromeExecutablePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.platform === 'win32') {
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (process.platform === 'linux') {
    const linuxPaths = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (process.platform === 'darwin') {
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
    for (const p of macPaths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

interface PipelineCliOptions {
  date?: string;
  renderOnly?: boolean;
  syncOnly?: boolean;
  publish?: boolean;
}

function parseCliArgs(): PipelineCliOptions {
  const args = process.argv.slice(2);
  const opts: PipelineCliOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--date=')) {
      opts.date = arg.split('=')[1].trim();
    } else if (arg === '--render-only') {
      opts.renderOnly = true;
    } else if (arg === '--sync-only') {
      opts.syncOnly = true;
    } else if (arg === '--publish') {
      opts.publish = true;
    } else if (!arg.startsWith('--') && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
      opts.date = arg.trim();
    }
  }

  return opts;
}

function syncToKv(targetDate: string) {
  const repoRoot = process.cwd().endsWith("market-briefing-distributor")
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  const baseDir = path.join(repoRoot, "OSMU_Archive", targetDate).replace(/\\/g, '/');
  const distDir = path.join(repoRoot, "workers", "market-briefing-distributor");

  console.log(`[OSMU Pipeline] Syncing images to Cloudflare KV for date: ${targetDate}...`);

  for (let i = 1; i <= 6; i++) {
    const filePath = `${baseDir}/1_Instagram/instagram_slide_${i}.png`;
    const key = `image:instagram:${targetDate}:${i}`;
    console.log(`Uploading ${key}...`);
    execSync(`npx wrangler kv key put --binding=BRIEFING_KV --remote "${key}" --path="${filePath}"`, {
      cwd: distDir,
      stdio: 'inherit'
    });
  }

  const threadsPath = `${baseDir}/2_Threads/threads_image.png`;
  const threadsKey = `image:threads:${targetDate}`;
  console.log(`Uploading ${threadsKey}...`);
  execSync(`npx wrangler kv key put --binding=BRIEFING_KV --remote "${threadsKey}" --path="${threadsPath}"`, {
    cwd: distDir,
    stdio: 'inherit'
  });

  console.log('[OSMU Pipeline] All KV assets synchronized successfully.');
}

function deployWorker() {
  const repoRoot = process.cwd().endsWith("market-briefing-distributor")
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  const distDir = path.join(repoRoot, "workers", "market-briefing-distributor");

  console.log('[OSMU Pipeline] Deploying market-briefing-distributor worker...');
  execSync('npx wrangler deploy', {
    cwd: distDir,
    stdio: 'inherit'
  });
  console.log('[OSMU Pipeline] Worker deployed successfully.');
}

async function main() {
  const cliOpts = parseCliArgs();
  console.log('=====================================================');
  console.log('   ETF Campus Daily Market Briefing OSMU Pipeline   ');
  console.log('=====================================================');

  console.log(`[OSMU Render] Fetching live briefing payload...`);
  let raw: any = null;

  // 1. Primary SSOT: Local Repository Briefing Payload (Zero Network Delay, Anti-Stale)
  const repoRoot = process.cwd().endsWith("market-briefing-distributor")
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  const datePayloadPath = cliOpts.date ? path.join(repoRoot, "data", `briefing_payload_${cliOpts.date}.json`) : null;
  const latestPayloadPath = path.join(repoRoot, "data", "briefing_payload_latest.json");
  let localPayloadPath = (datePayloadPath && fs.existsSync(datePayloadPath)) ? datePayloadPath : latestPayloadPath;

  if (fs.existsSync(localPayloadPath)) {
    try {
      const localData = JSON.parse(fs.readFileSync(localPayloadPath, 'utf-8'));
      const candidate = localData.briefing || localData;
      if (!cliOpts.date || candidate.asOfDate === cliOpts.date) {
        raw = candidate;
        console.log(`✅ [OSMU Render] Loaded payload directly from Local Repository SSOT (${path.basename(localPayloadPath)}) for ${raw.asOfDate}!`);
      } else {
        console.log(`[OSMU Render] Local file ${path.basename(localPayloadPath)} date (${candidate.asOfDate}) does not match requested ${cliOpts.date}. Attempting local generation...`);
      }
    } catch (readErr) {
      console.warn('[OSMU Render] Error reading local payload:', readErr);
    }
  }

  // If local payload missing or date mismatched, generate it locally via SSOT builder
  if (!raw) {
    try {
      console.log('[OSMU Render] Generating local briefing payload from repository data...');
      const cmd = cliOpts.date ? `python scripts/build_local_briefing_payload.py --target-date=${cliOpts.date}` : `python scripts/build_local_briefing_payload.py`;
      execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });
      localPayloadPath = (datePayloadPath && fs.existsSync(datePayloadPath)) ? datePayloadPath : latestPayloadPath;
      if (fs.existsSync(localPayloadPath)) {
        const localData = JSON.parse(fs.readFileSync(localPayloadPath, 'utf-8'));
        const candidate = localData.briefing || localData;
        if (!cliOpts.date || candidate.asOfDate === cliOpts.date) {
          raw = candidate;
          console.log(`✅ [OSMU Render] Successfully generated and loaded payload via Local SSOT (${path.basename(localPayloadPath)}) for ${raw.asOfDate}!`);
        }
      }
    } catch (genErr) {
      console.warn('[OSMU Render] Local payload generation failed, falling back to remote APIs:', genErr);
    }
  }

  // 2. Remote Fallback 1: Distributor Worker API
  if (!raw) {
    console.log(`[OSMU Render] Falling back to Distributor Worker API...`);
    try {
      const workerUrl = `https://market-briefing-distributor.neo-alpha-research.workers.dev/api/briefings/latest${cliOpts.date ? `?date=${cliOpts.date}` : ''}`;
      const wRes = await fetch(workerUrl);
      if (wRes.ok) {
        const wData: any = await wRes.json();
        const candidate = wData.briefing || wData;
        if (candidate && (!cliOpts.date || candidate.asOfDate === cliOpts.date)) {
          raw = candidate;
          console.log(`[OSMU Render] Loaded payload from Distributor Worker for ${raw.asOfDate}`);
        }
      }
    } catch (e) {
      console.warn('[OSMU Render] Worker payload fetch warning:', e);
    }
  }

  // 3. Remote Fallback 2: Pages API
  if (!raw) {
    console.log(`[OSMU Render] Falling back to Pages API from ${baseUrl}...`);
    try {
      const pagesEndpoint = cliOpts.date
        ? `${baseUrl}/api/briefings/${cliOpts.date}?_t=${Date.now()}`
        : `${baseUrl}/api/briefings/latest?_t=${Date.now()}`;
      const res = await fetch(pagesEndpoint);
      if (res.ok) {
        const data: any = await res.json();
        const candidate = data.briefing || data;
        if (candidate && (!cliOpts.date || candidate.asOfDate === cliOpts.date)) {
          raw = candidate;
          console.log(`[OSMU Render] Loaded payload from Pages API for ${raw.asOfDate}`);
        }
      } else {
        console.warn(`[OSMU Render] Pages API responded with status ${res.status}`);
      }
    } catch (e) {
      console.warn('[OSMU Render] Pages API fetch failed:', e);
    }
  }

  if (!raw) {
    throw new Error('Failed to fetch or generate live briefing payload via all channels (Local SSOT, Worker, Pages).');
  }
  const targetDate = cliOpts.date || raw.asOfDate || new Date().toISOString().slice(0, 10);
  console.log(`[OSMU Pipeline] Target Market Date: ${targetDate}`);

  if (cliOpts.syncOnly) {
    syncToKv(targetDate);
    return;
  }
  const pulse = raw.pulse || {};
  const kospi = raw.marketIndices?.find((i: any) => i.code === 'KOSPI');
  const kosdaq = raw.marketIndices?.find((i: any) => i.code === 'KOSDAQ');

  const currentPayload: MarketBriefingPayload = {
    ...raw,
    asOfDate: cliOpts.date || raw.asOfDate || targetDate,
    headlineText: raw.headline?.text || raw.headlineText || '',
    marketTemperature: pulse.marketTemperature || raw.marketTemperature || '혼조',
    kospiClose: kospi?.close ?? raw.kospiClose ?? 0,
    kospiChangePct: kospi?.change_pct ?? raw.kospiChangePct ?? 0,
    kosdaqClose: kosdaq?.close ?? raw.kosdaqClose ?? 0,
    kosdaqChangePct: kosdaq?.change_pct ?? raw.kosdaqChangePct ?? 0,
    generalEtfCount: pulse.generalEtfCount ?? raw.generalEtfCount ?? 0,
    generalTotalAum: pulse.generalTotalAum ?? raw.generalTotalAum ?? 0,
    generalTotalTradeValue: pulse.generalTotalTradeValue ?? raw.generalTotalTradeValue ?? 0,
    generalAumWeightedReturnPct: pulse.generalAumWeightedReturnPct ?? raw.generalAumWeightedReturnPct ?? raw.general_aum_weighted_return_pct ?? 0,
    top50WeightedReturnPct: pulse.top50WeightedReturnPct ?? raw.top50WeightedReturnPct ?? 0,
    upCount: pulse.upCount ?? raw.upCount ?? 0,
    flatCount: pulse.flatCount ?? raw.flatCount ?? 0,
    downCount: pulse.downCount ?? raw.downCount ?? 0,
    breadthRatioPct: pulse.breadthRatioPct ?? raw.breadthRatioPct ?? 0,
    top10TradeSharePct: pulse.top10TradeSharePct ?? raw.top10TradeSharePct ?? 0,
    allTop10TradeSharePct: pulse.allTop10TradeSharePct ?? raw.allTop10TradeSharePct ?? 0,
    assetClasses: (raw.assetClasses || []).map((a: any) => ({
      assetClass: a.assetClass || a.asset_class,
      etfCount: a.etfCount || a.etf_count || 0,
      upCount: a.upCount || a.up_count || 0,
      flatCount: a.flatCount || a.flat_count || 0,
      downCount: a.downCount || a.down_count || 0,
      breadthRatioPct: a.breadthRatioPct ?? a.breadth_ratio_pct ?? 0,
      aumWeightedReturnPct: a.aumWeightedReturnPct ?? a.aum_weighted_return_pct ?? 0,
      totalAum: a.totalAum || a.total_aum || 0,
      aumSharePct: a.aumSharePct ?? a.aum_share_pct ?? 0,
      totalTradeValue: a.totalTradeValue || a.total_trade_value || 0,
      tradeSharePct: a.tradeSharePct ?? a.trade_share_pct ?? 0,
      ytdReturnPct: a.ytdReturnPct || 0,
    })),
    focusEtfs: raw.focusEtfs || [],
    peerGroups: raw.peerGroups || [],
    disparityWarning: raw.disparityWarning || [],
    periodicFlows: raw.periodicFlows || (raw.fundFlow?.general ? {
      dailyFundFlows: {
        topInflows: (raw.fundFlow.general.topInflows || []).map((f: any, idx: number) => ({
          rank: idx + 1,
          ticker: f.ticker,
          name: f.etfName,
          theme: f.theme || '핵심ETF',
          inflow: Math.round(f.netInflowValue / 100000000),
          changePct: 0
        })),
        topOutflows: (raw.fundFlow.general.topOutflows || []).map((f: any, idx: number) => ({
          rank: idx + 1,
          ticker: f.ticker,
          name: f.etfName,
          theme: f.theme || '핵심ETF',
          inflow: Math.round(f.netInflowValue / 100000000),
          changePct: 0
        }))
      }
    } : undefined),
  };

  let narrative: any = undefined;
  try {
    const distRes = await fetch(`https://market-briefing-distributor.neo-alpha-research.workers.dev/api/preview/instagram?fresh=1&date=${targetDate}`);
    if (distRes.ok) {
      const distData: any = await distRes.json();
      if (distData.narrative) {
        narrative = distData.narrative;
        console.log(`[OSMU Render] Using refined worker narrative: [${narrative.source}]`);
      }
    }
  } catch (e) {
    console.warn('[OSMU Render] Could not fetch worker narrative, using default logic:', e);
  }

  const slides = generateInstagramCarousel(currentPayload, baseUrl, narrative);
  console.log(`[OSMU Render] Generated ${slides.length} slides.`);

  const repoRoot = process.cwd().endsWith("market-briefing-distributor")
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  const osmuBaseDir = path.join(repoRoot, "OSMU_Archive");
  const outputDir = path.join(osmuBaseDir, targetDate, "1_Instagram");
  fs.mkdirSync(outputDir, { recursive: true });

  // Launch Chrome for Pixel-Perfect Chromium 2x Retina SVG Rendering
  let browser: any = null;
  let page: any = null;
  let renderEngine = 'Sharp (Fallback)';

  const chromePath = getChromeExecutablePath();
  const launchOptions: any = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none'
    ]
  };
  if (chromePath) {
    launchOptions.executablePath = chromePath;
    console.log(`[OSMU Render] Launching detected Chrome binary: ${chromePath}`);
  } else {
    console.log('[OSMU Render] No custom executablePath detected, trying Puppeteer bundled browser...');
  }

  try {
    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();
    // 2x Retina Scale Factor (2160x2700) for crystal-clear mobile and social viewing
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
    renderEngine = 'Chromium 2x Retina';
    console.log('[OSMU Render] Chromium 2x Retina engine initialized successfully.');
  } catch (e) {
    console.warn('[OSMU Render] Chromium launch failed, falling back to sharp:', e);
  }

  const renderSvg = async (svgStr: string, pngOutPath: string) => {
    if (page) {
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1350px; overflow: hidden; background: #F8FAFC; }
    svg { width: 1080px; height: 1350px; display: block; }
  </style>
</head>
<body>
${svgStr}
</body>
</html>`;
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      await page.evaluateHandle('document.fonts.ready');
      await page.screenshot({ path: pngOutPath, type: 'png', omitBackground: false });
    } else {
      await sharp(Buffer.from(svgStr)).resize(1080, 1350).png().toFile(pngOutPath);
    }
  };

  for (const s of slides) {
    const safeSvg = s.svgContent.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
    const svgPath = path.join(outputDir, `instagram_slide_${s.slideNumber}.svg`);
    const pngPath = path.join(outputDir, `instagram_slide_${s.slideNumber}.png`);

    fs.writeFileSync(svgPath, safeSvg, 'utf-8');
    await renderSvg(safeSvg, pngPath);
    const pngStats = fs.statSync(pngPath);
    console.log(`- Slide ${s.slideNumber}: [${s.title}] -> PNG ${pngStats.size.toLocaleString()} bytes (${renderEngine})`);
  }

  const caption = generateInstagramCaption(currentPayload, narrative).replace(/\r?\n/g, '\r\n');
  const captionBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(caption, 'utf-8')]);
  fs.writeFileSync(path.join(outputDir, 'instagram_caption.txt'), captionBuf);
  console.log('[OSMU Render] Caption saved successfully.');

  // Threads Infographic
  const { generateThreadsImageSvg } = await import('./src/templates/threads');
  const threadsSvg = generateThreadsImageSvg(currentPayload);
  const safeThreadsSvg = threadsSvg.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
  const threadsDir = path.join(osmuBaseDir, targetDate, "2_Threads");
  fs.mkdirSync(threadsDir, { recursive: true });
  const threadsSvgPath = path.join(threadsDir, 'threads_image.svg');
  const threadsPngPath = path.join(threadsDir, 'threads_image.png');
  fs.writeFileSync(threadsSvgPath, safeThreadsSvg, 'utf-8');
  await renderSvg(safeThreadsSvg, threadsPngPath);
  const threadsPngStats = fs.statSync(threadsPngPath);
  console.log(`- Threads Infographic -> PNG ${threadsPngStats.size.toLocaleString()} bytes (${renderEngine})`);

  // 3. Email Newsletter
  const { generateNewsletterHtml } = await import('./src/templates/newsletter');
  const newsletter = generateNewsletterHtml(currentPayload, baseUrl, narrative);
  const emailDir = path.join(osmuBaseDir, targetDate, "3_Email");
  fs.mkdirSync(emailDir, { recursive: true });
  fs.writeFileSync(path.join(emailDir, 'email_body.html'), newsletter.html, 'utf-8');
  fs.writeFileSync(path.join(emailDir, 'newsletter.html'), newsletter.html, 'utf-8');
  console.log(`- Email Newsletter -> HTML ${newsletter.html.length.toLocaleString()} bytes`);

  if (browser) {
    await browser.close();
  }

  if (cliOpts.renderOnly) {
    console.log('[OSMU Pipeline] ✅ Render completed (--render-only).');
    return;
  }

  // Auto sync to Cloudflare KV
  syncToKv(targetDate);

  // If --publish flag is set, automatically deploy worker
  if (cliOpts.publish) {
    deployWorker();
  }

  console.log(`\n[OSMU Pipeline] 🚀 All pipeline steps finished successfully for ${targetDate}!`);
}

main().catch(err => {
  console.error('[OSMU Render] Execution failed:', err);
  process.exit(1);
});
