# Antigravity 지시: STEP 1 거시 지표 12개 복구

작성일: 2026-08-26
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 0. 확정된 구성

**운영자 결정입니다. 이 구성으로 복구합니다.**

| 열 | 코드 | 표시 라벨 | 출처 | 현재 |
|---|---|---|---|---|
| 국내 증시 | `KOSPI` | 코스피 | D1 브리핑 | **확보** |
| | `KOSDAQ` | 코스닥 | D1 브리핑 | **확보** |
| | `VKOSPI` | 코스피 변동성지수 | KRX Open API | **신규** |
| 미국 증시 | `SPX` | S&P 500 | Yahoo `^GSPC` | **확보** |
| | `NDX` | 나스닥 | Yahoo `^IXIC` | **확보** |
| | `VIX` | VIX | Yahoo `^VIX` | **확보** |
| 환율·금리 | `USDKRW` | 원/달러 | Yahoo `KRW=X` | **확보** |
| | `KR10Y` | 국고채 10년 | 한국은행 ECOS | **신규** |
| | `DGS10` | 미 국채 10년물 | Yahoo `^TNX` | **확보** |
| 원자재 | `CLF` | WTI 원유 | Yahoo `CL=F` | **확보** |
| | `GC` | 금 선물 | Yahoo `GC=F` | **확보** |
| | `SI` | 은 선물 | Yahoo `SI=F` | **확보** |

**변경점 두 가지입니다.**

**세 번째 열 이름이 "채권 및 금리" 에서 "환율·금리" 로 바뀝니다.**

**`T10Y2Y`(장단기 금리차)가 빠지고 `USDKRW`(원/달러)가 들어갑니다.** 미국 2년물이 Yahoo 에 없어 계산이 불가능하기 때문입니다.

**니케이 225 는 더 이상 쓰지 않습니다. 수집에서 제거합니다.**

---

## 1. 중요: 12개 중 10개는 이미 확보되어 있습니다

**`VKOSPI` 와 `KR10Y` 두 개만 새로 수집하면 됩니다.**

나머지 열 개는 `data/market_indices.json` 과 D1 브리핑에 이미 들어 있습니다. **프런트엔드만 고치면 즉시 표시됩니다.**

**따라서 작업 A 를 먼저 끝내고 배포하십시오.** 그것만으로 열 개가 살아납니다. 작업 B 와 C 는 그다음입니다.

---

## 2. 작업 A: 프런트엔드 복구 (최우선)

### 2-1. 원본 구현

운영자가 제공한 오전 백업본의 `orderedIndices` 입니다. **현재 코드는 이 구조가 통째로 사라지고 필터로 대체되어 있습니다.**

```javascript
import globalIndicesData from "@/data/market_indices.json";   // 5행

const orderedIndices = useMemo(() => {
  if (!briefing) return [];

  const mergedIndices = [...briefing.marketIndices];

  const addGlobalIndex = (label: string, code: string) => {
    const found = globalIndicesData.indices.find(
      i => i.label === label || i.label === label.replace(" ", "")
    );
    if (found && !mergedIndices.some(m => m.code === code)) {
      mergedIndices.push({
        code: code,
        label: label,
        close: found.value,
        change_pct: found.change,
        as_of_date: briefing.asOfDate,
      });
    }
  };

  addGlobalIndex("S&P 500", "SPX");
  addGlobalIndex("나스닥", "NDX");
  addGlobalIndex("원/달러", "USDKRW");

  const order = ["KOSPI", "KOSDAQ", "SPX", "NDX", "USDKRW"];

  return mergedIndices.sort((a, b) => {
    const idxA = order.indexOf(a.code);
    const idxB = order.indexOf(b.code);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}, [briefing]);
```

**핵심은 병합입니다.** D1 브리핑은 KOSPI 와 KOSDAQ 만 갖고, 나머지는 JSON 파일에서 라벨로 찾아 코드를 붙여 넣습니다. **필터가 없습니다.** 걸러내는 것은 네 개 열의 `filter` 가 담당합니다.

### 2-2. 이 구조로 되돌리고 호출을 확장하십시오

`addGlobalIndex` 호출을 다음과 같이 늘리십시오.

```javascript
addGlobalIndex("S&P 500", "SPX");
addGlobalIndex("나스닥", "NDX");
addGlobalIndex("VIX", "VIX");
addGlobalIndex("원/달러", "USDKRW");
addGlobalIndex("미 국채 10년물", "DGS10");
addGlobalIndex("WTI 원유", "CLF");
addGlobalIndex("금 선물", "GC");
addGlobalIndex("은 선물", "SI");
```

