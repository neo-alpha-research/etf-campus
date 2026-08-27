/**
 * 도서 및 전자책 제휴 마케팅 링크 중앙 관리 설정
 * 운영자 쿠팡 파트너스 / 예스24 / 크티 링크를 한곳에서 손쉽게 수정 및 관리할 수 있습니다.
 */

export interface AffiliateBookConfig {
  slug: string;
  title: string;
  coupangUrl?: string;
  yes24Url?: string;
  cteeUrl?: string;
  partnerNotice?: string;
}

export const AFFILIATE_BOOK_CONFIGS: Record<string, AffiliateBookConfig> = {
  // === 1. 캠퍼스 오리지널 3부작 (크티 CTEE 공식 스토어) ===
  "momentum-etf-system": {
    slug: "momentum-etf-system",
    title: "감정을 끄고 시스템으로 ① 모멘텀",
    cteeUrl: "https://ctee.kr/item/store/99321",
    partnerNotice: "크티(CTEE) 공식 스토어에서 159쪽 본문과 부록 5종을 즉시 다운로드하여 평생 소장할 수 있습니다.",
  },
  "index-asset-allocation": {
    slug: "index-asset-allocation",
    title: "감정을 끄고 시스템으로 ② 지수·자산배분",
    cteeUrl: "https://ctee.kr",
    partnerNotice: "출간 준비 중인 도서입니다.",
  },
  "dividend-cashflow": {
    slug: "dividend-cashflow",
    title: "감정을 끄고 시스템으로 ③ 배당·현금흐름",
    cteeUrl: "https://ctee.kr",
    partnerNotice: "출간 준비 중인 도서입니다.",
  },

  // === 2. 초보·입문 Top 3 (쿠팡 파트너스 / 예스24) ===
  "the-little-book-of-common-sense-investing": {
    slug: "the-little-book-of-common-sense-investing",
    title: "존 보글의 모든 주식을 소유하라",
    coupangUrl: "https://link.coupang.com/a/bBoGLe",
  },
  "etf-blindly-follow": {
    slug: "etf-blindly-follow",
    title: "ETF 투자 무작정 따라하기",
    coupangUrl: "https://link.coupang.com/a/bBoGLf",
  },
  "the-four-pillars-of-investing": {
    slug: "the-four-pillars-of-investing",
    title: "투자의 네 기둥",
    coupangUrl: "https://link.coupang.com/a/bBoGLg",
  },

  // === 3. 연금·절세 Top 3 (쿠팡 파트너스 / 예스24) ===
  "magic-pension-allocation": {
    slug: "magic-pension-allocation",
    title: "마법의 연금 굴리기",
    coupangUrl: "https://link.coupang.com/a/bBoGLh",
  },
  "parkgomhee-pension-class": {
    slug: "parkgomhee-pension-class",
    title: "박곰희 연금 부자 수업",
    coupangUrl: "https://link.coupang.com/a/bBoGLi",
  },
  "three-us-etfs-retirement": {
    slug: "three-us-etfs-retirement",
    title: "단 3개의 미국 ETF로 은퇴하라",
    coupangUrl: "https://link.coupang.com/a/bBoGLj",
  },

  // === 4. 배당·현금흐름 Top 3 (쿠팡 파트너스 / 예스24) ===
  "dividends-dont-lie": {
    slug: "dividends-dont-lie",
    title: "절대로 배당은 거짓말하지 않는다",
    coupangUrl: "https://link.coupang.com/a/bBoGLk",
  },
  "us-dividend-etf-investing": {
    slug: "us-dividend-etf-investing",
    title: "잠든 사이 월급 버는 미국 배당주 투자",
    coupangUrl: "https://link.coupang.com/a/bBoGLl",
  },
  "monthly-dividend-etf-bible": {
    slug: "monthly-dividend-etf-bible",
    title: "100세까지 월 500만 원 받는 ETF 연금 수업",
    coupangUrl: "https://link.coupang.com/a/bBoGLm",
  },
};

/**
 * 슬러그에 해당하는 최적의 제휴 링크 반환
 */
export function getAffiliateUrl(slug: string): string | undefined {
  const config = AFFILIATE_BOOK_CONFIGS[slug];
  if (!config) return undefined;
  return config.cteeUrl || config.coupangUrl || config.yes24Url;
}
