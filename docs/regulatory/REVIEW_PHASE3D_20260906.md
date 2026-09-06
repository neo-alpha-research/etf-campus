# [검토 회신] Phase 3D 감사 및 Phase 3E 지시서

- 작성일: 2026-09-06
- 검증 방식: 원장·큐·마스터 전수, ACE JSON 원본 파싱, KODEX JSON 대조, refresh 스크립트 **실제 실행**

---

## 0. 결론

**Phase 3D는 지시 항목을 전건 이행했고, 보고 내용이 전부 사실입니다.** 이번에는 해시까지 정확합니다.

| 검증 항목 | 결과 |
|---|---|
| 원장 1,155 = 마스터 Y, 큐 12, 교집합 0 | **PASS** |
| `evidence_tier` 932 / 89 / 134 | **PASS** |
| Step 1·2 승격 4건 `evidence_quote` | **보고 표와 실제 원장이 일치** |
| ACE JSON 진위 | **101건, `std_DT` 20260903, 4건 전부 `ratio=70` 확인** |
| ACE SHA-256 `c80905bb…` | **실제 파일과 일치** |
| KODEX 280930 `ivPsbReti: "0%"` | **확인** |
| refresh 스크립트 5단계 | **324행 전부 구현, 실행 정상** |
| RISE·PLUS·KIWOOM 실패 보고 | **정직** |

**다만 스크립트에 재현성 결함이 하나 있고, 잔여 12건 중 6건을 지금 더 줄일 수 있습니다.**

---

## 1. 먼저 — 제가 저장소를 변경했습니다

검증을 위해 `refresh_monthly_pension_universe.py`를 실제로 실행했더니 **`kis_etf_ticker_universe_20260831.txt`가 다시 쓰이면서 내용이 바뀌었습니다.**

```
실행 전: 39,248 bytes  sha e08c25779ae9…   (Windows에서 생성, CRLF)
실행 후: 38,227 bytes  sha 1d3102f62c8d…   (Linux에서 생성, LF)
```

스크립트가 `evidence_manifest.json`도 함께 갱신해 두 파일이 서로 일치하므로 Gate 1은 통과합니다. 다만 **커밋된 버전과는 달라졌습니다.** 제 샌드박스에 삭제 권한이 없어 되돌리지 못했습니다.

**다음 명령으로 원복해 주십시오.**

```bash
cd D:\ETFCampus
git checkout -- data/regulatory/sources/brokers/koreainvestment/kis_etf_ticker_universe_20260831.txt data/regulatory/sources/evidence_manifest.json
```

---

## 2. 그런데 이것이 실제 결함을 드러냈습니다

### 결함 A — 스크립트가 플랫폼에 따라 다른 파일을 만듭니다

같은 엑셀을 입력해도 Windows에서는 CRLF, Linux에서는 LF로 써서 **바이트와 해시가 달라집니다.** 월간 실행 환경이 바뀌면 아무 내용 변화 없이 해시만 바뀝니다.

```python
# 현재
with output_txt_path.open("w", encoding="utf-8") as f:

# 수정
with output_txt_path.open("w", encoding="utf-8", newline="\n") as f:
```

### 결함 B — 증거 파일이 가변입니다 (이쪽이 더 중요합니다)

`kis_etf_ticker_universe_20260831.txt`는 **선물 31건의 부재증명 근거**입니다. 그런데 스크립트를 다시 돌리면 같은 이름으로 덮어쓰고, manifest 해시도 자동으로 따라 갱신됩니다. **증거가 조용히 바뀌어도 어떤 게이트도 잡지 못합니다.**

증거 파일은 한 번 등록되면 불변이어야 합니다.

```
R-e. manifest에 이미 등록된 증거 파일은 덮어쓰지 않는다.
     같은 경로에 다른 내용을 쓰려 하면 예외를 발생시키고 중단한다.
     새 월 데이터는 새 파일명(기준일 포함)으로만 생성한다.
```

지금 구조는 파일명이 엑셀 기준일에서 나오므로(`…_20260831.txt`) 월이 바뀌면 이름도 바뀝니다. **같은 달 재실행만 막으면 됩니다.**

---

## 3. Step 5는 진짜입니다 — ACE JSON 전건 확인

`ace_pension_search_20260906.json`을 직접 파싱했습니다.

