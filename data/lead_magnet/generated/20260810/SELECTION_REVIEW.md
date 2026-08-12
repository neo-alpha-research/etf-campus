# ETF Campus 리드 마그넷 선정 검수 초안

- 기준일: 20260810
- 상태: 잠정 선정·발행 불가
- 선정 기준: 현재 확보 데이터의 적격성 검사를 통과한 상품 중 순자산총액 상위

> 이 문서는 최종 추천 목록이 아니다. 분배금 포함 총수익률, 공식 편입종목, 전략 변경 및 원본 API 검증 전에는 PDF에 사용하지 않는다.

## 페이지 1 - 장기 적립형

| 버킷·테마 | 지역 | ETF | 순자산 | 선정 순위 |
| --- | --- | --- | ---: | ---: |
| kospi200 | korea | KODEX 200 (069500) | 22.78조원 | 1 |
| nasdaq100 | us | TIGER 미국나스닥100 (133690) | 11.59조원 | 1 |
| sp500 | us | TIGER 미국S&P500 (360750) | 20.62조원 | 1 |

## 페이지 2 - 배당형

| 버킷·테마 | 지역 | ETF | 순자산 | 선정 순위 |
| --- | --- | --- | ---: | ---: |
| korea_dividend | korea | PLUS 고배당주 (161510) | 2.38조원 | 1 |
| korea_dividend | korea | TIGER 은행고배당플러스TOP10 (466940) | 7853억원 | 2 |
| korea_dividend | korea | RISE 대형고배당10TR (315960) | 4725억원 | 3 |
| us_dividend | us | TIGER 미국배당다우존스 (458730) | 4.22조원 | 1 |
| us_dividend | us | SOL 미국배당다우존스 (446720) | 1.03조원 | 2 |
| us_dividend | us | ACE 미국배당다우존스 (402970) | 9562억원 | 3 |

## 페이지 3 - AI 모멘텀

| 버킷·테마 | 지역 | ETF | 순자산 | 선정 순위 |
| --- | --- | --- | ---: | ---: |
| ai_semiconductor | korea | TIGER 반도체TOP10 (396500) | 8.25조원 | 1 |
| ai_infrastructure_power | korea | KODEX AI전력핵심설비 (487240) | 3.15조원 | 2 |
| ai_it_bigtech | korea | TIGER 200 IT (139260) | 2.44조원 | 3 |
| broad_ai_value_chain | global | TIME 글로벌AI인공지능액티브 (456600) | 2.16조원 | 4 |
| ai_robotics_automation | korea | KODEX 로봇액티브 (445290) | 1.09조원 | 5 |

## 우선 검수 대상

분류가 확정되면 현재 잠정 선정 상품을 밀어낼 가능성이 큰 순서다.

| 페이지 | 잠정 버킷·테마 | ETF | 순자산 | 검수 사유 |
| --- | --- | --- | ---: | --- |
| dividend_income | korea_dividend | TIME Korea플러스배당액티브 (441800) | 7487억원 | manual_review |
| ai_momentum | ai_it_bigtech | TIME 차이나AI테크액티브 (0043Y0) | 3702억원 | manual_review |
| ai_momentum | ai_robotics_automation | TIGER 차이나휴머노이드로봇 (0053L0) | 2761억원 | manual_review |
| ai_momentum | ai_semiconductor | SOL 글로벌AI반도체탑픽액티브 (423170) | 2447억원 | manual_review |
| ai_momentum | ai_it_bigtech | KODEX 미국나스닥AI테크액티브 (411420) | 1282억원 | manual_review |
| ai_momentum | broad_ai_value_chain | RISE 미국AI밸류체인TOP3Plus (485690) | 952억원 | manual_review |
| dividend_income | korea_dividend | KoAct 배당성장액티브 (476850) | 949억원 | manual_review |
| ai_momentum | unassigned_ai | DAISHIN343 AI반도체&인프라액티브 (486240) | 870억원 | manual_review_theme_conflict |
| ai_momentum | ai_semiconductor | RISE 미국반도체NYSE (469060) | 814억원 | manual_review |
| ai_momentum | ai_platform_software | TIGER 글로벌AI플랫폼액티브 (412770) | 788억원 | manual_review |
| ai_momentum | broad_ai_value_chain | TIGER AI코리아그로스액티브 (365040) | 698억원 | manual_review |
| ai_momentum | ai_it_bigtech | KODEX 차이나AI테크액티브 (428510) | 549억원 | manual_review |
| ai_momentum | broad_ai_value_chain | TIGER 글로벌온디바이스AI (480310) | 542억원 | manual_review |
| ai_momentum | broad_ai_value_chain | TIGER 글로벌AI사이버보안 (418670) | 479억원 | manual_review |
| ai_momentum | broad_ai_value_chain | HANARO 글로벌생성형AI액티브 (461340) | 479억원 | manual_review |

## 남은 발행 차단 조건

- KRX/FSC 원본 API 응답 보관
- 공식 분배금 이력과 총수익률 재계산
- 공식 TOP 5 편입종목 및 집중도 확인
- 최근 전략·기초지수 변경 이력 확인
- 페이지 1 비용·추적오차 공통 기준 확인
- 운영자 분류 검수
