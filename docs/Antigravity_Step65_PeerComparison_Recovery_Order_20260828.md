# Antigravity 지시: 동종비교 분류 데이터 회귀 복구 (커밋 e426ab9 사후 처리)

작성일: 2026-08-28
발신: EVS Navigator
용도: 아래 `=== 전달 시작 ===` 부터 `=== 전달 끝 ===` 사이의 전문을 그대로 Antigravity에 붙여넣으십시오.
근거: 커밋 `e426ab9` 실사 검증(2026-08-28) + 전 종목 1,163개 피어 시뮬레이션 대조

---

=== 전달 시작 ===

# 지시: 동종비교 분류 데이터 회귀 복구 — 5단계 무중단 실행

당신은 `D:\ETFCampus` 저장소를 담당하는 시니어 Cloudflare/Next.js 엔지니어입니다.
**STEP 1부터 STEP 5까지 질문 없이 한 번에 진행하십시오.**

## 0. 절대 규칙

1. **재생성 스크립트 단독 실행 금지**: `scripts/build_comparison_registry.py` 를 이번 작업에서 **실행하지 마십시오.** 이 스크립트를 단독 실행하면 `scripts/rebuild_classification_final.py` 가 얹어둔 판정이 통째로 덮이며, 그것이 이번 회귀의 원인입니다. 분류 CSV는 **행 단위 증분 수정**으로만 고치십시오.
2. **증분 편집**: `pandas.to_csv()` 로 CSV 전체를 다시 쓰지 마십시오. 컬럼 순서·인용부호·개행이 전 행에서 바뀝니다. 아래 STEP 2가 지정한 방식만 사용하십시오.
3. **변경 행수 상한**: 이 작업으로 `data/comparison/etf_comparison_classification.csv` 에서 값이 바뀌는 행은 **최대 1,157행 중 1,000행 이하**여야 하며, 그중 asset_family가 바뀌는 행은 **1행(481050)뿐**이어야 합니다. 초과하면 즉시 되돌리고 보고하십시오.
4. **브랜치**: `fix/peer-classification-recovery` 에서 작업하십시오. `main` 직접 커밋·푸시 금지입니다. (직전 작업이 main에 직접 커밋되어 되돌리기 어려워졌습니다.)
5. **테스트 삭제 금지**: 실패하는 테스트를 지워서 통과시키지 마십시오. 계약이 현실과 다르면 **계약을 다시 쓰되 검증력은 유지**하십시오.
6. **3종 게이트**: 매 STEP 종료 시 `npm run lint` → `npm test` → `npm run build` 를 모두 통과시키십시오.
7. **보고**: 매 STEP 보고서 하단에 `git diff --stat` 출력을 반드시 포함하십시오.
8. **인코딩**: 분류 CSV는 UTF-8 **BOM 포함**(현행 유지), 소스 코드는 BOM 없는 UTF-8.

## 1. 확정된 사실 (코드를 쓰기 전에 직접 재확인하십시오)

커밋 `e426ab9` 를 전 종목 시뮬레이션으로 대조한 결과입니다.

| 항목 | 검증 결과 |
| --- | --- |
| 은행 7종 오분류 수정 | **성공.** KODEX 은행 → 증권·보험·금융지주 비교, 은행채 → 단기채권 비교로 정상화 |
| `infer_asset` 정규식 수정 | **타당.** `"은"` → `"은선물","은현물","실버"` |
| 실제 코드 변경량 | `etf-peer-groups.ts` **1줄**, `build_comparison_registry.py` **1줄**, 테스트 **16줄 삭제**가 전부 |
| P1 가드레일·중복억제·`tier: "same_peer_group"` | 이 커밋의 산출물이 **아님**. dev 브랜치 머지(`4e02c2c`)로 유입됨 |
| P2 패널 헤더 동적 표기 | **미반영** (코드에 없음) |
| PG-PENDING 상위 100 정식배정 | **미반영.** 현재도 604건 잔존(수정 전 606건) |
| 분류 CSV 변경 규모 | 1,157행 중 **1,156행 변경** (의도한 수정은 8행) |
| 사용자 노출 비교조합 변화 | 1,144종목 중 **870종목(76%)의 4종목 구성이 교체됨** |

