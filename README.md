# ETFCampus

국내 상장 ETF 큐레이션 정보 서비스 "ETF 캠퍼스"(가칭) 개발 저장소.

## 폴더 구조

```
D:\ETFCampus
├── docs/  ── 설계 기준서·사양서·인계 프롬프트 (구현 기준 사본)
├── scripts/  ── 데이터 수집·태그·대조 배치 스크립트 (Python)
├── data/  ── 배치 산출물 (마스터·수익률·연금 검수 시트·운용사 원천 JSON)
├── content/
│   ├── guides/  ── 자산군 가이드 (MDX)
│   ├── books/  ── 북 큐레이션 (MDX)
│   └── briefings/  ── 시황 브리핑 (YYYY-MM-DD.md, 배치 생성·PR 승인 게시)
├── public/brand/  ── 캐릭터 브랜드 가이드와 시안 이미지
├── (app/, package.json 등)  ── Next.js 앱 — 스캐폴드 시 루트에 생성
└── .github/workflows/  ── 일일 배치 (daily-batch.yml, 추후)
```

## 문서 규칙 (SSOT)

- 전략·구조 결정의 원본은 `D:\Econ View Studio\Brand_Command\EVS Navigator\ETF_Platform_Design_Baseline_20260716.md` (결정 대장 포함)이며 Navigator가 관리한다
- 본 저장소 `docs/`는 구현 기준 사본이다. 설계 변경은 반드시 운영자 → Navigator 원본 갱신 → `docs/` 사본 동기화 순서를 지킨다. 사본 직접 수정 금지
- 구현 담당(ChatGPT)은 `docs/Handover_Prompt_ChatGPT_20260718.md`의 규칙을 따르며, 문서에 없는 결정은 운영자에게 질문한다

## 주의

- 공개 저장소 전환 전 검토: API 키 등 비밀값은 코드·이력에 절대 포함 금지 (GitHub Secrets 사용)
- 데이터 기준일: data/ 파일 내 bas_dt 컬럼 참조 (현재 2026-07-15 기준 시험 산출본)

## 캐릭터 브랜딩

- 다람쥐 큐레이터 캐릭터명은 내부적으로 `티커리(TICKERY)`로 확정했다. 이름은 `Ticker + Library`의 조어다.
- `TICKERY` 완전일치는 제9·36·41·42류 통합 검색에서 0건이었으나, 공개 사용 전 유사 호칭과 지정상품 유사군을 전문 검토하고 Navigator 공개 게이트를 통과해야 한다.
- 캐릭터 설정·사용 규칙·금지 표현·시안 목록은 [`public/brand/README.md`](public/brand/README.md)를 따른다.
- 현재 A/B/C 이미지는 콘셉트 검토용이며, 운영자 선택과 Navigator 반영 전에는 최종 브랜드 자산으로 간주하지 않는다.

## 출시 전 교체 대상 샘플

- `content/briefings/[SAMPLE]_2026-07-15.md` — 브리핑 렌더링 검증용 중립 fixture. 실제 운영자 검수 콘텐츠로 출시 전 교체
- `content/guides/[SAMPLE]_*.mdx` 4건 — 자산군 가이드 화면·스타일 연결 검증용 중립 fixture. 출시 전 전량 교체
- `content/books/[SAMPLE]_*.mdx` 3건 — 북 큐레이션 화면·제휴 표기 구조 검증용 중립 fixture. 출시 전 전량 교체

## 공개 배포 전 게이트

1. 운영자·Navigator가 공급한 실 콘텐츠로 모든 `[SAMPLE]_` 파일을 교체한다.
2. `npm run check:release`가 성공하는지 확인한다. 샘플이 한 건이라도 남으면 실패한다.
3. 서비스명·상표·도메인 확정과 Phase 1 법률 검토 완료를 운영자가 확인한다.
4. `NEXT_PUBLIC_SITE_URL`을 실제 공개 URL로 설정하고 `npm run lint`, `npm test`, `npm run build`를 다시 실행한다.
5. Cloudflare Pages의 Metrics 메뉴에서 Web Analytics를 활성화한 뒤 프로덕션을 재배포한다.

## 방문 계측

- Cloudflare Pages의 무료 Web Analytics에서 자동 페이지뷰만 확인한다. 로그인 정보·사용자 식별자·사용자 입력값을 수집하는 커스텀 이벤트는 만들지 않는다.
- 방문 통계는 Cloudflare의 기본 집계 설정만 사용한다. 별도 광고 픽셀·세션 녹화·사용자 프로파일링은 도입하지 않으며, 법률 검토 결과가 달라지면 공개 전에 반영한다.
- Threads 발행 링크의 UTM 부착은 코드가 아니라 발행 SOP에서 관리한다. 필터와 스타일 값 외에 개인정보를 URL 쿼리에 넣지 않는다.

## 상장일·확장 수익률 배치

- `scripts/enrich_listing_and_returns.py`는 기존 ETF 시세 API로 `listing_date`, 정확한 `new_90d`, 1일·1주·2주·2년·3년·상장 후(ITD) 가격수익률을 보강한다.
- ITD는 첫 거래일 종가 대비이며, 배치 원천이 없거나 상장 기간이 부족한 값은 비워 둔다. 프론트에서는 이를 `-`로 표시한다.
- API 키는 `DATA_GO_KR_SERVICE_KEY` GitHub Secret 환경변수로만 전달하고 저장소나 명령행 인자에 기록하지 않는다.

## 일일 데이터 자동 갱신

- `.github/workflows/daily-data.yml`은 월~토 오전 9시 30분(KST)에 실행한다. 토요일 실행에서 금요일 종가를 반영한다.
- 목표일 데이터가 없으면 공식 API에서 그 이전 최근 거래일을 찾아 사용한다.
- CSV 3종을 갱신한 뒤 전체 테스트와 정적 빌드가 성공한 경우에만 `main`에 자동 커밋한다.
- Cloudflare Pages는 이 커밋을 감지해 `https://etf-campus.pages.dev`를 자동 재배포한다.
- 수동 실행은 GitHub `Actions → Daily ETF data refresh → Run workflow`에서 할 수 있으며, 선택적으로 `YYYYMMDD` 목표일을 입력할 수 있다.

## 주간 뉴스레터 시제품

- 주간 스냅숏 생성: `npm run newsletter:snapshot -- --date YYYY-MM-DD`
- 로컬 HTML 생성: `npm run newsletter:build -- --date YYYY-MM-DD`
- 스냅숏은 `data/newsletter/weekly-snapshots/`, 검수용 결과물은 `artifacts/newsletter/YYYY-MM-DD/`에 저장한다.
- 순위 기본 유니버스는 순자산 1,000억원 이상이며 일반 계좌·연금 계좌·레버리지·인버스를 분리한다.
- 1주 수익률 결측치는 추정하지 않고 순위에서 제외한다.
- `artifacts/`의 HTML은 메일리 발송본이 아니라 운영자 검수용이며, 테스트 발송 전 별도 승인이 필요하다.
