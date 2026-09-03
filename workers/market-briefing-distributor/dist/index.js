var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/circuit-breaker.ts
function validateBriefingPayload(payload, env) {
  const reasons = [];
  const maxDisparity = Number(env.MAX_ALLOWED_DISPARITY_PCT || "5.0");
  const maxSpike = Number(env.MAX_ALLOWED_DAILY_SPIKE_PCT || "15.0");
  const pulse = payload.pulse || {};
  const generalEtfCount = payload.generalEtfCount ?? pulse.generalEtfCount;
  const generalTotalAum = payload.generalTotalAum ?? pulse.generalTotalAum;
  const upCount = payload.upCount ?? pulse.upCount ?? 0;
  const flatCount = payload.flatCount ?? pulse.flatCount ?? 0;
  const downCount = payload.downCount ?? pulse.downCount ?? 0;
  const kospiChangePct = payload.kospiChangePct ?? payload.marketIndices?.find((i) => i.code === "KOSPI")?.change_pct;
  const kosdaqChangePct = payload.kosdaqChangePct ?? payload.marketIndices?.find((i) => i.code === "KOSDAQ")?.change_pct;
  const generalAumWeightedReturnPct = pulse.generalAumWeightedReturnPct;
  if (!payload.asOfDate) {
    reasons.push("asOfDate(\uAE30\uC900\uC77C\uC790) \uB204\uB77D");
  }
  if (!generalEtfCount || generalEtfCount < 800) {
    reasons.push(`ETF \uC885\uBAA9 \uC218 \uBD80\uC871(\uD604\uC7AC: ${generalEtfCount}\uAC1C, \uCD5C\uC18C \uAE30\uC900: 800\uAC1C)`);
  }
  if (!generalTotalAum || generalTotalAum <= 0) {
    reasons.push("\uCD1D AUM \uC218\uCE58 \uC774\uC0C1 (0 \uB610\uB294 \uC74C\uC218)");
  }
  const totalCount = upCount + flatCount + downCount;
  if (totalCount === 0) {
    reasons.push("\uC2DC\uC7A5 \uCCB4\uC628 \uB4F1\uB77D \uC885\uBAA9 \uC218(\uC0C1\uC2B9/\uBCF4\uD569/\uD558\uB77D) \uD569\uACC4 0");
  }
  if (kospiChangePct === void 0 || kospiChangePct === null) {
    reasons.push("KOSPI \uB4F1\uB77D\uB960 \uB370\uC774\uD130 \uB204\uB77D");
  } else if (Math.abs(kospiChangePct) > maxSpike) {
    reasons.push(`KOSPI \uC77C\uAC04 \uB4F1\uB77D\uB960 \uC774\uC0C1 \uC2A4\uD30C\uC774\uD06C \uAC10\uC9C0 (${kospiChangePct}%, \uD5C8\uC6A9 \uD55C\uACC4: \xB1${maxSpike}%)`);
  }
  if (kosdaqChangePct === void 0 || kosdaqChangePct === null) {
    reasons.push("KOSDAQ \uB4F1\uB77D\uB960 \uB370\uC774\uD130 \uB204\uB77D");
  } else if (Math.abs(kosdaqChangePct) > maxSpike) {
    reasons.push(`KOSDAQ \uC77C\uAC04 \uB4F1\uB77D\uB960 \uC774\uC0C1 \uC2A4\uD30C\uC774\uD06C \uAC10\uC9C0 (${kosdaqChangePct}%, \uD5C8\uC6A9 \uD55C\uACC4: \xB1${maxSpike}%)`);
  }
  if (generalAumWeightedReturnPct === void 0 || generalAumWeightedReturnPct === null) {
    reasons.push("ETF \uD3C9\uADE0 \uB4F1\uB77D\uB960 \uB370\uC774\uD130 \uB204\uB77D");
  } else if (Math.abs(generalAumWeightedReturnPct) > maxSpike) {
    reasons.push(`ETF \uD3C9\uADE0 \uC77C\uAC04 \uB4F1\uB77D\uB960 \uC774\uC0C1 \uC2A4\uD30C\uC774\uD06C \uAC10\uC9C0 (${generalAumWeightedReturnPct}%, \uD5C8\uC6A9 \uD55C\uACC4: \xB1${maxSpike}%)`);
  }
  if (!payload.assetClasses && !payload.peerGroups) {
    reasons.push("\uC790\uC0B0\uAD70\uBCC4/\uD14C\uB9C8\uBCC4 \uC9D1\uACC4 \uB370\uC774\uD130(assetClasses/peerGroups) \uB204\uB77D");
  }
  return {
    isSafe: reasons.length === 0,
    reasons
  };
}
__name(validateBriefingPayload, "validateBriefingPayload");

