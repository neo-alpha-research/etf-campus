import fs from "fs";
import path from "path";
import sharp from "sharp";

const STYLE_PROFILES = {
  turtle: {
    animal: "거북이",
    name: "원칙을 지키는 거북이",
    emoji: "🐢",
    tagline: "서두르지 않고 익숙한 기준부터 확인해요",
    punchline: "숫자가 춤을 춰도 내가 정한 점검 날짜가 되기 전엔 움직이지 않습니다.",
    color: "#0d9488",
  },
  owl: {
    animal: "부엉이",
    name: "숫자를 읽는 부엉이",
    emoji: "🦉",
    tagline: "총보수와 괴리율, 거래대금의 숫자를 꼼꼼히 대조해요",
    punchline: "느낌으로 사지 않고 수치로 증명된 종목만 남깁니다.",
    color: "#0284c7",
  },
  squirrel: {
    animal: "다람쥐",
    name: "부지런한 다람쥐",
    emoji: "🐿️",
    tagline: "정해진 날짜마다 착실하게 계좌를 점검해요",
    punchline: "꾸준한 습관이 시장의 폭풍을 이기는 가장 단단한 방패입니다.",
    color: "#d97706",
  },
  dolphin: {
    animal: "돌고래",
    name: "흐름을 타는 돌고래",
    emoji: "🐬",
    tagline: "새로운 테마와 섹터의 물결을 민첩하게 포착해요",
    punchline: "시장의 흐름이 바뀌는 순간, 새로운 기회를 가장 먼저 봅니다.",
    color: "#06b6d4",
  },
  elephant: {
    animal: "코끼리",
    name: "흔들리지 않는 코끼리",
    emoji: "🐘",
    tagline: "단기 소음에 휘둘리지 않고 묵직한 큰 자산에 머물러요",
    punchline: "하루의 등락보다 10년의 자산배분 지도를 더 신뢰합니다.",
    color: "#475569",
  },
  fox: {
    animal: "여우",
    name: "조건을 엮는 여우",
    emoji: "🦊",
    tagline: "거래량·보수·자산군 조건을 영리하게 조합해 최적을 찾아요",
    punchline: "단 하나의 지표에 속지 않고 여러 조건을 입체적으로 교차 검증합니다.",
    color: "#ea580c",
  },
  octopus: {
    animal: "문어",
    name: "원문을 파고드는 문어",
    emoji: "🐙",
    tagline: "투자설명서와 기초지수 방법론까지 꼼꼼하게 읽어내요",
    punchline: "이름만 보지 않고 상품의 진짜 뼈대와 규칙을 원문으로 확인합니다.",
    color: "#9333ea",
  },
  eagle: {
    animal: "독수리",
    name: "거시를 굽어보는 독수리",
    emoji: "🦅",
    tagline: "개별 종목보다 글로벌 매크로와 자산군 간 사이클을 봐요",
    punchline: "나무를 보느라 숲의 방향을 놓치는 실수를 하지 않습니다.",
    color: "#b45309",
  },
  hedgehog: {
    animal: "고슴도치",
    name: "기준을 세우는 고슴도치",
    emoji: "🦔",
    tagline: "연금 적격 여부와 규모 기준을 칼같이 세우고 지켜요",
    punchline: "내 계좌의 방어벽을 먼저 치고, 검증된 ETF만 통과시킵니다.",
    color: "#64748b",
  },
  otter: {
    animal: "수달",
    name: "핵심을 건지는 수달",
    emoji: "🦦",
    tagline: "새로운 시장에서도 중요한 흐름을 가볍게 건져요",
    punchline: "복잡한 수치에 얽매이기보다 간결한 질문으로 핵심만 건져냅니다.",
    color: "#14b8a6",
  },
};

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

