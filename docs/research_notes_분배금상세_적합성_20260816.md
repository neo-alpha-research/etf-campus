# 분배금 상세 화면 적합성 벤치마크 노트

조사일: 2026-08-16 (KST)

## 확인한 서비스와 사실

| 서비스 | 확인된 표시 방식 | ETF Campus 적용 시사점 | 출처 |
|---|---|---|---|
| iShares Core Dividend ETF (DIVB) | 상단에서 분배 주기, 30일 SEC 수익률, 12개월 후행 수익률을 별도 지표로 표기한다. 성과 영역은 `Total Return`, `Market Price`, 벤치마크를 분리하고, 가상 투자성장 차트는 배당·자본이득 재투자를 가정한다고 명시한다. 또한 분배 이력 행에 기준일·분배락일·지급일·금액을 나열한다. | 수익률 계산 기준이 같지 않다면 한 차트·한 표에 섞지 않는 것이 중요하다. ETF Campus는 PR만 확정 제공하고, 분배금은 별도 이력으로 분리하는 것이 현재 데이터 수준에 맞다. | [iShares DIVB](https://www.ishares.com/us/products/291387/ishares-core-dividend-etf) |
| iShares Dividend Calendar | 분배형 ETF의 지급 관련 날짜를 `Announcement Date`, `Ex-Date`, `Record Date`, `Pay Date`로 구분하고, 분배 주기와 함께 제공한다. | 이력 카드에서 분배락일·지급일 외에 `분배 주기`를 하나의 짧은 보조 지표로 추가할 가치가 있다. 공시일·기준일은 확실히 확보된 경우에만 전체 이력에서 보조적으로 보여 준다. | [iShares Dividend Calendar](https://www.ishares.com/uk/individual/en/products/dividend-calendar) |
| SPDR Dividend Distributions | 과거 분배 테이블의 기본 열을 `Ex-Date`, `Record Date`, `Payable Date`, `Distribution`으로 두고, 자본이득 분배도 별도 열로 관리한다. | 최근 이력의 최소 필드는 금액·분배락일·지급일이며, 기준일은 보조 필드가 적합하다. 원천이 현금분배인지와 금액이 주당인지를 명시해야 한다. | [SPDR Dividend Distributions](https://www.ssga.com/us/en/intermediary/resources/documents/etf-dividend-distributions) |
| KODEX ETF 분배금 현황 | 운용사 사이트에 ETF 분배금 현황을 별도 정보 영역으로 제공한다. | 국내 사용자도 분배금은 상품 성과 차트보다 독립적인 조회 정보로 받아들이는 관행이 있다. 상세 카드에서 출처를 운용사 공식 공지로 표시하는 방식이 자연스럽다. | [KODEX ETF 분배금 현황](https://www.samsungfund.com/etf/product/distribution.do) |
| SEIBro 분배금 지급현황 | ETF 권리행사 정보 아래에 분배금 지급 현황을 별도 메뉴로 제공한다. 검색 결과 설명은 시가 대비 분배율이 종가 대비 주당분배금 기준임을 고지한다. | 분배율을 추가할 때는 가격 기준일·연환산 여부·세전 여부를 분명히 해야 한다. 현재 단계에서는 분배율을 대표 카드에 넣지 않는 것이 안전하다. | [SEIBro 분배금지급현황](https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml&menuNo=179) |

## 잠정 결론

현재 ETF Campus의 **PR 차트 + 분배금 지급 이력 분리**는 완결된 총수익률을 보여 주는 글로벌 운용사 상세 화면보다 기능은 좁지만, 계산 근거가 불완전한 상황에서 사용자에게 오해를 덜 주는 안전한 선택이다.

다만 경쟁 서비스의 공통된 정보 구조를 반영해 다음 네 항목을 보완할 필요가 있다.

1. 분배금 카드에 `분배 주기`를 추가한다. 값이 확정되지 않으면 `최근 12개월 기준 불규칙`으로 추정하지 않고 `확인 중`으로 표시한다.
2. 카드 헤더에 원천 상태 외에 `최종 갱신일`을 짧게 표기한다.
3. 최근 3건은 카드에 유지하되, 전체 이력은 전용 화면 또는 접근 가능한 펼침 표로 제공한다.
4. 현재 종가와 최근 주당 분배금을 조합한 분배율은 기본 카드에 넣지 않는다. 향후 제공한다면 `최근 1회 분배금 ÷ 기준일 종가`처럼 산식을 화면에서 명시하고, 연환산 수익률과 혼동하지 않도록 별도 보조 지표로 한정한다.

## 주의점

- `Total Return`은 재투자 가정과 수수료·세금 처리 기준에 따라 달라질 수 있으므로, PR과 같은 표·차트에서 명칭만 바꿔 혼합하면 안 된다.
- 지급일은 운용사 공지가 정정될 수 있으므로, 원천·갱신일·확인 상태를 유지해야 한다.
- 배당형이라는 분류만으로 카드가 자동 노출되면 빈 값·추정 정보가 늘어난다. 실제 공식 공지 이벤트가 있을 때만 노출해야 한다.
