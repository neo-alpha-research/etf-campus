# 도서·리뷰 스키마 및 라우팅 설계 확정서 (2026-08-27)

## 1. 개요 및 목적
ETF Campus의 '도서·리뷰' 탭을 고도화하여 기존 하드코딩된 외부 도서 목록과 죽은 링크(`#`) 결함을 해소하고, 검증된 학습용 외부 도서 리뷰 스키마, 파서 로더, 상세 라우트(`app/books/review/[slug]`), 크로스셀 퍼널을 안정적으로 구축한다.

---

## 2. 카테고리 단일 기준 (Single Source of Truth)
기존 프론트엔드 UI 화면의 분류 체계와 도메인 일관성을 유지하기 위해 외부 도서 카테고리를 다음 3개로 확정하고 `lib/content/learning-content.ts` 내 상수로 단일 관리한다.

- `초보·입문` (Beginner & Basics)
- `연금·절세` (Pension & Tax-saving / IRP)
- `배당·현금흐름` (Dividend & Cashflow)

> **카테고리 유지 근거**: 이전 Gemini 초안에 있던 `입문/자산배분/연금·절세/마인드셋`은 현행 배포본(`초보·입문/연금·절세/배당·현금흐름`)과 불일치하여 기존 사용자 인지를 왜곡할 위험이 있음. 따라서 현행 3대 카테고리를 유지하고 추후 확장은 상수를 통해 단일 지점에서 관리한다.

---

## 3. `ExternalBook` 스키마 및 네이밍 계약

### 3.1 Frontmatter / 파일 네이밍 규약
- 파일 위치: `content/external-books/`
- 파일명 규칙: `^[LEARNING_EXAMPLE]_([a-z0-9-]+)\.mdx$`
- 헤더 마커: `[LEARNING_EXAMPLE]` 및 `---`
- Frontmatter 키 네이밍: snake_case와 camelCase 모두 허용하여 파서에서 정규화.
- 다중 값 필드: `|` 구분자(예: `tags: #초보자 | #포트폴리오`, `pros: 체계적인 설명 | 직장인 포트폴리오 사례`).

#### Frontmatter 키 정규화 매핑 표
| Frontmatter 키 (snake_case 또는 camelCase) | TypeScript 프로퍼티 (`ExternalBook`) | 변환 및 검증 규칙 |
| --- | --- | --- |
| `one_line_review` / `oneLineReview` | `oneLineReview` | 필수 문자열 (공백 제외 1글자 이상) |
| `irp_eligible` / `irpEligible` | `irpEligible` | boolean 변환 (`true` / `false` / `yes` / `no`) |
| `rating_source` / `ratingSource` | `ratingSource` | 필수 문자열 |
| `review_count` / `reviewCount` | `reviewCount` | 0 이상의 정수 (Number 변환) |
| `affiliate_url` / `affiliateUrl` | `affiliateUrl` | 선택 문자열 |
| `related_internal_link` / `relatedInternalLink` | `relatedInternalLink` | 선택 문자열 (예: `/books/principles-before-products`), 상세 페이지에서 해당 내부 도서 정보 자동 연결 |
| `backtest_ticker` / `backtestTicker` | `backtestTicker` | 선택 문자열 (6자리 숫자 티커, 예: `069500` -> `/etf/069500` 연계) |
| `cover_image` / `coverImage` | `coverImage` | 선택 문자열 (파일명 또는 상대경로, 누락 시 기본 BookOpen 아이콘 폴백) |

### 3.2 TypeScript 타입 정의 (`ExternalBook`)
프론트엔드 컴포넌트는 오직 **카멜 케이스(camelCase)** 프로퍼티만 소비하도록 계약을 고정한다.

