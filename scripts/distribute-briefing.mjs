#!/usr/bin/env node
/**
 * scripts/distribute-briefing.mjs
 *
 * ETF Campus 마켓 브리핑 3개 채널(Threads, Newsletter, Instagram) 원클릭 동시 발행 CLI
 *
 * 사용법:
 *   node scripts/distribute-briefing.mjs [YYYY-MM-DD] [--force]
 *   npm run briefing:distribute -- [YYYY-MM-DD] [--force]
 *
 * 특징:
 * - 일자 미지정 시 data/etf_master_draft.csv 또는 OSMU_Archive에서 최신 일자 자동 감지
 * - Threads, Newsletter, Instagram 순차 호출 및 실시간 결과 리포트
 * - D1 및 KV 상태 동기화 및 링크 안내
 */

import fs from 'node:fs';
import path from 'node:path';

const DISTRIBUTOR_BASE_URL = process.env.DISTRIBUTOR_BASE_URL || 'https://market-briefing-distributor.neo-alpha-research.workers.dev';
const AUTH_TOKEN = process.env.MANUAL_RUN_TOKEN || process.env.INTERNAL_TOKEN || 'etf-campus-osmu-internal-2026';

function resolveTargetDate(inputDate) {
  if (inputDate && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
    return inputDate;
  }
  // 1. data/etf_master_draft.csv
  const masterPath = path.resolve('data/etf_master_draft.csv');
  if (fs.existsSync(masterPath)) {
    try {
      const content = fs.readFileSync(masterPath, 'utf-8');
      const lines = content.split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',');
        const basDtIdx = headers.findIndex(h => h.trim().replace(/"/g, '') === 'bas_dt');
        if (basDtIdx >= 0) {
          const firstRow = lines[1].split(',');
          const basDt = firstRow[basDtIdx]?.trim().replace(/"/g, '');
          if (basDt && basDt.length === 8) {
            return `${basDt.slice(0, 4)}-${basDt.slice(4, 6)}-${basDt.slice(6, 8)}`;
          }
        }
      }
    } catch (e) {}
  }
  // 2. OSMU_Archive latest dir
  const archivePath = path.resolve('OSMU_Archive');
  if (fs.existsSync(archivePath)) {
    const dirs = fs.readdirSync(archivePath).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
    if (dirs.length > 0) return dirs[0];
  }
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dateArg = args.find(a => !a.startsWith('--'));
  const targetDate = resolveTargetDate(dateArg);

  console.log(`=======================================================`);
  console.log(`🚀 [ETF CAMPUS] 마켓 브리핑 3대 채널 원클릭 동시 발행`);
  console.log(`- 기준 일자: ${targetDate}`);
  console.log(`- 엔드포인트: ${DISTRIBUTOR_BASE_URL}`);
  console.log(`- 강제 재발행(force): ${force}`);
  console.log(`=======================================================\n`);

  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'User-Agent': 'ETF-Campus-CLI-Distributor/1.0',
  };

  // 1. Threads
  console.log(`⏳ [1/3] 스레드(Threads) 발행 중...`);
  let threadsResult = null;
  try {
    const tUrl = `${DISTRIBUTOR_BASE_URL}/api/publish/threads?date=${targetDate}${force ? '&force=true' : ''}&token=${encodeURIComponent(AUTH_TOKEN)}`;
    const tRes = await fetch(tUrl, { method: 'POST', headers });
    threadsResult = await tRes.json();
    if (threadsResult.success) {
      console.log(`  ✅ Threads 발행 성공!`);
      console.log(`     - Post ID: ${threadsResult.publishedPostId}`);
      if (threadsResult.permalink) console.log(`     - Link: ${threadsResult.permalink}`);
    } else {
      console.warn(`  ⚠️ Threads 발행 응답: ${threadsResult.error || JSON.stringify(threadsResult)}`);
    }
  } catch (err) {
    console.error(`  ❌ Threads 발행 통신 실패:`, err.message);
  }

  // 2. Newsletter
  console.log(`\n⏳ [2/3] 이메일 뉴스레터(Newsletter) 배포 완료 처리 중...`);
  let newsletterResult = null;
  try {
    const nUrl = `${DISTRIBUTOR_BASE_URL}/api/publish/newsletter?date=${targetDate}&token=${encodeURIComponent(AUTH_TOKEN)}`;
    const nRes = await fetch(nUrl, { method: 'POST', headers });
    newsletterResult = await nRes.json();
    if (newsletterResult.success) {
      console.log(`  ✅ Newsletter 배포 준비 완료!`);
      console.log(`     - 제목: ${newsletterResult.subject}`);
      console.log(`     - 본문 크기: ${newsletterResult.htmlLength?.toLocaleString()} bytes`);
      console.log(`     - 웹 브리핑: ${newsletterResult.previewUrl}`);
    } else {
      console.warn(`  ⚠️ Newsletter 응답: ${newsletterResult.error || JSON.stringify(newsletterResult)}`);
    }
  } catch (err) {
    console.error(`  ❌ Newsletter 통신 실패:`, err.message);
  }

  // 3. Instagram Carousel
  console.log(`\n⏳ [3/3] 인스타그램 6장 캐러셀 발행 중 (약 15~25초 소요)...`);
  let instagramResult = null;
  try {
    const iUrl = `${DISTRIBUTOR_BASE_URL}/api/publish/instagram?date=${targetDate}&force=${force}&token=${encodeURIComponent(AUTH_TOKEN)}`;
    const iRes = await fetch(iUrl, { method: 'POST', headers });
    instagramResult = await iRes.json();
    if (instagramResult.success) {
      console.log(`  ✅ Instagram 캐러셀 발행 성공!`);
      console.log(`     - Post ID: ${instagramResult.publishedPostId}`);
      if (instagramResult.permalink) console.log(`     - Link: ${instagramResult.permalink}`);
    } else {
      console.warn(`  ⚠️ Instagram 발행 응답: ${instagramResult.error || JSON.stringify(instagramResult)}`);
    }
  } catch (err) {
    console.error(`  ❌ Instagram 발행 통신 실패:`, err.message);
  }

  console.log(`\n=======================================================`);
  console.log(`📊 [최종 발행 결과 리포트] (${targetDate})`);
  console.log(`- 스레드: ${threadsResult?.success ? '✅ 성공 (' + threadsResult.publishedPostId + ')' : (threadsResult?.error?.includes('이미') ? 'ℹ️ 기발행됨 (' + (threadsResult.publishedPostId || 'ID 확인') + ')' : '❌ 실패')}`);
  console.log(`- 뉴스레터: ${newsletterResult?.success ? '✅ 완료 (' + (newsletterResult.htmlLength || 0) + ' bytes)' : '❌ 실패'}`);
  console.log(`- 인스타그램: ${instagramResult?.success ? '✅ 성공 (' + instagramResult.publishedPostId + ')' : (instagramResult?.error?.includes('이미') ? 'ℹ️ 기발행됨 (' + (instagramResult.publishedPostId || 'ID 확인') + ')' : '❌ 실패')}`);
  console.log(`👉 대시보드 확인: ${DISTRIBUTOR_BASE_URL}/preview?date=${targetDate}&token=${AUTH_TOKEN}`);
  console.log(`=======================================================`);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
