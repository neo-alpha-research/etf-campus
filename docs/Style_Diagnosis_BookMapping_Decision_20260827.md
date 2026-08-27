# 투자 스타일 점검 → 3편 시리즈 귀결 확정 설계 및 카피 규격서

작성일: 2026-08-27  
상태: 확정 (Approved)  
대상: `D:\ETFCampus` (Next.js SSG + Cloudflare Pages Functions)

---

## 1. 2층 아키텍처 개요 (Two-Tier Architecture)

1. **1층: 정체성 계층 (Identity Layer)**
   - 기존 10문항(5축 × 2문항)을 통해 동물 10종 중 1종을 판정.
   - 탐색 및 정보 습득 습관을 나타내며, 바이럴 공유 및 개인화의 핵심 정체성으로 유지.
   - 기존 판정 알고리즘(`diagnoseStyle`) 및 벡터 좌표(`STYLE_PROFILES`)는 **100% 보존**.

2. **2층: 처방 계층 (Prescription Layer)**
   - 신설 3문항(`gap`, `regret`, `goal`)을 통해 니즈 점수 3종(`signal`, `map`, `income`)을 측정.
   - 퇴직연금/ETF 계좌의 결손 영역을 찾아 3편 도서 시리즈의 **시작점 1권**과 **읽는 순서 3권**을 산출.
   - 동물 결과를 먼저 제시한 후 3문항으로 자연스럽게 유도하며, 건너뛰기 시에도 동물 결과와 정체성 공유는 온전히 성립.

```
┌──────────────────────────────────────────────────────────┐
│ 1층: 정보 탐색 정체성 (10문항 -> 5개 축 -> 동물 10종)   │
│  - 거북이 / 부엉이 / 다람쥐 / 돌고래 / 코끼리           │
│  - 여우 / 문어 / 독수리 / 고슴도치 / 수달                │
└────────────────────────────┬─────────────────────────────┘
                             │ (동물 결과 확인 후 "처방 3문항" 연결)
                             ▼
┌──────────────────────────────────────────────────────────┐
│ 2층: 계좌 과제 처방 (신설 3문항 -> 니즈 3점수 -> 3편 도서) │
│  - ① 신호 엔진 (signal) -> 모멘텀 ETF 시스템             │
│  - ② 자산배분 지도 (map)  -> 지수·자산배분 규정서       │
│  - ③ 현금흐름 기준 (income) -> 배당·현금흐름 루틴        │
│  => 시작점 1권 + 읽는 순서 3권 배정                      │
└──────────────────────────────────────────────────────────┘
```

---

## 2. 신설 3문항 최종 카피 및 가중치 (`PRESCRIPTION_QUESTIONS`)

3지선다 선택형(슬라이더 아님), 장면 + 두 문장 톤 준수, 손익·수익률 암시 배제.

| ID | 장면 (Scene) | 질문 (Title) | 선택지 및 상세 (Options) | 가점 니즈 | 가중치 |
|---|---|---|---|---|:---:|
| `gap` | `처방 1 · 비어 있는 축` | 지금 내 퇴직연금 계좌에서 가장 답답하거나 비어 있는 것은? | **A.** 무엇을 언제 살지 고르는 교체 신호가 없다<br>*(어느 ETF가 더 강한지 객관적인 신호로 비교하고 싶다)* | `signal` | **3** |
| | | | **B.** 전체 자산을 얼마씩 나눌지 계좌 지도가 없다<br>*(국내·해외·안전자산의 목표 비율과 허용 밴드를 세우고 싶다)* | `map` | **3** |
| | | | **C.** 들어오는 분배금을 어떻게 다룰지 기준이 없다<br>*(높은 분배율의 함정을 거르고 지속 가능한 현금흐름을 만들고 싶다)* | `income` | **3** |
| `regret` | `처방 2 · 아쉬웠던 장면` | 최근 내 계좌를 돌아볼 때 가장 아쉬웠던 순간은? | **A.** 이미 많이 오른 뒤에 소식을 듣고 따라 들어갔다<br>*(진입과 교체의 명확한 규칙 없이 감정으로 움직였다)* | `signal` | **2** |
| | | | **B.** 한쪽에 크게 쏠려 계좌가 흔들리는 걸 뒤늦게 알았다<br>*(계좌 전체의 자산 배분 비중을 미리 정해두지 못했다)* | `map` | **2** |
| | | | **C.** 단순히 분배율 숫자만 보고 골랐다가 원금이 깎였다<br>*(분배금의 지속 가능성과 지급 재원을 점검하지 못했다)* | `income` | **2** |
| `goal` | `처방 3 · 앞으로의 12개월` | 앞으로 12개월 동안 내 계좌에 가장 확실히 남기고 싶은 시스템은? | **A.** 시장 변화에 흔들리지 않는 객관적 ETF 교체 신호<br>*(강한 종목을 고르고 약해지면 정리하는 규칙 엔진)* | `signal` | **2** |
| | | | **B.** 한 장의 운용 규정서로 정리된 자산 배분 지도<br>*(목표 비율, 허용 밴드, 정기 리밸런싱 점검일)* | `map` | **2** |
| | | | **C.** 월별·분기별로 예측 가능한 현금흐름 점검 루틴<br>*(배당 재원 검증, 함정 필터, 재투자 및 인출 원칙)* | `income` | **2** |

