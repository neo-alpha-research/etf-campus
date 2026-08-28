# Antigravity 지시: 투자 스타일 점검 → 3편 시리즈 귀결 (11인 페르소나 게이트 무중단 실행)

작성일: 2026-08-27
발신: EVS Navigator
용도: 아래 `=== 전달 시작 ===` 부터 `=== 전달 끝 ===` 사이의 전문을 그대로 Antigravity에 붙여넣으십시오.
근거: 저장소 실사(2026-08-27) + `docs/Style_Diagnosis_Book_Mapping_Plan_20260827.md`

---

=== 전달 시작 ===

# 지시: ETF Campus '투자 스타일 점검' 결과를 3편 시리즈로 귀결 — 7단계 무중단 실행

당신은 `D:\ETFCampus` 저장소를 담당하는 시니어 Cloudflare/Next.js 엔지니어이자, 11인 평가 패널을 동시에 시뮬레이션하는 검수자입니다.
**각 단계를 구현 → 11인 채점 → 개선 → 재채점 → 게이트 통과 → 다음 단계 순서로, 질문 없이 STEP 0부터 STEP 6까지 한 번에 진행하십시오.**

## 0. 절대 규칙

1. **무중단**: 중간에 질문하거나 승인을 기다리지 마십시오. 판단이 갈리면 "§3 확정 설계"와 "§4 폐기 목록"을 근거로 스스로 결정하고, 사유를 보고서에 1줄로 남기십시오.
2. **증분 편집**: 기존 파일을 통째로 덮어쓰거나 `touch`로 비운 뒤 새로 쓰지 마십시오. 필요한 최소 라인만 정밀 수정하십시오. `mkdir -p` + `touch` 초기화 스크립트 실행 금지.
3. **API/데이터 계약 보존**: `diagnoseStyle()`, `getAxisScores()`, `AXIS_DEFINITIONS`, `STYLE_PROFILES` 의 기존 시그니처와 **동물 10종 판정 결과를 바꾸지 마십시오.** 프론트엔드가 소비하는 응답은 카멜 케이스로 고정합니다.
4. **테스트 필수**: 신규 실행 경로마다 vitest 테스트를 작성하고, 매 단계 종료 시 `npm run lint` → `npm test` → `npm run build` 3종을 모두 통과시키십시오. 하나라도 실패하면 그 단계는 미통과입니다.
5. **작업 브랜치**: `feature/style-book-mapping` 에서 작업하고 단계별로 커밋하십시오. `main` 직접 커밋·머지·배포는 금지입니다.
6. **보고**: 매 단계 보고서 하단에 `git diff --stat` 출력을 반드시 포함하십시오.
7. **인코딩**: 모든 소스는 UTF-8(BOM 없음). `npm test`가 `verify:utf8`을 먼저 실행합니다.
8. **콘텐츠 창작 금지**: 3편 시리즈의 제목·상태·제휴 링크는 `content/books/*.mdx` frontmatter에 있는 값만 사용하십시오. 가격·출간일·판매처·평점을 임의로 만들어 넣지 마십시오.

## 1. 먼저 읽고 사실을 확인하십시오 (STEP 0)

아래는 2026-08-27 기준 실사 결과입니다. **코드를 쓰기 전에 이 파일들을 직접 열어 재확인**하고, 표와 다른 점이 있으면 STEP 0 보고서에 적으십시오.

