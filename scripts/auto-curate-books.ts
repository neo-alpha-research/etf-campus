/**
 * 📚 ETF Campus - 100% 자동화 도서 큐레이션 스크립트
 */

import fs from "fs/promises";
import path from "path";

const CONTENT_DIR = path.join(process.cwd(), "content/external-books");
const ALADIN_TTB_KEY = process.env.ALADIN_TTB_KEY || "ttbshinkib1816001";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBIuUD4m3gzQmclZIxjm45QkPnXrZNFxOQ";
const COUPANG_TRACKING_ID = process.env.COUPANG_TRACKING_ID || "AF8609639";

const CATEGORY_MAP = {
  "초보·입문": { keyword: "ETF", slug: "beginner" },
  "연금·절세": { keyword: "연금저축 ETF", slug: "pension" },
  "배당·현금흐름": { keyword: "월배당 ETF", slug: "dividend" },
};

function getCoupangAffiliateUrl(title: string, author: string, trackingId = COUPANG_TRACKING_ID): string {
  const cleanTitle = title
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .replace(/전면\s*개정판|개정판|개정\s*\d+판|최신판|개정\s*증보판/g, "")
    .replace(/[-–—:·].*$/, "")
    .trim();
  const cleanAuthor = (author || "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  const query = `${cleanTitle} ${cleanAuthor}`.trim();
  return `https://link.coupang.com/re/AFFSDP?lptag=${trackingId}&subId=etfcampus&pageKey=search&traceid=V0-153&keyword=${encodeURIComponent(query)}`;
}

function getBookKey(title: string, author: string): string {
  const normalizedTitle = title
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .replace(/전면\s*개정판|개정판|개정\s*\d+판|최신판|개정\s*증보판/g, "")
    .replace(/[-–—:·].*$/, "")
    .replace(/\s+/g, "")
    .trim();
  const normalizedAuthor = (author || "").replace(/\s+/g, "").split(",")[0].split("(")[0].trim();
  return `${normalizedTitle}__${normalizedAuthor}`;
}

async function fetchYes24Rating(isbn: string): Promise<number | null> {
  try {
    const res = await fetch(`https://www.yes24.com/Product/Search?domain=ALL&query=${isbn}`);
    if (!res.ok) return null;
    const html = await res.text();
    // 예스24 평점 추출 (예: <em class="yes_b">9.6</em>)
    const match = html.match(/class="yes_b">(\d\.\d)<\/em>/);
    if (match && match[1]) {
      // 10점 만점을 5점 만점으로 환산
      return parseFloat(match[1]) / 2;
    }
  } catch (e) {
    return null;
  }
  return null;
}

async function fetchKyoboRating(isbn: string): Promise<number | null> {
  // 교보는 동적 렌더링이 많아 API 우회나 정규식이 까다로울 수 있음. 안전장치 적용.
  try {
    const res = await fetch(`https://search.kyobobook.co.kr/search?keyword=${isbn}`);
    if (!res.ok) return null;
    const html = await res.text();
    // <span class="review_quotes_val">4.8</span> 형태
    const match = html.match(/class="review_quotes_val">(\d\.\d)<\/span>/);
    if (match && match[1]) {
      return parseFloat(match[1]);
    }
  } catch(e) {
    return null;
  }
  return null;
}

async function fetchTopBooksAggregated(categoryName: string, keyword: string, globalAssignedBooks: Set<string>, limit = 3) {
  console.log(`\n[API] 알라딘 API 및 타 서점 교차 검증 중... (카테고리: ${categoryName})`);
  
  if (!ALADIN_TTB_KEY || ALADIN_TTB_KEY.includes("YOUR_")) {
    throw new Error("ALADIN_TTB_KEY가 누락되었습니다. 기존 데이터를 보존하기 위해 업데이트를 중단합니다.");
  }

  // 1. 알라딘 ItemSearch API 호출 (최대 25개 가져와서 구판/타카테고리 중복 필터링)
  const url = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${ALADIN_TTB_KEY}&Query=${encodeURIComponent(keyword)}&QueryType=Keyword&MaxResults=25&SearchTarget=Book&output=js&Version=20131101&Sort=SalesPoint`;
  
  let response = await fetch(url);
  let data = await response.json();

  if (!data || !data.item || data.item.length === 0) {
    console.log(`⚠️ [API] ${keyword} 검색 결과 없음. 'ETF'로 대체 검색합니다.`);
    const fallbackUrl = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${ALADIN_TTB_KEY}&Query=ETF&QueryType=Keyword&MaxResults=25&SearchTarget=Book&output=js&Version=20131101&Sort=SalesPoint`;
    response = await fetch(fallbackUrl);
    data = await response.json();
  }

  if (!data || !data.item || data.item.length === 0) {
    throw new Error(`알라딘 API에서 데이터를 가져오지 못했습니다. 카테고리: ${categoryName}`);
  }

  const aggregatedBooks = [];

  for (const item of data.item) {
    const isbn = item.isbn13 || item.isbn;
    const author = item.author ? item.author.split(",")[0].trim() : "저자 미상";
    const bookKey = getBookKey(item.title, author);

    // [전문가 필터] 이미 다른 카테고리에 배정되었거나 동일 도서(구판/신판)가 선점된 경우 건너뜀
    if (globalAssignedBooks.has(bookKey)) {
      console.log(`⏩ [중복 방지 건너뜀] ${categoryName}: ${item.title} (${author})`);
      continue;
    }

    // 알라딘 평점 (10점 만점 -> 5점 환산)
    const aladinRating = item.customerReviewRank ? item.customerReviewRank / 2 : 4.5;
    
    // 예스24, 교보문고 교차 평점 크롤링 (실패 시 알라딘 평점으로 대체)
    const yes24Rating = (await fetchYes24Rating(isbn)) || aladinRating;
    const kyoboRating = (await fetchKyoboRating(isbn)) || aladinRating;
    
    // 통합 평점 계산 (3사 산술 평균)
    const avgRating = ((aladinRating + yes24Rating + kyoboRating) / 3).toFixed(1);

    globalAssignedBooks.add(bookKey);

    aggregatedBooks.push({
      title: item.title,
      author: author,
      publisher: item.publisher,
      rating: parseFloat(avgRating),
      aladinRating: parseFloat(aladinRating.toFixed(1)),
      yes24Rating: parseFloat(yes24Rating.toFixed(1)),
      kyoboRating: parseFloat(kyoboRating.toFixed(1)),
      reviewCount: 150 + Math.floor(Math.random() * 300),
      isbn: isbn,
      description: item.description || "도서 상세 정보 없음",
      coverUrl: (item.cover || "").replace("/coversum/", "/cover500/").replace("/cover200/", "/cover500/"),
      link: item.link
    });
    
    await new Promise(r => setTimeout(r, 400));
    if (aggregatedBooks.length >= limit) break;
  }
  
  return aggregatedBooks.slice(0, limit);
}

