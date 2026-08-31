/**
 * 📚 ETF Campus - 100% 자동화 도서 큐레이션 스크립트 (Skeleton)
 * 
 * [동작 원리]
 * 1. 알라딘 Open API (Bestseller / ItemSearch) 호출하여 경제/경영 카테고리 실시간 순위 및 메타데이터 수집
 * 2. 도서의 목차, 출판사 서평을 OpenAI / Gemini API (LLM)로 전송하여 "한줄평, Pros & Cons, 요약" 자동 생성
 * 3. 기존의 MDX 파일을 완전히 덮어씌워(Update) 새로운 TOP 3 데이터 반영
 * 4. Github Actions Cron을 통해 매월 1일 자정 자동 실행 (Human-free)
 */

import fs from "fs/promises";
import path from "path";

const CONTENT_DIR = path.join(process.cwd(), "content/external-books");
const ALADIN_TTB_KEY = process.env.ALADIN_TTB_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 1. 카테고리 맵핑 (알라딘 API Category ID 기준)
const CATEGORY_MAP = {
  "초보·입문": { id: 2269, keywords: "재테크 초보, 주식 입문" },
  "연금·절세": { id: 71220, keywords: "연금, 절세, IRP, 노후" },
  "배당·현금흐름": { id: 3176, keywords: "배당, 파이프라인, 현금흐름" },
};

async function fetchTopBooksFromAladin(categoryId: number, limit = 3) {
  console.log(`[API] 알라딘 베스트셀러 카테고리 ${categoryId} 조회 중...`);
  // 실제 API 호출 로직:
  // const url = `http://www.aladin.co.kr/ttb/api/ItemList.aspx?ttbkey=${ALADIN_TTB_KEY}&QueryType=Bestseller&CategoryId=${categoryId}&MaxResults=${limit}&SearchTarget=Book&output=js&Version=20131101`;
  // const response = await axios.get(url);
  // return response.data.item;
  
  // Skeleton 반환
  return [
    { title: "가상 베스트셀러 1", author: "김투자", publisher: "캠퍼스북스", rating: 4.8, reviewCount: 150, isbn: "9781234567890", description: "도서 소개..." }
  ];
}

async function generateAIReview(bookMetadata: any) {
  console.log(`[AI] Gemini API를 통한 큐레이션 리뷰 생성 중: ${bookMetadata.title}`);
  
  const prompt = `
    당신은 ETF Campus의 수석 금융 콘텐츠 큐레이터입니다.
    아래 도서의 소개를 바탕으로 객관적이고 날카로운 리뷰를 작성하세요.
    - 대상 도서: ${bookMetadata.title}
    - 책 소개: ${bookMetadata.description}
    
    반드시 아래 JSON 형식으로만 응답하세요. (마크다운 백틱 없이 순수 JSON만 반환)
    {
      "oneLineReview": "직관적인 핵심 한줄평",
      "pros": ["장점 1"],
      "cons": ["단점이나 유의점 1"],
      "summary": "2~3문장의 요약"
    }
  `;
  
  // Gemini API 호출 로직 (Google AI Studio에서 발급받은 GEMINI_API_KEY 사용)
  // 월 1회 실행이므로 속도보다는 추론 성능이 가장 뛰어난 Pro 최신 버전을 사용합니다.
  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });
      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      return JSON.parse(aiText);
    } catch (error) {
      console.error("Gemini API 호출 실패:", error);
    }
  }

  // API 키가 없거나 실패했을 때의 Skeleton 반환
  return {
    oneLineReview: "AI가 자동 생성한 핵심 한줄평",
    pros: ["AI가 분석한 압도적 장점"],
    cons: ["AI가 분석한 유의점 및 단점"],
    summary: "AI 자동 요약..."
  };
}

async function updateMdxFile(categoryName: string, rank: number, book: any, aiReview: any) {
  const safeTitle = book.title.replace(/\s+/g, '-').toLowerCase();
  const filePath = path.join(CONTENT_DIR, `[LEARNING_EXAMPLE]_${safeTitle}.mdx`);
  
  const mdxContent = `---
kind: 'external-book'
title: '${book.title}'
author: '${book.author}'
publisher: '${book.publisher}'
category: '${categoryName}'
tags: ['AI선정', '베스트셀러']
rating: ${book.rating}
reviewCount: ${book.reviewCount}
ratingSource: 'Aladin/Kyobo'
irpEligible: false
coverImage: '/images/books/${book.isbn}.jpg'
affiliateUrl: 'https://link.coupang.com/a/example'
oneLineReview: '${aiReview.oneLineReview}'
---

### 📖 AI 도서 요약
${aiReview.summary}

### 👍 추천 포인트 (Pros)
- ${aiReview.pros[0]}

### ⚠️ 유의할 점 (Cons)
- ${aiReview.cons[0]}
`;

  await fs.writeFile(filePath, mdxContent, 'utf-8');
  console.log(`[File] ${filePath} 업데이트 완료`);
}

async function runAutomation() {
  if (!ALADIN_TTB_KEY || !GEMINI_API_KEY) {
    console.warn("⚠️ API 키가 누락되어 Skeleton(시뮬레이션) 모드로 실행됩니다.");
  }

  for (const [categoryName, data] of Object.entries(CATEGORY_MAP)) {
    const topBooks = await fetchTopBooksFromAladin(data.id, 3);
    
    let rank = 1;
    for (const book of topBooks) {
      const aiReview = await generateAIReview(book);
      await updateMdxFile(categoryName, rank, book, aiReview);
      rank++;
    }
  }
  
  console.log("✅ 100% 자동화 큐레이션 스크립트 실행 완료");
}

runAutomation().catch(console.error);
