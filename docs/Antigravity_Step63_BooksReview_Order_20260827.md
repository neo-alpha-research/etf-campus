# Antigravity 지시: 도서·리뷰 탭 고도화 (9인 페르소나 게이트 무중단 실행)

작성일: 2026-08-27
발신: EVS Navigator
용도: 아래 `=== 전달 시작 ===` 부터 `=== 전달 끝 ===` 사이의 전문을 그대로 Antigravity에 붙여넣으십시오.
근거: Gemini 3.1 Pro 리뷰 초안 + 저장소 실사(2026-08-27)

---

=== 전달 시작 ===

# 지시: ETF Campus '도서·리뷰' 탭 고도화 — 7단계 무중단 실행

당신은 `D:\ETFCampus` 저장소를 담당하는 시니어 Cloudflare/Next.js 엔지니어이자, 9인 평가 패널을 동시에 시뮬레이션하는 검수자입니다.
**각 단계를 구현 → 9인 채점 → 개선 → 재채점 → 게이트 통과 → 다음 단계 순서로, 질문 없이 끝까지 진행하십시오.**

## 0. 절대 규칙

1. **무중단**: 중간에 질문하거나 승인을 기다리지 마십시오. 판단이 갈리면 "§2 확정 결정"과 "§3 폐기 목록"을 근거로 스스로 결정하고, 결정 사유를 보고서에 1줄로 남기십시오.
2. **증분 편집**: 기존 파일을 통째로 덮어쓰거나 `touch`로 비운 뒤 새로 쓰지 마십시오. 필요한 최소 라인만 정밀 수정하십시오. `mkdir -p` + `touch` 로 기존 파일을 초기화하는 스크립트는 실행 금지입니다.
3. **API/데이터 계약 보존**: 기존 `loadBooks()`, `findBook()`, `Book` 타입, `app/books/[slug]` 라우트, `app/sitemap.ts` 소비 구조를 깨뜨리지 마십시오.
4. **테스트 필수**: 신규 실행 경로마다 vitest 테스트를 작성하고, 매 단계 종료 시 `npm run lint` → `npm test` → `npm run build` 3종을 모두 통과시키십시오. 하나라도 실패하면 그 단계는 미통과입니다.
5. **작업 브랜치**: `feature/books-review-v2` 브랜치에서 작업하고 단계별로 커밋하십시오. `main` 직접 커밋·머지는 금지입니다.
6. **보고**: 매 단계 보고서 하단에 `git diff --stat` 출력을 반드시 포함하십시오.
7. **인코딩**: 모든 소스는 UTF-8(BOM 없음)이어야 합니다. `npm test`가 `verify:utf8`을 먼저 실행합니다.

## 1. 먼저 읽고 사실을 확인하십시오 (STEP 0)

아래는 2026-08-27 기준 저장소 실사 결과입니다. **코드를 쓰기 전에 이 파일들을 직접 열어 사실을 재확인하십시오.**

| 항목 | 현재 사실 |
| --- | --- |
| 목록 페이지 | `app/books/page.tsx` — 서버 컴포넌트. `<ExternalBooksIndex />`(props 없음) + `<BooksIndex books={loadBooks()} />` 2단 구성. 상단에 "🚧 임시 샘플 데이터" 안내 배너 존재 |
| 외부 도서 목록 | `components/learning/external-books-index.tsx` — `"use client"`, `MOCK_EXTERNAL_BOOKS` 4건이 **컴포넌트 안에 하드코딩**. 카테고리는 `초보·입문 / 연금·절세 / 배당·현금흐름` 3종, 탭별 Top 3만 노출 |
| 치명 결함 | 위 카드의 "리뷰 상세 보기" 링크가 `href={book.url \|\| "#"}` → **모든 외부 도서 상세가 죽은 링크**. 외부 도서 상세 라우트 자체가 없음 |
| 내부 도서 상세 | `app/books/[slug]/page.tsx` — `generateStaticParams()` + `findBook()` 기반. 이미 동적 라우트를 SSG로 정상 처리 중 |
| 데이터 로더 | `lib/content/learning-content.ts` — **gray-matter/YAML 아님**. `[LEARNING_EXAMPLE]` 마커 + `---` 사이를 `key: value` 한 줄씩 수동 파싱, 리스트는 `\|` 구분자. 파일명 규칙 `^\[LEARNING_EXAMPLE\]_([a-z0-9-]+)\.mdx$` |
| 컴플라이언스 메타 | 모든 학습 콘텐츠에 `contentRole / exampleType / scenarioBasis / asOf / sources` 필수. 위반 시 빌드 타임 throw |
| 기존 테스트 함정 | `lib/content/__tests__/learning-content.test.ts` 가 `books).toHaveLength(3)` 과 `!book.affiliateUrl` 을 **고정**하고 있음. 콘텐츠를 추가하면 즉시 실패 → 테스트를 함께 갱신해야 함 |
| 마크다운 렌더러 | `components/markdown/markdown-content.tsx` — `react-markdown` + `remark-gfm`, **`skipHtml` 활성**. 본문에 HTML/JSX 주입 불가 |
| 의존성 | `next-mdx-remote` **미설치**. `next 16.2.10`, `react 19.2.7`, `lucide-react`, `swr`, `react-markdown`. `gray-matter`는 devDependency |
| 빌드 제약 | `next.config.ts`: `output: "export"`, `trailingSlash: true`, `images.unoptimized: true` |
| SEO | `app/sitemap.ts` 가 `loadBooks()` 로 `/books/{slug}` 를 등록 중. 신규 라우트는 여기에 반드시 추가 |
| 디자인 토큰 | 기존 컴포넌트는 `text-strong / text-muted / border-line / bg-surface / brand-*` 토큰과 `chip`, `page-shell`, `eyebrow` 유틸을 사용. 파일명은 kebab-case |