### 회귀 상세 (이번에 복구할 대상)

| 필드 | 손실 건수 | 손실 내용 |
| --- | --- | --- |
| `strategy_style` | 986 | `passive`(644)·`active`(342) 구분이 전부 `plain`으로 소실 |
| `comparison_topic` | 662 | "우량 회사채·금융채"(102), "국내 장기국채"(47), "미국 장기국채"(23) 등이 전부 `채권` 한 덩어리로 병합 |
| `fx_hedge` | 636 | `unhedged_or_not_applicable`·`not_applicable` → `unknown` |
| `classification_status` | 604 | `classified_derived` → `needs_review`, `conflict_resolved` → `conflict` (어휘 체계 변경) |
| `region_primary` | 73 | 미국(41)·국내(31)·일본(1) → `해당없음` |

**연쇄 피해**: `calculateRelativeDistance` 의 환헤지 라벨은 `hedged`/`unhedged` 일 때만 붙습니다. 현재 전체 피어 페어 4,652건 중 **2,607건(56%)이 `unknown` 을 포함**해 라벨이 뜨지 않습니다. 또한 채권 토픽이 하나로 병합되어 회사채와 30년 국채가 동일 `comparison_topic` 으로 `+20점`을 주고받습니다.

### 신규 회귀 1건

`481050 KODEX CD1년금리플러스액티브(합성)` 이 `금리·파킹 / 머니마켓` → `주식 / 산업·섹터 / 국내 금융·은행·증권·보험` 으로 오분류됐습니다.
원인은 기초지수명 `KAP 1년은행 CD+추가금리 지수(총수익지수)` 의 "**은행**" 입니다. 현재 피어는 `KODEX 증권 / SOL 금융지주플러스고배당 / KODEX 은행 / TIGER 증권` 이며, 파킹형 상품을 은행주와 비교하는 화면이 나가고 있습니다.

### 함정

| # | 내용 |
| --- | --- |
| 함정 A | `components/etf-detail/etf-compare-view.tsx` 는 `selectionReasons` prop을 **타입에만 선언하고 destructure조차 하지 않습니다.** 파일 전체에 `reason` 문자열이 0회 등장합니다. 즉 **추천 사유 배지가 화면에 전혀 표시되지 않습니다.** |
| 함정 B | 직접 동종그룹 채움(`candidatesForGroup`)에는 운용사 중복 억제가 적용되지 않습니다. 동일 운용사 3개 이상이 한 표에 뜨는 종목이 **31건** 있습니다. |
| 함정 C | `build_comparison_registry.py` 와 `rebuild_classification_final.py` 는 `classification_status` 어휘가 다릅니다(전자: `needs_review`/`conflict`, 후자: `classified_derived`/`conflict_resolved`). 실행 순서가 결과를 바꿉니다. |
| 함정 D | `lib/data/etf-peer-groups.ts` 의 `loadData()` 는 분류 CSV의 `primary_peer_group_id` 가 레지스트리에 없으면 **모듈 로드 시점에 throw** 합니다. 그룹 ID를 임의로 만들지 마십시오(`-FIXED` 같은 접미사 금지). |
| 함정 E | 이번 복구에서 `primary_peer_group_id` 는 **건드리지 마십시오.** 토픽만 복구하고 그룹 ID는 현행 유지합니다(레지스트리 정합은 ID 존재 여부로만 검증됩니다). |

---

## STEP 1 — 481050 회귀 수정

`scripts/build_comparison_registry.py` 의 `infer_asset()` 에서, 금리·파킹 판정이 주식 섹터 판정보다 **먼저** 걸리도록 키워드를 보강하십시오.

현재:
```python
if contains(text, "KOF R", "KOFR", "CD금리", "CD 금리", "머니마켓", "MMF", "파킹"):
    return "금리·파킹"
```

보강 대상 키워드(최소): `"CD1년금리"`, `"CD+추가금리"`, `"CD 1년"`, `"금리플러스"`, `"추가금리"`.
`"금리"` 단독 추가는 금지합니다(채권형 다수를 오분류시킵니다).

