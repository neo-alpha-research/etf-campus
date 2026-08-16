# ETF 상세 페이지 분배금·총수익률 표시 리서치 노트

조사일: 2026-08-16 (KST)

| 서비스 | 확인된 표시 관행 | ETF Campus 적용 시사점 | 출처 |
|---|---|---|---|
| justETF | ETF 프로필에서 분배 정책·빈도·최근 12개월 분배금·현재 분배율을 함께 표시한다. 성과 표의 기본값은 분배금을 포함한 total performance이며, 해당 정의를 명시한다. | 분배금 카드에는 **최근 1건만** 두지 말고 최근 12개월 합계와 빈도를 보조 정보로 제공한다. ETF Campus는 PR 기본 원칙을 유지하되, 토글 전환 시 수익률 정의를 선명히 표기한다. | https://www.justetf.com/en/etf-profile.html?isin=IE00B3RBWM25 |
| Morningstar | 상단 요약에 배당수익률·규모·보수를 배치하고, 차트에서 배당 관련 도구를 제공한다. 성과 표는 ETF·동종·벤치마크를 기간별로 비교한다. | 차트 토글은 제목 옆에 두고, 하단 기간 수익률 표는 차트와 반드시 같은 기준(PR/D2/D3)으로 동기화해야 한다. | https://www.morningstar.com/help-center/funds/etf-quote-page |
| K-ETF | 배당 수익률을 별도 랭킹·필터 기준으로 제공한다. | 상세페이지에서는 현재의 수익률과 배당수익률을 혼동시키지 않고, 분배금과 분배금 반영 수익률을 분리해야 한다. | https://www.k-etf.com/rank/dividend_yield |

## 설계 원칙

1. **정의가 먼저, 수치가 다음이다.** 차트 선택 상태와 기간 수익률 표의 열/행은 동일한 PR·D2·D3 기준을 공유한다.
2. **기본값은 PR이다.** 분배금 반영 수익률은 사용자가 명시적으로 전환한 경우에만 보이며, 추정(D2)과 검증(D3)을 동일한 명칭으로 섞지 않는다.
3. **원천·검증 상태를 짧게 노출한다.** 최근 분배금의 금액·분배락일·지급일과 함께 `검증 완료`, `운용사 공지 기반`, `확인 중` 중 하나를 표기한다.
4. **없는 값은 0으로 표시하지 않는다.** 지급일·기준일 등이 원문에서 비어 있으면 `확인 중`으로 표시한다.
5. **기간 수익률은 커버리지 밖에서 산출하지 않는다.** 선택 기간이 D2/D3 데이터 첫·마지막 날짜를 넘으면 해당 셀은 `—`와 사유로 처리한다.

## 현재 ETF Campus 데이터 연결 포인트

- `data/distributions/etf_distribution_events.csv`: `ex_date`, `record_date`, `pay_date`, `distribution_per_share_krw`, `verification_status`, 원천 ID 보유.
- `data/returns/estimated_distribution_return_history.csv`: D2 일별 `estimated_distribution_index`, `estimated_return_pct`, `distribution_cash`, `quality_status` 보유.
- `data/returns/etf_return_display_status.json`: ETF별 배당형 여부, D2/D3 제공 가능 여부, 사용 가능 기간과 차단 사유 보유.
- 기준: 운용사 공식 공지 기반 D2는 `추정`, KIND 교차 대조·전기간 게이트 통과 D3만 `검증 TR`로 표기.

## 참고 문장

> justETF는 “By default, the total performance of the ETF is displayed.”라고 밝히며, 성과가 분배금을 포함한다는 기준을 별도로 고지한다.

> Morningstar는 ETF 상세 화면의 차트에서 배당 관련 도구를 제공하고, 성과 표를 ETF·동종·벤치마크의 복수 기간 비교 영역으로 설명한다.

## References

[1] [justETF — Vanguard FTSE All-World UCITS ETF profile](https://www.justetf.com/en/etf-profile.html?isin=IE00B3RBWM25)

[2] [Morningstar — ETF quote page guide](https://www.morningstar.com/help-center/funds/etf-quote-page)

[3] [K-ETF — 배당 수익률 랭킹](https://www.k-etf.com/rank/dividend_yield)
