# scripts/community/

ETF 캠퍼스 커뮤니티 게시판 콘텐츠 자동화 모듈.

## 파일 구조

```
scripts/community/
├── add_posts.py          # 일일 게시글 생성 CLI
├── validate_tickers.py   # 티커·브랜드 검증기 (Zero-Hallucination 수문장)
├── topic_bank.json       # 검증된 주제 풀 (90개, 각 게시판 30개)
└── README.md             # 이 파일
```

## 빠른 시작

### 수동 실행 (날짜 지정)
```bash
python scripts/community/add_posts.py --date 2026-09-15
```

### 미리보기 (파일 저장 없음)
```bash
python scripts/community/add_posts.py --dry-run
```

### 생성 + 티커 검증
```bash
python scripts/community/add_posts.py --date 2026-09-15 --validate
```

### 전체 게시글 티커 검증만 실행
```bash
python scripts/community/validate_tickers.py
python scripts/community/validate_tickers.py --json    # JSON 리포트
```

## 자동화 (GitHub Actions)

`.github/workflows/community-posts.yml` 참조.
- **주 3회 자동 실행**: 월·수·금 07:00 KST
- **수동 실행**: GitHub Actions → community-posts → Run workflow

## topic_bank.json 관리 규칙

1. **주제 추가**: `topics` 배열에 새 항목 추가. `published: false` 유지.
2. **티커 필드**: `verified_tickers`는 반드시 screener.json에서 확인된 6자리 코드만 입력.
3. **발행 마킹**: `add_posts.py` 실행 시 자동으로 `published: true` + `published_date` 기록.
4. **주제 소진 시**: 미발행 주제가 없는 게시판이 생기면 경고 메시지 출력. 수동으로 주제 추가 필요.

## Zero-Hallucination 정책

- `validate_tickers.py`는 게시글의 모든 `(6자리코드)`를 screener.json과 비교.
- 브랜드명과 운용사 불일치 → ERROR (exit code 2) → GitHub Actions 실패로 배포 차단.
- screener에 없는 코드 → WARNING (신규 상장 가능성, 수동 확인 필요).