| 항목 | 현재 사실 |
| --- | --- |
| 로직 | `lib/onboarding/style-diagnosis.ts` (320줄). `AXIS_DEFINITIONS` 5축, `DIAGNOSIS_QUESTIONS` 10문항(축당 2개), `STYLE_PROFILES` 10종, `getAxisScores()`(-1~1 정규화 평균), `diagnoseStyle()`(유클리드 최근접), `parseStoredDiagnosis()` |
| 저장 | `STYLE_STORAGE_KEY = "etfcampus.style.v3"` (localStorage). `parseStoredDiagnosis`는 `version !== 3`이면 `null` 반환 |
| 모달 | `components/onboarding/style-onboarding.tsx` (385줄). `screen` 상태가 `welcome → questions → result`. `app/layout.tsx:41`에 전역 마운트 |
| 칩 | `components/onboarding/style-chip.tsx` — `useSyncExternalStore` + `STYLE_CHANGE_EVENT` + `storage` 이벤트. 미완료 시 "약 2분 · 10문항" |
| 결과 CTA | `/quick?mode=pension`, `/quick?mode=general`, `` `/guides?style=${style}` `` |
| **함정 A** | `lib/onboarding/__tests__/style-diagnosis.test.ts`가 `DIAGNOSIS_QUESTIONS` **10개**, 축당 **2문항**, `STYLE_STORAGE_KEY === "etfcampus.style.v3"`, `diagnoseStyle(answers(1)) === "turtle"`, `diagnoseStyle(answers(10)) === "fox"` 를 고정 |
| **함정 B** | `app/guides/page.tsx`는 `style` 쿼리 파라미터를 **소비하지 않음**. 현재 죽은 링크 파라미터 |
| **함정 C** | `next.config.ts` `output: "export"`, `trailingSlash: true`, `images.unoptimized: true` → **요청 시점 서버 렌더가 없으므로 쿠키 기반 hydration 해결은 무효** |
| 도서 데이터 | `content/books/[LEARNING_EXAMPLE]_{momentum-etf-system, index-asset-allocation, dividend-cashflow}.mdx`. frontmatter에 `title, summary, reader, topic, status, seriesIndex`, 1편만 `status: published` + `affiliateUrl: https://ctee.kr/item/store/99321` + `coverImage` |
| 로더 | `lib/content/learning-content.ts` — gray-matter 아님. `[LEARNING_EXAMPLE]` 마커 + `key: value` 수동 파싱, 리스트는 `|` 구분. `loadBooks()` / `findBook()` |
| 도서 테스트 함정 | `lib/content/__tests__/learning-content.test.ts`가 `books).toHaveLength(3)` 고정 |
| 백엔드 | Cloudflare Pages Functions `functions/api/**` (확장자 `.js`). 응답 헬퍼는 `functions/api/community/_lib/api-security` 의 `jsonResponse` / `errorResponse`. 테스트 선례: `functions/api/community/_middleware.test.ts` |
| 바인딩 | `wrangler.toml` — D1 `ETF_PRICES`, KV `BRIEFING_KV` (preview/production 각각 정의됨) |
| 마이그레이션 | `migrations/` 최신은 `0017_market_scale_and_peer_flow.sql` → 신규는 **0018** |
| 알림 신청 | `functions/api/newsletter/subscribe.js` 존재. `{ email, agreeRequired }` POST, 현재는 성공 응답만 반환하는 껍데기 |
| SEO | `app/sitemap.ts` 가 `loadBooks()` 로 `/books/{slug}` 등록 중. 신규 정적 라우트는 여기에 추가 필요 |
| 디자인 토큰 | `text-strong / text-muted / border-line / bg-surface / brand-*`, 유틸 `chip`, `page-shell`, `eyebrow`. 파일명 kebab-case |

## 2. 이 작업의 목표 (한 문장)

**동물 10종은 "공유되는 정체성"으로 그대로 두고, 3편 시리즈를 "다음 한 걸음(처방)"으로 뒤에 붙여, 설문을 마치면 `동물 1종 + 시작점 도서 1권 + 읽는 순서 3권`이 한 화면에 나오게 한다.**

## 3. 확정 설계 (변경 금지)

### 3-1. 2층 구조

- **1층(정체성)**: 기존 10문항 → 동물 10종. **알고리즘·프로필·판정 결과 변경 금지.**
- **2층(처방)**: 신설 3문항 → 니즈 3점수 → 도서 배정. 동물 결과를 **먼저 보여준 뒤** 이어서 3문항을 받습니다. 건너뛰어도 동물 결과는 성립해야 합니다.

### 3-2. 신설 3문항 (`PRESCRIPTION_QUESTIONS`) — 3지선다, 슬라이더 아님

| id | 질문 | 선택지 → 니즈 | 가중 |
| --- | --- | --- | --- |
| `gap` | "지금 내 퇴직연금 계좌에서 가장 답이 없는 것은?" | 무엇을 살지 고르는 기준 → `signal` / 전체를 얼마씩 나눌지 → `map` / 들어오는 돈을 어떻게 볼지 → `income` | 3 |
| `regret` | "최근 가장 아쉬웠던 장면은?" | 오른 뒤에 따라 샀다 → `signal` / 한쪽에 쏠린 걸 뒤늦게 알았다 → `map` / 분배율 숫자만 보고 골랐다 → `income` | 2 |
| `goal` | "앞으로 12개월, 계좌에 남기고 싶은 것은?" | 교체 신호 규칙 → `signal` / 목표 비율과 점검일 → `map` / 현금흐름 점검 루틴 → `income` | 2 |