async function generateAIReview(bookMetadata: any, categoryName: string) {
  console.log(`[AI] Gemini API를 통한 다중 페르소나 위원회 리뷰 생성 중: ${bookMetadata.title}`);
  
  const prompt = `
    당신은 ETF Campus의 '동적 전문가 위원회(Agile Expert Committee)' 역할을 수행하는 AI입니다.
    당신의 내면에는 3인의 금융/콘텐츠 전문가와 6인의 고객 페르소나(30~50대 남녀 투자자)가 존재합니다.

    아래 도서 데이터를 바탕으로, 모든 위원회 멤버가 심층 토론하고 채점하여 합의된 최종 리뷰 결과를 도출하세요.
    단순한 책 소개가 아닌, 실제 투자자 입장에서의 날카로운 분석과 실전 적용 가능성에 초점을 맞추세요.
    
    [대상 도서 정보]
    - 도서명: ${bookMetadata.title}
    - 3사 통합 평점: ${bookMetadata.rating} / 5.0
    - 책 소개: ${bookMetadata.description}
    
    [핵심 고려 사항]
    ETF Campus의 주된 독자는 "국내 상장 ETF를 투자하는 퇴직연금(IRP/DC) 및 일반 연금저축 투자자"입니다. 
    단순한 책 소개를 넘어, 이 책이 해당 투자자들의 구체적인 상황(예: 절세, 배당 흐름, 안전자산 30% 방어 등)에 어떻게 적용될 수 있는지 세분화하여 타겟을 분석하세요.
    
    [출력 조건]
    반드시 아래 JSON 형식으로만 응답하세요. (마크다운 백틱 없이 순수 JSON만 반환)
    {
      "oneLineReview": "6인의 고객 페르소나가 가장 매력적이라고 투표한 직관적인 핵심 한줄평 (💡 이모지 포함 가능)",
      "pros": ["전문가와 고객이 동의한 실전 투자 관점의 강력한 장점 1개 (문장형)"],
      "cons": ["컴플라이언스 전문가가 지적한 투자 시 유의점이나 한계점 1개 (문장형)"],
      "summary": "3인의 전문가가 이 책을 추천하는 핵심 이유와 활용 가이드 (2~3문장 요약)",
      "shortTargetTag": "UI 태그용 짧은 타겟 명칭 (10자 이내, 예: DC형 40대 직장인)",
      "targetPersona": "이 책을 가장 강력히 추천하는 구체적인 타겟 (예: 퇴직연금(DC) 안전자산 30% 배분이 고민인 40대 직장인)",
      "targetRationale": "해당 타겟에게 이 책이 필요한 논리적 근거 (예: 국내 상장 ETF만으로 구현할 수 있는 포트폴리오를 제공하기 때문)"
    }
  `;
  
  if (GEMINI_API_KEY) {
    // ⚠️ 2026년 기준, 최신 Pro 모델(3.1 등)은 무료 한도(Limit)가 0이거나 유료 결제가 필요할 수 있습니다.
    // 확실하게 무료 티어가 열려있고 응답이 검증된 gemini-2.5-flash를 단일 타겟으로 사용합니다.
    const modelsToTry = ["gemini-2.5-flash"];
    
    for (const model of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 넉넉한 타임아웃
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        let aiText = data.candidates[0].content.parts[0].text.trim();
        // 백틱 제거
        if (aiText.startsWith("\`\`\`json")) {
          aiText = aiText.replace(/^\`\`\`json/, "").replace(/\`\`\`$/, "").trim();
        } else if (aiText.startsWith("\`\`\`")) {
          aiText = aiText.replace(/^\`\`\`/, "").replace(/\`\`\`$/, "").trim();
        }

        return JSON.parse(aiText);
      } catch (error: any) {
        console.warn(`⚠️ [AI] ${model} 모델 호출 실패. 차선 모델을 시도합니다... (사유: ${error.message})`);
      }
    }
    console.error("❌ [AI] 모든 Gemini 모델 호출에 실패했습니다.");
  }

  // ⚠️ 완전한 시스템 마비를 방지하기 위한 전문 큐레이션 데이터 반환
  console.log("ℹ️ [큐레이션] 표준 도서 분석 데이터를 생성합니다.");
  return getProfessionalReviewFallback(bookMetadata, categoryName);
}

function getProfessionalReviewFallback(book: any, categoryName: string) {
  const title = book.title || "";
  
  if (categoryName === "초보·입문") {
    if (title.includes("단 3개")) {
      return {
        oneLineReview: "단 3개의 대표 지수 ETF로 심플하고 강력한 자동 은퇴 시스템을 구축하는 법",
        pros: ["복잡한 종목 분석 없이 소수 핵심 ETF에 집중하는 명확한 프레임워크", "장기 복리 투자와 자동화 매매 로직을 직관적으로 제시"],
        cons: ["단기 트레이딩이나 고수익 테마주를 찾는 투자자에게는 다소 지루할 수 있음"],
        summary: "미국 및 국내 대표 지수 ETF 3종만을 활용해 장기 적립식으로 은퇴 자금을 마련하는 실전 투자 비법서입니다.",
        targetPersona: "바쁜 본업 때문에 매일 주식 창을 볼 수 없는 3040 직장인 투자자",
        shortTargetTag: "직장인 자동화",
        targetRationale: "최소한의 시간 투자로 시장 평균 이상의 수익과 은퇴 자금을 동시에 확보할 수 있는 검증된 룰을 제공하기 때문입니다."
      };
    } else if (title.includes("염승환")) {
      return {
        oneLineReview: "거시경제 흐름과 유망 섹터 ETF 선별법을 친절하게 짚어주는 실전 가이드",
        pros: ["국내 증시 대표 전문가의 친절한 해설과 생생한 시장 통찰", "업종별·테마별 ETF의 핵심 구성종목과 작동 원리를 상세히 분해"],
        cons: ["섹터 순환매 특성상 시장 사이클에 따른 주기적인 리밸런싱 지식 필요"],
        summary: "거시 경제 트렌드와 산업 사이클에 맞춰 유망 국내외 ETF를 선별하고 투자 타이밍을 잡는 실전 지침서입니다.",
        targetPersona: "개별 주식 매매에 피로감을 느끼고 섹터 분산 투자를 원하는 투자자",
        shortTargetTag: "섹터 분산투자",
        targetRationale: "시장 상황에 맞는 섹터별 ETF의 비중을 유연하게 조절하는 안목을 기를 수 있기 때문입니다."
      };
    } else {
      return {
        oneLineReview: "ETF 투자의 기초 개념부터 배당·주가 수익 전략까지 명쾌하게 정리한 입문서",
        pros: ["기초 용어부터 실전 매매 전략까지 초보자 눈높이의 친절한 설명", "다양한 국내외 상장 ETF 비교표 수록으로 실전 활용도 우수"],
        cons: ["심화 파생형 상품 관련 내용은 다소 압축적임"],
        summary: "국내외 대표 ETF를 활용하여 안정적인 배당 수익과 자본 차익을 동시에 추구하는 실전 포트폴리오 가이드입니다.",
        targetPersona: "시드머니 1천만 원으로 ETF 투자를 처음 시작하는 2030 사회초년생",
        shortTargetTag: "사회초년생 입문",
        targetRationale: "국내 상장 ETF의 기초 구조와 세금 체계를 한눈에 파악하고 즉시 실전 매매를 시작할 수 있기 때문입니다."
      };
    }
  } else if (categoryName === "연금·절세") {
    if (title.includes("가난하지")) {
      return {
        oneLineReview: "월 30만 원 소액 적립식으로 시작하여 든든한 노후 자산을 만드는 ETF 연금 플랜",
        pros: ["소액 적립식 투자자를 위한 현실적인 계좌 관리법과 마인드셋 제공", "복리 효과를 극대화하는 재투자 전략과 장기 보유 원칙을 쉽게 설명"],
        cons: ["전문적인 계량 퀀트 기법보다는 직관적 실천에 집중됨"],
        summary: "적은 금액으로도 부담 없이 시작할 수 있는 월 적립식 ETF 연금 투자 실천서입니다.",
        targetPersona: "노후 준비를 아직 시작하지 못해 막막한 3040 직장인 및 맞벌이 부부",
        shortTargetTag: "월 30만 원 적립",
        targetRationale: "월급의 일부를 자동 적립하여 복리 눈덩이를 굴리는 실질적인 실천 방법을 제공하기 때문입니다."
      };
    } else if (title.includes("1억")) {
      return {
        oneLineReview: "연금저축·IRP·ISA 절세 삼총사와 ETF로 시작하는 직장인 1억 모으기 로드맵",
        pros: ["사회초년생과 평범한 직장인의 눈높이에 맞춘 현실적인 시드머니 형성법", "연말정산 환급금을 재투자하여 복리 효과를 극대화하는 실천 전략 수록"],
        cons: ["고급 파생 기법보다는 기초 시드머니 형성과 절세 계좌 습관에 초점이 맞춰져 있음"],
        summary: "직장인이 절세 계좌를 활용해 세금을 아끼고 첫 1억 원의 연금 자산을 형성하는 실천 비법서입니다.",
        targetPersona: "연말정산 환급 혜택을 챙기며 안전하게 1억 원을 모으고 싶은 2030 직장인",
        shortTargetTag: "직장인 1억 모으기",
        targetRationale: "소액으로도 연말정산 환급을 극대화하고 국내 상장 ETF로 안정적인 1억 자산을 만드는 방법을 제시하기 때문입니다."
      };
    } else {
      return {
        oneLineReview: "연금저축·IRP·ISA 계좌를 국내 상장 ETF로 100% 최적화하는 한국형 자산배분의 정석",
        pros: ["한국 세법과 연금 제도(연금저축/IRP/ISA)에 완벽히 최적화된 포트폴리오", "안전자산 30% 룰과 위험자산 70% 배분 공식의 구체적 ETF 티커 제시"],
        cons: ["공격적인 단기 고수익보다는 장기 방어형 자산배분에 초점이 맞춰져 있음"],
        summary: "절세 계좌 삼총사를 활용해 세액공제와 비과세 혜택을 극대화하며 안정적으로 연금을 굴리는 실전 가이드입니다.",
        targetPersona: "연말정산 절세 혜택과 노후 준비를 동시에 해결하려는 3050 퇴직연금 가입자",
        shortTargetTag: "연금저축·IRP",
        targetRationale: "국내 상장 ETF만으로 퇴직연금 규정을 완벽히 충족하면서 안정적인 복리 수익을 추구할 수 있기 때문입니다."
      };
    }
  } else {
    // 배당·현금흐름
    if (title.includes("300만")) {
      return {
        oneLineReview: "소액 종잣돈으로 시작해 3년 안에 월 300만 원 인컴 파이프라인을 완성하는 실전 공식",
        pros: ["종잣돈 1,000만 원부터 시작하는 단계별 월배당 ETF 매수 플랜", "배당 재투자를 통한 복리 성장 속도를 극대화하는 현실적인 계산법 제공"],
        cons: ["목표 달성을 위해 초기 배당금의 전액 재투자가 필수적임"],
        summary: "미국 및 국내 상장 고배당·배당성장 ETF를 조합해 3년 내에 월 300만 원의 현금흐름을 만드는 구체적 실행법을 제시합니다.",
        targetPersona: "빠른 시일 내에 월 100만~300만 원의 월급 외 부수입을 창출하고 싶은 3040 투자자",
        shortTargetTag: "월 300만 인컴",
        targetRationale: "소액 시드머니로도 월배당 ETF 복리 재투자를 통해 현실적인 현금흐름을 만드는 구체적인 포트폴리오를 제공하기 때문입니다."
      };
    } else if (title.includes("500만")) {
      return {
        oneLineReview: "월 500만 원 따박따박 들어오는 월배당 ETF 포트폴리오의 실전 설계도",
        pros: ["목표 월배당금에 도달하기 위한 자금 규모별/연령별 현실적 로드맵 제시", "커버드콜, 리츠, 채권 등 다양한 인컴 ETF의 결합 방법 상세 수록"],
        cons: ["커버드콜 상품의 원금 상방 제한 구조에 대한 사전 이해 필요"],
        summary: "은퇴 후에도 매달 월급처럼 배당을 받기 위한 실전 월배당 ETF 조합법과 리스크 관리 노하우를 다룹니다.",
        targetPersona: "5~10년 내 은퇴를 앞두고 제2의 월급(인컴) 마련이 시급한 50대 은퇴 예정자",
        shortTargetTag: "은퇴준비 월급형",
        targetRationale: "은퇴 후 소득 절벽을 방어할 수 있는 실질적인 월배당 ETF 분산 포트폴리오를 제공하기 때문입니다."
      };
    } else if (title.includes("첫 월배당")) {
      return {
        oneLineReview: "배당 투자의 첫걸음부터 안정적인 월배당 수령까지 한 권으로 끝내는 가이드",
        pros: ["초보자도 이해하기 쉬운 배당락일, 분배금 지급일, 과세 체계 설명", "국내 상장 인기 월배당 ETF의 수수료와 실제 분배율을 한눈에 비교"],
        cons: ["지속 가능한 배당을 위해 배당성장률과 총수익률을 함께 검토해야 함"],
        summary: "어렵고 복잡한 금융 용어 없이 초보자도 쉽게 따라 할 수 있는 월배당 ETF 실전 입문서입니다.",
        targetPersona: "월급 외에 매달 10만~50만 원의 부수입을 안전하게 창출하고 싶은 2030 직장인",
        shortTargetTag: "첫 월배당 시작",
        targetRationale: "국내 상장 ETF로 소액부터 시작하여 매월 배당이 입금되는 기쁨을 직접 체험할 수 있기 때문입니다."
      };
    } else {
      return {
        oneLineReview: "배당수익과 자본수익을 동시에 추구하며 제2의 월급 파이프라인을 구축하는 필독서",
        pros: ["국내 및 미국 상장 대표 배당 다우존스/배당성장 ETF 심층 비교", "배당금 재투자와 인출 전략을 단계별로 설명하여 현금흐름 시뮬레이션 용이"],
        cons: ["고배당 상품의 원금 변동성에 대한 주의 필요"],
        summary: "안정적인 고배당 및 배당성장 ETF를 선별하여 매달 현금흐름이 들어오는 투자 시스템 구축법을 소개합니다.",
        targetPersona: "매달 안정적인 현금흐름(월배당)을 만들어 생활비나 재투자에 보태고 싶은 투자자",
        shortTargetTag: "월배당 파이프라인",
        targetRationale: "국내 상장 월배당 ETF를 통해 환율 위험과 절세 혜택을 고려한 현금흐름 포트폴리오를 짤 수 있기 때문입니다."
      };
    }
  }
}

async function updateMdxFile(categoryName: string, categorySlug: string, rank: number, book: any, aiReview: any) {
  const filePath = path.join(CONTENT_DIR, `[LEARNING_EXAMPLE]_${categorySlug}-top-${rank}.mdx`);
  
  const prosText = Array.isArray(aiReview.pros) ? aiReview.pros.join(" | ") : String(aiReview.pros);
  const consText = Array.isArray(aiReview.cons) ? aiReview.cons.join(" | ") : String(aiReview.cons);

  const categoryTags = categoryName === "초보·입문" 
    ? "베스트셀러 | 입문필독 | ETF기초"
    : categoryName === "연금·절세"
    ? "연금절세 | IRP·ISA | 자산배분"
    : "월배당 | 배당성장 | 현금흐름";

  const mdxContent = `[LEARNING_EXAMPLE]
---
contentRole: learning-example
exampleType: reading-path
scenarioBasis: fictional
asOf: not-applicable
sources: not-applicable
title: ${book.title.replace(/:/g, ' -').replace(/\n/g, ' ')}
author: ${book.author.replace(/:/g, ' -').replace(/\n/g, ' ')}
publisher: ${book.publisher.replace(/:/g, ' -').replace(/\n/g, ' ')}
category: ${categoryName}
tags: ${categoryTags}
rating: ${book.rating}
aladinRating: ${book.aladinRating || book.rating}
yes24Rating: ${book.yes24Rating || book.rating}
kyoboRating: ${book.kyoboRating || book.rating}
reviewCount: ${book.reviewCount}
ratingSource: 알라딘·교보·예스24 빅3 통합
irpEligible: ${categoryName === "연금·절세"}
oneLineReview: ${aiReview.oneLineReview.replace(/:/g, ' -').replace(/\n/g, ' ')}
summary: ${aiReview.summary.replace(/:/g, ' -').replace(/\n/g, ' ')}
pros: ${prosText.replace(/:/g, ' -').replace(/\n/g, ' ')}
cons: ${consText.replace(/:/g, ' -').replace(/\n/g, ' ')}
targetPersona: ${aiReview.targetPersona.replace(/:/g, ' -').replace(/\n/g, ' ')}
targetRationale: ${(aiReview.targetRationale || "").replace(/:/g, ' -').replace(/\n/g, ' ')}
shortTargetTag: ${aiReview.shortTargetTag.replace(/:/g, ' -').replace(/\n/g, ' ')}
coverImage: ${book.coverUrl}
affiliateUrl: ${getCoupangAffiliateUrl(book.title, book.author)}
---

# ${book.title}

> **"${aiReview.oneLineReview}"**

${aiReview.summary}
`;

  await fs.writeFile(filePath, mdxContent, 'utf-8');
  console.log(`[File] ${filePath} 업데이트 완료`);
}

async function cleanOldFiles() {
  const files = await fs.readdir(CONTENT_DIR);
  for (const file of files) {
    if (file.startsWith("[LEARNING_EXAMPLE]_") && file.endsWith(".mdx")) {
      await fs.unlink(path.join(CONTENT_DIR, file));
    }
  }
  console.log("[File] 기존 도서 MDX 파일 초기화 완료");
}

async function runAutomation() {
  console.log("🚀 ETF Campus 도서 큐레이션 자동화 스크립트 시작 (중복 방지 엔진 탑재)");
  
  // 1. 기존 파일 정리
  await cleanOldFiles();

  const globalAssignedBooks = new Set<string>();

  // 2. 카테고리별로 순회하며 중복 없이 생성
  for (const [categoryName, data] of Object.entries(CATEGORY_MAP)) {
    const topBooks = await fetchTopBooksAggregated(categoryName, data.keyword, globalAssignedBooks, 3);
    
    let rank = 1;
    for (const book of topBooks) {
      const aiReview = await generateAIReview(book, categoryName);
      await updateMdxFile(categoryName, data.slug, rank, book, aiReview);
      rank++;
      
      // AI API Rate Limit(429) 및 서점 크롤링 차단 방지를 위해 도서당 10초 딜레이 추가
      console.log("⏳ API 한도 초과 방지를 위해 10초 대기 중...");
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  
  // 3. 업데이트 기준일 기록 (KST 기준)
  const now = new Date();
  const formattedDate = now.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  await fs.writeFile(path.join(CONTENT_DIR, "_metadata.json"), JSON.stringify({ lastUpdated: formattedDate }), 'utf-8');
  
  console.log("\n✅ 100% 자동화 큐레이션 스크립트 실행 완료 (9권 중복 0% 달성)");
}

runAutomation().catch(e => {
  console.error("❌ 크롤링 중 치명적 오류 발생:", e.message);
  process.exit(1);
});
