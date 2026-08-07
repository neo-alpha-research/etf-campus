# ETF캠퍼스 구현 인계 프롬프트 (Gemini 3.1 Pro 작업용, 2026-08-06)

사용법: 아래 구분선 안의 전문을 "모두의 AI 실험실" Gemini 3.1 Pro 새 대화에 그대로 붙여넣으십시오. 가능하면 `D:\ETFCampus` 저장소 전체(또는 최소한 `app/`, `components/`, `lib/`, `config/`, `data/`, `docs/`, `package.json`)를 함께 업로드하거나 접근 권한을 주십시오. 저장소에 직접 접근할 수 없는 환경이라면, 이 프롬프트 뒤에 수정하려는 파일의 현재 내용을 붙여넣어 전달하십시오.

---

당신은 지금부터 "ETF캠퍼스" 웹 서비스의 구현을 이어받는 개발자입니다. 이 프로젝트는 기획 단계가 아니라 **이미 상당 부분 구현되어 실제로 운영 중인 서비스**입니다. 아래는 지금까지 구현된 내용과 지켜야 할 규칙의 요약이며, 저장소 코드가 항상 최종 진실입니다 — 이 문서와 코드가 다르면 코드를 따르십시오.

## 0. 서비스 정체성 (변경 금지)

- 서비스명: ETF캠퍼스 — 국내 상장 ETF를 "기준과 맥락"으로 큐레이션하는 정보 서비스. 철학은 "모든 ETF가 아니라 의미 있는 ETF", "추천하지 않습니다, 기준을 가르칩니다"
- 1인 운영, 예산 0원(무료 티어), 비로그인·회원 기능 없음, 완전 정적 사이트
- 이 서비스는 투자 자문·매매 추천 서비스가 아닙니다. 아래 §5 컴플라이언스 규칙은 한 글자도 타협하지 않습니다.

## 1. 실제 배포 상태

- 프로덕션 URL: **https://etf-campus.pages.dev** (Cloudflare Pages, Vercel 아님 — 과거 문서에 Vercel로 적혀 있다면 오기)
- 저장소: `https://github.com/neo-alpha-research/etf-campus` (private), 로컬 작업 폴더 `D:\ETFCampus`
- 배포 트리거: `main` 브랜치에 push되면 Cloudflare Pages가 자동으로 빌드·재배포합니다. 별도 배포 명령이 없습니다. ETF 상세 페이지가 1,150개 이상 정적 생성되어 빌드에 3~5분 정도 걸립니다.
- 정식 도메인(`etfcampus.kr`)은 아직 전환 전이며, `config/site.ts`가 `.pages.dev` 접속을 베타로 인식해 처리합니다.

## 2. 기술 스택·아키텍처 (실제 구현 기준)

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript, Tailwind CSS v4
- `next.config.ts`에 `output: "export"` — **완전 정적 사이트(SSG)**. 서버 API 라우트, DB, 로그인 없음
- 데이터는 전부 저장소 내 CSV/JSON 파일을 빌드 타임에 읽어들입니다 (`lib/data/etf-repository.ts`가 로더). 상태관리 라이브러리 없이 필터·정렬·검색은 URL 쿼리 파라미터로만 관리합니다 (`lib/domain/etf-explorer.ts`의 `parseExplorerQuery`/`serializeExplorerQuery`)
- 테스트: Vitest + Testing Library (`npm test`), 린트: ESLint (`npm run lint`), 빌드: `npm run build`
- 폰트: Pretendard, 숫자는 `tabular-nums`, 상승=빨강·하락=파랑(국내 관례)

## 3. 폴더 구조 (현재)