- 카피는 위 취지를 지키되 기존 문항의 "장면(scene) + 두 문장" 톤에 맞춰 다듬으십시오. **손익·수익률·성과 암시 표현 금지.**

### 3-3. 배정 산식 (`prescribeBooks`)

```
needScores = { signal, map, income }   // 각 선택 가중의 합, 최대 7
시작점  = argmax(needScores)
동점 시 ① `gap` 문항에서 고른 니즈 우선 → ② 그래도 동점이면 map(②편)
읽는 순서 = needScores 내림차순, 동점 규칙 동일
```

- **니즈 → 도서 매핑**: `signal → momentum-etf-system`, `map → index-asset-allocation`, `income → dividend-cashflow`. slug는 `content/books/` 파일명에서 파싱된 값을 사용하고 문자열을 여러 곳에 흩뿌리지 마십시오(상수 1곳).
- **기존 5축은 배정에 사용하지 마십시오.** 축 점수는 처방 카드의 **설명 문구**에만 사용합니다.
- **②편 우선 규칙의 근거**를 결과 화면에 1줄로 노출하십시오: 2편이 시리즈의 상위 규칙(목표 비율·허용 밴드)이라는 원고의 위계를 따릅니다.

### 3-4. 저장 스키마 v4 + v3 마이그레이션

- `STYLE_STORAGE_KEY`를 `"etfcampus.style.v4"` 로 올리고 `version: 4`, `prescription: { needScores, primaryBookSlug, order[] }`, `resultId`(UUID) 를 추가합니다.
- **v3 호환 경로 필수**: 기존 `etfcampus.style.v3` 값이 있으면 답변을 읽어 동물은 그대로 유지하고, `prescription`이 없는 상태로 승격해 결과 화면에서 **"3문항만 더"** 로 이어지게 하십시오. 기존 완료자의 결과를 초기화하면 미통과입니다.
- v3 키는 승격 후에도 삭제하지 마십시오(롤백 여지).

### 3-5. 바이럴 장치 (이번 범위)

1. **희소도**: `GET /api/style/stats` 결과로 "이 유형은 최근 참여자 100명 중 N명". **누적 표본 300건 미만이면 "집계 중"으로 숨김.** "상위 X%" 등 서열 표현 금지, "전체의 X%"만 허용. API 실패 시 해당 영역만 조용히 미노출(결과 화면은 정상 동작).
2. **`punchline`**: `StyleProfile`에 유형별 한 줄 정체성 문장 필드를 신설하고 10종 모두 작성. 행동 장면 1문장, 자기비하·조롱·손익 암시 금지.
3. **대비 유형**: 기존 `vector` 유클리드 **최대 거리** 1종을 "가장 다르게 보는 유형"으로 계산해 노출(추가 문항 없음).
4. **정적 결과 페이지**: `app/style/[animal]/page.tsx` + `generateStaticParams()`(10종) + `generateMetadata()`. `output: "export"` 이므로 사전 생성 필수. `app/sitemap.ts` 에 등록.
   - **OG 이미지 제작·Web Share 버튼·카카오 SDK는 이번 범위에서 제외.** 메타 태그는 기존 기본 OG로 폴백하고, 다음 단계에서 교체할 수 있게 이미지 경로 상수만 1곳에 두십시오.

### 3-6. CTA 분기 (frontmatter 기반, 하드코딩 금지)

| status | CTA |
| --- | --- |
| `published` | 구매 링크 = frontmatter `affiliateUrl`. `rel="sponsored nofollow noopener"` + `target="_blank"` + 링크 인접 "광고 · 제휴 링크" 표기(`app/books/[slug]/page.tsx` 정본 패턴) |
| `coming-soon` | ① `POST /api/newsletter/subscribe` 재사용한 출간 알림 신청, ② `/books/{slug}` 목차 미리보기 링크 |

- 미출간 도서에 가격·최저가·구매 표현 금지. 상태는 반드시 frontmatter에서 읽으십시오.

### 3-7. 데이터 수집 (D1 익명 통계)