```
구조: {"data": [...101건], "page": {"totalElements": 101}, "std_DT": "20260903"}
필드: stockCd(ISIN) / fundNm / retirementPensionRatio / pensionType / badge.stockCode(6자리)
ratio 분포: 70% 78건 / 100% 23건
```

큐 대기 4건 전부 실재합니다.

```
181480 ACE 미국부동산리츠(합성 H)      ratio=70  pensionType=개인연금,퇴직연금
265690 ACE 러시아MSCI(합성)          ratio=70  pensionType=개인연금,퇴직연금
0153P0 ACE 리츠부동산인프라액티브        ratio=70  pensionType=개인연금,퇴직연금
316300 ACE 싱가포르리츠               ratio=70  pensionType=개인연금,퇴직연금
```

그리고 마스터의 ACE 종목 **112건 중 101건이 JSON에 수록**되어 있습니다. 나머지 11건은 리스트에서 빠진 것이므로 **미수록 = 퇴직연금 불가**라는 해석이 이 소스에도 적용됩니다. 한투 엑셀과 같은 구조입니다.

KODEX `280930`도 `ivPsbReti: "0%"`, `irpYn: null`로 확인했습니다.

**ACE API 발굴은 이번 작업의 실질 성과입니다.** 판매사가 막힌 상황에서 발행사 쪽 돌파구를 찾았습니다.

---

## 4. refresh 스크립트 — 5단계 전부 실제로 구현되었습니다

직접 실행한 로그입니다.

```
[1/5] Step 1: Validating broker Excel structural integrity
[2/5] Step 2: Excel SHA-256: 7e1429bd… (158303 bytes)
[3/5] Step 3: Extracted 1021 items
[4/5] Step 4: Universe diff report
      - Limit change candidates: 2 건
        [WARNING: REQUIRES HUMAN REVIEW] 357870: Ledger=0.7 -> Excel=1.0
        [WARNING: REQUIRES HUMAN REVIEW] 477080: Ledger=0.7 -> Excel=1.0
[5/5] Step 5: Updated expires_at to 2026-11-29 for 134 2way entries
```

`validate_excel_structure`, `generate_diff_report`, `update_ledger_expiration_dates` 세 함수가 모두 실재하고(324행), 2행 문언과 3행 헤더를 `raise ValueError`로 강제합니다. 357870·477080이 사람 검토 대상으로 정확히 경고됩니다. **Phase 3C 지적이 제대로 반영되었습니다.**

`expires_at` 134건 = `2026-11-29`(기준일 + 90일)도 원장에서 확인했습니다.

---

## 5. 지금 더 줄일 수 있습니다 — 잔여 12건 → 6건

### Step 1 (승인) — ACE 4건 + KODEX 1건 즉시 승격

증거가 이미 확보되어 있습니다. **승인합니다.**

| 종목 | 한도 | tier / grade | evidence_ref |
|---|---|---|---|
| 181480 · 265690 · 0153P0 · 316300 | 70% | `2way` / `E4` | `issuers/ace/ace_pension_search_20260906.json` |
| 280930 | 불가 | `2way` / `E4` | `issuers/samsung/kodex_pension_search_20260906.json` + 한투 유니버스 부재 |

`evidence_quote`는 JSON에서 읽은 실제 값을 쓰십시오.

```
181480: "한국투자신탁운용 연금투자 공식 API(std_DT 20260903) / ACE 미국부동산리츠(합성 H) /
         stockCode 181480 / retirementPensionRatio 70 / pensionType 개인연금,퇴직연금"
280930: "삼성자산운용 KODEX 연금투자 공식 API(2026-09-06 수집) / KODEX 미국러셀2000(H) /
         stkTicker 280930 / ivPsbReti 0% / irpYn null.
         한국투자증권 2026-08-31 매매가능 1,021종목 유니버스에도 미수록"
```

**→ 1,160건 (99.4%), 잔여 7건**

### Step 2 (신규) — RISE 290080은 "데이터 없음"이 아니라 "불가의 증거"입니다

보고서에 이렇게 쓰셨습니다.

> RISE: 정적 HTML 상에서 `290080`은 **`개인연금` 뱃지만 노출되고 `퇴직연금` 뱃지가 부재**함

