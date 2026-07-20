# ETFCampus

국내 상장 ETF 큐레이션 정보 서비스 "ETF캠퍼스"(가칭) 개발 저장소.

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

## 출시 전 교체 대상 샘플

- `content/briefings/[SAMPLE]_2026-07-15.md` — 브리핑 렌더링 검증용 중립 fixture. 실제 운영자 검수 콘텐츠로 출시 전 교체
- `content/guides/[SAMPLE]_*.mdx` 4건 — 자산군 가이드 화면·스타일 연결 검증용 중립 fixture. 출시 전 전량 교체
- `content/books/[SAMPLE]_*.mdx` 3건 — 북 큐레이션 화면·제휴 표기 구조 검증용 중립 fixture. 출시 전 전량 교체

## 공개 배포 전 게이트

1. 운영자·Navigator가 공급한 실 콘텐츠로 모든 `[SAMPLE]_` 파일을 교체한다.
2. `npm run check:release`가 성공하는지 확인한다. 샘플이 한 건이라도 남으면 실패한다.
3. 서비스명·상표·도메인 확정과 Phase 1 법률 검토 완료를 운영자가 확인한다.
4. `NEXT_PUBLIC_SITE_URL`을 실제 공개 URL로 설정하고 `npm run lint`, `npm test`, `npm run build`를 다시 실행한다.
5. Vercel 프로젝트의 Analytics 메뉴에서 Web Analytics를 활성화한 뒤 프로덕션을 재배포한다.

## 방문 계측

- `@vercel/analytics` v2의 자동 페이지뷰만 사용한다. 로그인 정보·사용자 식별자·사용자 입력값을 수집하는 커스텀 이벤트는 만들지 않는다.
- Vercel Web Analytics는 제3자 쿠키 없이 집계 데이터를 기록하므로 Phase 1에는 별도 쿠키 배너를 두지 않는다. 법률 검토 결과가 달라지면 공개 전에 반영한다.
- Threads 발행 링크의 UTM 부착은 코드가 아니라 발행 SOP에서 관리한다. 필터와 스타일 값 외에 개인정보를 URL 쿼리에 넣지 않는다.