```typescript
export const EXTERNAL_BOOK_CATEGORIES = ["초보·입문", "연금·절세", "배당·현금흐름"] as const;
export type ExternalBookCategory = typeof EXTERNAL_BOOK_CATEGORIES[number];

export type ExternalBook = LearningExampleMetadata & {
  kind: "external-book";
  slug: string;
  title: string;
  author: string;
  publisher: string;
  category: ExternalBookCategory;
  tags: string[];
  rating: number; // 0.0 ~ 5.0
  reviewCount: number; // >= 0
  ratingSource: string; // e.g. "인터넷 독자 리뷰 종합 (학습용 샘플)"
  irpEligible: boolean; // IRP/연금계좌 편입/활용 적합 여부
  oneLineReview: string; // 한 줄 총평
  summary: string;
  pros: string[];
  cons: string[];
  coverImage?: string; // 이미지 파일명 또는 상대경로
  affiliateUrl?: string; // 제휴 링크 (선택)
  relatedInternalLink?: string; // 캠퍼스 내부 연계 콘텐츠 경로 (선택)
  backtestTicker?: string; // 백테스트/종목분석 연결 Ticker (선택, 6자리)
  content: string; // 마크다운 본문
};
```

### 3.3 컴플라이언스 메타데이터 (기존 5종 필수)
1. `contentRole`: `"learning-example"` (고정)
2. `exampleType`: `"reading-path" | "scenario" | "briefing-reading-guide"`
3. `scenarioBasis`: `"fictional" | "historical-source-verified"`
4. `asOf`: `"YYYY-MM-DD"` 또는 `"not-applicable"`
5. `sources`: 문자열 (출처 또는 `"not-applicable"`)
6. `isLearningExample`: `true`

---

## 4. 라우팅 및 URL 아키텍처

| 라우트 | 대상 | 렌더링 방식 | 정적 생성 함수 |
| --- | --- | --- | --- |
| `/books` | 도서·리뷰 통합 인덱스 (외부 리뷰 Top 3 + 캠퍼스 오리지널 가이드) | Static (RSC + Client Filters) | - |
| `/books/[slug]` | 캠퍼스 오리지널 가이드 (내부 도서) 상세 | SSG (`output: "export"`) | `loadBooks()` 기반 `generateStaticParams()` |
| `/books/review/[slug]` | 외부 도서 리뷰 상세 | SSG (`output: "export"`) | `loadExternalBooks()` 기반 `generateStaticParams()` |

### 4.1 Slug 충돌 방지 및 안전성 검증
- 기존 내부 도서 slug 목록: `diversification-questions`, `numbers-with-context`, `principles-before-products`
- 내부 도서의 slug에 `review`가 없음을 확인하였으며, 외부 도서는 별도의 `/books/review/[slug]` 서브트리로 분기하여 Next.js 정적 라우팅 충돌(`slug === "review"`)을 원천 방지한다.
- `app/sitemap.ts`에 `loadExternalBooks()`를 연동하여 모든 외부 도서 상세 페이지의 canonical URL(`https://.../books/review/{slug}`)을 사이트맵에 자동 등록한다.

---

## 5. 자산 및 표지 이미지 전략
- 표지 기본 경로: `public/images/books/`
- 상수 정의 위치: `lib/content/learning-content.ts` 내 `BOOK_COVER_BASE_PATH = "/images/books"` 단일 정의.
- 이미지가 없거나 로드 실패 시: Lucide `BookOpen` 아이콘 기반 통일된 플레이스홀더로 폴백.
- R2 전환 시: `BOOK_COVER_BASE_PATH` 상수만 변경하여 마이그레이션 가능하도록 설계.

---

## 6. 결함 방지 및 컴플라이언스 원칙
1. **죽은 링크 원천 제거**: `#` 또는 빈 url을 금지하고 `/books/review/[slug]`로 명확히 바인딩.
2. **평점 및 샘플 고지**: 실제 출간 도서 임의 창작 금지, 샘플 안내 배너 상시 유지, 평점 출처 명시.
3. **제휴 링크 규약**: `rel="sponsored nofollow noopener" target="_blank"` 및 인접 "광고 · 제휴" 뱃지 명기.
4. **Pros/Cons 대칭성**: 동일 가중치 2열 그리드와 함께 긍정/부정 아이콘(`ThumbsUp`, `AlertCircle`)을 병기하여 색각 이상자 및 시각적 대비 보장.
