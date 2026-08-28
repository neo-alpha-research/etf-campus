# Antigravity 지시: STEP 1 프런트엔드 원복

작성일: 2026-08-26
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 0. 직전 지시서를 폐기합니다

**`Antigravity_Step52_Step1_Restore_Order_20260826.md` 의 지시를 따르지 마십시오. 폐기합니다.**

그 지시서는 파이프라인이 원인이라고 보고 D1 지수 제약을 조사하라고 했습니다. **틀렸습니다.**

운영자가 백업본을 제공해 원본 구현을 확인한 결과, **원인은 프런트엔드 한 곳이며 파이프라인은 건드릴 필요가 없습니다.**

**D1 지수 제약 조사, 마이그레이션, 워크플로 실행을 하지 마십시오.**

---

## 1. 확인된 원본 구현

`components/market-briefing/market-briefing.tsx` 백업본의 `orderedIndices` 입니다.

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

### 1-1. 설계의 핵심

**글로벌 지수는 D1 이 아니라 `data/market_indices.json` 파일에서 직접 병합합니다.**

**D1 브리핑이 KOSPI 와 KOSDAQ 만 갖는 것은 원래 설계와 일치합니다.** 파이프라인은 정상입니다.

**필터가 없습니다.** 정렬만 하고 전부 반환합니다. 걸러내는 것은 네 개 열의 `filter` 가 담당합니다.

**`label` 로 찾아 `code` 로 저장합니다.** JSON 의 한글 라벨과 내부 코드를 이 함수가 이어 줍니다.

---

## 2. 현재 코드가 어떻게 망가졌는가

```javascript
const targetCodes = ["KOSPI", "KOSDAQ", "^GSPC", "^IXIC", "KRW=X"];
return briefing.marketIndices
  .filter(item => targetCodes.includes(item.code))
  .sort(...)
```

**세 가지가 잘못되었습니다.**

**병합 로직이 사라졌습니다.** `globalIndicesData` 를 쓰지 않습니다.

**필터가 생겼습니다.** 다섯 코드 외에는 전부 버립니다.

**벤더 심볼을 씁니다.** `^GSPC`, `^IXIC`, `KRW=X` 인데, 네 열의 필터는 `SPX`, `NDX`, `USDKRW` 같은 내부 코드를 찾습니다. **절대 일치하지 않습니다.**

그래서 국내 증시 열만 KOSPI 와 KOSDAQ 두 개가 나오고 나머지 세 열이 빕니다.

---

## 3. 작업 A: 원복

**`orderedIndices` 를 1번의 백업본 코드로 되돌리십시오.**

**5행의 `import globalIndicesData from "@/data/market_indices.json";` 이 있는지 확인하고 없으면 추가하십시오.**

**`orderedIndices` 외의 다른 부분은 건드리지 마십시오.**

---

## 4. 작업 B: 네 열을 모두 채우십시오

원복만 하면 국내 증시와 미국 증시 일부만 채워집니다. **채권 및 금리, 원자재 열이 여전히 빕니다.**

### 4-1. 네 열이 찾는 코드

`market-briefing.tsx` 의 열 필터입니다. **이 부분은 백업본과 현재가 동일하므로 바꾸지 마십시오.**

```
국내 증시      KOSPI, KOSDAQ, VKOSPI
미국 증시      SPX, NDX, VIX
채권 및 금리    KR10Y, DGS10, T10Y2Y
원자재         CLF, GC, SI
```

### 4-2. `market_indices.json` 에 있는 라벨

```
S&P 500, 나스닥, 니케이 225, 원/달러,
미 국채 10년물, VIX, WTI 원유, 금 선물, 은 선물
```

### 4-3. `addGlobalIndex` 호출을 추가하십시오

**기존 세 줄에 다음을 더하십시오.**

```javascript
addGlobalIndex("VIX", "VIX");
addGlobalIndex("미 국채 10년물", "DGS10");
addGlobalIndex("WTI 원유", "CLF");
addGlobalIndex("금 선물", "GC");
addGlobalIndex("은 선물", "SI");
```