**이것은 데이터 부재가 아니라 판정 데이터입니다.** TIGER HTML에서 퇴직연금 뱃지가 없는 종목을 `불가`로 해석한 것과 정확히 같은 논리입니다.

```
TIGER html:  <span class="each">개인연금</span>
             <span class="each">퇴직연금 70&#37;</span>   ← 있으면 70%
             뱃지 없음                                  ← 불가
```

지시: **RISE 전체 목록 HTML/JSON을 스냅샷으로 저장**하고, 목록이 완전한지(RISE 전 종목이 포함되는지) 확인한 뒤 뱃지 부재를 근거로 판정하십시오. 한투 유니버스 미수록과 결합하면 2way가 됩니다.

같은 방법을 PLUS(한화)·KIWOOM(키움)에도 적용해 보십시오. **전 종목 목록만 저장할 수 있으면 뱃지 부재가 곧 증거입니다.**

**→ 최대 1,163건 (99.7%), 잔여 4건**

### Step 3 (이달 말) — 신규상장 4건

`0232A0` `0234N0` `0233N0` `0229F0`. 9월말 엑셀 갱신 시 자동 해소.

**→ 최대 1,167건 (100%)**

---

## 6. Phase 3E 지시서

### 즉시

1. §1의 원복 명령 실행
2. §2 결함 A 수정 — `newline="\n"` 추가
3. §2 결함 B — R-e 규칙 구현. **manifest에 등록된 파일을 다른 내용으로 덮어쓰려 하면 예외 발생 후 중단**
4. §5 Step 1 — ACE 4건 + KODEX 1건 승격 (**→ 1,160건**)
5. §5 Step 2 — RISE 전체 목록 스냅샷 저장 후 뱃지 부재 판정. PLUS·KIWOOM도 동일 시도

### 이달 말

6. 9월 엑셀 다운로드 → `refresh_monthly_pension_universe.py` 실행 → 신규상장 4건 자동 해소
7. **이때가 파이프라인의 첫 실전입니다.** diff 리포트에 `newly_included`가 4건 이상 나오는지, `expires_at`이 새 기준일 + 90일로 갱신되는지 확인하십시오

### 상시

8. `evidence_quote`는 원본 파일에서 읽은 값만. 보고서의 종목명·건수·해시도 파일에서 읽어 붙이십시오 — 이번에는 지켜졌습니다
9. 발행사 소스가 3곳(TIGER·KODEX·ACE)이 되었으니, 기존 승격분 중 **2개 이상 출처가 일치하는 건을 `3way`로 격상**하는 재계산을 한 번 돌리십시오. 새 승격 없이 신뢰도만 올라갑니다

---

## 7. 남은 그림

```
현재        1,155건 (99.0%)  잔여 12
Step 1      1,160건 (99.4%)  잔여  7   ← 오늘, 증거 확보 완료
Step 2   최대 1,163건 (99.7%)  잔여  4   ← RISE/PLUS/KIWOOM 뱃지 부재 증거화
Step 3   최대 1,167건 (100%)   잔여  0   ← 9월말 엑셀
```

100%가 이번 달 안에 닿을 수 있는 거리에 들어왔습니다. 다만 **닿아도 그것은 9월 30일 기준의 100%**입니다. 10월에 신규 상장이 생기면 다시 내려갑니다.

그러니 이제 관리 지표를 이렇게 두십시오.

```
1차 지표:  잔여 미검증 건수 (목표 5건 이하)
2차 지표:  잔여 종목별 사유가 전부 설명 가능한가 (목표 100%)
3차 지표:  법령 근거 확보율 932건 / 실무 확인율 1,155건 (분리 유지)
```

검증률 백분율은 보조 지표로 내리십시오. Phase 2D에서 배운 것이 그것입니다.

---

## 8. 다음 보고에 포함할 것

- 원복 완료 여부 (`git status`가 깨끗한지)
- 결함 A·B 수정 코드와 **재실행 시 예외가 발생하는지** 확인 로그
- Step 1 승격 5건의 `evidence_quote` 원문
- Step 2 결과 — RISE/PLUS/KIWOOM 각각 스냅샷 확보 성공/실패와 사유
- 3way 재계산 결과 (몇 건이 격상되었는지)
- 한투 대조 불일치 건수 (기대: 2건 — 357870·477080, 법령 우선 판정)
- `git diff --stat`