- `migrations/0018_style_diagnosis_stats.sql` 신설. 컬럼: `id`(클라이언트 생성 UUID, PK), `style_id`, `book_slug`, `axis_view/range/timing/criteria/depth`(REAL), `need_signal/need_map/need_income`(INTEGER), `completed_date`(TEXT, `YYYY-MM-DD`), `created_at`. 인덱스: `style_id`, `completed_date`.
- **수집 금지**: IP, User-Agent, 회원 ID, 시·분 단위 시각, 자유 입력값. 로그인 프로필 연동은 이번 범위 밖.
- `functions/api/style/results.js` — `onRequestPost`. 검증 실패는 `errorResponse(400, "VALIDATION_ERROR", ...)`. **멱등**: 같은 `resultId` 재전송은 성공 응답 + 무시(`INSERT OR IGNORE`).
- `functions/api/style/stats.js` — `onRequestGet`. `BRIEFING_KV` **300초 캐시**. 응답 계약(카멜 케이스):
  `{ total, updatedAt, styles: [{ styleId, count, share }], books: [{ bookSlug, count, share }] }`
- 전송은 **fire-and-forget**: 실패해도 결과 화면·localStorage 저장은 정상 동작해야 합니다.

## 4. 폐기 목록 (그대로 쓰면 즉시 실패)

1. **동물 10종을 3종으로 축소** — 공유 동기가 붕괴하고 결과가 상품명이 됩니다. 금지.
2. **기존 5축으로 도서를 배정** — 측정 대상이 달라 근거 없는 매칭입니다. 금지.
3. **쿠키 기반 hydration 해결** — `output: "export"` 환경에서 무효. 초기 깜빡임은 `StyleChip`에 **고정 폭 스켈레톤**을 두어 레이아웃 시프트를 없애는 방식으로만 처리하십시오.
4. **`diagnoseStyle` 알고리즘·`STYLE_PROFILES` 벡터 수정** — 기존 사용자 결과가 바뀝니다. 금지(필드 추가는 허용).
5. **신규 런타임 의존성 추가**(차트/이미지 생성/공유 SDK/`next-mdx-remote`) — 금지.
6. **`app/api/` 라우트 핸들러로 백엔드 구현** — 서버 런타임은 `functions/`(Pages Functions)입니다.
7. **Supabase SDK 사용** — 저장소에 없습니다.
8. **`/guides?style=` 링크를 그대로 방치** — 파라미터가 소비되지 않습니다. 처방 도서 링크로 교체하거나, 유지한다면 `app/guides/page.tsx`가 실제로 소비하도록 최소 구현하십시오. 둘 중 무엇을 골랐는지 보고서에 적으십시오.

## 5. 평가 패널 11인 (매 단계 채점)

**전문가 5인**

1. **바이럴·그로스 전문가** — 결과를 남에게 보여주고 싶은가. 첫 화면 3초 안에 "이거 나다"가 오는가. `punchline`이 그대로 인용될 만한가. 희소도·대비 유형이 대화를 만드는가. 공유 링크가 결과를 재현하는가. 문항 13개로 늘어난 이탈 위험이 방어됐는가.
2. **웹 디자이너(UI/UX)** — 정보 계층(동물 → 처방 → CTA), 모바일 터치 타깃 44px, 색상 단독 의존 금지, 다크/라이트 대비, 디자인 토큰 준수, 결과 화면 스크롤 길이.
3. **데이터 아키텍트** — 타입 안전성, v3→v4 마이그레이션 무손실, SSG 빌드 안정성(`generateStaticParams` 누락 시 빌드 실패), D1 스키마·인덱스, KV 캐시 키 설계, 테스트 커버리지.
4. **마케팅 퍼널 전문가** — 결과 → 도서 CTA 전환 동선, 출간/미출간 분기 문구, 제휴 표기, 내부 링크 구조, 이탈 지점 방어.
5. **컴플라이언스 검토자** — 투자권유·투자성향진단으로 읽힐 표현이 있는가. 수익·성과 암시, 단정 표현, "상위 X%" 서열 표현, 미출간 도서의 구매 유도. 결과 하단 고지 문구 유지 여부. 익명 통계의 개인정보 최소 수집 원칙.

**고객 6인 (3050 직장인, DC형 가입자)**

6. **A · 30대 초반 주린이** — 용어 난이도. 3문항이 무엇을 묻는지 바로 이해되는가.
7. **B · 40대 중반 퇴직연금 관심자** — 왜 이 책이 나에게 배정됐는지 납득되는가.
8. **C · 50대 초반 자산배분가** — 글자 크기·여백, ②편 우선 규칙 설명의 설득력.
9. **D · 30대 후반 바쁜 직장인** — 결과 화면에서 30초 안에 다음 행동이 정해지는가.
10. **E · 40대 초반 비판적 투자자** — 광고로 느껴지지 않는가. 배정 근거가 정직하게 표시되는가. 희소도 숫자의 출처가 밝혀져 있는가.
11. **F · 30대 중반 행동주의자** — 결과에서 캠퍼스 내부 도구(`/quick`, 스크리너·비교)로 이어지는 실행 경로가 남아 있는가.