// src/templates/instagram.ts
function escapeXml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
__name(escapeXml, "escapeXml");
function formatDateWithDay(dateStr) {
  if (!dateStr) return "2026.08.31 (\uC6D4)";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"];
  const dayName = days[date.getDay()] || "\uC6D4";
  return `${dateStr.replace(/-/g, ".")} (${dayName})`;
}
__name(formatDateWithDay, "formatDateWithDay");
function generateInstagramCarousel(payload, baseUrl) {
  const dateStr = payload.asOfDate || "2026-08-31";
  const formattedDate = formatDateWithDay(dateStr);
  const kospi = payload.kospiChangePct ?? 0.46;
  const kosdaq = payload.kosdaqChangePct ?? -0.49;
  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.28;
  const kospiSign = kospi > 0 ? "+" : "";
  const kosdaqSign = kosdaq > 0 ? "+" : "";
  const etfSign = etfReturn > 0 ? "+" : "";
  const kospiColor = kospi >= 0 ? "#D92D20" : "#175CD3";
  const kosdaqColor = kosdaq >= 0 ? "#D92D20" : "#175CD3";
  const etfColor = etfReturn >= 0 ? "#D92D20" : "#175CD3";
  const up = payload.upCount ?? 305;
  const down = payload.downCount ?? 670;
  const flat = payload.flatCount ?? 47;
  const generalCount = payload.generalEtfCount ?? 1022;
  const temp = payload.marketTemperature || "\uD558\uB77D \uC6B0\uC138";
  const sortedPeerGroups = [...payload.peerGroups || []].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const topTheme = sortedPeerGroups[0] || { peerGroup: "\uC5D0\uB108\uC9C0 (\uC6D0\uC720\xB7\uCC9C\uC5F0\uAC00\uC2A4)", cappedAumWeightedReturnPct: 2.95, etfCount: 5, assetClass: "\uC6D0\uC790\uC7AC" };
  const bottomTheme = sortedPeerGroups[sortedPeerGroups.length - 1] || { peerGroup: "\uC870\uC120 & \uD574\uC6B4", cappedAumWeightedReturnPct: -6.15, etfCount: 7, assetClass: "\uAD6D\uB0B4\uC8FC\uC2DD" };
  const themeGap = Math.abs((topTheme.cappedAumWeightedReturnPct ?? 0) - (bottomTheme.cappedAumWeightedReturnPct ?? 0)).toFixed(2);
  const winners = sortedPeerGroups.filter((p) => p.cappedAumWeightedReturnPct > 0).slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().filter((p) => p.cappedAumWeightedReturnPct < 0).slice(0, 3);
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const topInflow = topInflows[0] || { name: "\uB370\uC774\uD130 \uC218\uC9D1 \uC911", ticker: "-", inflow: 0, theme: "\uBBF8\uBD84\uB958" };
  const top5InflowSum = topInflows.slice(0, 5).reduce((sum, item) => sum + (item.inflow || 0), 0);
  const assetClasses = payload.assetClasses && payload.assetClasses.length > 0 ? payload.assetClasses : [];
  const commonDefs = `
    <defs>
      <filter id="softShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#0F172A" flood-opacity="0.06"/>
      </filter>
      <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.04"/>
      </filter>
      <linearGradient id="midnightNavyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#334155"/>
        <stop offset="100%" stop-color="#475569"/>
      </linearGradient>
      <linearGradient id="goldButtonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FEF9C3"/>
        <stop offset="100%" stop-color="#FEF08A"/>
      </linearGradient>
      <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#FEF08A" flood-opacity="0.2"/>
      </filter>
      <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#10B981"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
      <linearGradient id="heroSoftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F0FDF4"/>
        <stop offset="100%" stop-color="#DCFCE7"/>
      </linearGradient>
      <linearGradient id="ctaGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FEF08A"/>
        <stop offset="100%" stop-color="#FDE047"/>
      </linearGradient>
      <linearGradient id="blueBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#EFF6FF"/>
        <stop offset="100%" stop-color="#DBEAFE"/>
      </linearGradient>
      <linearGradient id="inflowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F2FDF5"/>
        <stop offset="100%" stop-color="#ECFDF5"/>
      </linearGradient>
      <pattern id="diagonalHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" stroke-width="2" stroke-opacity="0.3"/>
      </pattern>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800;900&amp;display=swap');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
      </style>
    </defs>
  `;
  const slide1Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="320" fill="#2E6819" fill-opacity="0.04"/>
      <circle cx="120" cy="1150" r="260" fill="#0284C7" fill-opacity="0.03"/>

      <!-- Header -->
      <g transform="translate(70, 70)">
        <text x="0" y="28" fill="#2E6819" font-size="15" font-weight="900" letter-spacing="1">STEP 1. TODAY'S MARKET</text>
        <text x="0" y="62" fill="#0F172A" font-size="32" font-weight="900">ETF \uB370\uC77C\uB9AC \uBE0C\uB9AC\uD551</text>
        <rect x="780" y="18" width="160" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="860" y="44" fill="#475569" font-size="17" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- Main Hero Card -->
      <g transform="translate(70, 140)" filter="url(#softShadow)">
        <rect width="940" height="925" rx="32" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        
        <rect x="40" y="32" width="280" height="34" rx="10" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1"/>
        <text x="55" y="55" fill="#334155" font-size="15" font-weight="800">KRX \uC0C1\uC7A5 \uC77C\uBC18 ETF ${generalCount}\uAC1C \uC804\uC218 \uBD84\uC11D</text>

        <!-- Hooking Headline (Factually Precise: Theme Return vs Smart Money Inflow) -->
        <g transform="translate(40, 115)">
          <text x="0" y="0" fill="#0F172A" font-size="46" font-weight="900" letter-spacing="-1">\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% vs ETF ${etfSign}${etfReturn.toFixed(2)}%</text>
          <text x="0" y="44" fill="#1D4ED8" font-size="27" font-weight="800" letter-spacing="-0.5">'${escapeXml(topTheme.peerGroup.replace(/\s*\([^)]*\)/g, ""))}' \uD14C\uB9C8 \uC0C1\uC2B9 \uC18D '\uAD6D\uB0B4 \uB300\uD45C\uC9C0\uC218'\uB85C \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC720\uC785 \u{1F50D}</text>
        </g>

        <line x1="40" y1="185" x2="900" y2="185" stroke="#F1F5F9" stroke-width="2"/>

        <!-- Pulse 1: Market Temperature -->
        <g transform="translate(40, 205)">
          <rect width="860" height="195" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="35" y="38" fill="#334155" font-size="20" font-weight="800">\u{1F321}\uFE0F 1. \uC2DC\uC7A5 \uCCB4\uC628 &amp; \uC9C0\uC218 \uB300\uBE44 \uC131\uACFC</text>
          
          <rect x="535" y="15" width="290" height="38" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="680" y="40" font-size="16" font-weight="900" text-anchor="middle">
            <tspan fill="#D92D20">\uC0C1\uC2B9 ${up}</tspan><tspan fill="#94A3B8"> \xB7 </tspan><tspan fill="#64748B">\uBCF4\uD569 ${flat}</tspan><tspan fill="#94A3B8"> \xB7 </tspan><tspan fill="#175CD3">\uD558\uB77D ${down}</tspan>
          </text>

          <g transform="translate(35, 95)">
            <text x="0" y="0" fill="#64748B" font-size="18" font-weight="700">KOSPI</text>
            <text x="70" y="0" fill="${kospiColor}" font-size="30" font-weight="900" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>
            
            <text x="215" y="-3" fill="#CBD5E1" font-size="24">|</text>
            
            <text x="240" y="0" fill="#64748B" font-size="18" font-weight="700">KOSDAQ</text>
            <text x="330" y="0" fill="${kosdaqColor}" font-size="30" font-weight="900" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>
            
            <text x="475" y="-3" fill="#CBD5E1" font-size="24">|</text>
            
            <text x="500" y="0" fill="#0F172A" font-size="18" font-weight="800">\uC77C\uBC18 ETF</text>
            <text x="590" y="0" fill="${etfColor}" font-size="30" font-weight="900" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
          </g>

          <text x="35" y="160" fill="#64748B" font-size="16" font-weight="700">\u{1F4A1} KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfReturn.toFixed(2)}% \xB7 \uC911\uC18C\uD615\uC8FC \uC870\uC815\uC73C\uB85C \uC9C0\uC218 \uB300\uBE44 \uC228\uACE0\uB974\uAE30</text>
        </g>

        <!-- Pulse 2: Long/Short Themes (2-Column Comparative Split Cards) -->
        <g transform="translate(40, 420)">
          <rect width="860" height="215" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="35" y="38" fill="#0F172A" font-size="20" font-weight="800">\u{1F525} 2. \uC624\uB298\uC758 \uADF9\uACFC \uADF9 \uD14C\uB9C8</text>
          
          <rect x="640" y="16" width="185" height="34" rx="10" fill="#FFF7ED" stroke="#FDBA74" stroke-width="1.2"/>
          <text x="732" y="39" fill="#C2410C" font-size="14" font-weight="900" text-anchor="middle">\uD14C\uB9C8 \uC628\uB3C4\uCC28 ${themeGap}%p \u26A1</text>

          <!-- Left: \uC0C1\uC2B9 1\uC704 \uCE74\uB4DC -->
          <g transform="translate(35, 60)">
            <rect width="380" height="100" rx="14" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1.2"/>
            <text x="20" y="34" fill="#B42318" font-size="14" font-weight="900">\uC0C1\uC2B9 1\uC704</text>
            <text x="20" y="68" fill="#0F172A" font-size="${topTheme.peerGroup.length > 14 ? 16 : topTheme.peerGroup.length > 11 ? 17.5 : 19}" font-weight="900">${escapeXml(topTheme.peerGroup)}</text>
            <text x="360" y="64" fill="#D92D20" font-size="26" font-weight="900" text-anchor="end" class="tabular">+${topTheme.cappedAumWeightedReturnPct.toFixed(2)}%</text>
          </g>

          <!-- Right: \uD558\uB77D 1\uC704 \uCE74\uB4DC -->
          <g transform="translate(445, 60)">
            <rect width="380" height="100" rx="14" fill="#EFF6FF" stroke="#93C5FD" stroke-width="1.2"/>
            <text x="20" y="34" fill="#175CD3" font-size="14" font-weight="900">\uD558\uB77D 1\uC704</text>
            <text x="20" y="68" fill="#0F172A" font-size="${bottomTheme.peerGroup.length > 14 ? 16 : bottomTheme.peerGroup.length > 11 ? 17.5 : 19}" font-weight="900">${escapeXml(bottomTheme.peerGroup)}</text>
            <text x="360" y="64" fill="#175CD3" font-size="26" font-weight="900" text-anchor="end" class="tabular">${bottomTheme.cappedAumWeightedReturnPct.toFixed(2)}%</text>
          </g>

          <text x="35" y="190" fill="#64748B" font-size="15" font-weight="700">\u{1F4A1} ${topTheme.peerGroup} +${topTheme.cappedAumWeightedReturnPct.toFixed(2)}% \uC120\uBC29 vs ${bottomTheme.peerGroup} ${bottomTheme.cappedAumWeightedReturnPct.toFixed(2)}% \uCC28\uC775 \uC2E4\uD604</text>
        </g>

        <!-- Pulse 3: Top Inflow -->
        <g transform="translate(40, 655)">
          <rect width="860" height="185" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="35" y="38" fill="#334155" font-size="20" font-weight="800">\u{1F3E6} 3. \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785 1\uC704</text>
          
          <rect x="685" y="16" width="140" height="34" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="755" y="39" fill="#1E293B" font-size="14" font-weight="900" text-anchor="middle">\uAE30\uAD00\xB7\uC678\uAD6D\uC778 \uD569\uC0B0</text>

          <text x="35" y="98" fill="#0F172A" font-size="30" font-weight="900">
            ${topInflow.name} <tspan fill="#D92D20" font-size="28" font-weight="900" class="tabular">(+${topInflow.inflow?.toLocaleString() || "1,130"}\uC5B5\uC6D0)</tspan>
          </text>

          <text x="35" y="148" fill="#64748B" font-size="16" font-weight="700">\u{1F4A1} \uC0C1\uC704 5\uC885\uBAA9 \uCD1D ${top5InflowSum.toLocaleString()}\uC5B5\uC6D0 \uC21C\uC720\uC785 \xB7 \uC0C1\uC138 \uC21C\uC704\uB294 4\uD398\uC774\uC9C0\uC5D0\uC11C \uD655\uC778</text>
        </g>
      </g>

      <!-- Bottom Swipe CTA -->
      <g transform="translate(70, 1095)">
        <rect width="940" height="88" rx="24" fill="url(#brandGrad)"/>
        <text x="470" y="54" fill="#FFFFFF" font-size="23" font-weight="900" text-anchor="middle" letter-spacing="-0.5">
          \uC606\uC73C\uB85C \uB118\uACA8 3\uBD84 \uB9CC\uC5D0 \uC624\uB298 \uC2DC\uC7A5 \uC644\uBCBD \uC815\uB9AC \u{1F449}
        </text>
        <rect x="805" y="24" width="90" height="40" rx="12" fill="#064E3B"/>
        <text x="850" y="50" fill="#A7F3D0" font-size="17" font-weight="900" text-anchor="middle" class="tabular">1 / 6</text>
      </g>

      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* \uBCF8 \uC790\uB8CC\uB294 \uD22C\uC790 \uD310\uB2E8\uC744 \uB3D5\uAE30 \uC704\uD55C \uC815\uBCF4 \uC81C\uACF5\uC6A9\uC774\uBA70, \uD2B9\uC815 \uC885\uBAA9\uC758 \uB9E4\uC218\xB7\uB9E4\uB3C4\uB97C \uAD8C\uC720\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF \uCEA0\uD37C\uC2A4 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;
  const slide2Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <g transform="translate(70, 75)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 2. THEME DYNAMICS</text>
        <text x="0" y="68" fill="#0F172A" font-size="34" font-weight="900">\uC624\uB298 \uC2DC\uC7A5 \uC8FC\uB3C4/\uBD80\uC9C4 \uD14C\uB9C8 TOP 3</text>
        <text x="0" y="98" fill="#64748B" font-size="16" font-weight="600">\u203B \uD14C\uB9C8\uBCC4 AUM \uAC00\uC911\uC218\uC775\uB960 \uAE30\uC900 \uC0C1\uC704/\uD558\uC704 \uB7AD\uD0B9</text>
        <rect x="830" y="20" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="47" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">2 / 6</text>
      </g>

      <!-- Summary Banner -->
      <g transform="translate(70, 190)" filter="url(#cardShadow)">
        <rect width="940" height="114" rx="22" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.5"/>
        <rect x="30" y="18" width="125" height="34" rx="10" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1.2"/>
        <text x="92" y="41" fill="#B45309" font-size="17" font-weight="900" text-anchor="middle">\u{1F525} \uD14C\uB9C8 \uD575\uC2EC</text>
        <text x="170" y="43" fill="#0F172A" font-size="30" font-weight="900">'${topTheme.peerGroup}' \uB3C5\uC8FC vs '${bottomTheme.peerGroup}' \uC870\uC815</text>
        <text x="30" y="88" fill="#334155" font-size="22" font-weight="700">
          \uD14C\uB9C8 \uAC04 \uC218\uC775\uB960 \uACA9\uCC28 <tspan fill="#B45309" font-weight="900">${themeGap}%p</tspan>\uB85C \uC8FC\uB3C4 \uC139\uD130\uC640 \uC18C\uC678 \uC139\uD130\uC758 \uB69C\uB837\uD55C \uCC28\uBCC4\uD654
        </text>
      </g>

      <!-- Panel 1: Top 3 Winners -->
      <g transform="translate(70, 315)" filter="url(#cardShadow)">
        <rect width="940" height="450" rx="26" fill="#FFFFFF" stroke="#FECDCA" stroke-width="1.5"/>
        <rect x="0" y="0" width="940" height="58" rx="26" fill="#FEF3F2"/>
        <text x="35" y="38" fill="#B42318" font-size="22" font-weight="900">\u{1F525} \uC624\uB298 \uC2DC\uC7A5\uC744 \uC774\uB048 TOP 3 \uC8FC\uB3C4 \uD14C\uB9C8 (\uC0C1\uC2B9 \uB7A0\uB9AC)</text>

        ${winners.map((w, idx) => `
          <g transform="translate(35, ${80 + idx * 115})">
            <rect width="870" height="102" rx="18" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
            <circle cx="45" cy="51" r="23" fill="${idx === 0 ? "#D92D20" : "#FEE4E2"}"/>
            <text x="45" y="59" fill="${idx === 0 ? "#FFFFFF" : "#D92D20"}" font-size="20" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="85" y="44" fill="#0F172A" font-size="28" font-weight="900">${w.peerGroup}</text>
            <text x="85" y="76" fill="#64748B" font-size="17" font-weight="600">\uCD1D ${w.etfCount}\uAC1C ETF \uAD6C\uC131 | \uC790\uC0B0\uAD70: ${w.assetClass || "\uAD6D\uB0B4\uC8FC\uC2DD"}</text>
            <text x="840" y="60" fill="#D92D20" font-size="38" font-weight="900" text-anchor="end" class="tabular">\u25B2 +${w.cappedAumWeightedReturnPct.toFixed(2)}%</text>
          </g>
        `).join("")}
      </g>

      <!-- Panel 2: Bottom 3 Losers -->
      <g transform="translate(70, 785)" filter="url(#cardShadow)">
        <rect width="940" height="450" rx="26" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.5"/>
        <rect x="0" y="0" width="940" height="58" rx="26" fill="#EFF6FF"/>
        <text x="35" y="38" fill="#1D4ED8" font-size="22" font-weight="900">\u2744\uFE0F \uCC28\uC775 \uC2E4\uD604 &amp; \uB9E4\uBB3C \uCD9C\uD68C BOTTOM 3 \uBD80\uC9C4 \uD14C\uB9C8</text>

        ${losers.map((l, idx) => `
          <g transform="translate(35, ${80 + idx * 115})">
            <rect width="870" height="102" rx="18" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
            <circle cx="45" cy="51" r="23" fill="${idx === 0 ? "#175CD3" : "#DBEAFE"}"/>
            <text x="45" y="59" fill="${idx === 0 ? "#FFFFFF" : "#175CD3"}" font-size="20" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="85" y="44" fill="#0F172A" font-size="28" font-weight="900">${l.peerGroup}</text>
            <text x="85" y="76" fill="#64748B" font-size="17" font-weight="600">\uCD1D ${l.etfCount}\uAC1C ETF \uAD6C\uC131 | \uC790\uC0B0\uAD70: ${l.assetClass || "\uD574\uC678\uC8FC\uC2DD"}</text>
            <text x="840" y="60" fill="#175CD3" font-size="38" font-weight="900" text-anchor="end" class="tabular">\u25BC ${l.cappedAumWeightedReturnPct.toFixed(2)}%</text>
          </g>
        `).join("")}
      </g>

      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* \uBCF8 \uC790\uB8CC\uB294 \uD22C\uC790 \uD310\uB2E8\uC744 \uB3D5\uAE30 \uC704\uD55C \uC815\uBCF4 \uC81C\uACF5\uC6A9\uC774\uBA70, \uD2B9\uC815 \uC885\uBAA9\uC758 \uB9E4\uC218\xB7\uB9E4\uB3C4\uB97C \uAD8C\uC720\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF \uCEA0\uD37C\uC2A4 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;
  const domesticStock = assetClasses.find((a) => a.assetClass?.includes("\uAD6D\uB0B4") || a.assetClass?.includes("\uC8FC\uC2DD-\uAD6D\uB0B4"));
  const domRet = domesticStock?.aumWeightedReturnPct ?? -0.12;
  const domShare = domesticStock?.aumSharePct ?? 46.1;
  const domSign = domRet > 0 ? "+" : "";
  const sortedByRet = [...assetClasses].sort((a, b) => (b.aumWeightedReturnPct ?? 0) - (a.aumWeightedReturnPct ?? 0));
  const topAsset = sortedByRet[0] || { assetClass: "\uD574\uC678\uC8FC\uC2DD", aumWeightedReturnPct: 0.09 };
  const botAsset = sortedByRet[sortedByRet.length - 1] || { assetClass: "\uB9AC\uCE20\xB7\uC778\uD504\uB77C", aumWeightedReturnPct: -0.72 };
  const topAssetSign = (topAsset.aumWeightedReturnPct ?? 0) > 0 ? "+" : "";
  const slide3Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <g transform="translate(70, 75)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 3. ASSET CLASS DYNAMICS</text>
        <text x="0" y="68" fill="#0F172A" font-size="34" font-weight="900">\uC790\uC0B0\uAD70\uBCC4 \uC218\uC775\uB960/\uAE30\uC5EC\uB3C4</text>
        <text x="0" y="96" fill="#64748B" font-size="16" font-weight="600">\u203B \uC790\uC0B0\uAD70\uBCC4 \uB2F9\uC77C \uAC00\uC911\uC218\uC775\uB960, \uC21C\uC790\uC0B0 \uBE44\uC911 \uBC0F \uC2DC\uC7A5 \uAE30\uC5EC\uB3C4 \uD604\uD669\uC785\uB2C8\uB2E4.</text>
        <rect x="830" y="20" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="47" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">3 / 6</text>
      </g>

      <!-- Summary Box (Data-Driven Dynamic) -->
      <g transform="translate(70, 190)" filter="url(#cardShadow)">
        <rect width="940" height="114" rx="22" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
        <rect x="30" y="18" width="135" height="34" rx="10" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.2"/>
        <text x="97" y="41" fill="#15803D" font-size="17" font-weight="900" text-anchor="middle">\u2696\uFE0F \uC790\uC0B0\uAD70 \uD575\uC2EC</text>
        <text x="180" y="43" fill="#0F172A" font-size="28" font-weight="900">'${topAsset.assetClass}' \uC0C1\uC2B9 \uC18D '${botAsset.assetClass}' \uC870\uC815</text>
        <text x="30" y="88" fill="#334155" font-size="21" font-weight="700">
          \uCD5C\uB300 \uBE44\uC911(${(domShare ?? 0).toFixed(1)}%) \uAD6D\uB0B4\uC8FC\uC2DD\uC740 <tspan fill="${domRet >= 0 ? "#15803D" : "#175CD3"}" font-weight="900">${domSign}${(domRet ?? 0).toFixed(2)}% \uC228\uACE0\uB974\uAE30</tspan>, ${topAsset.assetClass}(${topAssetSign}${(topAsset.aumWeightedReturnPct ?? 0).toFixed(2)}%)\uAC00 \uBC29\uC5B4
        </text>
      </g>

      <!-- 6 Asset Classes List -->
      <g transform="translate(70, 315)">
        ${assetClasses.slice(0, 6).map((ac, idx) => {
    const rawAum = ac.totalAum || 0;
    const aumEok = rawAum > 1e11 ? rawAum / 1e8 : rawAum;
    const aumJo = (aumEok / 1e4).toFixed(1);
    const ret = ac.aumWeightedReturnPct ?? 0;
    const retSign = ret > 0 ? "\u25B2 +" : ret < 0 ? "\u25BC " : "";
    const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
    const share = ac.aumSharePct ?? 0;
    const contribution = (share * ret / 100).toFixed(2);
    const contribSign = Number(contribution) > 0 ? "+" : "";
    return `
            <g transform="translate(0, ${idx * 155})" filter="url(#cardShadow)">
              <rect width="940" height="145" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
              <text x="35" y="48" fill="#0F172A" font-size="32" font-weight="900">${ac.assetClass}</text>
              <text x="35" y="85" fill="#334155" font-size="21" font-weight="700">
                \uC21C\uC790\uC0B0 <tspan font-weight="900" fill="#0F172A">${aumJo}\uC870\uC6D0</tspan> (\uBE44\uC911 <tspan font-weight="900" fill="#2E6819">${share.toFixed(1)}%</tspan>)
              </text>
              
              <rect x="35" y="105" width="380" height="12" rx="6" fill="#F1F5F9"/>
              <rect x="35" y="105" width="${Math.min(380, share * 3.8)}" height="12" rx="6" fill="#2E6819"/>
              
              <rect x="490" y="18" width="415" height="108" rx="16" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
              <text x="515" y="54" fill="#475569" font-size="20" font-weight="800">\uB2F9\uC77C \uAC00\uC911\uC218\uC775\uB960</text>
              <text x="880" y="56" fill="${retColor}" font-size="40" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
              
              <text x="515" y="96" fill="#64748B" font-size="18" font-weight="700">\uC2DC\uC7A5 \uAE30\uC5EC\uB3C4</text>
              <text x="880" y="98" fill="${retColor}" font-size="22" font-weight="900" text-anchor="end" class="tabular">${contribSign}${contribution}%p</text>
            </g>
          `;
  }).join("")}
      </g>

      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* \uBCF8 \uC790\uB8CC\uB294 \uD22C\uC790 \uD310\uB2E8\uC744 \uB3D5\uAE30 \uC704\uD55C \uC815\uBCF4 \uC81C\uACF5\uC6A9\uC774\uBA70, \uD2B9\uC815 \uC885\uBAA9\uC758 \uB9E4\uC218\xB7\uB9E4\uB3C4\uB97C \uAD8C\uC720\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF \uCEA0\uD37C\uC2A4 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;
  const slide4Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#D92D20" fill-opacity="0.035"/>
      <circle cx="100" cy="1150" r="260" fill="#BE123C" fill-opacity="0.03"/>

      <g transform="translate(70, 60)">
        <text x="0" y="30" fill="#D92D20" font-size="16" font-weight="900" letter-spacing="1">STEP 4. SMART MONEY FLOW</text>
        <text x="0" y="72" fill="#0F172A" font-size="38" font-weight="900">\uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785 TOP 5</text>
        <text x="0" y="100" fill="#64748B" font-size="16" font-weight="600">\u203B \uBC1C\uD589\uC88C\uC218 \uC99D\uAC10\uC73C\uB85C \uC0B0\uCD9C\uB41C \uAE30\uAD00\xB7\uC678\uAD6D\uC778\uC758 \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785\uC561</text>
        <rect x="830" y="18" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="45" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">4 / 6</text>
      </g>

      <!-- Summary Banner (Data-Driven Dynamic) -->
      <g transform="translate(70, 180)" filter="url(#cardShadow)">
        <rect width="940" height="94" rx="22" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.5"/>
        <rect x="30" y="15" width="125" height="34" rx="10" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1.2"/>
        <text x="92" y="38" fill="#BE123C" font-size="17" font-weight="900" text-anchor="middle">\u{1F4B8} \uC218\uAE09 \uD575\uC2EC</text>
        <text x="170" y="37" fill="#0F172A" font-size="27" font-weight="900">\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, '${topInflow.name}' \uBC0F '\uBBF8\uAD6D \uB300\uD45C\uC9C0\uC218' \uC9D1\uC911 \uC21C\uC720\uC785</text>
        <text x="30" y="75" fill="#334155" font-size="20" font-weight="700">
          \uB2E8\uAE30 \uC228\uACE0\uB974\uAE30 \uC18D\uC5D0\uC11C\uB3C4 <tspan fill="#D92D20" font-weight="900">\uC0C1\uC704 5\uC885\uBAA9\uC73C\uB85C \uCD1D ${top5InflowSum.toLocaleString()}\uC5B5\uC6D0</tspan> \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785
        </text>
      </g>

      <!-- TOP 5 Inflow Ranking Cards (Crimson Palette) -->
      <g transform="translate(70, 290)">
        ${topInflows.slice(0, 5).map((item, idx) => {
    const inflowJo = item.inflow ? item.inflow.toLocaleString() : "1,000";
    const isTop = idx === 0;
    return `
            <g transform="translate(0, ${idx * 180})" filter="url(#cardShadow)">
              <rect width="940" height="168" rx="22" fill="${isTop ? "#FFF8F8" : "#FFFFFF"}" stroke="${isTop ? "#FCA5A5" : "#E2E8F0"}" stroke-width="${isTop ? "2" : "1.5"}"/>
              ${isTop ? '<rect x="0" y="0" width="8" height="168" rx="4" fill="#D92D20"/>' : ""}

              <!-- \uC21C\uC704 \uBC43\uC9C0 -->
              <circle cx="58" cy="84" r="26" fill="${isTop ? "#D92D20" : "#F1F5F9"}" ${!isTop ? 'stroke="#E2E8F0" stroke-width="1.5"' : ""}/>
              <text x="58" y="93" fill="${isTop ? "#FFFFFF" : "#475569"}" font-size="22" font-weight="900" text-anchor="middle">${idx + 1}</text>

              <!-- ETF\uBA85 (\uB9D0\uC904\uC784 \uC5C6\uC774 \uD480\uB124\uC784 \uB178\uCD9C + \uB3D9\uC801 \uD3F0\uD2B8 \uC2A4\uCF00\uC77C\uB9C1) -->
              <text x="100" y="68" fill="#0F172A" font-size="${item.name.length > 22 ? 21 : item.name.length > 18 ? 23 : 26}" font-weight="900">${escapeXml(item.name)}</text>

              <!-- \uD2F0\uCEE4 -->
              <rect x="100" y="80" width="76" height="24" rx="6" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1"/>
              <text x="138" y="96" fill="#64748B" font-size="13" font-weight="700" text-anchor="middle" class="tabular">${item.ticker}</text>

              <!-- \uD14C\uB9C8 \uD0DC\uADF8 -->
              <rect x="186" y="80" width="115" height="24" rx="6" fill="${isTop ? "#FFE4E6" : "#F8FAFC"}" stroke="${isTop ? "#FDA4AF" : "#E2E8F0"}" stroke-width="1"/>
              <text x="243" y="96" fill="${isTop ? "#BE123C" : "#64748B"}" font-size="13" font-weight="800" text-anchor="middle">${item.theme || "\uD575\uC2ECETF"}</text>

              <!-- \uC21C\uC720\uC785 \uAE08\uC561 -->
              <text x="912" y="76" fill="${isTop ? "#D92D20" : "#1E293B"}" font-size="40" font-weight="900" text-anchor="end" class="tabular">+${inflowJo}<tspan font-size="22" font-weight="700" fill="${isTop ? "#BE123C" : "#64748B"}">\uC5B5\uC6D0</tspan></text>
              <text x="912" y="108" fill="${isTop ? "#E11D48" : "#64748B"}" font-size="15" font-weight="800" text-anchor="end">${isTop ? "\u{1F947} \uB2F9\uC77C \uCD5C\uB300 \uC2E4\uC9C8 \uC21C\uC720\uC785" : "\uC21C\uC720\uC785 \uC0C1\uC704 \uC885\uBAA9"}</text>
            </g>
          `;
  }).join("")}
      </g>

      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* \uBCF8 \uC790\uB8CC\uB294 \uD22C\uC790 \uD310\uB2E8\uC744 \uB3D5\uAE30 \uC704\uD55C \uC815\uBCF4 \uC81C\uACF5\uC6A9\uC774\uBA70, \uD2B9\uC815 \uC885\uBAA9\uC758 \uB9E4\uC218\xB7\uB9E4\uB3C4\uB97C \uAD8C\uC720\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF \uCEA0\uD37C\uC2A4 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;
  const disparityList = payload.disparityWarning && payload.disparityWarning.length > 0 ? payload.disparityWarning : [];
  const discounts = disparityList.filter((d) => d.disparityPct < 0);
  const premiums = disparityList.filter((d) => d.disparityPct > 0);
  let disparityHeaderTitle = "\uAD34\uB9AC\uC728 \uC800\uD3C9\uAC00(\uD560\uC778) \uCCB4\uD06C \uC885\uBAA9";
  let disparityBannerTag = "\u{1F7E2} \uC800\uD3C9\uAC00(\uD560\uC778) \uCCB4\uD06C";
  let disparityBannerTitle = `'${disparityList[0]?.etfName || "\uCC28\uC774\uB098\uACFC\uCC3D\uD310STAR50"}' \uB4F1 NAV \uB300\uBE44 \uD560\uC778 \uAC70\uB798`;
  let disparityBannerDesc = "\uBCF4\uC720\uC790\uB294 \uD5D0\uAC12 \uB9E4\uB3C4\uC5D0 \uC720\uC758\uD558\uACE0, \uB9E4\uC218\uC790\uB294 \uC2DC\uCC28 \uCC29\uC2DC \uC5EC\uBD80\uB97C \uD655\uC778\uD574\uC57C \uD569\uB2C8\uB2E4.";
  let disparityBannerTip = "LP \uC815\uC0C1 \uD638\uAC00 \uBCF5\uADC0 \uD655\uC778";
  if (disparityList.length === 0) {
    disparityHeaderTitle = "\uC804 \uC885\uBAA9 \uAD34\uB9AC\uC728 \uC815\uC0C1 (\uC2DC\uC7A5 \uC548\uC815 \uAD6C\uAC04)";
    disparityBannerTag = "\u2728 \uAD34\uB9AC\uC728 \uC548\uC815";
    disparityBannerTitle = "\uAD6D\uB0B4 \uC0C1\uC7A5 \uC77C\uBC18 ETF \uC804 \uC885\uBAA9 \uC815\uC0C1 \uAD34\uB9AC\uC728 \uBC94\uC704 \uC720\uC9C0";
    disparityBannerDesc = "\uC720\uB3D9\uC131\uACF5\uAE09\uC790(LP)\uC758 \uC6D0\uD65C\uD55C \uD638\uAC00 \uACF5\uAE09\uC73C\uB85C \uC548\uC815\uC801\uC778 \uAC00\uACA9\uC774 \uD615\uC131\uB418\uACE0 \uC788\uC2B5\uB2C8\uB2E4.";
    disparityBannerTip = "\uC804 \uC885\uBAA9 \uC815\uC0C1 \uAC70\uB798 \uC911";
  } else if (premiums.length > 0 && discounts.length === 0) {
    disparityHeaderTitle = "\uAD34\uB9AC\uC728 \uACE0\uD3C9\uAC00(\uD560\uC99D) \uC8FC\uC758 \uC885\uBAA9";
    disparityBannerTag = "\u{1F534} \uACE0\uD3C9\uAC00(\uD560\uC99D) \uC8FC\uC758";
    disparityBannerTitle = `'${disparityList[0]?.etfName}' \uB4F1 NAV \uB300\uBE44 \uBE44\uC2FC \uD560\uC99D \uC0C1\uD0DC`;
    disparityBannerDesc = "\uB2E8\uAE30 \uB9E4\uC218 \uACFC\uC5F4\uB85C \uC2DC\uC7A5\uAC00\uAC00 \uC2E4\uC81C \uAC00\uCE58\uBCF4\uB2E4 \uBE44\uC309\uB2C8\uB2E4. \uACE0\uC810 \uCD94\uACA9 \uB9E4\uC218\uC5D0 \uC720\uC758\uD558\uC138\uC694.";
    disparityBannerTip = "\uACE0\uC810 \uCD94\uACA9 \uB9E4\uC218 \uC720\uC758";
  } else if (premiums.length > 0 && discounts.length > 0) {
    disparityHeaderTitle = "\uAD34\uB9AC\uC728 \uAC00\uACA9 \uC65C\uACE1 \uC885\uBAA9 TOP 5";
    disparityBannerTag = "\u26A0\uFE0F \uC65C\uACE1 \uC8FC\uC758";
    disparityBannerTitle = `'${disparityList[0]?.etfName}' \uB4F1 \uD560\uC778/\uD560\uC99D \uC65C\uACE1 \uBC1C\uC0DD`;
    disparityBannerDesc = "\uD574\uC678 \uC2DC\uCC28 \uBC0F \uD638\uAC00 \uACF5\uBC31\uC73C\uB85C \uBC1C\uC0DD\uD55C \uAD34\uB9AC\uC728\uC785\uB2C8\uB2E4. \uAE09\uB4F1\uB77D \uCD94\uACA9 \uB9E4\uB9E4\uC5D0 \uC720\uC758\uD558\uC138\uC694.";
    disparityBannerTip = "\uC815\uC0C1 \uD638\uAC00 \uD655\uC778 \uD544\uC218";
  }
  const slide5Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#EAB308" fill-opacity="0.04"/>
      <circle cx="100" cy="1150" r="260" fill="#F59E0B" fill-opacity="0.035"/>

      <g transform="translate(70, 60)">
        <text x="0" y="30" fill="#B45309" font-size="16" font-weight="900" letter-spacing="1">STEP 5. DISPARITY ALERT</text>
        <text x="0" y="72" fill="#0F172A" font-size="36" font-weight="900">${disparityHeaderTitle}</text>
        <text x="0" y="100" fill="#64748B" font-size="16" font-weight="600">\u203B \uC21C\uC790\uC0B0\uAC00\uCE58(NAV) \uB300\uBE44 \uC2DC\uC7A5 \uC885\uAC00\uC758 \uAC00\uACA9 \uC65C\uACE1 \uC815\uB3C4\uB97C \uB098\uD0C0\uB0C5\uB2C8\uB2E4.</text>
        <rect x="830" y="18" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="45" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">5 / 6</text>
      </g>

      <!-- Alert Banner (Amber Warning Theme) -->
      <g transform="translate(70, 180)" filter="url(#cardShadow)">
        <rect width="940" height="94" rx="22" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.5"/>
        <rect x="30" y="15" width="160" height="34" rx="10" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1.2"/>
        <text x="110" y="38" fill="#B45309" font-size="16" font-weight="900" text-anchor="middle">${disparityBannerTag}</text>
        <text x="205" y="37" fill="#0F172A" font-size="26" font-weight="900">${disparityBannerTitle}</text>
        <text x="30" y="75" fill="#334155" font-size="19" font-weight="700">
          ${disparityBannerDesc} <tspan fill="#B45309" font-weight="900">${disparityBannerTip}</tspan>
        </text>
      </g>

      <!-- Disparity List Cards (Amber Yellow Alert Palette) -->
      <g transform="translate(70, 290)">
        ${disparityList.slice(0, 5).map((d, idx) => {
    const isDiscount = d.disparityPct < 0;
    const badgeBg = isDiscount ? "#DCFCE7" : "#FEF3C7";
    const badgeText = isDiscount ? "#15803D" : "#B45309";
    const label = isDiscount ? "\u{1F7E2} \uC800\uD3C9\uAC00 (Discount)" : "\u{1F534} \uACE0\uD3C9\uAC00 (Premium)";
    const sign = d.disparityPct > 0 ? "+" : "";
    const isTop = idx === 0;
    return `
            <g transform="translate(0, ${idx * 180})" filter="url(#cardShadow)">
              <rect width="940" height="168" rx="22" fill="${isTop ? "#FFFDF5" : "#FFFFFF"}" stroke="${isTop ? "#FCD34D" : "#E2E8F0"}" stroke-width="${isTop ? "2" : "1.5"}"/>
              ${isTop ? '<rect x="0" y="0" width="8" height="168" rx="4" fill="#D97706"/>' : ""}

              <!-- \uC21C\uC704 \uBC43\uC9C0 -->
              <circle cx="58" cy="84" r="26" fill="${isTop ? "#D97706" : "#FEF3C7"}" ${!isTop ? 'stroke="#FDE68A" stroke-width="1.2"' : ""}/>
              <text x="58" y="93" fill="${isTop ? "#FFFFFF" : "#B45309"}" font-size="22" font-weight="900" text-anchor="middle">${idx + 1}</text>

              <!-- ETF\uBA85 (\uB9D0\uC904\uC784 \uC5C6\uC774 \uD480\uB124\uC784 \uB178\uCD9C + \uB3D9\uC801 \uD3F0\uD2B8 \uC2A4\uCF00\uC77C\uB9C1) -->
              <text x="100" y="68" fill="#0F172A" font-size="${d.etfName.length > 22 ? 21 : d.etfName.length > 18 ? 23 : 26}" font-weight="900">${escapeXml(d.etfName)}</text>

              <!-- \uD2F0\uCEE4 -->
              <rect x="100" y="80" width="76" height="24" rx="6" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1"/>
              <text x="138" y="96" fill="#64748B" font-size="13" font-weight="700" text-anchor="middle" class="tabular">${d.ticker}</text>

              <!-- \uC800/\uACE0\uD3C9\uAC00 \uB77C\uBCA8 -->
              <rect x="186" y="80" width="170" height="24" rx="7" fill="${badgeBg}" stroke="${isDiscount ? "#BBF7D0" : "#FDE68A"}" stroke-width="1"/>
              <text x="271" y="96" fill="${badgeText}" font-size="13" font-weight="800" text-anchor="middle">${label}</text>

              <!-- \uAD34\uB9AC\uC728 \uC218\uCE58 -->
              <text x="912" y="76" fill="${badgeText}" font-size="40" font-weight="900" text-anchor="end" class="tabular">${sign}${(d.disparityPct ?? 0).toFixed(2)}%</text>
              <text x="912" y="108" fill="#64748B" font-size="15" font-weight="700" text-anchor="end">NAV \uB300\uBE44 \uC2DC\uC7A5 \uAD34\uB9AC\uC728</text>
            </g>
          `;
  }).join("")}
      </g>

      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* \uBCF8 \uC790\uB8CC\uB294 \uD22C\uC790 \uD310\uB2E8\uC744 \uB3D5\uAE30 \uC704\uD55C \uC815\uBCF4 \uC81C\uACF5\uC6A9\uC774\uBA70, \uD2B9\uC815 \uC885\uBAA9\uC758 \uB9E4\uC218\xB7\uB9E4\uB3C4\uB97C \uAD8C\uC720\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF \uCEA0\uD37C\uC2A4 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;
  const dateNum = parseInt(dateStr.slice(-1), 10) || 1;
  const ctaMap = {
    0: { icon: "\u2696\uFE0F", title: "ETF \uC644\uBCBD \uBE44\uAD50 (\uCD1D\uBCF4\uC218/\uAD34\uB9AC\uC728)", sub1: "\uAC19\uC740 \uC9C0\uC218\uB77C\uB3C4 \uC6B4\uC6A9\uC0AC\uB9C8\uB2E4 \uCD1D\uBCF4\uC218\uC640 \uAD34\uB9AC\uC728\uC774 \uB2E4\uB985\uB2C8\uB2E4.", sub2: "\uD504\uB85C\uD544 \uB9C1\uD06C\uC5D0\uC11C \uB0B4 \uACC4\uC88C ETF\uB97C 1\uCD08 \uB9CC\uC5D0 \uBE44\uAD50\uD574 \uBCF4\uC138\uC694.", highlight: "ETF \uC644\uBCBD \uBE44\uAD50" },
    1: { icon: "\u{1F50D}", title: "\uB0B4 \uC5F0\uAE08\xB7ISA \uACC4\uC88C\uC6A9 \uB9DE\uCDA4 ETF \uD0D0\uC0C9", sub1: "\uC77C\uBC18\xB7\uC5F0\uAE08 \uACC4\uC88C, \uC790\uC0B0\uAD70, \uBD84\uBC30\uAE08 \uC870\uAC74\uBCC4 ETF \uC2A4\uD06C\uB9AC\uB2DD", sub2: "\uC548\uC804\uD558\uACE0 \uD6A8\uC728\uC801\uC778 \uC808\uC138 \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uB97C \uAD6C\uC131\uD574 \uBCF4\uC138\uC694.", highlight: "\uB9DE\uCDA4 ETF \uD0D0\uC0C9" },
    2: { icon: "\u{1F4C8}", title: "ETF \uD14C\uB9C8 \uBC0F \uC885\uBAA9\uBCC4 \uC0C1\uC138 \uBD84\uC11D", sub1: "\uD14C\uB9C8\uBCC4 \uC21C\uC790\uC0B0 \uADDC\uBAA8\uC640 \uAC70\uB798\uB300\uAE08, \uAD6C\uC131\uC885\uBAA9 \uC815\uBC00 \uBD84\uC11D", sub2: "\uD504\uB85C\uD544 \uB9C1\uD06C\uC5D0\uC11C \uC2DC\uC7A5 \uC8FC\uB3C4 ETF\uC758 \uC138\uBD80 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uC138\uC694.", highlight: "ETF \uC0C1\uC138 \uBD84\uC11D" },
    3: { icon: "\u2696\uFE0F", title: "ETF \uC644\uBCBD \uBE44\uAD50 (\uCD1D\uBCF4\uC218/\uAD34\uB9AC\uC728)", sub1: "\uAC19\uC740 \uC9C0\uC218\uB77C\uB3C4 \uC6B4\uC6A9\uC0AC\uB9C8\uB2E4 \uCD1D\uBCF4\uC218\uC640 \uAD34\uB9AC\uC728\uC774 \uB2E4\uB985\uB2C8\uB2E4.", sub2: "\uD504\uB85C\uD544 \uB9C1\uD06C\uC5D0\uC11C \uB0B4 \uACC4\uC88C ETF\uB97C 1\uCD08 \uB9CC\uC5D0 \uBE44\uAD50\uD574 \uBCF4\uC138\uC694.", highlight: "ETF \uC644\uBCBD \uBE44\uAD50" },
    4: { icon: "\u{1F50D}", title: "\uB0B4 \uC5F0\uAE08\xB7ISA \uACC4\uC88C\uC6A9 \uB9DE\uCDA4 ETF \uD0D0\uC0C9", sub1: "\uC77C\uBC18\xB7\uC5F0\uAE08 \uACC4\uC88C, \uC790\uC0B0\uAD70, \uBD84\uBC30\uAE08 \uC870\uAC74\uBCC4 ETF \uC2A4\uD06C\uB9AC\uB2DD", sub2: "\uC548\uC804\uD558\uACE0 \uD6A8\uC728\uC801\uC778 \uC808\uC138 \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uB97C \uAD6C\uC131\uD574 \uBCF4\uC138\uC694.", highlight: "\uB9DE\uCDA4 ETF \uD0D0\uC0C9" },
    5: { icon: "\u{1F4C8}", title: "ETF \uD14C\uB9C8 \uBC0F \uC885\uBAA9\uBCC4 \uC0C1\uC138 \uBD84\uC11D", sub1: "\uD14C\uB9C8\uBCC4 \uC21C\uC790\uC0B0 \uADDC\uBAA8\uC640 \uAC70\uB798\uB300\uAE08, \uAD6C\uC131\uC885\uBAA9 \uC815\uBC00 \uBD84\uC11D", sub2: "\uD504\uB85C\uD544 \uB9C1\uD06C\uC5D0\uC11C \uC2DC\uC7A5 \uC8FC\uB3C4 ETF\uC758 \uC138\uBD80 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uC138\uC694.", highlight: "ETF \uC0C1\uC138 \uBD84\uC11D" },
    6: { icon: "\u2696\uFE0F", title: "ETF \uC644\uBCBD \uBE44\uAD50 (\uCD1D\uBCF4\uC218/\uAD34\uB9AC\uC728)", sub1: "\uAC19\uC740 \uC9C0\uC218\uB77C\uB3C4 \uC6B4\uC6A9\uC0AC\uB9C8\uB2E4 \uCD1D\uBCF4\uC218\uC640 \uAD34\uB9AC\uC728\uC774 \uB2E4\uB985\uB2C8\uB2E4.", sub2: "\uD504\uB85C\uD544 \uB9C1\uD06C\uC5D0\uC11C \uB0B4 \uACC4\uC88C ETF\uB97C 1\uCD08 \uB9CC\uC5D0 \uBE44\uAD50\uD574 \uBCF4\uC138\uC694.", highlight: "ETF \uC644\uBCBD \uBE44\uAD50" },
    7: { icon: "\u{1F50D}", title: "\uB0B4 \uC5F0\uAE08\xB7ISA \uACC4\uC88C\uC6A9 \uB9DE\uCDA4 ETF \uD0D0\uC0C9", sub1: "\uC77C\uBC18\xB7\uC5F0\uAE08 \uACC4\uC88C, \uC790\uC0B0\uAD70, \uBD84\uBC30\uAE08 \uC870\uAC74\uBCC4 ETF \uC2A4\uD06C\uB9AC\uB2DD", sub2: "\uC548\uC804\uD558\uACE0 \uD6A8\uC728\uC801\uC778 \uC808\uC138 \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uB97C \uAD6C\uC131\uD574 \uBCF4\uC138\uC694.", highlight: "\uB9DE\uCDA4 ETF \uD0D0\uC0C9" },
    8: { icon: "\u{1F4C8}", title: "ETF \uD14C\uB9C8 \uBC0F \uC885\uBAA9\uBCC4 \uC0C1\uC138 \uBD84\uC11D", sub1: "\uD14C\uB9C8\uBCC4 \uC21C\uC790\uC0B0 \uADDC\uBAA8\uC640 \uAC70\uB798\uB300\uAE08, \uAD6C\uC131\uC885\uBAA9 \uC815\uBC00 \uBD84\uC11D", sub2: "\uD504\uB85C\uD544 \uB9C1\uD06C\uC5D0\uC11C \uC2DC\uC7A5 \uC8FC\uB3C4 ETF\uC758 \uC138\uBD80 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uC138\uC694.", highlight: "ETF \uC0C1\uC138 \uBD84\uC11D" },
    9: { icon: "\u2696\uFE0F", title: "ETF \uC644\uBCBD \uBE44\uAD50 (\uCD1D\uBCF4\uC218/\uAD34\uB9AC\uC728)", sub1: "\uAC19\uC740 \uC9C0\uC218\uB77C\uB3C4 \uC6B4\uC6A9\uC0AC\uB9C8\uB2E4 \uCD1D\uBCF4\uC218\uC640 \uAD34\uB9AC\uC728\uC774 \uB2E4\uB985\uB2C8\uB2E4.", sub2: "\uD504\uB85C\uD544 \uB9C1\uD06C\uC5D0\uC11C \uB0B4 \uACC4\uC88C ETF\uB97C 1\uCD08 \uB9CC\uC5D0 \uBE44\uAD50\uD574 \uBCF4\uC138\uC694.", highlight: "ETF \uC644\uBCBD \uBE44\uAD50" }
  };
  const activeCta = ctaMap[dateNum] || ctaMap[1];
  const slide6Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#2E6819" fill-opacity="0.04"/>
      <circle cx="100" cy="1150" r="260" fill="#10B981" fill-opacity="0.03"/>

      <!-- Header -->
      <g transform="translate(70, 55)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 6. SUMMARY &amp; NEXT ACTION</text>
        <text x="0" y="72" fill="#0F172A" font-size="38" font-weight="900">\uC624\uB298 \uC2DC\uC7A5 \uCD1D\uC815\uB9AC &amp; \uB0B4 ETF \uC9C4\uB2E8</text>
        <rect x="830" y="18" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="45" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">6 / 6</text>
      </g>

      <!-- 1. 3-Bullet Market Summary Card (Expanded & High Readability) -->
      <g transform="translate(70, 155)" filter="url(#cardShadow)">
        <rect width="940" height="540" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <!-- Block 1 -->
        <g transform="translate(25, 22)">
          <rect width="890" height="150" rx="20" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="1.2"/>
          <rect x="24" y="22" width="52" height="34" rx="9" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1"/>
          <text x="50" y="46" fill="#15803D" font-size="20" font-weight="900" font-family="monospace" text-anchor="middle">01</text>
          
          <text x="90" y="48" fill="#0F172A" font-size="28" font-weight="900">\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfReturn.toFixed(2)}% \uD63C\uC870\uC138</text>
          <text x="24" y="104" fill="#334155" font-size="20" font-weight="700">\uAD6D\uB0B4 \uB300\uD615\uC8FC \uC9C0\uC9C0 \uC18D \uC77C\uBC18 ETF\uB294 \uC0C1\uC2B9 ${up}\uAC1C \xB7 \uBCF4\uD569 ${flat}\uAC1C \xB7 \uD558\uB77D ${down}\uAC1C\uB85C \uC18C\uD3ED \uC57D\uC138 \uD750\uB984.</text>
        </g>

        <!-- Block 2 -->
        <g transform="translate(25, 192)">
          <rect width="890" height="150" rx="20" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.2"/>
          <rect x="24" y="22" width="52" height="34" rx="9" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1"/>
          <text x="50" y="46" fill="#BE123C" font-size="20" font-weight="900" font-family="monospace" text-anchor="middle">02</text>
          
          <text x="90" y="48" fill="#0F172A" font-size="28" font-weight="900">'${topTheme.peerGroup}' \uBC18\uB4F1 vs '${bottomTheme.peerGroup}' \uCC28\uC775\uC2E4\uD604</text>
          <text x="24" y="104" fill="#334155" font-size="21" font-weight="700">\uC8FC\uB3C4 \uD14C\uB9C8 \uAC04 \uC218\uC775\uB960 \uACA9\uCC28\uAC00 ${themeGap}%p\uAE4C\uC9C0 \uBC8C\uC5B4\uC9C0\uB294 \uAC15\uD55C \uC139\uD130 \uB85C\uD14C\uC774\uC158 \uC804\uAC1C.</text>
        </g>

        <!-- Block 3 -->
        <g transform="translate(25, 362)">
          <rect width="890" height="150" rx="20" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
          <rect x="24" y="22" width="52" height="34" rx="9" fill="#DBEAFE" stroke="#93C5FD" stroke-width="1"/>
          <text x="50" y="46" fill="#1D4ED8" font-size="20" font-weight="900" font-family="monospace" text-anchor="middle">03</text>
          
          <text x="90" y="48" fill="#0F172A" font-size="25" font-weight="900">\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, '${topInflow.name}' +${topInflow.inflow ? topInflow.inflow.toLocaleString() : "1,130"}\uC5B5\uC6D0 \uC9D1\uC911 \uC21C\uC720\uC785</text>
          <text x="24" y="104" fill="#334155" font-size="21" font-weight="700">\uAD6D\uB0B4 \uB300\uD45C\uC9C0\uC218(KODEX 200) \uBC0F \uBBF8\uAD6D \uB300\uD45C\uC9C0\uC218 \uBD84\uD560 \uB9E4\uC218 \uC790\uAE08 \uC720\uC785 \uC9D1\uC911.</text>
        </g>
      </g>

      <!-- 2. Grand Hero CTA Card (Soft Slate Navy & Gentle Butter Pastel Gold) -->
      <g transform="translate(70, 720)" filter="url(#softShadow)">
        <rect width="940" height="510" rx="30" fill="url(#midnightNavyGrad)" stroke="#64748B" stroke-width="1.5"/>
        <circle cx="850" cy="100" r="180" fill="#38BDF8" fill-opacity="0.06"/>
        <circle cx="120" cy="420" r="150" fill="#FEF08A" fill-opacity="0.04"/>
        
        <g transform="translate(0, 0)">
          <!-- Top Mini Tag (Larger & More Prominent) -->
          <rect x="270" y="32" width="400" height="48" rx="24" fill="#475569" stroke="#64748B" stroke-width="1.2"/>
          <text x="470" y="63" fill="#FEF08A" font-size="21" font-weight="900" text-anchor="middle">\u{1F4A1} 100% \uBB34\uB8CC ETF \uC2DC\uD669 &amp; \uB9C8\uCF13 \uBE0C\uB9AC\uD551</text>
          
          <!-- Main Action Headline -->
          <text x="470" y="136" fill="#FFFFFF" font-size="36" font-weight="900" text-anchor="middle" letter-spacing="-0.8">
            \uB0B4 \uACC4\uC88C \uC18D ETF, \uC9C0\uAE08 \uBC14\uB85C \uBE44\uAD50\uD574 \uBCF4\uC138\uC694!
          </text>

          <!-- 3 Value Props (Left-Aligned Starting at x=175, Font Size 24px) -->
          <g transform="translate(0, 152)">
            <text x="175" y="40" fill="#E2E8F0" font-size="24" font-weight="700" text-anchor="start">
              \u2728  <tspan font-weight="900" fill="#FFFFFF">1,022\uAC1C \uC77C\uBC18 ETF</tspan> \uCD1D\uBCF4\uC218 &amp; \uAD34\uB9AC\uC728 1\uCD08 \uC644\uBCBD \uBE44\uAD50
            </text>
            <text x="175" y="82" fill="#E2E8F0" font-size="24" font-weight="700" text-anchor="start">
              \u2728  \uC8FC\uB3C4 \uD14C\uB9C8\uBCC4 \uB4F1\uB77D \uB3D9\uD5A5\uBD80\uD130 \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC790\uAE08 \uC720\uC785\uAE4C\uC9C0
            </text>
            <text x="175" y="124" fill="#E2E8F0" font-size="24" font-weight="700" text-anchor="start">
              \u2728  \uB9E4\uC77C \uC544\uCE68 \uC5C5\uB370\uC774\uD2B8\uB418\uB294 \uAE30\uAD00\xB7\uC678\uAD6D\uC778 \uC218\uAE09 \uC804\uC218 \uBD84\uC11D
            </text>
          </g>

          <!-- Big Action Button (Soft Gentle Butter Pastel Gold Gradient) -->
          <g transform="translate(100, 325)">
            <rect width="740" height="92" rx="26" fill="url(#goldButtonGrad)" stroke="#FDE047" stroke-width="1.5" filter="url(#goldGlow)"/>
            <text x="370" y="58" fill="#78350F" font-size="30" font-weight="900" text-anchor="middle" letter-spacing="-0.5">
              \u{1F449} \uD504\uB85C\uD544 \uB9C1\uD06C 'ETF \uCEA0\uD37C\uC2A4' \uBC14\uB85C\uAC00\uAE30 \u{1F517}
            </text>
          </g>

          <!-- Sub Guarantee (Crisp Silver Slate) -->
          <text x="470" y="464" fill="#CBD5E1" font-size="20" font-weight="800" text-anchor="middle">
            \uBCC4\uB3C4 \uAC00\uC785 \uC5C6\uC774 \uD504\uB85C\uD544 \uB9C1\uD06C\uC5D0\uC11C \uB204\uAD6C\uB098 \uC989\uC2DC \uBB34\uB8CC\uB85C \uD655\uC778\uD558\uC2E4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.
          </text>
        </g>
      </g>

      <!-- Footer Disclaimer -->
      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* \uBCF8 \uC790\uB8CC\uB294 \uD22C\uC790 \uD310\uB2E8\uC744 \uB3D5\uAE30 \uC704\uD55C \uC815\uBCF4 \uC81C\uACF5\uC6A9\uC774\uBA70, \uD2B9\uC815 \uC885\uBAA9\uC758 \uB9E4\uC218\xB7\uB9E4\uB3C4\uB97C \uAD8C\uC720\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF \uCEA0\uD37C\uC2A4 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;
  return [
    { slideNumber: 1, title: "Cover", subtitle: "1\uCD08 \uD6C4\uD0B9 \uD45C\uC9C0 & 3\uB300 \uD575\uC2EC \uD384\uC2A4", svgContent: slide1Svg },
    { slideNumber: 2, title: "Theme Dynamics", subtitle: "\uC8FC\uB3C4 \uD14C\uB9C8 TOP 3 vs \uBD80\uC9C4 \uD14C\uB9C8", svgContent: slide2Svg },
    { slideNumber: 3, title: "Asset Class Dynamics", subtitle: "\uC790\uC0B0\uAD70\uBCC4 \uC218\uC775\uB960/\uAE30\uC5EC\uB3C4", svgContent: slide3Svg },
    { slideNumber: 4, title: "Smart Money Flow", subtitle: "\uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785 TOP 5", svgContent: slide4Svg },
    { slideNumber: 5, title: "Disparity Alert", subtitle: "\uAD34\uB9AC\uC728 \uACE0\uD3C9\uAC00/\uC800\uD3C9\uAC00 TOP 3", svgContent: slide5Svg },
    { slideNumber: 6, title: "Summary & Action", subtitle: "\uC624\uB298 \uC2DC\uC7A5 3\uB300 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 & \uC644\uBCBD \uBE44\uAD50", svgContent: slide6Svg }
  ];
}
__name(generateInstagramCarousel, "generateInstagramCarousel");