그리고 분류 CSV의 `481050` 행을 STEP 2의 복구 대상에 포함시켜 `금리·파킹 / 국내 / 금리·파킹 / 금리·파킹 / 머니마켓 / RATE_CD_1Y_481050 / active / rate_return / neutral / 1X / not_applicable / synthetic` 로 되돌리십시오(`e426ab9~1` 시점 값).

**게이트**: 스크립트를 실행하지 않고도, 아래 단위 테스트가 통과해야 합니다.
```
infer_asset("KODEX CD1년금리플러스액티브(합성) KAP 1년은행 CD+추가금리 지수(총수익지수)", {}) == "금리·파킹"
infer_asset("KODEX 은행 KRX 은행", {}) == "주식"
infer_asset("TIGER 금은선물(H) S&P GSCI Precious Metals Index(TR)", {}) == "원자재"
```
`scripts/__tests__/` 에 pytest로 추가하십시오(`pytest.ini` 가 이미 있습니다).

---

## STEP 2 — 소실 5개 컬럼 증분 복구

`e426ab9~1` 시점의 분류 CSV에서 **아래 5개 컬럼만** 되살립니다. 다른 컬럼은 절대 건드리지 마십시오.

```
strategy_style, comparison_topic, fx_hedge, region_primary, classification_status
```

**제외 티커(현행 값 유지)** — 이번에 올바르게 고쳐진 은행 계열 7종입니다:
```
0013P0, 091170, 091220, 466940, 0061Z0, 0123S0, 0131W0
```

**481050 은 제외하지 말고 복구 대상에 포함**하십시오(위 5개 컬럼 + `asset_family`, `comparison_category`, `comparison_subtopic`, `index_family`, `payoff_structure` 도 함께 되돌립니다. 이 티커 1건만 예외적으로 전 필드 복구).

권장 절차:
```
git show e426ab9~1:data/comparison/etf_comparison_classification.csv > tmp_before.csv
```
그다음 `csv.DictReader` / `csv.DictWriter` 로 **현행 파일의 컬럼 순서와 개행 문자를 그대로 유지**한 채, ticker 기준으로 위 컬럼만 덮어쓰십시오. `pandas` 사용 금지입니다. 작업 후 `tmp_before.csv` 는 삭제하십시오(커밋 금지).

**게이트**:
- `git diff --stat` 에서 분류 CSV 외 데이터 파일은 변경되지 않을 것
- 아래 정합 검사 전부 통과:
  - `primary_peer_group_id` 가 레지스트리에 없는 행: **0건**
  - 중복 ticker: **0건**
  - `nan` 문자열 리터럴: **0건**
  - `strategy_style == "plain"` 행 수가 복구 전보다 **900건 이상 감소**
  - `fx_hedge == "unknown"` 행 수가 복구 전보다 **600건 이상 감소**
  - `asset_family` 가 바뀐 행: **481050 단 1건**

---

## STEP 3 — 추천 사유 배지를 실제로 표시

`components/etf-detail/etf-compare-view.tsx` 가 `selectionReasons` 를 받아 렌더링하도록 최소 수정하십시오.

- `Props` 에 이미 선언된 `selectionReasons?: Map<string, string[]>` 를 destructure에 추가
- 비교 표의 각 피어 열(또는 종목명 아래)에 해당 티커의 `reasons` 배열을 작은 배지로 표시
- **주의 라벨은 시각적으로 구분**하십시오. 아래 4개는 경고 성격(주황/붉은 계열)으로, 나머지는 중립(회색) 배지로 표시합니다:
  - `"환헤지/환노출 불일치"`
  - `"커버드콜 ↔ 일반형 (총수익 비교 주의)"`
  - `"수익 구조 다름 (비교 주의)"`
  - `"만기 구간 다름"`
- `mode === "peer-readonly"` 일 때만 표시하고, 사용자가 직접 담은 `/compare` 바스켓에서는 표시하지 마십시오(사유가 없습니다).
- 배지 문구에 내부 코드값이 그대로 노출되지 않도록 하십시오. 현재 `candidateReasons()` 는 `` `같은 ${candidate.fxHedge} 유형` `` 을 생성하므로 `fxHedge` 가 `unknown`·`unhedged_or_not_applicable` 이면 **그 문구 자체를 만들지 않도록** `lib/data/etf-peer-groups.ts` 의 `candidateReasons()` 를 최소 수정하십시오(`hedged`/`unhedged` 일 때만 생성).