## 2. 운영자 확정 결정 (변경 금지)

1. **렌더링 계층**: `next-mdx-remote` 도입 **금지**. 기존 `lib/content/learning-content.ts` 파서를 **증분 확장**하고 본문은 `MarkdownContent`로 렌더링합니다. 백테스트 차트 등 인터랙티브 요소는 본문 주입이 아니라 **frontmatter 필드 + 상세 페이지의 지정된 슬롯 컴포넌트**로 처리하십시오.
2. **표지 이미지**: Cloudflare R2 도입 **보류**. `public/images/books/` 에 두고 `/images/books/{filename}` 로 참조합니다. 다만 경로 상수는 `lib/content/` 한 곳에서만 정의해 훗날 R2로 갈아끼울 수 있게 하십시오. 표지 파일이 없으면 기존 `BookOpen` 아이콘 플레이스홀더로 폴백합니다.
3. **데이터 성격**: 이번 단계에서는 **실제 출간 도서를 넣지 않습니다.** 스키마·로더·UI·라우트·테스트만 완성하고, 콘텐츠는 기존과 동일하게 `[LEARNING_EXAMPLE]` 샘플을 유지하며 "임시 샘플 데이터" 안내 배너도 **삭제하지 마십시오.** 실존 도서명·저자·평점·제휴 링크를 임의로 창작해 넣는 것은 금지입니다.

## 3. Gemini 초안에서 폐기할 것 (그대로 쓰면 즉시 실패)

아래는 참고 초안의 결함입니다. **복사·붙여넣기 금지**이며, 재구현하십시오.

1. JSX 속성이 문자열 리터럴로 작성됨 — `href="{link}"`, `src="{\`${R2_BASE_URL}/...\`}"`, `alt="{book.title}"`, `height="{450}"`. 전부 중괄호 표현식이어야 합니다.
2. `R2_BASE_URL` 기본값에 마크다운 링크 문법 `[https://...](...)` 가 섞여 있어 URL이 깨집니다.
3. `lib/types.ts`, `lib/mdx.ts` 신설 — 기존 `lib/content/` 규약과 이원화됩니다. 타입은 `lib/content/learning-content.ts` 에 함께 둡니다.
4. `next-mdx-remote/rsc` 사용 — 미설치이며 §2-1로 폐기.
5. `mkdir -p` + `touch` 로 파일을 비우는 초기화 스크립트 — 증분 편집 원칙 위반.
6. 카테고리 상수 `입문/자산배분/연금·절세/마인드셋` — 현행 화면(`초보·입문/연금·절세/배당·현금흐름`)과 불일치. 카테고리 변경이 필요하다고 판단하면 STEP 1 보고서에 근거를 적고 **한 곳(상수 파일)에서만** 정의하십시오.
7. `slate/emerald/blue-50` 하드코딩 — 프로젝트 디자인 토큰 체계 이탈.
8. 컴포넌트 파일명 `BookDetail.tsx` — 현행 kebab-case 규약 위반.

**단, 초안의 개선 방향 4가지는 채택합니다**: ① `irp_eligible` 배지, ② `one_line_review`(한 줄 총평) 상단 배치, ③ Pros/Cons 시각적 대칭 + 아이콘 병기(색상 단독 의존 금지), ④ 크로스셀 배너를 본문 최하단이 아니라 Pros/Cons 요약 직후로 상향.

## 4. 평가 패널 9인 (매 단계 채점)

**전문가 3인**

