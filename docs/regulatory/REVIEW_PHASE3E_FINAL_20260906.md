# [최종 검토] Phase 3E 마무리 확인 및 종결 지시

- 작성일: 2026-09-06
- 검증 방식: 원장·큐·마스터 전수, summary 파일 대조, 줄바꿈 실측, 스크립트 출력 경로 확인

---

## 0. 결론

**지시 항목이 전건 이행되었고, 남은 문제는 하나뿐입니다.**

| 검증 항목 | 결과 |
|---|---|
| 원장 1,163 + 큐 4 = 1,167, 교집합 0, 마스터 Y 1,163 | **PASS** |
| `evidence_tier`에서 `statutory` 제거, 3way 633 / 2way 87 / 1way 443 | **PASS** |
| 법령 근거 829건 (71.0%) 산출 | **PASS** — E1 2 + E1B 13 + E2 1 + E3 813 |
| 0198A0 승격 (E4 / 2way / 운용사공시대조) | **PASS** |
| CSV LF 정규화 (master·ledger·audit·queue) | **PASS** — 4개 전부 LF |
| **summary.json** | **정본이 낡았습니다** |

---

## 1. 유일한 문제 — summary가 두 개로 갈렸습니다

저장소에 서로 다른 값을 담은 요약 파일이 **두 개** 있습니다.

```
data/reports/pension_verification_summary.json      471 bytes  01:02
  → verified 1155 / unverified 12          ← Phase 3D에 멈춤
  → generate_summary_report.py가 쓰는 경로
  → pension_regulatory_engine.py, verify_kofia_pension.py도 이 경로를 참조

data/regulatory/pension_verification_summary.json  1,766 bytes  02:00
  → verified_count 1163 / unverified 4      ← 최신, 이중 지표 완비
  → 이 경로를 읽는 코드가 없음
```

**정본은 낡았고, 최신본은 고아입니다.**

내용 자체는 훌륭합니다. 이중 지표 구조가 제가 요청한 형태 그대로입니다.

```json
"법령근거_확보": {"건수": 829, "비율": 71.0, "구성": {"E1":2,"E1B":13,"E2":1,"E3":813}},
"실무_확인":    {"건수": 1163, "비율": 99.7},
"교차검증_강도": {"3way": 633, "2way": 87, "1way": 443}
```

문제는 **위치**입니다. `generate_summary_report.py`의 출력 경로는 여전히 `data/reports/`이므로, 다음에 그 스크립트를 돌리면 최신 구조가 아니라 옛 형식으로 덮어씁니다.

### 지시

1. `generate_summary_report.py`를 **이중 지표 구조로 수정**하고 출력은 `data/reports/pension_verification_summary.json` **정본 경로 유지**
2. `data/regulatory/pension_verification_summary.json` **삭제**
3. 스크립트에 단언문 추가

```python
assert summary["verified_count"] == len(ledger_rows)
assert summary["verified_count"] == master_Y_count
assert summary["verified_count"] + summary["unverified_count"] == 1167
assert 법령근거_합계 == E1 + E1B + E2 + E3
```

4. **R12 규칙 신설** — 이런 어긋남을 게이트가 잡도록

```
R12: summary.json의 verified_count == 검증 원장 행수 == 마스터 pension_verified='Y' 수
     == total - 큐 행수. 하나라도 다르면 위반.
```

Phase 3B에서 지적한 "summary가 원장에서 산출되지 않음"의 변종입니다. 이번엔 **내용은 정확한데 위치가 틀렸고**, 그 결과 서로 다른 두 값이 공존합니다. R12가 있으면 다시 생기지 않습니다.

---

## 2. 나머지는 전부 확인했습니다

### 0198A0 승격이 정확합니다

```
verified_limit : 70% (위험자산)
source_type    : 운용사공시대조
evidence_grade : E4      evidence_tier : 2way      expires_at : 2026-11-29
note  : 키움투자자산운용 공식 공시 퇴직연금 편입가능(70%) 확인. 한국투자증권 미취급(라인업 사유)
quote : 키움 공식 상품 API pensionFlags: ['개인연금', '퇴직연금']. 파생상품 위험평가액 40% 이하 충족
```

R-d 논리가 정확히 적용되었고, `note`에 판매사 미취급 사유까지 남겼습니다. 290080·489030의 불가 판정과 논리적으로 대칭입니다.

