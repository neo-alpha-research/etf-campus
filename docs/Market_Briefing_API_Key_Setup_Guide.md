# ETF Campus 마켓 브리핑 — API Key 발급 및 등록 가이드

## 목적과 현재 필요한 값

마켓 브리핑은 서로 다른 두 공식 데이터 원천을 사용합니다. ETF 시세는 금융위원회가 공공데이터포털을 통해 제공하는 **증권상품시세정보**에서 받고, KOSPI·KOSDAQ 지수는 한국거래소(KRX) Open API에서 받습니다. 두 key는 외부에 노출되면 안 되는 비밀값이므로 화면 캡처·채팅·Git commit에 포함하지 않습니다.

| 환경 변수명 | 어디서 받는가 | 필요한 서비스 권한 | ETF Campus에서의 사용처 |
| --- | --- | --- | --- |
| `DATA_GO_KR_SERVICE_KEY` | 공공데이터포털 | 금융위원회_증권상품시세정보의 ETF 시세 | ETF 가격·등락률·거래대금·순자산 수집 |
| `KRX_OPEN_API_KEY` | KRX Open API | `kospi_dd_trd`, `kosdaq_dd_trd` | KOSPI·KOSDAQ 종가·등락률 수집 |

> **중요:** 기존 GitHub Actions Secret에 두 값이 있어도 Cloudflare Worker는 이를 자동으로 읽지 않습니다. preview와 production collector Worker에 각각 다시 등록해야 합니다.

## 1. 공공데이터포털 ETF API key 발급

