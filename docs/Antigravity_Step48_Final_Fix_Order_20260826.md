# Antigravity 지시: normalizeEtf 수정과 마무리

작성일: 2026-08-26
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 1. 진단을 채택하고 수정을 승인합니다

**정확한 조사입니다.** `functions/api/internal/ingest-market-source.js` 의 `normalizeEtf()` 가 `navValue`, `disparityPct`, `assetDetail` 을 반환 객체에서 빠뜨려, 그 아래 `etf.navValue ?? null` 이 항상 `null` 이 되는 구조를 정확히 짚으셨습니다.

**제안하신 수정안을 그대로 승인합니다. 즉시 적용하십시오.**

`market_source_etf_daily` 를 직접 조회해 **모든 날짜에서 `nav_count = 0`** 임을 확인하신 것도 결정적입니다. 이 경로는 **처음부터 한 번도 동작한 적이 없었습니다.**

8월 21일의 `briefing_etf_daily` 1,158건이 과거 수동 패치의 잔재였다는 설명도 앞선 `chunk_1.sql` 사고와 정확히 맞아떨어집니다.

---

## 2. 이 버그가 세 곳을 동시에 막고 있었습니다

**`assetDetail` 도 같이 누락되고 있었다는 점이 중요합니다.**

앞서 STEP 3 세부 주도 테마가 비어 있던 원인을 `publish_market_source_snapshot.py` 의 인코딩 문제로 규명하고 고쳤습니다. **그 수정은 필요했지만 충분하지 않았습니다.**

CSV 를 제대로 읽어 `assetDetail` 을 페이로드에 실어도, `normalizeEtf()` 가 그것을 버리고 있었습니다. **두 개의 버그가 같은 필드 위에 겹쳐 있었습니다.**

따라서 이번 한 줄 수정으로 세 가지가 동시에 풀립니다.

```
navValue      →  STEP 4·5 자금 순유입
assetDetail   →  STEP 3 세부 주도 테마
disparityPct  →  괴리율
```

**검증할 때 세 가지를 모두 확인하십시오.** 자금 유입만 보지 마십시오.

---

## 3. 진행

### 3-1. 수정과 배포

`normalizeEtf()` 를 제안하신 대로 고치십시오.

**기존 검증 조건에 새 필드를 넣지 마십시오.** `if (!/^[0-9A-Z]{6}$/...)` 판정에 `navValue` 나 `assetDetail` 을 추가하면 값이 없는 종목이 통째로 거부됩니다. **필드 추가는 반환 객체에만 하십시오.**

`dev` 에 커밋한 뒤 `main` 에 머지하고 배포하십시오. **이번 머지는 승인합니다.**

**Pages 배포가 반영되어야 엔드포인트가 바뀝니다.** 배포 완료를 확인한 뒤 다음 단계로 넘어가십시오.

### 3-2. 재발행

**8월 24일과 8월 25일을 재발행하십시오.**

```
gh workflow run daily-market.yml -f target=20260824
gh workflow run daily-market.yml -f target=20260825
```

**순서대로 하고 각각 완료를 확인한 뒤 다음을 실행하십시오.**

**마지막이 8월 25일이어야 마스터 CSV 가 최신 상태로 남습니다.**

### 3-3. 확인

```
SELECT as_of_date, COUNT(*) AS total,
       COUNT(nav_value) AS nav,
       COUNT(disparity_pct) AS disparity,
       COUNT(NULLIF(asset_detail,'')) AS detail
FROM briefing_etf_daily
WHERE as_of_date IN ('2026-08-24','2026-08-25')
GROUP BY as_of_date ORDER BY as_of_date;
```

**네 값이 모두 `total` 과 같아야 합니다.**

브리핑 API 도 확인하십시오.

```
node -e "fetch('https://etf-campus.pages.dev/api/briefings/latest').then(r=>r.json()).then(j=>{const b=j.briefing; console.log('asOfDate', b.asOfDate); console.log('fundFlow', JSON.stringify(b.fundFlow)?.slice(0,300)); console.log('peerGroups', JSON.stringify(b.peerGroups)?.slice(0,300));})"
```