**게이트**: `npm test` 에 "peer-readonly 모드에서 사유 배지가 렌더링된다", "주의 라벨이 경고 스타일로 렌더링된다" 2건의 테스트를 추가해 통과시키십시오.

---

## STEP 4 — 삭제된 테스트를 데이터 계약 테스트로 대체

커밋 `e426ab9` 가 지운 2건을 대신할 회귀 감시망을 세우십시오. `lib/data/__tests__/etf-peer-groups.test.ts` 에 추가합니다.

필수 4건:
1. **은행 계열 방어**: 이름 또는 기초지수에 `은행` 이 포함된 ETF의 `asset_family` 는 `원자재` 가 **아니다**
2. **파킹형 방어**: 이름에 `CD` 와 `금리` 가 함께 포함된 ETF의 `comparison_category` 는 `산업·섹터` 가 **아니다**
3. **선물 상품 보존**: `TIGER 금은선물(H)`, `KODEX 콩선물(H)`, `RISE 팔라듐선물(H)` 의 `asset_family` 는 `원자재` 이다
4. **필드 소실 감지**: `strategy_style` 이 `plain` 인 행의 비율이 전체의 **60% 미만**이고, `fx_hedge` 가 `unknown` 인 행의 비율이 **20% 미만**이다 (재생성 스크립트가 다시 필드를 뭉갤 경우 즉시 실패)

**삭제된 2건을 되살리지는 마십시오.** 확장 채움이 정상 동작인 현재 설계와 모순됩니다.

---

## STEP 5 — 운영 규칙 명문화

`AGENTS.md` 에 아래 내용을 추가하십시오(기존 내용 삭제 금지, 섹션 추가만).

```
## 분류 데이터 수정 규칙
- data/comparison/etf_comparison_classification.csv 는 행 단위 증분 수정만 허용한다.
- scripts/build_comparison_registry.py 단독 실행 금지. 실행이 불가피하면 반드시
  scripts/rebuild_classification_final.py 를 후행 실행하고, git diff --stat 으로
  변경 행수를 확인한 뒤 커밋한다.
- pandas.to_csv() 로 이 CSV를 다시 쓰지 않는다(전 행 재직렬화).
- classification_status 어휘는 classified_derived / verified_official /
  auto_high_confidence / conflict_resolved 로 고정한다.
```

---

## 최종 수용 기준 (전부 충족해야 완료 보고)

1. `npm run lint`, `npm test`, `npm run build` 3종 통과 (테스트 삭제로 통과시킨 것이 없을 것)
2. `481050` 의 `comparison_category` 가 `금리·파킹` 이고, 피어 4종목이 전부 단기금리·파킹·초단기채 계열일 것
3. 은행 7종의 피어가 STEP 1 이전 상태(증권·보험·금융지주 / 단기채권)를 유지할 것
4. `strategy_style == "plain"` 비율 60% 미만, `fx_hedge == "unknown"` 비율 20% 미만
5. `primary_peer_group_id` 미등록 행 0건, 중복 ticker 0건
6. ETF 상세 페이지에서 피어 4종목에 사유 배지가 실제로 보일 것(스크린샷 또는 렌더링 테스트로 증빙)
7. 보고서 하단에 `git diff --stat` 전문 첨부

## 참고: 검증 스크립트

`.tmp/` 에 전 종목 시뮬레이션 스크립트가 준비돼 있습니다(gitignore 대상, 커밋되지 않음).

```
node .tmp/peer-v2-quality.mjs
```
출력 예시(현재 상태):
```
STAT {"targets":1163,"zeroDirect":654,"brand3":31,"fxMismatchPairs":116,"pairs":4652,"unknownFx":2607,"bondSubtopicMix":162,"bondPairs":884}
```
복구 후 `unknownFx` 가 크게 줄어드는지 확인하고, 그 출력을 보고서에 포함하십시오.

=== 전달 끝 ===