**`order` 배열에도 새 코드를 추가하십시오.** 표시 순서를 정합니다.

**추가 전에 `data/market_indices.json` 의 실제 `label` 문자열을 확인하십시오.** 한 글자라도 다르면 조용히 안 붙습니다. **파일을 열어 라벨을 그대로 복사하십시오.**

### 4-4. 채울 수 없는 코드

`VKOSPI`, `KR10Y` 는 현재 수집하지 않습니다. **JSON 에 없으므로 채울 수 없습니다.**

`addGlobalIndex` 는 찾지 못하면 아무것도 하지 않으므로 **호출을 넣어도 무해합니다. 다만 넣지 마십시오.** 없는 것을 넣으면 나중에 왜 안 나오는지 다시 찾게 됩니다.

**결과적으로 열별 표시 개수는 다음과 같습니다.**

```
국내 증시      2개  (KOSPI, KOSDAQ)
미국 증시      3개  (SPX, NDX, VIX)
채권 및 금리    1개  (DGS10)
원자재         3개  (CLF, GC, SI)
```

**니케이 225 와 원/달러는 어느 열에도 매핑되어 있지 않습니다.** 원/달러는 백업본이 `USDKRW` 로 추가하지만 네 열 중 어디에도 `USDKRW` 필터가 없습니다.

**이 두 가지는 이번에 손대지 말고 보고만 하십시오.** 운영자가 열 구성을 판단합니다.

---

## 5. 검증

**빌드하고 화면을 확인하십시오.**

**네 열에 각각 몇 개가 표시되는지 보고하십시오.**

**`data/market_indices.json` 의 `base_date` 와 브리핑 `asOfDate` 가 다르면 그 사실도 보고하십시오.** 백업본은 글로벌 지수의 날짜를 `briefing.asOfDate` 로 찍으므로, 실제 데이터 날짜와 어긋날 수 있습니다. **원본 동작이므로 이번에 고치지는 마십시오.**

---

## 6. 이번 범위 밖

**파이프라인을 건드리지 마십시오.** `publish_market_source_snapshot.py`, `ingest-market-source.js`, `source-materializer.ts`, D1 마이그레이션 전부입니다.

**워크플로를 실행하지 마십시오.** 프런트엔드 변경이므로 Pages 빌드만 있으면 됩니다.

**`cba7821` 을 되돌리지 마십시오.** 원래 설계와 일치합니다.

**열 구성 변경을 하지 마십시오.** 4-1 은 그대로 둡니다.

**Step52 지시서의 모든 항목**을 무시하십시오.

**Step51 의 작업 A(아카이브 사전 조사)와 작업 B(브리핑 데이터 정리)는 그대로 진행하십시오.** 이 건과 독립입니다.

---

## 7. 작업 규칙

**`orderedIndices` 함수 하나만 수정하십시오.** 다른 곳을 건드리지 마십시오.

**라벨 문자열은 파일에서 그대로 복사하십시오.** 추정하거나 옮겨 적지 마십시오.

**없는 데이터를 채우려 하지 마십시오.** `VKOSPI`, `KR10Y` 는 수집 자체가 없습니다.

**`git add .` 와 `git commit -am` 을 쓰지 마십시오.**

**명령을 `;` 로 연결하지 마십시오.**

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오.

`Antigravity_Step*.md` 는 커밋하지 마십시오.

보고 전에 `git status --porcelain` 과 `git log --oneline -n 5`, `git rev-parse --abbrev-ref HEAD` 를 실행해 출력을 붙여넣으십시오.

---

## 8. 진행 순서

**1단계.** 작업 A 로 `orderedIndices` 를 백업본으로 되돌리십시오.

**2단계.** `data/market_indices.json` 의 라벨을 확인하고 4-3 의 호출을 추가하십시오.

**3단계.** 빌드 후 네 열의 표시 개수를 보고하십시오.

**4단계.** 4-4 의 니케이 225 와 원/달러 처리에 대해 현황만 보고하십시오. **판단하지 마십시오.**
