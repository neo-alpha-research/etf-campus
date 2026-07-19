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