---

## 3. 니즈 매핑 및 배정 알고리즘 (`prescribeBooks`)

### 3-1. 니즈 ID 및 도서 매핑 상수
```typescript
export const BOOK_SLUG_BY_NEED = {
  signal: "momentum-etf-system",
  map: "index-asset-allocation",
  income: "dividend-cashflow",
} as const;

export type NeedId = keyof typeof BOOK_SLUG_BY_NEED; // "signal" | "map" | "income"
export type NeedScores = Record<NeedId, number>; // 各 0~7
```

### 3-2. 동점 처리 및 순서 결정 규칙
1. **각 니즈 점수 계산**: `needScores[need] = sum(선택한 문항 가중치)` (최대 7점)
2. **시작점 (Primary Book)**: 최고점 니즈.
   - **1순위 동점 처리**: 3점 배점인 `gap` 문항에서 선택한 니즈 우선.
   - **2순위 동점 처리 (완전 동점 시)**: `map` (②편 지수·자산배분) 우선.
3. **읽는 순서 (Reading Order)**: 니즈 점수 내림차순 정렬 (동점 시 위 우선순위 동일 적용).
4. **②편 우선 원칙 근거 문구 (UI 노출)**:
   > "②편(지수·자산배분)은 계좌 전체의 목표 비율과 허용 밴드를 세우는 상위 규정서이므로, 고민의 크기가 같을 때는 계좌의 지도를 먼저 그리는 것을 권장합니다."

---

## 4. 동물 10종 한 줄 정체성 문장 (`punchline`)

| 동물 ID | 동물명 | 한 줄 정체성 문장 (`punchline`) |
|---|---|---|
| `turtle` | 거북이 | 숫자가 춤을 춰도 내가 정한 점검 날짜가 되기 전엔 움직이지 않습니다. |
| `owl` | 부엉이 | 설명글보다 숫자 표를 먼저 열고, 작은 소수점 차이까지 확인해야 잠이 옵니다. |
| `squirrel` | 다람쥐 | 매월 정한 날마다 지난달 메모와 오늘 숫자를 나란히 두고 차곡차곡 모아갑니다. |
| `dolphin` | 돌고래 | 새로운 테마나 시장 소식이 들려오면 관련된 ETF부터 지도처럼 빠르게 펼쳐봅니다. |
| `elephant` | 코끼리 | 단기 등락보다 이 자산군이 내 계좌에서 맡은 원래 역할을 먼저 떠올립니다. |
| `fox` | 여우 | 변화가 감지되면 필터와 정렬 기준을 바꿔가며 숨은 차이와 후보를 빠르게 좁힙니다. |
| `octopus` | 문어 | 서로 다른 시장과 여러 지표를 한 화면에 띄워두고 종합적인 균형을 맞춥니다. |
| `eagle` | 독수리 | 개별 종목의 잔물결보다 글로벌 거시 흐름과 자산군 전체의 큰 방향을 먼저 봅니다. |
| `hedgehog` | 고슴도치 | 화려한 수익률 문구보다 공시와 투자설명서의 원문 근거부터 꼼꼼히 확인합니다. |
| `otter` | 수달 | 복잡한 수치에 얽매이기보다 핵심 요약과 간결한 질문으로 중요한 맥락만 건져냅니다. |

---

## 5. 바이럴 및 대비 유형 (Opposite Style) 산식

- **유클리드 최대 거리 (대비 유형)**:
  $$\text{distance}(A, B) = \sum_{\text{axis} \in \text{Axes}} (A.\text{vector}[\text{axis}] - B.\text{vector}[\text{axis}])^2$$
  10종 프로필 중 거리가 가장 먼 1종을 "가장 다르게 보는 유형" 카드로 노출.
- **희소도 (Rarity)**:
  `GET /api/style/stats`에서 집계된 `share` 비율을 활용:
  `"이 유형은 최근 참여자 100명 중 N명"`
  *표본 300건 미만 시*: `"통계 집계 중"` 배지로 폴백. 서열/순위("상위 X%") 표현 금지.

---

## 6. 저장 스키마 v4 및 v3 마이그레이션

### 6-1. TypeScript 스키마 정의
```typescript
export type PrescriptionQuestionId = "gap" | "regret" | "goal";

export type PrescriptionResult = {
  answers: Record<PrescriptionQuestionId, NeedId>;
  needScores: NeedScores;
  primaryBookSlug: string;
  order: string[];
};

export type CompletedDiagnosisV4 = {
  version: 4;
  status: "completed";
  resultId: string; // UUID v4
  answers: DiagnosisAnswers;
  style: StyleId;
  axisScores: AxisScores;
  prescription?: PrescriptionResult;
  completedAt: string;
};

export type SkippedDiagnosisV4 = {
  version: 4;
  status: "skipped";
  skippedAt: string;
};

export type StoredDiagnosis = CompletedDiagnosisV4 | SkippedDiagnosisV4;
```