**라벨 문자열은 `data/market_indices.json` 을 열어 그대로 복사하십시오.** 한 글자라도 다르면 조용히 안 붙습니다. **위 문자열도 확인 없이 믿지 마십시오.**

`order` 배열도 표시 순서에 맞게 확장하십시오.

### 2-3. 세 번째 열을 수정하십시오

**제목을 "채권 및 금리" 에서 "환율·금리" 로 바꾸십시오.**

**필터를 다음과 같이 바꾸십시오.**

```javascript
["USDKRW", "KR10Y", "DGS10"]
```

**나머지 세 열의 필터는 백업본과 같습니다. 건드리지 마십시오.**

```
국내 증시   ["KOSPI", "KOSDAQ", "VKOSPI"]
미국 증시   ["SPX", "NDX", "VIX"]
원자재      ["CLF", "GC", "SI"]
```

### 2-4. 이 시점의 기대 결과

```
국내 증시   2개   (VKOSPI 미수집)
미국 증시   3개
환율·금리   2개   (KR10Y 미수집)
원자재      3개
```

**열 개가 표시되면 작업 A 성공입니다. 커밋하고 배포한 뒤 확인해 보고하십시오.**

---

## 3. 작업 B: VKOSPI 수집

### 3-1. 엔드포인트를 확인하십시오

**KRX Open API 에 변동성지수가 있는 것으로 운영자가 확인했습니다.**

현재 지수 수집은 `scripts/fetch_market_indices.py` 18~21행에서 이렇게 합니다.

```
https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd
https://data-dbg.krx.co.kr/svc/apis/idx/kosdaq_dd_trd
```

**같은 `idx` 계열에 변동성지수 엔드포인트가 있는지 KRX Open API 서비스 목록에서 확인하십시오.**

```
https://openapi.krx.co.kr/contents/OPP/INFO/service/OPPINFO004.cmd
```

**엔드포인트 이름을 추정하지 마십시오.** 서비스 목록에서 확인한 정확한 경로를 쓰십시오.

**찾지 못하면 그 사실을 보고하고 멈추십시오.**

### 3-2. 응답 확인

찾았으면 실제 호출해 다음을 보고하십시오.

**응답 전체 키 목록**입니다. 한 행을 키와 값과 함께 출력하십시오.

**지수명 필드에 어떤 값들이 있는지**입니다. 코스피200 변동성지수를 정확히 선별할 기준이 필요합니다.

**종가와 등락률에 해당하는 필드명**입니다.

### 3-3. 수집 추가

확인된 내용으로 `fetch_market_indices.py` 에 추가하십시오.

**`data/market_indices.json` 에 `label` 을 "코스피 변동성지수" 로 넣으십시오.** 그리고 `market-briefing.tsx` 에 `addGlobalIndex("코스피 변동성지수", "VKOSPI");` 를 추가하십시오.

**라벨을 양쪽에서 정확히 일치시키십시오.**

---

## 4. 작업 C: 국고채 10년 수집

### 4-1. 운영자 수행 사항

**한국은행 ECOS 인증키를 운영자가 발급받았습니다.**

**운영자가 `.dev.vars` 와 GitHub Secrets 에 키를 넣습니다.** 이름은 `ECOS_API_KEY` 로 합니다.

**키를 요청하거나 직접 넣지 마십시오. 없으면 대기하십시오.**

### 4-2. 통계코드를 확인하십시오

**ECOS 는 통계표코드와 항목코드로 조회합니다. 추정하지 마십시오.**

**통계목록 API 로 국고채 10년 금리에 해당하는 코드를 찾으십시오.**

```
https://ecos.bok.or.kr/api/StatisticTableList/{키}/json/kr/1/100/
```

**시장금리 계열 통계표를 찾고, 그 안의 항목 목록에서 국고채(10년)을 특정하십시오.**

```
https://ecos.bok.or.kr/api/StatisticItemList/{키}/json/kr/1/100/{통계표코드}
```

**찾은 통계표코드와 항목코드를 보고하십시오.**

### 4-3. 확인할 것

**주기**입니다. 일별(`D`)이 있는지, 월별만 있는지입니다.

**갱신 시각**입니다. 파이프라인이 KST 08:07 부터 도는데 그 시점에 전일 값이 있는지입니다. **실제로 조회해 확인하십시오.**