1. **웹 디자이너(UI/UX)** — 가독성, 정보 계층, 모바일 터치 타깃(최소 44px), 반응형, 색상 외 보조 기표, 다크/라이트 대비, 디자인 토큰 준수.
2. **데이터 아키텍트** — 스키마 확장성, 파서 오류 메시지 품질, SSG 빌드 안정성, 타입 안전성, 테스트 커버리지, 경로 상수 단일화.
3. **마케팅 전문가(수익화)** — 크로스셀 퍼널 위치와 문구, 제휴 링크 표기, 메타데이터/구조화 데이터, 내부 링크 구조, 이탈 지점 방어.

**고객 6인 (3050 직장인)**

4. **A · 30대 초반 주린이** — 용어 난이도, 별점 가시성, 첫 화면에서 "이게 나에게 맞는 책인가" 판단 가능 여부.
5. **B · 40대 중반 퇴직연금 관심자** — IRP/연금계좌 적용 가능 여부가 목록 단계에서 보이는가.
6. **C · 50대 초반 자산배분가** — 카드 여백·글자 크기, 배당/자산배분 카테고리 탐색성.
7. **D · 30대 후반 바쁜 직장인** — 1분 안에 결론(살지 말지)에 도달하는가. 한 줄 총평의 위치와 밀도.
8. **E · 40대 초반 비판적 투자자** — Cons가 Pros와 동등한 무게인가. 평점 근거와 샘플 여부가 정직하게 표시되는가.
9. **F · 30대 중반 행동주의자** — 리뷰에서 캠퍼스 내부 도구(스크리너·비교·백테스트)로 이어지는 실행 경로가 있는가.

### 채점 규칙 (반드시 준수)

- 각 페르소나가 **10점 만점, 소수점 첫째 자리**로 채점합니다.
- **게이트: 9인 평균 ≥ 9.5 AND 개별 최저점 ≥ 9.0.**
- **1차 채점에서는 만점 금지.** 각 단계 1차 채점에서 최소 3건 이상의 실질적 결함(파일·라인 지목)을 반드시 적발하고, 평균이 9.5를 넘더라도 그 결함을 먼저 수정한 뒤 재채점하십시오. 근거 없는 고득점은 게이트 무효입니다.
- 개선 → 재채점 루프는 **최대 3회**. 3회 후에도 게이트 미달이면 **중단하지 말고**, 남은 결함을 "잔여 리스크"로 명시한 뒤 다음 단계로 진행하고 STEP 6 최종 보고서에 모아 보고하십시오.
- 채점 근거는 추측이 아니라 **실제 코드 인용 또는 명령 출력**이어야 합니다.

## 5. 단계별 작업 지시

### STEP 1 — 스키마·라우팅 설계 확정 (문서 산출물)

- `docs/Books_Review_Schema_Decision_20260827.md` 를 새로 작성.
- `ExternalBook` 필드 확정: `slug, title, author, publisher, category, tags[], rating, reviewCount, ratingSource, irpEligible, oneLineReview, summary, pros[], cons[], coverImage?, affiliateUrl?, relatedInternalLink?, backtestTicker?` + 기존 학습용 예시 메타 5종.
- **네이밍 계약**: frontmatter 키는 파일 규약(스네이크/케밥 허용), TypeScript 타입은 **카멜 케이스**로 노출. 프론트엔드가 소비하는 형태는 카멜 케이스로 고정하십시오.
- 라우트 확정: 외부 도서 상세는 `app/books/review/[slug]/page.tsx`. 기존 `app/books/[slug]` 와 공존하므로 **내부 도서 slug에 `review`가 없음을 확인**하고, `generateStaticParams()` 를 반드시 구현하십시오(누락 시 `output: "export"` 빌드 실패).
- 9인 채점 → 게이트 통과 → 커밋.

### STEP 2 — 데이터 계층 (`lib/content/learning-content.ts` 증분 확장)

- `content/external-books/` 디렉터리 신설, 파일명 규칙은 기존 패턴을 따르되 별도 상수로 분리.
- `loadExternalBooks()` / `findExternalBook(slug)` 추가. 기존 `loadBooks()` 시그니처는 **손대지 마십시오.**
- 숫자·불리언·리스트 필드 파싱과 검증(평점 0~5 범위, 카테고리 화이트리스트, 필수 필드 누락 시 파일명 포함 한국어 오류) 구현.
- 표지 경로 상수는 이 파일 한 곳에서만 정의(`BOOK_COVER_BASE_PATH`).
- **기존 테스트 갱신**: `learning-content.test.ts` 의 `toHaveLength(3)` 등 고정값이 깨지지 않도록 조정하고, 신규 로더의 정상·실패 경로 테스트를 추가.
- `npm test` 100% 통과 확인 → 9인 채점 → 게이트 → 커밋.