```
D:\ETFCampus
├── app/                    Next.js 라우트
│   ├── page.tsx            홈 = ETF 탐색 대시보드 (Dashboard 컴포넌트)
│   ├── screener/           별도 스크리너 페이지 (계좌유형·자산군·위험유형 등 체크박스 필터)
│   ├── etf/[ticker]/       종목 상세
│   ├── briefing/[date]/    시황 브리핑 (마크다운)
│   ├── guides/[slug]/      자산군 가이드 (MDX)
│   ├── books/[slug]/       북 큐레이션 (MDX)
│   ├── sitemap.ts, robots.ts
├── components/
│   ├── dashboard/          핵심 화면 — dashboard.tsx (아래 §4 참고)
│   ├── screener/           /screener 전용 필터 UI (dashboard와 별개 구현체)
│   ├── etf/, etf-detail/   공용 프리미티브(수익률 셀·연금 배지·자산군 태그)와 상세 화면
│   ├── onboarding/         투자 스타일 진단 (localStorage만 사용, 서버 전송 없음)
│   ├── learning/, markdown/, brand/
├── lib/
│   ├── data/etf-repository.ts   CSV 3종을 읽어 Etf[] 로 조립하는 로더
│   ├── domain/                  순수 함수 도메인 로직 (explorer, classification, format, screener, visibility) — 전부 단위 테스트 있음
├── data/                   배치가 갱신하는 CSV·JSON 산출물 — 수동 편집 금지 (아래 §6)
├── content/                guides/books/briefings MDX·마크다운 콘텐츠
├── scripts/                Python 데이터 수집 배치 + 뉴스레터 Node 스크립트
├── docs/                   설계 문서·인계 프롬프트 (이 파일 포함)
└── .github/workflows/daily-data.yml   일일 데이터 자동 갱신 (아래 §6)
```

## 4. 홈 대시보드 구현 상세 (`components/dashboard/dashboard.tsx`)

가장 많이 손댄 화면입니다. 현재 동작:

- 상단 탭 4개(`InvestorMode`): 일반 계좌 / 연금 계좌(DC·IRP) / 레버리지·인버스 / 신규 상장(상장 90일 이내)
- 순자산 기준 토글: 1,000억 이상 / 500억 이상 / 전체 (라벨에 "+" 대신 "이상" 사용 — 최근 변경)
- 기간 버튼: 1일~1년(신규 상장은 별도 기간 세트), **기본값은 1일**(과거엔 1개월/6개월이었다가 최근 1일로 변경함, `lib/domain/etf-explorer.ts`의 `DEFAULT_EXPLORER_STATE`/`getDefaultPeriod`)
- 정렬: 기간 수익률 / 순자산 / 거래대금 (순서·라벨 최근 정리함, "· 선택 기간" 같은 부가 텍스트 제거)
- **페이지네이션 없음** — 필터링된 전체 종목을 한 번에 스크롤로 보여줍니다. 단, 실제 DOM에는 `@tanstack/react-virtual`의 `useWindowVirtualizer`로 화면에 보이는 행(오버스캔 포함 약 20~40개)만 렌더링합니다. 이 때문에 홈의 정적 HTML(빌드 산출물)에는 테이블 행 데이터가 비어 있고 클라이언트 JS 실행 후에 채워집니다 — 의도된 트레이드오프이며, 개별 ETF 상세 페이지(`/etf/[ticker]`)는 이 영향을 받지 않고 그대로 정적 렌더링됩니다.
- 테이블은 `table-layout: fixed`이며 열 너비를 전부 %로 맞춰 100%가 되도록 계산해 두었습니다(`nameColumnWidth` 등, dashboard.tsx 내부). 열을 추가·삭제하거나 기간 개수(`periods.length`)가 바뀌면 이 % 합계가 깨지지 않는지 확인해야 합니다.
- 순자산·거래대금은 같은 CSV 행(같은 기준일)에서 나오므로 항상 동일한 "기준일" 데이터입니다 — 별도로 "최근일"이라고 표기하지 않습니다.

## 5. 컴플라이언스 화면 규칙 (타협 불가)