### 채점 규칙 (반드시 준수)

- 각 페르소나가 **10점 만점, 소수점 첫째 자리**로 채점합니다.
- **게이트: 11인 평균 ≥ 9.5 AND 개별 최저점 ≥ 9.0.**
- **1차 채점에서는 만점 금지.** 각 단계 1차 채점에서 **최소 3건 이상의 실질적 결함(파일:라인 지목)**을 반드시 적발하고, 평균이 9.5를 넘더라도 그 결함을 먼저 수정한 뒤 재채점하십시오. 근거 없는 고득점은 게이트 무효입니다.
- 개선 → 재채점 루프는 **최대 3회**. 3회 후에도 미달이면 **중단하지 말고** 남은 결함을 "잔여 리스크"로 명시한 뒤 다음 단계로 진행하고, STEP 6 최종 보고서에 모아 보고하십시오.
- 채점 근거는 추측이 아니라 **실제 코드 인용 또는 명령 출력**이어야 합니다.
- **컴플라이언스 검토자가 9.0 미만을 주면 게이트를 통과할 수 없습니다.** 다른 점수로 상쇄하지 마십시오.

## 6. 단계별 작업 지시

### STEP 0 — 사실 확인
- §1 표의 각 항목을 실제 파일로 확인하고, 표와 다른 점·추가로 발견한 함정을 보고서에 적으십시오.
- `git switch -c feature/style-book-mapping`.
- 채점 없음. 사실 확인 결과만 보고.

### STEP 1 — 설계 확정 문서 + 카피 확정
- `docs/Style_Diagnosis_BookMapping_Decision_20260827.md` 신설: 타입 정의, 3문항 최종 카피, 니즈→도서 매핑, 동점 규칙, v3→v4 마이그레이션 절차, D1 스키마, API 계약(요청·응답 예시 JSON), 화면 문구(희소도·처방 카드·CTA·고지).
- `punchline` 10종 초안도 이 문서에서 확정하십시오.
- 11인 채점 → 게이트 → 커밋.

### STEP 2 — 로직 계층 (`lib/onboarding/style-diagnosis.ts` 증분 확장)
- 신설: `PRESCRIPTION_QUESTIONS`, `NeedId`, `NeedScores`, `BOOK_SLUG_BY_NEED`, `prescribeBooks()`, `getOppositeStyle()`, `StyleProfile.punchline`, `STYLE_STORAGE_KEY = "etfcampus.style.v4"`, `parseStoredDiagnosis` v4 파싱 + **v3 승격 경로**.
- 기존 `getAxisScores` / `diagnoseStyle` / `STYLE_PROFILES.vector` **수정 금지**.
- **기존 테스트 갱신 필수**: `lib/onboarding/__tests__/style-diagnosis.test.ts` 의 문항 수·저장 키 문자열 고정 assertion을 갱신하되, `diagnoseStyle(answers(1)) === "turtle"` / `answers(10) === "fox"` 같은 **판정 회귀 테스트는 반드시 유지**하십시오(동물 결과 불변 증명).
- 신규 테스트: 니즈 동점 3종(gap 우선 / map 우선), 3문항 미응답 시 처방 없음, v3 저장값 승격, 잘못된 버전 거부.
- 11인 채점 → 게이트 → 커밋.

### STEP 3 — 모달 UI (`components/onboarding/style-onboarding.tsx` 증분 개선)
- `screen` 상태에 `prescription` 단계 추가: `welcome → questions → result(동물) → prescription(3문항) → result(동물+처방)`. **동물 결과를 먼저 보여준 뒤** 3문항으로 이어지게 하고, "건너뛰기"를 제공하십시오.
- 결과 화면 증분 추가: `punchline` 강조 블록, 희소도 배지(집계 중 폴백 포함), 대비 유형 카드, **처방 카드**(시작점 1권 + 읽는 순서 3권 + 배정 근거 1줄 + ②편 위계 안내 1줄), §3-6 CTA 분기.
- `components/onboarding/style-chip.tsx`: 문구를 "약 3분 · 13문항"으로 갱신하고 **고정 폭 스켈레톤** 추가(레이아웃 시프트 제거).
- `components/onboarding/__tests__/style-onboarding.test.tsx` 갱신 + 처방 플로우 테스트 추가.
- 11인 채점 → 게이트 → 커밋.