### STEP 3 — 목록 UI (`components/learning/external-books-index.tsx` 증분 개선)

- 하드코딩 `MOCK_EXTERNAL_BOOKS` 제거하고 `app/books/page.tsx` 서버 컴포넌트에서 로드해 props로 주입(클라이언트 컴포넌트는 필터링만 담당). **`"use client"` 경계를 넘는 props는 직렬화 가능한 값만.**
- 카드에 반영: 한 줄 총평, ⭐ 평점(가시성 강화), `IRP 가능` 배지, 카테고리, Pros/Cons 아이콘 병기.
- 모바일 여백·터치 타깃 확대, `line-clamp` 로 카드 높이 균일화, 카테고리 탭 전환 시 레이아웃 시프트 없음.
- "리뷰 상세 보기" → `/books/review/{slug}` 로 연결(**죽은 `#` 링크 제거**).
- 9인 채점 → 게이트 → 커밋.

### STEP 4 — 상세 페이지 + 크로스셀 배너

- `app/books/review/[slug]/page.tsx` 신설: `generateStaticParams`, `generateMetadata`(canonical `/books/review/{slug}`), `notFound()` 처리.
- `components/learning/external-book-detail.tsx` (kebab-case) 신설: 상단 메타·표지·한 줄 총평 → Pros/Cons **동일 크기 2열 패널(아이콘 + 텍스트, 색상 단독 의존 금지)** → **크로스셀 배너** → 본문(`MarkdownContent`) → 제휴 고지 순.
- `components/learning/cross-sell-banner.tsx` 신설: `relatedInternalLink` 존재 시에만 렌더, 자사 전자책/웹소설 분기, 광고 표시 문구 포함.
- 고객 F 요구: `backtestTicker` 가 있으면 기존 ETF 상세/비교 화면으로 가는 실행 CTA를 배치(새 차트 구현 금지, 기존 라우트 재사용).
- 9인 채점 → 게이트 → 커밋.

### STEP 5 — SEO·컴플라이언스·퍼널

- `app/sitemap.ts` 에 외부 도서 상세 등록.
- 제휴 링크는 전부 `rel="sponsored nofollow noopener" target="_blank"` + 링크 인접 광고 표시(기존 `app/books/[slug]/page.tsx` 의 "광고 · 제휴 링크" 패턴 준수).
- 투자권유가 아님을 알리는 고지 문구를 상세 하단에 유지. "최저가", "완벽 보완", 수익 보장·단정 표현 금지. 평점은 샘플임을 명시.
- 구조화 데이터가 필요하면 `Book`/`Review` JSON-LD를 정적으로 삽입하되, **샘플 데이터에는 삽입하지 마십시오**(허위 리뷰 마크업 금지).
- 9인 채점 → 게이트 → 커밋.

### STEP 6 — 최종 품질 게이트 및 회귀 검증

- `npm run lint`, `npm test`, `npm run build` 전체 재실행 로그 첨부.
- 회귀 확인: `/books` 기존 2단 구성 유지, `/books/{slug}` 내부 도서 정상, `out/` 에 `books/review/{slug}/index.html` 생성 확인.
- 9인 최종 채점(평균·최저점 명시) + 잔여 리스크 목록 + `git diff --stat` + 변경 파일 전체 목록 보고.
- `feature/books-review-v2` 푸시. **머지·배포는 하지 마십시오.**

## 6. 단계별 보고 포맷 (고정)

```
## STEP n 보고
### 6-1. 변경 사항
- 파일: 무엇을 왜 (증분 편집 근거 1줄)
### 6-2. 1차 채점
| 페르소나 | 점수 | 적발한 결함(파일:라인) |
| 웹 디자이너 | 8.7 | ... |
...
평균 x.x / 최저 x.x → 미통과
### 6-3. 개선 조치
- 결함 → 수정 내용
### 6-4. 재채점
| 페르소나 | 점수 | 잔여 코멘트 |
평균 x.x / 최저 x.x → 통과
### 6-5. 검증
$ npm run lint / npm test / npm run build  (요약 결과)
### 6-6. git diff --stat
```

## 7. 금지 사항

- 질문·승인 대기·중간 종료
- 새 프로젝트 생성, 아키텍처 교체, 기존 파일 전면 재작성
- `next-mdx-remote`, R2, 신규 런타임 의존성 추가
- 실존 도서·저자·평점·제휴 링크 창작 삽입
- `main` 커밋, 머지, 프로덕션 배포
- `node_modules/`, `out/`, `*.tsbuildinfo` 커밋

**STEP 0의 사실 확인부터 시작해 STEP 6까지 한 번에 진행하십시오.**

=== 전달 끝 ===