- 전 페이지 푸터: "본 서비스는 투자 권유·종목 추천을 제공하지 않으며, 모든 투자 판단의 책임은 이용자 본인에게 있습니다"
- 수익률 랭킹·목록 하단: "과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다"
- 수익률 라벨에는 "가격 기준·분배금 미포함"을 명시
- 매수/매도 신호, 목표가, 종목 추천, 단정적 전망 표현을 어떤 화면·문구에도 생성하지 않습니다

## 6. 데이터 파이프라인 (`.github/workflows/daily-data.yml` + `scripts/update_daily_data.py`)

- 월~금 하루 4번(한국시간 13:30, 16:30, 18:20, 20:30 부근) 자동 실행 + 수동 실행(`workflow_dispatch`) 가능
- 흐름: 공식 API(data.go.kr/KRX)에서 시세 수집 → `data/etf_master_draft.csv`·`etf_returns_draft.csv`·`pension_verify_sheet.csv` 갱신 → `python -m unittest` + `npm test` + `npm run build`가 전부 성공해야 → `main`에 자동 커밋 → Cloudflare Pages가 커밋을 감지해 재배포
- **`data/` 아래 CSV는 배치 산출물입니다. 손으로 고치지 마십시오.** 수정이 필요하면 `scripts/update_daily_data.py`(수집 로직) 또는 `lib/data/etf-repository.ts`(파싱/검증 로직) 쪽을 고치는 것이 맞습니다
- 최근 수정 이력: 신규 상장 종목이 API에 `isin_cd`(ISIN)가 아직 채워지지 않은 채로 들어오면 전체 파이프라인이 죽던 버그를 고쳤습니다 — 이제 그 종목 하나만 건너뛰고 로그를 남긴 뒤 다음 실행에서 자동 재시도합니다
- API 키는 GitHub Secrets(`DATA_GO_KR_SERVICE_KEY`, `KRX_OPEN_API_KEY`)로만 전달됩니다. 절대 코드나 커밋에 노출하지 마십시오

## 7. 작업 시 유의사항

- **동시 작업 환경**: 이 저장소는 운영자가 여러 AI 도구(Claude Code, CODEX, Gemini 등)를 병행해서 쓰고 있습니다. 작업 시작 전 `git fetch`/`git status`로 원격이 앞서 있는지 먼저 확인하고, 겹치는 파일이 있으면 병합 전에 운영자에게 확인하십시오.
- `git status`에 `.github/workflows/daily-data.yml`, `README.md`, `tsconfig.json` 등이 계속 수정된 것처럼 뜰 수 있는데, 대부분 줄바꿈(CRLF/LF) 차이일 뿐 실제 내용 변경이 아닙니다. `git diff -w`(공백 무시)로 실제 변경 여부를 먼저 확인하십시오.
- 출시 전 게이트(README 참고): `content/`의 `[SAMPLE]_` 접두 파일은 전부 검수용 더미이며 공개 전 실제 콘텐츠로 교체해야 합니다. `npm run check:release`가 이를 검사합니다.
- 설계·정책 변경이 필요한 결정(§0, §5 등과 충돌하는 요구)은 임의로 결정하지 말고 운영자에게 선택지를 제시해 질문하십시오.

## 8. 검증 순서 (수정할 때마다)

1. `npm test` (Vitest) — 관련 테스트 전부 통과 확인
2. `npm run lint` (ESLint) — 경고 0건 목표
3. `npm run build` — 정적 export가 끝까지 성공하는지 확인(약 1,170개 페이지)
4. 위 세 개가 통과하면 `main`에 커밋·push — Cloudflare Pages가 자동 배포. 배포 완료까지 대형 변경은 3~5분 정도 걸리므로, 실제 사이트(https://etf-campus.pages.dev)에서 반영 여부를 재확인하십시오

## 9. 첫 응답으로 해 주십시오

1. 이 문서와 (가능하면) 실제 저장소 코드를 검토했다는 확인
2. 오늘 요청받은 작업 범위 요약
3. 불명확한 점이 있다면 질문 목록
4. 진행 계획 — 승인 후 작업 시작

---