### 지표 분리가 의도대로 되었습니다

```
tier : 3way 633 / 2way 87 / 1way 443     ← statutory 제거, 출처 개수 전용
grade: E3 813 / E4 231 / RULE_NAME 103 / E1B 13 / E1 2 / E2 1
법령근거 = E1 2 + E1B 13 + E2 1 + E3 813 = 829건 (71.0%)
```

`RULE_NAME` 103건을 법령 근거에서 제외한 판단도 옳습니다. 판정키가 조문이 아니라 상품명이기 때문입니다.

### LF 정규화도 실측 확인

`etf_master_draft.csv`, `pension_verification_ledger.csv`, `pension_audit_ledger.csv`, `pension_unverified_queue.csv` 4개 전부 LF입니다. 다음 달 diff부터 실제 변경분만 보입니다.

---

## 3. 종결 체크리스트

이제 작업이 아니라 **운영**으로 넘어갑니다. 아래 4가지가 끝나면 이 과제는 종결입니다.

### 즉시

- [ ] §1 — `generate_summary_report.py` 이중 지표 반영 + 정본 경로 유지 + 고아 파일 삭제 + 단언문 4개
- [ ] §1 — R12 규칙 신설 및 테스트 고정

### 9월 30일 (파이프라인 첫 실전)

- [ ] 한국투자증권 9월 엑셀 다운로드 → `refresh_monthly_pension_universe.py` 실행
- [ ] 확인: `newly_included`에 신규상장 4건이 잡히는가
- [ ] 확인: R-e 불변성 규칙이 새 파일명(`…_20260930.txt`)을 정상 생성하는가
- [ ] 확인: `expires_at`이 새 기준일 + 90일로 갱신되는가
- [ ] 확인: `limit_changes`에 경고가 뜨면 사람이 판단했는가

### 발행사 스냅샷도 월간 갱신 대상입니다

뱃지는 약관 개정으로 바뀝니다. 6곳(TIGER·KODEX·ACE·RISE·PLUS·KIWOOM) 수집을 refresh 스크립트에 포함시키고, 스냅샷 diff에서 **뱃지가 바뀐 종목**을 리포트하도록 하십시오. 그것이 약관 개정의 조기 신호입니다.

### 화면 주석 2건은 반드시 살아 있어야 합니다

- `357870` `477080` — "증권사에 따라 안전자산으로 분류될 수 있습니다. 실제 한도는 가입한 퇴직연금사업자에서 확인하십시오"
- `0198A0` — "일부 증권사에서 취급하지 않을 수 있습니다"

---

## 4. 지금 도달한 지점

```
검증        1,163건 (99.7%)
잔여            4건 — 전부 8/26 신규상장 시차, 9월 엑셀로 자동 해소
법령 근거      829건 (71.0%)
교차검증      3way 633 / 2way 87 / 1way 443
외부 원본     판매사 1곳(월간 공개 엑셀) + 발행사 6곳
한투 대조     불일치 2건 (357870·477080, 법령 우선 판정)
```

**구조적 잔여가 0건입니다.** 남은 4건은 전부 시차이며 이달 말 자동으로 해소됩니다.

무엇보다, 이 상태의 가치는 99.7%라는 숫자가 아닙니다. **1,163건 하나하나가 외부 원본 파일에 연결되어 있고, 제가 그 원본을 열어서 대조할 수 있다**는 점입니다. Phase 2D의 자작 CSV를 되돌린 뒤 여기까지 오는 데 여섯 번의 라운드가 걸렸지만, 그때 되돌린 것이 지금의 신뢰를 만들었습니다.

---

## 5. 앞으로의 관리 지표

```
1차   잔여 미검증 건수           목표 5건 이하        현재 4건 ✅
2차   잔여 사유 설명 가능        목표 100%           현재 100% ✅
3차   법령 근거율 / 실무 확인율   분리 보고 유지       829 / 1,163 ✅
4차   월간 파이프라인 무인 실행   9월 30일 첫 검증     대기
```

검증률 백분율은 4개 중 하나의 보조 지표로 두십시오. **10월에 신규 상장이 5건 생기면 99.7%는 자동으로 내려갑니다.** 그때 중요한 것은 백분율이 아니라 "5건이 왜 남았는지 설명 가능한가"와 "파이프라인이 알아서 잡았는가"입니다.

Phase 2D가 가르쳐 준 것이 그것입니다.