**일 호출 제한과 이용약관**입니다. 상업적 이용 가능 여부를 확인해 원문을 인용하십시오.

**앞서 수출입은행 환율에서 갱신 시각 때문에 문제가 있었습니다. 같은 확인이 필요합니다.**

### 4-4. 수집 추가

**FRED 는 쓰지 마십시오.** 이 저장소 환경과 GitHub Actions 러너 양쪽에서 타임아웃이 확인되었습니다.

`data/market_indices.json` 에 `label` 을 "국고채 10년" 으로 넣고, `addGlobalIndex("국고채 10년", "KR10Y");` 를 추가하십시오.

---

## 5. 작업 D: 니케이 225 제거

`scripts/fetch_market_indices.py` 의 `TICKERS` 에서 `"니케이 225": "^N225"` 를 제거하십시오.

**`components/market-ticker.tsx` 의 `excludedLabels` 도 확인하십시오.** 니케이가 티커에 노출되고 있었다면 관련 처리를 정리해야 합니다.

**다른 지표를 함께 지우지 마십시오.**

---

## 6. 검증

**작업 A 완료 시점**과 **작업 B, C 완료 시점** 각각에서 확인하십시오.

**네 열에 각각 몇 개가 표시되는지** 보고하십시오.

**`data/market_indices.json` 의 라벨 목록**을 출력해 컴포넌트의 `addGlobalIndex` 호출과 하나씩 대조하십시오.

**최종 목표는 12개 전부 표시입니다.**

---

## 7. 이번 범위 밖

**파이프라인의 D1 경로를 건드리지 마십시오.** `publish_market_source_snapshot.py`, `ingest-market-source.js`, `source-materializer.ts` 전부입니다.

**`cba7821` 을 되돌리지 마십시오.** D1 브리핑이 KOSPI 와 KOSDAQ 만 갖는 것은 원래 설계와 일치합니다.

**KOSPI, KOSDAQ 을 Yahoo 로 옮기지 마십시오.** 가능하다는 것은 확인했으나 이번 범위가 아닙니다.

**`Antigravity_Step52` 지시서는 폐기되었습니다.** 따르지 마십시오.

**Step51 의 아카이브 사전 조사와 브리핑 데이터 정리는 그대로 진행하십시오.** 이 건과 독립입니다.

**`marketScale` 백엔드, URL 구조 변경, 사이트맵**은 별도 라운드입니다.

---

## 8. 작업 규칙

**엔드포인트, 통계코드, 라벨 문자열을 추정하지 마십시오.** 서비스 목록과 파일에서 확인한 값을 쓰십시오.

**라벨은 양쪽에서 정확히 일치해야 합니다.** JSON 과 컴포넌트를 대조하십시오.

**찾지 못하면 우회로를 만들지 말고 보고하고 멈추십시오.**

**작업 A 를 먼저 끝내고 배포하십시오.** 열 개가 먼저 살아나는 것이 중요합니다.

**워크플로 실행을 남발하지 마십시오.** 작업 A 는 프런트엔드 변경이므로 Pages 빌드만 있으면 됩니다.

**자격증명을 요청하거나 코드에 넣지 마십시오.**

**`git add .` 와 `git commit -am` 을 쓰지 마십시오.**

**조용한 실패를 만들지 마십시오.**

**명령을 `;` 로 연결하지 마십시오.**

**스크립트는 `scratch/` 안에 파일로 만들어 실행하십시오.**

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오.

`Antigravity_Step*.md` 는 커밋하지 마십시오.

보고 전에 `git status --porcelain` 과 `git log --oneline -n 5`, `git rev-parse --abbrev-ref HEAD` 를 실행해 출력을 붙여넣으십시오.

---

## 9. 진행 순서

**1단계.** 작업 A 를 구현하고 배포한 뒤 **네 열의 표시 개수를 보고하십시오.** 열 개가 나와야 합니다.

**2단계.** 작업 D(니케이 제거)를 함께 처리하십시오.

**3단계.** 작업 B 의 3-1 과 3-2 를 조사해 보고하십시오. **읽기 전용입니다.**

**4단계.** 작업 C 의 4-2 와 4-3 을 조사해 보고하십시오. **읽기 전용입니다. 키가 없으면 대기하십시오.**

**3단계와 4단계를 한 번에 보고하고 멈추십시오.**

**5단계.** 승인 후 두 지표의 수집을 구현하고 12개 전부 표시되는지 확인해 보고하십시오.