function wrapText(text, maxCharsPerLine = 22) {
  const lines = [];
  let currentLine = "";
  for (const char of text) {
    currentLine += char;
    if (currentLine.length >= maxCharsPerLine && (char === " " || char === "를" || char === "을" || char === "에" || char === "도")) {
      lines.push(currentLine.trim());
      currentLine = "";
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  return lines;
}

async function generateOgImages() {
  const outDir = path.resolve("public/images/og/style");
  fs.mkdirSync(outDir, { recursive: true });

  const animalsDir = path.resolve("public/images/animals");

  for (const [slug, profile] of Object.entries(STYLE_PROFILES)) {
    const animalJpgPath = path.join(animalsDir, `${slug}.jpg`);
    if (!fs.existsSync(animalJpgPath)) {
      console.warn(`[OG-Gen] Warning: image not found for ${slug}: ${animalJpgPath}`);
      continue;
    }

    const animalSize = 470;
    const cornerRadius = 32;
    const roundedMask = Buffer.from(
      `<svg width="${animalSize}" height="${animalSize}">
        <rect x="0" y="0" width="${animalSize}" height="${animalSize}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#ffffff"/>
      </svg>`
    );

    const roundedAnimal = await sharp(animalJpgPath)
      .resize(animalSize, animalSize, { fit: "cover" })
      .composite([{ input: roundedMask, blend: "dest-in" }])
      .png()
      .toBuffer();

    const punchlineLines = wrapText(profile.punchline, 24);
    const punchlineSvg = punchlineLines
      .map((line, idx) => `<tspan x="600" dy="${idx === 0 ? 0 : 36}">${escapeXml(line)}</tspan>`)
      .join("");

    const svgOverlay = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#022c22"/>
          <stop offset="60%" stop-color="#064e3b"/>
          <stop offset="100%" stop-color="#041f1e"/>
        </linearGradient>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.03"/>
        </linearGradient>
      </defs>

      <!-- Background with subtle card area -->
      <rect width="1200" height="630" fill="url(#bgGrad)"/>
      <rect x="40" y="40" width="1120" height="550" rx="36" fill="url(#cardGrad)" stroke="#10b981" stroke-opacity="0.25" stroke-width="1.5"/>

      <!-- Animal Image Border Frame -->
      <rect x="75" y="80" width="470" height="470" rx="32" fill="none" stroke="${profile.color}" stroke-opacity="0.6" stroke-width="3"/>

      <!-- Header Label -->
      <rect x="600" y="90" width="280" height="36" rx="18" fill="${profile.color}" fill-opacity="0.25" stroke="${profile.color}" stroke-opacity="0.5" stroke-width="1"/>
      <text x="618" y="114" fill="#a7f3d0" font-size="15" font-weight="bold" font-family="'Pretendard', sans-serif">
        ETF CAMPUS · 나의 투자 스타일
      </text>

      <!-- Animal Title -->
      <text x="600" y="185" fill="#ffffff" font-size="44" font-weight="900" font-family="'Pretendard', sans-serif" letter-spacing="-1.5">
        ${escapeXml(profile.name)}
      </text>

      <!-- Tagline -->
      <text x="600" y="235" fill="#34d399" font-size="20" font-weight="700" font-family="'Pretendard', sans-serif">
        ${escapeXml(profile.tagline)}
      </text>

      <!-- Divider -->
      <line x1="600" y1="265" x2="1100" y2="265" stroke="#ffffff" stroke-opacity="0.15" stroke-width="1"/>

      <!-- Punchline Quote Box -->
      <rect x="585" y="290" width="525" height="150" rx="20" fill="#000000" fill-opacity="0.35" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1"/>
      <text x="605" y="325" fill="#6ee7b7" font-size="14" font-weight="bold" font-family="'Pretendard', sans-serif">
        투자 스타일 명언
      </text>
      <text x="605" y="365" fill="#f1f5f9" font-size="19" font-weight="600" font-family="'Pretendard', sans-serif" letter-spacing="-0.3">
        “${punchlineSvg}”
      </text>

      <!-- Footer Info -->
      <text x="600" y="495" fill="#94a3b8" font-size="15" font-family="'Pretendard', sans-serif">
        🔗 <tspan fill="#38bdf8" font-weight="bold">etf-campus.pages.dev/style/${slug}/</tspan>
      </text>
      <text x="600" y="530" fill="#64748b" font-size="13" font-family="'Pretendard', sans-serif">
        * 교육용 콘텐츠 · 투자권유 아님 · 익명 응답 통계
      </text>
    </svg>
    `;

    await sharp(Buffer.from(svgOverlay))
      .composite([
        {
          input: roundedAnimal,
          left: 75,
          top: 80,
        },
      ])
      .png({ quality: 90 })
      .toFile(path.join(outDir, `${slug}.png`));

    console.log(`[OG-Gen] Generated ${slug}.png (1200x630)`);
  }
  console.log("[OG-Gen] All 10 style OG images generated successfully!");
}

generateOgImages().catch(console.error);
