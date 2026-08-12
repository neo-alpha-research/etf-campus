# 서명 기반 ETF 가격 적재 운영 가이드

이 문서는 공개 임의 SQL 실행을 제거한 뒤, **가격 데이터만** Cloudflare Pages Function을 통해 D1에 적재하는 운영 절차를 정리합니다. 대상 경로는 `POST /api/internal/ingest-prices`이며, 브라우저·프런트엔드에서 호출하지 않습니다.

## 1. 보안 경계

| 구분 | 역할 | 허용 범위 |
|---|---|---|
| GitHub Actions | 공식 API에서 종가를 수집하고 HMAC 서명 요청을 전송 | 고정된 ETF Campus 적재 URL로 가격 배치 전송 |
| Cloudflare Pages Function | 서명·시각·입력 스키마·재전송을 검증 | 고정 UPSERT로 `etf_prices` 테이블에만 쓰기 |
| Cloudflare D1 | 가격 이력 보관 | `ETF_PRICES` 바인딩을 통해 Pages Function에서만 접근 |
| 공개 사용자 | 사이트 조회 | 가격 적재 API 호출 권한 없음 |

> 이 적재 경로는 SQL, 테이블명, SQL 파라미터, 임의 엔드포인트를 받지 않습니다. 요청은 `requestId`와 `records[{ticker,date,close}]`라는 닫힌 스키마만 허용합니다.

## 2. 비밀값 설정

동일한 무작위 문자열을 **GitHub Actions Secret**과 **Cloudflare Pages production 환경 변수**에 각각 `PRICE_INGEST_HMAC_SECRET`이라는 이름으로 등록합니다. 값은 최소 32바이트 이상의 암호학적으로 무작위인 문자열이어야 하며, 채팅·커밋·로그·`.env` 파일에 저장해서는 안 됩니다.

### GitHub Actions Secret

저장소의 **Settings → Secrets and variables → Actions → New repository secret**에서 다음 이름으로 추가합니다.

| Name | Value |
|---|---|
| `PRICE_INGEST_HMAC_SECRET` | Cloudflare Pages와 동일한 고엔트로피 무작위 값 |

기존의 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_ID`, `CLOUDFLARE_D1_TOKEN`은 이 적재 자동화에서 더 이상 참조하지 않습니다. 다른 용도로 사용하지 않는다면 별도 점검 후 폐기합니다.

### Cloudflare Pages Secret

Cloudflare 대시보드에서 **Workers & Pages → ETF Campus 프로젝트 → Settings → Variables and Secrets → Add**를 선택합니다. 이름은 `PRICE_INGEST_HMAC_SECRET`, 값은 GitHub Secret과 동일하게 설정하고 **Production** 환경에 암호화된 Secret으로 저장합니다. Preview에서 통합 시험을 할 경우에만 Preview 환경에도 같은 Secret을 별도로 추가합니다.

## 3. 배포 순서

1. Cloudflare Pages에 `PRICE_INGEST_HMAC_SECRET`을 설정합니다.
2. GitHub 저장소에 동일 이름의 Actions Secret을 설정합니다.
3. 보안 브랜치를 `main`에 병합합니다. Pages의 production 배포가 완료될 때까지 기다립니다.
4. GitHub Actions의 **Backfill ETF Price History** 워크플로우를 수동 실행하고, 처음에는 `days=1`로 검증합니다.
5. 성공 확인 후 필요한 기간으로 다시 실행합니다. 기존 가격은 고정 UPSERT로 안전하게 보정됩니다.

## 4. 요청 계약과 검증

서명 대상 바이트열은 아래 형식이며, GitHub Actions와 Pages Function이 동일하게 사용합니다.

```text
POST\n<UNIX timestamp (seconds)>\n<원본 JSON body bytes>
```

| 통제 | 기준 |
|---|---|
| HTTP 메서드 | `POST`만 허용 |
| HMAC | `HMAC-SHA256`, `X-ETF-Ingest-Signature` 헤더 |
| 시간 제한 | `X-ETF-Ingest-Timestamp`가 현재 시각 기준 ±5분 이내 |
| 재전송 방지 | `requestId`를 D1에 단일 저장, 동일 ID는 HTTP 409 |
| 배치 제한 | 1~500개 레코드, 본문 최대 1MB |
| 티커 | 숫자 6자리 |
| 날짜 | 실제 달력상 유효한 `YYYY-MM-DD` |
| 종가 | 유한한 양수, 1억 원 이하 |
| SQL | 입력 불가; 서버의 매개변수화된 고정 UPSERT만 사용 |
| 응답 캐시/CORS | `Cache-Control: no-store`, 와일드카드 CORS 미설정 |

## 5. 운영 검증 기준

GitHub Actions 로그에는 성공한 레코드 수와 실패한 날짜 수만 확인합니다. 서명 값·요청 헤더·비밀값은 로그에 출력되지 않아야 합니다. 첫 수동 실행 후 ETF Campus에서 최근 종가를 조회하고, 대표 ETF의 수익률 API 응답이 최신 거래일 데이터를 반영하는지 확인합니다.

| 점검 항목 | 통과 기준 |
|---|---|
| Pages 배포 | `main`의 배포가 성공하고 적재 Function이 활성화됨 |
| 수동 백필 | `days=1` 실행이 성공하고 `accepted` 수가 0보다 큼 |
| 재실행 | 같은 날짜를 다시 보내도 가격 값이 중복 행 없이 UPSERT됨 |
| 조회 기능 | 대표 종목의 최신 수익률·가격 조회가 정상 응답 |
| 실패 대응 | `401`은 양쪽 Secret 불일치, `409`는 재전송, `500`은 D1 바인딩·스키마 점검 |

## 6. 비밀값 교체와 롤백

비밀값 교체 시에는 새 값을 먼저 Cloudflare Pages Production Secret에 저장한 뒤 GitHub Actions Secret도 즉시 같은 새 값으로 교체합니다. 두 변경 사이에는 백필 워크플로우를 실행하지 않습니다. 롤백이 필요하면 해당 보안 변경을 되돌린 뒤 Pages 배포 완료를 확인해야 하며, 과거의 공개 SQL 실행 엔드포인트를 복원해서는 안 됩니다.
