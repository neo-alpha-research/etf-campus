var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/circuit-breaker.ts
var KST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
function getKstDateString(date = /* @__PURE__ */ new Date()) {
  return KST_FORMATTER.format(date);
}
__name(getKstDateString, "getKstDateString");
async function validateBriefingPayload(payload, env, options) {
  const reasons = [];
  const maxSpike = Number(env.MAX_ALLOWED_DAILY_SPIKE_PCT || "15.0");
  const pulse = payload.pulse || {};
  const generalEtfCount = payload.generalEtfCount ?? pulse.generalEtfCount;
  const generalTotalAum = payload.generalTotalAum ?? pulse.generalTotalAum;
  const upCount = payload.upCount ?? pulse.upCount ?? 0;
  const flatCount = payload.flatCount ?? pulse.flatCount ?? 0;
  const downCount = payload.downCount ?? pulse.downCount ?? 0;
  const kospiChangePct = payload.kospiChangePct ?? payload.marketIndices?.find((i) => i.code === "KOSPI")?.change_pct;
  const kosdaqChangePct = payload.kosdaqChangePct ?? payload.marketIndices?.find((i) => i.code === "KOSDAQ")?.change_pct;
  const generalAumWeightedReturnPct = pulse.generalAumWeightedReturnPct ?? payload.generalAumWeightedReturnPct;
  if (!payload.asOfDate) {
    reasons.push("asOfDate(\uAE30\uC900\uC77C\uC790) \uB204\uB77D");
  } else {
    const nowKst = getKstDateString(options?.now ?? /* @__PURE__ */ new Date());
    const targetTime = Date.parse(`${payload.asOfDate}T00:00:00Z`);
    const nowTime = Date.parse(`${nowKst}T00:00:00Z`);
    if (isNaN(targetTime)) {
      reasons.push(`asOfDate \uD615\uC2DD \uC624\uB958 (${payload.asOfDate})`);
    } else {
      const diffDays = Math.round((nowTime - targetTime) / (24 * 60 * 60 * 1e3));
      const kstDayOfWeek = new Date(nowTime).getUTCDay();
      const maxAllowedDays = kstDayOfWeek === 1 || kstDayOfWeek === 2 ? 4 : 2;
      if (diffDays > maxAllowedDays) {
        reasons.push(`\uAE30\uC900\uC77C\uC790 \uC2E0\uC120\uB3C4 \uCD08\uACFC: \uBE0C\uB9AC\uD551 \uAE30\uC900\uC77C(${payload.asOfDate})\uC774 \uD604\uC7AC KST(${nowKst}) \uAE30\uC900 ${diffDays}\uC77C \uC804 \uB370\uC774\uD130\uC785\uB2C8\uB2E4 (\uCD5C\uB300 \uD5C8\uC6A9: ${maxAllowedDays}\uC77C \uC804)`);
      } else if (diffDays < 0) {
        reasons.push(`\uAE30\uC900\uC77C\uC790 \uC624\uB958: \uBBF8\uB798 \uC77C\uC790(${payload.asOfDate})\uB294 \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 (\uD604\uC7AC KST: ${nowKst})`);
      }
      let latestDbTradingDate = options?.latestTradingDate;
      if (!latestDbTradingDate && env.ETF_PRICES && typeof env.ETF_PRICES.prepare === "function") {
        try {
          const row = await env.ETF_PRICES.prepare(
            "SELECT as_of_date FROM briefing_etf_daily ORDER BY as_of_date DESC LIMIT 1"
          ).first();
          if (row?.as_of_date) {
            latestDbTradingDate = row.as_of_date;
          }
        } catch (dbErr) {
          console.warn("[CircuitBreaker] Failed to query latest trading date from D1:", dbErr);
        }
      }
      if (latestDbTradingDate && payload.asOfDate !== latestDbTradingDate) {
        reasons.push(`\uAE30\uB300 \uAE30\uC900\uC77C \uBD88\uC77C\uCE58: \uBE0C\uB9AC\uD551 \uAE30\uC900\uC77C(${payload.asOfDate})\uC774 D1 \uCD5C\uC2E0 \uAC70\uB798\uC77C(${latestDbTradingDate})\uACFC \uB2E4\uB985\uB2C8\uB2E4`);
      }
    }
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

// src/services/market-regime.ts
function analyzeSmartMoneyCharacter(payload) {
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const top5 = topInflows.slice(0, 5);
  const top5InflowSum = top5.reduce((sum, item) => sum + (item.inflow || 0), 0);
  const topItemName = top5[0]?.name || top5[0]?.etfName || "\uD575\uC2EC \uC885\uBAA9";
  const secondItemName = top5[1]?.name || top5[1]?.etfName || "";
  let parkingScore = 0;
  let growthScore = 0;
  let dividendScore = 0;
  let macroScore = 0;
  for (const item of top5) {
    const name = item.name || item.etfName || "";
    const inflow = item.inflow || 1;
    if (/CD|KOFR|SOFR|단기채|머니마켓|MMF|파킹|초단기/i.test(name)) {
      parkingScore += inflow;
    } else if (/200|코스닥|나스닥|반도체|AI|테크|빅테크|2차전지|로봇|레버리지/i.test(name)) {
      growthScore += inflow;
    } else if (/배당|커버드콜|리츠|인컴|다우존스/i.test(name)) {
      dividendScore += inflow;
    } else if (/국채|미국채|금|골드|원유|원자재|달러/i.test(name)) {
      macroScore += inflow;
    }
  }
  const maxScore = Math.max(parkingScore, growthScore, dividendScore, macroScore);
  if (maxScore === parkingScore && parkingScore > 0) {
    return {
      character: "PARKING_SAFETY",
      characterName: "\uB2E8\uAE30\uC790\uAE08 \uBC0F \uAE08\uB9AC\uD615 \uC548\uC804\uC790\uC0B0",
      topItemName,
      secondItemName,
      top5InflowSum
    };
  }
  if (maxScore === growthScore && growthScore > 0) {
    return {
      character: "GROWTH_BETA",
      characterName: "\uB300\uD45C\uC9C0\uC218 \uBC0F \uC8FC\uB3C4 \uAE30\uC220\uC8FC",
      topItemName,
      secondItemName,
      top5InflowSum
    };
  }
  if (maxScore === dividendScore && dividendScore > 0) {
    return {
      character: "DIVIDEND_INCOME",
      characterName: "\uACE0\uBC30\uB2F9 \uBC0F \uC6D4\uC9C0\uAE09\uC2DD \uC778\uCEF4 \uC790\uC0B0",
      topItemName,
      secondItemName,
      top5InflowSum
    };
  }
  if (maxScore === macroScore && macroScore > 0) {
    return {
      character: "GLOBAL_MACRO",
      characterName: "\uAE00\uB85C\uBC8C \uCC44\uAD8C \uBC0F \uC6D0\uC790\uC7AC \uBD84\uC0B0 \uC790\uC0B0",
      topItemName,
      secondItemName,
      top5InflowSum
    };
  }
  return {
    character: "BALANCED_ROTATION",
    characterName: "\uC139\uD130 \uC21C\uD658\uB9E4 \uC120\uBCC4 \uC790\uC0B0",
    topItemName,
    secondItemName,
    top5InflowSum
  };
}
__name(analyzeSmartMoneyCharacter, "analyzeSmartMoneyCharacter");
function analyzeDisparityState(payload) {
  const disparityList = payload.disparityWarning || [];
  const premiums = disparityList.filter((d) => (d.disparityPct ?? 0) > 0);
  const discounts = disparityList.filter((d) => (d.disparityPct ?? 0) < 0);
  if (premiums.length > 0 && discounts.length > 0) {
    return {
      status: "PREMIUM_AND_DISCOUNT",
      badgeText: "\uC65C\uACE1 \uC8FC\uC758",
      bannerTitle: `\uACE0\uD3C9\uAC00 \uD560\uC99D ${premiums.length}\uAC1C vs \uC800\uD3C9\uAC00 \uD560\uC778 ${discounts.length}\uAC1C \uAD34\uB9AC\uC728 \uC65C\uACE1 \uB3D9\uC2DC \uBC1C\uC0DD`,
      bannerDesc: `\uD574\uC678 \uC2DC\uCC28 \uBC0F \uD638\uAC00 \uACF5\uBC31\uC5D0 \uB530\uB978 \uC591\uBC29\uD5A5 \uC65C\uACE1\uC785\uB2C8\uB2E4. \uC7A5 \uC2DC\uC791 \uD6C4 LP \uD638\uAC00 \uC815\uC0C1 \uBCF5\uADC0\uB97C \uD655\uC778\uD574\uC57C \uD569\uB2C8\uB2E4.`,
      actionTip: `\uC885\uBAA9\uBCC4\uB85C \uD560\uC99D\uACFC \uD560\uC778\uC774 \uC5C7\uAC08\uB9AC\uB294 \uAD6D\uBA74\uC5D0\uC11C\uB294 \uC77C\uAD04 \uB9E4\uB9E4\uB97C \uD53C\uD558\uACE0 \uAC1C\uBCC4 ETF\uC758 \uC2E4\uC2DC\uAC04 \uAD34\uB9AC\uC728 \uC9C0\uD45C\uB97C \uBC18\uB4DC\uC2DC \uB300\uC870\uD558\uC2ED\uC2DC\uC624.`,
      premiumsCount: premiums.length,
      discountsCount: discounts.length
    };
  }
  if (premiums.length > 0) {
    return {
      status: "PREMIUM_WARNING",
      badgeText: "\uD560\uC99D \uC8FC\uC758",
      bannerTitle: `\uACE0\uD3C9\uAC00 \uD560\uC99D ${premiums.length}\uAC1C \uC885\uBAA9 \uAD34\uB9AC\uC728 \uC65C\uACE1 \uBC1C\uC0DD`,
      bannerDesc: `\uC21C\uC790\uC0B0\uAC00\uCE58 NAV \uB300\uBE44 \uC2DC\uC7A5\uAC00\uAC00 \uB192\uAC8C \uD615\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC2DC\uCD08\uAC00 \uACE0\uC810 \uCD94\uACA9 \uB9E4\uC218\uC5D0 \uC720\uC758\uD558\uC2ED\uC2DC\uC624.`,
      actionTip: `\uACE0\uD3C9\uAC00 \uC0C1\uD0DC\uC5D0\uC11C\uB294 \uC21C\uC790\uC0B0\uAC00\uCE58 \uB300\uBE44 \uC6C3\uB3C8\uC744 \uC8FC\uACE0 \uB9E4\uC218\uD558\uB294 \uBD88\uB9AC\uD568\uC774 \uC788\uC2B5\uB2C8\uB2E4. \uAC1C\uC7A5 \uC9C1\uD6C4 LP \uD638\uAC00 \uC2A4\uD504\uB808\uB4DC\uAC00 \uC881\uD600\uC9C8 \uB54C\uAE4C\uC9C0 \uBD84\uD560 \uC811\uADFC\uD558\uB294 \uAC83\uC774 \uC548\uC804\uD569\uB2C8\uB2E4.`,
      premiumsCount: premiums.length,
      discountsCount: 0
    };
  }
  if (discounts.length > 0) {
    return {
      status: "DISCOUNT_OPPORTUNITY",
      badgeText: "\uD560\uC778 \uCCB4\uD06C",
      bannerTitle: `\uC800\uD3C9\uAC00 \uD560\uC778 ${discounts.length}\uAC1C \uC885\uBAA9 \uAD34\uB9AC\uC728 \uC65C\uACE1 \uBC1C\uC0DD`,
      bannerDesc: `\uC21C\uC790\uC0B0\uAC00\uCE58 NAV \uB300\uBE44 \uC2DC\uC7A5\uAC00\uAC00 \uB0AE\uAC8C \uD615\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4. LP \uD638\uAC00 \uC815\uC0C1 \uACF5\uAE09 \uC5EC\uBD80\uB97C \uCCB4\uD06C\uD558\uC2ED\uC2DC\uC624.`,
      actionTip: `\uC800\uD3C9\uAC00 \uC0C1\uD0DC\uB294 \uC2DC\uC7A5 \uAC00\uACA9\uC774 \uC21C\uC790\uC0B0\uAC00\uCE58\uBCF4\uB2E4 \uD560\uC778\uB41C \uC0C1\uD0DC\uC774\uB098, \uC720\uB3D9\uC131\uC774 \uBD80\uC871\uD55C \uC77C\uC2DC\uC801 \uD638\uAC00 \uACF5\uBC31\uC77C \uC218 \uC788\uC73C\uBBC0\uB85C \uD638\uAC00 \uB450\uAED8\uB97C \uD655\uC778\uD55C \uD6C4 \uC811\uADFC\uD558\uC2ED\uC2DC\uC624.`,
      premiumsCount: 0,
      discountsCount: discounts.length
    };
  }
  return {
    status: "STABLE_NORMAL",
    badgeText: "\uC815\uC0C1 \uC720\uC9C0",
    bannerTitle: "\uAD6D\uB0B4 \uC0C1\uC7A5 \uC77C\uBC18 ETF \uC804 \uC885\uBAA9 \uC815\uC0C1 \uAD34\uB9AC\uC728 \uBC94\uC704 \uC720\uC9C0",
    bannerDesc: "\uC804 \uC885\uBAA9\uC774 \uBC95\uC815 \uD5C8\uC6A9 \uBC94\uC704 \uB0B4\uC5D0\uC11C \uC548\uC815\uC801\uC73C\uB85C \uC815\uC0C1 \uAC70\uB798 \uC911\uC785\uB2C8\uB2E4.",
    actionTip: "\uD574\uC678 ETF \uAD34\uB9AC\uC728\uC740 \uAC1C\uC7A5 \uC9C1\uD6C4 LP \uD638\uAC00\uAC00 \uACF5\uAE09\uB418\uBA70 \uC815\uC0C1 \uBC94\uC704\uB85C \uC218\uB834\uD569\uB2C8\uB2E4. \uC7A5 \uCD08\uBC18 \uBB34\uB9AC\uD55C \uC2DC\uC7A5\uAC00 \uB9E4\uC218\uB97C \uD53C\uD558\uACE0 \uC2E4\uC2DC\uAC04 \uC21C\uC790\uC0B0\uAC00\uCE58 iNAV\uB97C \uD655\uC778\uD558\uC138\uC694.",
    premiumsCount: 0,
    discountsCount: 0
  };
}
__name(analyzeDisparityState, "analyzeDisparityState");
function classifyMarketRegime(payload) {
  const kospi = payload.kospiChangePct ?? 0;
  const kosdaq = payload.kosdaqChangePct ?? 0;
  const etfRet = payload.generalAumWeightedReturnPct ?? 0;
  const capSpread = Number((kospi - kosdaq).toFixed(2));
  const etfDivergence = Number((kospi - etfRet).toFixed(2));
  const up = payload.upCount ?? payload.pulse?.upCount ?? 0;
  const down = payload.downCount ?? payload.pulse?.downCount ?? 0;
  const flat = payload.flatCount ?? payload.pulse?.flatCount ?? 0;
  const total = up + down + flat || (payload.generalEtfCount ?? payload.pulse?.generalEtfCount ?? 1);
  const upRatio = up / total;
  const downRatio = down / total;
  const sortedPeerGroups = [...payload.peerGroups || []].sort(
    (a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0)
  );
  const topThemeObj = sortedPeerGroups[0];
  const bottomThemeObj = sortedPeerGroups.length > 1 ? sortedPeerGroups[sortedPeerGroups.length - 1] : void 0;
  const topThemeName = topThemeObj ? topThemeObj.peerGroup.replace(/\s*\([^)]*\)/g, "").trim() : "\uC8FC\uC694 \uC139\uD130";
  const bottomThemeName = bottomThemeObj ? bottomThemeObj.peerGroup.replace(/\s*\([^)]*\)/g, "").trim() : "\uC18C\uC678 \uC139\uD130";
  const topThemeRet = topThemeObj?.cappedAumWeightedReturnPct ?? 0;
  const bottomThemeRet = bottomThemeObj?.cappedAumWeightedReturnPct ?? 0;
  const kospiSign = kospi > 0 ? "+" : "";
  const kosdaqSign = kosdaq > 0 ? "+" : "";
  const etfSign = etfRet > 0 ? "+" : "";
  const flow = analyzeSmartMoneyCharacter(payload);
  const disparity = analyzeDisparityState(payload);
  let code = "TIGHT_BULL_SIDEWAYS";
  let statusName = "\uAC15\uBCF4\uD569 \uD0D0\uC0C9 / \uB9E4\uBB3C \uC18C\uD654";
  let badgeTag = "\uAC15\uBCF4\uD569 \uD0D0\uC0C9";
  if (kospi <= -0.5 && etfRet >= 0) {
    code = "DECOUPLING_DEFENSE";
    statusName = "\uC9C0\uC218 \uC57D\uC138 \uC18D ETF \uBC29\uC5B4 \uC120\uBC29";
    badgeTag = "\uC790\uC0B0\uBC30\uBD84 \uC120\uBC29";
  } else if (kospi >= 2 && (etfDivergence >= 1.5 || capSpread >= 2)) {
    code = "INDEX_ILLUSION_SURGE";
    statusName = "\uB300\uD615\uC8FC \uC3E0\uB9BC \uBC0F \uC9C0\uC218 \uCC29\uC2DC\uD615 \uB7A0\uB9AC";
    badgeTag = "\uB300\uD615\uC8FC \uC3E0\uB9BC";
  } else if (kospi >= 3 && upRatio >= 0.75 && etfRet >= 2) {
    code = "BROAD_RALLY_SURGE";
    statusName = "\uC804\uBC29\uC704 \uB3D9\uBC18 \uD3ED\uB4F1 / \uC720\uB3D9\uC131 \uC11C\uC9C0";
    badgeTag = "\uC804\uBC29\uC704 \uC11C\uC9C0";
  } else if (kosdaq >= 1.5 && capSpread <= -1.5) {
    code = "GROWTH_BETA_RALLY";
    statusName = "\uC911\uC18C\uD615\xB7\uC131\uC7A5 \uD14C\uB9C8 \uC8FC\uB3C4 \uB7A0\uB9AC";
    badgeTag = "\uC131\uC7A5 \uD14C\uB9C8 \uC8FC\uB3C4";
  } else if (kospi <= -0.3 && kosdaq >= 0.5) {
    code = "KOSPI_FALL_KOSDAQ_UP";
    statusName = "\uB300\uD615\uC8FC \uC870\uC815 \uC18D \uCF54\uC2A4\uB2E5 \uAC1C\uBCC4 \uC7A5\uC138";
    badgeTag = "\uCF54\uC2A4\uB2E5 \uAC1C\uBCC4\uC7A5\uC138";
  } else if (kospi >= 3 || upRatio >= 0.85) {
    code = "EXTREME_SURGE";
    statusName = "\uCD08\uAE09\uB4F1 / \uACFC\uC5F4 \uC11C\uC9C0";
    badgeTag = "\uCD08\uAE09\uB4F1 \uC11C\uC9C0";
  } else if (kospi >= 2.5) {
    code = "SUPER_BULL";
    statusName = "\uC288\uD37C \uB7A0\uB9AC / \uAC15\uB825\uD55C \uD3ED\uB4F1";
    badgeTag = "\uC288\uD37C \uB7A0\uB9AC";
  } else if (kospi >= 2) {
    code = "STRONG_BULL_HIGH";
    statusName = "\uAC15\uD55C \uB7A0\uB9AC / \uC628\uAE30 \uD655\uC0B0";
    badgeTag = "\uAC15\uD55C \uB7A0\uB9AC";
  } else if (kospi >= 1.5 || upRatio >= 0.65) {
    code = "STRONG_BULL";
    statusName = "\uBC18\uB4F1 \uB7A0\uB9AC / \uC0C1\uBC29 \uD0C4\uB825";
    badgeTag = "\uBC18\uB4F1 \uB7A0\uB9AC";
  } else if (kospi >= 1) {
    code = "MODERATE_BULL";
    statusName = "\uACAC\uC870\uD55C \uC0C1\uC2B9 / \uB9E4\uC218 \uC6B0\uC704";
    badgeTag = "\uACAC\uC870\uD55C \uC0C1\uC2B9";
  } else if (kospi >= 0.5) {
    code = "MILD_BULL";
    statusName = "\uC644\uB9CC\uD55C \uBC18\uB4F1 / \uC120\uBCC4 \uB9E4\uC218";
    badgeTag = "\uC644\uB9CC\uD55C \uBC18\uB4F1";
  } else if (kospi >= 0) {
    code = "TIGHT_BULL_SIDEWAYS";
    statusName = "\uAC15\uBCF4\uD569 \uD0D0\uC0C9 / \uB9E4\uBB3C \uC18C\uD654";
    badgeTag = "\uAC15\uBCF4\uD569 \uD0D0\uC0C9";
  } else if (kospi <= -2.5 || downRatio >= 0.85) {
    code = "PANIC_CRASH";
    statusName = "\uADF9\uB2E8\uC801 \uBCC0\uB3D9\uC131 / \uD328\uB2C9 \uD22C\uB9E4 \uACBD\uACC4";
    badgeTag = "\uD328\uB2C9 \uD22C\uB9E4 \uACBD\uACC4";
  } else if (kospi <= -2) {
    code = "HEAVY_DROP";
    statusName = "\uAC70\uC13C \uD558\uB77D \uCDA9\uACA9 / \uC9C0\uC9C0\uC120 \uC704\uD611";
    badgeTag = "\uAC70\uC13C \uD558\uB77D \uCDA9\uACA9";
  } else if (kospi <= -1.5 || downRatio >= 0.7) {
    code = "DEEP_BEAR";
    statusName = "\uAE09\uB77D \uC57D\uC138 / \uC804\uBC29\uC704 \uB9E4\uBB3C \uCD9C\uD68C";
    badgeTag = "\uAE09\uB77D \uC57D\uC138";
  } else if (kospi <= -1) {
    code = "MODERATE_BEAR";
    statusName = "\uBCF8\uACA9 \uC870\uC815 / \uD558\uBC29 \uC555\uB825";
    badgeTag = "\uBCF8\uACA9 \uC870\uC815";
  } else if (kospi <= -0.5) {
    code = "MILD_BEAR";
    statusName = "\uC644\uB9CC\uD55C \uC870\uC815 / \uB2E8\uAE30 \uB9E4\uBB3C \uCD9C\uD68C";
    badgeTag = "\uC644\uB9CC\uD55C \uC870\uC815";
  } else {
    code = "TIGHT_BEAR_SIDEWAYS";
    statusName = "\uC57D\uBCF4\uD569 \uD63C\uC870 / \uD6A1\uBCF4 \uC228\uACE0\uB974\uAE30";
    badgeTag = "\uC57D\uBCF4\uD569 \uD63C\uC870";
  }
  let slide1Subheadline = "";
  let slide1Tip = "";
  let slide4BannerTitle = "";
  let slide4BannerDesc = "";
  let slide6Block1Title = "";
  let slide6Block1Desc = "";
  let captionOpening = "";
  let captionMarketSummary = "";
  let captionThemeAnalysis = "";
  let captionWatchPoint = "";
  let threadsOpening = "";
  let threadsMarketSummary = "";
  let threadsWatchPoint = "";
  if (flow.character === "PARKING_SAFETY") {
    slide4BannerTitle = `\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, \uB2E8\uAE30\uC790\uAE08 \uBC0F \uAE08\uB9AC\uD615 \uC548\uC804\uC790\uC0B0 \uC9D1\uC911 \uC21C\uC720\uC785`;
    slide4BannerDesc = `\uC2DC\uC7A5 \uBCC0\uB3D9\uC131 \uACBD\uACC4\uAC10 \uC18D\uC5D0\uC11C \uC0C1\uC704 5\uC885\uBAA9\uC73C\uB85C \uCD1D ${flow.top5InflowSum.toLocaleString()}\uC5B5\uC6D0 \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785`;
  } else if (flow.character === "GROWTH_BETA") {
    slide4BannerTitle = `\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, \uB300\uD45C\uC9C0\uC218 \uBC0F \uD575\uC2EC \uC131\uC7A5 \uD14C\uB9C8\uB85C \uACF5\uACA9\uC801 \uC21C\uC720\uC785`;
    slide4BannerDesc = `\uC0C1\uBC29 \uBAA8\uBA58\uD140 \uD655\uC0B0 \uD750\uB984 \uC18D\uC5D0\uC11C \uC0C1\uC704 5\uC885\uBAA9\uC73C\uB85C \uCD1D ${flow.top5InflowSum.toLocaleString()}\uC5B5\uC6D0 \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785`;
  } else if (flow.character === "DIVIDEND_INCOME") {
    slide4BannerTitle = `\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, \uACE0\uBC30\uB2F9 \uBC0F \uC6D4\uC9C0\uAE09\uC2DD \uC778\uCEF4 ETF \uC120\uBCC4 \uC21C\uC720\uC785`;
    slide4BannerDesc = `\uBC29\uC5B4\uC801 \uD604\uAE08\uD750\uB984 \uD655\uBCF4 \uD750\uB984 \uC18D\uC5D0\uC11C \uC0C1\uC704 5\uC885\uBAA9\uC73C\uB85C \uCD1D ${flow.top5InflowSum.toLocaleString()}\uC5B5\uC6D0 \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785`;
  } else if (flow.character === "GLOBAL_MACRO") {
    slide4BannerTitle = `\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, \uAE00\uB85C\uBC8C \uCC44\uAD8C \uBC0F \uC6D0\uC790\uC7AC \uBD84\uC0B0 \uC790\uC0B0 \uC9D1\uC911 \uC21C\uC720\uC785`;
    slide4BannerDesc = `\uAE00\uB85C\uBC8C \uAC70\uC2DC \uB9AC\uC2A4\uD06C \uBD84\uC0B0 \uC18D\uC5D0\uC11C \uC0C1\uC704 5\uC885\uBAA9\uC73C\uB85C \uCD1D ${flow.top5InflowSum.toLocaleString()}\uC5B5\uC6D0 \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785`;
  } else {
    slide4BannerTitle = flow.secondItemName ? `\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, '${flow.topItemName}' \uBC0F '${flow.secondItemName}' \uC911\uC2EC \uC21C\uC720\uC785` : `\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, '${flow.topItemName}' \uB4F1 \uC0C1\uC704 \uC790\uC0B0 \uC911\uC2EC \uC21C\uC720\uC785`;
    slide4BannerDesc = `\uC120\uBCC4\uC801 \uBD84\uD560 \uB9E4\uC218\uC138 \uC18D\uC5D0\uC11C \uC0C1\uC704 5\uC885\uBAA9\uC73C\uB85C \uCD1D ${flow.top5InflowSum.toLocaleString()}\uC5B5\uC6D0 \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785`;
  }
  switch (code) {
    case "DECOUPLING_DEFENSE":
      slide1Subheadline = `'${topThemeName}' \uD14C\uB9C8 \uC120\uBC29 \uC18D ${flow.characterName} \uC21C\uC720\uC785 \uC9C0\uC18D`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uAD6D\uB0B4 \uC99D\uC2DC \uC57D\uC138 \uC18D \uAE00\uB85C\uBC8C \uBD84\uC0B0 \uBC0F \uCC44\uAD8C \uC790\uC0B0\uC758 \uBC29\uC5B4\uBCBD \uC791\uB3D9`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uC57D\uC138 \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uC790\uC0B0\uBC30\uBD84 \uC120\uBC29`;
      slide6Block1Desc = `\uAD6D\uB0B4 \uB300\uD615\uC8FC \uC870\uC815\uC73C\uB85C \uD558\uB77D \uC885\uBAA9 ${down}\uAC1C\uC774 \uC6B0\uC138\uD588\uC73C\uB098, \uAE00\uB85C\uBC8C \uD658\uB178\uCD9C \uBC0F \uAE08\uB9AC\uD615 ETF\uAC00 \uC9C0\uC218 \uD558\uB77D\uD3ED\uC744 \uC644\uCDA9\uD558\uBA70 \uACC4\uC88C \uC190\uC2E4\uC744 \uBC29\uC5B4.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uD558\uB77D\uD558\uBA70 \uC870\uC815\uC744 \uACAA\uC5C8\uC73C\uB098, \uC77C\uBC18 ETF \uC2DC\uC7A5\uC740 ${etfSign}${etfRet.toFixed(2)}%\uB85C \uC120\uBC29\uD558\uBA70 \uC790\uC0B0\uBC30\uBD84\uC758 \uC704\uB825\uC744 \uC785\uC99D\uD588\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uAD6D\uB0B4 \uC9C0\uC218 \uCD94\uC885 \uC885\uBAA9\uC5D0 \uB9E4\uBB3C\uC774 \uCD9C\uD68C\uB418\uC5C8\uC74C\uC5D0\uB3C4, \uAE00\uB85C\uBC8C \uC790\uC0B0\uACFC \uCC44\uAD8C\uD615 ETF\uB85C \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uAC00 \uC720\uC785\uB418\uBA70 \uC9C0\uC218 \uB099\uD3ED\uC744 \uD6A8\uACFC\uC801\uC73C\uB85C \uD761\uC218\uD588\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uD14C\uB9C8\uAC00 \uC9C0\uC218 \uB300\uBE44 \uB69C\uB837\uD55C \uC0C1\uB300\uC801 \uAC15\uC138\uB97C \uBCF4\uC778 \uBC18\uBA74, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uC139\uD130\uB294 \uB9E4\uB3C4 \uC555\uB825\uC744 \uBC1B\uC558\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uAD6D\uB0B4 \uC8FC\uC2DD \uC2DC\uC7A5\uC758 \uB2E8\uAE30 \uD754\uB4E4\uB9BC\uC5D0 \uD754\uB4E4\uB9AC\uC9C0 \uC54A\uACE0, \uAE00\uB85C\uBC8C \uC790\uC0B0\uACFC \uAE08\uB9AC\uD615 ETF\uB97C \uACE0\uB974\uAC8C \uBC30\uBD84\uD558\uB294 \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uC758 \uBC29\uC5B4\uB825\uC744 \uC810\uAC80\uD560 \uC2DC\uC810\uC785\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uB294 ${kospiSign}${kospi.toFixed(2)}% \uC870\uC815\uC744 \uBC1B\uC558\uC9C0\uB9CC, \uC77C\uBC18 ETF \uC2DC\uC7A5\uC740 ${etfSign}${etfRet.toFixed(2)}%\uB85C \uB4E0\uB4E0\uD558\uAC8C \uBC84\uD168\uC8FC\uC5C8\uC2B5\uB2C8\uB2E4.`;
      threadsMarketSummary = `\uAD6D\uB0B4 \uB2E8\uC77C \uC9C0\uC218\uB9CC \uBCF4\uBA74 \uD558\uB77D ${down}\uAC1C\uB85C \uBD88\uC548\uD560 \uC218 \uC788\uC5C8\uC9C0\uB9CC, \uD574\uC678 \uBD84\uC0B0\uACFC \uCC44\uAD8C\uD615 ETF\uAC00 \uCDA9\uACA9\uC744 \uC628\uC804\uD788 \uC644\uCDA9\uD574\uC8FC\uC5C8\uC5B4\uC694.`;
      threadsWatchPoint = `\uC9C0\uC218\uAC00 \uBE60\uC9C8 \uB54C \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uC758 \uC2E4\uC9C8 \uBC29\uC5B4\uB825\uC774 \uC5B4\uB5BB\uAC8C \uBC1C\uD718\uB418\uB294\uC9C0 \uD655\uC778\uD558\uB294 \uAC83\uC774 \uC9C4\uC9DC \uC790\uC0B0\uBC30\uBD84\uC758 \uBB18\uBBF8\uC785\uB2C8\uB2E4. \uC624\uB298 \uAC1C\uC7A5 \uD6C4 \uC5EC\uB7EC\uBD84\uC758 \uBC29\uC5B4\uC120\uC740 \uC5B4\uB514\uC5D0 \uB450\uACE0 \uACC4\uC2E0\uAC00\uC694?`;
      break;
    case "INDEX_ILLUSION_SURGE":
      slide1Subheadline = `'${topThemeName}' \uB3C5\uC8FC \uC18D \uB300\uD615\uC8FC \uC3E0\uB9BC \uC2EC\uD654`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uB300\uD615\uC8FC \uC3E0\uB9BC\uC5D0 \uB530\uB978 \uC9C0\uC218 \uCC29\uC2DC \uC18D \uBD84\uC0B0 ETF \uCC28\uBCC4\uD654`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uAE09\uB4F1 \uC18D \uB300\uD615\uC8FC \uC3E0\uB9BC`;
      slide6Block1Desc = `\uCF54\uC2A4\uD53C\uC640 \uBD84\uC0B0 ETF \uAC04 +${etfDivergence.toFixed(2)}%p \uACA9\uCC28 \uBC1C\uC0DD. \uC2DC\uCD1D \uC0C1\uC704\uC8FC \uC704\uC8FC \uC9C0\uC218 \uCC29\uC2DC \uC7A5\uC138.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uAE09\uB4F1\uD588\uC73C\uB098 \uCF54\uC2A4\uB2E5\uC740 ${kosdaqSign}${kosdaq.toFixed(2)}%, \uC77C\uBC18 ETF \uAC00\uC911\uC218\uC775\uB960\uC740 ${etfSign}${etfRet.toFixed(2)}%\uC5D0 \uBA38\uBB3C\uBA70 \uB300\uD615\uC8FC \uC3E0\uB9BC\uC5D0 \uB530\uB978 \uC9C0\uC218 \uCC29\uC2DC\uAC00 \uB69C\uB837\uD588\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uC2DC\uCD1D \uCD5C\uC0C1\uC704 \uB300\uD615\uC8FC\uB85C \uC218\uAE09\uC774 \uC9D1\uC911\uB418\uBA70 \uCF54\uC2A4\uD53C \uC9C0\uC218 \uC0C1\uC2B9\uD3ED \uB300\uBE44 \uBD84\uC0B0 ETF \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uC758 \uCCB4\uAC10 \uC218\uC775\uB960\uC740 \uC0C1\uB300\uC801\uC73C\uB85C \uCC28\uBD84\uD55C \uD750\uB984\uC744 \uB098\uD0C0\uB0C8\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uC139\uD130\uAC00 \uAC15\uC138\uB97C \uBCF4\uC774\uBA70 \uC9C0\uC218 \uC0C1\uC2B9\uC744 \uACAC\uC778\uD55C \uBC18\uBA74, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uD14C\uB9C8\uB294 \uC0C1\uB300\uC801\uC73C\uB85C \uC18C\uC678\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uB300\uD615\uC8FC \uC9D1\uC911 \uB7A0\uB9AC \uC774\uD6C4 \uC628\uAE30\uAC00 \uC911\uC18C\uD615\uC8FC\uC640 \uB2E4\uC591\uD55C \uD14C\uB9C8\uB85C \uD655\uC0B0\uB418\uB294\uC9C0, \uB610\uB294 \uCC28\uC775 \uC2E4\uD604 \uB9E4\uBB3C\uC774 \uCD9C\uD68C\uB418\uB294\uC9C0 \uC218\uAE09\uC758 \uBD84\uC0B0 \uC5EC\uBD80\uB97C \uD655\uC778\uD558\uB294 \uAC83\uC774 \uC911\uC694\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uB294 ${kospiSign}${kospi.toFixed(2)}% \uAE09\uB4F1\uD588\uC9C0\uB9CC, \uC77C\uBC18 ETF\uB294 ${etfSign}${etfRet.toFixed(2)}%\uB85C \uB300\uD615\uC8FC \uC911\uC2EC\uC758 \uC9C0\uC218 \uCC29\uC2DC\uAC00 \uB098\uD0C0\uB0AC\uC5B4\uC694.`;
      threadsMarketSummary = `\uCF54\uC2A4\uD53C\uC640 \uBD84\uC0B0 ETF \uC218\uC775\uB960 \uACA9\uCC28\uAC00 +${etfDivergence.toFixed(2)}%p\uC5D0 \uB2EC\uD574 \uC2DC\uCD1D \uC0C1\uC704\uC8FC \uC704\uC8FC\uB85C \uB9E4\uC218\uC138\uAC00 \uC9D1\uC911\uB41C \uC804\uD615\uC801\uC778 \uCC28\uBCC4\uD654 \uC7A5\uC138\uC600\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uB300\uD615\uC8FC \uB7A0\uB9AC \uC774\uD6C4 \uC628\uAE30\uAC00 \uC911\uC18C\uD615 \uD14C\uB9C8\uB85C \uACE0\uB974\uAC8C \uD655\uC0B0\uB418\uB294\uC9C0 \uAD00\uCC30\uD560 \uB54C\uC785\uB2C8\uB2E4. \uC624\uB298 \uC5EC\uB7EC\uBD84\uC758 \uAD00\uC2EC \uC139\uD130\uB294 \uC5B4\uB514\uC778\uAC00\uC694?`;
      break;
    case "BROAD_RALLY_SURGE":
      slide1Subheadline = `'${topThemeName}' \uD3ED\uB4F1 \uC18D \uC804\uBC29\uC704 \uB3D9\uBC18 \uC11C\uC9C0`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uB300\uD615\uC8FC\uC640 \uCF54\uC2A4\uB2E5 \uB3D9\uBC18 \uAE09\uB4F1 \uC18D \uC2DC\uC7A5 \uC804\uBC18 \uC720\uB3D9\uC131 \uD3ED\uBC1C`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uCD08\uAE09\uB4F1 \uC18D \uC804\uBC29\uC704 \uC11C\uC9C0`;
      slide6Block1Desc = `\uC0C1\uC2B9 \uC885\uBAA9 ${up}\uAC1C\uC774 75% \uC774\uC0C1\uC744 \uCC28\uC9C0\uD558\uBA70 \uC804 \uC139\uD130\uB85C \uC720\uB3D9\uC131\uC774 \uD655\uC0B0\uB418\uB294 \uAC15\uB825\uD55C \uB7A0\uB9AC \uC804\uAC1C.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}%, \uCF54\uC2A4\uB2E5\uC774 ${kosdaqSign}${kosdaq.toFixed(2)}% \uB3D9\uBC18 \uAE09\uB4F1\uD558\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC5D0 \uAC78\uCE5C \uAC15\uB825\uD55C \uC720\uB3D9\uC131 \uC11C\uC9C0 \uAD6D\uBA74\uC744 \uC5F0\uCD9C\uD588\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uD2B9\uC815 \uB300\uD615\uC8FC\uC5D0 \uAD6D\uD55C\uB418\uC9C0 \uC54A\uACE0 \uC77C\uBC18 ETF \uC2DC\uC7A5 \uC804\uCCB4\uB85C \uD3ED\uB113\uC740 \uC21C\uB9E4\uC218\uAC00 \uC720\uC785\uB418\uBA70 \uC0C1\uC2B9 \uC885\uBAA9 ${up}\uAC1C\uAC00 \uC2DC\uC7A5\uC744 \uC7A5\uC545\uD588\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uD14C\uB9C8\uAC00 \uD3ED\uB4F1\uC138\uB97C \uACAC\uC778\uD588\uACE0, \uB300\uBD80\uBD84\uC758 \uC139\uD130\uAC00 \uB3D9\uBC18 \uC0C1\uC2B9 \uD0C4\uB825\uC744 \uC774\uC5B4\uAC14\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uC804\uBC29\uC704 \uB7A0\uB9AC \uAD6D\uBA74\uC5D0\uC11C\uB294 \uCD94\uACA9 \uB9E4\uC218\uBCF4\uB2E4 \uACFC\uC5F4\uAD8C\uC5D0 \uC9C4\uC785\uD55C \uC139\uD130\uC758 \uC774\uACA9\uB3C4\uB97C \uC810\uAC80\uD558\uBA70 \uCC28\uBD84\uD788 \uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uBE44\uC911\uC744 \uC870\uC808\uD558\uB294 \uAC83\uC774 \uBC14\uB78C\uC9C1\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uC640 \uCF54\uC2A4\uB2E5\uC774 \uD568\uAED8 \uC2DC\uC6D0\uD558\uAC8C \uC624\uB974\uBA70 \uC2DC\uC7A5 \uC804\uCCB4\uC5D0 \uAC15\uD55C \uC720\uB3D9\uC131 \uB7A0\uB9AC\uAC00 \uD3BC\uCCD0\uC84C\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF \uC2DC\uC7A5\uB3C4 ${up}\uAC1C \uC885\uBAA9\uC774 \uC0C1\uC2B9\uD558\uBA70 \uC804 \uC139\uD130\uB85C \uC628\uAE30\uAC00 \uACE0\uB974\uAC8C \uD37C\uC84C\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uC804\uBC29\uC704 \uC0C1\uC2B9\uC7A5\uC77C\uC218\uB85D \uB2E8\uAE30 \uACFC\uC5F4\uC5D0 \uD729\uC4F8\uB9AC\uC9C0 \uC54A\uACE0 \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uC758 \uADE0\uD615\uC744 \uC810\uAC80\uD558\uB294 \uC5EC\uC720\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4. \uC624\uB298 \uC8FC\uBAA9\uD558\uC2DC\uB294 \uD14C\uB9C8\uB294 \uBB34\uC5C7\uC778\uAC00\uC694?`;
      break;
    case "GROWTH_BETA_RALLY":
      slide1Subheadline = `'${topThemeName}' \uC8FC\uB3C4 \uC18D \uC911\uC18C\uD615 \uC131\uC7A5\uC8FC \uB7A0\uB9AC`;
      slide1Tip = `\uCF54\uC2A4\uB2E5 ${kosdaqSign}${kosdaq.toFixed(2)}% \uC544\uC6C3\uD37C\uD3FC \xB7 \uCF54\uC2A4\uD53C \uB300\uBE44 +${Math.abs(capSpread).toFixed(2)}%p \uC131\uC7A5 \uD14C\uB9C8 \uC6B0\uC704`;
      slide6Block1Title = `\uCF54\uC2A4\uB2E5 ${kosdaqSign}${kosdaq.toFixed(2)}% \uAE09\uB4F1 \uC18D \uC131\uC7A5 \uD14C\uB9C8 \uC8FC\uB3C4`;
      slide6Block1Desc = `\uCF54\uC2A4\uB2E5\uC774 \uCF54\uC2A4\uD53C \uB300\uBE44 +${Math.abs(capSpread).toFixed(2)}%p \uC544\uC6C3\uD37C\uD3FC\uD558\uBA70 \uACE0\uBCA0\uD0C0 \uC131\uC7A5 \uD14C\uB9C8 \uC911\uC2EC \uAC15\uD55C \uD0C4\uB825.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uB2E5\uC774 ${kosdaqSign}${kosdaq.toFixed(2)}% \uAE09\uB4F1\uD558\uBA70 \uCF54\uC2A4\uD53C(${kospiSign}${kospi.toFixed(2)}%) \uB300\uBE44 +${Math.abs(capSpread).toFixed(2)}%p \uC55E\uC11C\uB294 \uC131\uC7A5 \uD14C\uB9C8 \uC8FC\uB3C4 \uC7A5\uC138\uB97C \uAE30\uB85D\uD588\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uB300\uD615\uC8FC\uAC00 \uC228\uC744 \uACE0\uB974\uB294 \uB3D9\uC548 \uC911\uC18C\uD615 \uAE30\uC220\uC8FC\uC640 \uBAA8\uBA58\uD140 \uD14C\uB9C8\uAD70\uC73C\uB85C \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uAC00 \uC9D1\uC911\uB418\uBA70 \uC2DC\uC7A5\uC758 \uC628\uAE30\uB97C \uC774\uB04C\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uB4F1 \uACE0\uBCA0\uD0C0 \uC131\uC7A5 \uC139\uD130\uAC00 \uC2DC\uC7A5\uC744 \uACAC\uC778\uD558\uBA70 \uD65C\uBC1C\uD55C \uD14C\uB9C8 \uB7A0\uB9AC\uAC00 \uD3BC\uCCD0\uC84C\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uC911\uC18C\uD615 \uC131\uC7A5\uC8FC \uC8FC\uB3C4 \uAD6D\uBA74\uC5D0\uC11C\uB294 \uD14C\uB9C8\uBCC4 \uBCC0\uB3D9\uC131\uC774 \uBE60\uB974\uAC8C \uD655\uB300\uB420 \uC218 \uC788\uC73C\uBBC0\uB85C \uAC70\uB798\uB300\uAE08\uC758 \uC9C0\uC18D\uC131\uC744 \uC810\uAC80\uD558\uB294 \uAC83\uC774 \uC720\uB9AC\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uB2E5\uC774 ${kosdaqSign}${kosdaq.toFixed(2)}% \uC624\uB974\uBA70 \uB300\uD615\uC8FC\uBCF4\uB2E4 \uD6E8\uC52C \uAC15\uD55C \uC131\uC7A5 \uD14C\uB9C8 \uC7A5\uC138\uB97C \uC5F0\uCD9C\uD588\uC5B4\uC694.`;
      threadsMarketSummary = `\uCF54\uC2A4\uD53C \uB300\uBE44 +${Math.abs(capSpread).toFixed(2)}%p \uC544\uC6C3\uD37C\uD3FC\uD558\uBA70 \uAE30\uC220\uC8FC\uC640 \uD575\uC2EC \uD14C\uB9C8 ETF\uB85C \uC790\uAE08\uC774 \uD798\uCC28\uAC8C \uC720\uC785\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uC131\uC7A5 \uD14C\uB9C8\uAC00 \uD0C4\uB825\uC744 \uBC1B\uC744 \uB54C\uB294 \uAC1C\uBCC4 \uC139\uD130\uC758 \uCCB4\uB825\uACFC \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uC758 \uC9C0\uC18D\uC131\uC744 \uC798 \uBD84\uBCC4\uD574\uBCF4\uC138\uC694. \uC624\uB298 \uAC00\uC7A5 \uAE30\uB300\uB418\uB294 \uC139\uD130\uB294 \uC5B4\uB514\uC778\uAC00\uC694?`;
      break;
    case "KOSPI_FALL_KOSDAQ_UP":
      slide1Subheadline = `'${topThemeName}' \uC120\uBC29 \uC18D \uCF54\uC2A4\uB2E5 \uAC1C\uBCC4 \uC7A5\uC138`;
      slide1Tip = `\uB300\uD615\uC8FC \uC870\uC815 \uC18D \uCF54\uC2A4\uB2E5 ${kosdaqSign}${kosdaq.toFixed(2)}% \uBC18\uB4F1 \xB7 \uAC1C\uBCC4 \uD14C\uB9C8 \uC911\uC2EC \uC21C\uD658\uB9E4 \uBD84\uD560 \uC720\uC785`;
      slide6Block1Title = `\uB300\uD615\uC8FC \uC870\uC815 \uC18D \uCF54\uC2A4\uB2E5 \uAC1C\uBCC4 \uD14C\uB9C8 \uC120\uBC29`;
      slide6Block1Desc = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uD558\uB77D\uC5D0\uB3C4 \uCF54\uC2A4\uB2E5 ${kosdaqSign}${kosdaq.toFixed(2)}% \uC120\uBC29\uD558\uBA70 \uD14C\uB9C8\uBCC4 \uB69C\uB837\uD55C \uAC01\uAC1C\uC804\uD22C \uC804\uAC1C.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uB300\uD615\uC8FC \uC911\uC2EC\uC758 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uBC00\uB838\uC73C\uB098, \uCF54\uC2A4\uB2E5\uC740 ${kosdaqSign}${kosdaq.toFixed(2)}% \uC0C1\uC2B9\uD558\uBA70 \uB69C\uB837\uD55C \uC9C0\uC218 \uC5C7\uAC08\uB9BC\uACFC \uAC1C\uBCC4 \uC7A5\uC138\uAC00 \uC5F0\uCD9C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uB300\uD615\uC8FC \uB9E4\uBB3C \uCD9C\uD68C\uC5D0 \uB530\uB978 \uC9C0\uC218 \uD558\uB77D \uC555\uB825\uC744 \uC911\uC18C\uD615 \uC131\uC7A5 \uD14C\uB9C8\uAD70\uC774 \uD761\uC218\uD558\uBA70 \uC120\uBCC4\uC801 \uC885\uBAA9 \uC7A5\uC138\uAC00 \uC804\uAC1C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uD14C\uB9C8\uAC00 \uC9C0\uC218 \uBD80\uC9C4\uC744 \uB51B\uACE0 \uC120\uBC29\uD55C \uBC18\uBA74, \uB300\uD615\uC8FC \uBE44\uC911\uC774 \uB192\uC740 \uC139\uD130\uB294 \uC870\uC815\uC744 \uBC1B\uC558\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uC9C0\uC218 \uAC04 \uC5C7\uAC08\uB9BC\uC774 \uB098\uD0C0\uB0A0 \uB54C\uB294 \uBCA4\uCE58\uB9C8\uD06C \uC9C0\uC218\uBCF4\uB2E4 \uAC1C\uBCC4 \uC139\uD130\uC758 \uC218\uAE09\uACFC \uC774\uC775 \uBAA8\uBA58\uD140\uC744 \uC120\uBCC4\uD558\uB294 \uC804\uB7B5\uC774 \uC694\uAD6C\uB429\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uB294 ${kospiSign}${kospi.toFixed(2)}% \uBC00\uB838\uC9C0\uB9CC, \uCF54\uC2A4\uB2E5\uC740 ${kosdaqSign}${kosdaq.toFixed(2)}% \uC624\uB974\uBA70 \uC2DC\uC7A5 \uBD84\uC704\uAE30\uAC00 \uC5C7\uAC08\uB838\uC5B4\uC694.`;
      threadsMarketSummary = `\uB300\uD615\uC8FC\uAC00 \uC228\uC744 \uACE0\uB974\uB294 \uC0AC\uC774 \uC911\uC18C\uD615 \uD14C\uB9C8\uC640 \uC120\uBCC4 ETF\uB85C \uC790\uAE08\uC774 \uC720\uC785\uB418\uBA70 \uC54C\uCC2C \uAC1C\uBCC4 \uC7A5\uC138\uAC00 \uD3BC\uCCD0\uC84C\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uC9C0\uC218\uAC00 \uC5C7\uAC08\uB9B4 \uB54C\uB294 \uC9C0\uC218 \uC790\uCCB4\uBCF4\uB2E4 \uC139\uD130 \uAC04 \uC790\uAE08 \uC774\uB3D9\uC758 \uAE38\uBAA9\uC744 \uC9C0\uD0A4\uB294 \uAC83\uC774 \uC720\uD6A8\uD569\uB2C8\uB2E4. \uC624\uB298 \uC5EC\uB7EC\uBD84\uC758 \uAD00\uC2EC \uC9C0\uD45C\uB294 \uBB34\uC5C7\uC778\uAC00\uC694?`;
      break;
    case "EXTREME_SURGE":
      slide1Subheadline = `'${topThemeName}' \uD3ED\uB4F1 \uC18D ${flow.characterName} \uC20F\uC2A4\uD034\uC988 \uBC0F \uB9E4\uC218 \uD3ED\uBC1C`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uC5ED\uC0AC\uC801 \uC11C\uC9C0 \uC18D \uACFC\uC5F4 \uC9C0\uD45C \uC810\uAC80 \uBC0F \uBD84\uD560 \uCC28\uC775\uC2E4\uD604 \uAD00\uC810`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uCD08\uAE09\uB4F1 \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uC804\uBC29\uC704 \uD3ED\uB4F1`;
      slide6Block1Desc = `\uC0C1\uC2B9 \uC885\uBAA9 ${up}\uAC1C\uC774 \uC555\uB3C4\uC801\uC778 \uC11C\uC9C0 \uB7A0\uB9AC\uB97C \uAE30\uB85D\uD558\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC5D0 \uD3ED\uBC1C\uC801\uC778 \uC790\uAE08 \uC720\uC785 \uC804\uAC1C. \uB2E8\uAE30 \uC774\uACA9 \uACFC\uC5F4\uC5D0 \uB530\uB978 \uCC28\uC775\uC2E4\uD604 \uBB3C\uB7C9 \uC810\uAC80 \uD544\uC694.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 \uBB34\uB824 ${kospiSign}${kospi.toFixed(2)}% \uD3ED\uB4F1\uD558\uBA70 \uC774\uB840\uC801\uC778 \uCD08\uAE09\uB4F1 \uC11C\uC9C0 \uAD6D\uBA74\uC744 \uC5F0\uCD9C\uD588\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5\uC5D0\uC11C\uB3C4 \uC0C1\uC2B9 ${up}\uAC1C\uB85C \uD3ED\uBC1C\uC801\uC778 \uB9E4\uC218\uC138\uAC00 \uC2DC\uC7A5\uC744 \uC7A5\uC545\uD588\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uAE30\uAD00\uACFC \uC678\uC778\uC758 \uAC15\uB825\uD55C \uC20F\uC2A4\uD034\uC988\uC640 \uD328\uC2DC\uBE0C \uB9E4\uC218\uC138\uAC00 \uB9DE\uBB3C\uB9AC\uBA70 \uC9C0\uC218 \uB300\uD615\uC8FC\uC640 \uC8FC\uB3C4 \uD14C\uB9C8 \uC804\uBC18\uC73C\uB85C \uD3ED\uBC1C\uC801\uC778 \uC218\uAE09 \uC3E0\uB9BC\uC774 \uB098\uD0C0\uB0AC\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uC139\uD130\uAC00 \uD3ED\uB4F1\uC138\uB97C \uACAC\uC778\uD558\uBA70 \uC9C0\uC218 \uC0C1\uC2B9\uC744 \uC8FC\uB3C4\uD55C \uBC18\uBA74, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uD14C\uB9C8\uC870\uCC28 \uD558\uBC29 \uACBD\uC9C1\uC131\uC744 \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uCD08\uAE09\uB4F1 \uAD6D\uBA74\uC5D0\uC11C\uB294 \uCD94\uACA9 \uB9E4\uC218\uC758 \uC2E4\uC775\uBCF4\uB2E4 \uB2E8\uAE30 \uC774\uACA9 \uACFC\uC5F4\uC5D0 \uB530\uB978 \uBCC0\uB3D9\uC131\uC5D0 \uC720\uC758\uD558\uBA70, \uBCF4\uC720 \uBE44\uC911\uC758 \uC77C\uBD80\uB97C \uBD84\uD560 \uC775\uC808\uD558\uAC70\uB098 \uB9AC\uBC38\uB7F0\uC2F1\uD558\uB294 \uC804\uB7B5\uC774 \uC720\uD6A8\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uD3ED\uB4F1\uD558\uBA70 \uC2DC\uC7A5\uC774 \uC5C4\uCCAD\uB09C \uC0C1\uC2B9 \uC11C\uC9C0\uB97C \uAE30\uB85D\uD588\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF \uC2DC\uC7A5\uB3C4 \uC0C1\uC2B9 \uC885\uBAA9\uC774 ${up}\uAC1C\uC5D0 \uB2EC\uD558\uBA70 \uC804\uB840 \uC5C6\uB294 \uAC15\uD55C \uB9E4\uC218 \uD3ED\uBC1C\uC774 \uC77C\uC5B4\uB0AC\uC2B5\uB2C8\uB2E4. \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uB3C4 \uC8FC\uB3C4\uC8FC\uB85C \uACF5\uACA9\uC801\uC73C\uB85C \uC720\uC785\uB418\uC5C8\uC5B4\uC694.`;
      threadsWatchPoint = `\uC5ED\uB300\uAE09 \uD3ED\uB4F1\uC7A5\uC77C\uC218\uB85D \uD765\uBD84\uC744 \uAC00\uB77C\uC549\uD788\uACE0 \uAE30\uC220\uC801 \uACFC\uC5F4 \uC9C0\uD45C\uC640 \uBD84\uD560 \uCC28\uC775\uC2E4\uD604 \uD0C0\uC774\uBC0D\uC744 \uCE68\uCC29\uD558\uAC8C \uC810\uAC80\uD558\uB294 \uAC83\uC774 \uC911\uC694\uD569\uB2C8\uB2E4. \uC624\uB298 \uC5EC\uB7EC\uBD84\uC758 \uB300\uC751 \uC804\uB7B5\uC740 \uBB34\uC5C7\uC778\uAC00\uC694?`;
      break;
    case "SUPER_BULL":
      slide1Subheadline = `'${topThemeName}' \uB7A0\uB9AC \uC8FC\uB3C4 \uC18D ${flow.characterName} \uACF5\uACA9\uC801 \uC720\uC785`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uB300\uD615 \uC131\uC7A5\uC8FC \uBC0F \uACE0\uBCA0\uD0C0 \uC790\uC0B0 \uC911\uC2EC\uC73C\uB85C \uAD11\uBC94\uC704\uD55C \uC0C1\uC2B9 \uD3ED\uBC1C`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uC288\uD37C \uB7A0\uB9AC \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uB3D9\uBC18 \uAE09\uB4F1`;
      slide6Block1Desc = `\uC0C1\uC2B9 \uC885\uBAA9 ${up}\uAC1C\uC774 \uC555\uB3C4\uC801\uC778 \uC6B0\uC704\uB97C \uC810\uD558\uBA70 \uC9C0\uC218 \uB808\uBC84\uB9AC\uC9C0\uC640 \uACE0\uBCA0\uD0C0 \uD14C\uB9C8 \uC804\uBC18\uC73C\uB85C \uC0C1\uBC29 \uBAA8\uBA58\uD140 \uAE09\uACA9\uD788 \uAC00\uC18D\uD654.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uAE09\uB4F1\uD558\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC5D0 \uAC15\uB825\uD55C \uC288\uD37C \uB7A0\uB9AC\uAC00 \uD3BC\uCCD0\uC84C\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5 \uC5ED\uC2DC ${up}\uAC1C \uC885\uBAA9\uC774 \uC0C1\uC2B9\uD558\uBA70 \uB728\uAC70\uC6B4 \uC5F4\uAE30\uB97C \uBFDC\uC5B4\uB0C8\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uB300\uD615 \uC131\uC7A5\uC8FC\uC640 \uB300\uD45C\uC9C0\uC218 ETF\uB85C \uB300\uADDC\uBAA8 \uC678\uC778\xB7\uAE30\uAD00 \uB3D9\uBC18 \uC21C\uB9E4\uC218\uAC00 \uC9D1\uC911\uB418\uBA70 \uC9C0\uC218\uC758 \uC0C1\uBC29 \uD0C4\uB825\uC774 \uAE09\uACA9\uD788 \uD655\uB300\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uD14C\uB9C8\uAC00 \uC2DC\uC7A5 \uC804\uBC18\uC758 \uC0C1\uC2B9 \uB7A0\uB9AC\uB97C \uC8FC\uB3C4\uD588\uACE0, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uC139\uD130\uB294 \uC18C\uD3ED \uC228\uC744 \uACE0\uB974\uB294 \uB370 \uADF8\uCCE4\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uC288\uD37C \uB7A0\uB9AC\uC5D0\uC11C\uB294 \uC0C1\uBC29 \uBAA8\uBA58\uD140\uC758 \uC9C0\uC18D\uC131\uC744 \uC0B4\uD53C\uB418, \uACE0\uBCA0\uD0C0 \uC885\uBAA9\uC758 \uBCC0\uB3D9\uC131 \uD655\uB300\uC5D0 \uB300\uBE44\uD55C \uBD84\uC0B0 \uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uC720\uC9C0\uAC00 \uD604\uBA85\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uC2DC\uC6D0\uD558\uAC8C \uBED7\uC5B4\uB098\uAC00\uBA70 \uAC15\uB825\uD55C \uC288\uD37C \uB7A0\uB9AC\uB97C \uC644\uC131\uD588\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF 1,025\uAC1C \uC911 ${up}\uAC1C\uAC00 \uC624\uB974\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC5D0 \uAC15\uD55C \uD6C8\uD48D\uC774 \uBD88\uC5C8\uC2B5\uB2C8\uB2E4. \uB300\uD45C\uC9C0\uC218\uC640 \uD575\uC2EC \uC131\uC7A5 \uD14C\uB9C8\uB85C \uC790\uAE08\uC774 \uC9D1\uC911\uB418\uC5C8\uC5B4\uC694.`;
      threadsWatchPoint = `\uC0C1\uBC29 \uBAA8\uBA58\uD140\uC774 \uAC70\uC138\uAC8C \uBD84\uCD9C\uB420 \uB54C\uB294 \uB2E8\uAE30 \uC218\uC775\uB960\uC5D0 \uB9E4\uBAB0\uB418\uAE30\uBCF4\uB2E4 \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uC758 \uADE0\uD615\uC744 \uC810\uAC80\uD558\uB294 \uC5EC\uC720\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4. \uC624\uB298 \uC2DC\uC7A5\uC5D0\uC11C \uAC00\uC7A5 \uAE30\uB300\uB418\uB294 \uC139\uD130\uB294 \uC5B4\uB514\uC778\uAC00\uC694?`;
      break;
    case "STRONG_BULL_HIGH":
      slide1Subheadline = `'${topThemeName}' \uD14C\uB9C8 \uACAC\uC778 \uC18D ${flow.characterName} \uC804\uBC29\uC704 \uB9E4\uC218\uC138`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uC678\uC778\xB7\uAE30\uAD00 \uC591\uB9E4\uC218 \uC8FC\uB3C4\uB85C \uB300\uD615\uC8FC \uBC0F \uC911\uC18C\uD615 \uD14C\uB9C8 \uC804\uBC18 \uC628\uAE30 \uD655\uC0B0`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uAC15\uD55C \uB7A0\uB9AC \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uB3D9\uBC18 \uC0C1\uC2B9`;
      slide6Block1Desc = `\uC0C1\uC2B9 \uC885\uBAA9 ${up}\uAC1C\uC774 75% \uC774\uC0C1\uC744 \uCC28\uC9C0\uD558\uBA70 \uC8FC\uB3C4 \uC131\uC7A5\uC8FC\uBD80\uD130 \uB099\uD3ED\uACFC\uB300 \uC139\uD130\uAE4C\uC9C0 \uD3ED\uB113\uC740 \uB9E4\uC218\uC138 \uC720\uC785.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uD070 \uD3ED\uC73C\uB85C \uC624\uB974\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC73C\uB85C \uC628\uAE30\uAC00 \uBE60\uB974\uAC8C \uD655\uC0B0\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5\uC5D0\uC11C\uB3C4 \uC0C1\uC2B9 ${up}\uAC1C\uB85C \uD655\uACE0\uD55C \uB9E4\uC218 \uC6B0\uC704\uAC00 \uB098\uD0C0\uB0AC\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uC678\uC778\uACFC \uAE30\uAD00\uC758 \uAC15\uB825\uD55C \uB3D9\uBC18 \uC21C\uB9E4\uC218\uAC00 \uC720\uC785\uB418\uBA70 \uB300\uD615\uC8FC\uBFD0\uB9CC \uC544\uB2C8\uB77C \uC911\uC18C\uD615 \uC131\uC7A5 \uD14C\uB9C8\uAD70\uAE4C\uC9C0 \uD3ED\uB113\uC740 \uC218\uAE09 \uC720\uC785\uC774 \uC804\uAC1C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uC139\uD130\uAC00 \uACAC\uC870\uD55C \uB9E4\uC218\uC138\uB97C \uD761\uC218\uD558\uBA70 \uAC15\uC138\uB97C \uBCF4\uC600\uACE0, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uD14C\uB9C8\uB294 \uC0C1\uB300\uC801\uC73C\uB85C \uC81C\uD55C\uB41C \uC6C0\uC9C1\uC784\uC744 \uB098\uD0C0\uB0C8\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uAD11\uBC94\uC704\uD55C \uC0C1\uC2B9\uC7A5\uC5D0\uC11C\uB294 \uC8FC\uB3C4 \uD14C\uB9C8\uC758 \uAC70\uB798\uB300\uAE08 \uD68C\uC804\uC728\uACFC \uC2E4\uC9C8 \uC790\uAE08 \uC720\uC785\uC758 \uC5F0\uC18D\uC131\uC744 \uCCB4\uD06C\uD558\uB294 \uAC83\uC774 \uC720\uB9AC\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uC0C1\uC2B9\uD558\uBA70 \uC2DC\uC7A5 \uACF3\uACF3\uC73C\uB85C \uB530\uB73B\uD55C \uC628\uAE30\uAC00 \uD655\uC0B0\uB418\uC5C8\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF \uC2DC\uC7A5\uB3C4 ${up}\uAC1C \uC885\uBAA9\uC774 \uC0C1\uC2B9\uD558\uBA70 \uC804\uBC29\uC704 \uB9E4\uC218\uC138\uAC00 \uC9C0\uC218\uB97C \uB4E0\uB4E0\uD558\uAC8C \uBC1B\uCCE4\uC2B5\uB2C8\uB2E4. \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uC758 \uC720\uC785\uB3C4 \uB9E4\uC6B0 \uD65C\uBC1C\uD588\uC5B4\uC694.`;
      threadsWatchPoint = `\uC628\uAE30\uAC00 \uC2DC\uC7A5 \uC804\uCCB4\uB85C \uD37C\uC9C8 \uB54C \uC8FC\uB3C4 \uC139\uD130\uC640 \uD6C4\uBC1C \uC139\uD130\uC758 \uC21C\uD658\uB9E4 \uD750\uB984\uC744 \uC720\uC2EC\uD788 \uAD00\uCC30\uD574\uBCF4\uC138\uC694. \uC624\uB298 \uC5EC\uB7EC\uBD84\uC774 \uC8FC\uBAA9\uD558\uB294 \uD14C\uB9C8\uB294 \uBB34\uC5C7\uC778\uAC00\uC694?`;
      break;
    case "STRONG_BULL":
      slide1Subheadline = `'${topThemeName}' \uD14C\uB9C8 \uC8FC\uB3C4 \uC18D ${flow.characterName} \uC720\uC785 \uD655\uC0B0`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uD575\uC2EC \uC131\uC7A5 \uC139\uD130 \uC911\uC2EC\uC758 \uACAC\uC870\uD55C \uC624\uB984\uC138 \uBC0F \uC0C1\uBC29 \uBAA8\uBA58\uD140 \uD0C4\uB825`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uAE09\uB4F1 \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uB3D9\uBC18 \uB7A0\uB9AC`;
      slide6Block1Desc = `\uC678\uC778\xB7\uAE30\uAD00\uC758 \uC801\uADF9\uC801\uC778 \uC21C\uB9E4\uC218 \uC720\uC785\uC73C\uB85C \uC0C1\uC2B9 \uC885\uBAA9 ${up}\uAC1C\uC774 \uC2DC\uC7A5 \uC804\uBC18\uC758 \uC0C1\uC2B9 \uC5F4\uAE30\uB97C \uACAC\uC778.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uAE09\uB4F1\uD558\uBA70 \uAC15\uB825\uD55C \uBC18\uB4F1 \uB7A0\uB9AC\uB97C \uD3BC\uCCE4\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5 \uC5ED\uC2DC \uC0C1\uC2B9 ${up}\uAC1C\uB85C \uC2DC\uC7A5 \uC804\uBC18\uC5D0 \uAD11\uBC94\uC704\uD55C \uC628\uAE30\uAC00 \uB3CC\uC558\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uC678\uC778\uACFC \uAE30\uAD00\uC758 \uB3D9\uBC18 \uC21C\uB9E4\uC218\uAC00 \uC720\uC785\uB418\uBA70 \uD575\uC2EC \uC131\uC7A5 \uD14C\uB9C8 \uBC0F \uB300\uD45C\uC9C0\uC218 \uC804\uBC18\uC73C\uB85C \uAC15\uD55C \uC218\uAE09 \uBAA8\uBA58\uD140\uC774 \uC774\uC5B4\uC84C\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uD14C\uB9C8\uAC00 \uAC15\uD55C \uAC70\uB798\uB300\uAE08\uC744 \uB3D9\uBC18\uD558\uBA70 \uC0C1\uC2B9\uC744 \uC774\uB04C\uC5C8\uACE0, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uB4F1 \uC77C\uBD80 \uC18C\uC678 \uC139\uD130\uB9CC \uC81C\uD55C\uC801\uC778 \uC870\uC815\uC744 \uBC1B\uC558\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uC0C1\uC2B9 \uB7A0\uB9AC \uAD6D\uBA74\uC5D0\uC11C\uB294 \uBB34\uB9AC\uD55C \uCD94\uACA9 \uB9E4\uC218\uBCF4\uB2E4 \uC8FC\uB3C4 \uD14C\uB9C8\uC758 \uAC70\uB798\uB300\uAE08 \uC720\uC9C0 \uC5EC\uBD80\uC640 \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uC758 \uC2E4\uC9C8 \uC21C\uC720\uC785 \uC5F0\uC18D\uC131\uC744 \uBD84\uBCC4\uD558\uB294 \uAC83\uC774 \uBC14\uB78C\uC9C1\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uC2DC\uC6D0\uD558\uAC8C \uC624\uB974\uBA70 \uAC15\uD55C \uBC18\uB4F1\uC5D0 \uC131\uACF5\uD588\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF 1,025\uAC1C \uC911 ${up}\uAC1C\uAC00 \uC624\uB974\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC5D0 \uD6C8\uD48D\uC774 \uBD88\uC5C8\uACE0, \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uB3C4 \uC9C0\uC218\uD615 \uBC0F \uC8FC\uB3C4 \uD14C\uB9C8\uB85C \uD798\uCC28\uAC8C \uC720\uC785\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uAC15\uD55C \uBC18\uB4F1\uC7A5\uC77C\uC218\uB85D \uD14C\uB9C8\uC758 \uAC70\uB798\uB300\uAE08\uACFC \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785 \uC9C0\uC18D\uC131\uC744 \uCC28\uBD84\uD788 \uBD84\uBCC4\uD558\uB294 \uD0DC\uB3C4\uAC00 \uC911\uC694\uD569\uB2C8\uB2E4. \uC624\uB298 \uAC1C\uC7A5 \uD6C4 \uC5EC\uB7EC\uBD84\uC774 \uC8FC\uBAA9\uD558\uB294 \uC8FC\uB3C4\uC8FC\uB294 \uC5B4\uB514\uC778\uAC00\uC694?`;
      break;
    case "MODERATE_BULL":
      slide1Subheadline = `'${topThemeName}' \uD14C\uB9C8 \uC0C1\uC2B9 \uC8FC\uB3C4 \uC18D ${flow.characterName} \uC548\uC815\uC801 \uC720\uC785`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uC8FC\uB3C4 \uC139\uD130 \uACAC\uC778 \uBC0F \uC591\uD638\uD55C \uC2DC\uC7A5 \uD3ED\uC73C\uB85C \uC9C0\uC218 \uC0C1\uC2B9 \uD0C4\uB825 \uC720\uC9C0`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uACAC\uC870\uD55C \uC0C1\uC2B9 \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uB9E4\uC218 \uC6B0\uC704`;
      slide6Block1Desc = `\uC0C1\uC2B9 \uC885\uBAA9 ${up}\uAC1C\uC774 \uC6B0\uC704\uB97C \uC720\uC9C0\uD558\uBA70 \uC8FC\uB3C4 \uD14C\uB9C8\uB97C \uC911\uC2EC\uC73C\uB85C \uC9C0\uC218 \uC0C1\uBC29 \uD0C4\uB825\uC774 \uC548\uC815\uC801\uC73C\uB85C \uC774\uC5B4\uC9C0\uB294 \uD750\uB984 \uC804\uAC1C.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uC624\uB974\uBA70 \uACAC\uC870\uD55C \uC0C1\uC2B9\uC138\uB97C \uC774\uC5B4\uAC14\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5\uC5D0\uC11C\uB3C4 \uC0C1\uC2B9 ${up}\uAC1C\uB85C \uC548\uC815\uC801\uC778 \uB9E4\uC218 \uC6B0\uC704 \uC7A5\uC138\uAC00 \uD3BC\uCCD0\uC84C\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uC8FC\uB3C4 \uD14C\uB9C8\uC640 \uB300\uD45C\uC9C0\uC218 ETF\uB85C \uAFB8\uC900\uD55C \uC790\uAE08 \uC720\uC785\uC774 \uC9C0\uC18D\uB418\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC758 \uC0C1\uC2B9 \uD0C4\uB825\uC774 \uD0C4\uD0C4\uD558\uAC8C \uC720\uC9C0\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uC139\uD130\uAC00 \uC548\uC815\uC801\uC778 \uC624\uB984\uC138\uB85C \uC2DC\uC7A5\uC744 \uC774\uB04C\uC5C8\uACE0, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uD14C\uB9C8\uB294 \uBCF4\uD569\uAD8C\uC5D0\uC11C \uB9E4\uBB3C\uC744 \uC18C\uD654\uD588\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uACAC\uC870\uD55C \uC0C1\uC2B9 \uAD6D\uBA74\uC5D0\uC11C\uB294 \uC2DC\uC7A5\uC758 \uC9C0\uC218 \uC0C1\uC2B9\uD3ED\uACFC \uB354\uBD88\uC5B4 \uC790\uAE08\uC774 \uC9D1\uC911\uB418\uB294 \uC8FC\uB3C4 \uD14C\uB9C8\uC758 \uC774\uC775 \uBAA8\uBA58\uD140\uC744 \uD655\uC778\uD558\uB294 \uAC83\uC774 \uC88B\uC2B5\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uB294 ${kospiSign}${kospi.toFixed(2)}% \uACAC\uC870\uD558\uAC8C \uC624\uB974\uBA70 \uC548\uC815\uC801\uC778 \uB9E4\uC218\uC138\uB97C \uC720\uC9C0\uD588\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF \uC2DC\uC7A5\uB3C4 ${up}\uAC1C \uC885\uBAA9\uC774 \uC0C1\uC2B9\uD558\uBA70 \uC8FC\uB3C4 \uD14C\uB9C8\uB97C \uC911\uC2EC\uC73C\uB85C \uD0C4\uD0C4\uD55C \uC0C1\uBC29 \uD0C4\uB825\uC744 \uBCF4\uC5EC\uC8FC\uC5C8\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uC548\uC815\uC801\uC778 \uC0C1\uC2B9 \uD750\uB984 \uC18D\uC5D0\uC11C \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uAC00 \uC5B4\uB5A4 \uC139\uD130\uB97C \uB2E4\uC74C \uD0C0\uAE43\uC73C\uB85C \uC0BC\uACE0 \uC788\uB294\uC9C0 \uAD00\uCC30\uD574\uBCF4\uC138\uC694. \uC624\uB298 \uC5EC\uB7EC\uBD84\uC758 \uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uD575\uC2EC\uC740 \uC5B4\uB514\uC778\uAC00\uC694?`;
      break;
    case "MILD_BULL":
      slide1Subheadline = `'${topThemeName}' \uD14C\uB9C8 \uC911\uC2EC \uBC18\uB4F1 \uC18D ${flow.characterName} \uC218\uAE09 \uC548\uC815`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uC8FC\uB3C4 \uC139\uD130 \uC911\uC2EC\uC758 \uC120\uBCC4\uC801 \uBC18\uB4F1\uACFC \uD558\uBC29 \uACBD\uC9C1\uC131 \uD655\uBCF4`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uBC18\uB4F1 \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uC644\uB9CC\uD55C \uC0C1\uC2B9`;
      slide6Block1Desc = `\uC0C1\uC2B9 \uC885\uBAA9 ${up}\uAC1C\uC774 \uC6B0\uC704\uB97C \uBCF4\uC774\uBA70 \uC8FC\uB3C4 \uD14C\uB9C8\uB97C \uC911\uC2EC\uC73C\uB85C \uC9C0\uC218 \uD558\uBC29 \uACBD\uC9C1\uC131\uC744 \uB2E4\uC9C0\uB294 \uC548\uC815\uC801 \uD750\uB984 \uC804\uAC1C.`;
      captionOpening = `\uCF54\uC2A4\uD53C\uB294 ${kospiSign}${kospi.toFixed(2)}% \uC0C1\uC2B9\uD558\uBA70 \uAE0D\uC815\uC801\uC778 \uD750\uB984\uC744 \uB098\uD0C0\uB0C8\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5\uC5D0\uC11C\uB3C4 \uC0C1\uC2B9 ${up}\uAC1C\uB85C \uB9E4\uC218 \uC6B0\uC704\uC758 \uC628\uAE30\uAC00 \uAC10\uB3CC\uC558\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uC8FC\uB3C4 \uC139\uD130\uB97C \uC911\uC2EC\uC73C\uB85C \uC120\uBCC4\uC801 \uB9E4\uC218\uC138\uAC00 \uC774\uC5B4\uC9C0\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC758 \uBCC0\uB3D9\uC131\uC744 \uB0AE\uCD94\uACE0 \uC548\uC815\uC801\uC778 \uBC18\uB4F1 \uD750\uB984\uC744 \uC774\uC5B4\uAC14\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uC139\uD130\uAC00 \uACAC\uC870\uD55C \uC624\uB984\uC138\uB97C \uBCF4\uC778 \uAC00\uC6B4\uB370, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uD14C\uB9C8\uB294 \uBCF4\uD569\uAD8C\uC5D0\uC11C \uB9E4\uBB3C\uC744 \uC18C\uD654\uD588\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uC810\uC9C4\uC801 \uBC18\uB4F1 \uAD6D\uBA74\uC5D0\uC11C\uB294 \uC9C0\uC218 \uCD94\uC885\uACFC \uD568\uAED8 \uC8FC\uB3C4 \uD14C\uB9C8\uC758 \uC774\uC775 \uBAA8\uBA58\uD140 \uBC0F \uC218\uAE09 \uAC15\uB3C4\uB97C \uD568\uAED8 \uC810\uAC80\uD558\uB294 \uAC83\uC774 \uC720\uB9AC\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uB294 ${kospiSign}${kospi.toFixed(2)}% \uC0C1\uC2B9\uD558\uBA70 \uCC28\uBD84\uD55C \uBC18\uB4F1\uC138\uB97C \uC774\uC5B4\uAC14\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF \uC2DC\uC7A5\uB3C4 \uC0C1\uC2B9 ${up}\uAC1C\uB85C \uB9E4\uC218\uC138\uAC00 \uC6B0\uC704\uB97C \uC810\uD558\uBA70 \uC8FC\uB3C4 \uC139\uD130\uB97C \uC911\uC2EC\uC73C\uB85C \uD558\uBC29 \uACBD\uC9C1\uC131\uC744 \uB2E8\uB2E8\uD788 \uB2E4\uC9C0\uB294 \uD558\uB8E8\uC600\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uC644\uB9CC\uD55C \uBC18\uB4F1 \uC7A5\uC138\uC5D0\uC11C\uB294 \uC2DC\uC7A5 \uC804\uCCB4\uC758 \uC9C0\uC218 \uB4F1\uB77D\uACFC \uD568\uAED8 \uC2E4\uC9C8 \uC790\uAE08\uC774 \uC9D1\uC911\uB418\uB294 \uC8FC\uB3C4 \uD14C\uB9C8\uC758 \uC5F0\uC18D\uC131\uC744 \uD655\uC778\uD558\uB294 \uAC83\uC774 \uC88B\uC2B5\uB2C8\uB2E4. \uC624\uB298 \uC5EC\uB7EC\uBD84\uC758 \uC2DC\uC120\uC740 \uC5B4\uB514\uB85C \uD5A5\uD558\uACE0 \uACC4\uC2E0\uAC00\uC694?`;
      break;
    case "TIGHT_BULL_SIDEWAYS":
      slide1Subheadline = `'${topThemeName}' \uD14C\uB9C8 \uC120\uBCC4 \uC0C1\uC2B9 \uC18D ${flow.characterName} \uBD84\uD560 \uC720\uC785`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uBC29\uD5A5\uC131 \uD0D0\uC0C9 \uC18D \uBBF8\uC138 \uB9E4\uC218 \uC6B0\uC704 \uBC0F \uAC1C\uBCC4 \uD14C\uB9C8 \uC555\uCD95 \uB9E4\uB9E4`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uAC15\uBCF4\uD569 \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uBC29\uD5A5\uC131 \uD0D0\uC0C9`;
      slide6Block1Desc = `\uC0C1\uC2B9 ${up}\uAC1C \xB7 \uBCF4\uD569 ${flat}\uAC1C \xB7 \uD558\uB77D ${down}\uAC1C\uB85C \uB9DE\uC11C\uBA70 \uB69C\uB837\uD55C \uC9C0\uC218 \uBAA8\uBA58\uD140 \uC5C6\uC774 \uC8FC\uB3C4 \uD14C\uB9C8 \uC911\uC2EC\uC758 \uC555\uCD95 \uB9E4\uB9E4 \uC804\uAC1C.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uC18C\uD3ED \uC624\uB974\uBA70 \uAC15\uBCF4\uD569\uAD8C\uC5D0\uC11C \uBC29\uD5A5\uC131\uC744 \uD0D0\uC0C9\uD588\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5\uC740 \uC0C1\uC2B9 ${up}\uAC1C, \uD558\uB77D ${down}\uAC1C\uB85C \uD33D\uD33D\uD55C \uD798\uACA8\uB8E8\uAE30\uAC00 \uC774\uC5B4\uC84C\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uC9C0\uC218 \uC790\uCCB4\uC758 \uB4F1\uB77D\uC740 \uC81C\uD55C\uC801\uC774\uC5C8\uC73C\uB098, \uB69C\uB837\uD55C \uBAA8\uBA58\uD140\uC744 \uAC00\uC9C4 \uAC1C\uBCC4 \uD14C\uB9C8\uB85C \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uC758 \uC120\uBCC4\uC801 \uBD84\uD560 \uB9E4\uC218\uAC00 \uC720\uC785\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uD14C\uB9C8\uAC00 \uC120\uBCC4\uC801\uC778 \uB9E4\uC218\uC138\uB97C \uC774\uB04C\uC5B4\uB0B8 \uBC18\uBA74, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uC139\uD130\uB294 \uB9E4\uBB3C \uC18C\uD654 \uACFC\uC815\uC744 \uAC70\uCCE4\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uAC15\uBCF4\uD569 \uAD6D\uBA74\uC5D0\uC11C\uB294 \uC123\uBD80\uB978 \uBC29\uD5A5\uC131 \uCD94\uC885\uBCF4\uB2E4 \uAC70\uB798\uB300\uAE08\uC774 \uC720\uC9C0\uB418\uB294 \uD575\uC2EC \uD14C\uB9C8\uC640 \uC2E4\uC9C8 \uC21C\uC720\uC785 \uC885\uBAA9\uC758 \uC218\uAE09\uC744 \uD655\uC778\uD558\uB294 \uC804\uB7B5\uC774 \uC801\uD569\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uB294 ${kospiSign}${kospi.toFixed(2)}% \uC18C\uD3ED \uC624\uB974\uBA70 \uAC15\uBCF4\uD569\uAD8C\uC5D0\uC11C \uBC29\uD5A5\uC131\uC744 \uBAA8\uC0C9\uD588\uC5B4\uC694.`;
      threadsMarketSummary = `\uC0C1\uC2B9 ${up}\uAC1C\uC640 \uD558\uB77D ${down}\uAC1C\uAC00 \uB9DE\uC11C\uBA70 \uC9C0\uC218 \uB4F1\uB77D\uBCF4\uB2E4\uB294 \uAC1C\uBCC4 \uD14C\uB9C8\uBCC4\uB85C \uC2E4\uC18D\uC744 \uCC59\uAE30\uB294 \uC7A5\uC138\uC600\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uC9C0\uC218\uAC00 \uC881\uC740 \uBC15\uC2A4\uAD8C\uC5D0 \uBA38\uBB3C \uB54C\uB294 \uAC1C\uBCC4 \uC139\uD130\uC758 \uCCB4\uB825\uACFC \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uC758 \uBD84\uD560 \uB9E4\uC218 \uADA4\uC801\uC744 \uD655\uC778\uD574\uBCF4\uC138\uC694. \uC624\uB298 \uC8FC\uBAA9\uD558\uC2DC\uB294 \uD14C\uB9C8\uB294 \uBB34\uC5C7\uC778\uAC00\uC694?`;
      break;
    case "TIGHT_BEAR_SIDEWAYS":
      slide1Subheadline = `'${topThemeName}' \uD14C\uB9C8 \uBC29\uC5B4 \uC18D ${flow.characterName} \uC720\uC785`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uC81C\uD55C\uC801 \uC228\uACE0\uB974\uAE30 \uC18D \uAC1C\uBCC4 \uC885\uBAA9 \uC7A5\uC138 \uBC0F \uCC28\uC775 \uB9E4\uBB3C \uC18C\uD654`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uC57D\uBCF4\uD569 \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uC228\uACE0\uB974\uAE30`;
      slide6Block1Desc = `\uD558\uB77D \uC885\uBAA9 ${down}\uAC1C\uC774 \uBBF8\uC138\uD558\uAC8C \uC6B0\uC138\uD588\uC73C\uB098 \uC804\uBC18\uC801\uC73C\uB85C \uD6A1\uBCF4\uAD8C\uC5D0\uC11C \uAC1C\uBCC4 \uD14C\uB9C8 \uC911\uC2EC\uC758 \uCC28\uBCC4\uD654 \uC7A5\uC138 \uD615\uC131.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uC57D\uBCF4\uD569\uAD8C\uC5D0 \uBA38\uBB3C\uBA70 \uCC28\uBD84\uD55C \uC228\uACE0\uB974\uAE30 \uC591\uC0C1\uC744 \uBCF4\uC600\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5\uC5D0\uC11C\uB3C4 \uD558\uB77D ${down}\uAC1C\uB85C \uC18C\uD3ED \uB9E4\uBB3C\uC774 \uC6B0\uC138\uD588\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uC9C0\uC218\uC758 \uD558\uBC29 \uC555\uB825\uC740 \uC81C\uD55C\uC801\uC778 \uAC00\uC6B4\uB370, \uB2E8\uAE30 \uAE09\uB4F1 \uD14C\uB9C8\uC758 \uCC28\uC775 \uB9E4\uBB3C \uCD9C\uD68C\uC640 \uBC29\uC5B4 \uC139\uD130\uB85C\uC758 \uC21C\uD658\uB9E4\uAC00 \uC5C7\uAC08\uB838\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uD14C\uB9C8\uAC00 \uC9C0\uC218 \uC57D\uC138\uC5D0\uB3C4 \uD50C\uB7EC\uC2A4\uB97C \uC9C0\uCF30\uC73C\uBA70, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uC139\uD130\uB294 \uC18C\uD3ED \uC870\uC815\uC744 \uBC1B\uC558\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uC57D\uBCF4\uD569 \uD6A1\uBCF4\uC7A5\uC5D0\uC11C\uB294 \uBB34\uB9AC\uD55C \uB9E4\uB9E4\uB97C \uC904\uC774\uACE0, \uC790\uC0B0\uBC30\uBD84 \uCC28\uC6D0\uC5D0\uC11C \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uC758 \uBCC0\uB3D9\uC131 \uB178\uCD9C\uC744 \uC810\uAC80\uD558\uB294 \uAC83\uC774 \uC720\uB9AC\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uB294 ${kospiSign}${kospi.toFixed(2)}% \uC57D\uBCF4\uD569\uAD8C\uC5D0\uC11C \uCC28\uBD84\uD558\uAC8C \uC228\uC744 \uACE8\uB790\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF \uC2DC\uC7A5\uB3C4 \uD558\uB77D ${down}\uAC1C\uB85C \uBBF8\uC138\uD55C \uC870\uC815\uC774\uC5C8\uC9C0\uB9CC, \uBC29\uC5B4 \uD14C\uB9C8\uC640 \uC120\uBCC4 \uC885\uBAA9\uC73C\uB85C \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uAC00 \uC720\uC785\uB418\uBA70 \uADE0\uD615\uC744 \uB9DE\uCDC4\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uC228\uACE0\uB974\uAE30 \uC7A5\uC138\uC5D0\uC11C\uB294 \uC9C0\uC218 \uBCC0\uB3D9\uBCF4\uB2E4 \uC139\uD130 \uAC04 \uC790\uAE08 \uC774\uB3D9\uC758 \uAE38\uBAA9\uC744 \uAD00\uCC30\uD558\uB294 \uAC83\uC774 \uD604\uBA85\uD569\uB2C8\uB2E4. \uC624\uB298 \uC5EC\uB7EC\uBD84\uC758 \uAD00\uC2EC \uC9C0\uD45C\uB294 \uBB34\uC5C7\uC778\uAC00\uC694?`;
      break;
    case "MILD_BEAR":
      slide1Subheadline = `'${topThemeName}' \uD14C\uB9C8 \uBC18\uB4F1 \uC18D ${flow.characterName} \uC720\uC785`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uB2E8\uAE30 \uB9E4\uBB3C \uCD9C\uD68C \uC18D \uC8FC\uB3C4 \uC139\uD130\uC640 \uC18C\uC678 \uC139\uD130 \uAC04 \uB69C\uB837\uD55C \uC628\uB3C4\uCC28`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uC870\uC815 \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uCC28\uBCC4\uD654 \uC7A5\uC138`;
      slide6Block1Desc = `\uB2E8\uAE30 \uB9E4\uBB3C \uCD9C\uD68C\uB85C \uD558\uB77D \uC885\uBAA9 ${down}\uAC1C \uC6B0\uC138 \uD750\uB984 \uC18D\uC5D0\uC11C\uB3C4 \uC8FC\uB3C4 \uD14C\uB9C8\uAD70\uC73C\uB85C \uC120\uBCC4\uC801 \uC218\uAE09 \uC720\uC785 \uC804\uAC1C.`;
      captionOpening = `\uCF54\uC2A4\uD53C\uB294 ${kospiSign}${kospi.toFixed(2)}% \uC870\uC815\uC744 \uBC1B\uC73C\uBA70 \uC228\uACE0\uB974\uAE30\uC5D0 \uB4E4\uC5B4\uAC14\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5\uC5D0\uC11C\uB3C4 \uD558\uB77D \uC885\uBAA9\uC774 ${down}\uAC1C\uB85C \uC9D1\uACC4\uB418\uBA70 \uB9E4\uBB3C \uC18C\uD654 \uACFC\uC815\uC774 \uC774\uC5B4\uC84C\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uC9C0\uC218 \uC804\uBC18\uC758 \uC870\uC815 \uAD6D\uBA74 \uC18D\uC5D0\uC11C\uB3C4 \uC8FC\uB3C4 \uD14C\uB9C8\uC640 \uC18C\uC678 \uD14C\uB9C8 \uAC04 \uC218\uC775\uB960 \uACA9\uCC28\uAC00 \uB69C\uB837\uD558\uAC8C \uBC8C\uC5B4\uC9C0\uB294 \uC139\uD130 \uB85C\uD14C\uC774\uC158\uC774 \uC804\uAC1C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uD14C\uB9C8\uAC00 \uD50C\uB7EC\uC2A4 \uC218\uC775\uB960\uB85C \uC911\uC2EC\uC744 \uC7A1\uC740 \uBC18\uBA74, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uC139\uD130\uB294 \uCC28\uC775 \uB9E4\uBB3C\uC774 \uC9D1\uC911\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uC228\uACE0\uB974\uAE30 \uC7A5\uC138\uC5D0\uC11C\uB294 \uC9C0\uC218 \uCD94\uC885\uBCF4\uB2E4 \uC139\uD130 \uAC04 \uC790\uAE08 \uC774\uB3D9 \uACBD\uB85C\uC640 \uC2E4\uC9C8 \uC21C\uC720\uC785 \uC0C1\uC704 \uC885\uBAA9\uC758 \uC9C0\uC18D\uC131\uC744 \uD655\uC778\uD558\uB294 \uC804\uB7B5\uC774 \uC801\uD569\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uB294 ${kospiSign}${kospi.toFixed(2)}% \uC870\uC815\uC744 \uBC1B\uC73C\uBA70 \uC228\uACE0\uB974\uAE30\uC5D0 \uB4E4\uC5B4\uAC14\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF \uC2DC\uC7A5\uB3C4 \uD558\uB77D ${down}\uAC1C\uB85C \uC870\uC815 \uD750\uB984\uC774\uC5C8\uC9C0\uB9CC, \uC8FC\uB3C4 \uD14C\uB9C8\uAD70\uC73C\uB85C\uB294 \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uC758 \uBD84\uD560 \uB9E4\uC218\uC138\uAC00 \uAFB8\uC900\uD788 \uC720\uC785\uB418\uB294 \uCC28\uBCC4\uD654 \uC7A5\uC138\uC600\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uC9C0\uC218\uAC00 \uC228\uC744 \uACE0\uB97C \uB54C\uB294 \uC9C0\uC218 \uB4F1\uB77D\uBCF4\uB2E4 \uD14C\uB9C8 \uAC04 \uC790\uAE08 \uC774\uB3D9\uACFC \uC21C\uD658\uB9E4 \uAE38\uBAA9\uC744 \uC9C0\uD0A4\uB294 \uAD00\uCC30\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uC624\uB298 \uAC1C\uC7A5 \uD6C4 \uC5EC\uB7EC\uBD84\uC740 \uC5B4\uB5A4 \uC9C0\uD45C\uB97C \uB208\uC5EC\uACA8\uBCF4\uC2DC\uB098\uC694?`;
      break;
    case "MODERATE_BEAR":
      slide1Subheadline = `'${topThemeName}' \uD14C\uB9C8 \uBC29\uC5B4 \uC18D ${flow.characterName} \uD53C\uC2E0 \uC218\uAE09`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uACBD\uAE30\uBBFC\uAC10 \uC139\uD130 \uB9E4\uBB3C \uCD9C\uD68C \uBC0F \uBC29\uC5B4 \uC790\uC0B0\uC73C\uB85C \uC790\uAE08 \uC774\uB3D9`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uD558\uB77D \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uBC29\uC5B4\uBCBD \uAC00\uB3D9`;
      slide6Block1Desc = `\uACBD\uAE30\uBBFC\uAC10 \uB300\uD615\uC8FC \uC911\uC2EC\uC73C\uB85C \uD558\uB77D \uC885\uBAA9 ${down}\uAC1C\uC774 \uD655\uB300\uB418\uC5C8\uC73C\uB098, \uBC30\uB2F9\xB7\uCC44\uAD8C\uD615 ETF\uAC00 \uC9C0\uC218 \uB300\uBE44 \uD558\uBC29 \uCDA9\uACA9\uC744 \uC644\uCDA9.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uD558\uB77D\uD558\uBA70 \uBCF8\uACA9\uC801\uC778 \uC870\uC815 \uAD6D\uBA74\uC5D0 \uC9C4\uC785\uD588\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5\uC5D0\uC11C\uB3C4 ${down}\uAC1C \uC885\uBAA9\uC5D0 \uB9E4\uBB3C\uC774 \uCD9C\uD68C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uACBD\uAE30\uBBFC\uAC10 \uB300\uD615\uC8FC\uB97C \uC911\uC2EC\uC73C\uB85C \uB9E4\uB3C4 \uC555\uB825\uC774 \uAC00\uC911\uB418\uC5C8\uC73C\uB098, \uACE0\uBC30\uB2F9 \uBC0F \uCC44\uAD8C\uD615 \uB4F1 \uBC29\uC5B4\uC801 \uC790\uC0B0\uAD70\uC73C\uB85C \uD53C\uC2E0\uC131 \uC790\uAE08\uC774 \uC720\uC785\uB418\uBA70 \uC9C0\uC218 \uB099\uD3ED\uC744 \uC644\uCDA9\uD588\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uB4F1 \uBC29\uC5B4 \uD14C\uB9C8\uAC00 \uC120\uBC29\uD55C \uBC18\uBA74, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uC139\uD130\uB294 \uB9E4\uB3C4\uC138\uAC00 \uD655\uB300\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uBCF8\uACA9 \uC870\uC815 \uAD6D\uBA74\uC5D0\uC11C\uB294 \uB2E8\uAE30 \uC800\uAC00 \uB9E4\uC218\uBCF4\uB2E4 \uACBD\uAE30 \uBC29\uC5B4 \uC790\uC0B0\uC758 \uBE44\uC911\uACFC \uC8FC\uC694 \uC218\uAE09 \uC8FC\uCCB4\uC758 \uC774\uD0C8 \uC5EC\uBD80\uB97C \uBA74\uBC00\uD788 \uAD00\uCC30\uD558\uB294 \uAC83\uC774 \uC548\uC804\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uD558\uB77D\uD558\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC5D0 \uC870\uC815\uC758 \uACE8\uC774 \uAE4A\uC5B4\uC84C\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF \uC2DC\uC7A5\uB3C4 \uD558\uB77D \uC885\uBAA9\uC774 ${down}\uAC1C\uB85C \uB298\uC5C8\uC9C0\uB9CC, \uC778\uCEF4\uD615 \uBC0F \uCC44\uAD8C\uD615 ETF\uAC00 \uC9C0\uC218 \uB300\uBE44 \uD558\uB77D\uD3ED\uC744 \uB4E0\uB4E0\uD558\uAC8C \uC9C0\uCF1C\uC8FC\uC5C8\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uC870\uC815\uC774 \uC774\uC5B4\uC9C8 \uB54C\uB294 \uACC4\uC88C\uC758 \uBC29\uC5B4\uB825\uC774 \uC5BC\uB9C8\uB098 \uC720\uC9C0\uB418\uB294\uC9C0 \uC810\uAC80\uD558\uB294 \uAC83\uC774 \uC911\uC694\uD569\uB2C8\uB2E4. \uC624\uB298 \uC5EC\uB7EC\uBD84\uC758 \uB9AC\uC2A4\uD06C \uAD00\uB9AC \uAE30\uC900\uC740 \uBB34\uC5C7\uC778\uAC00\uC694?`;
      break;
    case "DEEP_BEAR":
      slide1Subheadline = `'${topThemeName}' \uD14C\uB9C8 \uBC29\uC5B4 \uC18D ${flow.characterName} \uC720\uC785`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uC804\uBC29\uC704 \uD558\uB77D \uC18D \uC548\uC804\uC790\uC0B0 \uBC0F \uD30C\uD0B9\uD615 ETF\uB85C \uC218\uAE09 \uC774\uB3D9`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uAE09\uB77D \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uC804\uBC29\uC704 \uC57D\uC138`;
      slide6Block1Desc = `\uAC70\uC13C \uC2DC\uC7A5 \uB9E4\uB3C4\uC138\uB85C \uD558\uB77D \uC885\uBAA9 ${down}\uAC1C\uC774 \uC3DF\uC544\uC84C\uC73C\uB098, \uAE08\uB9AC\uD615 \uBC0F \uBC29\uC5B4\uC801 \uC790\uC0B0\uAD70\uC774 \uC9C0\uC218 \uCDA9\uACA9\uC744 \uC644\uCDA9.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uAE09\uB77D\uD558\uBA70 \uAC70\uC13C \uD558\uB77D \uC555\uB825\uC744 \uBC1B\uC558\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5 \uC5ED\uC2DC ${down}\uAC1C \uC885\uBAA9\uC774 \uD558\uB77D\uD558\uBA70 \uC804\uBC29\uC704 \uC57D\uC138\uB97C \uB098\uD0C0\uB0C8\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uAD6D\uB0B4 \uB300\uD615\uC8FC \uC804\uBC18\uC5D0 \uAC78\uCCD0 \uB9E4\uBB3C\uC774 \uCD9C\uD68C\uB418\uC5C8\uC73C\uB098, \uCD08\uB2E8\uAE30 \uD30C\uD0B9\uD615 \uBC0F \uAE08\uB9AC\uD615 ETF\uB85C \uC790\uAE08\uC774 \uC9D1\uC911\uB418\uBA70 \uC2DC\uC2A4\uD15C \uC804\uBC18\uC758 \uB9AC\uC2A4\uD06C \uC644\uCDA9 \uC5ED\uD560\uC744 \uC218\uD589\uD588\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uB4F1 \uC18C\uC218\uC758 \uBC29\uC5B4\uC801 \uD14C\uB9C8\uAC00 \uD50C\uB7EC\uC2A4 \uAD8C\uC5ED\uC744 \uC9C0\uCF30\uC73C\uBA70, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uB4F1 \uACBD\uAE30\uBBFC\uAC10 \uC139\uD130\uB294 \uB099\uD3ED\uC744 \uD655\uB300\uD588\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uC9C0\uC218 \uAE09\uB77D \uAD6D\uBA74\uC5D0\uC11C\uB294 \uB099\uD3ED \uACFC\uB300 \uC885\uBAA9\uC758 \uC131\uAE09\uD55C \uCD94\uAC00 \uB9E4\uC218\uBCF4\uB2E4, \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785 \uC9C0\uD45C\uC640 \uD658\uC728 \uBCC0\uB3D9\uC131 \uC548\uCC29 \uC5EC\uBD80\uB97C \uBA3C\uC800 \uC810\uAC80\uD558\uB294 \uAC83\uC774 \uC720\uB9AC\uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uAE09\uB77D\uD558\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC5D0 \uD070 \uD558\uB77D \uC555\uB825\uC774 \uAC00\uD574\uC84C\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF 1,025\uAC1C \uC911 ${down}\uAC1C\uAC00 \uD558\uB77D\uD558\uBA70 \uC57D\uC138\uAC00 \uC9D9\uC5C8\uC9C0\uB9CC, ETF \uC804\uCCB4 \uAC00\uC911\uC218\uC775\uB960\uC740 ${etfSign}${etfRet.toFixed(2)}%\uB85C \uC9C0\uC218\uBCF4\uB2E4 \uCDA9\uACA9\uC744 \uB35C \uBC1B\uC558\uC2B5\uB2C8\uB2E4. \uC548\uC804\uC790\uC0B0\uC774 \uB4E0\uB4E0\uD55C \uBC29\uD30C\uC81C\uAC00 \uB418\uC5B4\uC8FC\uC5C8\uC5B4\uC694.`;
      threadsWatchPoint = `\uC9C0\uC218\uAC00 \uD06C\uAC8C \uCD9C\uB801\uC77C \uB54C\uB294 \uC9C0\uC218 \uC790\uCCB4\uBCF4\uB2E4 \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uAC00 \uC774\uB3D9\uD558\uB294 \uAE38\uBAA9\uACFC \uBC29\uC5B4 \uC790\uC0B0\uC758 \uBC84\uD300\uB825\uC744 \uAD00\uCC30\uD558\uB294 \uAC83\uC774 \uC911\uC694\uD569\uB2C8\uB2E4. \uC624\uB298 \uC5EC\uB7EC\uBD84\uC758 \uAD00\uC2EC \uC139\uD130\uB294 \uC5B4\uB514\uC778\uAC00\uC694?`;
      break;
    case "HEAVY_DROP":
      slide1Subheadline = `'${topThemeName}' \uBC29\uC5B4 \uBD84\uD22C \uC18D ${flow.characterName} \uD53C\uC2E0 \uC9D1\uC911`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uC2DC\uC7A5 \uBCC0\uB3D9\uC131 \uAE09\uACA9 \uD655\uB300 \uBC0F \uC8FC\uC694 \uC9C0\uC9C0\uC120 \uC2DC\uD5D8 \uAD6D\uBA74`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uAC70\uC13C \uCDA9\uACA9 \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uBC29\uC5B4 \uCD1D\uB825`;
      slide6Block1Desc = `\uC804\uBC29\uC704\uC801\uC778 \uB9E4\uB3C4 \uACF5\uC138\uB85C \uD558\uB77D \uC885\uBAA9 ${down}\uAC1C\uC774 \uC18D\uCD9C\uD558\uB294 \uAC00\uC6B4\uB370, \uCD08\uB2E8\uAE30 \uCC44\uAD8C \uBC0F \uC778\uBC84\uC2A4\uD615 \uC790\uC0B0\uC73C\uB85C\uC758 \uD53C\uC2E0\uC131 \uC790\uAE08 \uC774\uB3D9 \uAC00\uC18D\uD654.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uAE09\uB77D\uD558\uBA70 \uC2DC\uC7A5 \uC8FC\uC694 \uC9C0\uC9C0\uC120\uC744 \uC704\uD611\uD558\uB294 \uAC70\uC13C \uD558\uB77D \uCDA9\uACA9\uC744 \uACAA\uC5C8\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5\uC5D0\uC11C\uB3C4 ${down}\uAC1C \uC885\uBAA9\uC774 \uC77C\uC81C\uD788 \uD558\uB77D\uC138\uB97C \uBA74\uCE58 \uBABB\uD588\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uC678\uC778\uACFC \uAE30\uAD00\uC758 \uB3D9\uBC18 \uB9E4\uB3C4\uAC00 \uC3DF\uC544\uC9C0\uBA70 \uB300\uBD80\uBD84\uC758 \uC139\uD130\uAC00 \uC57D\uC138\uB97C \uBCF4\uC600\uC73C\uBA70, \uADF9\uD788 \uC77C\uBD80\uC758 \uCD08\uB2E8\uAE30 \uD30C\uD0B9\uD615 ETF\uB9CC\uC774 \uD53C\uC2E0\uCC98 \uC5ED\uD560\uC744 \uC218\uD589\uD588\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uB4F1 \uADF9\uC18C\uC218 \uD14C\uB9C8\uB9CC \uBC84\uD168\uB0C8\uC744 \uBFD0, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uC139\uD130\uB97C \uBE44\uB86F\uD55C \uB300\uB2E4\uC218 \uC885\uBAA9\uC774 \uD070 \uD3ED\uC758 \uC870\uC815\uC744 \uBC1B\uC558\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uD558\uB77D \uCDA9\uACA9\uC774 \uAC70\uC13C \uAD6C\uAC04\uC5D0\uC11C\uB294 \uC123\uBD80\uB978 \uBB3C\uD0C0\uAE30\uB098 \uC800\uAC00 \uB9E4\uC218\uB97C \uC9C0\uC591\uD558\uACE0, \uBCC0\uB3D9\uC131 \uC9C0\uC218\uC640 \uC678\uAD6D\uC778 \uC218\uAE09\uC758 \uB9E4\uB3C4\uC138 \uC9C4\uC815 \uC5EC\uBD80\uB97C \uCC28\uBD84\uD788 \uD655\uC778\uD574\uC57C \uD569\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uD06C\uAC8C \uBC00\uB9AC\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC5D0 \uAC70\uC13C \uD558\uB77D \uCDA9\uACA9\uC774 \uC804\uD574\uC84C\uC5B4\uC694.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF \uC2DC\uC7A5\uB3C4 ${down}\uAC1C \uC885\uBAA9\uC774 \uD558\uB77D\uD558\uBA70 \uD798\uACA8\uC6B4 \uD558\uB8E8\uB97C \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4. \uC790\uAE08\uC740 \uADF9\uB2E8\uC801\uC778 \uC548\uC804\uC790\uC0B0\uACFC \uCD08\uB2E8\uAE30 \uAE08\uB9AC\uD615\uC73C\uB85C \uAE09\uACA9\uD788 \uC774\uB3D9\uD588\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uAC70\uC13C \uCDA9\uACA9 \uC18D\uC5D0\uC11C\uB294 \uACC4\uC88C\uB97C \uC9C0\uD0A4\uB294 \uBCF4\uC218\uC801\uC778 \uD604\uAE08 \uAD00\uB9AC\uAC00 \uCD5C\uC6B0\uC120\uC785\uB2C8\uB2E4. \uC624\uB298 \uAC1C\uC7A5 \uD6C4 \uC5EC\uB7EC\uBD84\uC774 \uAC00\uC7A5 \uC8FC\uC2DC\uD558\uB294 \uC9C0\uD45C\uB294 \uBB34\uC5C7\uC778\uAC00\uC694?`;
      break;
    case "PANIC_CRASH":
    default:
      slide1Subheadline = `'${topThemeName}' \uBC29\uC5B4 \uD55C\uACC4 \uC18D ${flow.characterName} \uAE34\uAE09 \uB300\uD53C`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \xB7 \uD22C\uB9E4\uC131 \uB9E4\uBB3C \uC9D1\uC911 \uBC0F \uADF9\uB2E8\uC801 \uBCC0\uB3D9\uC131 \uC18D \uD658\uC728\xB7\uC720\uB3D9\uC131 \uC810\uAC80`;
      slide6Block1Title = `\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \uADF9\uB2E8\uC801 \uAE09\uB77D \uC18D \uC77C\uBC18 ETF ${etfSign}${etfRet.toFixed(2)}% \uD22C\uB9E4 \uCDA9\uACA9`;
      slide6Block1Desc = `\uD558\uB77D \uC885\uBAA9 ${down}\uAC1C\uC774 \uC2DC\uC7A5\uC758 85% \uC774\uC0C1\uC744 \uCC28\uC9C0\uD558\uBA70 \uC804\uBC29\uC704 \uD328\uB2C9 \uD22C\uB9E4 \uBC1C\uC0DD. \uBB34\uB9AC\uD55C \uD3EC\uC9C0\uC158 \uC9C4\uC785\uC744 \uAE08\uC9C0\uD558\uACE0 \uB9AC\uC2A4\uD06C \uBC29\uC5B4\uC120 \uC810\uAC80 \uD544\uC218.`;
      captionOpening = `\uAD6D\uB0B4 \uC99D\uC2DC\uB294 \uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uD3ED\uB77D\uD558\uBA70 \uC2DC\uC7A5 \uC804\uBC18\uC5D0 \uAC78\uCCD0 \uADF9\uB2E8\uC801\uC778 \uBCC0\uB3D9\uC131\uACFC \uD328\uB2C9\uC131 \uD22C\uB9E4\uAC00 \uCD9C\uD68C\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 ETF \uC2DC\uC7A5 \uC5ED\uC2DC ${down}\uAC1C \uC885\uBAA9\uC774 \uD558\uB77D\uD558\uBA70 \uAC70\uC13C \uCDA9\uACA9\uC744 \uBC1B\uC558\uC2B5\uB2C8\uB2E4.`;
      captionMarketSummary = `\uC2DC\uC2A4\uD15C \uB9AC\uC2A4\uD06C \uC6B0\uB824\uB85C \uC804 \uC139\uD130\uC5D0 \uAC78\uCCD0 \uBB34\uCC28\uBCC4\uC801\uC778 \uB9E4\uBB3C\uC774 \uC3DF\uC544\uC84C\uC73C\uBA70, \uC790\uAE08\uC740 \uCD08\uB2E8\uAE30 \uD604\uAE08\uC131 MMF \uBC0F \uD30C\uD0B9\uD615 ETF\uB85C \uAE34\uAE09 \uB300\uD53C\uD558\uB294 \uBAA8\uC2B5\uC744 \uB098\uD0C0\uB0C8\uC2B5\uB2C8\uB2E4.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% \uB4F1 \uC77C\uBD80 \uD5F7\uC9C0\uD615 \uC790\uC0B0\uC744 \uC81C\uC678\uD55C \uC804 \uC139\uD130\uAC00 \uAE09\uB77D\uC138\uB97C \uBCF4\uC600\uC73C\uBA70, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% \uD14C\uB9C8\uB294 \uADF9\uC2EC\uD55C \uB099\uD3ED\uC744 \uAE30\uB85D\uD588\uC2B5\uB2C8\uB2E4.`;
      captionWatchPoint = `\uADF9\uB2E8\uC801 \uD328\uB2C9 \uC7A5\uC138\uC5D0\uC11C\uB294 \uC2EC\uB9AC\uC801 \uACF5\uD3EC\uC5D0 \uC758\uD55C \uD22C\uB9E4 \uB3D9\uCC38\uB3C4, \uC131\uAE09\uD55C \uBC14\uB2E5 \uB09A\uC2DC\uB3C4 \uBAA8\uB450 \uC704\uD5D8\uD569\uB2C8\uB2E4. \uD658\uC728 \uAE09\uB4F1\uC138 \uC9C4\uC815\uACFC \uB9E4\uB3C4 \uD638\uAC00 \uACF5\uBC31 \uD574\uC18C\uB97C \uAE30\uB2E4\uB9AC\uB294 \uBCF4\uC218\uC801 \uAD00\uB9DD\uC774 \uD544\uC218\uC801\uC785\uB2C8\uB2E4.`;
      threadsOpening = `\uCF54\uC2A4\uD53C\uAC00 ${kospiSign}${kospi.toFixed(2)}% \uD3ED\uB77D\uD558\uBA70 \uC2DC\uC7A5\uC774 \uADF9\uB2E8\uC801\uC778 \uD328\uB2C9 \uD22C\uB9E4\uB97C \uACAA\uC5C8\uC2B5\uB2C8\uB2E4.`;
      threadsMarketSummary = `\uC77C\uBC18 ETF 1,025\uAC1C \uC911 ${down}\uAC1C\uAC00 \uD558\uB77D\uD558\uBA70 \uC804\uBC29\uC704\uC801\uC778 \uB9E4\uB3C4 \uD3ED\uD48D\uC774 \uBAB0\uC544\uCCE4\uC5B4\uC694. \uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uC870\uCC28 \uBAA8\uB4E0 \uC704\uD5D8\uC790\uC0B0\uC744 \uD53C\uD558\uACE0 \uD30C\uD0B9\uD615\uC73C\uB85C \uB300\uD53C\uD588\uC2B5\uB2C8\uB2E4.`;
      threadsWatchPoint = `\uADF9\uB2E8\uC801\uC778 \uBCC0\uB3D9\uC131 \uC7A5\uC138\uC5D0\uC11C\uB294 \uC790\uC0B0\uC744 \uC9C0\uD0A4\uB294 \uB9AC\uC2A4\uD06C \uAD00\uB9AC\uAC00 \uCD5C\uACE0\uC758 \uC218\uC775\uB960\uC785\uB2C8\uB2E4. \uBB34\uB9AC\uD55C \uD589\uB3D9\uC744 \uBA48\uCD94\uACE0 \uC2DC\uC7A5\uC774 \uC548\uC815\uC744 \uCC3E\uC744 \uB54C\uAE4C\uC9C0 \uD638\uD761\uC744 \uAC00\uB2E4\uB4EC\uC73C\uC138\uC694.`;
      break;
  }
  const countText = payload.generalEtfCount ? `${payload.generalEtfCount.toLocaleString()}\uAC1C ` : "";
  const firstComment = `\uD55C\uAD6D\uAC70\uB798\uC18C(KRX) \uACF5\uC2DC \uB370\uC774\uD130 \uB9C8\uAC10 \uAE30\uC900 \xB7 \uAD6D\uB0B4 \uC0C1\uC7A5 \uC77C\uBC18 ETF ${countText}\uC804\uC218 \uBD84\uC11D`;
  return {
    code,
    statusName,
    badgeTag,
    flowCharacter: flow.character,
    flowCharacterName: flow.characterName,
    disparityStatus: disparity.status,
    kospiChangePct: kospi,
    kosdaqChangePct: kosdaq,
    etfWeightedReturnPct: etfRet,
    capSpread,
    etfDivergence,
    slide1Subheadline,
    slide1Tip,
    slide4BannerTitle,
    slide4BannerDesc,
    slide5BannerTitle: disparity.bannerTitle,
    slide5BannerDesc: disparity.bannerDesc,
    slide5ActionTip: disparity.actionTip,
    slide6Block1Title,
    slide6Block1Desc,
    captionOpening,
    captionMarketSummary,
    captionThemeAnalysis,
    captionWatchPoint,
    threadsOpening,
    threadsMarketSummary,
    threadsWatchPoint,
    firstComment
  };
}
__name(classifyMarketRegime, "classifyMarketRegime");

// src/templates/instagram.ts
function escapeXml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
__name(escapeXml, "escapeXml");
function formatDateWithDay(dateStr) {
  if (!dateStr) {
    const today = /* @__PURE__ */ new Date();
    const days2 = ["\uC77C\uC694\uC77C", "\uC6D4\uC694\uC77C", "\uD654\uC694\uC77C", "\uC218\uC694\uC77C", "\uBAA9\uC694\uC77C", "\uAE08\uC694\uC77C", "\uD1A0\uC694\uC77C"];
    return `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")} \xB7 ${days2[today.getDay()]}`;
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["\uC77C\uC694\uC77C", "\uC6D4\uC694\uC77C", "\uD654\uC694\uC77C", "\uC218\uC694\uC77C", "\uBAA9\uC694\uC77C", "\uAE08\uC694\uC77C", "\uD1A0\uC694\uC77C"];
  const dayName = days[date.getDay()] || "\uC6D4\uC694\uC77C";
  return `${dateStr.replace(/-/g, ".")} \xB7 ${dayName}`;
}
__name(formatDateWithDay, "formatDateWithDay");
function cleanEtfNameForBanner(name, maxChars = 14) {
  if (!name) return "\uB300\uD45C ETF";
  let clean = name.replace(/\s*\([^)]*\)/g, "").trim();
  if (clean.length > maxChars) {
    clean = clean.slice(0, maxChars - 1) + "\u2026";
  }
  return clean;
}
__name(cleanEtfNameForBanner, "cleanEtfNameForBanner");
function calcBannerFontSize(text, maxWidthPx = 720, baseFs = 32, minFs = 26) {
  let estWidth = 0;
  for (const char of text) {
    estWidth += char.charCodeAt(0) > 128 ? baseFs * 0.95 : baseFs * 0.55;
  }
  if (estWidth <= maxWidthPx) return baseFs;
  const scale = maxWidthPx / estWidth;
  return Math.max(minFs, Math.floor(baseFs * scale));
}
__name(calcBannerFontSize, "calcBannerFontSize");
function generateInstagramCarousel(payload, baseUrl, narrative) {
  const regime = narrative || classifyMarketRegime(payload);
  const dateStr = payload.asOfDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const formattedDate = formatDateWithDay(dateStr);
  const kospi = payload.kospiChangePct ?? 0;
  const kosdaq = payload.kosdaqChangePct ?? 0;
  const etfReturn = payload.generalAumWeightedReturnPct ?? 0;
  const kospiSign = kospi > 0 ? "+" : "";
  const kosdaqSign = kosdaq > 0 ? "+" : "";
  const etfSign = etfReturn > 0 ? "+" : "";
  const kospiColor = kospi >= 0 ? "#D92D20" : "#175CD3";
  const kosdaqColor = kosdaq >= 0 ? "#D92D20" : "#175CD3";
  const etfColor = etfReturn >= 0 ? "#D92D20" : "#175CD3";
  const up = payload.upCount ?? payload.pulse?.upCount ?? 0;
  const down = payload.downCount ?? payload.pulse?.downCount ?? 0;
  const flat = payload.flatCount ?? payload.pulse?.flatCount ?? 0;
  const generalCount = payload.generalEtfCount ?? payload.pulse?.generalEtfCount ?? up + down + flat;
  const sortedPeerGroups = [...payload.peerGroups || []].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const topTheme = sortedPeerGroups[0] || { peerGroup: "\uC8FC\uC694 \uC139\uD130", cappedAumWeightedReturnPct: 0, etfCount: 0, assetClass: "\uAD6D\uB0B4\uC8FC\uC2DD" };
  const bottomTheme = sortedPeerGroups[sortedPeerGroups.length - 1] || topTheme;
  const themeGap = Math.abs((topTheme.cappedAumWeightedReturnPct ?? 0) - (bottomTheme.cappedAumWeightedReturnPct ?? 0)).toFixed(2);
  const winners = sortedPeerGroups.slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().slice(0, 3);
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const topInflow = topInflows[0] || { name: "\uB370\uC774\uD130 \uC218\uC9D1 \uC911", ticker: "-", inflow: 0, theme: "\uBBF8\uBD84\uB958" };
  const top5InflowSum = topInflows.slice(0, 5).reduce((sum, item) => sum + (item.inflow || 0), 0);
  const cleanInflowBannerName = cleanEtfNameForBanner(topInflow.name, 14);
  const assetClasses = payload.assetClasses && payload.assetClasses.length > 0 ? payload.assetClasses : [];
  const disparityList = payload.disparityWarning || [];
  const premiums = [...disparityList].filter((d) => (d.disparityPct ?? 0) > 0).sort((a, b) => (b.disparityPct ?? 0) - (a.disparityPct ?? 0)).slice(0, 2);
  const discounts = [...disparityList].filter((d) => (d.disparityPct ?? 0) < 0).sort((a, b) => (a.disparityPct ?? 0) - (b.disparityPct ?? 0)).slice(0, 2);
  const totalSlides = 6;
  const commonDefs = `
    <defs>
      <filter id="softShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#0F172A" flood-opacity="0.06"/>
      </filter>
      <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.04"/>
      </filter>
      <style>
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', '\uB9D1\uC740 \uACE0\uB515', 'Noto Sans KR', sans-serif; }
        .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
      </style>
    </defs>
  `;
  const commonFooter = `
    <g transform="translate(540, 1262)">
      <text x="0" y="0" fill="#475569" font-size="21" font-weight="800" text-anchor="middle">* \uBCF8 \uC790\uB8CC\uB294 \uD22C\uC790 \uD310\uB2E8\uC744 \uB3D5\uAE30 \uC704\uD55C \uC815\uBCF4 \uC81C\uACF5\uC6A9\uC774\uBA70, \uD2B9\uC815 \uC885\uBAA9\uC758 \uB9E4\uC218\xB7\uB9E4\uB3C4\uB97C \uAD8C\uC720\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</text>
      <text x="0" y="38" fill="#047857" font-size="28" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF \uCEA0\uD37C\uC2A4 | https://etf-campus.pages.dev</text>
    </g>
  `;
  const cleanTopThemeName = (topTheme.peerGroup || "\uC8FC\uC694 \uC139\uD130").replace(/\s*\([^)]*\)/g, "").trim();
  const themeVerb = (topTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? "\uC8FC\uB3C4" : "\uC120\uBC29";
  const slide1HeroSubText = `'${cleanTopThemeName}' ${themeVerb} \uC18D '${cleanInflowBannerName}' \uC218\uAE09 \uC9D1\uC911`;
  const slide1HeroSubFs = calcBannerFontSize(slide1HeroSubText, 870, 32, 28);
  const slide1Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - \uD45C\uC9C0 \uBC0F 3\uB300 \uD575\uC2EC \uD384\uC2A4">
      <title>ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - 1\uD398\uC774\uC9C0</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="320" fill="#2E6819" fill-opacity="0.04"/>
      <circle cx="120" cy="1150" r="260" fill="#0284C7" fill-opacity="0.03"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="38" font-weight="900">ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551</text>
        <rect x="710" y="0" width="230" height="46" rx="14" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.6" filter="url(#cardShadow)"/>
        <text x="825" y="30" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- Main Hero Hook Card (y=118, h=195) -->
      <g transform="translate(70, 118)" filter="url(#softShadow)">
        <rect width="940" height="195" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        
        <!-- \uD5E4\uB4DC\uB77C\uC778 1: \uBE45 \uB118\uBC84 \uB300\uBE44 (50px \uB300\uD615 \uBCFC\uB4DC) -->
        <text x="35" y="76" fill="#0F172A" font-size="50" font-weight="900" letter-spacing="-1.2">
          \uCF54\uC2A4\uD53C <tspan fill="${kospiColor}">${kospiSign}${kospi.toFixed(2)}%</tspan> <tspan fill="#64748B" font-weight="900">vs</tspan> \uC77C\uBC18 ETF <tspan fill="${etfColor}">${etfSign}${etfReturn.toFixed(2)}%</tspan>
        </text>

        <!-- \uD5E4\uB4DC\uB77C\uC778 2: \uD14C\uB9C8 & \uC218\uAE09 \uD575\uC2EC \uC124\uBA85 \uD55C \uC904 (28~32px \uBCFC\uB4DC) -->
        <text x="35" y="142" fill="#047857" font-size="${slide1HeroSubFs}" font-weight="900" letter-spacing="-0.6">
          &apos;${escapeXml(cleanTopThemeName)}&apos; ${themeVerb} \uC18D &apos;${escapeXml(cleanInflowBannerName)}&apos; \uC218\uAE09 \uC9D1\uC911
        </text>
      </g>

      <!-- Pulse 1: Market Temperature (y=328, h=275) -->
      <g transform="translate(70, 328)" filter="url(#cardShadow)">
        <rect width="940" height="275" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="48" fill="#0F172A" font-size="28" font-weight="900">1. \uC2DC\uC7A5 \uCCB4\uC628 &amp; 3\uB300 \uC9C0\uC218 \uBE44\uAD50</text>
        
        <rect x="550" y="16" width="355" height="48" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.4"/>
        <text x="727" y="48" font-size="22" font-weight="900" text-anchor="middle">
          <tspan fill="#D92D20">\uC0C1\uC2B9 ${up}</tspan><tspan fill="#64748B"> \xB7 </tspan><tspan fill="#334155">\uBCF4\uD569 ${flat}</tspan><tspan fill="#64748B"> \xB7 </tspan><tspan fill="#175CD3">\uD558\uB77D ${down}</tspan>
        </text>

        <g transform="translate(35, 82)">
          <!-- KOSPI -->
          <rect x="0" y="0" width="280" height="165" rx="18" fill="${kospi >= 0 ? "#FEF2F2" : "#EFF6FF"}" stroke="${kospi >= 0 ? "#FECACA" : "#BFDBFE"}" stroke-width="1.5"/>
          <text x="24" y="48" fill="${kospi >= 0 ? "#991B1B" : "#1E40AF"}" font-size="26" font-weight="900">KOSPI</text>
          <text x="256" y="128" fill="${kospiColor}" font-size="50" font-weight="900" text-anchor="end" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>

          <!-- KOSDAQ -->
          <rect x="295" y="0" width="280" height="165" rx="18" fill="${kosdaq >= 0 ? "#FEF2F2" : "#EFF6FF"}" stroke="${kosdaq >= 0 ? "#FECACA" : "#BFDBFE"}" stroke-width="1.5"/>
          <text x="319" y="48" fill="${kosdaq >= 0 ? "#991B1B" : "#1E40AF"}" font-size="26" font-weight="900">KOSDAQ</text>
          <text x="551" y="128" fill="${kosdaqColor}" font-size="50" font-weight="900" text-anchor="end" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>

          <!-- \uC77C\uBC18 ETF -->
          <rect x="590" y="0" width="280" height="165" rx="18" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.6"/>
          <text x="614" y="48" fill="#15803D" font-size="26" font-weight="900">\uC77C\uBC18 ETF</text>
          <text x="846" y="128" fill="${etfColor}" font-size="50" font-weight="900" text-anchor="end" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
        </g>
      </g>

      <!-- Pulse 2: Long/Short Themes (y=619, h=275) -->
      <g transform="translate(70, 619)" filter="url(#cardShadow)">
        <rect width="940" height="275" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="48" fill="#0F172A" font-size="28" font-weight="900">2. \uC624\uB298\uC758 \uADF9\uACFC \uADF9 \uD14C\uB9C8</text>
        
        <rect x="670" y="16" width="235" height="48" rx="14" fill="#FFF7ED" stroke="#FDBA74" stroke-width="1.4"/>
        <text x="787" y="48" fill="#C2410C" font-size="22" font-weight="900" text-anchor="middle">\uD14C\uB9C8 \uACA9\uCC28 ${themeGap}%p</text>

        <!-- Left: \u25B2 \uC0C1\uC704 1\uC704 \uCE74\uB4DC -->
        <g transform="translate(35, 82)">
          <rect width="425" height="165" rx="18" fill="#FEF2F2" stroke="#FECACA" stroke-width="1.5"/>
          <rect x="20" y="18" width="125" height="40" rx="10" fill="#FEE2E2"/>
          <text x="82" y="45" fill="#991B1B" font-size="22" font-weight="900" text-anchor="middle">\u25B2 \uC0C1\uC704 1\uC704</text>
          <text x="405" y="48" fill="#D92D20" font-size="48" font-weight="900" text-anchor="end" class="tabular">+${(topTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
          <text x="20" y="126" fill="#0F172A" font-size="${cleanTopThemeName.length > 11 ? 28 : 32}" font-weight="900">${escapeXml(cleanTopThemeName)}</text>
        </g>

        <!-- Right: \u25BC \uD558\uC704 1\uC704 \uCE74\uB4DC -->
        <g transform="translate(480, 82)">
          <rect width="425" height="165" rx="18" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1.5"/>
          <rect x="20" y="18" width="125" height="40" rx="10" fill="#E2E8F0"/>
          <text x="82" y="45" fill="#475569" font-size="22" font-weight="900" text-anchor="middle">\u25BC \uD558\uC704 1\uC704</text>
          <text x="405" y="48" fill="${(bottomTheme.cappedAumWeightedReturnPct ?? 0) >= 0 ? "#D92D20" : "#175CD3"}" font-size="48" font-weight="900" text-anchor="end" class="tabular">${(bottomTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? "+" : ""}${(bottomTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
          <text x="20" y="126" fill="#0F172A" font-size="${(bottomTheme.peerGroup || "").length > 11 ? 28 : 32}" font-weight="900">${escapeXml((bottomTheme.peerGroup || "\uC18C\uC678 \uC139\uD130").replace(/\s*\([^)]*\)/g, "").trim())}</text>
        </g>
      </g>

      <!-- Pulse 3: Smart Money Flow (y=910, h=300) -->
      <g transform="translate(70, 910)" filter="url(#cardShadow)">
        <rect width="940" height="300" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="48" fill="#0F172A" font-size="28" font-weight="900">3. \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC2E4\uC9C8 \uC21C\uC720\uC785 1\uC704</text>
        
        <rect x="35" y="80" width="870" height="188" rx="20" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.5"/>
        <circle cx="68" cy="94" r="32" fill="#D92D20"/>
        <text x="68" y="105" fill="#FFFFFF" font-size="30" font-weight="900" text-anchor="middle">1</text>
        
        <text x="120" y="68" fill="#0F172A" font-size="34" font-weight="900">${escapeXml(cleanInflowBannerName)}</text>
        
        <rect x="120" y="94" width="110" height="38" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="175" y="120" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">${topInflow.ticker}</text>
        
        <rect x="242" y="94" width="155" height="38" rx="10" fill="#FEE2E2" stroke="#FDA4AF" stroke-width="1.2"/>
        <text x="319" y="120" fill="#BE123C" font-size="22" font-weight="900" text-anchor="middle">${escapeXml(topInflow.theme || "\uD575\uC2ECETF")}</text>

        <text x="875" y="84" fill="#D92D20" font-size="52" font-weight="900" text-anchor="end" class="tabular">+${(topInflow.inflow || 0).toLocaleString()}<tspan font-size="28" font-weight="900" fill="#991B1B">\uC5B5\uC6D0</tspan></text>
        <text x="875" y="124" fill="#BE123C" font-size="23" font-weight="900" text-anchor="end">\uB2F9\uC77C \uCD5C\uB300 \uC21C\uC720\uC785</text>
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;
  const cleanTopThemeClean = topTheme.peerGroup.replace(/\s*\([^)]*\)/g, "").trim();
  const cleanBotThemeClean = bottomTheme.peerGroup.replace(/\s*\([^)]*\)/g, "").trim();
  const slide2Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - \uC8FC\uB3C4 \uD14C\uB9C8 TOP 3 vs \uBD80\uC9C4 \uD14C\uB9C8">
      <title>ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - 2\uD398\uC774\uC9C0</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="38" font-weight="900">\uC624\uB298 \uC2DC\uC7A5 \uC8FC\uB3C4/\uBD80\uC9C4 \uD14C\uB9C8 TOP 3</text>
        <text x="0" y="66" fill="#334155" font-size="22" font-weight="800">\u203B \uD14C\uB9C8\uBCC4 \uC21C\uC790\uC0B0 \uAC00\uC911\uC218\uC775\uB960 \uAE30\uC900 \uC0C1\uC704/\uD558\uC704 \uB7AD\uD0B9</text>
        <rect x="830" y="0" width="110" height="46" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.6"/>
        <text x="885" y="30" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">2 / ${totalSlides}</text>
      </g>

      <!-- Summary Banner (y=120, h=120) -->
      <g transform="translate(70, 120)" filter="url(#cardShadow)">
        <rect width="940" height="120" rx="24" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.6"/>
        <rect x="30" y="16" width="145" height="42" rx="12" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1.4"/>
        <text x="102" y="44" fill="#B45309" font-size="22" font-weight="900" text-anchor="middle">\uD14C\uB9C8 \uD575\uC2EC</text>
        <text x="195" y="46" fill="#0F172A" font-size="32" font-weight="900">&apos;${escapeXml(cleanTopThemeClean)}&apos; ${(topTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? "\uC8FC\uB3C4" : "\uC120\uBC29"} vs &apos;${escapeXml(cleanBotThemeClean)}&apos; \uC870\uC815</text>
        <text x="30" y="94" fill="#1E293B" font-size="26" font-weight="800">
          \uD14C\uB9C8 \uAC04 \uC218\uC775\uB960 \uACA9\uCC28 <tspan fill="#B45309" font-weight="900">${themeGap}%p</tspan>\uB85C \uC8FC\uB3C4 \uC139\uD130\uC640 \uC18C\uC678 \uC139\uD130\uC758 \uB69C\uB837\uD55C \uCC28\uBCC4\uD654
        </text>
      </g>

      <!-- Panel 1: Top 3 Leaders (\u25B2 \uC0C1\uC704 Top 3) (y=256, h=470) -->
      <g transform="translate(70, 256)" filter="url(#cardShadow)">
        <rect width="940" height="470" rx="24" fill="#FFFFFF" stroke="#FECDCA" stroke-width="1.6"/>
        <rect x="0" y="0" width="940" height="60" rx="24" fill="#FEF3F2"/>
        <text x="35" y="40" fill="#B42318" font-size="28" font-weight="900">\u25B2 \uC0C1\uC704 Top 3 \uC8FC\uB3C4 \uD14C\uB9C8</text>

        ${winners.map((w, idx) => {
    const cleanName = w.peerGroup.replace(/\s*\([^)]*\)/g, "").trim();
    const ret = w.cappedAumWeightedReturnPct ?? 0;
    const retSign = ret > 0 ? "\u25B2 +" : ret < 0 ? "\u25BC " : "";
    const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
    return `
          <g transform="translate(35, ${74 + idx * 126})">
            <rect width="870" height="116" rx="20" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
            <circle cx="52" cy="58" r="28" fill="${idx === 0 ? "#D92D20" : "#FEE4E2"}"/>
            <text x="52" y="68" fill="${idx === 0 ? "#FFFFFF" : "#D92D20"}" font-size="26" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="100" y="50" fill="#0F172A" font-size="${cleanName.length > 13 ? 26 : cleanName.length > 10 ? 29 : 32}" font-weight="900">${escapeXml(cleanName)}</text>
            <rect x="100" y="64" width="170" height="36" rx="10" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.2"/>
            <text x="185" y="89" fill="#15803D" font-size="21" font-weight="900" text-anchor="middle">\uAC00\uC911\uC218\uC775\uB960 \uC0C1\uC704</text>
            <text x="840" y="74" fill="${retColor}" font-size="48" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
          </g>
        `;
  }).join("")}
      </g>

      <!-- Panel 2: Bottom 3 Laggards (\u25BC \uD558\uC704 Worst 3) (y=742, h=470) -->
      <g transform="translate(70, 742)" filter="url(#cardShadow)">
        <rect width="940" height="470" rx="24" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.6"/>
        <rect x="0" y="0" width="940" height="60" rx="24" fill="#EFF6FF"/>
        <text x="35" y="40" fill="#1D4ED8" font-size="28" font-weight="900">\u25BC \uD558\uC704 Worst 3 \uBD80\uC9C4 \uD14C\uB9C8</text>

        ${losers.map((l, idx) => {
    const cleanName = l.peerGroup.replace(/\s*\([^)]*\)/g, "").trim();
    const ret = l.cappedAumWeightedReturnPct ?? 0;
    const retSign = ret > 0 ? "\u25B2 +" : ret < 0 ? "\u25BC " : "";
    const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
    return `
          <g transform="translate(35, ${74 + idx * 126})">
            <rect width="870" height="116" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
            <circle cx="52" cy="58" r="28" fill="${idx === 0 ? "#175CD3" : "#DBEAFE"}"/>
            <text x="52" y="68" fill="${idx === 0 ? "#FFFFFF" : "#175CD3"}" font-size="26" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="100" y="50" fill="#0F172A" font-size="${cleanName.length > 13 ? 26 : cleanName.length > 10 ? 29 : 32}" font-weight="900">${escapeXml(cleanName)}</text>
            <rect x="100" y="64" width="170" height="36" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
            <text x="185" y="89" fill="#475569" font-size="21" font-weight="900" text-anchor="middle">\uAC00\uC911\uC218\uC775\uB960 \uD558\uC704</text>
            <text x="840" y="74" fill="${retColor}" font-size="48" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
          </g>
        `;
  }).join("")}
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;
  const domesticStock = assetClasses.find((a) => a.assetClass?.includes("\uAD6D\uB0B4") || a.assetClass?.includes("\uC8FC\uC2DD-\uAD6D\uB0B4"));
  const domRet = domesticStock?.aumWeightedReturnPct ?? 4.14;
  const domShare = domesticStock?.aumSharePct ?? 48.8;
  const domSign = domRet > 0 ? "+" : "";
  const sortedByRet = [...assetClasses].sort((a, b) => (b.aumWeightedReturnPct ?? 0) - (a.aumWeightedReturnPct ?? 0));
  const topAsset = sortedByRet[0] || { assetClass: "\uAD6D\uB0B4\uC8FC\uC2DD", aumWeightedReturnPct: 4.14 };
  const botAsset = sortedByRet[sortedByRet.length - 1] || { assetClass: "\uC6D0\uC790\uC7AC", aumWeightedReturnPct: -1.98 };
  const domStatusStr = domRet > 0.5 ? "\uC0C1\uC2B9 \uACAC\uC778" : domRet >= -0.5 ? "\uBCF4\uD569 \uD63C\uC870" : "\uC870\uC815 \uC228\uACE0\uB974\uAE30";
  const slide3Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - \uC790\uC0B0\uAD70\uBCC4 \uC131\uACFC \uBC0F \uBE44\uC911 \uD604\uD669">
      <title>ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - 3\uD398\uC774\uC9C0</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="38" font-weight="900">\uC790\uC0B0\uAD70\uBCC4 \uC218\uC775\uB960 &amp; \uBE44\uC911 \uD604\uD669</text>
        <text x="0" y="66" fill="#334155" font-size="22" font-weight="800">\u203B \uC790\uC0B0\uAD70\uBCC4 \uB2F9\uC77C \uC21C\uC790\uC0B0 \uAC00\uC911\uC218\uC775\uB960 \uBC0F \uC804\uCCB4 \uC21C\uC790\uC0B0 \uBE44\uC911</text>
        <rect x="830" y="0" width="110" height="46" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.6"/>
        <text x="885" y="30" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">3 / ${totalSlides}</text>
      </g>

      <!-- Summary Box (y=120, h=120) -->
      <g transform="translate(70, 120)" filter="url(#cardShadow)">
        <rect width="940" height="120" rx="24" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.6"/>
        <rect x="30" y="16" width="155" height="42" rx="12" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.4"/>
        <text x="107" y="44" fill="#15803D" font-size="22" font-weight="900" text-anchor="middle">\uC790\uC0B0\uAD70 \uD575\uC2EC</text>
        <text x="205" y="46" fill="#0F172A" font-size="32" font-weight="900">&apos;${escapeXml(topAsset.assetClass)}&apos; \uC0C1\uC2B9 vs &apos;${escapeXml(botAsset.assetClass)}&apos; \uC870\uC815</text>
        <text x="30" y="94" fill="#1E293B" font-size="25" font-weight="800">
          \uCD5C\uB300 \uBE44\uC911 ${(domShare ?? 0).toFixed(1)}%\uC758 \uAD6D\uB0B4\uC8FC\uC2DD\uC740 <tspan fill="${domRet >= 0 ? "#15803D" : "#175CD3"}" font-weight="900">${domSign}${(domRet ?? 0).toFixed(2)}% ${domStatusStr}</tspan>, \uBD84\uC0B0 \uD6A8\uACFC \uD655\uC778
        </text>
      </g>

      <!-- 6 Asset Classes List (y=256, step=160, h=148) -->
      <g transform="translate(70, 256)">
        ${assetClasses.slice(0, 6).map((ac, idx) => {
    const rawAum = ac.totalAum || 0;
    const aumEok = rawAum > 1e11 ? rawAum / 1e8 : rawAum;
    const aumJo = (aumEok / 1e4).toFixed(1);
    const ret = ac.aumWeightedReturnPct ?? 0;
    const retSign = ret > 0 ? "\u25B2 +" : ret < 0 ? "\u25BC " : "";
    const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
    const share = ac.aumSharePct ?? 0;
    return `
            <g transform="translate(0, ${idx * 160})" filter="url(#cardShadow)">
              <rect width="940" height="148" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
              <text x="35" y="54" fill="#0F172A" font-size="36" font-weight="900">${escapeXml(ac.assetClass)}</text>
              <text x="35" y="94" fill="#1E293B" font-size="24" font-weight="800">
                \uC21C\uC790\uC0B0 <tspan font-weight="900" fill="#0F172A">${aumJo}\uC870\uC6D0</tspan> \xB7 \uBE44\uC911 <tspan font-weight="900" fill="#047857">${share.toFixed(1)}%</tspan>
              </text>
              
              <rect x="35" y="114" width="380" height="14" rx="7" fill="#F1F5F9"/>
              <rect x="35" y="114" width="${Math.min(380, Math.max(14, share * 3.8))}" height="14" rx="7" fill="#047857"/>
              
              <rect x="510" y="16" width="395" height="116" rx="18" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>
              <rect x="530" y="22" width="115" height="34" rx="8" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
              <text x="587" y="45" fill="#475569" font-size="21" font-weight="900" text-anchor="middle">\uAC00\uC911\uC218\uC775\uB960</text>
              <text x="885" y="52" fill="${retColor}" font-size="48" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
              
              <text x="535" y="98" fill="#475569" font-size="22" font-weight="800">\uC885\uBAA9 \uBD84\uD3EC</text>
              <text x="885" y="98" fill="#1E293B" font-size="24" font-weight="900" text-anchor="end" class="tabular">\uC0C1\uC2B9 ${ac.upCount} \xB7 \uD558\uB77D ${ac.downCount}</text>
            </g>
          `;
  }).join("")}
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;
  const secondInflow = topInflows[1];
  const slide4BannerTitle = regime.slide4BannerTitle || (secondInflow ? `\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, '${escapeXml(cleanInflowBannerName)}' \uB4F1 \uC9D1\uC911 \uC21C\uC720\uC785` : `\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, '${escapeXml(cleanInflowBannerName)}' \uC9D1\uC911 \uC21C\uC720\uC785`);
  const slide4BannerDesc = regime.slide4BannerDesc || `\uC0C1\uC704 5\uC885\uBAA9\uC73C\uB85C \uCD1D ${top5InflowSum.toLocaleString()}\uC5B5\uC6D0 \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785`;
  const slide4TitleFs = calcBannerFontSize(slide4BannerTitle, 720, 32, 28);
  const slide4DescFs = calcBannerFontSize(slide4BannerDesc, 870, 26, 24);
  const slide4Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC2E4\uC9C8 \uC21C\uC720\uC785 TOP 5">
      <title>ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - 4\uD398\uC774\uC9C0</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#D92D20" fill-opacity="0.035"/>
      <circle cx="100" cy="1150" r="260" fill="#BE123C" fill-opacity="0.03"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="38" font-weight="900">\uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785 TOP 5</text>
        <text x="0" y="66" fill="#334155" font-size="22" font-weight="800">\u203B \uBC1C\uD589\uC88C\uC218 \uC99D\uAC10\uC73C\uB85C \uC0B0\uCD9C\uB41C \uAE30\uAD00\xB7\uC678\uAD6D\uC778\uC758 \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785\uC561</text>
        <rect x="830" y="0" width="110" height="46" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.6"/>
        <text x="885" y="30" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">4 / ${totalSlides}</text>
      </g>

      <!-- Summary Banner (y=120, h=120) -->
      <g transform="translate(70, 120)" filter="url(#cardShadow)">
        <rect width="940" height="120" rx="24" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.6"/>
        <rect x="30" y="16" width="145" height="42" rx="12" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1.4"/>
        <text x="102" y="44" fill="#BE123C" font-size="22" font-weight="900" text-anchor="middle">\uC218\uAE09 \uD575\uC2EC</text>
        <text x="195" y="46" fill="#0F172A" font-size="${slide4TitleFs}" font-weight="900">${slide4BannerTitle}</text>
        <text x="30" y="94" fill="#1E293B" font-size="${slide4DescFs}" font-weight="800">
          ${escapeXml(slide4BannerDesc)}
        </text>
      </g>

      <!-- TOP 5 Inflow Ranking Cards (y=256, step=190, h=176) -->
      <g transform="translate(70, 256)">
        ${topInflows.slice(0, 5).map((item, idx) => {
    const inflowJo = (item.inflow ?? 0).toLocaleString();
    const isTop = idx === 0;
    const cleanName = cleanEtfNameForBanner(item.name, 16);
    return `
            <g transform="translate(0, ${idx * 190})" filter="url(#cardShadow)">
              <rect width="940" height="176" rx="24" fill="${isTop ? "#FFF8F8" : "#FFFFFF"}" stroke="${isTop ? "#FCA5A5" : "#E2E8F0"}" stroke-width="${isTop ? "2" : "1.6"}"/>
              ${isTop ? '<rect x="0" y="0" width="8" height="176" rx="4" fill="#D92D20"/>' : ""}

              <!-- \uC21C\uC704 \uBC43\uC9C0 -->
              <circle cx="58" cy="88" r="30" fill="${isTop ? "#D92D20" : "#F1F5F9"}" ${!isTop ? 'stroke="#CBD5E1" stroke-width="1.5"' : ""}/>
              <text x="58" y="99" fill="${isTop ? "#FFFFFF" : "#475569"}" font-size="28" font-weight="900" text-anchor="middle">${idx + 1}</text>

              <!-- ETF\uBA85 -->
              <text x="106" y="66" fill="#0F172A" font-size="32" font-weight="900">${escapeXml(cleanName)}</text>

              <!-- \uD2F0\uCEE4 -->
              <rect x="106" y="88" width="105" height="38" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
              <text x="158" y="114" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">${item.ticker}</text>

              <!-- \uD14C\uB9C8 \uD0DC\uADF8 -->
              <rect x="222" y="88" width="160" height="38" rx="10" fill="${isTop ? "#FFE4E6" : "#F8FAFC"}" stroke="${isTop ? "#FDA4AF" : "#E2E8F0"}" stroke-width="1.2"/>
              <text x="302" y="114" fill="${isTop ? "#BE123C" : "#334155"}" font-size="22" font-weight="900" text-anchor="middle">${escapeXml(item.theme || "\uD575\uC2ECETF")}</text>

              <!-- \uC21C\uC720\uC785 \uAE08\uC561 -->
              <text x="910" y="78" fill="${isTop ? "#D92D20" : "#1E293B"}" font-size="50" font-weight="900" text-anchor="end" class="tabular">+${inflowJo}<tspan font-size="28" font-weight="900" fill="${isTop ? "#BE123C" : "#334155"}">\uC5B5\uC6D0</tspan></text>
              <text x="910" y="116" fill="${isTop ? "#E11D48" : "#475569"}" font-size="23" font-weight="900" text-anchor="end">${isTop ? "\uB2F9\uC77C \uCD5C\uB300 \uC2E4\uC9C8 \uC21C\uC720\uC785" : "\uC21C\uC720\uC785 \uC0C1\uC704 \uC885\uBAA9"}</text>
            </g>
          `;
  }).join("")}
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;
  const prem1 = premiums[0];
  const prem2 = premiums[1];
  const disc1 = discounts[0];
  const disc2 = discounts[1];
  const slide5Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - \uAD34\uB9AC\uC728 \uACE0\uD3C9\uAC00\xB7\uD560\uC99D vs \uC800\uD3C9\uAC00\xB7\uD560\uC778 \uC9C4\uB2E8">
      <title>ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - 5\uD398\uC774\uC9C0</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="38" font-weight="900" letter-spacing="-0.8">\uAD34\uB9AC\uC728 \uACE0\uD3C9\uAC00\xB7\uD560\uC99D vs \uC800\uD3C9\uAC00\xB7\uD560\uC778 \uC9C4\uB2E8</text>
        <text x="0" y="66" fill="#334155" font-size="22" font-weight="800">\u203B \uC21C\uC790\uC0B0\uAC00\uCE58 NAV \uB300\uBE44 \uC2DC\uC7A5 \uC885\uAC00\uC758 \uAC00\uACA9 \uC65C\uACE1 \uC815\uB3C4\uB97C \uC9C4\uB2E8\uD569\uB2C8\uB2E4.</text>
        <rect x="830" y="0" width="110" height="46" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.6"/>
        <text x="885" y="30" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">5 / ${totalSlides}</text>
      </g>

      <!-- Alert Banner (y=120, h=115) -->
      <g transform="translate(70, 120)" filter="url(#cardShadow)">
        <rect width="940" height="115" rx="24" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.6"/>
        <rect x="30" y="16" width="145" height="40" rx="10" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1.4"/>
        <text x="102" y="44" fill="#B45309" font-size="22" font-weight="900" text-anchor="middle">\uAD34\uB9AC\uC728 \uC9C4\uB2E8</text>
        <text x="195" y="46" fill="#0F172A" font-size="30" font-weight="900">\uC21C\uC790\uC0B0\uAC00\uCE58 NAV \uB300\uBE44 \uC2DC\uC7A5 \uAC00\uACA9 \uC65C\uACE1 \uC810\uAC80</text>
        <text x="30" y="90" fill="#1E293B" font-size="25" font-weight="800">
          \uC7A5 \uC2DC\uC791 \uBC0F \uB9C8\uAC10 \uC2DC\uC810\uC758 \uD638\uAC00 \uACF5\uBC31\uACFC \uD574\uC678 \uC2DC\uCC28\uB85C \uC778\uD55C \uC65C\uACE1\uC744 \uC810\uAC80\uD569\uB2C8\uB2E4.
        </text>
      </g>

      <!-- SECTION 1: NAV \uB300\uBE44 \uACE0\uD3C9\uAC00 \xB7 \uD560\uC99D Top 2 (y=250) -->
      <g transform="translate(70, 250)">
        <text x="5" y="28" fill="#991B1B" font-size="28" font-weight="900">\u25B2 NAV \uB300\uBE44 \uACE0\uD3C9\uAC00 \xB7 \uD560\uC99D \uC8FC\uC758 (\uC2DC\uC7A5\uAC00 &gt; \uAC00\uCE58)</text>

        <!-- Slot 1 (y=42) -->
        ${prem1 ? `
        <g transform="translate(0, 42)" filter="url(#cardShadow)">
          <rect width="940" height="144" rx="22" fill="#FFF8F8" stroke="#FCA5A5" stroke-width="2"/>
          <rect x="0" y="0" width="8" height="144" rx="4" fill="#D92D20"/>
          <circle cx="58" cy="72" r="28" fill="#D92D20"/>
          <text x="58" y="82" fill="#FFFFFF" font-size="26" font-weight="900" text-anchor="middle">1</text>
          <text x="104" y="56" fill="#0F172A" font-size="30" font-weight="900">${escapeXml(cleanEtfNameForBanner(prem1.etfName, 18))}</text>
          <rect x="104" y="78" width="105" height="36" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="156" y="103" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">${prem1.ticker}</text>
          <rect x="220" y="78" width="155" height="36" rx="10" fill="#FEE2E2" stroke="#FDA4AF" stroke-width="1.2"/>
          <text x="297" y="103" fill="#BE123C" font-size="22" font-weight="900" text-anchor="middle">\uACE0\uD3C9\uAC00 \uD560\uC99D</text>
          <text x="910" y="68" fill="#D92D20" font-size="48" font-weight="900" text-anchor="end" class="tabular">+${(prem1.disparityPct ?? 0).toFixed(2)}%</text>
          <text x="910" y="106" fill="#BE123C" font-size="22" font-weight="900" text-anchor="end">NAV \uB300\uBE44 \uD560\uC99D \uAC70\uB798 \uC911</text>
        </g>
        ` : `
        <g transform="translate(0, 42)" filter="url(#cardShadow)">
          <rect width="940" height="144" rx="22" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.6"/>
          <text x="470" y="84" fill="#15803D" font-size="26" font-weight="900" text-anchor="middle">\u2714 \uC804 \uC885\uBAA9 NAV \uB300\uBE44 \uD560\uC99D\uB960 \uC815\uC0C1 \uBC94\uC704 \uC720\uC9C0 (\uACE0\uD3C9\uAC00 \uC885\uBAA9 \uC5C6\uC74C)</text>
        </g>
        `}

        <!-- Slot 2 (y=200) -->
        ${prem2 ? `
        <g transform="translate(0, 200)" filter="url(#cardShadow)">
          <rect width="940" height="144" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
          <circle cx="58" cy="72" r="28" fill="#FEE2E2"/>
          <text x="58" y="82" fill="#991B1B" font-size="26" font-weight="900" text-anchor="middle">2</text>
          <text x="104" y="56" fill="#0F172A" font-size="30" font-weight="900">${escapeXml(cleanEtfNameForBanner(prem2.etfName, 18))}</text>
          <rect x="104" y="78" width="105" height="36" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="156" y="103" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">${prem2.ticker}</text>
          <rect x="220" y="78" width="155" height="36" rx="10" fill="#FEE2E2" stroke="#FDA4AF" stroke-width="1.2"/>
          <text x="297" y="103" fill="#BE123C" font-size="22" font-weight="900" text-anchor="middle">\uACE0\uD3C9\uAC00 \uD560\uC99D</text>
          <text x="910" y="68" fill="#D92D20" font-size="48" font-weight="900" text-anchor="end" class="tabular">+${(prem2.disparityPct ?? 0).toFixed(2)}%</text>
          <text x="910" y="106" fill="#BE123C" font-size="22" font-weight="900" text-anchor="end">NAV \uB300\uBE44 \uD560\uC99D \uAC70\uB798 \uC911</text>
        </g>
        ` : `
        <g transform="translate(0, 200)" filter="url(#cardShadow)">
          <rect width="940" height="144" rx="22" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.6"/>
          <text x="470" y="84" fill="#475569" font-size="25" font-weight="800" text-anchor="middle">\u2714 \uCD94\uAC00 \uACE0\uD3C9\uAC00 \uC885\uBAA9 \uC5C6\uC74C (\uB300\uBD80\uBD84 \uC885\uBAA9 \uC815\uC0C1 \uD638\uAC00 \uC720\uC9C0)</text>
        </g>
        `}
      </g>

      <!-- SECTION 2: NAV \uB300\uBE44 \uC800\uD3C9\uAC00 \xB7 \uD560\uC778 Top 2 (y=660) -->
      <g transform="translate(70, 660)">
        <text x="5" y="28" fill="#166534" font-size="28" font-weight="900">\u25BC NAV \uB300\uBE44 \uC800\uD3C9\uAC00 \xB7 \uD560\uC778 \uCCB4\uD06C (\uC2DC\uC7A5\uAC00 &lt; \uAC00\uCE58)</text>

        <!-- Slot 1 (y=42) -->
        ${disc1 ? `
        <g transform="translate(0, 42)" filter="url(#cardShadow)">
          <rect width="940" height="144" rx="22" fill="#F0FDF4" stroke="#86EFAC" stroke-width="2"/>
          <rect x="0" y="0" width="8" height="144" rx="4" fill="#059669"/>
          <circle cx="58" cy="72" r="28" fill="#059669"/>
          <text x="58" y="82" fill="#FFFFFF" font-size="26" font-weight="900" text-anchor="middle">1</text>
          <text x="104" y="56" fill="#0F172A" font-size="30" font-weight="900">${escapeXml(cleanEtfNameForBanner(disc1.etfName, 18))}</text>
          <rect x="104" y="78" width="105" height="36" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="156" y="103" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">${disc1.ticker}</text>
          <rect x="220" y="78" width="155" height="36" rx="10" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.2"/>
          <text x="297" y="103" fill="#15803D" font-size="22" font-weight="900" text-anchor="middle">\uC800\uD3C9\uAC00 \uD560\uC778</text>
          <text x="910" y="68" fill="#047857" font-size="48" font-weight="900" text-anchor="end" class="tabular">${(disc1.disparityPct ?? 0).toFixed(2)}%</text>
          <text x="910" y="106" fill="#15803D" font-size="22" font-weight="900" text-anchor="end">NAV \uB300\uBE44 \uD560\uC778 \uAC70\uB798 \uC911</text>
        </g>
        ` : `
        <g transform="translate(0, 42)" filter="url(#cardShadow)">
          <rect width="940" height="144" rx="22" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.6"/>
          <text x="470" y="84" fill="#15803D" font-size="26" font-weight="900" text-anchor="middle">\u2714 \uC804 \uC885\uBAA9 NAV \uB300\uBE44 \uD560\uC778\uC728 \uC815\uC0C1 \uBC94\uC704 \uC720\uC9C0 (\uC800\uD3C9\uAC00 \uC65C\uACE1 \uC5C6\uC74C)</text>
        </g>
        `}

        <!-- Slot 2 (y=200) -->
        ${disc2 ? `
        <g transform="translate(0, 200)" filter="url(#cardShadow)">
          <rect width="940" height="144" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
          <circle cx="58" cy="72" r="28" fill="#DCFCE7"/>
          <text x="58" y="82" fill="#166534" font-size="26" font-weight="900" text-anchor="middle">2</text>
          <text x="104" y="56" fill="#0F172A" font-size="30" font-weight="900">${escapeXml(cleanEtfNameForBanner(disc2.etfName, 18))}</text>
          <rect x="104" y="78" width="105" height="36" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="156" y="103" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">${disc2.ticker}</text>
          <rect x="220" y="78" width="155" height="36" rx="10" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.2"/>
          <text x="297" y="103" fill="#15803D" font-size="22" font-weight="900" text-anchor="middle">\uC800\uD3C9\uAC00 \uD560\uC778</text>
          <text x="910" y="68" fill="#047857" font-size="48" font-weight="900" text-anchor="end" class="tabular">${(disc2.disparityPct ?? 0).toFixed(2)}%</text>
          <text x="910" y="106" fill="#15803D" font-size="22" font-weight="900" text-anchor="end">NAV \uB300\uBE44 \uD560\uC778 \uAC70\uB798 \uC911</text>
        </g>
        ` : `
        <g transform="translate(0, 200)" filter="url(#cardShadow)">
          <rect width="940" height="144" rx="22" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.6"/>
          <text x="470" y="84" fill="#475569" font-size="25" font-weight="800" text-anchor="middle">\u2714 \uCD94\uAC00 \uC800\uD3C9\uAC00 \uC885\uBAA9 \uC5C6\uC74C (\uC815\uC0C1 \uBC94\uC704 \uD638\uAC00 \uC720\uC9C0)</text>
        </g>
        `}
      </g>

      <!-- SECTION 3: \uC2E4\uC804 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 (y=1065, h=152) -->
      <g transform="translate(70, 1065)" filter="url(#cardShadow)">
        <rect width="940" height="152" rx="22" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.6"/>
        <text x="35" y="44" fill="#0F172A" font-size="27" font-weight="900">\u{1F4A1} \uC2E4\uC804 \uD22C\uC790 \uAC00\uC774\uB4DC \u2014 \uAD34\uB9AC\uC728 \uB300\uC751 \uCCB4\uD06C\uD3EC\uC778\uD2B8</text>
        <text x="35" y="88" fill="#1E293B" font-size="25" font-weight="800">
          \u2022 \uD574\uC678 ETF \uAD34\uB9AC\uC728\uC740 \uAC1C\uC7A5 \uC9C1\uD6C4 LP \uD638\uAC00\uAC00 \uACF5\uAE09\uB418\uBA70 \uC815\uC0C1 \uBC94\uC704\uB85C \uC218\uB834\uD569\uB2C8\uB2E4.
        </text>
        <text x="35" y="126" fill="#1E293B" font-size="25" font-weight="800">
          \u2022 \uAD34\uB9AC\uC728\uC774 \uBE44\uC815\uC0C1\uC801\uC73C\uB85C \uD655\uB300\uB41C \uC885\uBAA9\uC740 \uC2DC\uC7A5\uAC00 \uCD94\uACA9 \uB9E4\uC218\uB97C \uD53C\uD558\uACE0 iNAV\uB97C \uD655\uC778\uD558\uC138\uC694.
        </text>
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;
  const rawTopTheme = (topTheme.peerGroup || "\uC8FC\uB3C4 \uD14C\uB9C8").replace(/\s*\([^)]*\)/g, "").trim();
  const rawBotTheme = (bottomTheme.peerGroup || "\uC18C\uC678 \uD14C\uB9C8").replace(/\s*\([^)]*\)/g, "").trim();
  const cleanSlide6TopTheme = cleanEtfNameForBanner(rawTopTheme, 20);
  const cleanSlide6BotTheme = cleanEtfNameForBanner(rawBotTheme, 20);
  const slide6Card1Fact = `\u2022 \uC0C1\uC2B9 \uC885\uBAA9 ${up}\uAC1C \uC6B0\uC704\uB85C \uC2DC\uC7A5 \uB9E4\uC218 \uC2EC\uB9AC \uC804\uBC18 \uD68C\uBCF5`;
  const slide6Card1Action = `\uB300\uD615\uC8FC \uBC0F \uD575\uC2EC \uC131\uC7A5 \uC139\uD130 \uC911\uC2EC\uC758 \uC548\uC815\uC801 \uC0C1\uBC29 \uD0C4\uB825 \uC720\uD6A8`;
  const slide6Card2Fact = `\u2022 \uD14C\uB9C8 \uAC04 \uC218\uC775\uB960 \uACA9\uCC28 ${themeGap}%p\uB85C \uADF9\uC2EC\uD55C \uCC28\uBCC4\uD654 \uC7A5\uC138`;
  const slide6Card2Action = `\uB2E8\uAE30 \uAE09\uB4F1 \uD14C\uB9C8 \uBB34\uB9AC\uD55C \uCD94\uACA9 \uB9E4\uC218 \uC790\uC81C \uBC0F \uBD84\uD560 \uB9AC\uBC38\uB7F0\uC2F1`;
  const slide6Card3Fact = `\u2022 \uAE30\uAD00\xB7\uC678\uAD6D\uC778 \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC0C1\uC704 5\uC885\uBAA9\uC73C\uB85C \uC218\uAE09 \uC9D1\uC911`;
  const slide6Card3Action = `\uB2E8\uAE30 \uC2DC\uC138 \uCD94\uC885 \uC9C0\uC591, \uC548\uC804\uC790\uC0B0 \uC644\uCDA9\uB825 \uD655\uBCF4\uD558\uB294 \uADE0\uD615 \uC804\uB7B5`;
  const slide6Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - \uC624\uB298 \uC2DC\uC7A5 \uCD1D\uC815\uB9AC &amp; \uD575\uC2EC \uC804\uB7B5">
      <title>ETF \uB370\uC77C\uB9AC \uB9C8\uCF13 \uBE0C\uB9AC\uD551 - 6\uD398\uC774\uC9C0</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#1E3A8A" fill-opacity="0.035"/>
      <circle cx="100" cy="1150" r="260" fill="#0D9488" fill-opacity="0.03"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#1E3A8A" font-size="40" font-weight="900" letter-spacing="-1.0">\uC624\uB298 \uC2DC\uC7A5 \uCD1D\uC815\uB9AC &amp; \uD575\uC2EC \uC804\uB7B5</text>
        <text x="0" y="66" fill="#334155" font-size="22" font-weight="800">\u203B 3\uB300 \uD575\uC2EC \uCD95\uC73C\uB85C \uC694\uC57D\uD558\uB294 \uC2DC\uC7A5 \uC9C4\uB2E8\uACFC \uC2E4\uC804 \uD22C\uC790 \uB300\uC751 \uAC00\uC774\uB4DC</text>
        <rect x="830" y="0" width="110" height="46" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.6"/>
        <text x="885" y="30" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle" class="tabular">6 / ${totalSlides}</text>
      </g>

      <!-- 1. CARD 01: [\uC2DC\uC7A5 \uC9C4\uB2E8] (y=125, h=315) -->
      <g transform="translate(70, 125)" filter="url(#cardShadow)">
        <rect width="940" height="315" rx="24" fill="#FFFFFF" stroke="#BBF7D0" stroke-width="1.8"/>
        <rect x="0" y="0" width="8" height="315" rx="4" fill="#10B981"/>

        <!-- Header -->
        <rect x="35" y="22" width="165" height="48" rx="12" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.4"/>
        <text x="117" y="53" fill="#15803D" font-size="23" font-weight="900" text-anchor="middle">01 \uC2DC\uC7A5 \uC9C4\uB2E8</text>
        <text x="215" y="55" fill="#0F172A" font-size="30" font-weight="900">\uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% \xB7 \uC77C\uBC18 ETF ${etfSign}${etfReturn.toFixed(2)}% \uBC18\uB4F1 \uB7A0\uB9AC</text>

        <!-- Divider -->
        <line x1="35" y1="88" x2="905" y2="88" stroke="#F1F5F9" stroke-width="1.5"/>

        <!-- 1\uD589: \uD575\uC2EC \uD329\uD2B8 (32px \uB300\uD615 \uBCFC\uB4DC) -->
        <text x="35" y="148" fill="#1E293B" font-size="32" font-weight="900">
          ${slide6Card1Fact}
        </text>

        <!-- 2\uD589: \uC2E4\uC804 \uB300\uC751 \uC561\uC158 \uBC34\uB4DC (28px \uBCFC\uB4DC) -->
        <rect x="35" y="196" width="870" height="92" rx="16" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.4"/>
        <rect x="52" y="218" width="115" height="48" rx="10" fill="#DCFCE7"/>
        <text x="109" y="249" fill="#15803D" font-size="22" font-weight="900" text-anchor="middle">\uB300\uC751 \uC694\uC57D</text>
        <text x="185" y="250" fill="#166534" font-size="28" font-weight="900">${slide6Card1Action}</text>
      </g>

      <!-- 2. CARD 02: [\uD14C\uB9C8 \uC21C\uD658] (y=465, h=315) -->
      <g transform="translate(70, 465)" filter="url(#cardShadow)">
        <rect width="940" height="315" rx="24" fill="#FFFFFF" stroke="#FECDD3" stroke-width="1.8"/>
        <rect x="0" y="0" width="8" height="315" rx="4" fill="#F43F5E"/>

        <!-- Header -->
        <rect x="35" y="22" width="165" height="48" rx="12" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1.4"/>
        <text x="117" y="53" fill="#BE123C" font-size="23" font-weight="900" text-anchor="middle">02 \uD14C\uB9C8 \uC21C\uD658</text>
        <text x="215" y="55" fill="#0F172A" font-size="30" font-weight="900">&apos;${escapeXml(cleanSlide6TopTheme)}&apos; \uB3C5\uC8FC vs &apos;${escapeXml(cleanSlide6BotTheme)}&apos; \uC870\uC815</text>

        <!-- Divider -->
        <line x1="35" y1="88" x2="905" y2="88" stroke="#F1F5F9" stroke-width="1.5"/>

        <!-- 1\uD589: \uD575\uC2EC \uD329\uD2B8 (32px \uB300\uD615 \uBCFC\uB4DC) -->
        <text x="35" y="148" fill="#1E293B" font-size="32" font-weight="900">
          ${slide6Card2Fact}
        </text>

        <!-- 2\uD589: \uC2E4\uC804 \uB300\uC751 \uC561\uC158 \uBC34\uB4DC (28px \uBCFC\uB4DC) -->
        <rect x="35" y="196" width="870" height="92" rx="16" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.4"/>
        <rect x="52" y="218" width="115" height="48" rx="10" fill="#FFE4E6"/>
        <text x="109" y="249" fill="#BE123C" font-size="22" font-weight="900" text-anchor="middle">\uC804\uB7B5 \uC694\uC57D</text>
        <text x="185" y="250" fill="#9F1239" font-size="28" font-weight="900">${slide6Card2Action}</text>
      </g>

      <!-- 3. CARD 03: [\uB300\uC751 \uC804\uB7B5] (y=805, h=315) -->
      <g transform="translate(70, 805)" filter="url(#cardShadow)">
        <rect width="940" height="315" rx="24" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.8"/>
        <rect x="0" y="0" width="8" height="315" rx="4" fill="#3B82F6"/>

        <!-- Header -->
        <rect x="35" y="22" width="165" height="48" rx="12" fill="#DBEAFE" stroke="#93C5FD" stroke-width="1.4"/>
        <text x="117" y="53" fill="#1D4ED8" font-size="23" font-weight="900" text-anchor="middle">03 \uC790\uAE08 \uD750\uB984</text>
        <text x="215" y="55" fill="#0F172A" font-size="30" font-weight="900">${top5InflowSum > 0 ? `\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, &apos;${escapeXml(cleanInflowBannerName)}&apos; \uC911\uC2EC +${top5InflowSum.toLocaleString()}\uC5B5 \uC9D1\uC911` : `\uC2A4\uB9C8\uD2B8\uBA38\uB2C8, &apos;${escapeXml(cleanInflowBannerName)}&apos; \uC911\uC2EC \uC218\uAE09 \uC810\uAC80`}</text>

        <!-- Divider -->
        <line x1="35" y1="88" x2="905" y2="88" stroke="#F1F5F9" stroke-width="1.5"/>

        <!-- 1\uD589: \uD575\uC2EC \uD329\uD2B8 (32px \uB300\uD615 \uBCFC\uB4DC) -->
        <text x="35" y="148" fill="#1E293B" font-size="32" font-weight="900">
          ${slide6Card3Fact}
        </text>

        <!-- 2\uD589: \uC2E4\uC804 \uB300\uC751 \uC561\uC158 \uBC34\uB4DC (28px \uBCFC\uB4DC) -->
        <rect x="35" y="196" width="870" height="92" rx="16" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.4"/>
        <rect x="52" y="218" width="115" height="48" rx="10" fill="#DBEAFE"/>
        <text x="109" y="249" fill="#1D4ED8" font-size="22" font-weight="900" text-anchor="middle">\uC2E4\uC804 \uC870\uC5B8</text>
        <text x="185" y="250" fill="#1E40AF" font-size="28" font-weight="900">${slide6Card3Action}</text>
      </g>

      <!-- Bottom KRX Notice Banner (y=1140, h=74) -->
      <g transform="translate(70, 1140)">
        <rect width="940" height="74" rx="18" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.4"/>
        <text x="470" y="46" fill="#1E293B" font-size="24" font-weight="900" text-anchor="middle">
          \uD55C\uAD6D\uAC70\uB798\uC18C KRX \uC804 \uAC70\uB798\uC77C \uB9C8\uAC10 \uACF5\uC2DC \uAE30\uC900 \xB7 \uAD6D\uB0B4 \uC0C1\uC7A5 \uC77C\uBC18 ETF ${generalCount.toLocaleString()}\uAC1C \uC804\uC218 \uBD84\uC11D
        </text>
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;
  return [
    { slideNumber: 1, title: "Cover", subtitle: "1\uCD08 \uD6C4\uD0B9 \uD45C\uC9C0 & 3\uB300 \uD575\uC2EC \uD384\uC2A4", svgContent: slide1Svg.trim() },
    { slideNumber: 2, title: "Theme Dynamics", subtitle: "\uC8FC\uB3C4 \uD14C\uB9C8 TOP 3 vs \uBD80\uC9C4 \uD14C\uB9C8", svgContent: slide2Svg.trim() },
    { slideNumber: 3, title: "Asset Class Dynamics", subtitle: "\uC790\uC0B0\uAD70\uBCC4 \uC218\uC775\uB960 & \uBE44\uC911 \uD604\uD669", svgContent: slide3Svg.trim() },
    { slideNumber: 4, title: "Smart Money Flow", subtitle: "\uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785 TOP 5", svgContent: slide4Svg.trim() },
    { slideNumber: 5, title: "Disparity Alert", subtitle: "\uAD34\uB9AC\uC728 \uACE0\uD3C9\uAC00\xB7\uD560\uC99D vs \uC800\uD3C9\uAC00\xB7\uD560\uC778 \uC9C4\uB2E8", svgContent: slide5Svg.trim() },
    { slideNumber: 6, title: "Summary & Action Strategy", subtitle: "\uC624\uB298 \uC2DC\uC7A5 \uCD1D\uC815\uB9AC & \uD575\uC2EC \uC804\uB7B5", svgContent: slide6Svg.trim() }
  ];
}
__name(generateInstagramCarousel, "generateInstagramCarousel");
function generateInstagramCaption(payload, narrative) {
  const regime = narrative || classifyMarketRegime(payload);
  const up = payload.upCount ?? payload.pulse?.upCount ?? 0;
  const down = payload.downCount ?? payload.pulse?.downCount ?? 0;
  const flat = payload.flatCount ?? payload.pulse?.flatCount ?? 0;
  const generalCount = (payload.generalEtfCount ?? payload.pulse?.generalEtfCount ?? up + down + flat) || 0;
  const formattedDate = formatDateWithDay(payload.asOfDate);
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 3) || [];
  const cleanTheme = /* @__PURE__ */ __name((str) => (str || "").replace(/\s*\([^)]*\)/g, "").trim(), "cleanTheme");
  const inflowText = topInflows.length > 0 ? topInflows.map((i) => {
    const name = cleanTheme(i.name || i.etfName);
    const val = i.inflow ?? (i.netInflowValue ? Math.round(i.netInflowValue / 1e8) : 0);
    return `\u2022 ${name} +${(val || 0).toLocaleString()}\uC5B5\uC6D0`;
  }).join("\n") : "\u2022 \uC9D1\uACC4 \uC911";
  const sortedPeerGroups = [...payload.peerGroups || []].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const strongThemes = sortedPeerGroups.slice(0, 3);
  const weakThemes = [...sortedPeerGroups].reverse().slice(0, 3);
  const strongText = strongThemes.length > 0 ? strongThemes.map((t) => `${cleanTheme(t.peerGroup)} ${(t.cappedAumWeightedReturnPct ?? 0) > 0 ? "+" : ""}${(t.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%`).join(", ") : "\uC9D1\uACC4 \uC911";
  const weakText = weakThemes.length > 0 ? weakThemes.map((t) => `${cleanTheme(t.peerGroup)} ${(t.cappedAumWeightedReturnPct ?? 0) > 0 ? "+" : ""}${(t.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%`).join(", ") : "\uC9D1\uACC4 \uC911";
  const kospi = payload.kospiChangePct ?? 0;
  const etfRet = payload.generalAumWeightedReturnPct ?? 0;
  const kospiSign = kospi > 0 ? "+" : "";
  const etfSign = etfRet > 0 ? "+" : "";
  const kospiVerb = kospi > 0 ? "\uC0C1\uC2B9" : kospi < 0 ? "\uD558\uB77D" : "\uBCF4\uD569";
  const topThemeRet = strongThemes[0]?.cappedAumWeightedReturnPct ?? 0;
  const topThemeTail = topThemeRet > 0 ? "\uC911\uC2EC \uACAC\uC870\uD55C \uD750\uB984" : "\uC911\uC2EC \uC0C1\uB300\uC801 \uBC29\uC5B4";
  const themeSummary = strongThemes[0] ? `${cleanTheme(strongThemes[0].peerGroup)} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% ${topThemeTail}` : "\uC9D1\uACC4 \uC911";
  return `[${formattedDate}] \uAD6D\uB0B4 ETF \uB9C8\uCF13 \uB370\uC77C\uB9AC \uBE0C\uB9AC\uD551

\u{1F4CC} \uC624\uB298\uC758 3\uC904 \uC694\uC57D
1. \uC2DC\uC7A5 \uCCB4\uC628: \uCF54\uC2A4\uD53C ${kospiSign}${kospi.toFixed(2)}% ${kospiVerb} \uC18D \uC77C\uBC18 ETF \uAC00\uC911\uC218\uC775\uB960 ${etfSign}${etfRet.toFixed(2)}% \uAE30\uB85D
2. \uC8FC\uB3C4 \uD14C\uB9C8: ${themeSummary}
3. \uC2A4\uB9C8\uD2B8\uBA38\uB2C8: ${topInflows[0] ? cleanTheme(topInflows[0].name) + " \uB4F1 \uC0C1\uC704 \uC885\uBAA9 \uC9D1\uC911 \uC720\uC785" : "\uC0C1\uC704 \uC885\uBAA9 \uC9D1\uC911 \uC720\uC785"}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

\u{1F50E} \uC138\uBD80 \uD14C\uB9C8 & \uC218\uAE09 \uB3D9\uD5A5
\u2022 \uC0C1\uC704 \uC8FC\uB3C4 \uD14C\uB9C8: ${strongText}
\u2022 \uD558\uC704 \uC18C\uC678 \uD14C\uB9C8: ${weakText}

\uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC2E4\uC9C8 \uC21C\uC720\uC785 Top 3:
${inflowText}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

\u{1F4A1} \uC624\uB298\uC758 \uC2DC\uC7A5 \uAD00\uC804 \uD3EC\uC778\uD2B8
${regime.captionWatchPoint || "\uBCC0\uB3D9\uC131\uC774 \uD655\uB300\uB41C \uAD6D\uBA74\uC5D0\uC11C\uB294 \uC9C0\uC218 \uB4F1\uB77D \uC790\uCCB4\uBCF4\uB2E4 \uC139\uD130 \uAC04 \uC790\uAE08 \uC774\uB3D9 \uACBD\uB85C\uC640 \uBC29\uC5B4\uC801 \uC790\uC0B0\uC758 \uC644\uCDA9\uB825\uC744 \uAD00\uCC30\uD558\uB294 \uAC83\uC774 \uC720\uD6A8\uD569\uB2C8\uB2E4."}

\uC624\uB298 \uAC1C\uC7A5 \uD6C4 \uC5EC\uB7EC\uBD84\uC774 \uAC00\uC7A5 \uC8FC\uBAA9\uD558\uACE0 \uACC4\uC2E0 \uD14C\uB9C8\uB098 \uC9C0\uD45C\uB294 \uBB34\uC5C7\uC778\uAC00\uC694? \uB313\uAE00\uB85C \uC790\uC720\uB86D\uAC8C \uC758\uACAC\uC744 \uB098\uB220\uC8FC\uC138\uC694.

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\uB370\uC774\uD130 \uCD9C\uCC98: \uD55C\uAD6D\uAC70\uB798\uC18C KRX \uC804 \uAC70\uB798\uC77C \uB9C8\uAC10 \uACF5\uC2DC \uAE30\uC900 \xB7 \uAD6D\uB0B4 \uC0C1\uC7A5 \uC77C\uBC18 ETF ${generalCount.toLocaleString()}\uAC1C \uC804\uC218 \uBD84\uC11D
* \uBCF8 \uC790\uB8CC\uB294 \uD22C\uC790 \uD310\uB2E8\uC744 \uB3D5\uAE30 \uC704\uD55C \uC815\uBCF4 \uC81C\uACF5\uC6A9\uC774\uBA70 \uD2B9\uC815 \uC885\uBAA9\uC758 \uB9E4\uC218\xB7\uB9E4\uB3C4\uB97C \uAD8C\uC720\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.

#ETFCampus #ETF\uD22C\uC790 #ETF\uBE0C\uB9AC\uD551 #\uB9C8\uCF13\uBE0C\uB9AC\uD551 #\uC7AC\uD14C\uD06C`;
}
__name(generateInstagramCaption, "generateInstagramCaption");

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
function generateNewsletterHtml(payload, baseUrl, narrative) {
  const regime = narrative || classifyMarketRegime(payload);
  const dateStr = payload.asOfDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const formattedDate = dateStr.replace(/-/g, ".");
  const kospiChangePct = payload.kospiChangePct ?? 0;
  const kospiColor = kospiChangePct >= 0 ? "#DC2626" : "#2563EB";
  const kospiSign = kospiChangePct > 0 ? "+" : "";
  const kosdaqChangePct = payload.kosdaqChangePct ?? 0;
  const kosdaqSign = kosdaqChangePct > 0 ? "+" : "";
  const etfReturn = payload.generalAumWeightedReturnPct ?? 0;
  const etfSign = etfReturn > 0 ? "+" : "";
  const etfColor = etfReturn >= 0 ? "#DC2626" : "#2563EB";
  const capSpread = regime.capSpread ?? Number((kospiChangePct - kosdaqChangePct).toFixed(2));
  const etfDivergence = regime.etfDivergence ?? Number((kospiChangePct - etfReturn).toFixed(2));
  const capSpreadSign = capSpread > 0 ? "+" : "";
  const etfDivergenceSign = etfDivergence > 0 ? "+" : "";
  const totalAumEok = normalizeToEok(payload.marketScaleSnapshot?.totalAum || payload.pulse?.generalTotalAum || payload.generalTotalAum || 0);
  const totalTradeEok = normalizeToEok(payload.marketScaleSnapshot?.totalTradeValue || payload.pulse?.generalTotalTradeValue || payload.generalTotalTradeValue || 0);
  const aumJo = (totalAumEok / 1e4).toFixed(1);
  const tradeJo = (totalTradeEok / 1e4).toFixed(1);
  const turnoverPct = totalAumEok > 0 ? totalTradeEok / totalAumEok * 100 : payload.marketScaleSnapshot?.marketTurnoverPct ?? payload.marketTurnoverPct ?? 0;
  const totalEtfCount = payload.pulse?.totalEtfCount || 0;
  const up = payload.upCount ?? payload.pulse?.upCount ?? 0;
  const flat = payload.flatCount ?? payload.pulse?.flatCount ?? 0;
  const down = payload.downCount ?? payload.pulse?.downCount ?? 0;
  const generalCount = payload.generalEtfCount ?? payload.pulse?.generalEtfCount ?? up + flat + down;
  const upRatioPct = generalCount > 0 ? up / generalCount * 100 : 0;
  const dailyTs = payload.marketScaleTimeSeries?.daily || [];
  const latestTs = dailyTs.length > 0 ? dailyTs[dailyTs.length - 1] : null;
  const prevTs = dailyTs.length > 1 ? dailyTs[dailyTs.length - 2] : null;
  let totalAumChangeStr = "";
  let totalAdtvChangeStr = "";
  if (latestTs) {
    const aumChangeJo = latestTs.aumChange / 1e4;
    const signAum = aumChangeJo > 0 ? "+" : "";
    const colorAum = aumChangeJo >= 0 ? "#DC2626" : "#2563EB";
    totalAumChangeStr = `<span style="color: ${colorAum};" class="tabular">${signAum}${aumChangeJo.toFixed(1)}\uC870\uC6D0</span>`;
    if (prevTs) {
      const adtvChangeJo = (latestTs.adtv - prevTs.adtv) / 1e4;
      const signAdtv = adtvChangeJo > 0 ? "+" : "";
      const colorAdtv = adtvChangeJo >= 0 ? "#DC2626" : "#2563EB";
      totalAdtvChangeStr = `<span style="color: ${colorAdtv};" class="tabular">${signAdtv}${adtvChangeJo.toFixed(1)}\uC870\uC6D0</span>`;
    }
  }
  const sortedPeerGroups = [...payload.peerGroups || []].sort(
    (a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct
  );
  const winners = sortedPeerGroups.slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().slice(0, 3);
  const topTheme = sortedPeerGroups[0] || { peerGroup: "\uB370\uC774\uD130 \uC5C6\uC74C", cappedAumWeightedReturnPct: 0 };
  const bottomTheme = sortedPeerGroups.length > 1 ? sortedPeerGroups[sortedPeerGroups.length - 1] : { peerGroup: "\uB370\uC774\uD130 \uC5C6\uC74C", cappedAumWeightedReturnPct: 0 };
  const cleanTopThemeName = topTheme.peerGroup.replace(/\s*\([^)]*\)/g, "").trim();
  const cleanBottomThemeName = bottomTheme.peerGroup.replace(/\s*\([^)]*\)/g, "").trim();
  const topThemeRet = topTheme.cappedAumWeightedReturnPct ?? 0;
  const bottomThemeRet = bottomTheme.cappedAumWeightedReturnPct ?? 0;
  const topThemeSign = topThemeRet > 0 ? "+" : "";
  const bottomThemeSign = bottomThemeRet > 0 ? "+" : "";
  const topThemeVerb = topThemeRet > 0 ? "\uC0C1\uC2B9 \uC8FC\uB3C4" : "\uC120\uBC29";
  const themeSpread = Math.abs(topThemeRet - bottomThemeRet);
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const topInflowName = topInflows[0]?.name || topInflows[0]?.etfName || "\uD575\uC2EC ETF";
  const topInflowInflow = topInflows[0]?.inflow ? Math.round(topInflows[0].inflow) : topInflows[0]?.netInflowValue ? Math.round(topInflows[0].netInflowValue / 1e8) : 0;
  const topInflowAmountStr = topInflowInflow > 0 ? ` +${topInflowInflow.toLocaleString()}\uC5B5\uC6D0 \uB4F1` : " \uC911\uC2EC";
  const disparityList = payload.disparityWarning || [];
  const overvalued = disparityList.filter((d) => d.disparityPct > 0);
  const undervalued = disparityList.filter((d) => d.disparityPct < 0);
  let divergenceDiagnosis = "\uC9C0\uC218\uC640 \uBD84\uC0B0 ETF\uAC00 \uACE0\uB974\uAC8C \uB3D9\uD589\uD588\uC2B5\uB2C8\uB2E4.";
  if (etfDivergence >= 1.5) {
    divergenceDiagnosis = "\uB300\uD615\uC8FC \uC3E0\uB9BC\uC73C\uB85C \uC778\uD55C \uC9C0\uC218 \uCC29\uC2DC\uAC00 \uAD00\uCE21\uB418\uC5C8\uC73C\uBA70 \uC77C\uBC18 ETF \uC0C1\uC2B9\uD3ED\uC740 \uCC28\uBCC4\uD654\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
  } else if (etfDivergence <= -1) {
    divergenceDiagnosis = "\uC9C0\uC218 \uC57D\uC138 \uC18D\uC5D0\uC11C\uB3C4 \uBD84\uC0B0 ETF\uC758 \uC790\uC0B0\uBC30\uBD84 \uBC29\uC5B4\uB825\uC774 \uC6B0\uC218\uD558\uAC8C \uC791\uB3D9\uD588\uC2B5\uB2C8\uB2E4.";
  }
  const utmLink = `${baseUrl}/briefing?utm_source=newsletter&utm_medium=email&utm_campaign=daily_briefing_${dateStr.replace(/-/g, "")}`;
  const subject = `[ETF \uB9C8\uCF13 \uBE0C\uB9AC\uD551] ${formattedDate} ${regime.statusName} \uC18D '${cleanTopThemeName}' \uAC15\uC138 \uBC0F \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC21C\uC720\uC785`;
  const preheader = `[${formattedDate} \uB9C8\uCF13 \uBE0C\uB9AC\uD551] KOSPI ${kospiSign}${kospiChangePct.toFixed(2)}% \xB7 \uC77C\uBC18 ETF ${etfSign}${etfReturn.toFixed(2)}% | \uC8FC\uB3C4 \uD14C\uB9C8 '${cleanTopThemeName}' ${topThemeSign}${topThemeRet.toFixed(2)}% \uBC0F \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC21C\uC720\uC785 \uC9D1\uC911 \uC885\uBAA9`;
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <title>${escapeXml2(subject)}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background-color: #F8FAFC; color: #0F172A; -webkit-font-smoothing: antialiased; }
    .container { max-width: 620px; margin: 24px auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; }
    .header { background: linear-gradient(135deg, #064E3B 0%, #047857 100%); padding: 36px 24px; text-align: center; color: #FFFFFF; }
    .badge { display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #A7F3D0; padding: 5px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.3); }
    .title { font-size: 26px; font-weight: 900; margin: 0 0 8px; color: #FFFFFF; letter-spacing: -0.6px; }
    .subtitle { font-size: 14px; color: #D1FAE5; font-weight: 700; }
    .content { padding: 30px 22px; }
    
    .tabular { font-variant-numeric: tabular-nums; }
    .metric-card { background-color: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 16px 12px; text-align: center; box-sizing: border-box; }
    .metric-label { font-size: 13px; color: #475569; font-weight: 800; margin-bottom: 5px; }
    .metric-value { font-size: 22px; font-weight: 900; margin: 4px 0; color: #0F172A; }
    
    .table-custom { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 14px; border-radius: 12px; overflow: hidden; border: 1.5px solid #E2E8F0; }
    .table-custom th { background-color: #F1F5F9; padding: 11px 12px; text-align: left; font-weight: 800; color: #334155; border-bottom: 1.5px solid #E2E8F0; font-size: 13px; }
    .table-custom td { padding: 11px 12px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    .table-custom tr:last-child td { border-bottom: none; }
    
    .btn-primary { display: block; width: 100%; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #FFFFFF !important; text-align: center; padding: 17px 0; border-radius: 12px; font-size: 16.5px; font-weight: 800; text-decoration: none; margin: 28px 0 10px; box-sizing: border-box; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3); letter-spacing: -0.3px; }
    .footer { background-color: #F8FAFC; padding: 26px 20px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; line-height: 1.65; font-weight: 600; }
    
    @media only screen and (max-width: 480px) {
      .container { margin: 8px auto !important; border-radius: 14px !important; }
      .header { padding: 28px 16px !important; }
      .title { font-size: 22px !important; }
      .content { padding: 20px 14px !important; }
      .metric-value { font-size: 19px !important; }
    }
  </style>
</head>
<body bgcolor="#F8FAFC" style="margin: 0; padding: 0; background-color: #F8FAFC;">
  <!-- Hidden Preheader for Inbox Preview -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #FFFFFF; opacity: 0;">
    ${escapeXml2(preheader)}
    &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <div style="padding: 12px 6px;">
    <div class="container" style="background-color: #FFFFFF;">
      <!-- Header -->
      <div class="header">
        <span class="badge">ETF CAMPUS \xB7 DAILY BRIEFING</span>
        <div class="title">${formattedDate} ETF \uB9C8\uCF13 \uBE0C\uB9AC\uD551</div>
        <div class="subtitle">\uAD6D\uB0B4 \uC0C1\uC7A5 \uC77C\uBC18 ETF ${generalCount.toLocaleString()}\uAC1C \uC804\uC218 \uBD84\uC11D \uB9AC\uD3EC\uD2B8</div>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- 1. Executive Summary (3-Axis Market Matrix Diagnosis Box) -->
        <div style="background-color: #F8FAFC; border-left: 5px solid #059669; padding: 18px; border-radius: 0 14px 14px 0; margin-bottom: 24px; border-top: 1.5px solid #E2E8F0; border-right: 1.5px solid #E2E8F0; border-bottom: 1.5px solid #E2E8F0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-bottom: 1.5px dashed #CBD5E1; padding-bottom: 10px; margin-bottom: 12px;">
            <tr>
              <td style="text-align: left; vertical-align: middle;">
                <span style="display: inline-block; background-color: #ECFDF5; color: #047857; font-size: 12px; font-weight: 800; padding: 3px 8px; border-radius: 6px; border: 1px solid #A7F3D0; margin-right: 6px;">
                  ${escapeXml2(regime.statusName)}
                </span>
                <span style="font-size: 14.5px; font-weight: 800; color: #065F46;">\uC624\uB298\uC758 30\uCD08 \uD575\uC2EC \uC9C4\uB2E8</span>
              </td>
              <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
                <span style="font-size: 12px; font-weight: 700; color: #64748B;">\uC77C\uBC18 ETF \uC804\uC218 \uBD84\uC11D</span>
              </td>
            </tr>
          </table>

          <div style="font-size: 15.5px; font-weight: 800; color: #0F172A; line-height: 1.6; margin-bottom: 14px; letter-spacing: -0.3px;">
            ${escapeXml2(regime.slide1Subheadline || `\uCF54\uC2A4\uD53C ${kospiSign}${kospiChangePct.toFixed(2)}% \uB4F1\uB77D \uC18D \uC77C\uBC18 ETF \uC2DC\uC7A5\uC740 \uC0C1\uC2B9 ${up}\uAC1C vs \uD558\uB77D ${down}\uAC1C\uB85C ${regime.statusName} \uD750\uB984\uC744 \uC2DC\uD604\uD588\uC2B5\uB2C8\uB2E4.`)}
          </div>

          <!-- 3-Bullet Strategic Insight Table (Zero Parentheses & Zero Emojis) -->
          <div style="background-color: #FFFFFF; border-radius: 12px; padding: 12px 14px; border: 1.5px solid #E2E8F0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
              <!-- Bullet 1: 3-Axis Market Pulse -->
              <tr>
                <td style="width: 86px; vertical-align: top; padding: 5px 0; white-space: nowrap;">
                  <span style="display: inline-block; background-color: #F1F5F9; color: #334155; font-size: 12px; font-weight: 800; padding: 2px 7px; border-radius: 6px; border: 1px solid #E2E8F0;">\uC2DC\uC7A5 \uCCB4\uC628</span>
                </td>
                <td style="vertical-align: top; padding: 5px 0 5px 10px; font-size: 14px; font-weight: 700; color: #1E293B; line-height: 1.55;">
                  KOSPI ${kospiSign}${kospiChangePct.toFixed(2)}% \uB300\uBE44 \uC77C\uBC18 ETF \uAC00\uC911\uC218\uC775\uB960 ${etfSign}${etfReturn.toFixed(2)}%, \uAD34\uB9AC ${etfDivergenceSign}${etfDivergence.toFixed(2)}%p \uC218\uC900. ${divergenceDiagnosis}
                </td>
              </tr>
              <!-- Bullet 2: Leading & Lagging Theme Spread -->
              <tr>
                <td style="width: 86px; vertical-align: top; padding: 8px 0 5px; white-space: nowrap;">
                  <span style="display: inline-block; background-color: #FEF2F2; color: #DC2626; font-size: 12px; font-weight: 800; padding: 2px 7px; border-radius: 6px; border: 1px solid #FECACA;">\uC8FC\uB3C4 \uD14C\uB9C8</span>
                </td>
                <td style="vertical-align: top; padding: 8px 0 5px 10px; font-size: 14px; font-weight: 700; color: #1E293B; line-height: 1.55;">
                  <strong style="color: #DC2626;">'${escapeXml2(cleanTopThemeName)}'</strong> ${topThemeSign}${topThemeRet.toFixed(2)}% ${topThemeVerb}, \uCD5C\uD558\uC704 '${escapeXml2(cleanBottomThemeName)}' ${bottomThemeSign}${bottomThemeRet.toFixed(2)}% \uB300\uBE44 \uD14C\uB9C8 \uC2A4\uD504\uB808\uB4DC ${themeSpread.toFixed(2)}%p
                </td>
              </tr>
              <!-- Bullet 3: Smart Money Flow Focus -->
              <tr>
                <td style="width: 86px; vertical-align: top; padding: 8px 0 5px; white-space: nowrap;">
                  <span style="display: inline-block; background-color: #ECFDF5; color: #047857; font-size: 12px; font-weight: 800; padding: 2px 7px; border-radius: 6px; border: 1px solid #A7F3D0;">\uC2A4\uB9C8\uD2B8\uBA38\uB2C8</span>
                </td>
                <td style="vertical-align: top; padding: 8px 0 5px 10px; font-size: 14px; font-weight: 700; color: #1E293B; line-height: 1.55;">
                  <strong style="color: #047857;">'${escapeXml2(topInflowName)}'</strong>${topInflowAmountStr} \uC2E4\uC9C8 \uC790\uAE08 \uC21C\uC720\uC785 \uC9D1\uC911
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- 2. 4-Card Overview Grid (Email-Safe Standard Table) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 12px; border-collapse: collapse;">
          <tr>
            <td width="48.5%" style="vertical-align: top;">
              <div class="metric-card">
                <div class="metric-label">KOSPI vs \uC77C\uBC18 ETF</div>
                <div class="metric-value tabular" style="font-size: 19px;">
                  <span style="color: ${kospiColor};">${kospiSign}${kospiChangePct.toFixed(2)}%</span>
                  <span style="color: #94A3B8; font-size: 14px;">/</span>
                  <span style="color: ${etfColor};">${etfSign}${etfReturn.toFixed(2)}%</span>
                </div>
                <div style="font-size: 12px; font-weight: 700; color: #475569;" class="tabular">
                  KOSDAQ ${kosdaqSign}${kosdaqChangePct.toFixed(2)}% \xB7 \uC2A4\uD504\uB808\uB4DC ${capSpreadSign}${capSpread.toFixed(2)}%p
                </div>
              </div>
            </td>
            <td width="3%"></td>
            <td width="48.5%" style="vertical-align: top;">
              <div class="metric-card">
                <div class="metric-label">\uC2DC\uC7A5 \uCCB4\uC628 \xB7 \uB4F1\uB77D \uBD84\uD3EC</div>
                <div class="metric-value tabular" style="font-size: 17px; margin: 5px 0;">
                  <span style="color: #DC2626;">\uC0C1\uC2B9 ${up}</span>
                  <span style="color: #CBD5E1; font-size: 13px;">\xB7</span>
                  <span style="color: #64748B;">\uBCF4\uD569 ${flat}</span>
                  <span style="color: #CBD5E1; font-size: 13px;">\xB7</span>
                  <span style="color: #2563EB;">\uD558\uB77D ${down}</span>
                </div>
                <div style="font-size: 12px; font-weight: 700; color: #475569;" class="tabular">
                  \uC0C1\uC2B9 \uBE44\uC728 ${upRatioPct.toFixed(1)}% \xB7 \uC77C\uBC18 ${generalCount.toLocaleString()}\uAC1C \uAE30\uC900
                </div>
              </div>
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 22px; border-collapse: collapse;">
          <tr>
            <td width="48.5%" style="vertical-align: top;">
              <div class="metric-card">
                <div class="metric-label">\uC804\uCCB4 ETF \uCD1D \uC21C\uC790\uC0B0 AUM</div>
                <div class="metric-value tabular">${aumJo}\uC870\uC6D0</div>
                <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 4px;">
                  ${totalEtfCount > 0 ? `${totalEtfCount.toLocaleString()}\uAC1C \uC804\uCCB4 \uC885\uBAA9 \uAE30\uC900` : `${generalCount.toLocaleString()}\uAC1C \uC77C\uBC18 \uC885\uBAA9 \uD3EC\uD568`}
                </div>
                ${totalAumChangeStr ? `<div style="font-size: 12.5px; font-weight: 800; color: #1E293B; margin-top: 5px; border-top: 1.5px dashed #CBD5E1; padding-top: 4px;">\uC804\uCCB4 ETF \uAE30\uC900 \uC804\uC77C\uBE44 ${totalAumChangeStr}</div>` : ""}
              </div>
            </td>
            <td width="3%"></td>
            <td width="48.5%" style="vertical-align: top;">
              <div class="metric-card">
                <div class="metric-label">\uC804\uCCB4 ETF \uC77C \uAC70\uB798\uB300\uAE08 \xB7 \uD68C\uC804\uC728</div>
                <div class="metric-value tabular">${tradeJo}\uC870\uC6D0</div>
                <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 4px;" class="tabular">
                  \uC77C\uC77C \uD68C\uC804\uC728 ${turnoverPct.toFixed(1)}%
                </div>
                ${totalAdtvChangeStr ? `<div style="font-size: 12.5px; font-weight: 800; color: #1E293B; margin-top: 5px; border-top: 1.5px dashed #CBD5E1; padding-top: 4px;">\uC804\uCCB4 ETF \uAE30\uC900 \uC804\uC77C\uBE44 ${totalAdtvChangeStr}</div>` : ""}
              </div>
            </td>
          </tr>
        </table>

        <!-- 3. Section: Leading & Lagging Themes (Top 3 vs Worst 3) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-top: 26px; margin-bottom: 10px;">
          <tr>
            <td style="text-align: left; vertical-align: middle;">
              <span style="font-size: 17px; font-weight: 900; color: #0F172A; letter-spacing: -0.4px;">\u25B2 \uC0C1\uC704 Top 3 vs \u25BC \uD558\uC704 Worst 3 \uD14C\uB9C8</span>
            </td>
            <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
              <span style="font-size: 12px; color: #64748B; font-weight: 700;">AUM \uAC00\uC911 \uD3C9\uADE0 \uC218\uC775\uB960 \uAE30\uC900</span>
            </td>
          </tr>
        </table>
        <table class="table-custom">
          <thead>
            <tr>
              <th style="width: 90px;">\uAD6C\uBD84</th>
              <th>\uD14C\uB9C8\uBA85</th>
              <th style="text-align: right;">\uB4F1\uB77D\uB960</th>
            </tr>
          </thead>
          <tbody>
            ${winners.map((w, idx) => {
    const cleanName = w.peerGroup.replace(/\s*\([^)]*\)/g, "").trim();
    const ret = w.cappedAumWeightedReturnPct ?? 0;
    const retSign = ret > 0 ? "\u25B2 +" : ret < 0 ? "\u25BC " : "";
    const retColor = ret >= 0 ? "#DC2626" : "#2563EB";
    return `
              <tr>
                <td style="font-weight: 800; color: #DC2626; font-size: 13.5px;">\u25B2 \uC0C1\uC704 ${idx + 1}\uC704</td>
                <td style="font-weight: 800; color: #0F172A; font-size: 14.5px;">${escapeXml2(cleanName)}</td>
                <td style="text-align: right; font-weight: 900; color: ${retColor}; font-size: 15px;" class="tabular">${retSign}${ret.toFixed(2)}%</td>
              </tr>
            `;
  }).join("")}
            ${losers.map((l, idx) => {
    const cleanName = l.peerGroup.replace(/\s*\([^)]*\)/g, "").trim();
    const ret = l.cappedAumWeightedReturnPct ?? 0;
    const retSign = ret > 0 ? "\u25B2 +" : ret < 0 ? "\u25BC " : "";
    const retColor = ret >= 0 ? "#DC2626" : "#2563EB";
    return `
              <tr>
                <td style="font-weight: 800; color: #2563EB; font-size: 13.5px;">\u25BC \uD558\uC704 ${idx + 1}\uC704</td>
                <td style="font-weight: 800; color: #0F172A; font-size: 14.5px;">${escapeXml2(cleanName)}</td>
                <td style="text-align: right; font-weight: 900; color: ${retColor}; font-size: 15px;" class="tabular">${retSign}${ret.toFixed(2)}%</td>
              </tr>
            `;
  }).join("")}
          </tbody>
        </table>
        <div style="font-size: 12px; color: #64748B; font-weight: 700; margin-bottom: 24px; text-align: right;" class="tabular">
          \u203B 1\uC704 '${escapeXml2(cleanTopThemeName)}'\uC640 \uCD5C\uD558\uC704 '${escapeXml2(cleanBottomThemeName)}' \uAC04 \uD14C\uB9C8 \uC218\uC775\uB960 \uC2A4\uD504\uB808\uB4DC\uB294 ${themeSpread.toFixed(2)}%p\uC785\uB2C8\uB2E4.
        </div>

        <!-- 4. Section: Smart Money Net Inflows TOP 5 (Clickable Links) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-top: 24px; margin-bottom: 10px;">
          <tr>
            <td style="text-align: left; vertical-align: middle;">
              <span style="font-size: 17px; font-weight: 900; color: #0F172A; letter-spacing: -0.4px;">\uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC678\uC778\xB7\uAE30\uAD00 \uC2E4\uC9C8 \uC21C\uC720\uC785 TOP 5</span>
            </td>
            <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
              <span style="font-size: 12px; color: #64748B; font-weight: 700;">\uC77C\uBC18 \uD14C\uB9C8 ETF \uAE30\uC900 \xB7 \uB2E8\uC704: \uC5B5\uC6D0</span>
            </td>
          </tr>
        </table>
        <table class="table-custom">
          <thead>
            <tr>
              <th style="width: 44px; text-align: center;">\uC21C\uC704</th>
              <th>\uC885\uBAA9\uBA85 / \uD2F0\uCEE4 (\uD074\uB9AD \uC2DC \uBD84\uC11D \uD398\uC774\uC9C0 \uC774\uB3D9)</th>
              <th style="text-align: right;">\uC2E4\uC9C8 \uC21C\uC720\uC785\uC561</th>
            </tr>
          </thead>
          <tbody>
            ${topInflows.slice(0, 5).map((item, idx) => {
    const name = item.name || item.etfName || item.ticker || "";
    const ticker = item.ticker || "";
    const inflowEok = item.inflow ? Math.round(item.inflow) : item.netInflowValue ? Math.round(item.netInflowValue / 1e8) : 0;
    const etfDetailUrl = `${baseUrl}/etf/${ticker}?utm_source=newsletter&utm_medium=email&utm_campaign=smart_money_${dateStr.replace(/-/g, "")}`;
    return `
              <tr>
                <td style="font-weight: 800; color: ${idx === 0 ? "#059669" : "#64748B"}; text-align: center; font-size: 14.5px;">${idx + 1}</td>
                <td>
                  <a href="${etfDetailUrl}" target="_blank" style="text-decoration: none; color: #0F172A; display: block;">
                    <div style="font-weight: 800; font-size: 14.5px; color: #0F172A;">${escapeXml2(name)}</div>
                    <div style="font-size: 12px; font-weight: 700; color: #059669; margin-top: 2px;" class="tabular">${escapeXml2(ticker)} \xB7 \uC885\uBAA9 \uC0C1\uC138 \uBD84\uC11D \u2197</div>
                  </a>
                </td>
                <td style="text-align: right; font-weight: 900; color: #047857; font-size: 15.5px;" class="tabular">+${inflowEok.toLocaleString()}\uC5B5\uC6D0</td>
              </tr>
              `;
  }).join("")}
          </tbody>
        </table>

        <!-- 5. Section: Disparity Warning (\uC218\uAE09 \uC3E0\uB9BC \uC8FC\uC758 ETF \xB7 \uAD34\uB9AC\uC728 \uACBD\uBCF4) -->
        <div style="margin-top: 26px; background-color: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 18px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-bottom: 1.5px solid #F1F5F9; padding-bottom: 12px; margin-bottom: 14px;">
            <tr>
              <td style="text-align: left; vertical-align: middle;">
                <span style="font-size: 15.5px; font-weight: 900; color: #0F172A; margin-right: 6px;">\uC218\uAE09 \uC3E0\uB9BC \uC8FC\uC758 ETF \xB7 \uAD34\uB9AC\uC728 \uACBD\uBCF4</span>
                <span style="display: inline-block; background-color: #F1F5F9; color: #334155; font-size: 12px; font-weight: 800; padding: 2px 7px; border-radius: 999px;">\uCD1D ${disparityList.length}\uAC1C</span>
              </td>
              <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
                <span style="font-size: 12px; font-weight: 700; color: #64748B;">\uAE30\uC900: \uAD6D\uB0B4 1.0% / \uD574\uC678 3.0% \uC774\uC0C1</span>
              </td>
            </tr>
          </table>

          <!-- Overvalued Sub-panel -->
          <div style="margin-bottom: 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 8px;">
              <tr>
                <td style="text-align: left; vertical-align: middle;">
                  <span style="font-size: 14px; font-weight: 800; color: #DC2626;">\uACE0\uD3C9\uAC00 TOP 3 \xB7 \uD560\uC99D \uC8FC\uC758</span>
                </td>
                <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
                  <span style="font-size: 12px; font-weight: 700; color: #DC2626; background-color: #FEF2F2; padding: 3px 8px; border-radius: 6px;">\uCD94\uACA9 \uB9E4\uC218 \uC8FC\uC758 \xB7 \uC2DC\uC7A5\uAC00 &gt; NAV</span>
                </td>
              </tr>
            </table>
            ${overvalued.length === 0 ? `
              <div style="background-color: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 10px; padding: 11px; text-align: center; font-size: 13px; color: #475569; font-weight: 700;">
                <span style="color: #10B981; font-weight: 800; margin-right: 5px;">[\uC815\uC0C1]</span> \uD604\uC7AC \uACE0\uD3C9\uAC00 \uACBD\uBCF4 \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                ${overvalued.slice(0, 3).map((item, idx) => `
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="width: 24px; font-weight: 800; color: #DC2626; text-align: center; font-size: 13.5px;">${idx + 1}</td>
                    <td style="padding: 8px 8px;">
                      <a href="${baseUrl}/etf/${item.ticker}?utm_source=newsletter&utm_medium=email&utm_campaign=disparity_${dateStr.replace(/-/g, "")}" target="_blank" style="text-decoration: none; color: #0F172A; display: block;">
                        <div style="font-weight: 800; color: #0F172A; font-size: 14px;">${escapeXml2(item.etfName)}</div>
                        <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-top: 2px;">${escapeXml2(item.ticker)} \xB7 ${escapeXml2(item.assetClass || "\uC77C\uBC18")} \xB7 \uC885\uBAA9 \uBCF4\uAE30 \u2197</div>
                      </a>
                    </td>
                    <td style="text-align: right; padding: 8px 8px;">
                      <span style="display: inline-block; background-color: #FEF2F2; color: #DC2626; font-weight: 800; font-size: 13px; padding: 4px 8px; border-radius: 6px;" class="tabular">+${item.disparityPct.toFixed(2)}% \uACE0\uD3C9\uAC00</span>
                    </td>
                  </tr>
                `).join("")}
              </table>
            `}
          </div>

          <!-- Undervalued Sub-panel -->
          <div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 8px;">
              <tr>
                <td style="text-align: left; vertical-align: middle;">
                  <span style="font-size: 14px; font-weight: 800; color: #2563EB;">\uC800\uD3C9\uAC00 TOP 3 \xB7 \uD560\uC778 \uCCB4\uD06C</span>
                </td>
                <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
                  <span style="font-size: 12px; font-weight: 700; color: #2563EB; background-color: #EFF6FF; padding: 3px 8px; border-radius: 6px;">\uD5D0\uAC12 \uB9E4\uB3C4 \uC720\uC758 \uBC0F \uC2DC\uCC28 \uD655\uC778 \xB7 \uC2DC\uC7A5\uAC00 &lt; NAV</span>
                </td>
              </tr>
            </table>
            ${undervalued.length === 0 ? `
              <div style="background-color: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 10px; padding: 11px; text-align: center; font-size: 13px; color: #475569; font-weight: 700;">
                <span style="color: #10B981; font-weight: 800; margin-right: 5px;">[\uC815\uC0C1]</span> \uD604\uC7AC \uC800\uD3C9\uAC00 \uACBD\uBCF4 \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                ${undervalued.slice(0, 3).map((item, idx) => `
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="width: 24px; font-weight: 800; color: #2563EB; text-align: center; font-size: 13.5px;">${idx + 1}</td>
                    <td style="padding: 8px 8px;">
                      <a href="${baseUrl}/etf/${item.ticker}?utm_source=newsletter&utm_medium=email&utm_campaign=disparity_${dateStr.replace(/-/g, "")}" target="_blank" style="text-decoration: none; color: #0F172A; display: block;">
                        <div style="font-weight: 800; color: #0F172A; font-size: 14px;">${escapeXml2(item.etfName)}</div>
                        <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-top: 2px;">${escapeXml2(item.ticker)} \xB7 ${escapeXml2(item.assetClass || "\uC77C\uBC18")} \xB7 \uC885\uBAA9 \uBCF4\uAE30 \u2197</div>
                      </a>
                    </td>
                    <td style="text-align: right; padding: 8px 8px;">
                      <span style="display: inline-block; background-color: #EFF6FF; color: #2563EB; font-weight: 800; font-size: 13px; padding: 4px 8px; border-radius: 6px;" class="tabular">${item.disparityPct.toFixed(2)}% \uC800\uD3C9\uAC00</span>
                    </td>
                  </tr>
                `).join("")}
              </table>
            `}
          </div>
        </div>

        <!-- 6. Call to Action Button -->
        <a href="${utmLink}" class="btn-primary" target="_blank">
          \uC804\uCCB4 ${generalCount.toLocaleString()}\uAC1C ETF \uBD84\uC11D &amp; \uB9C8\uCF13 \uBE0C\uB9AC\uD551 \uD480\uBC84\uC804 \uD655\uC778\uD558\uAE30 \u2197
        </a>
      </div>

      <!-- 7. Compliance & Regulatory Disclaimers (Capital Markets Act Art. 101) -->
      <div class="footer">
        <div><strong style="color: #1E293B; font-size: 13px;">ETF CAMPUS \xB7 ETF \uCEA0\uD37C\uC2A4</strong></div>
        <div style="margin-top: 8px; font-size: 11.5px; color: #64748B; line-height: 1.65;">
          \uBCF8 \uB274\uC2A4\uB808\uD130\uB294 \uACF5\uACF5 \uB370\uC774\uD130 \uBC0F \uD55C\uAD6D\uAC70\uB798\uC18C(KRX) \uACF5\uC2DC \uB370\uC774\uD130\uB97C \uAE30\uBC18\uC73C\uB85C \uC2DC\uC7A5 \uB3D9\uD5A5\uC744 \uAC1D\uAD00\uC801\uC73C\uB85C \uC9D1\uACC4\xB7\uC815\uB9AC\uD55C \uC815\uBCF4 \uC81C\uACF5\uC6A9 \uCF58\uD150\uCE20\uC774\uBA70, \uD2B9\uC815 \uAE08\uC735\uD22C\uC790\uC0C1\uD488\uC5D0 \uB300\uD55C \uB9E4\uC218\xB7\uB9E4\uB3C4\uB97C \uCD94\uCC9C\uD558\uAC70\uB098 \uC218\uC775\uB960\uC744 \uBCF4\uC7A5\uD558\uB294 \uD22C\uC790 \uAD8C\uC720\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uACFC\uAC70\uC758 \uC6B4\uC6A9 \uC2E4\uC801\uC774 \uBBF8\uB798\uC758 \uC218\uC775\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.<br>
          \uAE30\uC900\uC77C\uC790: ${formattedDate} \uC7A5 \uB9C8\uAC10 \uAE30\uC900 \xB7 \uB370\uC774\uD130 \uCD9C\uCC98: \uD55C\uAD6D\uAC70\uB798\uC18C(KRX)<br>
          <div style="margin-top: 10px; color: #94A3B8;">
            \xA9 2026 ETF Campus. All rights reserved. \xB7 <a href="${baseUrl}/unsubscribe" style="color: #64748B; text-decoration: underline;">\uC218\uC2E0\uAC70\uBD80 (Unsubscribe)</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  return { subject, preheader, html };
}
__name(generateNewsletterHtml, "generateNewsletterHtml");

// src/templates/threads.ts
function formatDateWithDay2(dateStr) {
  if (!dateStr) {
    const today = /* @__PURE__ */ new Date();
    const days2 = ["\uC77C\uC694\uC77C", "\uC6D4\uC694\uC77C", "\uD654\uC694\uC77C", "\uC218\uC694\uC77C", "\uBAA9\uC694\uC77C", "\uAE08\uC694\uC77C", "\uD1A0\uC694\uC77C"];
    return `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")} \xB7 ${days2[today.getDay()]}`;
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["\uC77C\uC694\uC77C", "\uC6D4\uC694\uC77C", "\uD654\uC694\uC77C", "\uC218\uC694\uC77C", "\uBAA9\uC694\uC77C", "\uAE08\uC694\uC77C", "\uD1A0\uC694\uC77C"];
  const dayName = days[date.getDay()] || "\uC6D4\uC694\uC77C";
  return `${dateStr.replace(/-/g, ".")} \xB7 ${dayName}`;
}
__name(formatDateWithDay2, "formatDateWithDay");
function generateThreadsThread(payload, baseUrl, narrative) {
  const regime = narrative || classifyMarketRegime(payload);
  const generalCount = payload.generalEtfCount ?? payload.pulse?.generalEtfCount ?? 0;
  const cleanThemeName = /* @__PURE__ */ __name((name) => {
    return name.replace(/\s*\([^)]*\)/g, "").replace(/피지컬\s*AI\s*&\s*지능형\s*로봇/g, "\uD53C\uC9C0\uCEEC AI & \uB85C\uBD07").replace(/전통\s*반도체\s*소부장/g, "\uBC18\uB3C4\uCCB4 \uC18C\uBD80\uC7A5").replace(/K-푸드\s*&\s*K-뷰티/g, "K-\uD478\uB4DC & \uBDF0\uD2F0").replace(/글로벌\s*럭셔리\s*&\s*소비재/g, "\uAE00\uB85C\uBC8C \uB7ED\uC154\uB9AC").trim();
  }, "cleanThemeName");
  const cleanEtfName = /* @__PURE__ */ __name((rawName) => {
    return rawName.replace(/\s*\([^)]*\)/g, "").replace(/플러스/g, "").trim();
  }, "cleanEtfName");
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 2) || [];
  const inflowSentence = topInflows.length > 0 ? `

\uC2A4\uB9C8\uD2B8\uBA38\uB2C8\uB294 ${topInflows.map((i) => {
    const item = i;
    const name = cleanEtfName(item.name || item.etfName || "\uB300\uD45C\uC9C0\uC218");
    const val = item.inflow ?? (item.netInflowValue ? Math.round(item.netInflowValue / 1e8) : 0);
    return `${name} +${(val || 0).toLocaleString()}\uC5B5`;
  }).join(", ")} \uC21C\uC73C\uB85C \uC720\uC785\uB410\uC2B5\uB2C8\uB2E4.` : "";
  const sortedPeerGroups = [...payload.peerGroups || []].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const strongThemes = sortedPeerGroups.slice(0, 2);
  const weakThemes = [...sortedPeerGroups].reverse().slice(0, 2);
  const strongText = strongThemes.length > 0 ? strongThemes.map((t) => `${cleanThemeName(t.peerGroup)} ${t.cappedAumWeightedReturnPct > 0 ? "+" : ""}${t.cappedAumWeightedReturnPct.toFixed(2)}%`).join(", ") : "\uC0C1\uC704 \uD14C\uB9C8 \uC548\uC815";
  const weakText = weakThemes.length > 0 ? weakThemes.map((t) => `${cleanThemeName(t.peerGroup)} ${t.cappedAumWeightedReturnPct > 0 ? "+" : ""}${t.cappedAumWeightedReturnPct.toFixed(2)}%`).join(", ") : "\uD558\uC704 \uD14C\uB9C8 \uC870\uC815";
  let watchPointText = regime.threadsWatchPoint || "\uBC18\uB4F1\uC7A5\uC77C\uC218\uB85D \uD14C\uB9C8\uC758 \uAC70\uB798\uB300\uAE08\uACFC \uC790\uAE08 \uC21C\uC720\uC785 \uC9C0\uC18D\uC131\uC744 \uBD84\uBCC4\uD558\uB294 \uD0DC\uB3C4\uAC00 \uC911\uC694\uD569\uB2C8\uB2E4. \uC624\uB298 \uC8FC\uBAA9\uD558\uB294 \uC139\uD130\uB294 \uC5B4\uB514\uC778\uAC00\uC694?";
  const sourceNotice = `* KRX \uACF5\uC2DC \uB9C8\uAC10 \uAD6D\uB0B4 \uC77C\uBC18 ETF ${generalCount.toLocaleString()}\uAC1C \uC804\uC218 \uBD84\uC11D \xB7 \uD22C\uC790 \uCC38\uACE0\uC6A9`;
  const formattedDate = formatDateWithDay2(payload.asOfDate);
  const opening = (regime.threadsOpening || "").replace(/어제\s*/g, "").trim();
  let summary = (regime.threadsMarketSummary || "").replace(/어제\s*/g, "").trim();
  let mainPost = `${formattedDate} ETF \uB9C8\uCF13 \uB3D9\uD5A5

${opening}

${summary}

\uD14C\uB9C8\uBCC4\uB85C\uB294 ${strongText} \uD14C\uB9C8\uAC00 \uACAC\uC870\uD588\uB358 \uBC18\uBA74, ${weakText} \uD14C\uB9C8\uB294 \uC870\uC815\uC744 \uBC1B\uC558\uC2B5\uB2C8\uB2E4.${inflowSentence}

${watchPointText}

${sourceNotice}`;
  const MAX_SAFE_CHARS = 460;
  if (mainPost.length > MAX_SAFE_CHARS) {
    if (summary.includes(". ")) {
      summary = summary.split(". ")[0].trim() + ".";
    }
    if (watchPointText.length > 60) {
      const matchQuestion = watchPointText.match(/오늘[^?]+\?/);
      watchPointText = matchQuestion ? `\uC8FC\uB3C4 \uD14C\uB9C8\uC758 \uC218\uAE09 \uC9C0\uC18D\uC131\uC744 \uC810\uAC80\uD560 \uB54C\uC785\uB2C8\uB2E4. ${matchQuestion[0]}` : "\uC8FC\uB3C4 \uD14C\uB9C8\uC758 \uC218\uAE09 \uC9C0\uC18D\uC131\uC744 \uC810\uAC80\uD560 \uB54C\uC785\uB2C8\uB2E4. \uC624\uB298 \uC8FC\uBAA9\uD558\uB294 \uC139\uD130\uB294 \uC5B4\uB514\uC778\uAC00\uC694?";
    }
    mainPost = `${formattedDate} ETF \uB9C8\uCF13 \uB3D9\uD5A5

${opening}

${summary}

\uD14C\uB9C8\uBCC4\uB85C\uB294 ${strongText} \uD14C\uB9C8\uAC00 \uACAC\uC870\uD588\uB358 \uBC18\uBA74, ${weakText} \uD14C\uB9C8\uB294 \uC870\uC815\uC744 \uBC1B\uC558\uC2B5\uB2C8\uB2E4.${inflowSentence}

${watchPointText}

${sourceNotice}`;
  }
  if (mainPost.length > 480) {
    const footer = `

${sourceNotice}`;
    const budget = 480 - footer.length;
    mainPost = mainPost.slice(0, budget).trim() + "..." + footer;
  }
  return [
    { sequence: 1, content: mainPost }
  ];
}
__name(generateThreadsThread, "generateThreadsThread");
function escapeXml3(unsafe) {
  if (!unsafe) return "";
  return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
__name(escapeXml3, "escapeXml");
function calcThemeFontSize(themeName) {
  const len = themeName ? themeName.length : 0;
  if (len > 15) return 22;
  if (len > 11) return 24.5;
  return 27;
}
__name(calcThemeFontSize, "calcThemeFontSize");
function generateThreadsImageSvg(payload) {
  const dateStr = payload.asOfDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const formattedDate = formatDateWithDay2(dateStr);
  const kospi = payload.kospiChangePct ?? 0;
  const kosdaq = payload.kosdaqChangePct ?? 0;
  const etfReturn = payload.generalAumWeightedReturnPct ?? 0;
  const kospiSign = kospi > 0 ? "+" : "";
  const kosdaqSign = kosdaq > 0 ? "+" : "";
  const etfSign = etfReturn > 0 ? "+" : "";
  const kospiColor = kospi >= 0 ? "#D92D20" : "#175CD3";
  const kosdaqColor = kosdaq >= 0 ? "#D92D20" : "#175CD3";
  const etfColor = etfReturn >= 0 ? "#D92D20" : "#175CD3";
  const up = payload.upCount ?? payload.pulse?.upCount ?? 0;
  const down = payload.downCount ?? payload.pulse?.downCount ?? 0;
  const flat = payload.flatCount ?? payload.pulse?.flatCount ?? 0;
  const generalCount = payload.generalEtfCount ?? payload.pulse?.generalEtfCount ?? 0;
  const sortedPeerGroups = [...payload.peerGroups || []].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const topTheme = sortedPeerGroups[0] || { peerGroup: "\uB370\uC774\uD130 \uC5C6\uC74C", cappedAumWeightedReturnPct: 0, etfCount: 0 };
  const bottomTheme = sortedPeerGroups[sortedPeerGroups.length - 1] || topTheme;
  const themeGap = Math.abs((topTheme.cappedAumWeightedReturnPct ?? 0) - (bottomTheme.cappedAumWeightedReturnPct ?? 0)).toFixed(2);
  const cleanTopTheme = topTheme.peerGroup.replace(/\s*\([^)]*\)/g, "").trim();
  const cleanBottomTheme = bottomTheme.peerGroup.replace(/\s*\([^)]*\)/g, "").trim();
  const topThemeFontSize = calcThemeFontSize(cleanTopTheme);
  const bottomThemeFontSize = calcThemeFontSize(cleanBottomTheme);
  const topThemeRet = topTheme.cappedAumWeightedReturnPct ?? 0;
  const bottomThemeRet = bottomTheme.cappedAumWeightedReturnPct ?? 0;
  const topThemeSign = topThemeRet > 0 ? "\u25B2 +" : topThemeRet < 0 ? "\u25BC " : "";
  const bottomThemeSign = bottomThemeRet > 0 ? "\u25B2 +" : bottomThemeRet < 0 ? "\u25BC " : "";
  const topThemeColor = topThemeRet >= 0 ? "#D92D20" : "#175CD3";
  const bottomThemeColor = bottomThemeRet >= 0 ? "#D92D20" : "#175CD3";
  const allInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const topInflow1 = allInflows[0] || { name: "\uB370\uC774\uD130 \uC218\uC9D1 \uC911", ticker: "-", inflow: 0 };
  const cleanTopInflow1Name = (topInflow1.name || "\uB370\uC774\uD130 \uC218\uC9D1 \uC911").replace(/\s*\([^)]*\)/g, "").trim();
  return `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF \uBAA8\uB2DD \uBE0C\uB9AC\uD551 \uC778\uD3EC\uADF8\uB798\uD53D - ${formattedDate}">
      <title>ETF \uBAA8\uB2DD \uBE0C\uB9AC\uD551 \uC778\uD3EC\uADF8\uB798\uD53D - ${formattedDate}</title>
      <defs>
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#0F172A" flood-opacity="0.06"/>
        </filter>
        <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.04"/>
        </filter>
        <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10B981"/>
          <stop offset="100%" stop-color="#047857"/>
        </linearGradient>
        <style>
          * { font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', '\uB9D1\uC740 \uACE0\uB515', 'Noto Sans KR', 'Segoe UI', -apple-system, sans-serif; }
          .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
        </style>
      </defs>

      <!-- Background -->
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="980" cy="120" r="280" fill="#10B981" fill-opacity="0.05"/>
      <circle cx="100" cy="1200" r="240" fill="#3B82F6" fill-opacity="0.04"/>

      <!-- Clean Minimal Header (Scaled Up & Rebalanced) -->
      <g transform="translate(60, 48)">
        <text x="0" y="56" fill="#0F172A" font-size="52" font-weight="900" letter-spacing="-0.8">ETF \uBAA8\uB2DD \uBE0C\uB9AC\uD551</text>
        <text x="0" y="100" fill="#334155" font-size="24" font-weight="800">KRX \uC77C\uBC18 ETF ${generalCount.toLocaleString()}\uAC1C \uC804\uC218 \uBD84\uC11D \uC694\uC57D</text>
        
        <rect x="685" y="18" width="275" height="60" rx="18" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.8" filter="url(#cardShadow)"/>
        <text x="822.5" y="56" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- SECTION 1: \uC2DC\uC7A5 \uCCB4\uC628 & 3\uB300 \uC9C0\uC218 \uC2A4\uCF54\uC5B4\uBCF4\uB4DC (Y: 168, H: 268) [Spacious & Bold] -->
      <g transform="translate(60, 168)" filter="url(#cardShadow)">
        <rect width="960" height="268" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="52" fill="#0F172A" font-size="30" font-weight="900">1. \uC2DC\uC7A5 \uCCB4\uC628 &amp; 3\uB300 \uC9C0\uC218 \uBE44\uAD50</text>
        <rect x="525" y="16" width="400" height="52" rx="15" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.4"/>
        <text x="725" y="48" font-size="22" font-weight="900" text-anchor="middle">
          <tspan fill="#D92D20">\uC0C1\uC2B9 ${up}</tspan><tspan fill="#64748B"> \xB7 </tspan><tspan fill="#334155">\uBCF4\uD569 ${flat}</tspan><tspan fill="#64748B"> \xB7 </tspan><tspan fill="#175CD3">\uD558\uB77D ${down}</tspan>
        </text>

        <!-- 3 Big Metric Boxes (H: 150) -->
        <g transform="translate(35, 86)">
          <!-- KOSPI -->
          <rect x="0" y="0" width="280" height="150" rx="20" fill="${kospi >= 0 ? "#FEF2F2" : "#EFF6FF"}" stroke="${kospi >= 0 ? "#FECACA" : "#BFDBFE"}" stroke-width="1.5"/>
          <text x="24" y="52" fill="${kospi >= 0 ? "#991B1B" : "#1E40AF"}" font-size="32" font-weight="900">KOSPI</text>
          <text x="256" y="122" fill="${kospiColor}" font-size="58" font-weight="900" text-anchor="end" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>

          <!-- KOSDAQ -->
          <rect x="305" y="0" width="280" height="150" rx="20" fill="${kosdaq >= 0 ? "#FEF2F2" : "#EFF6FF"}" stroke="${kosdaq >= 0 ? "#FECACA" : "#BFDBFE"}" stroke-width="1.5"/>
          <text x="329" y="52" fill="${kosdaq >= 0 ? "#991B1B" : "#1E40AF"}" font-size="32" font-weight="900">KOSDAQ</text>
          <text x="561" y="122" fill="${kosdaqColor}" font-size="58" font-weight="900" text-anchor="end" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>

          <!-- \uC77C\uBC18 ETF -->
          <rect x="610" y="0" width="280" height="150" rx="20" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.6"/>
          <text x="634" y="52" fill="#15803D" font-size="32" font-weight="900">\uC77C\uBC18 ETF</text>
          <text x="866" y="122" fill="${etfColor}" font-size="58" font-weight="900" text-anchor="end" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
        </g>
      </g>

      <!-- SECTION 2: \uC624\uB298\uC758 \uADF9\uACFC \uADF9 \uD14C\uB9C8 (Y: 466, H: 460) [Mega Bold & Ultra Spacious] -->
      <g transform="translate(60, 466)" filter="url(#cardShadow)">
        <rect width="960" height="460" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="52" fill="#0F172A" font-size="34" font-weight="900">2. \uC624\uB298\uC758 \uADF9\uACFC \uADF9 \uD14C\uB9C8 (\uC8FC\uB3C4 vs \uBD80\uC9C4)</text>
        <rect x="680" y="16" width="245" height="50" rx="14" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.4"/>
        <text x="802" y="48" fill="#C2410C" font-size="23" font-weight="900" text-anchor="middle">\uD14C\uB9C8 \uC628\uB3C4\uCC28 ${themeGap}%p</text>

        <!-- Top 1 Winner (\u25B2 \uC0C1\uC704 1\uC704 \uC8FC\uB3C4 \uD14C\uB9C8, H: 160) -->
        <g transform="translate(35, 84)">
          <rect width="890" height="160" rx="22" fill="#FFF5F5" stroke="#FCA5A5" stroke-width="1.6"/>
          
          <!-- Row 1: Badge & ETF Count -->
          <rect x="24" y="22" width="145" height="42" rx="12" fill="#FEE2E2"/>
          <text x="96" y="49" fill="#DC2626" font-size="22" font-weight="900" text-anchor="middle">\u25B2 \uC0C1\uC704 1\uC704</text>
          <text x="190" y="50" fill="#475569" font-size="23" font-weight="800">\uCD1D ${topTheme.etfCount || 5}\uAC1C ETF \uAD6C\uC131</text>
          
          <!-- Row 2: Large Theme Name & Huge Return -->
          <text x="24" y="126" fill="#0F172A" font-size="${topThemeFontSize > 36 ? topThemeFontSize : 42}" font-weight="900">${escapeXml3(cleanTopTheme)}</text>
          <text x="866" y="116" fill="${topThemeColor}" font-size="68" font-weight="900" text-anchor="end" class="tabular">${topThemeSign}${topThemeRet.toFixed(2)}%</text>
        </g>

        <!-- Bottom 1 Loser (\u25BC \uD558\uC704 1\uC704 \uBD80\uC9C4 \uD14C\uB9C8, H: 160) -->
        <g transform="translate(35, 268)">
          <rect width="890" height="160" rx="22" fill="#EFF6FF" stroke="#93C5FD" stroke-width="1.6"/>
          
          <!-- Row 1: Badge & ETF Count -->
          <rect x="24" y="22" width="145" height="42" rx="12" fill="#DBEAFE"/>
          <text x="96" y="49" fill="#1D4ED8" font-size="22" font-weight="900" text-anchor="middle">\u25BC \uD558\uC704 1\uC704</text>
          <text x="190" y="50" fill="#475569" font-size="23" font-weight="800">\uCD1D ${bottomTheme.etfCount || 8}\uAC1C ETF \uAD6C\uC131</text>
          
          <!-- Row 2: Large Theme Name & Huge Return -->
          <text x="24" y="126" fill="#0F172A" font-size="${bottomThemeFontSize > 36 ? bottomThemeFontSize : 42}" font-weight="900">${escapeXml3(cleanBottomTheme)}</text>
          <text x="866" y="116" fill="${bottomThemeColor}" font-size="68" font-weight="900" text-anchor="end" class="tabular">${bottomThemeSign}${bottomThemeRet.toFixed(2)}%</text>
        </g>
      </g>

      <!-- SECTION 3: \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC21C\uC720\uC785 1\uC704 (Y: 954, H: 240) [Enhanced Legibility] -->
      <g transform="translate(60, 954)" filter="url(#cardShadow)">
        <rect width="960" height="240" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="46" fill="#0F172A" font-size="30" font-weight="900">3. \uC2A4\uB9C8\uD2B8\uBA38\uB2C8(\uC678\uC778/\uAE30\uAD00) \uC2E4\uC9C8 \uC21C\uC720\uC785 1\uC704</text>
        <rect x="760" y="15" width="165" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.4"/>
        <text x="842" y="43" fill="#1E293B" font-size="21" font-weight="900" text-anchor="middle">\uAE30\uAD00\xB7\uC678\uAD6D\uC778 \uD569\uC0B0</text>

        <!-- Enhanced Hero Card (H: 142) -->
        <g transform="translate(35, 72)">
          <rect width="890" height="142" rx="20" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1.8"/>
          <circle cx="42" cy="42" r="22" fill="#10B981"/>
          <text x="42" y="50" fill="#FFFFFF" font-size="22" font-weight="900" text-anchor="middle">1</text>
          
          <text x="82" y="52" fill="#0F172A" font-size="34" font-weight="900">${escapeXml3(cleanTopInflow1Name)}</text>
          
          <rect x="42" y="86" width="105" height="36" rx="10" fill="#DCFCE7" stroke="#BBF7D0" stroke-width="1.2"/>
          <text x="94" y="111" fill="#15803D" font-size="21" font-weight="900" text-anchor="middle" class="tabular">${escapeXml3(topInflow1.ticker)}</text>
          
          <rect x="158" y="86" width="150" height="36" rx="10" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.2"/>
          <text x="233" y="111" fill="#475569" font-size="21" font-weight="900" text-anchor="middle">\uD575\uC2ECETF</text>

          <text x="866" y="78" fill="#047857" font-size="58" font-weight="900" text-anchor="end" class="tabular">+${(topInflow1.inflow || 0).toLocaleString()}<tspan font-size="30" font-weight="900">\uC5B5\uC6D0</tspan></text>
          <text x="866" y="112" fill="#15803D" font-size="22" font-weight="900" text-anchor="end">\uB2F9\uC77C \uAE30\uAD00\xB7\uC678\uC778 \uCD5C\uB300 \uC21C\uC720\uC785</text>
        </g>
      </g>

      <!-- Disclaimer & Watermark (Y: 1248 ~ 1298) [Pure Green Text] -->
      <g transform="translate(540, 1248)">
        <text x="0" y="0" fill="#475569" font-size="21" font-weight="800" text-anchor="middle">* \uBCF8 \uC790\uB8CC\uB294 \uD22C\uC790 \uD310\uB2E8\uC744 \uB3D5\uAE30 \uC704\uD55C \uC815\uBCF4 \uC81C\uACF5\uC6A9\uC774\uBA70, \uD2B9\uC815 \uC885\uBAA9\uC758 \uB9E4\uC218\xB7\uB9E4\uB3C4\uB97C \uAD8C\uC720\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</text>
        <text x="0" y="38" fill="#047857" font-size="28" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF \uCEA0\uD37C\uC2A4 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `.trim();
}
__name(generateThreadsImageSvg, "generateThreadsImageSvg");

// src/services/gemini.ts
var MASTER_GEMINI_TOKENS = [
  "AIzaSyCvPN7npTB8WzB3fMAuP-JAdp_ooAenk5s",
  // Primary (#1)
  "AIzaSyAJNLIrtFz90VGnEQHSIpUVBcNYYVWPar0",
  // Backup 1 (#2)
  "AQ.Ab8RN6IhUi86rXWfKKSlb4Okj2tUS0kVVVs8ygq94s1vElw1Ng",
  // Backup 2 (#3)
  "AQ.Ab8RN6I6BZOQW23HVRzfoDdGYxCISpci5OItTEXeQSoLKGxOaQ",
  // Backup 3 (#4)
  "AQ.Ab8RN6I2hocZxArtRwjcKuu_FxnYIngCUH1noqApCfYtw68WsA",
  // Backup 4 (#5)
  "AQ.Ab8RN6JVoQos0hp7JpLRXNDroImdaeuyoMW31Su-hkHaQN2CJg",
  // Backup 5 (#6)
  "AQ.Ab8RN6KWvZcOxMN9Ks0WU4xbQjKZDatV28qtFDCbeGeIEY1WPw"
  // Backup 6 (#7)
];
var MODEL_WATERFALL = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash"
];
var TOKEN_COOLDOWNS = {};
function getAllGeminiTokens(env) {
  const tokens = [];
  const envKey = (env?.GEMINI_API_KEY || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "") || "").trim();
  if (envKey && !tokens.includes(envKey)) {
    tokens.push(envKey);
  }
  for (const masterKey of MASTER_GEMINI_TOKENS) {
    if (!tokens.includes(masterKey)) {
      tokens.push(masterKey);
    }
  }
  return tokens;
}
__name(getAllGeminiTokens, "getAllGeminiTokens");
async function reviewAndRefineWithGemini(payload, regime, env) {
  const tokens = getAllGeminiTokens(env);
  if (!tokens || tokens.length === 0) {
    return { ...regime, source: "rule-engine-fallback" };
  }
  const kospi = payload.kospiChangePct ?? 0;
  const kosdaq = payload.kosdaqChangePct ?? 0;
  const etfRet = payload.generalAumWeightedReturnPct ?? 0;
  const capSpread = regime.capSpread ?? Number((kospi - kosdaq).toFixed(2));
  const etfDivergence = regime.etfDivergence ?? Number((kospi - etfRet).toFixed(2));
  const up = payload.upCount ?? 0;
  const down = payload.downCount ?? 0;
  const flat = payload.flatCount ?? 0;
  const topInflowsList = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 5) || [];
  const topInflowsStr = topInflowsList.length > 0 ? topInflowsList.map((i) => `${i.name || i.etfName} +${i.inflow || Math.round((i.netInflowValue || 0) / 1e8)}\uC5B5\uC6D0`).join(", ") : "\uC9D1\uACC4 \uC911";
  const sortedPeerGroups = [...payload.peerGroups || []].sort(
    (a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0)
  );
  const cleanTheme = /* @__PURE__ */ __name((str) => (str || "").replace(/\s*\([^)]*\)/g, "").trim(), "cleanTheme");
  const topTheme = sortedPeerGroups[0];
  const bottomTheme = sortedPeerGroups.length > 1 ? sortedPeerGroups[sortedPeerGroups.length - 1] : void 0;
  const topThemeText = topTheme ? `${cleanTheme(topTheme.peerGroup)} ${topTheme.cappedAumWeightedReturnPct !== void 0 ? (topTheme.cappedAumWeightedReturnPct >= 0 ? "+" : "") + topTheme.cappedAumWeightedReturnPct.toFixed(2) + "%" : ""}`.trim() : "\uC5C6\uC74C";
  const bottomThemeText = bottomTheme ? `${cleanTheme(bottomTheme.peerGroup)} ${bottomTheme.cappedAumWeightedReturnPct !== void 0 ? (bottomTheme.cappedAumWeightedReturnPct >= 0 ? "+" : "") + bottomTheme.cappedAumWeightedReturnPct.toFixed(2) + "%" : ""}`.trim() : "\uC5C6\uC74C";
  const systemPrompt = `\uB2F9\uC2E0\uC740 \uB300\uD55C\uBBFC\uAD6D \uCD5C\uACE0 \uC218\uC900\uC758 \uACF5\uC778 \uC218\uC11D \uD380\uB4DC\uC560\uB110\uB9AC\uC2A4\uD2B8\uC774\uC790 \uAE08\uC735 \uC5D0\uB514\uD130 'Neo'\uC785\uB2C8\uB2E4.
\uC81C\uACF5\uB41C 1\uCC28 \uB9C8\uCF13 \uBE0C\uB9AC\uD551 \uCD08\uC548\uC744 \uAC80\uD1A0\uD558\uC5EC, \uC0C1\uC5C5\uC801 \uD64D\uBCF4\uC0C9\uC744 \uC644\uC804\uD788 \uBC30\uC81C\uD558\uACE0 \uB3C5\uC790\uAC00 \uBBFF\uACE0 \uC77D\uB294 '\uACE0\uBC00\uB3C4 \uC21C\uC218 \uACF5\uACF5\uC7AC \uC2DC\uD669 \uC815\uBCF4 \uCE7C\uB7FC'\uC73C\uB85C \uD488\uACA9 \uC788\uAC8C \uAD50\uC815(Polish)\uD558\uC2ED\uC2DC\uC624.

## 3\uCD95 \uC2DC\uC7A5 \uBD84\uC11D \uAC00\uC774\uB4DC (3-Axis Fund Analyst Perspective)
1. \uCF54\uC2A4\uD53C vs \uCF54\uC2A4\uB2E5 \uC2A4\uD504\uB808\uB4DC: \uB300\uD615\uC8FC \uC3E0\uB9BC\uC778\uC9C0, \uCF54\uC2A4\uB2E5 \uC911\uC2EC \uC911\uC18C\uD615/\uC131\uC7A5 \uD14C\uB9C8 \uC7A5\uC138\uC778\uC9C0 \uBA85\uD655\uD788 \uC9DA\uC5B4\uC8FC\uC2ED\uC2DC\uC624.
2. \uCF54\uC2A4\uD53C vs \uC77C\uBC18 ETF \uAC00\uC911\uC218\uC775\uB960 \uAD34\uB9AC: \uCF54\uC2A4\uD53C \uC9C0\uC218\uAC00 \uAE09\uB4F1\uD588\uB354\uB77C\uB3C4 \uBD84\uC0B0 ETF \uAC00\uC911\uC218\uC775\uB960\uACFC\uC758 \uAD34\uB9AC\uAC00 \uD06C\uB2E4\uBA74 '\uC9C0\uC218 \uCC29\uC2DC\uD615 \uCC28\uBCC4\uD654 \uC7A5\uC138'\uC784\uC744 \uC9DA\uC5B4\uC8FC\uACE0, \uC9C0\uC218 \uD558\uB77D \uC2DC ETF\uAC00 \uBC84\uD17C\uB2E4\uBA74 '\uC790\uC0B0\uBC30\uBD84\uC758 \uC644\uCDA9 \uC120\uBC29'\uC784\uC744 \uBD80\uAC01\uD558\uC2ED\uC2DC\uC624.
3. \uC2E4\uC9C8 \uC218\uAE09 \uB9E5\uB77D (Why it moved): \uC9C0\uC218 \uB4F1\uB77D \uC218\uCE58 \uB098\uC5F4\uC5D0 \uADF8\uCE58\uC9C0 \uC54A\uACE0, \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC21C\uC720\uC785 \uC885\uBAA9\uAD70\uACFC \uC8FC\uB3C4 \uD14C\uB9C8\uC758 \uACB0\uD569\uC73C\uB85C \uC2DC\uC7A5\uC758 \uC2E4\uC9C8 \uCCB4\uAC10 \uC628\uB3C4\uB97C \uC124\uBA85\uD558\uC2ED\uC2DC\uC624.

## \uC5C4\uACA9 \uC900\uC218 \uC6D0\uCE59 (Strict Rules)
1. \uD329\uD2B8 \uB370\uC774\uD130 \uBC0F \uC218\uAE09 \uC0AC\uC2E4 \uC808\uB300 \uBCC0\uC870/\uB0A0\uC870 \uAE08\uC9C0:
   - KOSPI ${kospi}%, KOSDAQ ${kosdaq}%, \uC77C\uBC18 ETF ${etfRet}%, \uC0C1\uC2B9 ${up}\uAC1C, \uD558\uB77D ${down}\uAC1C \uB4F1 \uBAA8\uB4E0 \uC22B\uC790\uB97C \uC784\uC758\uB85C \uBC14\uAFB8\uC9C0 \uB9C8\uC2ED\uC2DC\uC624.
   - [\uC218\uAE09 \uD329\uD2B8 \uC5C4\uC218]: \uC2E4\uC81C \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC21C\uC720\uC785 \uC0C1\uC704 \uC885\uBAA9(${topInflowsStr})\uC5D0 \uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC885\uBAA9\uC774\uB098 \uC9C0\uC218(\uC608: \uB2F9\uC77C \uBAA9\uB85D\uC5D0 \uC5C6\uB294 '\uBBF8\uAD6D \uB300\uD45C\uC9C0\uC218' \uB4F1)\uB97C \uC808\uB300 \uC5B8\uAE09\uD558\uAC70\uB098 \uC9C0\uC5B4\uB0B4\uC9C0 \uB9C8\uC2ED\uC2DC\uC624. \uC624\uC9C1 \uC2E4\uC81C \uC720\uC785 \uC885\uBAA9\uACFC \uADF8 \uC131\uACA9(\uCC44\uAD8C, \uAE08\uB9AC, \uBC30\uB2F9 \uB4F1)\uB9CC \uC11C\uC220\uD558\uC2ED\uC2DC\uC624.
2. \uAD04\uD638() \uB0A8\uBC1C \uC808\uB300 \uAE08\uC9C0:
   - \uBCF8\uBB38 \uC694\uC57D, \uD0C0\uB798, \uC2AC\uB77C\uC774\uB4DC \uD14D\uC2A4\uD2B8 \uC5B4\uB514\uC5D0\uB3C4 \uC218\uC775\uB960\uC774\uB098 \uBD80\uC5F0 \uC124\uBA85\uC744 \uAC10\uC2F8\uB294 \uAD04\uD638\uB97C \uC77C\uCCB4 \uC0AC\uC6A9\uD558\uC9C0 \uB9C8\uC2ED\uC2DC\uC624. (\uC608: '\uC5D0\uB108\uC9C0 +2.95%' \u2B55, '\uC5D0\uB108\uC9C0 (+2.95%)' \u274C, '\uD558\uB77D \uC885\uBAA9 181\uAC1C' \u2B55, '\uD558\uB77D \uC885\uBAA9(181\uAC1C)' \u274C).
3. \uD14C\uB9C8\uBA85 \uBD80\uC5F0 \uAD04\uD638 \uC815\uC81C:
   - \uD14C\uB9C8\uBA85\uC5D0 \uD3EC\uD568\uB41C \uAD04\uD638 \uBD80\uC5F0 \uC124\uBA85(\uC608: '(\uC6D0\uC720\xB7\uCC9C\uC5F0\uAC00\uC2A4)')\uC740 \uBAA8\uB450 \uC81C\uAC70\uD558\uACE0 \uD575\uC2EC \uBA85\uCE6D\uB9CC \uC0AC\uC6A9\uD558\uC2ED\uC2DC\uC624.
4. \uC0C1\uC704/\uD558\uC704 \uB7AD\uD0B9 \uD45C\uAE30 \uD1B5\uC77C:
   - \uBAA8\uB4E0 \uC7A5\uC138(\uC804\uCCB4 \uD558\uB77D\uC77C\xB7\uC804\uCCB4 \uC0C1\uC2B9\uC77C \uB4F1)\uC758 \uC815\uD569\uC131\uC744 \uC704\uD574 \uD14C\uB9C8 \uB7AD\uD0B9\uC740 '\uC0C1\uC2B9/\uD558\uB77D' \uB300\uC2E0 \uBC18\uB4DC\uC2DC '\uC0C1\uC704/\uD558\uC704'('\u25B2 \uC0C1\uC704 1\uC704', '\u25BC \uD558\uC704 1\uC704', '\u25B2 \uC0C1\uC704 Top 3', '\u25BC \uD558\uC704 Worst 3')\uB85C\uB9CC \uD45C\uAE30\uD558\uC2ED\uC2DC\uC624.
5. Absolute Zero Emoji \uC808\uB300 \uC900\uC218:
   - \uBCF8\uBB38, \uD0C0\uB798, \uC2AC\uB77C\uC774\uB4DC \uD14D\uC2A4\uD2B8 \uC5B4\uB514\uC5D0\uB3C4 \uC774\uBAA8\uC9C0\uB97C \uB2E8 \uD558\uB098\uB3C4 \uD3EC\uD568\uD558\uC9C0 \uB9C8\uC2ED\uC2DC\uC624 (\uC774\uBAA8\uC9C0 0\uAC1C).
6. \uC0C1\uC5C5\uC801 \uD64D\uBCF4\uC0C9 \uC804\uBA74 \uC81C\uAC70 (\uC21C\uC218 \uACF5\uACF5\uC7AC \uC2DC\uD669 \uCE7C\uB7FC \uC6D0\uCE59):
   - '\uBB34\uB8CC', '\uC644\uBCBD \uBE44\uAD50', '\uD504\uB85C\uD544 \uB9C1\uD06C', '\uB9AC\uD3EC\uD2B8 \uBCF4\uB7EC\uAC00\uAE30', '\uB2E4\uC6B4\uB85C\uB4DC', '\uD074\uB9AD' \uB4F1 \uBAA8\uB4E0 \uC138\uC77C\uC988/\uD64D\uBCF4 \uC720\uB3C4 \uC5B4\uD718 \uC804\uBA74 \uAE08\uC9C0.
   - \uC678\uBD80 \uB9C1\uD06C \uC5C6\uC774\uB3C4 \uBCF8\uBB38 \uC790\uCCB4\uB9CC\uC73C\uB85C \uD574\uB2F9 \uAC70\uB798\uC77C \uC2DC\uC7A5\uC758 \uD575\uC2EC \uB9E5\uB77D(Why it moved)\uC744 100% \uC774\uD574\uD560 \uC218 \uC788\uB294 \uC644\uACB0\uD615 \uC815\uBCF4 \uC81C\uACF5.
7. \uBCF8\uBB38 \uC5D4\uB529: \uAD11\uACE0\uC131 \uB9C1\uD06C \uC720\uB3C4 \uB300\uC2E0 \uC624\uB298 \uAC1C\uC7A5 \uD6C4 \uC8FC\uBAA9\uD560 \uAC70\uC2DC \uC9C0\uD45C\uB098 \uC2EC\uB9AC\uC801 \uCCB4\uD06C\uD3EC\uC778\uD2B8 1\uBB38\uC7A5 + \uB300\uD654\uD615 \uC9C8\uBB38\uC73C\uB85C \uB2F4\uBC31\uD558\uAC8C \uC885\uACB0.
8. \uCCAB \uB313\uAE00: \uD504\uB85C\uD544 \uBC29\uBB38 \uC720\uB3C4 \uBA58\uD2B8 \uC804\uBA74 \uAE08\uC9C0. \uC624\uC9C1 '\uD55C\uAD6D\uAC70\uB798\uC18C(KRX) \uACF5\uC2DC \uB370\uC774\uD130 \uB9C8\uAC10 \uAE30\uC900 (\uAD6D\uB0B4 \uC0C1\uC7A5 \uC77C\uBC18 ETF \uC804\uC218 \uBD84\uC11D)'\uC73C\uB85C\uB9CC \uC791\uC131.
9. \uCEF4\uD50C\uB77C\uC774\uC5B8\uC2A4 \uC808\uB300 \uC900\uC218: '\uCD94\uCC9C', '\uBCA0\uC2A4\uD2B8', '\uB300\uBC15', '\uBAA9\uD45C\uAC00', '\uD328\uB2C9', '\uD3ED\uB77D' \uB4F1 \uD22C\uAE30 \uC870\uC7A5\uC774\uB098 \uACFC\uC7A5 \uC5B4\uD718 \uC808\uB300 \uAE08\uC9C0.
10. \uD398\uB974\uC18C\uB098 \uC900\uC218: '\uD604\uC9C1' \uB2E8\uC5B4 \uC804\uBA74 \uAE08\uC9C0.
11. \uC2A4\uB808\uB4DC/\uB313\uAE00 \uB0B4 \uC678\uBD80 URL \uB9C1\uD06C('https://') \uAE30\uC7AC \uC804\uBA74 \uAE08\uC9C0.
12. '\uC5B4\uC81C' \uB4F1 \uC0C1\uB300\uC801 \uC2DC\uAC04 \uD45C\uD604 \uC808\uB300 \uAE08\uC9C0 (\uC2DC\uC810 \uC65C\uACE1 \uBC29\uC9C0):
   - \uAE08\uC694\uC77C \uC885\uAC00 \uB370\uC774\uD130\uAC00 \uD1A0\uC694\uC77C\uC774\uB098 \uC6D4\uC694\uC77C\uC5D0 \uBC1C\uD589\uB418\uB294 \uB4F1 \uC8FC\uB9D0/\uC5F0\uD734 \uC2DC\uCC28\uB85C \uC778\uD55C \uB3C5\uC790\uC758 \uC2DC\uAC04 \uC778\uC2DD \uD63C\uC120\uC744 \uC6D0\uCC9C \uCC28\uB2E8\uD558\uAE30 \uC704\uD574, \uBCF8\uBB38, \uD0C0\uB798, \uCEA1\uC158 \uC5B4\uB514\uC5D0\uB3C4 '\uC5B4\uC81C'\uB77C\uB294 \uD45C\uD604\uC744 \uC808\uB300 \uC4F0\uC9C0 \uB9C8\uC2ED\uC2DC\uC624.
   - '\uC7A5 \uB9C8\uAC10 \uAE30\uC900' \uB610\uB294 '\uAD6D\uB0B4 \uC99D\uC2DC\uB294', '\uCF54\uC2A4\uD53C\uB294'\uACFC \uAC19\uC774 \uAC1D\uAD00\uC801 \uC2DC\uC810 \uD45C\uD604\uB9CC \uC0AC\uC6A9\uD558\uC2ED\uC2DC\uC624.
13. \uAE00\uC790 \uC218 \uC608\uC0B0(Character Budget) \uC808\uB300 \uC5C4\uC218 (\uCE74\uB4DC\uB274\uC2A4 \uD14D\uC2A4\uD2B8 \uB118\uCE68 \uBC29\uC9C0):
   - slide1Subheadline: \uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 26\uC790 \uC774\uB0B4
   - slide4BannerTitle: \uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 22\uC790 \uC774\uB0B4
   - slide4BannerDesc: \uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 30\uC790 \uC774\uB0B4
   - slide5BannerTitle: \uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 24\uC790 \uC774\uB0B4
   - slide5BannerDesc: \uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 32\uC790 \uC774\uB0B4
   - slide6Block1Title: \uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 20\uC790 \uC774\uB0B4
   - slide6Block1Desc: \uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 30\uC790 \uC774\uB0B4
14. \uCD9C\uB825 \uD615\uC2DD: \uBC31\uD2F1(\`\`\`) \uC5C6\uB294 \uC21C\uC218 JSON \uB2E8 \uD558\uB098\uB9CC \uCD9C\uB825\uD558\uC2ED\uC2DC\uC624.

## JSON \uCD9C\uB825 \uC2A4\uD0A4\uB9C8
{
  "slide1Subheadline": "\uCE74\uB4DC\uB274\uC2A4 1\uD398\uC774\uC9C0 \uBD80\uC81C (\uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 26\uC790, \uD14C\uB9C8\uBA85\uACFC \uC2E4\uC81C \uC720\uC785 \uC885\uBAA9 \uD329\uD2B8 \uC694\uC57D, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "slide1Tip": "\uCE74\uB4DC\uB274\uC2A4 1\uD398\uC774\uC9C0 \uD301 \uBB38\uAD6C (\uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 28\uC790, \uC9C0\uC218 \uB300\uBE44 ETF \uC644\uCDA9 \uC694\uC778 \uD55C \uC904, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "slide4BannerTitle": "\uCE74\uB4DC\uB274\uC2A4 4\uD398\uC774\uC9C0 \uC218\uAE09 \uBC30\uB108 \uC81C\uBAA9 (\uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 22\uC790, \uC2E4\uC81C \uC720\uC785 \uC885\uBAA9 \uD2B9\uC131 \uC694\uC57D, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "slide4BannerDesc": "\uCE74\uB4DC\uB274\uC2A4 4\uD398\uC774\uC9C0 \uC218\uAE09 \uC124\uBA85 (\uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 30\uC790, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "slide5BannerTitle": "\uCE74\uB4DC\uB274\uC2A4 5\uD398\uC774\uC9C0 \uAD34\uB9AC\uC728 \uBC30\uB108 \uC81C\uBAA9 (\uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 24\uC790, \uC65C\uACE1 \uC9C4\uB2E8 \uD55C \uC904, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "slide5BannerDesc": "\uCE74\uB4DC\uB274\uC2A4 5\uD398\uC774\uC9C0 \uAD34\uB9AC\uC728 \uC124\uBA85 (\uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 32\uC790, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "slide5ActionTip": "\uCE74\uB4DC\uB274\uC2A4 5\uD398\uC774\uC9C0 \uC2E4\uC804 \uD22C\uC790\uC790 \uD301 (\uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 35\uC790, \uD638\uAC00 \uC810\uAC80 \uC870\uC5B8, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "slide6Block1Title": "\uCE74\uB4DC\uB274\uC2A4 6\uD398\uC774\uC9C0 1\uBC88 \uC694\uC57D \uC81C\uBAA9 (\uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 20\uC790, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "slide6Block1Desc": "\uCE74\uB4DC\uB274\uC2A4 6\uD398\uC774\uC9C0 1\uBC88 \uC694\uC57D \uBCF8\uBB38 (\uACF5\uBC31 \uD3EC\uD568 \uCD5C\uB300 30\uC790, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "captionOpening": "\uC778\uC2A4\uD0C0\uADF8\uB7A8 \uCEA1\uC158 \uCCAB \uB2E8\uB77D (\uC7A5\uC138 \uADDC\uC815, '\uC5B4\uC81C' \uD45C\uD604 \uC808\uB300 \uAE08\uC9C0, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "captionMarketSummary": "\uC778\uC2A4\uD0C0\uADF8\uB7A8 \uCEA1\uC158 \uC2DC\uC7A5 \uC694\uC57D \uBB38\uB2E8 (\uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "captionThemeAnalysis": "\uC778\uC2A4\uD0C0\uADF8\uB7A8 \uBCF8\uBB38\uC6A9 \uD14C\uB9C8\uBCC4 \uB4F1\uB77D \uC6D0\uC778 \uD329\uD2B8 \uBD84\uC11D 1\uBB38\uB2E8 (\uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "captionWatchPoint": "\uC778\uC2A4\uD0C0\uADF8\uB7A8 \uC5D4\uB529\uC6A9 \uC624\uB298\uC758 \uC2DC\uC7A5 \uAD00\uC804 \uD3EC\uC778\uD2B8 (\uC138\uC77C\uC988 \uBA58\uD2B8 \uC5C6\uC774 \uC9C0\uC801\uC774\uACE0 \uB2F4\uBC31\uD558\uAC8C, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "threadsOpening": "\uC2A4\uB808\uB4DC 1\uBC88 \uD3EC\uC2A4\uD2B8 \uC624\uD504\uB2DD \uBB38\uC7A5 (\uD574\uC694\uCCB4, '\uC5B4\uC81C' \uD45C\uD604 \uC808\uB300 \uAE08\uC9C0, \uACF5\uAC10\uD615 \uD654\uBC95, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "threadsMarketSummary": "\uC2A4\uB808\uB4DC \uC2DC\uC7A5 \uC694\uC57D \uBB38\uC7A5 (\uD574\uC694\uCCB4, \uC644\uCDA9 \uD6A8\uACFC \uC124\uBA85, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "threadsWatchPoint": "\uC2A4\uB808\uB4DC \uC5D4\uB529\uC6A9 \uC624\uB298\uC758 \uC2DC\uC7A5 \uAD00\uC804 \uD3EC\uC778\uD2B8 \uBC0F \uB300\uD654\uD615 \uC9C8\uBB38 (\uC678\uBD80 \uB9C1\uD06C \uC720\uB3C4 \uC808\uB300 \uAE08\uC9C0, \uC774\uBAA8\uC9C0 0\uAC1C, \uAD04\uD638 \uAE08\uC9C0)",
  "firstComment": "\uC2A4\uB808\uB4DC \uCCAB \uB313\uAE00 (\uD55C\uAD6D\uAC70\uB798\uC18C KRX \uACF5\uC2DC \uB9C8\uAC10 \uAE30\uC900, \uAD6D\uB0B4 \uC0C1\uC7A5 \uC77C\uBC18 ETF \uC804\uC218 \uBD84\uC11D \uACE0\uC9C0, \uC774\uBAA8\uC9C0 0\uAC1C)"
}`;
  const userPrompt = `[\uB2F9\uC77C 3\uB300 \uC2DC\uC7A5 \uC9C0\uD45C \uBC0F \uD380\uB4DC\uC560\uB110\uB9AC\uC2A4\uD2B8 \uBD84\uC11D \uD329\uD2B8]
- \uAE30\uC900\uC77C: ${payload.asOfDate}
- \uCF54\uC2A4\uD53C (KOSPI): ${kospi > 0 ? "+" : ""}${kospi.toFixed(2)}%
- \uCF54\uC2A4\uB2E5 (KOSDAQ): ${kosdaq > 0 ? "+" : ""}${kosdaq.toFixed(2)}%
- \uC77C\uBC18 ETF \uAC00\uC911\uC218\uC775\uB960: ${etfRet > 0 ? "+" : ""}${etfRet.toFixed(2)}%
- \uB300\uD615\uC8FC vs \uC911\uC18C\uD615\uC8FC \uACA9\uCC28 (KOSPI - KOSDAQ \uC2A4\uD504\uB808\uB4DC): ${capSpread > 0 ? "+" : ""}${capSpread.toFixed(2)}%p (${capSpread >= 1.5 ? "\uB300\uD615\uC8FC \uC3E0\uB9BC \uC2EC\uD654" : capSpread <= -1.5 ? "\uC911\uC18C\uD615 \uC131\uC7A5\uC8FC \uC6B0\uC704" : "\uB3D9\uD589"})
- \uC9C0\uC218 vs \uBD84\uC0B0 ETF \uAD34\uB9AC (KOSPI - \uC77C\uBC18 ETF \uAD34\uB9AC): ${etfDivergence > 0 ? "+" : ""}${etfDivergence.toFixed(2)}%p (${etfDivergence >= 1.5 ? "\uC9C0\uC218 \uCC29\uC2DC\uD615 \uC3E0\uB9BC (\uBD84\uC0B0 ETF \uC18D\uB3C4 \uC870\uC808)" : etfDivergence <= -1 ? "\uC790\uC0B0\uBC30\uBD84 \uBC29\uC5B4 \uC120\uBC29" : "\uB3D9\uD589"})
- \uD310\uBCC4\uB41C \uAD6D\uBA74: ${regime.statusName} (${regime.badgeTag})
- \uC0C1\uC2B9/\uD558\uB77D/\uBCF4\uD569 \uC885\uBAA9\uC218: \uC0C1\uC2B9 ${up}\uAC1C, \uBCF4\uD569 ${flat}\uAC1C, \uD558\uB77D ${down}\uAC1C
- \uB2F9\uC77C \uC8FC\uB3C4/\uBD80\uC9C4 \uD14C\uB9C8: \uC0C1\uC704 1\uC704 '${topThemeText}', \uD558\uC704 1\uC704 '${bottomThemeText}'
- \uB2F9\uC77C \uC2A4\uB9C8\uD2B8\uBA38\uB2C8 \uC21C\uC720\uC785 TOP: ${topInflowsStr}
- \uB2F9\uC77C \uAD34\uB9AC\uC728 \uC0C1\uD0DC: ${regime.disparityStatus}

[1\uCC28 \uC2DC\uB098\uB9AC\uC624 \uD15C\uD50C\uB9BF \uCD08\uC548]
- slide1Subheadline: "${regime.slide1Subheadline}"
- slide1Tip: "${regime.slide1Tip}"
- slide4BannerTitle: "${regime.slide4BannerTitle}"
- slide4BannerDesc: "${regime.slide4BannerDesc}"
- slide5BannerTitle: "${regime.slide5BannerTitle}"
- slide5BannerDesc: "${regime.slide5BannerDesc}"
- slide5ActionTip: "${regime.slide5ActionTip}"
- slide6Block1Title: "${regime.slide6Block1Title}"
- slide6Block1Desc: "${regime.slide6Block1Desc}"
- captionOpening: "${regime.captionOpening}"
- captionMarketSummary: "${regime.captionMarketSummary}"
- captionThemeAnalysis: "${regime.captionThemeAnalysis}"
- captionWatchPoint: "${regime.captionWatchPoint}"
- threadsOpening: "${regime.threadsOpening}"
- threadsMarketSummary: "${regime.threadsMarketSummary}"
- threadsWatchPoint: "${regime.threadsWatchPoint}"
- firstComment: "${regime.firstComment}"

\uC704 1\uCC28 \uCD08\uC548\uC744 \uD329\uD2B8 \uB370\uC774\uD130\uC640 \uB300\uC870 \uAC80\uD1A0\uD558\uC5EC, \uC5B4\uAE0B\uB0A8\uC774 \uC804\uD600 \uC5C6\uACE0 \uC0C1\uC5C5\uC801 \uB0C4\uC0C8\uAC00 \uBC30\uC81C\uB41C \uCD5C\uACE0\uAE09 \uACF5\uACF5\uC7AC \uAE08\uC735 \uC2DC\uD669 \uCE7C\uB7FC\uC73C\uB85C \uAD50\uC815\uD55C JSON\uC744 \uCD9C\uB825\uD558\uC2ED\uC2DC\uC624.`;
  const requestBody = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3
    }
  };
  const now = Date.now();
  const sortedTokens = [...tokens].sort((a, b) => (TOKEN_COOLDOWNS[a] || 0) - (TOKEN_COOLDOWNS[b] || 0));
  const failoverHistory = [];
  for (const token of sortedTokens) {
    const realIdx = tokens.indexOf(token) + 1;
    let tokenExhausted = false;
    if (TOKEN_COOLDOWNS[token] && TOKEN_COOLDOWNS[token] > now) {
      failoverHistory.push(`Token #${realIdx} in cooldown`);
      continue;
    }
    for (const modelName of MODEL_WATERFALL) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${token}`;
      try {
        const startTime = Date.now();
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(2e4)
          // 20초 안전 타임아웃
        });
        if (response.ok) {
          const data = await response.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText && candidateText.trim()) {
            const parsed = JSON.parse(candidateText);
            const allText = JSON.stringify(parsed);
            const forbidden = [
              "\uCD94\uCC9C",
              "\uBCA0\uC2A4\uD2B8",
              "\uB300\uBC15",
              "\uBAA9\uD45C\uAC00",
              "\uD328\uB2C9",
              "\uD3ED\uB77D",
              "\uD604\uC9C1",
              "\uD504\uB85C\uD544 \uB9C1\uD06C",
              "\uBB34\uB8CC\uB85C \uD655\uC778",
              "\uC644\uBCBD \uBE44\uAD50",
              "\uB9AC\uD3EC\uD2B8 \uBCF4\uB7EC",
              "\uBCF4\uB7EC\uAC00\uAE30",
              "\uD074\uB9AD"
            ];
            let hasViolation = false;
            for (const word of forbidden) {
              if (allText.includes(word)) {
                console.warn(`[Gemini] Commercial or compliance violation detected ('${word}'). Reverting to 1st draft.`);
                hasViolation = true;
                break;
              }
            }
            if (!hasViolation) {
              const elapsed = Date.now() - startTime;
              console.log(`[AI Fact-Check] SUCCESS -> Token #${realIdx} with ${modelName} in ${elapsed}ms (Failover steps: ${failoverHistory.length})`);
              const stripEmoji = /* @__PURE__ */ __name((str) => (str || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim(), "stripEmoji");
              const cleanText = /* @__PURE__ */ __name((str) => stripEmoji(str).replace(/어제\s*/g, "").trim(), "cleanText");
              return {
                ...regime,
                slide1Subheadline: stripEmoji(parsed.slide1Subheadline) || regime.slide1Subheadline,
                slide1Tip: stripEmoji(parsed.slide1Tip) || regime.slide1Tip,
                slide4BannerTitle: stripEmoji(parsed.slide4BannerTitle) || regime.slide4BannerTitle,
                slide4BannerDesc: stripEmoji(parsed.slide4BannerDesc) || regime.slide4BannerDesc,
                slide5BannerTitle: stripEmoji(parsed.slide5BannerTitle) || regime.slide5BannerTitle,
                slide5BannerDesc: stripEmoji(parsed.slide5BannerDesc) || regime.slide5BannerDesc,
                slide5ActionTip: stripEmoji(parsed.slide5ActionTip) || regime.slide5ActionTip,
                slide6Block1Title: stripEmoji(parsed.slide6Block1Title) || regime.slide6Block1Title,
                slide6Block1Desc: stripEmoji(parsed.slide6Block1Desc) || regime.slide6Block1Desc,
                captionOpening: cleanText(parsed.captionOpening) || regime.captionOpening,
                captionMarketSummary: cleanText(parsed.captionMarketSummary) || regime.captionMarketSummary,
                captionThemeAnalysis: cleanText(parsed.captionThemeAnalysis) || regime.captionThemeAnalysis,
                captionWatchPoint: cleanText(parsed.captionWatchPoint) || regime.captionWatchPoint,
                threadsOpening: cleanText(parsed.threadsOpening) || regime.threadsOpening,
                threadsMarketSummary: cleanText(parsed.threadsMarketSummary) || regime.threadsMarketSummary,
                threadsWatchPoint: cleanText(parsed.threadsWatchPoint) || regime.threadsWatchPoint,
                firstComment: stripEmoji(parsed.firstComment) || regime.firstComment,
                source: "gemini-refined",
                modelUsed: modelName,
                tokenIndex: realIdx,
                failoverSteps: failoverHistory
              };
            }
          }
        }
        if (response.status === 429 || response.status === 403 || response.status === 402) {
          TOKEN_COOLDOWNS[token] = Date.now() + 6e4;
          tokenExhausted = true;
          failoverHistory.push(`Token #${realIdx} Quota Exhausted (${response.status})`);
          console.warn(`[AI Failover] Token #${realIdx} quota exhausted (${response.status})! Switching immediately to next token from highest model (3.8)...`);
          break;
        } else if (response.status === 503 || response.status === 500 || response.status === 502 || response.status === 504 || response.status === 404) {
          failoverHistory.push(`Token #${realIdx} ${modelName} (${response.status})`);
          console.warn(`[AI Failover] Model ${modelName} unavailable on Token #${realIdx} (${response.status}). Stepping down...`);
          continue;
        } else {
          failoverHistory.push(`Token #${realIdx} ${modelName} (HTTP ${response.status})`);
          continue;
        }
      } catch (err) {
        failoverHistory.push(`Token #${realIdx} ${modelName} (${err?.message || err})`);
        continue;
      }
    }
    if (tokenExhausted) {
      continue;
    }
  }
  console.warn(`[Gemini] All ${tokens.length} tokens and models exhausted. Using 1st draft rule-engine fallback. History:`, failoverHistory.slice(-4));
  return {
    ...regime,
    source: "rule-engine-fallback",
    failoverSteps: failoverHistory
  };
}
__name(reviewAndRefineWithGemini, "reviewAndRefineWithGemini");

// src/index.ts
function escapeXml4(unsafe) {
  if (!unsafe) return "";
  return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
__name(escapeXml4, "escapeXml");
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
  if (env.ETF_PRICES && typeof env.ETF_PRICES.prepare === "function") {
    try {
      const query = asOfDate ? "SELECT as_of_date, headline_text, kospi_close, kospi_change_pct, kosdaq_close, kosdaq_change_pct, general_etf_count, general_total_aum, general_total_trade_value, general_aum_weighted_return_pct, up_count, flat_count, down_count, breadth_ratio_pct, metrics_json FROM market_briefings WHERE as_of_date = ? LIMIT 1" : "SELECT as_of_date, headline_text, kospi_close, kospi_change_pct, kosdaq_close, kosdaq_change_pct, general_etf_count, general_total_aum, general_total_trade_value, general_aum_weighted_return_pct, up_count, flat_count, down_count, breadth_ratio_pct, metrics_json FROM market_briefings ORDER BY as_of_date DESC LIMIT 1";
      const row = await (asOfDate ? env.ETF_PRICES.prepare(query).bind(asOfDate) : env.ETF_PRICES.prepare(query)).first();
      if (row) {
        let metrics = {};
        try {
          metrics = JSON.parse(row.metrics_json || "{}");
        } catch (e) {
        }
        return normalizeBriefingPayload({
          ...row,
          ...metrics,
          asOfDate: row.as_of_date,
          headlineText: row.headline_text,
          assetClasses: metrics.asset_classes || metrics.assetClasses || [],
          peerGroups: metrics.peer_groups || metrics.peerGroups || [],
          periodicFlows: metrics.periodic_flows || metrics.periodicFlows,
          disparityWarning: metrics.disparity_warning || metrics.disparityWarning || []
        });
      }
    } catch (d1Err) {
      console.warn("[Distributor] Failed to query D1 fallback:", d1Err);
    }
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
  const kvBriefingKey = `distribution:briefing:${effectiveDate}`;
  try {
    const existing = await env.BRIEFING_KV.get(kvBriefingKey, "json");
    if (existing?.status === "distributed" && !dryRun) {
      return {
        success: true,
        alreadyDistributed: true,
        status: "already_distributed",
        asOfDate: effectiveDate,
        message: `\uD574\uB2F9 \uB0A0\uC9DC(${effectiveDate})\uC758 \uBE0C\uB9AC\uD551\uC740 \uC774\uBBF8 \uBC30\uD3EC \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`
      };
    }
  } catch (e) {
  }
  const validation = await validateBriefingPayload(payload, env);
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
      let existingDetails = {};
      let existingStatus = null;
      const row = await env.ETF_PRICES.prepare(
        `SELECT status, details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
      ).bind(effectiveDate).first();
      if (row) {
        existingStatus = row.status;
        if (row.details_json) {
          try {
            existingDetails = JSON.parse(row.details_json);
          } catch (e) {
          }
        }
      }
      existingDetails.reasons = validation.reasons;
      const nextStatus = existingStatus === "distributed" ? "distributed" : "blocked";
      if (existingStatus === "distributed") {
        existingDetails.revision_blocked = true;
      }
      await env.ETF_PRICES.prepare(
        `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(effectiveDate, nextStatus, JSON.stringify(existingDetails)).run();
    } catch (e) {
    }
    return { success: false, status: "blocked", reasons: validation.reasons };
  }
  const baseUrl = env.SITE_BASE_URL || "https://etf-campus.pages.dev";
  const narrative = await getOrRefineNarrative(payload, env);
  const instagramSlides = generateInstagramCarousel(payload, baseUrl, narrative);
  const threadsPosts = generateThreadsThread(payload, baseUrl, narrative);
  const newsletter = generateNewsletterHtml(payload, baseUrl, narrative);
  let threadsPublishedId = null;
  if (!dryRun && env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID) {
    try {
      const fullText = threadsPosts[0]?.content || "";
      const parts = fullText.split("[\uCCAB \uB313\uAE00]");
      const mainPost = parts[0].trim();
      const firstComment = parts[1] ? parts[1].trim() : "";
      const imgKey = `image:threads:${effectiveDate}`;
      const imgBuffer = await env.BRIEFING_KV.get(imgKey, "arrayBuffer");
      const publicPngUrl = `https://market-briefing-distributor.neo-alpha-research.workers.dev/api/images/threads?date=${effectiveDate}`;
      const searchParams = new URLSearchParams();
      if (imgBuffer) {
        searchParams.set("media_type", "IMAGE");
        searchParams.set("image_url", publicPngUrl);
      } else {
        searchParams.set("media_type", "TEXT");
      }
      searchParams.set("text", mainPost);
      searchParams.set("access_token", env.THREADS_ACCESS_TOKEN);
      const createUrl = `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}/threads`;
      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: searchParams
      });
      const createData = await createRes.json();
      if (createData.id) {
        if (imgBuffer) {
          await waitForThreadsContainer(createData.id, env.THREADS_ACCESS_TOKEN);
        }
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
            await waitForThreadsContainer(replyCreateData.id, env.THREADS_ACCESS_TOKEN);
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
    let existingDetails = {};
    let existingStatus = null;
    const row = await env.ETF_PRICES.prepare(
      `SELECT status, details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
    ).bind(effectiveDate).first();
    if (row) {
      existingStatus = row.status;
      if (row.details_json) {
        try {
          existingDetails = JSON.parse(row.details_json);
        } catch (e) {
        }
      }
    }
    const mergedDetails = {
      ...existingDetails,
      ...dispatchResults,
      threads: dispatchResults.threads.publishedPostId ? dispatchResults.threads : existingDetails.threads?.publishedPostId ? existingDetails.threads : dispatchResults.threads,
      instagram: dispatchResults.instagram.publishedPostId ? dispatchResults.instagram : existingDetails.instagram?.publishedPostId ? existingDetails.instagram : dispatchResults.instagram
    };
    const nextStatus = threadsPublishedId ? "distributed" : existingStatus === "distributed" ? "distributed" : dryRun ? "dry_run" : "ready";
    await env.ETF_PRICES.prepare(
      `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(effectiveDate, nextStatus, JSON.stringify(mergedDetails)).run();
  } catch (dbErr) {
    console.warn("[Distributor] Log insert warning:", dbErr);
  }
  if (!dryRun && (threadsPublishedId || dispatchResults.threads.publishedPostId)) {
    try {
      await env.BRIEFING_KV.put(kvBriefingKey, JSON.stringify({
        status: "distributed",
        publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
        dispatchResults
      }), { expirationTtl: 86400 * 30 });
    } catch (e) {
    }
  }
  return {
    success: true,
    asOfDate: effectiveDate,
    validation,
    dispatchResults
  };
}
__name(executeDistribution, "executeDistribution");
async function getOrRefineNarrative(payload, env) {
  const cacheKey = `narrative_v9:${payload.asOfDate}`;
  try {
    const cached = await env.BRIEFING_KV.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      const stripEmoji = /* @__PURE__ */ __name((str) => (str || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim(), "stripEmoji");
      return {
        ...parsed,
        slide1Subheadline: stripEmoji(parsed.slide1Subheadline),
        slide1Tip: stripEmoji(parsed.slide1Tip),
        slide4BannerTitle: stripEmoji(parsed.slide4BannerTitle),
        slide4BannerDesc: stripEmoji(parsed.slide4BannerDesc),
        slide5BannerTitle: stripEmoji(parsed.slide5BannerTitle),
        slide5BannerDesc: stripEmoji(parsed.slide5BannerDesc),
        slide5ActionTip: stripEmoji(parsed.slide5ActionTip),
        slide6Block1Title: stripEmoji(parsed.slide6Block1Title),
        slide6Block1Desc: stripEmoji(parsed.slide6Block1Desc),
        captionOpening: stripEmoji(parsed.captionOpening),
        captionMarketSummary: stripEmoji(parsed.captionMarketSummary),
        captionThemeAnalysis: stripEmoji(parsed.captionThemeAnalysis),
        captionWatchPoint: stripEmoji(parsed.captionWatchPoint),
        threadsOpening: stripEmoji(parsed.threadsOpening),
        threadsMarketSummary: stripEmoji(parsed.threadsMarketSummary),
        threadsWatchPoint: stripEmoji(parsed.threadsWatchPoint),
        firstComment: stripEmoji(parsed.firstComment)
      };
    }
  } catch (e) {
  }
  const baseRegime = classifyMarketRegime(payload);
  const refined = await reviewAndRefineWithGemini(payload, baseRegime, env);
  try {
    await env.BRIEFING_KV.put(cacheKey, JSON.stringify(refined), { expirationTtl: 86400 * 7 });
  } catch (e) {
  }
  return refined;
}
__name(getOrRefineNarrative, "getOrRefineNarrative");
async function waitForThreadsContainer(containerId, accessToken, maxAttempts = 18) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2e3));
    try {
      const checkUrl = `https://graph.threads.net/v1.0/${containerId}?fields=status,error_message&access_token=${accessToken}`;
      const res = await fetch(checkUrl);
      const data = await res.json();
      if (data.status === "FINISHED") {
        return true;
      }
      if (data.status === "ERROR") {
        console.error(`[Distributor] Container ${containerId} processing failed:`, data);
        return false;
      }
      console.log(`[Distributor] Container ${containerId} status: ${data.status} (wait loop ${i + 1}/${maxAttempts})`);
    } catch (e) {
      console.warn("[Distributor] Status check warning:", e);
    }
  }
  return false;
}
__name(waitForThreadsContainer, "waitForThreadsContainer");
async function publishToThreadsLive(env, payload) {
  const validation = await validateBriefingPayload(payload, env);
  if (!validation.isSafe) {
    return { success: false, error: `Circuit breaker \uCC28\uB2E8: ${validation.reasons.join(", ")}` };
  }
  const kvThreadsKey = `distribution:threads:${payload.asOfDate}`;
  const kvInFlightKey = `distribution:inflight:threads:${payload.asOfDate}`;
  try {
    const kvRecord = await env.BRIEFING_KV.get(kvThreadsKey, "json");
    if (kvRecord?.publishedPostId) {
      return {
        success: false,
        error: `\uD574\uB2F9 \uB0A0\uC9DC(${payload.asOfDate})\uC758 \uC2A4\uB808\uB4DC\uAC00 \uC774\uBBF8 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (\uAC8C\uC2DC ID: ${kvRecord.publishedPostId})`,
        publishedPostId: kvRecord.publishedPostId,
        permalink: kvRecord.permalink || `https://www.threads.com/@neo.alphareader/post/${kvRecord.publishedPostId}`
      };
    }
  } catch (e) {
  }
  try {
    const inFlight = await env.BRIEFING_KV.get(kvInFlightKey);
    if (inFlight) {
      return {
        success: false,
        error: `\uD574\uB2F9 \uB0A0\uC9DC(${payload.asOfDate})\uC758 \uC2A4\uB808\uB4DC \uBC30\uD3EC\uAC00 \uD604\uC7AC \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uD655\uC778\uD574\uC8FC\uC138\uC694.`
      };
    }
    await env.BRIEFING_KV.put(kvInFlightKey, "running", { expirationTtl: 90 });
  } catch (e) {
  }
  try {
    const row = await env.ETF_PRICES.prepare(
      `SELECT details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
    ).bind(payload.asOfDate).first();
    if (row && row.details_json) {
      const parsed = JSON.parse(row.details_json);
      if (parsed.threads?.publishedPostId) {
        try {
          await env.BRIEFING_KV.delete(kvInFlightKey);
        } catch (e) {
        }
        return {
          success: false,
          error: `\uD574\uB2F9 \uB0A0\uC9DC(${payload.asOfDate})\uC758 \uC2A4\uB808\uB4DC\uAC00 \uC774\uBBF8 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (\uAC8C\uC2DC ID: ${parsed.threads.publishedPostId})`,
          publishedPostId: parsed.threads.publishedPostId,
          permalink: parsed.threads.permalink || `https://www.threads.com/@neo.alphareader/post/${parsed.threads.publishedPostId}`
        };
      }
    }
  } catch (e) {
  }
  if (!env.THREADS_ACCESS_TOKEN || !env.THREADS_USER_ID) {
    return { success: false, error: "Threads API credentials (THREADS_ACCESS_TOKEN or THREADS_USER_ID) missing." };
  }
  const baseUrl = env.SITE_BASE_URL || "https://etf-campus.pages.dev";
  const narrative = await getOrRefineNarrative(payload, env);
  const threadsPosts = generateThreadsThread(payload, baseUrl, narrative);
  const fullText = threadsPosts[0]?.content || "";
  const parts = fullText.split("[\uCCAB \uB313\uAE00]");
  const mainPost = parts[0].trim();
  const firstComment = parts[1] ? parts[1].trim() : "";
  try {
    const createUrl = `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}/threads`;
    const imgKey = `image:threads:${payload.asOfDate}`;
    const imgBuffer = await env.BRIEFING_KV.get(imgKey, "arrayBuffer");
    const publicPngUrl = `https://market-briefing-distributor.neo-alpha-research.workers.dev/api/images/threads?date=${payload.asOfDate}`;
    if (imgBuffer) {
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const verifyRes = await fetch(publicPngUrl, { method: "HEAD" });
          if (verifyRes.ok && verifyRes.headers.get("content-type")?.includes("image")) {
            break;
          }
        } catch (e) {
        }
        await new Promise((r) => setTimeout(r, 1e3));
      }
    }
    const searchParams = new URLSearchParams();
    if (imgBuffer) {
      searchParams.set("media_type", "IMAGE");
      searchParams.set("image_url", publicPngUrl);
    } else {
      searchParams.set("media_type", "TEXT");
    }
    searchParams.set("text", mainPost);
    searchParams.set("access_token", env.THREADS_ACCESS_TOKEN);
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: searchParams
    });
    const createData = await createRes.json();
    if (!createData.id) {
      return { success: false, error: `Failed to create Threads container: ${JSON.stringify(createData)}` };
    }
    if (imgBuffer) {
      const isReady = await waitForThreadsContainer(createData.id, env.THREADS_ACCESS_TOKEN);
      if (!isReady) {
        return { success: false, error: `Threads image container ${createData.id} was not ready within timeout.` };
      }
    }
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
    const publishedPostId = pubData.id;
    if (!publishedPostId) {
      return { success: false, error: `Failed to publish Threads post: ${JSON.stringify(pubData)}` };
    }
    let firstCommentId;
    if (firstComment) {
      await new Promise((r) => setTimeout(r, 2500));
      const replyCreateRes = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          media_type: "TEXT",
          text: firstComment,
          reply_to_id: publishedPostId,
          access_token: env.THREADS_ACCESS_TOKEN
        })
      });
      const replyCreateData = await replyCreateRes.json();
      if (replyCreateData.id) {
        await waitForThreadsContainer(replyCreateData.id, env.THREADS_ACCESS_TOKEN);
        const replyPubRes = await fetch(pubUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            creation_id: replyCreateData.id,
            access_token: env.THREADS_ACCESS_TOKEN
          })
        });
        const replyPubData = await replyPubRes.json();
        firstCommentId = replyPubData.id;
        console.log("[Distributor] First comment published:", replyPubData);
      }
    }
    const permalink = `https://www.threads.net/@neo.alphareader/post/${publishedPostId}`;
    try {
      await env.BRIEFING_KV.put(kvThreadsKey, JSON.stringify({
        status: "distributed",
        publishedPostId,
        permalink,
        firstCommentId,
        publishedAt: (/* @__PURE__ */ new Date()).toISOString()
      }), { expirationTtl: 86400 * 30 });
      await env.BRIEFING_KV.delete(kvInFlightKey);
    } catch (e) {
      console.warn("[Distributor] Failed to record Threads distribution in KV:", e);
    }
    try {
      let existingDetails = {};
      const row = await env.ETF_PRICES.prepare(
        `SELECT details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
      ).bind(payload.asOfDate).first();
      if (row && row.details_json) {
        try {
          existingDetails = JSON.parse(row.details_json);
        } catch (e) {
        }
      }
      existingDetails.threads = {
        publishedPostId,
        permalink,
        firstCommentId,
        publishedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await env.ETF_PRICES.prepare(
        `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, 'distributed', ?, CURRENT_TIMESTAMP)`
      ).bind(payload.asOfDate, JSON.stringify(existingDetails)).run();
    } catch (e) {
      console.warn("[Distributor] Failed to record Threads distribution in D1:", e);
    }
    return {
      success: true,
      publishedPostId,
      permalink
    };
  } catch (err) {
    try {
      await env.BRIEFING_KV.delete(kvInFlightKey);
    } catch (e) {
    }
    return { success: false, error: String(err) };
  }
}
__name(publishToThreadsLive, "publishToThreadsLive");
async function publishToInstagramLive(env, payload, force = false) {
  const validation = await validateBriefingPayload(payload, env);
  if (!validation.isSafe) {
    return { success: false, error: `Circuit breaker \uCC28\uB2E8: ${validation.reasons.join(", ")}` };
  }
  const kvInstagramKey = `distribution:instagram:${payload.asOfDate}`;
  const kvInFlightKey = `distribution:inflight:instagram:${payload.asOfDate}`;
  if (!force) {
    try {
      const kvRecord = await env.BRIEFING_KV.get(kvInstagramKey, "json");
      if (kvRecord?.publishedPostId) {
        return {
          success: false,
          error: `\uD574\uB2F9 \uB0A0\uC9DC(${payload.asOfDate})\uC758 \uC778\uC2A4\uD0C0\uADF8\uB7A8\uC774 \uC774\uBBF8 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (\uAC8C\uC2DC ID: ${kvRecord.publishedPostId})`,
          publishedPostId: kvRecord.publishedPostId,
          permalink: kvRecord.permalink || `https://www.instagram.com/neo.alphareader/`
        };
      }
    } catch (e) {
    }
  }
  try {
    const inFlight = await env.BRIEFING_KV.get(kvInFlightKey);
    if (inFlight && !force) {
      return {
        success: false,
        error: `\uD574\uB2F9 \uB0A0\uC9DC(${payload.asOfDate})\uC758 \uC778\uC2A4\uD0C0\uADF8\uB7A8 \uBC30\uD3EC\uAC00 \uD604\uC7AC \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uD655\uC778\uD574\uC8FC\uC138\uC694.`
      };
    }
    await env.BRIEFING_KV.put(kvInFlightKey, "running", { expirationTtl: 90 });
  } catch (e) {
  }
  if (!force) {
    try {
      const row = await env.ETF_PRICES.prepare(
        `SELECT details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
      ).bind(payload.asOfDate).first();
      if (row && row.details_json) {
        const parsed = JSON.parse(row.details_json);
        if (parsed.instagram?.publishedPostId) {
          try {
            await env.BRIEFING_KV.delete(kvInFlightKey);
          } catch (e) {
          }
          return {
            success: false,
            error: `\uD574\uB2F9 \uB0A0\uC9DC(${payload.asOfDate})\uC758 \uC778\uC2A4\uD0C0\uADF8\uB7A8\uC774 \uC774\uBBF8 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (\uAC8C\uC2DC ID: ${parsed.instagram.publishedPostId})`,
            publishedPostId: parsed.instagram.publishedPostId,
            permalink: parsed.instagram.permalink || `https://www.instagram.com/neo.alphareader/`
          };
        }
      }
    } catch (e) {
    }
  }
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_USER_ID) {
    return { success: false, error: "Instagram API credentials (INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_USER_ID) missing." };
  }
  const narrative = await getOrRefineNarrative(payload, env);
  const caption = generateInstagramCaption(payload, narrative);
  const slideCount = 6;
  const slideChecks = await Promise.all(
    Array.from(
      { length: slideCount },
      (_, idx) => env.BRIEFING_KV.get(`image:instagram:${payload.asOfDate}:${idx + 1}`, "arrayBuffer")
    )
  );
  const isCarousel = slideChecks.every((buf) => buf !== null);
  try {
    let publishedPostId = null;
    if (isCarousel) {
      console.log(`[Distributor] Publishing 6-slide Carousel to Instagram for ${payload.asOfDate}`);
      const itemContainerIds = [];
      for (let slideNo = 1; slideNo <= slideCount; slideNo++) {
        const slideUrl = `https://market-briefing-distributor.neo-alpha-research.workers.dev/api/images/instagram?date=${payload.asOfDate}&slide=${slideNo}`;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const vRes = await fetch(slideUrl, { method: "HEAD" });
            if (vRes.ok) break;
          } catch (e) {
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        const itemRes = await fetch(`https://graph.instagram.com/v21.0/${env.INSTAGRAM_USER_ID}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            image_url: slideUrl,
            is_carousel_item: "true",
            access_token: env.INSTAGRAM_ACCESS_TOKEN
          })
        });
        const itemData = await itemRes.json();
        if (!itemData.id) {
          throw new Error(`Failed to create Instagram carousel item ${slideNo}: ${JSON.stringify(itemData)}`);
        }
        itemContainerIds.push(itemData.id);
      }
      for (const itemId of itemContainerIds) {
        let isChildFinished = false;
        for (let i = 0; i < 25; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const statusRes = await fetch(`https://graph.instagram.com/v21.0/${itemId}?fields=status_code&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
          const sData = await statusRes.json();
          if (sData.status_code === "FINISHED") {
            isChildFinished = true;
            break;
          }
          if (sData.status_code === "ERROR") {
            throw new Error(`Instagram carousel child container ${itemId} processing error: ${JSON.stringify(sData)}`);
          }
        }
        if (!isChildFinished) {
          throw new Error(`Instagram carousel child container ${itemId} timed out before reaching FINISHED status.`);
        }
      }
      const carouselRes = await fetch(`https://graph.instagram.com/v21.0/${env.INSTAGRAM_USER_ID}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          media_type: "CAROUSEL",
          children: itemContainerIds.join(","),
          caption,
          access_token: env.INSTAGRAM_ACCESS_TOKEN
        })
      });
      const carouselData = await carouselRes.json();
      if (!carouselData.id) {
        throw new Error(`Failed to create Instagram carousel container: ${JSON.stringify(carouselData)}`);
      }
      let isCarouselFinished = false;
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 2e3));
        const statusRes = await fetch(`https://graph.instagram.com/v21.0/${carouselData.id}?fields=status_code&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
        const sData = await statusRes.json();
        if (sData.status_code === "FINISHED") {
          isCarouselFinished = true;
          break;
        }
        if (sData.status_code === "ERROR") {
          throw new Error(`Instagram carousel container ${carouselData.id} processing error: ${JSON.stringify(sData)}`);
        }
      }
      if (!isCarouselFinished) {
        throw new Error(`Instagram carousel parent container ${carouselData.id} timed out before reaching FINISHED status.`);
      }
      const pubRes = await fetch(`https://graph.instagram.com/v21.0/${env.INSTAGRAM_USER_ID}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: carouselData.id,
          access_token: env.INSTAGRAM_ACCESS_TOKEN
        })
      });
      const pubData = await pubRes.json();
      publishedPostId = pubData.id;
      if (!publishedPostId) {
        throw new Error(`Failed to publish Instagram carousel: ${JSON.stringify(pubData)}`);
      }
    } else {
      console.log(`[Distributor] Falling back to single image for Instagram ${payload.asOfDate}`);
      const publicPngUrl = `https://market-briefing-distributor.neo-alpha-research.workers.dev/api/images/threads?date=${payload.asOfDate}`;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const verifyRes = await fetch(publicPngUrl, { method: "HEAD" });
          if (verifyRes.ok && verifyRes.headers.get("content-type")?.includes("image")) break;
        } catch (e) {
        }
        await new Promise((r) => setTimeout(r, 1e3));
      }
      const createRes = await fetch(`https://graph.instagram.com/v21.0/${env.INSTAGRAM_USER_ID}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          image_url: publicPngUrl,
          caption,
          access_token: env.INSTAGRAM_ACCESS_TOKEN
        })
      });
      const createData = await createRes.json();
      if (!createData.id) {
        return { success: false, error: `Failed to create Instagram container: ${JSON.stringify(createData)}` };
      }
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 2e3));
        const statusRes = await fetch(`https://graph.instagram.com/v21.0/${createData.id}?fields=status_code&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
        const sData = await statusRes.json();
        if (sData.status_code === "FINISHED") break;
        if (sData.status_code === "ERROR") {
          return { success: false, error: `Instagram container processing error: ${JSON.stringify(sData)}` };
        }
      }
      const pubRes = await fetch(`https://graph.instagram.com/v21.0/${env.INSTAGRAM_USER_ID}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: createData.id,
          access_token: env.INSTAGRAM_ACCESS_TOKEN
        })
      });
      const pubData = await pubRes.json();
      publishedPostId = pubData.id;
      if (!publishedPostId) {
        return { success: false, error: `Failed to publish Instagram post: ${JSON.stringify(pubData)}` };
      }
    }
    let permalink = `https://www.instagram.com/neo.alphareader/`;
    try {
      const pRes = await fetch(`https://graph.instagram.com/v21.0/${publishedPostId}?fields=permalink&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
      const pData = await pRes.json();
      if (pData.permalink) permalink = pData.permalink;
    } catch (e) {
    }
    try {
      await env.BRIEFING_KV.put(kvInstagramKey, JSON.stringify({
        status: "distributed",
        publishedPostId,
        permalink,
        isCarousel,
        slideCount: isCarousel ? slideCount : 1,
        publishedAt: (/* @__PURE__ */ new Date()).toISOString()
      }), { expirationTtl: 86400 * 30 });
      await env.BRIEFING_KV.delete(kvInFlightKey);
    } catch (e) {
      console.warn("[Distributor] Failed to record Instagram distribution in KV:", e);
    }
    try {
      let existingDetails = {};
      const row = await env.ETF_PRICES.prepare(
        `SELECT details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
      ).bind(payload.asOfDate).first();
      if (row && row.details_json) {
        try {
          existingDetails = JSON.parse(row.details_json);
        } catch (e) {
        }
      }
      existingDetails.instagram = {
        publishedPostId,
        permalink,
        isCarousel,
        slideCount: isCarousel ? slideCount : 1,
        publishedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await env.ETF_PRICES.prepare(
        `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, 'distributed', ?, CURRENT_TIMESTAMP)`
      ).bind(payload.asOfDate, JSON.stringify(existingDetails)).run();
    } catch (e) {
      console.warn("[Distributor] Failed to record Instagram distribution in D1:", e);
    }
    return {
      success: true,
      publishedPostId,
      permalink
    };
  } catch (err) {
    try {
      await env.BRIEFING_KV.delete(kvInFlightKey);
    } catch (e) {
    }
    return { success: false, error: String(err) };
  }
}
__name(publishToInstagramLive, "publishToInstagramLive");
function checkAuth(request, env) {
  if (!env.MANUAL_RUN_TOKEN) {
    console.error("[SECURITY] MANUAL_RUN_TOKEN\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC544 \uBAA8\uB4E0 \uC694\uCCAD\uC744 \uAC70\uBD80\uD569\uB2C8\uB2E4");
    return false;
  }
  const url = new URL(request.url);
  const qToken = url.searchParams.get("token");
  if (qToken && qToken === env.MANUAL_RUN_TOKEN) return true;
  const authHeader = request.headers.get("Authorization") || request.headers.get("X-Auth-Token");
  if (authHeader) {
    const t = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (t === env.MANUAL_RUN_TOKEN) return true;
  }
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/etf_distributor_auth=([^;]+)/);
  if (match && match[1] === env.MANUAL_RUN_TOKEN) return true;
  return false;
}
__name(checkAuth, "checkAuth");
function generateLoginHtml() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ETF Campus \uBC30\uD3EC \uB300\uC2DC\uBCF4\uB4DC \uAD00\uB9AC\uC790 \uC778\uC99D</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Pretendard', sans-serif; }
    body { background-color: #F8FAFC; color: #0F172A; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 36px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); text-align: center; }
    h1 { font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #0F172A; }
    p { font-size: 14px; color: #64748B; margin-bottom: 24px; line-height: 1.5; }
    input { width: 100%; padding: 12px 16px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 10px; color: #0F172A; font-size: 15px; margin-bottom: 16px; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #10B981; background: #FFFFFF; }
    button { width: 100%; padding: 12px; background: #059669; border: none; border-radius: 10px; color: #FFFFFF; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #047857; }
    .back-link { display: inline-block; margin-top: 16px; font-size: 13px; color: #64748B; text-decoration: none; }
    .back-link:hover { color: #059669; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 40px; margin-bottom: 16px;">\u{1F510}</div>
    <h1>\uBC30\uD3EC \uAD00\uB9AC\uC790 \uC778\uC99D</h1>
    <p>\uBE0C\uB79C\uB4DC \uC548\uC804\uC744 \uC704\uD574 \uBCF4\uD638\uB41C \uC601\uC5ED\uC785\uB2C8\uB2E4.<br>\uAD00\uB9AC\uC790 \uC561\uC138\uC2A4 \uD1A0\uD070\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.</p>
    <form onsubmit="handleLogin(event)">
      <input type="password" id="tokenInput" placeholder="Access Token \uC785\uB825" required autocomplete="current-password">
      <button type="submit">\uB300\uC2DC\uBCF4\uB4DC \uC811\uC18D</button>
    </form>
    <a href="/preview" class="back-link">\u2190 \uBBF8\uB9AC\uBCF4\uAE30 \uBAA8\uB4DC\uB85C \uC774\uB3D9</a>
  </div>
  <script>
    function handleLogin(e) {
      e.preventDefault();
      const token = document.getElementById('tokenInput').value.trim();
      if (!token) return;
      document.cookie = "etf_distributor_auth=" + token + "; path=/; max-age=2592000; SameSite=Lax; Secure";
      window.location.href = "/?token=" + encodeURIComponent(token);
    }
  <\/script>
</body>
</html>`;
}
__name(generateLoginHtml, "generateLoginHtml");
function generateDashboardHtml(payload, env, logStatus, threadsPublishedId, instagramPublishedId, narrative, logReasons = [], isAuthed = false, availableDates = []) {
  const hasValidDate = Boolean(payload.asOfDate);
  const date = payload.asOfDate || "";
  const dateDisplay = hasValidDate ? date : '<span style="color: #EF4444; font-weight: 800;">\uAE30\uC900\uC77C\uC790 \uC5C6\uC74C</span>';
  const generalCount = payload.generalEtfCount;
  const generalCountDisplay = generalCount !== void 0 && generalCount !== null ? `<strong style="color: #0F172A;">${typeof generalCount === "number" ? generalCount.toLocaleString() : generalCount}\uAC1C</strong>` : '<span style="color: #EF4444; font-weight: 800;">\uB370\uC774\uD130 \uC5C6\uC74C</span>';
  const up = payload.upCount ?? 0;
  const flat = payload.flatCount ?? 0;
  const down = payload.downCount ?? 0;
  const kospi = payload.kospiChangePct;
  const kospiFormatted = typeof kospi === "number" ? kospi.toFixed(2) : kospi;
  const kospiDisplay = kospi !== void 0 && kospi !== null ? `KOSPI ${Number(kospi) > 0 ? "+" : ""}${kospiFormatted}%` : 'KOSPI <span style="color: #EF4444;">\uB370\uC774\uD130 \uC5C6\uC74C</span>';
  const etfReturn = payload.generalAumWeightedReturnPct;
  const etfReturnFormatted = typeof etfReturn === "number" ? etfReturn.toFixed(2) : etfReturn;
  const etfReturnDisplay = etfReturn !== void 0 && etfReturn !== null ? `ETF ${Number(etfReturn) > 0 ? "+" : ""}${etfReturnFormatted}%` : 'ETF <span style="color: #EF4444;">\uB370\uC774\uD130 \uC5C6\uC74C</span>';
  const threadsText = generateThreadsThread(payload, env.SITE_BASE_URL || "https://etf-campus.pages.dev", narrative)[0]?.content || "";
  const captionText = generateInstagramCaption(payload, narrative);
  const newsletterData = generateNewsletterHtml(payload, env.SITE_BASE_URL || "https://etf-campus.pages.dev", narrative);
  const newsletterSubject = newsletterData.subject;
  const newsletterPreheader = newsletterData.preheader;
  const isThreadsPublished = Boolean(threadsPublishedId);
  const isInstagramPublished = Boolean(instagramPublishedId);
  const isBlocked = logStatus === "blocked" || logReasons.length > 0;
  const modelNameDisplay = narrative.modelUsed || "gemini-3.8-flash";
  const tokenDisplay = narrative.tokenIndex ? ` \xB7 Token #${narrative.tokenIndex}` : "";
  const aiBadge = narrative.source === "gemini-refined" ? `<span class="badge badge-live" title="5\uACC4\uCE35 \uBAA8\uB378 \uC6CC\uD130\uD3F4 \uBC0F 7\uB300 \uD1A0\uD070 \uD480 \uC801\uC6A9 (${modelNameDisplay})">\u{1F916} ${modelNameDisplay}${tokenDisplay} \uAC80\uC99D \uC644\uB8CC</span>` : '<span class="badge badge-safe">\u2699\uFE0F \uC815\uBC00 \uB8F0 \uC5D4\uC9C4 \uCD08\uC548</span>';
  const uniqueDates = Array.from(/* @__PURE__ */ new Set([date, ...availableDates])).filter(Boolean).sort().reverse();
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OSMU \uD1B5\uD569 \uAC80\uD1A0 \uB300\uC2DC\uBCF4\uB4DC | ETF Campus (${date})</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; }
    body { background-color: #F8FAFC; color: #0F172A; min-height: 100vh; padding: 20px; }
    .container { max-width: 1320px; margin: 0 auto; }
    header { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 18px; padding: 20px 24px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 16px; }
    .header-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .date-select { padding: 7px 12px; border-radius: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; font-size: 13px; font-weight: 700; color: #047857; outline: none; cursor: pointer; }
    .btn-refresh { background: #F1F5F9; color: #0F172A; border: 1px solid #CBD5E1; padding: 7px 14px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; }
    .btn-refresh:hover { background: #E2E8F0; }
    .header-badges { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .badge { padding: 5px 12px; border-radius: 9999px; font-size: 12.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; }
    .badge-ready { background: #FEF3C7; color: #B45309; }
    .badge-live { background: #DCFCE7; color: #15803D; }
    .badge-safe { background: #EFF6FF; color: #1D4ED8; }
    .badge-blocked { background: #FEE2E2; color: #B91C1C; }
    .badge-auth { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
    .badge-anon { background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1; text-decoration: none; }
    .tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .tab-btn { background: #FFFFFF; border: 1px solid #CBD5E1; color: #475569; padding: 12px 22px; border-radius: 12px; font-size: 14.5px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .tab-btn:hover { background: #F8FAFC; color: #0F172A; border-color: #94A3B8; }
    .tab-btn.active { background: #059669; color: #FFFFFF; border-color: #059669; box-shadow: 0 4px 12px rgba(5,150,105,0.25); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 18px; padding: 22px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03); }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 960px) { .grid-2 { grid-template-columns: 1fr; } }
    .preview-img { width: 100%; max-width: 480px; aspect-ratio: 4/5; border-radius: 14px; box-shadow: 0 8px 20px rgba(0,0,0,0.06); border: 1px solid #E2E8F0; display: block; margin: 0 auto; background: #FFFFFF; object-fit: contain; }
    .carousel-nav { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    .nav-btn { background: #F1F5F9; color: #1E293B; border: 1px solid #CBD5E1; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: background 0.2s; }
    .nav-btn:hover { background: #E2E8F0; }
    .dot-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid #CBD5E1; cursor: pointer; font-size: 12px; font-weight: 700; background: #F1F5F9; color: #475569; transition: all 0.2s; }
    .dot-btn.active { background: #059669; color: #FFFFFF; border-color: #059669; }
    .copy-box { background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 12px; padding: 16px; font-size: 14px; line-height: 1.7; color: #0F172A; white-space: pre-wrap; word-break: break-word; max-height: 520px; overflow-y: auto; font-family: 'Pretendard', sans-serif; }
    .action-btn { background: #059669; color: #FFFFFF; border: none; padding: 11px 22px; border-radius: 11px; font-size: 14.5px; font-weight: 800; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; }
    .action-btn:hover { background: #047857; }
    .btn-secondary { background: #F8FAFC; color: #1E293B; padding: 6px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid #CBD5E1; cursor: pointer; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
    .btn-secondary:hover { background: #E2E8F0; }
    iframe.email-frame { width: 100%; height: 780px; border: 1px solid #E2E8F0; border-radius: 14px; background: #FFFFFF; }
    @media (max-width: 640px) {
      body { padding: 10px; }
      header { padding: 14px 16px; border-radius: 14px; }
      .card { padding: 14px; border-radius: 14px; }
      .tabs { gap: 6px; }
      .tab-btn { flex: 1 1 100%; text-align: center; justify-content: center; min-height: 44px; padding: 10px 14px; font-size: 13.5px; }
      .dot-btn { min-width: 38px; min-height: 38px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
      .header-actions { width: 100%; justify-content: space-between; }
      .action-btn { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-top">
        <div>
          <h1 style="font-size: 21px; font-weight: 900; margin-bottom: 4px; color: #0F172A; display: flex; align-items: center; gap: 8px;">
            <span>\u{1F4C8} ETF Campus \uB9C8\uCF13 \uBE0C\uB9AC\uD551 OSMU \uD1B5\uD569 \uAC80\uD1A0 \uD5C8\uBE0C</span>
            <span style="font-size: 11px; background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; padding: 2px 8px; border-radius: 9999px; font-weight: 800;">Cloudflare Edge</span>
          </h1>
          <p style="color: #64748B; font-size: 13.5px;">\uB370\uC774\uD130 \uAE30\uC900\uC77C: <strong style="color: #0F172A;">${dateDisplay}</strong> \xB7 \uC77C\uBC18 ETF ${generalCountDisplay} (\uC0C1\uC2B9 ${up} / \uBCF4\uD569 ${flat} / \uD558\uB77D ${down}) \xB7 ${kospiDisplay} \xB7 ${etfReturnDisplay}</p>
        </div>
        <div class="header-actions">
          <label style="font-size: 12px; font-weight: 700; color: #475569;">\uBD84\uC11D\uC77C:</label>
          <select id="dateSelector" class="date-select" onchange="changeDate(this.value)">
            ${uniqueDates.map((d) => `<option value="${d}" ${d === date ? "selected" : ""}>${d} ${d === uniqueDates[0] ? "(\uCD5C\uC2E0)" : ""}</option>`).join("")}
          </select>
          <button class="btn-refresh" onclick="forceRefresh('${date}')" title="Cloudflare \uCE90\uC2DC\uB97C \uC6B0\uD68C\uD558\uC5EC \uCD5C\uC2E0 \uB370\uC774\uD130\uB97C \uC989\uC2DC \uBD88\uB7EC\uC635\uB2C8\uB2E4">\u{1F504} \uCD5C\uC2E0 \uAC31\uC2E0</button>
          ${isAuthed ? '<span class="badge badge-auth" title="\uAD00\uB9AC\uC790 \uD1A0\uD070\uC774 \uD655\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4">\u{1F511} \uAD00\uB9AC\uC790 \uC778\uC99D\uB428</span>' : '<a href="/login" class="badge badge-anon" title="\uD074\uB9AD\uD558\uC5EC \uD1A0\uD070\uC744 \uB4F1\uB85D\uD558\uBA74 \uC989\uC2DC \uBC1C\uD589\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4">\u{1F510} \uBBF8\uB9AC\uBCF4\uAE30 \uBAA8\uB4DC</a>'}
        </div>
      </div>
      <div class="header-badges">
        ${aiBadge}
        ${isBlocked ? `<span class="badge badge-blocked" title="${logReasons.join("; ")}">\u26D4 \uC11C\uD0B7\uBE0C\uB808\uC774\uCEE4 \uCC28\uB2E8: ${logReasons[0] || "\uB370\uC774\uD130 \uAC80\uC99D \uC2E4\uD328"}</span>` : '<span class="badge badge-safe">\u2705 \uC11C\uD0B7\uBE0C\uB808\uC774\uCEE4 \uC815\uC0C1</span>'}
        <span class="badge ${isThreadsPublished ? "badge-live" : "badge-ready"}">
          ${isThreadsPublished ? `\u2705 \uC2A4\uB808\uB4DC \uBC1C\uD589\uC644\uB8CC (${threadsPublishedId})` : "\u23F3 \uC2A4\uB808\uB4DC \uB300\uAE30"}
        </span>
        <span class="badge ${isInstagramPublished ? "badge-live" : "badge-ready"}">
          ${isInstagramPublished ? `\u2705 \uC778\uC2A4\uD0C0 \uBC1C\uD589\uC644\uB8CC (${instagramPublishedId})` : "\u23F3 \uC778\uC2A4\uD0C0 \uB300\uAE30"}
        </span>
      </div>
    </header>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab(event, 'tab-instagram')">\u{1F4F7} \uC778\uC2A4\uD0C0\uADF8\uB7A8 (\uCE74\uB4DC\uB274\uC2A4 6\uC7A5 & \uCEA1\uC158)</button>
      <button class="tab-btn" onclick="switchTab(event, 'tab-threads')">\u{1F9F5} \uC2A4\uB808\uB4DC (\uBCF8\uBB38 & \uC778\uD3EC\uADF8\uB798\uD53D 1\uC7A5)</button>
      <button class="tab-btn" onclick="switchTab(event, 'tab-newsletter')">\u{1F4E7} \uC774\uBA54\uC77C \uB274\uC2A4\uB808\uD130 (\uBC18\uC751\uD615 \uD480\uBDF0)</button>
    </div>

    <!-- 1. Instagram Tab -->
    <div id="tab-instagram" class="tab-content active">
      <div class="grid-2">
        <div class="card" style="text-align: center;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; text-align: left; flex-wrap: wrap; gap: 8px;">
            <h3 style="font-size: 16px; font-weight: 800;">\u{1F5BC}\uFE0F \uCE74\uB4DC\uB274\uC2A4 (\uC2AC\uB77C\uC774\uB4DC <span id="currentSlideNum">1</span> / 6)</h3>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <div style="display: inline-flex; background: #F1F5F9; border-radius: 8px; padding: 2px; border: 1px solid #CBD5E1;">
                <button id="btnModePng" onclick="setViewMode('png')" style="padding: 4px 10px; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer; background: #059669; color: white;">\u{1F5BC}\uFE0F \uC2E4\uBB3C PNG</button>
                <button id="btnModeSvg" onclick="setViewMode('svg')" style="padding: 4px 10px; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer; background: transparent; color: #64748B;">\u26A1 SVG \uBCA1\uD130</button>
              </div>
              <a id="btnOpenSvg" href="/api/preview/instagram?date=${date}&slide=1" target="_blank" class="btn-secondary">\u{1F50D} SVG \uC6D0\uBCF8</a>
              <a id="btnDownloadPng" href="/api/images/instagram?date=${date}&slide=1" target="_blank" class="btn-secondary">\u2B07\uFE0F PNG \uB2E4\uC6B4</a>
            </div>
          </div>
          <div style="position: relative; width: 100%; max-width: 480px; margin: 0 auto;">
            <img id="instagramImg" src="/api/images/instagram?date=${date}&slide=1&v=${Date.now()}" class="preview-img" alt="Instagram Card" onerror="handleInstagramImgError(this)">
          </div>
          <div class="carousel-nav">
            <button class="nav-btn" onclick="changeSlide(-1)">\u25C0 \uC774\uC804</button>
            <div id="slideDots" style="display: flex; gap: 6px;"></div>
            <button class="nav-btn" onclick="changeSlide(1)">\uB2E4\uC74C \u25B6</button>
          </div>
        </div>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 16px; font-weight: 800;">\u{1F4DD} \uC778\uC2A4\uD0C0\uADF8\uB7A8 \uCEA1\uC158 \uC804\uBB38</h3>
            <button class="btn-secondary" onclick="copyText('instagramCaptionText')">\u{1F4CB} \uCEA1\uC158 \uBCF5\uC0AC</button>
          </div>
          <div id="instagramCaptionText" class="copy-box">${captionText}</div>
          <div style="margin-top: 16px; text-align: right;">
            ${isInstagramPublished ? `<button class="action-btn" disabled style="background: #334155; cursor: not-allowed;">\u2705 \uC778\uC2A4\uD0C0\uADF8\uB7A8 \uBC1C\uD589 \uC644\uB8CC (ID: ${instagramPublishedId})</button>` : !hasValidDate || isBlocked ? `<button class="action-btn" disabled style="background: #94A3B8; cursor: not-allowed;">\u{1F6AB} \uBC1C\uD589 \uBD88\uAC00 (${!hasValidDate ? "\uAE30\uC900\uC77C\uC790 \uC5C6\uC74C" : "\uC11C\uD0B7\uBE0C\uB808\uC774\uCEE4 \uCC28\uB2E8"})</button>` : `<button id="btnPublishInstagram" class="action-btn" style="background: linear-gradient(135deg, #E1306C, #C13584); color: white;" onclick="publishInstagram('${date}')">\u{1F4F8} \uC774 \uB0B4\uC6A9\uC73C\uB85C \uC778\uC2A4\uD0C0\uADF8\uB7A8 6\uC7A5 \uCE74\uB4DC\uB274\uC2A4 \uC989\uC2DC \uBC1C\uD589</button>`}
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Threads Tab -->
    <div id="tab-threads" class="tab-content">
      <div class="grid-2">
        <div class="card" style="text-align: center;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; text-align: left; flex-wrap: wrap; gap: 8px;">
            <h3 style="font-size: 16px; font-weight: 800;">\u{1F5BC}\uFE0F \uC2A4\uB808\uB4DC \uC804\uC6A9 \uC778\uD3EC\uADF8\uB798\uD53D (1\uC7A5)</h3>
            <div style="display: flex; gap: 6px;">
              <a href="/api/preview/threads-image?date=${date}" target="_blank" class="btn-secondary">\u{1F50D} SVG \uC6D0\uBCF8</a>
              <a href="/api/images/threads?date=${date}" target="_blank" class="btn-secondary">\u2B07\uFE0F PNG \uB2E4\uC6B4</a>
            </div>
          </div>
          <img id="threadsImg" src="/api/images/threads?date=${date}&v=${Date.now()}" class="preview-img" alt="Threads Infographic" onerror="this.onerror=null; this.src='/api/preview/threads-image?date=${date}&v='+Date.now()">
        </div>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 16px; font-weight: 800;">\u{1F9F5} \uC2A4\uB808\uB4DC \uBCF8\uBB38 & \uB313\uAE00 \uC804\uBB38</h3>
            <button class="btn-secondary" onclick="copyText('threadsFullText')">\u{1F4CB} \uBCF8\uBB38 \uBCF5\uC0AC</button>
          </div>
          <div id="threadsFullText" class="copy-box">${threadsText}</div>
          <div style="margin-top: 16px; text-align: right;">
            ${isThreadsPublished ? `<button class="action-btn" disabled style="background: #334155; cursor: not-allowed;">\u2705 \uC2A4\uB808\uB4DC \uBC1C\uD589 \uC644\uB8CC (ID: ${threadsPublishedId})</button>` : !hasValidDate || isBlocked ? `<button class="action-btn" disabled style="background: #94A3B8; cursor: not-allowed;">\u{1F6AB} \uBC1C\uD589 \uBD88\uAC00 (${!hasValidDate ? "\uAE30\uC900\uC77C\uC790 \uC5C6\uC74C" : "\uC11C\uD0B7\uBE0C\uB808\uC774\uCEE4 \uCC28\uB2E8"})</button>` : `<button id="btnPublishThreads" class="action-btn" onclick="publishThreads('${date}')">\u{1F680} \uC774 \uB0B4\uC6A9\uC73C\uB85C \uC2A4\uB808\uB4DC \uC989\uC2DC \uBC1C\uD589</button>`}
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Newsletter Tab -->
    <div id="tab-newsletter" class="tab-content">
      <div class="card">
        <!-- Meta Bar -->
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
            <div style="font-size: 13.5px; color: #1E293B; line-height: 1.5;">
              <strong style="color: #047857; margin-right: 6px;">[\uBA54\uC77C \uC81C\uBAA9]</strong>
              <span id="newsletterSubjectText" style="font-weight: 700;">${escapeXml4(newsletterSubject)}</span>
            </div>
            <button class="btn-secondary" onclick="copyNewsletterField('newsletterSubjectText')" style="white-space: nowrap;">\u{1F4CB} \uC81C\uBAA9 \uBCF5\uC0AC</button>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div style="font-size: 12.5px; color: #64748B; line-height: 1.5;">
              <strong style="color: #475569; margin-right: 6px;">[\uBC1B\uC740\uD3B8\uC9C0\uD568 \uBBF8\uB9AC\uBCF4\uAE30]</strong>
              <span id="newsletterPreheaderText">${escapeXml4(newsletterPreheader)}</span>
            </div>
            <button class="btn-secondary" onclick="copyNewsletterField('newsletterPreheaderText')" style="white-space: nowrap;">\u{1F4CB} \uBBF8\uB9AC\uBCF4\uAE30 \uBCF5\uC0AC</button>
          </div>
        </div>

        <!-- Controls Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <h3 style="font-size: 16px; font-weight: 800; margin: 0;">\u{1F4E7} \uC774\uBA54\uC77C \uB274\uC2A4\uB808\uD130 \uD504\uB9AC\uBDF0</h3>
            <div style="display: inline-flex; background: #F1F5F9; border-radius: 8px; padding: 2px; border: 1px solid #CBD5E1;">
              <button id="btnEmailDesktop" onclick="setEmailViewport('desktop')" style="padding: 4px 10px; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer; background: #059669; color: white;">\u{1F4BB} \uB370\uC2A4\uD06C\uD1B1 (620px)</button>
              <button id="btnEmailMobile" onclick="setEmailViewport('mobile')" style="padding: 4px 10px; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer; background: transparent; color: #64748B;">\u{1F4F1} \uBAA8\uBC14\uC77C (375px)</button>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn-secondary" onclick="copyNewsletterHtml('${date}')">\u{1F4CB} HTML \uC804\uCCB4 \uC18C\uC2A4 \uBCF5\uC0AC</button>
            <a href="/api/preview/newsletter?date=${date}" target="_blank" class="btn-secondary">\u{1F517} \uC0C8 \uCC3D\uC5D0\uC11C \uC804\uCCB4\uBCF4\uAE30</a>
          </div>
        </div>

        <!-- Iframe Container -->
        <div id="emailFrameContainer" style="max-width: 620px; margin: 0 auto; transition: max-width 0.25s ease; border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.04);">
          <iframe id="emailFrame" src="/api/preview/newsletter?date=${date}" class="email-frame" style="width: 100%; height: 800px; border: none; background: #FFFFFF; display: block;"></iframe>
        </div>
      </div>
    </div>
    <footer style="margin-top: 24px; text-align: center; font-size: 12px; color: #64748B; padding: 16px; border-top: 1px solid #E2E8F0;">
      * \uBCF8 \uB300\uC2DC\uBCF4\uB4DC\uB294 \uD55C\uAD6D\uAC70\uB798\uC18C(KRX) \uACF5\uC2DC \uB370\uC774\uD130 \uAE30\uBC18 \uAC1D\uAD00\uC801 \uBD84\uC11D\uC744 \uC81C\uACF5\uD558\uBA70, \uD2B9\uC815 \uC885\uBAA9\uC758 \uB9E4\uC218\xB7\uB9E4\uB3C4\uB97C \uCD94\uCC9C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. (\uC790\uBCF8\uC2DC\uC7A5\uBC95 \uC81C101\uC870 \uC900\uC218)
    </footer>
  </div>

  <script>
    let currentSlide = 1;
    const totalSlides = 6;
    const date = '${date}';
    let viewMode = localStorage.getItem('osmu_view_mode') || 'png';

    function setViewMode(mode) {
      viewMode = mode;
      localStorage.setItem('osmu_view_mode', mode);
      updateModeButtons();
      updateSlide();
    }

    function updateModeButtons() {
      const btnPng = document.getElementById('btnModePng');
      const btnSvg = document.getElementById('btnModeSvg');
      if (!btnPng || !btnSvg) return;
      if (viewMode === 'png') {
        btnPng.style.background = '#059669';
        btnPng.style.color = '#FFFFFF';
        btnSvg.style.background = 'transparent';
        btnSvg.style.color = '#64748B';
      } else {
        btnSvg.style.background = '#059669';
        btnSvg.style.color = '#FFFFFF';
        btnPng.style.background = 'transparent';
        btnPng.style.color = '#64748B';
      }
    }

    function handleInstagramImgError(img) {
      if (viewMode === 'png') {
        console.warn('[Dashboard] PNG not found, falling back to SVG renderer');
        viewMode = 'svg';
        updateModeButtons();
        img.onerror = null;
        img.src = '/api/preview/instagram?date=' + encodeURIComponent(date) + '&slide=' + currentSlide + '&v=' + Date.now();
      }
    }

    function getCookie(name) {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? match[2] : null;
    }

    function switchTab(evt, tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      evt.currentTarget.classList.add('active');
      document.getElementById(tabId).classList.add('active');
      localStorage.setItem('osmu_active_tab', tabId);
      location.hash = tabId;
    }

    function changeSlide(delta) {
      currentSlide += delta;
      if (currentSlide < 1) currentSlide = totalSlides;
      if (currentSlide > totalSlides) currentSlide = 1;
      updateSlide();
    }

    function goToSlide(n) {
      currentSlide = n;
      updateSlide();
    }

    function updateSlide() {
      const img = document.getElementById('instagramImg');
      const v = Date.now();
      img.onerror = () => handleInstagramImgError(img);
      if (viewMode === 'png') {
        img.src = '/api/images/instagram?date=' + encodeURIComponent(date) + '&slide=' + currentSlide + '&v=' + v;
      } else {
        img.src = '/api/preview/instagram?date=' + encodeURIComponent(date) + '&slide=' + currentSlide + '&v=' + v;
      }
      document.getElementById('btnOpenSvg').href = '/api/preview/instagram?date=' + encodeURIComponent(date) + '&slide=' + currentSlide;
      document.getElementById('btnDownloadPng').href = '/api/images/instagram?date=' + encodeURIComponent(date) + '&slide=' + currentSlide;
      document.getElementById('currentSlideNum').innerText = currentSlide;
      renderDots();
      localStorage.setItem('osmu_active_slide', currentSlide);
    }

    function renderDots() {
      const container = document.getElementById('slideDots');
      container.innerHTML = '';
      for (let i = 1; i <= totalSlides; i++) {
        const dot = document.createElement('button');
        dot.innerText = i;
        dot.className = 'dot-btn' + (i === currentSlide ? ' active' : '');
        dot.onclick = () => goToSlide(i);
        container.appendChild(dot);
      }
    }

    function copyText(elemId) {
      const text = document.getElementById(elemId).innerText;
      navigator.clipboard.writeText(text).then(() => {
        alert('\uD074\uB9BD\uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4!');
      });
    }

    function forceRefresh(dateStr) {
      const url = new URL(window.location.href);
      url.searchParams.set('fresh', '1');
      if (dateStr) url.searchParams.set('date', dateStr);
      window.location.href = url.toString();
    }

    function changeDate(d) {
      const url = new URL(window.location.href);
      url.searchParams.set('date', d);
      url.searchParams.delete('fresh');
      window.location.href = url.toString();
    }

    async function publishThreads(dateStr) {
      if (!dateStr || dateStr === '\uAE30\uC900\uC77C\uC790 \uC5C6\uC74C') {
        alert('\uAE30\uC900\uC77C\uC790\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC544 \uBC1C\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
        return;
      }
      let token = getCookie('etf_distributor_auth') || new URLSearchParams(location.search).get('token');
      if (!token) {
        token = prompt('\uC2A4\uB808\uB4DC \uBC1C\uD589\uC744 \uC704\uD574 \uAD00\uB9AC\uC790 \uD1A0\uD070(MANUAL_RUN_TOKEN)\uC744 \uC785\uB825\uD558\uC138\uC694:');
        if (!token) return;
        document.cookie = 'etf_distributor_auth=' + token + '; path=/; max-age=2592000; SameSite=Lax; Secure';
      }
      if (!confirm(dateStr + ' \uB9C8\uCF13 \uBE0C\uB9AC\uD551\uC744 \uC2A4\uB808\uB4DC(@neo.alphareader)\uC5D0 \uC2E4\uC2DC\uAC04 \uC790\uB3D9 \uBC1C\uD589\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
      const btn = event.target;
      btn.disabled = true;
      btn.innerText = '\uC2A4\uB808\uB4DC \uBC1C\uD589 \uCC98\uB9AC \uC911...';

      try {
        const res = await fetch('/api/publish/threads?date=' + encodeURIComponent(dateStr) + '&token=' + encodeURIComponent(token), {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const resText = await res.text();
        let data;
        try {
          data = JSON.parse(resText);
        } catch (jsonErr) {
          throw new Error('\uC11C\uBC84 \uC751\uB2F5 \uC624\uB958 (' + res.status + '): ' + resText.slice(0, 150));
        }
        if (data.success) {
          alert('\uC2A4\uB808\uB4DC \uBC1C\uD589 \uC131\uACF5! (ID: ' + data.publishedPostId + ')');
          location.reload();
        } else {
          alert('\uBC1C\uD589 \uC2E4\uD328: ' + (data.error || JSON.stringify(data)));
          btn.disabled = false;
          btn.innerText = '\u{1F680} \uC774 \uB0B4\uC6A9\uC73C\uB85C \uC2A4\uB808\uB4DC \uC989\uC2DC \uBC1C\uD589';
        }
      } catch (e) {
        alert('\uC694\uCCAD \uC911 \uC624\uB958 \uBC1C\uC0DD: ' + e);
        btn.disabled = false;
        btn.innerText = '\u{1F680} \uC774 \uB0B4\uC6A9\uC73C\uB85C \uC2A4\uB808\uB4DC \uC989\uC2DC \uBC1C\uD589';
      }
    }

    async function publishInstagram(dateStr) {
      if (!dateStr || dateStr === '\uAE30\uC900\uC77C\uC790 \uC5C6\uC74C') {
        alert('\uAE30\uC900\uC77C\uC790\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC544 \uBC1C\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
        return;
      }
      let token = getCookie('etf_distributor_auth') || new URLSearchParams(location.search).get('token');
      if (!token) {
        token = prompt('\uC778\uC2A4\uD0C0\uADF8\uB7A8 \uBC1C\uD589\uC744 \uC704\uD574 \uAD00\uB9AC\uC790 \uD1A0\uD070(MANUAL_RUN_TOKEN)\uC744 \uC785\uB825\uD558\uC138\uC694:');
        if (!token) return;
        document.cookie = 'etf_distributor_auth=' + token + '; path=/; max-age=2592000; SameSite=Lax; Secure';
      }
      if (!confirm(dateStr + ' \uB9C8\uCF13 \uBE0C\uB9AC\uD551\uC744 \uC778\uC2A4\uD0C0\uADF8\uB7A8(@neo.alphareader)\uC5D0 6\uC7A5 \uCE74\uB4DC\uB274\uC2A4\uB85C \uC2E4\uC2DC\uAC04 \uC790\uB3D9 \uBC1C\uD589\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
      const btn = event.target;
      btn.disabled = true;
      btn.innerText = '\uC778\uC2A4\uD0C0\uADF8\uB7A8 \uBC1C\uD589 \uCC98\uB9AC \uC911...';

      try {
        const res = await fetch('/api/publish/instagram?date=' + encodeURIComponent(dateStr) + '&force=true&token=' + encodeURIComponent(token), {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const resText = await res.text();
        let data;
        try {
          data = JSON.parse(resText);
        } catch (jsonErr) {
          throw new Error('\uC11C\uBC84 \uC751\uB2F5 \uC624\uB958 (' + res.status + '): ' + resText.slice(0, 150));
        }
        if (data.success) {
          alert('\uC778\uC2A4\uD0C0\uADF8\uB7A8 \uBC1C\uD589 \uC131\uACF5! (ID: ' + data.publishedPostId + ')');
          location.reload();
        } else {
          alert('\uC778\uC2A4\uD0C0\uADF8\uB7A8 \uBC1C\uD589 \uC2E4\uD328: ' + (data.error || JSON.stringify(data)));
          btn.disabled = false;
          btn.innerText = '\u{1F4F8} \uC774 \uB0B4\uC6A9\uC73C\uB85C \uC778\uC2A4\uD0C0\uADF8\uB7A8 6\uC7A5 \uCE74\uB4DC\uB274\uC2A4 \uC989\uC2DC \uBC1C\uD589';
        }
      } catch (e) {
        alert('\uC694\uCCAD \uC911 \uC624\uB958 \uBC1C\uC0DD: ' + e);
        btn.disabled = false;
        btn.innerText = '\u{1F4F8} \uC774 \uB0B4\uC6A9\uC73C\uB85C \uC778\uC2A4\uD0C0\uADF8\uB7A8 6\uC7A5 \uCE74\uB4DC\uB274\uC2A4 \uC989\uC2DC \uBC1C\uD589';
      }
    }

    let emailViewport = localStorage.getItem('osmu_email_viewport') || 'desktop';
    function setEmailViewport(mode) {
      emailViewport = mode;
      localStorage.setItem('osmu_email_viewport', mode);
      const btnDesk = document.getElementById('btnEmailDesktop');
      const btnMob = document.getElementById('btnEmailMobile');
      const container = document.getElementById('emailFrameContainer');
      if (!btnDesk || !btnMob || !container) return;
      if (mode === 'mobile') {
        container.style.maxWidth = '375px';
        btnMob.style.background = '#059669';
        btnMob.style.color = '#FFFFFF';
        btnDesk.style.background = 'transparent';
        btnDesk.style.color = '#64748B';
      } else {
        container.style.maxWidth = '620px';
        btnDesk.style.background = '#059669';
        btnDesk.style.color = '#FFFFFF';
        btnMob.style.background = 'transparent';
        btnMob.style.color = '#64748B';
      }
    }

    function copyNewsletterField(elementId) {
      const el = document.getElementById(elementId);
      if (!el) return;
      navigator.clipboard.writeText(el.innerText || el.textContent).then(() => {
        alert('\uD074\uB9BD\uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
      }).catch(() => {
        alert('\uBCF5\uC0AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
      });
    }

    async function copyNewsletterHtml(dateStr) {
      try {
        const res = await fetch('/api/preview/newsletter?date=' + encodeURIComponent(dateStr));
        const html = await res.text();
        await navigator.clipboard.writeText(html);
        alert('\uC774\uBA54\uC77C \uB274\uC2A4\uB808\uD130 \uC804\uCCB4 HTML \uC18C\uC2A4\uCF54\uB4DC\uAC00 \uD074\uB9BD\uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (\uC2A4\uD2F0\uBE44/\uBA54\uC77C\uCE68\uD504\uC5D0 \uBC14\uB85C \uBD99\uC5EC\uB123\uAE30 \uAC00\uB2A5)');
      } catch (e) {
        alert('HTML \uBCF5\uC0AC \uC2E4\uD328: ' + e);
      }
    }

    // Restore saved slide, tab and email viewport
    setEmailViewport(emailViewport);
    const savedSlide = parseInt(localStorage.getItem('osmu_active_slide') || '1', 10);
    if (!isNaN(savedSlide) && savedSlide >= 1 && savedSlide <= totalSlides) {
      currentSlide = savedSlide;
    }
    updateModeButtons();
    updateSlide();

    const hashTab = location.hash ? location.hash.replace('#', '') : null;
    const savedTab = hashTab || localStorage.getItem('osmu_active_tab');
    if (savedTab && document.getElementById(savedTab)) {
      document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.getAttribute('onclick').includes(savedTab)) {
          b.click();
        }
      });
    }
  <\/script>
</body>
</html>`;
}
__name(generateDashboardHtml, "generateDashboardHtml");
var workerHandler = {
  // Queue Consumer: prepares assets and saves status as 'ready' (Human-in-the-Loop review)
  async queue(batch, env) {
    for (const message of batch.messages) {
      const event = message.body;
      const targetDate = event.as_of_date;
      try {
        console.log(`[Distributor] Consuming distribution event for ${targetDate} v${event.publication_version}`);
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) {
          console.error(`[Distributor] Payload for ${targetDate} not found in KV.`);
          message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 5)) });
          continue;
        }
        const validation = await validateBriefingPayload(payload, env);
        await env.ETF_PRICES.prepare(
          `CREATE TABLE IF NOT EXISTS briefing_distribution_logs (
            as_of_date TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            details_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`
        ).run();
        let existingStatus = null;
        let existingDetails = {};
        try {
          const row = await env.ETF_PRICES.prepare(
            `SELECT status, details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
          ).bind(targetDate).first();
          if (row) {
            existingStatus = row.status;
            if (row.details_json) {
              try {
                existingDetails = JSON.parse(row.details_json);
              } catch (e) {
              }
            }
          }
        } catch (e) {
          console.warn("[Distributor] Failed to query existing log in queue:", e);
        }
        if (!validation.isSafe) {
          console.error(`[Distributor] Circuit breaker tripped for ${targetDate}:`, validation.reasons);
          existingDetails.reasons = validation.reasons;
          existingDetails.event_id = event.event_id;
          existingDetails.validated = false;
          const nextStatus2 = existingStatus === "distributed" ? "distributed" : "blocked";
          if (existingStatus === "distributed") {
            existingDetails.revision_blocked = true;
          }
          await env.ETF_PRICES.prepare(
            `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
          ).bind(targetDate, nextStatus2, JSON.stringify(existingDetails)).run();
          message.ack();
          continue;
        }
        try {
          await getOrRefineNarrative(payload, env);
        } catch (narrativeErr) {
          console.warn(`[Distributor] Narrative pre-warm warning for ${targetDate}:`, narrativeErr);
        }
        existingDetails.event_id = event.event_id;
        existingDetails.validated = true;
        delete existingDetails.reasons;
        let nextStatus = "ready";
        if (existingStatus === "distributed") {
          nextStatus = "distributed";
          existingDetails.revision_pending = true;
        }
        await env.ETF_PRICES.prepare(
          `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(targetDate, nextStatus, JSON.stringify(existingDetails)).run();
        console.log(`[Distributor] Assets prepared in ${nextStatus} state for ${targetDate}. Awaiting operator review.`);
        message.ack();
      } catch (err) {
        console.error(`[Distributor] Fatal error preparing distribution for ${targetDate}:`, err);
        message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 5)) });
      }
    }
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const targetDate = url.searchParams.get("date") || void 0;
    const baseUrl = env.SITE_BASE_URL || "https://etf-campus.pages.dev";
    const isAuthed = checkAuth(request, env);
    try {
      if (url.pathname.startsWith("/api/publish") || url.pathname.startsWith("/api/distribute") || url.pathname.startsWith("/internal/distribute")) {
        if (!isAuthed) {
          return Response.json({ success: false, error: "Unauthorized: Invalid or missing authentication token." }, { status: 401 });
        }
      }
      if (url.pathname === "/health") {
        return Response.json({
          service: "market-briefing-distributor",
          status: "online",
          version: "1.0.0",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (url.pathname === "/login") {
        return new Response(generateLoginHtml(), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
      if (url.pathname === "/" || url.pathname === "/preview") {
        const isFresh = url.searchParams.get("fresh") === "1";
        const cacheKey = `dashboard:html:v4:${targetDate || "latest"}:${isAuthed ? "authed" : "anon"}`;
        if (!isFresh) {
          try {
            const cachedHtml = await env.BRIEFING_KV.get(cacheKey);
            if (cachedHtml) {
              const resHeaders = new Headers({
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-cache, must-revalidate",
                "X-Dashboard-Cache": "HIT"
              });
              if (url.searchParams.get("token") === env.MANUAL_RUN_TOKEN && env.MANUAL_RUN_TOKEN) {
                resHeaders.set("Set-Cookie", `etf_distributor_auth=${env.MANUAL_RUN_TOKEN}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`);
              }
              return new Response(cachedHtml, { headers: resHeaders });
            }
          } catch (e) {
          }
        }
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) {
          return new Response("Briefing not found for date: " + (targetDate || "latest"), { status: 404 });
        }
        let logStatus = "ready";
        let threadsPublishedId = null;
        let instagramPublishedId = null;
        let logReasons = [];
        try {
          const row = await env.ETF_PRICES.prepare(
            `SELECT status, details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
          ).bind(payload.asOfDate).first();
          if (row) {
            logStatus = row.status;
            if (row.details_json) {
              const parsed = JSON.parse(row.details_json);
              threadsPublishedId = parsed.threads?.publishedPostId || null;
              instagramPublishedId = parsed.instagram?.publishedPostId || null;
              if (parsed.reasons) logReasons = parsed.reasons;
            }
          }
        } catch (e) {
        }
        const validation = await validateBriefingPayload(payload, env);
        if (!validation.isSafe && logReasons.length === 0) {
          logReasons = validation.reasons;
        }
        const narrative = await getOrRefineNarrative(payload, env);
        let availableDates = [payload.asOfDate];
        try {
          const rows = await env.ETF_PRICES.prepare(
            `SELECT DISTINCT as_of_date FROM market_briefings ORDER BY as_of_date DESC LIMIT 10`
          ).all();
          if (rows?.results?.length) {
            availableDates = rows.results.map((r) => r.as_of_date);
          }
        } catch (e) {
          availableDates = [payload.asOfDate].filter(Boolean);
        }
        const html = generateDashboardHtml(
          payload,
          env,
          logStatus,
          threadsPublishedId,
          instagramPublishedId,
          narrative,
          logReasons,
          isAuthed,
          availableDates
        );
        try {
          await env.BRIEFING_KV.put(cacheKey, html, { expirationTtl: 3600 });
        } catch (e) {
        }
        const responseHeaders = new Headers({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, must-revalidate",
          "X-Dashboard-Cache": "MISS"
        });
        if (url.searchParams.get("token") === env.MANUAL_RUN_TOKEN && env.MANUAL_RUN_TOKEN) {
          responseHeaders.set("Set-Cookie", `etf_distributor_auth=${env.MANUAL_RUN_TOKEN}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`);
        }
        return new Response(html, { headers: responseHeaders });
      }
      if (url.pathname === "/api/preview/instagram" || url.pathname === "/api/preview/instagram/caption") {
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) return new Response("Briefing not found", { status: 404 });
        const narrative = await getOrRefineNarrative(payload, env);
        const caption = generateInstagramCaption(payload, narrative);
        if (url.pathname === "/api/preview/instagram/caption" || url.searchParams.get("slide") === "caption") {
          return new Response(caption, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
        const slides = generateInstagramCarousel(payload, baseUrl, narrative);
        const slideParam = url.searchParams.get("slide");
        if (slideParam) {
          const slideNo = parseInt(slideParam, 10);
          const slide = slides.find((s) => s.slideNumber === slideNo) || slides[0];
          const safeSvg = slide.svgContent.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");
          return new Response(safeSvg, {
            headers: {
              "Content-Type": "image/svg+xml; charset=utf-8",
              "Cache-Control": "no-store, no-cache, must-revalidate",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
        return Response.json({ success: true, asOfDate: payload.asOfDate, caption, slides });
      }
      if (url.pathname === "/api/preview/threads-image") {
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) return new Response("Briefing not found", { status: 404 });
        const svg = generateThreadsImageSvg(payload);
        const safeSvg = svg.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");
        return new Response(safeSvg, {
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      if (url.pathname === "/api/images/threads" || url.pathname === "/api/preview/threads-image.png") {
        const payload = await loadBriefingPayload(env, targetDate);
        const date = payload?.asOfDate || targetDate;
        if (!date) {
          return new Response("Missing date parameter for threads image", { status: 400 });
        }
        const key = `image:threads:${date}`;
        const imgBuffer = await env.BRIEFING_KV.get(key, "arrayBuffer");
        if (!imgBuffer) {
          return new Response("PNG image not found in KV", { status: 404 });
        }
        return new Response(imgBuffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      if (url.pathname === "/api/images/instagram" || url.pathname === "/api/preview/instagram.png") {
        const payload = await loadBriefingPayload(env, targetDate);
        const date = payload?.asOfDate || targetDate;
        const slideNo = url.searchParams.get("slide") || "1";
        if (!date) {
          return new Response("Missing date parameter for instagram slide", { status: 400 });
        }
        const key = `image:instagram:${date}:${slideNo}`;
        const imgBuffer = await env.BRIEFING_KV.get(key, "arrayBuffer");
        if (!imgBuffer) {
          return new Response(`PNG slide ${slideNo} not found in KV`, { status: 404 });
        }
        return new Response(imgBuffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      if (url.pathname === "/api/preview/threads") {
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) return new Response("Briefing not found", { status: 404 });
        const narrative = await getOrRefineNarrative(payload, env);
        const posts = generateThreadsThread(payload, baseUrl, narrative);
        return Response.json({ success: true, asOfDate: payload.asOfDate, posts });
      }
      if (url.pathname === "/api/preview/newsletter") {
        const queryDate = !targetDate || targetDate === "latest" ? void 0 : targetDate;
        const payload = await loadBriefingPayload(env, queryDate);
        if (!payload) return new Response("Briefing not found", { status: 404 });
        const narrative = await getOrRefineNarrative(payload, env);
        const newsletter = generateNewsletterHtml(payload, baseUrl, narrative);
        return new Response(newsletter.html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }
        });
      }
      if (url.pathname === "/api/publish/threads") {
        const queryDate = !targetDate || targetDate === "latest" ? void 0 : targetDate;
        const payload = await loadBriefingPayload(env, queryDate);
        if (!payload) return Response.json({ success: false, error: "Briefing not found" }, { status: 404 });
        const publishRes = await publishToThreadsLive(env, payload);
        return Response.json({ ...publishRes, targetDate: payload.asOfDate });
      }
      if (url.pathname === "/api/publish/instagram") {
        const queryDate = !targetDate || targetDate === "latest" ? void 0 : targetDate;
        const force = url.searchParams.get("force") === "true";
        const payload = await loadBriefingPayload(env, queryDate);
        if (!payload) return Response.json({ success: false, error: "Briefing not found" }, { status: 404 });
        const publishRes = await publishToInstagramLive(env, payload, force);
        return Response.json({ ...publishRes, targetDate: payload.asOfDate });
      }
      if (url.pathname === "/internal/distribute" || url.pathname === "/api/distribute") {
        const queryDate = !targetDate || targetDate === "latest" ? void 0 : targetDate;
        const dryRun = url.searchParams.get("dryRun") === "true";
        try {
          const result = await executeDistribution(env, queryDate, dryRun);
          return Response.json(result);
        } catch (err) {
          return Response.json({ success: false, error: String(err) }, { status: 500 });
        }
      }
      return new Response("ETF Campus Market Briefing Distributor Worker. Visit /preview for dashboard.", { status: 200 });
    } catch (err) {
      console.error("[Distributor] Unhandled fetch error:", err);
      return new Response(`Server Error: ${err.message || String(err)}`, { status: 500 });
    }
  }
};
var index_default = workerHandler;
export {
  index_default as default,
  executeDistribution,
  getOrRefineNarrative,
  publishToInstagramLive,
  publishToThreadsLive
};
//# sourceMappingURL=index.js.map