### 6-2. v3 -> v4 무손실 승격 규칙
1. `localStorage.getItem("etfcampus.style.v4")`가 없으면 `etfcampus.style.v3`을 확인.
2. v3에 유효한 진단 결과가 있는 경우:
   - 기존 `answers`, `style`, `axisScores`, `completedAt`을 그대로 보존.
   - `version: 4`, 신규 `resultId: crypto.randomUUID()`를 부여하고 `prescription: undefined` 상태로 메모리에서 승격.
   - 모달을 열었을 때 **"내 동물 결과"**는 즉시 보여주고, 하단에 **"나에게 필요한 책 3문항으로 찾기"** 버튼을 제공하여 처방 완료 시 v4로 저장.
   - v3 localStorage 키는 롤백 안전성을 위해 삭제하지 않고 유지.

---

## 7. Cloudflare D1 스키마 및 API 계약

### 7-1. D1 마이그레이션 (`migrations/0018_style_diagnosis_stats.sql`)
```sql
-- D1 Table Schema: migrations/0018_style_diagnosis_stats.sql
CREATE TABLE IF NOT EXISTS style_diagnosis_results (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  book_slug TEXT NOT NULL,
  axis_view REAL NOT NULL,
  axis_range REAL NOT NULL,
  axis_timing REAL NOT NULL,
  axis_criteria REAL NOT NULL,
  axis_depth REAL NOT NULL,
  need_signal INTEGER NOT NULL,
  need_map INTEGER NOT NULL,
  need_income INTEGER NOT NULL,
  completed_date TEXT NOT NULL, -- KST 기준 YYYY-MM-DD 형식
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_style_results_style ON style_diagnosis_results (style_id);
CREATE INDEX IF NOT EXISTS idx_style_results_date ON style_diagnosis_results (completed_date);
```

- **개인정보 최소 수집 원칙**: IP, User-Agent, 회원 ID, 세부 시각(시:분)은 일체 수집하지 않으며, 집계 및 통계 목적의 날짜(KST YYYY-MM-DD)와 점수만 저장.
- **멱등성(Idempotency)**: 동일 `id`(결과 UUID)로 재전송된 요청은 `INSERT OR IGNORE` 처리하여 에러 없이 200 OK 반환.

### 7-2. API 명세 (Pages Functions)

#### `POST /api/style/results`
- **Request Body**:
```json
{
  "resultId": "550e8400-e29b-41d4-a716-446655440000",
  "styleId": "turtle",
  "bookSlug": "index-asset-allocation",
  "axisScores": { "view": -1.0, "range": -1.0, "timing": -1.0, "criteria": -1.0, "depth": -1.0 },
  "needScores": { "signal": 2, "map": 5, "income": 0 },
  "completedDate": "2026-08-27"
}
```
- **Response**: `201 Created` (`{ "success": true, "resultId": "..." }`) 또는 중복 시 `200 OK` (Idempotent).

#### `GET /api/style/stats`
- **Cache**: `BRIEFING_KV` 300초 (5분) 캐시.
- **Response (카멜 케이스)**:
```json
{
  "total": 1250,
  "updatedAt": "2026-08-27T13:20:00Z",
  "styles": [
    { "styleId": "turtle", "count": 150, "share": 0.12 },
    { "styleId": "owl", "count": 180, "share": 0.144 }
  ],
  "books": [
    { "bookSlug": "momentum-etf-system", "count": 420, "share": 0.336 },
    { "bookSlug": "index-asset-allocation", "count": 510, "share": 0.408 },
    { "bookSlug": "dividend-cashflow", "count": 320, "share": 0.256 }
  ]
}
```

---

## 8. CTA 및 화면 라우팅 규격

1. **CTA 분기 (frontmatter 기반)**:
   - `status === "published"`: 제휴 스토어 소장 링크 (`rel="sponsored nofollow noopener" target="_blank"` + 인접 "광고 · 제휴 링크" 문구).
   - `status === "coming-soon"`: 출간 알림 신청 (`POST /api/newsletter/subscribe` 재사용) + 목차 미리보기 링크 (`/books/{slug}`).
2. **정적 결과 페이지 라우트**:
   - `/style/[animal]/` (10종 SSG 생성 + `app/sitemap.ts` 등록).
3. **`/guides?style=` 처리 방안 확정**:
   - `app/guides/page.tsx`는 필터 쿼리를 소비하지 않으므로, 결과 화면의 불필요한 죽은 파라미터를 정리하고 배정된 처방 도서(`/books/${primaryBookSlug}`) 및 유형별 정적 상세 페이지(`/style/${style}`)로 명확히 연결.