먼저 [금융위원회_증권상품시세정보 API 페이지](https://www.data.go.kr/data/15094806/openapi.do)에 로그인합니다. 이 API는 ETF·ETN·ELW 시세를 제공하며, ETF Campus에서는 그중 ETF 시세 기능만 사용합니다.[1]

페이지에서 **활용신청**을 선택합니다. 신청 화면에서 서비스 이용 목적은 다음처럼 작성하면 됩니다.

> ETF Campus 웹사이트에서 국내 ETF의 종가, 등락률, 거래대금 및 순자산 데이터를 수집하여 거래일 기준 마켓 브리핑을 제공하기 위한 비상업적 데이터 검증 및 서비스 운영 목적입니다.

이 API는 개발·운영 계정 모두 자동승인으로 표시되어 있으며, 개발계정 기본 일일 트래픽은 10,000건입니다.[1] 신청이 완료되면 공공데이터포털의 마이페이지에서 **개발계정 → 인증키 발급현황** 또는 활용신청 상세 화면으로 이동합니다.

표시되는 key 중 **일반 인증키(Decoding)** 값을 복사해 `DATA_GO_KR_SERVICE_KEY`에 사용합니다. ETF Campus 수집 Worker는 URL parameter를 안전하게 인코딩하므로, 이미 URL 인코딩된 `Encoding` 값이 아니라 원문에 가까운 `Decoding` 값을 넣어야 중복 인코딩을 피할 수 있습니다. key 전체를 복사하되 앞뒤 공백·줄바꿈은 포함하지 않습니다.

## 2. KRX Open API 지수 key 발급

[KRX Open API](https://openapi.krx.co.kr/)에 접속해 회원가입 후 로그인합니다. 개인은 본인인증 또는 소셜 로그인으로 가입할 수 있으며, 법인은 사업자 정보를 등록합니다. 로그인 후에는 **마이페이지 → API 인증키 신청**에서 인증키를 신청합니다. KRX는 관리자 승인 후 key를 사용할 수 있습니다.[2]

인증키가 승인된 뒤에도 지수 데이터는 별도 서비스 이용 신청이 필요합니다. 상단 메뉴에서 **서비스 이용 → 지수**로 이동한 뒤 다음 두 서비스를 각각 열어 **API 이용신청**을 완료합니다.

| 서비스명 | API ID | ETF Campus 사용 목적 |
| --- | --- | --- |
| KOSPI 시리즈 일별시세정보 | `kospi_dd_trd` | KOSPI 종가·등락률 |
| KOSDAQ 시리즈 일별시세정보 | `kosdaq_dd_trd` | KOSDAQ 종가·등락률 |

KRX의 공식 서비스 목록은 위 두 API ID와 JSON/XML 제공 형식을 명시합니다.[3] 신청 상태가 승인으로 바뀐 뒤 마이페이지의 **API 인증키 발급내역**에서 key를 복사해 `KRX_OPEN_API_KEY`로 사용합니다.

## 3. key 발급·권한 확인 체크리스트

아래 네 항목이 모두 충족되어야 합니다.

| 확인 항목 | 완료 기준 |
| --- | --- |
| 공공데이터포털 계정 | 금융위원회_증권상품시세정보 활용신청 상태가 승인 또는 자동승인 |
| 공공데이터 key | 일반 인증키(Decoding)를 확보 |
| KRX 인증키 | API 인증키 신청 상태가 승인 |
| KRX 지수 서비스 | `kospi_dd_trd`, `kosdaq_dd_trd` 각각의 API 이용신청 상태가 승인 |

KRX 사이트의 샘플 요청은 `AUTH_KEY` HTTP header와 `basDd=YYYYMMDD` 형식을 사용합니다. ETF Campus Worker가 이 형식으로 호출하도록 이미 구현되어 있습니다.[4] 따라서 사용자는 endpoint URL이나 query parameter를 별도로 수정할 필요가 없습니다.

## 4. GitHub Actions Secret 등록

기존 일별 데이터 수집·backfill workflow도 같은 key를 사용할 수 있도록 GitHub repository에 등록합니다. GitHub 웹 화면에서는 repository의 **Settings → Secrets and variables → Actions → Secrets → New repository secret** 경로를 사용합니다.

| Name | Secret value |
| --- | --- |
| `DATA_GO_KR_SERVICE_KEY` | 공공데이터포털 일반 인증키(Decoding) |
| `KRX_OPEN_API_KEY` | KRX Open API 인증키 |

GitHub CLI를 사용한다면 project root에서 아래 명령을 실행합니다. 각 명령은 value 입력을 별도로 요청하므로 key가 shell 명령줄 기록에 남지 않습니다.

```powershell
cd D:\ETFCampus

gh secret set DATA_GO_KR_SERVICE_KEY
gh secret set KRX_OPEN_API_KEY

gh secret list
```

`gh secret list`는 key 값이 아닌 등록된 이름만 보여야 정상입니다.

## 5. Cloudflare Worker runtime secret 등록

마켓 브리핑 수집기는 Cloudflare Worker에서 직접 API를 호출합니다. 따라서 위 두 key를 collector Worker에 preview와 production으로 각각 등록합니다. **발행 Worker에는 두 key를 등록하지 않습니다.** 발행 Worker는 D1에 이미 저장·검증된 snapshot만 읽습니다.

```powershell
cd D:\ETFCampus\workers\market-data-collector

# 1) preview 검증용 Worker
npx wrangler secret put DATA_GO_KR_SERVICE_KEY --env preview
npx wrangler secret put KRX_OPEN_API_KEY --env preview

# 2) preview 검증 통과 뒤 production Worker
npx wrangler secret put DATA_GO_KR_SERVICE_KEY
npx wrangler secret put KRX_OPEN_API_KEY

# 이름만 확인합니다. 값은 출력되지 않습니다.
npx wrangler secret list --env preview
npx wrangler secret list
```

명령을 실행하면 `Enter a secret value:`와 같은 입력 창이 나타납니다. 그 시점에 해당 key를 붙여넣고 Enter를 누릅니다. key를 채팅에 보내거나 `wrangler.toml`, `.env` 파일, Git commit에 저장하면 안 됩니다.

## 6. 등록 후 제가 진행할 검증

두 key를 preview collector에 등록한 뒤 이 대화에서 **“preview secret 등록 완료”**라고 알려주세요. 그러면 다음 순서로 진행합니다.

1. preview collector와 publisher를 배포합니다.
2. 보호된 수집 실행을 호출해 ETF·KOSPI·KOSDAQ의 실제 기준일 일치를 검증합니다.
3. `market_data_readiness`가 `ready`인지 확인합니다.
4. publisher가 같은 기준일을 최초 1회만 `ready` 브리핑으로 발행하는지 확인합니다.
5. preview KV와 `/api/briefings/latest` 응답이 일치하는지 확인합니다.
6. 확인이 끝난 뒤에만 production secret 등록·migration·배포를 진행합니다.

## 7. 자주 발생하는 오류와 해결 기준

| 증상 | 가장 가능성 높은 원인 | 조치 |
| --- | --- | --- |
| 공공데이터 API `SERVICE_ACCESS_DENIED_ERROR` 또는 `PERMISSION_DENIED` | ETF 시세 API 활용신청이 미완료 또는 다른 key 사용 | 증권상품시세정보의 활용신청 상태와 일반 인증키를 다시 확인 |
| 공공데이터 API `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` | key 오입력 또는 Encoding key를 중복 인코딩 | 일반 인증키(Decoding)를 공백 없이 다시 등록 |
| KRX API 401/403 | KRX key 미승인 또는 지수 서비스 이용 신청 미승인 | 인증키 발급 상태와 `kospi_dd_trd`·`kosdaq_dd_trd` 이용 신청 상태를 모두 확인 |
| KRX API가 빈 결과 | 비거래일 또는 당일 장 마감 전 | 다음 수집 slot에서 재시도; 기준일이 ETF와 불일치하면 자동 발행하지 않음 |
| Worker가 key를 읽지 못함 | GitHub에만 등록하고 Cloudflare Worker에는 미등록 | Section 5의 `wrangler secret put` 명령을 preview와 production에 각각 실행 |

## References

[1]: https://www.data.go.kr/data/15094806/openapi.do "공공데이터포털 — 금융위원회_증권상품시세정보"
[2]: https://openapi.krx.co.kr/contents/OPP/INFO/OPPINFO003.jsp "KRX Open API — 서비스 이용방법"
[3]: https://openapi.krx.co.kr/contents/OPP/USES/service/OPPUSES001_S1.cmd "KRX Open API — 지수 서비스 목록"
[4]: https://openapi.krx.co.kr/contents/OPP/USES/service/OPPUSES001_S2.cmd?BO_ID=EREKZauXnMmxyIlqzeDN "KRX Open API — KOSPI 시리즈 일별시세정보 요청 예시"