### STEP 4 — 정적 결과 페이지 + SEO
- `app/style/[animal]/page.tsx` 신설: `generateStaticParams()`(10종), `generateMetadata()`(canonical `/style/{animal}/`), `notFound()` 처리. **동물 결과 요약 + 이 유형이 자주 놓치는 것 + 3편 안내 + "나도 해보기" CTA**로 구성하고, 모달 결과 컴포넌트를 재사용 가능한 형태로 분리해 중복 구현을 피하십시오.
- `app/sitemap.ts` 에 10개 라우트 등록.
- 빌드 후 `out/style/{animal}/index.html` 10개 생성 확인.
- OG 이미지 경로 상수만 1곳에 정의하고 파일이 없으면 기본 OG로 폴백(이미지 제작은 범위 밖).
- 11인 채점 → 게이트 → 커밋.

### STEP 5 — D1 익명 통계 + 알림 신청 연동
- `migrations/0018_style_diagnosis_stats.sql` 신설(§3-7 스키마).
- `functions/api/style/results.js`(POST, 멱등) / `functions/api/style/stats.js`(GET, KV 300초 캐시) 신설. 응답 헬퍼는 `functions/api/community/_lib/api-security` 재사용.
- `functions/api/style/__tests__` 또는 병치 `.test.ts` 로 검증 경로 테스트(잘못된 payload 400, 정상 201/200, 중복 resultId 무시, 캐시 히트).
- 클라이언트 전송은 fire-and-forget. 실패 시 콘솔 경고만, UI 영향 없음.
- 미출간 도서 알림 신청은 기존 `POST /api/newsletter/subscribe` 계약(`{ email, agreeRequired }`)을 **그대로** 사용하고 새 엔드포인트를 만들지 마십시오.
- 개인정보 최소 수집 원칙 준수 여부를 컴플라이언스 페르소나가 확인.
- 11인 채점 → 게이트 → 커밋.

### STEP 6 — 최종 품질 게이트 및 회귀 검증
- `npm run lint`, `npm test`, `npm run build` 전체 재실행 로그 첨부.
- 회귀 확인: ① 기존 v3 저장값 보유자의 동물 결과 불변, ② 3문항 건너뛴 사용자도 결과 정상, ③ `/books/{slug}` 기존 라우트 정상, ④ `out/` 에 `style/{animal}/index.html` 10개 생성, ⑤ 헤더 칩 레이아웃 시프트 없음.
- 11인 최종 채점(평균·최저점 명시) + 잔여 리스크 목록 + 변경 파일 전체 목록 + `git diff --stat`.
- `feature/style-book-mapping` 푸시. **머지·배포는 하지 마십시오.**

## 7. 단계별 보고 포맷 (고정)

```
## STEP n 보고
### 7-1. 변경 사항
- 파일: 무엇을 왜 (증분 편집 근거 1줄)
### 7-2. 1차 채점
| 페르소나 | 점수 | 적발한 결함(파일:라인) |
| 바이럴·그로스 | 8.6 | ... |
...
평균 x.x / 최저 x.x → 미통과
### 7-3. 개선 조치
- 결함 → 수정 내용
### 7-4. 재채점
| 페르소나 | 점수 | 잔여 코멘트 |
평균 x.x / 최저 x.x → 통과
### 7-5. 검증
$ npm run lint / npm test / npm run build  (요약 결과)
### 7-6. git diff --stat
```

## 8. 금지 사항

- 질문·승인 대기·중간 종료
- 새 프로젝트 생성, 아키텍처 교체, 기존 파일 전면 재작성
- 동물 10종 축소, `diagnoseStyle` 알고리즘 변경, `STYLE_PROFILES.vector` 수정
- 신규 런타임 의존성(공유 SDK·이미지 생성·차트 라이브러리 포함) 추가
- 도서 가격·출간일·판매처·평점 창작, 미출간 도서 구매 유도
- 개인 식별 정보(IP·UA·회원ID·시각) 수집
- `main` 커밋, 머지, 프로덕션 배포
- `node_modules/`, `out/`, `*.tsbuildinfo` 커밋

**STEP 0의 사실 확인부터 시작해 STEP 6까지 한 번에 진행하십시오.**

=== 전달 끝 ===