**`fundFlow` 의 `topInflows` 와 `topOutflows` 에 값이 있어야 합니다.**

**`peerGroups` 에 세부 테마가 나와야 합니다.** "세부 주도 테마가 없습니다" 가 사라져야 합니다.

**마스터 CSV `bas_dt` 분포가 `20260825` 단일값인지** 확인하십시오.

---

## 4. 부수 관찰: 중복 레코드가 쌓이고 있습니다

조회 결과에 다음이 있었습니다.

```
2026-08-21  total = 2316
```

다른 날짜가 1,158건 안팎인데 **8월 21일만 두 배입니다.** 재발행할 때마다 새 `source_version` 으로 행이 추가되고 옛 행이 남기 때문입니다.

**이번에 8월 24일과 25일을 재발행하면 그 날짜들도 두 배가 됩니다.**

**당장 문제는 아닙니다.** 매니페스트가 최신 버전을 `ready` 로 승격시키므로 화면은 올바른 값을 읽습니다.

**다만 재발행을 반복하면 테이블이 계속 커집니다.** 정리 방침을 제안해 보고하십시오. **구현은 이번 범위가 아닙니다.**

---

## 5. 이번 범위 밖

**`marketScale` 백엔드 구현**은 별도 라운드입니다.

**고아 레코드 정리**는 제안만 하십시오.

**시간대별 측정, 지수 출처 전환, 펀드상품기본정보, 라이선스 조사**는 전부 보류입니다.

**`market-briefing-production.yml`** 을 실행하지 마십시오.

---

## 6. 작업 규칙

**검증 조건에 새 필드를 추가하지 마십시오.** 값이 없는 종목이 통째로 거부됩니다.

**막히면 재실행을 반복하지 마십시오.** 로그를 확보하고 보고하십시오. 저장소가 Public 인 시간을 줄여야 합니다.

**과거 날짜 대상 실행 후에는 `bas_dt` 분포를 확인하십시오.**

**`git add .` 와 `git commit -am` 을 쓰지 마십시오.**

**조용한 실패를 만들지 마십시오.**

**`git reset --hard` 와 force push 는 사전 승인 대상입니다.**

**명령을 `;` 로 연결하지 마십시오.**

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오.

`docs/Data_Catalog.md` 는 커밋 대상이고 `Antigravity_Step*.md` 는 커밋하지 마십시오.

보고 전에 `git status --porcelain` 과 `git log --oneline -n 5`, `git rev-parse --abbrev-ref HEAD` 를 실행해 출력을 붙여넣으십시오.

---

## 7. 카탈로그에 기록하십시오

`docs/Data_Catalog.md` 에 다음을 남기십시오.

**`normalizeEtf()` 가 `navValue`, `assetDetail`, `disparityPct` 를 반환 객체에서 누락시켜 D1 적재 시 항상 NULL 이 되던 버그가 2026-08-26 에 수정되었다는 사실입니다.**

**이 버그가 STEP 3 세부 주도 테마와 STEP 4·5 자금 순유입을 동시에 막고 있었다는 점**을 적으십시오.

**교훈을 함께 적으십시오.** 인코딩 수정만으로는 `asset_detail` 이 살아나지 않았습니다. **한 필드가 비어 있을 때 수집 단계만 보지 말고 적재 경로 끝까지 따라가야 합니다.**

**갱신 후 반영된 행 번호를 보고하십시오.**

---

## 8. 진행 순서

**1단계.** `normalizeEtf()` 를 수정하고 `dev` 에 커밋하십시오.

**2단계.** `main` 에 머지하고 배포 완료를 확인하십시오.

**3단계.** 8월 24일, 8월 25일 순서로 재발행하십시오.

**4단계.** 3-3 의 확인을 수행하고 결과를 보고하십시오.

**5단계.** 7번의 카탈로그 갱신을 수행하십시오.

**6단계.** 4번의 정리 방침을 제안하십시오.

**전부 마치고 한 번에 보고하십시오. 그러면 운영자가 Private 로 되돌립니다.**