// src/templates/newsletter.ts
function normalizeToEok(val) {
  if (!val) return 0;
  const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : val;
  if (isNaN(num)) return 0;
  if (num > 1e10) {
    return Math.round(num / 1e8);
  }
  return Math.round(num);
}
__name(normalizeToEok, "normalizeToEok");
function escapeXml2(unsafe) {
  if (!unsafe) return "";
  return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
__name(escapeXml2, "escapeXml");
function generateNewsletterHtml(payload, baseUrl) {
  const dateStr = payload.asOfDate || "2026-08-31";
  const formattedDate = dateStr.replace(/-/g, ".");
  const temp = payload.marketTemperature || "\uD558\uB77D \uC6B0\uC138";
  const kospiClose = payload.kospiClose || 2600;
  const kospiChangePct = payload.kospiChangePct ?? 0.46;
  const kospiColor = kospiChangePct >= 0 ? "#DC2626" : "#2563EB";
  const kospiSign = kospiChangePct > 0 ? "+" : "";
  const kosdaqChangePct = payload.kosdaqChangePct ?? -0.49;
  const kosdaqColor = kosdaqChangePct >= 0 ? "#DC2626" : "#2563EB";
  const kosdaqSign = kosdaqChangePct > 0 ? "+" : "";
  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.28;
  const etfSign = etfReturn > 0 ? "+" : "";
  const etfColor = etfReturn >= 0 ? "#DC2626" : "#2563EB";
  const totalAumEok = normalizeToEok(payload.marketScaleSnapshot?.totalAum || payload.pulse?.generalTotalAum || payload.generalTotalAum || 3814729);
  const totalTradeEok = normalizeToEok(payload.marketScaleSnapshot?.totalTradeValue || payload.pulse?.generalTotalTradeValue || payload.generalTotalTradeValue || 100551);
  const aumJo = (totalAumEok / 1e4).toFixed(1);
  const tradeJo = (totalTradeEok / 1e4).toFixed(1);
  const turnoverPct = totalAumEok > 0 ? totalTradeEok / totalAumEok * 100 : payload.marketScaleSnapshot?.marketTurnoverPct ?? payload.marketTurnoverPct ?? 2.64;
  const totalEtfCount = payload.pulse?.totalEtfCount || 0;
  const up = payload.upCount || 305;
  const flat = payload.flatCount || 47;
  const down = payload.downCount || 670;
  const generalCount = payload.generalEtfCount || 1022;
  const dailyTs = payload.marketScaleTimeSeries?.daily || [];
  const latestTs = dailyTs.length > 0 ? dailyTs[dailyTs.length - 1] : null;
  const prevTs = dailyTs.length > 1 ? dailyTs[dailyTs.length - 2] : null;
  let totalAumChangeStr = "";
  let totalAdtvChangeStr = "";
  if (latestTs) {
    const aumChangeJo = latestTs.aumChange / 1e4;
    const signAum = aumChangeJo > 0 ? "+" : "";
    const colorAum = aumChangeJo >= 0 ? "#DC2626" : "#2563EB";
    totalAumChangeStr = `<span style="color: ${colorAum};">${signAum}${aumChangeJo.toFixed(1)}\uC870\uC6D0</span>`;
    if (prevTs) {
      const adtvChangeJo = (latestTs.adtv - prevTs.adtv) / 1e4;
      const signAdtv = adtvChangeJo > 0 ? "+" : "";
      const colorAdtv = adtvChangeJo >= 0 ? "#DC2626" : "#2563EB";
      totalAdtvChangeStr = `<span style="color: ${colorAdtv};">${signAdtv}${adtvChangeJo.toFixed(1)}\uC870\uC6D0</span>`;
    }
  }
  const sortedPeerGroups = [...payload.peerGroups || []].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
  const winners = sortedPeerGroups.filter((p) => p.cappedAumWeightedReturnPct > 0).slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().filter((p) => p.cappedAumWeightedReturnPct < 0).slice(0, 3);
  const topTheme = winners[0] || { peerGroup: "\uC5D0\uB108\uC9C0", cappedAumWeightedReturnPct: 0.93 };
  const bottomTheme = losers[0] || { peerGroup: "K-\uD478\uB4DC & K-\uBDF0\uD2F0", cappedAumWeightedReturnPct: -4.07 };
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const topInflowName = topInflows[0]?.name || topInflows[0]?.etfName || "\uAD6D\uB0B4 \uB300\uD45C\uC9C0\uC218";
  const headline = `\uAD6D\uB0B4 \uC0C1\uC7A5 \uC77C\uBC18 ETF ${generalCount.toLocaleString()}\uAC1C \uC2DC\uC7A5\uC744 \uC804\uC218 \uBD84\uC11D\uD55C \uACB0\uACFC, \uC0C1\uC2B9 ${up}\uAC1C \uB300\uBE44 \uD558\uB77D ${down}\uAC1C\uB85C \uC228\uACE0\uB974\uAE30 \uC7A5\uC138\uB97C \uBCF4\uC600\uC2B5\uB2C8\uB2E4. \uD14C\uB9C8\uBCC4\uB85C\uB294 '${topTheme.peerGroup.replace(/\s*\([^)]*\)/g, "")}' \uD14C\uB9C8(+${topTheme.cappedAumWeightedReturnPct.toFixed(2)}%)\uAC00 \uC0C1\uC2B9\uD55C \uAC00\uC6B4\uB370, \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uB294 '${topInflowName}' \uB4F1 \uB300\uD45C\uC9C0\uC218\uB85C \uC2E4\uC9C8 \uC21C\uC720\uC785\uC744 \uC774\uC5B4\uAC14\uC2B5\uB2C8\uB2E4.`;
  const utmLink = `${baseUrl}/briefing?utm_source=newsletter&utm_medium=email&utm_campaign=daily_briefing_${dateStr.replace(/-/g, "")}`;
  const subject = `[ETF \uB9C8\uCF13 \uBE0C\uB9AC\uD551] ${formattedDate} '${topTheme.peerGroup.replace(/\s*\([^)]*\)/g, "")}' \uD14C\uB9C8 \uC0C1\uC2B9 \uC18D \uB300\uD45C\uC9C0\uC218 \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC720\uC785`;
  const disparityList = payload.disparityWarning || [];
  const overvalued = disparityList.filter((d) => d.disparityPct > 0);
  const undervalued = disparityList.filter((d) => d.disparityPct < 0);
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background-color: #0F172A; color: #0F172A; -webkit-font-smoothing: antialiased; }
    .container { max-width: 620px; margin: 24px auto; background-color: #FFFFFF; border-radius: 22px; overflow: hidden; box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12); border: 1px solid #E2E8F0; }
    .header { background: linear-gradient(135deg, #064E3B 0%, #047857 100%); padding: 36px 24px; text-align: center; color: #FFFFFF; }
    .badge { display: inline-block; background-color: rgba(255, 255, 255, 0.22); color: #A7F3D0; padding: 5px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.3); }
    .title { font-size: 28px; font-weight: 900; margin: 0 0 8px; color: #FFFFFF; letter-spacing: -0.8px; }
    .subtitle { font-size: 14.5px; color: #D1FAE5; font-weight: 700; }
    .content { padding: 32px 24px; }
    
    .quote-box { background-color: #F8FAFC; border-left: 5px solid #10B981; padding: 18px 20px; border-radius: 0 14px 14px 0; margin-bottom: 26px; font-size: 16px; line-height: 1.7; font-weight: 700; color: #1E293B; border-top: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; letter-spacing: -0.3px; }
    .tabular { font-variant-numeric: tabular-nums; }
    
    .grid-2 { display: table; width: 100%; margin-bottom: 14px; border-spacing: 0; }
    .grid-col { display: table-cell; width: 50%; padding: 0 6px; vertical-align: top; box-sizing: border-box; }
    
    .metric-card { background-color: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 16px 12px; text-align: center; box-sizing: border-box; }
    .metric-label { font-size: 13.5px; color: #334155; font-weight: 800; margin-bottom: 5px; }
    .metric-value { font-size: 24px; font-weight: 900; margin: 4px 0; color: #0F172A; }
    
    .section-header { margin-top: 30px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
    .section-title { font-size: 18px; font-weight: 900; color: #0F172A; letter-spacing: -0.4px; }
    .section-subtext { font-size: 12.5px; color: #64748B; font-weight: 700; }
    
    .table-custom { width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 14px; border-radius: 14px; overflow: hidden; border: 1.5px solid #E2E8F0; }
    .table-custom th { background-color: #F1F5F9; padding: 12px 14px; text-align: left; font-weight: 900; color: #334155; border-bottom: 1.5px solid #E2E8F0; font-size: 13.5px; }
    .table-custom td { padding: 12px 14px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    .table-custom tr:last-child td { border-bottom: none; }
    
    .btn-primary { display: block; width: 100%; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #FFFFFF !important; text-align: center; padding: 18px 0; border-radius: 14px; font-size: 17px; font-weight: 900; text-decoration: none; margin: 32px 0 12px; box-sizing: border-box; box-shadow: 0 6px 16px rgba(5, 150, 105, 0.35); letter-spacing: -0.3px; }
    .footer { background-color: #F8FAFC; padding: 26px 20px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; line-height: 1.7; font-weight: 600; }
  </style>
</head>
<body>
  <div style="padding: 16px 8px;">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <span class="badge">ETF CAMPUS \xB7 MORNING BRIEFING</span>
        <div class="title">${formattedDate} ETF \uB9C8\uCF13 \uBE0C\uB9AC\uD551</div>
        <div class="subtitle">\uAD6D\uB0B4 \uC0C1\uC7A5 \uC77C\uBC18 ETF ${generalCount}\uAC1C \uC804\uC218 \uB370\uC774\uD130 \uC815\uB7C9 \uB9AC\uD3EC\uD2B8</div>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- 1. Structured Executive Summary (3-Point Fast Scan) -->
        <div style="background-color: #F8FAFC; border-left: 5px solid #059669; padding: 20px; border-radius: 0 16px 16px 0; margin-bottom: 26px; border-top: 1.5px solid #E2E8F0; border-right: 1.5px solid #E2E8F0; border-bottom: 1.5px solid #E2E8F0;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px dashed #CBD5E1; padding-bottom: 10px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">\u{1F4A1}</span>
              <span style="font-size: 14.5px; font-weight: 900; color: #065F46; letter-spacing: -0.3px;">\uC624\uB298\uC758 30\uCD08 \uB9C8\uCF13 \uB9E5\uBC15 \uC694\uC57D</span>
            </div>
            <span style="font-size: 12px; font-weight: 800; color: #64748B;">\uC77C\uBC18 ETF ${generalCount}\uAC1C \uC804\uC218 \uBD84\uC11D</span>
          </div>

          <div style="font-size: 16.5px; font-weight: 800; color: #0F172A; line-height: 1.55; margin-bottom: 12px; letter-spacing: -0.4px;">
            \uCF54\uC2A4\uD53C \uC18C\uD3ED \uC0C1\uC2B9\uC5D0\uB3C4 \uC77C\uBC18 ETF \uC2DC\uC7A5\uC740 <span style="color: #2563EB; font-weight: 900;">\uD558\uB77D ${down}\uAC1C \uC6B0\uC138</span>\uB85C \uCC28\uBCC4\uD654\uB41C \uC228\uACE0\uB974\uAE30 \uC7A5\uC138\uB97C \uB098\uD0C0\uB0C8\uC2B5\uB2C8\uB2E4.
          </div>

          <div style="background-color: #FFFFFF; border-radius: 12px; padding: 12px 14px; border: 1.5px solid #E2E8F0; font-size: 14.5px; color: #334155; line-height: 1.7;">
            <div style="display: flex; align-items: baseline; margin-bottom: 6px;">
              <span style="color: #DC2626; font-weight: 900; font-size: 14px; margin-right: 8px; flex-shrink: 0;">\u2022 \uC8FC\uB3C4 \uD14C\uB9C8</span>
              <span style="color: #0F172A; font-weight: 800;"><span style="color: #DC2626;">'${escapeXml2(topTheme.peerGroup.replace(/\s*\([^)]*\)/g, ""))}'</span> (+${topTheme.cappedAumWeightedReturnPct.toFixed(2)}%) \uC0C1\uC2B9 \uC120\uBC29</span>
            </div>
            <div style="display: flex; align-items: baseline;">
              <span style="color: #047857; font-weight: 900; font-size: 14px; margin-right: 8px; flex-shrink: 0;">\u2022 \uC2A4\uB9C8\uD2B8\uBA38\uB2C8</span>
              <span style="color: #0F172A; font-weight: 800;"><span style="color: #047857;">'${escapeXml2(topInflowName)}'</span> \uB4F1 \uB300\uD45C\uC9C0\uC218\uB85C \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785 \uC9D1\uC911</span>
            </div>
          </div>
        </div>

        <!-- 2. 4-Card Overview Grid -->
        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">KOSPI vs \uC77C\uBC18 ETF</div>
              <div class="metric-value tabular" style="font-size: 20px;">
                <span style="color: ${kospiColor};">${kospiSign}${kospiChangePct.toFixed(2)}%</span> <span style="color: #94A3B8; font-size: 15px;">/</span> <span style="color: ${etfColor};">${etfSign}${etfReturn.toFixed(2)}%</span>
              </div>
              <div style="font-size: 12.5px; font-weight: 800; color: #475569;">KOSDAQ ${kosdaqSign}${kosdaqChangePct.toFixed(2)}%</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">\uC2DC\uC7A5 \uCCB4\uC628 (\uB4F1\uB77D \uBD84\uD3EC)</div>
              <div class="metric-value tabular" style="font-size: 17.5px; margin: 6px 0;">
                <span style="color: #DC2626;">\uC0C1\uC2B9 ${up}</span> <span style="color: #CBD5E1; font-size: 14px;">\xB7</span> <span style="color: #64748B;">\uBCF4\uD569 ${flat}</span> <span style="color: #CBD5E1; font-size: 14px;">\xB7</span> <span style="color: #2563EB;">\uD558\uB77D ${down}</span>
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #475569;">\uC77C\uBC18 ETF ${generalCount}\uAC1C \uAE30\uC900</div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">\uC804\uCCB4 ETF \uCD1D \uC21C\uC790\uC0B0 (AUM)</div>
              <div class="metric-value tabular">${aumJo}\uC870\uC6D0</div>
              <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 4px;">${totalEtfCount > 0 ? `${totalEtfCount.toLocaleString()}\uAC1C \uC804\uCCB4 \uC885\uBAA9 \uAE30\uC900` : `${generalCount}\uAC1C \uC77C\uBC18 \uC885\uBAA9 \uD3EC\uD568`}</div>
              ${totalAumChangeStr ? `<div style="font-size: 13px; font-weight: 800; color: #1E293B; margin-top: 6px; border-top: 1.5px dashed #CBD5E1; padding-top: 5px;">\uC804\uCCB4 ETF \uAE30\uC900 \uC804\uC77C\uBE44 ${totalAumChangeStr}</div>` : ""}
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">\uC804\uCCB4 ETF \uC77C \uAC70\uB798\uB300\uAE08 / \uD68C\uC804\uC728</div>
              <div class="metric-value tabular">${tradeJo}\uC870\uC6D0</div>
              <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 4px;" class="tabular">\uC77C\uC77C \uD68C\uC804\uC728 ${turnoverPct.toFixed(1)}%</div>
              ${totalAdtvChangeStr ? `<div style="font-size: 13px; font-weight: 800; color: #1E293B; margin-top: 6px; border-top: 1.5px dashed #CBD5E1; padding-top: 5px;">\uC804\uCCB4 ETF \uAE30\uC900 \uC804\uC77C\uBE44 ${totalAdtvChangeStr}</div>` : ""}
            </div>
          </div>
        </div>

        <!-- 3. Section: Themes Long/Short -->
        <div class="section-header">
          <span class="section-title">\u{1F525} \uC8FC\uB3C4 \uD14C\uB9C8 TOP 3 vs \uBD80\uC9C4 \uD14C\uB9C8 TOP 3</span>
          <span class="section-subtext">AUM \uAC00\uC911 \uD3C9\uADE0 \uC218\uC775\uB960 \uAE30\uC900</span>
        </div>
        <table class="table-custom">
          <thead>
            <tr>
              <th style="width: 85px;">\uAD6C\uBD84</th>
              <th>\uD14C\uB9C8\uBA85</th>
              <th style="text-align: right;">\uB4F1\uB77D\uB960</th>
            </tr>
          </thead>
          <tbody>
            ${winners.map((w, idx) => `
              <tr>
                <td style="font-weight: 900; color: #DC2626; font-size: 14.5px;">\uC0C1\uC2B9 ${idx + 1}\uC704</td>
                <td style="font-weight: 900; color: #0F172A; font-size: 15.5px;">${escapeXml2(w.peerGroup)}</td>
                <td style="text-align: right; font-weight: 900; color: #DC2626; font-size: 16px;" class="tabular">\u25B2 +${w.cappedAumWeightedReturnPct.toFixed(2)}%</td>
              </tr>
            `).join("")}
            ${losers.map((l, idx) => `
              <tr>
                <td style="font-weight: 900; color: #2563EB; font-size: 14.5px;">\uD558\uB77D ${idx + 1}\uC704</td>
                <td style="font-weight: 900; color: #0F172A; font-size: 15.5px;">${escapeXml2(l.peerGroup)}</td>
                <td style="text-align: right; font-weight: 900; color: #2563EB; font-size: 16px;" class="tabular">\u25BC ${l.cappedAumWeightedReturnPct.toFixed(2)}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <!-- 4. Section: Smart Money Inflows -->
        <div class="section-header">
          <span class="section-title">\u{1F4B8} \uC2A4\uB9C8\uD2B8\uBA38\uB2C8(\uC678\uC778\xB7\uAE30\uAD00) \uC2E4\uC9C8 \uC21C\uC720\uC785 TOP 5</span>
          <span class="section-subtext">\uC77C\uBC18 \uD14C\uB9C8 ETF \uAE30\uC900 \xB7 \uB2E8\uC704: \uC5B5\uC6D0</span>
        </div>
        <table class="table-custom">
          <thead>
            <tr>
              <th style="width: 44px; text-align: center;">\uC21C\uC704</th>
              <th>\uC885\uBAA9\uBA85 / \uD2F0\uCEE4</th>
              <th style="text-align: right;">\uC2E4\uC9C8 \uC21C\uC720\uC785\uC561</th>
            </tr>
          </thead>
          <tbody>
            ${topInflows.slice(0, 5).map((item, idx) => {
    const name = item.name || item.etfName || item.ticker || "";
    const ticker = item.ticker || "";
    const inflowEok = item.inflow ? Math.round(item.inflow) : item.netInflowValue ? Math.round(item.netInflowValue / 1e8) : 0;
    return `
              <tr>
                <td style="font-weight: 900; color: ${idx === 0 ? "#059669" : "#64748B"}; text-align: center; font-size: 15.5px;">${idx + 1}</td>
                <td>
                  <div style="font-weight: 900; color: #0F172A; font-size: 15.5px;">${escapeXml2(name)}</div>
                  <div style="font-size: 12.5px; font-weight: 700; color: #64748B; margin-top: 2px;" class="tabular">${escapeXml2(ticker)}</div>
                </td>
                <td style="text-align: right; font-weight: 900; color: #047857; font-size: 17px;" class="tabular">+${inflowEok.toLocaleString()}\uC5B5\uC6D0</td>
              </tr>
              `;
  }).join("")}
          </tbody>
        </table>

        <!-- 5. Section: Disparity Warning (\uC218\uAE09 \uC3E0\uB9BC \uC8FC\uC758 ETF / \uAD34\uB9AC\uC728 \uACBD\uBCF4) -->
        <div style="margin-top: 30px; background-color: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 16px; padding: 18px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #F1F5F9; padding-bottom: 14px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">\u26A0\uFE0F</span>
              <span style="font-size: 16px; font-weight: 900; color: #0F172A;">\uC218\uAE09 \uC3E0\uB9BC \uC8FC\uC758 ETF (\uAD34\uB9AC\uC728 \uACBD\uBCF4)</span>
              <span style="display: inline-block; background-color: #F1F5F9; color: #334155; font-size: 12px; font-weight: 900; padding: 2px 8px; border-radius: 999px;">\uCD1D ${disparityList.length}\uAC1C</span>
            </div>
            <div style="font-size: 12px; font-weight: 700; color: #64748B;">
              \uAE30\uC900: \uAD6D\uB0B4 1.0% / \uD574\uC678 3.0% \uC774\uC0C1
            </div>
          </div>

          <!-- Overvalued Sub-panel -->
          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 14.5px; font-weight: 900; color: #DC2626;">\u{1F4C8} \uACE0\uD3C9\uAC00 TOP 3 (Premium)</span>
              <span style="font-size: 12px; font-weight: 800; color: #DC2626; background-color: #FEF2F2; padding: 3px 8px; border-radius: 6px;">\uCD94\uACA9 \uB9E4\uC218 \uC8FC\uC758 (\uC2DC\uC7A5\uAC00 &gt; NAV)</span>
            </div>
            ${overvalued.length === 0 ? `
              <div style="background-color: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 10px; padding: 12px; text-align: center; font-size: 13.5px; color: #475569; font-weight: 700;">
                <span style="color: #10B981; font-weight: 900; margin-right: 6px;">\u2713</span> \uD604\uC7AC \uACE0\uD3C9\uAC00 \uACBD\uBCF4 \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                ${overvalued.slice(0, 3).map((item, idx) => `
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="width: 24px; font-weight: 900; color: #DC2626; text-align: center; font-size: 14.5px;">${idx + 1}</td>
                    <td style="padding: 8px 10px;">
                      <div style="font-weight: 900; color: #0F172A; font-size: 14.5px;">${escapeXml2(item.etfName)}</div>
                      <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-top: 2px;">${escapeXml2(item.ticker)} \xB7 ${escapeXml2(item.assetClass || "\uC77C\uBC18")}</div>
                    </td>
                    <td style="text-align: right; padding: 8px 10px;">
                      <span style="display: inline-block; background-color: #FEF2F2; color: #DC2626; font-weight: 900; font-size: 13.5px; padding: 4px 10px; border-radius: 8px;" class="tabular">+${item.disparityPct.toFixed(2)}% \uACE0\uD3C9\uAC00</span>
                    </td>
                  </tr>
                `).join("")}
              </table>
            `}
          </div>

          <!-- Undervalued Sub-panel -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 14.5px; font-weight: 900; color: #2563EB;">\u{1F4C9} \uC800\uD3C9\uAC00 TOP 3 (Discount)</span>
              <span style="font-size: 12px; font-weight: 800; color: #2563EB; background-color: #EFF6FF; padding: 3px 8px; border-radius: 6px;">\uBCF4\uC720\uC790 \uD5D0\uAC12 \uB9E4\uB3C4 \uC720\uC758 \uBC0F \uC2DC\uCC28 \uD655\uC778 (\uC2DC\uC7A5\uAC00 &lt; NAV)</span>
            </div>
            ${undervalued.length === 0 ? `
              <div style="background-color: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 10px; padding: 12px; text-align: center; font-size: 13.5px; color: #475569; font-weight: 700;">
                <span style="color: #10B981; font-weight: 900; margin-right: 6px;">\u2713</span> \uD604\uC7AC \uC800\uD3C9\uAC00 \uACBD\uBCF4 \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                ${undervalued.slice(0, 3).map((item, idx) => `
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="width: 24px; font-weight: 900; color: #2563EB; text-align: center; font-size: 14.5px;">${idx + 1}</td>
                    <td style="padding: 8px 10px;">
                      <div style="font-weight: 900; color: #0F172A; font-size: 14.5px;">${escapeXml2(item.etfName)}</div>
                      <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-top: 2px;">${escapeXml2(item.ticker)} \xB7 ${escapeXml2(item.assetClass || "\uC77C\uBC18")}</div>
                    </td>
                    <td style="text-align: right; padding: 8px 10px;">
                      <span style="display: inline-block; background-color: #EFF6FF; color: #2563EB; font-weight: 900; font-size: 13.5px; padding: 4px 10px; border-radius: 8px;" class="tabular">${item.disparityPct.toFixed(2)}% \uC800\uD3C9\uAC00</span>
                    </td>
                  </tr>
                `).join("")}
              </table>
            `}
          </div>
        </div>

        <!-- 6. Call to Action -->
        <a href="${utmLink}" class="btn-primary">
          \u{1F449} \uC804\uCCB4 1,022\uAC1C ETF \uC2E4\uC2DC\uAC04 \uBD84\uC11D &amp; \uB9C8\uCF13 \uBE0C\uB9AC\uD551 \uD480\uBC84\uC804 \u{1F4CA}
        </a>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div><strong style="color: #1E293B; font-size: 13.5px;">ETF CAMPUS (ETF \uCEA0\uD37C\uC2A4)</strong></div>
        <div style="margin: 4px 0 8px; font-size: 12px; color: #475569; font-weight: 700;">\uB9E4\uC77C \uC544\uCE68 \uAC00\uC7A5 \uC815\uD655\uD55C \uC815\uB7C9 ETF \uB9C8\uCF13 \uBE0C\uB9AC\uD551</div>
        <div style="font-size: 11.5px; color: #64748B; line-height: 1.6;">
          \uBCF8 \uBA54\uC77C\uC740 \uC815\uBCF4 \uC81C\uACF5\uC744 \uBAA9\uC801\uC73C\uB85C \uBC1C\uC1A1\uB418\uBA70, \uD2B9\uC815 \uC885\uBAA9\uC5D0 \uB300\uD55C \uD22C\uC790 \uAD8C\uC720\uAC00 \uC544\uB2D9\uB2C8\uB2E4.<br>
          \xA9 2026 ETF Campus. All rights reserved.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  return { subject, html };
}
__name(generateNewsletterHtml, "generateNewsletterHtml");

// src/templates/threads.ts
function selectThreadsTopicTag(payload) {
  return "#ETF";
}
__name(selectThreadsTopicTag, "selectThreadsTopicTag");
function generateThreadsThread(payload, baseUrl) {
  const dateStr = payload.asOfDate || "2026-08-31";
  const formattedDate = dateStr.replace(/-/g, ".");
  const kospi = payload.kospiChangePct ?? 0.46;
  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.28;
  const etfSign = etfReturn > 0 ? "+" : "";
  const sign = kospi > 0 ? "+" : "";
  const up = payload.upCount ?? 305;
  const flat = payload.flatCount ?? 47;
  const down = payload.downCount ?? 670;
  const generalCount = payload.generalEtfCount ?? 1022;
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 2) || [];
  const inflowSentence = topInflows.length > 0 ? `

\uC790\uAE08 \uD750\uB984\uC744 \uBCF4\uBA74 \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uB294 ${topInflows.map((i) => {
    const item = i;
    const name = item.name || item.etfName || "\uB300\uD45C\uC9C0\uC218";
    const val = item.inflow ?? (item.netInflowValue ? Math.round(item.netInflowValue / 1e8) : 0);
    return `${name} +${(val || 0).toLocaleString()}\uC5B5 \uC6D0`;
  }).join(", ")} \uC21C\uC73C\uB85C \uC720\uC785\uB418\uBA70 \uB300\uD45C\uC9C0\uC218\uB97C \uC9C0\uC9C0\uD588\uC2B5\uB2C8\uB2E4.` : "";
  const strongThemes = payload.peerGroups?.filter((p) => p.cappedAumWeightedReturnPct > 0).slice(0, 2) || [];
  const weakThemes = payload.peerGroups?.filter((p) => p.cappedAumWeightedReturnPct < 0).slice(-2).reverse() || [];
  const strongText = strongThemes.length > 0 ? strongThemes.map((t) => `${t.peerGroup.replace(/\s*\([^)]*\)/g, "")} +${t.cappedAumWeightedReturnPct.toFixed(2)}%`).join(", ") : "\uC5D0\uB108\uC9C0 +0.93%, \uACE0\uBC30\uB2F9 +0.85%";
  const weakText = weakThemes.length > 0 ? weakThemes.map((t) => `${t.peerGroup.replace(/\s*\([^)]*\)/g, "")} ${t.cappedAumWeightedReturnPct.toFixed(2)}%`).join(", ") : "K-\uD478\uB4DC -4.07%, K-\uBC29\uC0B0 -2.68%";
  const topicTag = selectThreadsTopicTag(payload);
  const kospiVerb = kospi > 0 ? down > up ? `\uCF54\uC2A4\uD53C\uB294 ${sign}${kospi.toFixed(2)}% \uC62C\uB790\uC9C0\uB9CC \uC2E4\uC81C ETF \uC2DC\uC7A5\uC740 \uC0C1\uC2B9 ${up}\uAC1C \uB300\uBE44 \uD558\uB77D ${down}\uAC1C\uB85C \uCC28\uBCC4\uD654\uB41C \uC228\uACE0\uB974\uAE30\uC600\uC8E0.` : `\uCF54\uC2A4\uD53C\uB294 ${sign}${kospi.toFixed(2)}% \uC0C1\uC2B9\uD588\uACE0, ETF \uC2DC\uC7A5\uB3C4 \uC0C1\uC2B9 ${up}\uAC1C(\uD558\uB77D ${down}\uAC1C)\uB85C \uC628\uAE30\uAC00 \uD655\uC0B0\uB410\uC2B5\uB2C8\uB2E4.` : down > up ? `\uCF54\uC2A4\uD53C\uB294 ${sign}${kospi.toFixed(2)}% \uC870\uC815\uC744 \uBC1B\uC558\uACE0, \uC77C\uBC18 ETF \uC2DC\uC7A5 \uC5ED\uC2DC \uC0C1\uC2B9 ${up}\uAC1C \uB300\uBE44 \uD558\uB77D ${down}\uAC1C\uB85C \uD558\uB77D\uC138\uAC00 \uC6B0\uC138\uD588\uC2B5\uB2C8\uB2E4.` : `\uCF54\uC2A4\uD53C\uB294 ${sign}${kospi.toFixed(2)}% \uBC00\uB838\uC9C0\uB9CC \uAC1C\uBCC4 ETF\uB294 \uC0C1\uC2B9 ${up}\uAC1C\uB85C \uBC29\uC5B4 \uD750\uB984\uC744 \uBCF4\uC600\uC2B5\uB2C8\uB2E4.`;
  const mainPost = `\uC5B4\uC81C \uAD6D\uB0B4 \uC0C1\uC7A5 \uC77C\uBC18 ETF ${generalCount.toLocaleString()}\uAC1C \uC2DC\uC7A5 \uB370\uC774\uD130\uB97C \uBD84\uC11D\uD574 \uBD24\uC5B4\uC694. 

${kospiVerb} \uC804\uCCB4 \uD3C9\uADE0 \uC218\uC775\uB960\uC740 ${etfSign}${etfReturn.toFixed(2)}%\uC600\uC2B5\uB2C8\uB2E4.

\uD14C\uB9C8\uBCC4\uB85C\uB294 ${strongText}\uC774 \uACAC\uC870\uD588\uB358 \uBC18\uBA74, ${weakText}\uC740 \uC870\uC815\uC744 \uBC1B\uC558\uC2B5\uB2C8\uB2E4.${inflowSentence}

\uC9C0\uC218\uBCF4\uB2E4 \uC911\uC694\uD55C ETF \uC2DC\uC7A5\uC758 \uC790\uAE08 \uD750\uB984, \uC5EC\uB7EC\uBD84\uC740 \uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uC810\uAC80\uD560 \uB54C \uC5B4\uB5A4 \uC9C0\uD45C\uB97C \uAC00\uC7A5 \uBA3C\uC800 \uD655\uC778\uD558\uC2DC\uB098\uC694?

${topicTag}

[\uCCAB \uB313\uAE00]
\u{1F4CC} \uB9E4\uC77C \uC7A5 \uC2DC\uC791 \uC804 \uC0C1\uC138 \uBE0C\uB9AC\uD551\uACFC \uC2E4\uC2DC\uAC04 1,022\uAC1C ETF \uB370\uC774\uD130\uB294 \uD504\uB85C\uD544 \uB9C1\uD06C\uC5D0\uC11C \uBC14\uB85C \uD655\uC778\uD558\uC2E4 \uC218 \uC788\uC5B4\uC694!`;
  return [
    { sequence: 1, content: mainPost }
  ];
}
__name(generateThreadsThread, "generateThreadsThread");

// src/index.ts
function normalizeBriefingPayload(raw) {
  if (!raw) return null;
  const briefing = raw.briefing || raw;
  const pulse = briefing.pulse || {};
  const kospi = briefing.marketIndices?.find((i) => i.code === "KOSPI");
  const kosdaq = briefing.marketIndices?.find((i) => i.code === "KOSDAQ");
  return {
    ...briefing,
    pulse,
    headlineText: briefing.headline?.text || briefing.headlineText || "",
    marketTemperature: pulse.marketTemperature || briefing.marketTemperature || "\uD558\uB77D \uC6B0\uC138",
    kospiClose: kospi?.close ?? briefing.kospiClose ?? 0,
    kospiChangePct: kospi?.change_pct ?? briefing.kospiChangePct ?? 0,
    kosdaqClose: kosdaq?.close ?? briefing.kosdaqClose ?? 0,
    kosdaqChangePct: kosdaq?.change_pct ?? briefing.kosdaqChangePct ?? 0,
    generalEtfCount: pulse.generalEtfCount ?? briefing.generalEtfCount ?? 0,
    generalTotalAum: pulse.generalTotalAum ?? briefing.generalTotalAum ?? 0,
    generalTotalTradeValue: pulse.generalTotalTradeValue ?? briefing.generalTotalTradeValue ?? 0,
    generalAumWeightedReturnPct: pulse.generalAumWeightedReturnPct ?? briefing.generalAumWeightedReturnPct ?? 0,
    upCount: pulse.upCount ?? briefing.upCount ?? 0,
    flatCount: pulse.flatCount ?? briefing.flatCount ?? 0,
    downCount: pulse.downCount ?? briefing.downCount ?? 0,
    breadthRatioPct: pulse.breadthRatioPct ?? briefing.breadthRatioPct ?? 0,
    top10TradeSharePct: pulse.top10TradeSharePct ?? briefing.top10TradeSharePct ?? 0,
    allTop10TradeSharePct: pulse.allTop10TradeSharePct ?? briefing.allTop10TradeSharePct ?? 0,
    assetClasses: (briefing.assetClasses || []).map((a) => ({
      assetClass: a.assetClass || a.asset_class || "",
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
      ytdReturnPct: a.ytdReturnPct || 0
    })),
    focusEtfs: briefing.focusEtfs || [],
    peerGroups: (briefing.peerGroups || []).map((p) => ({
      ...p,
      peerGroup: p.peerGroup || p.peer_group || "",
      assetClass: p.assetClass || p.asset_class || "",
      etfCount: p.etfCount || p.etf_count || 0,
      equalWeightReturnPct: p.equalWeightReturnPct ?? p.equal_weight_return_pct ?? 0,
      cappedAumWeightedReturnPct: p.cappedAumWeightedReturnPct ?? p.capped_aum_weighted_return_pct ?? 0
    })),
    disparityWarning: (briefing.disparityWarning || []).map((d) => ({
      ...d,
      ticker: d.ticker || "",
      etfName: d.etfName || d.etf_name || "",
      disparityPct: d.disparityPct ?? d.disparity_pct ?? 0
    })),
    periodicFlows: briefing.periodicFlows ? briefing.periodicFlows : briefing.fundFlow?.general ? {
      dailyFundFlows: {
        topInflows: (briefing.fundFlow.general.topInflows || []).map((f, idx) => ({
          rank: idx + 1,
          ticker: f.ticker,
          name: f.name || f.etfName || "\uD575\uC2ECETF",
          theme: f.theme || "\uD575\uC2ECETF",
          inflow: f.inflow ?? Math.round((f.netInflowValue || 0) / 1e8),
          changePct: f.changePct ?? 0
        })),
        topOutflows: (briefing.fundFlow.general.topOutflows || []).map((f, idx) => ({
          rank: idx + 1,
          ticker: f.ticker,
          name: f.name || f.etfName || "\uD575\uC2ECETF",
          theme: f.theme || "\uD575\uC2ECETF",
          inflow: f.inflow ?? Math.round((f.netInflowValue || 0) / 1e8),
          changePct: f.changePct ?? 0
        }))
      }
    } : void 0
  };
}
__name(normalizeBriefingPayload, "normalizeBriefingPayload");
async function loadBriefingPayload(env, asOfDate) {
  if (!asOfDate) {
    const pointer = await env.BRIEFING_KV.get("market-briefing:v0:latest-pointer", "json");
    if (pointer?.payloadKey) {
      const payload = await env.BRIEFING_KV.get(pointer.payloadKey, "json");
      if (payload) return normalizeBriefingPayload(payload);
    }
  } else {
    for (const v of [1, 2, 3, 4, 5]) {
      const key = `market-briefing:v0:payload:${asOfDate}:v${v}`;
      const payload = await env.BRIEFING_KV.get(key, "json");
      if (payload) return normalizeBriefingPayload(payload);
    }
  }
  try {
    const target = asOfDate || "latest";
    const endpoint = target === "latest" ? "https://etf-campus.pages.dev/api/briefings/latest" : `https://etf-campus.pages.dev/api/briefings/${target}`;
    const res = await fetch(endpoint, {
      headers: { "User-Agent": "ETF-Campus-Distributor/1.0" }
    });
    if (res.ok) {
      const json = await res.json();
      if (json) return normalizeBriefingPayload(json);
    }
  } catch (err) {
    console.warn("[Distributor] Failed to fetch from API fallback:", err);
  }
  return null;
}
__name(loadBriefingPayload, "loadBriefingPayload");
async function executeDistribution(env, targetDate, dryRun = false) {
  const payload = await loadBriefingPayload(env, targetDate);
  if (!payload) {
    throw new Error(`Briefing payload for ${targetDate || "latest"} not found`);
  }
  const effectiveDate = payload.asOfDate || targetDate || "latest";
  const validation = validateBriefingPayload(payload, env);
  if (!validation.isSafe) {
    console.error(`[Distributor] Circuit breaker tripped for ${effectiveDate}:`, validation.reasons);
    try {
      await env.ETF_PRICES.prepare(
        `CREATE TABLE IF NOT EXISTS briefing_distribution_logs (
          as_of_date TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          details_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ).run();
      await env.ETF_PRICES.prepare(
        `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, 'blocked', ?, CURRENT_TIMESTAMP)`
      ).bind(effectiveDate, JSON.stringify({ reasons: validation.reasons })).run();
    } catch (e) {
    }
    return { success: false, status: "blocked", reasons: validation.reasons };
  }
  const baseUrl = env.SITE_BASE_URL || "https://etf-campus.pages.dev";
  const instagramSlides = generateInstagramCarousel(payload, baseUrl);
  const threadsPosts = generateThreadsThread(payload, baseUrl);
  const newsletter = generateNewsletterHtml(payload, baseUrl);
  let threadsPublishedId = null;
  if (!dryRun && env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID) {
    try {
      const fullText = threadsPosts[0]?.content || "";
      const parts = fullText.split("[\uCCAB \uB313\uAE00]");
      const mainPost = parts[0].trim();
      const firstComment = parts[1] ? parts[1].trim() : "";
      const createUrl = `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}/threads`;
      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          media_type: "TEXT",
          text: mainPost,
          access_token: env.THREADS_ACCESS_TOKEN
        })
      });
      const createData = await createRes.json();
      if (createData.id) {
        const pubUrl = `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}/threads_publish`;
        const pubRes = await fetch(pubUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            creation_id: createData.id,
            access_token: env.THREADS_ACCESS_TOKEN
          })
        });
        const pubData = await pubRes.json();
        threadsPublishedId = pubData.id || null;
        if (firstComment && threadsPublishedId) {
          await new Promise((r) => setTimeout(r, 3e3));
          const replyCreateRes = await fetch(createUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              media_type: "TEXT",
              text: firstComment,
              reply_to_id: threadsPublishedId,
              access_token: env.THREADS_ACCESS_TOKEN
            })
          });
          const replyCreateData = await replyCreateRes.json();
          if (replyCreateData.id) {
            await fetch(pubUrl, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                creation_id: replyCreateData.id,
                access_token: env.THREADS_ACCESS_TOKEN
              })
            });
          }
        }
      } else {
        console.warn("[Distributor] Threads creation warning:", createData);
      }
    } catch (tErr) {
      console.error("[Distributor] Threads Cloud publishing error:", tErr);
    }
  }
  const dispatchResults = {
    instagram: { status: "rendered_ready", slideCount: instagramSlides.length },
    threads: {
      status: threadsPublishedId ? "published_live" : dryRun ? "dry_run" : "rendered_ready",
      postCount: threadsPosts.length,
      publishedPostId: threadsPublishedId
    },
    newsletter: { status: "rendered_ready", subject: newsletter.subject, htmlLength: newsletter.html.length }
  };
  try {
    await env.ETF_PRICES.prepare(
      `CREATE TABLE IF NOT EXISTS briefing_distribution_logs (
        as_of_date TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        details_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();
    await env.ETF_PRICES.prepare(
      `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(effectiveDate, threadsPublishedId ? "distributed" : dryRun ? "dry_run" : "ready", JSON.stringify(dispatchResults)).run();
  } catch (dbErr) {
    console.warn("[Distributor] Log insert warning:", dbErr);
  }
  return {
    success: true,
    asOfDate: effectiveDate,
    validation,
    dispatchResults
  };
}
__name(executeDistribution, "executeDistribution");
var index_default = {
  async queue(batch, env) {
    for (const message of batch.messages) {
      const event = message.body;
      const targetDate = event.as_of_date;
      try {
        console.log(`[Distributor] Consuming distribution event for ${targetDate} v${event.publication_version}`);
        const res = await executeDistribution(env, targetDate, false);
        console.log(`[Distributor] Distribution completed for ${targetDate}:`, JSON.stringify(res));
        message.ack();
      } catch (err) {
        console.error(`[Distributor] Fatal error distributing for ${targetDate}:`, err);
        message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 5)) });
      }
    }
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const targetDate = url.searchParams.get("date") || void 0;
    const baseUrl = env.SITE_BASE_URL || "https://etf-campus.pages.dev";
    if (url.pathname === "/api/preview/instagram") {
      const payload = await loadBriefingPayload(env, targetDate);
      if (!payload) return new Response("Briefing not found", { status: 404 });
      const slides = generateInstagramCarousel(payload, baseUrl);
      const slideParam = url.searchParams.get("slide");
      if (slideParam) {
        const slideNo = parseInt(slideParam, 10);
        const slide = slides.find((s) => s.slideNumber === slideNo) || slides[0];
        return new Response(slide.svgContent, {
          headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-cache" }
        });
      }
      return Response.json({ success: true, asOfDate: payload.asOfDate, slides });
    }
    if (url.pathname === "/api/preview/threads") {
      const payload = await loadBriefingPayload(env, targetDate);
      if (!payload) return new Response("Briefing not found", { status: 404 });
      const posts = generateThreadsThread(payload, baseUrl);
      return Response.json({ success: true, asOfDate: payload.asOfDate, posts });
    }
    if (url.pathname === "/api/preview/newsletter") {
      const payload = await loadBriefingPayload(env, targetDate);
      if (!payload) return new Response("Briefing not found", { status: 404 });
      const newsletter = generateNewsletterHtml(payload, baseUrl);
      return new Response(newsletter.html, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }
      });
    }
    if (url.pathname === "/internal/distribute" || url.pathname === "/api/distribute") {
      const dryRun = url.searchParams.get("dryRun") === "true";
      try {
        const result = await executeDistribution(env, targetDate, dryRun);
        return Response.json(result);
      } catch (err) {
        return Response.json({ success: false, error: String(err) }, { status: 500 });
      }
    }
    return new Response("ETF Campus Market Briefing Distributor Worker", { status: 200 });
  }
};
export {
  index_default as default,
  executeDistribution
};
//# sourceMappingURL=index.js.map
