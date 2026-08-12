import re

with open('components/screener/screener.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_thead = """                <thead className="bg-neutral-50 text-xs font-bold text-muted">
                  <tr>
                    <th className="w-[150px] min-w-[150px] max-w-[150px] px-3 py-3" scope="col">종목명</th>
                    <th className="px-3 py-3 text-right" scope="col">{RETURN_PERIOD_LABELS[selectedPeriod]} 수익률</th>
                    <th className="px-3 py-3 text-right" scope="col" title="선택 기간과 별도로 보는 장기 참고 수익률">1년 수익률</th>
                    <th className="px-3 py-3 text-right" scope="col">총보수</th>
                    <th className="hidden px-3 py-3 text-right lg:table-cell" scope="col">순자산</th>
                    <th className="hidden px-3 py-3 text-right lg:table-cell" scope="col">거래대금</th>
                    <th className="hidden px-3 py-3 md:table-cell" scope="col">태그</th>
                  </tr>
                </thead>"""

new_thead = """                <thead className="bg-neutral-50 text-xs font-bold text-muted border-b border-line">
                  <tr>
                    <th className="px-3 py-3 text-left min-w-[200px]" scope="col">종목 및 특징</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap" scope="col">수익률 트렌드</th>
                    <th className="px-3 py-3 text-right hidden sm:table-cell whitespace-nowrap" scope="col">자산규모 및 보수</th>
                  </tr>
                </thead>"""

old_tbody_tr = """                      <th className="w-[150px] min-w-[150px] max-w-[150px] px-3 py-4 font-normal" scope="row">
                        <Link className="break-all whitespace-normal font-bold text-strong hover:text-brand-700" href={`/etf/${etf.ticker}`}>{etf.name}</Link>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                          <span className="tabular-nums">{etf.ticker}</span>
                          <span className="text-neutral-300">|</span>
                          <span className="truncate">{etf.classification?.marketScope || etf.assetClass}</span>
                        </div>
                      </th>
                      <td className="px-3 py-4 text-right"><ReturnCell value={etf.returns[selectedPeriod]} /></td>
                      <td className="px-3 py-4 text-right"><ReturnCell value={etf.returns["12m"]} /></td>
                      <td className="tabular-nums px-3 py-4 text-right">{(etf.ter * 100).toFixed(2)}%</td>
                      <td className="tabular-nums hidden px-3 py-4 text-right lg:table-cell">{formatMoney(etf.aum)}</td>
                      <td className="tabular-nums hidden px-3 py-4 text-right lg:table-cell">{formatMoney(etf.tradeValue)}</td>
                      <td className="hidden px-3 py-4 md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          <RiskBadge riskType={etf.riskType} />
                          <PensionBadge status={etf.pension} />
                        </div>
                      </td>"""

new_tbody_tr = """                      <th className="px-3 py-4 font-normal" scope="row">
                        <div className="flex flex-col gap-1.5">
                          <Link className="break-all whitespace-normal font-bold text-strong hover:text-brand-700 leading-snug" href={`/etf/${etf.ticker}`}>
                            {etf.name}
                          </Link>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                            <span className="font-semibold text-strong">{etf.amc}</span>
                            <span className="text-neutral-300">|</span>
                            <span className="tabular-nums">{etf.ticker}</span>
                            <span className="text-neutral-300">|</span>
                            {etf.dividendFrequency === "월배당" && (
                              <>
                                <span className="font-bold text-brand-600">월배당</span>
                                <span className="text-neutral-300">|</span>
                              </>
                            )}
                            <span className="truncate">{etf.classification?.marketScope || etf.assetClass}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {etf.riskType !== "normal" && <RiskBadge riskType={etf.riskType} />}
                            <PensionBadge status={etf.pension} />
                          </div>
                        </div>
                      </th>
                      <td className="px-3 py-4 align-top">
                        <div className="flex items-center justify-center gap-3 sm:gap-5 mt-0.5">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold text-brand-700">{RETURN_PERIOD_LABELS[selectedPeriod]} (기준)</span>
                            <div className="rounded-md bg-brand-50 px-2 py-0.5">
                              <ReturnCell value={etf.returns[selectedPeriod]} />
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-muted">3개월</span>
                            <div className="py-0.5">
                              <ReturnCell value={etf.returns["3m"]} />
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-muted">1년</span>
                            <div className="py-0.5">
                              <ReturnCell value={etf.returns["12m"]} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-3 py-4 text-right align-top sm:table-cell">
                        <div className="flex flex-col items-end gap-1.5 mt-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-muted">💰 순자산</span>
                            <span className="text-[13px] font-bold tabular-nums text-strong">{formatMoney(etf.aum)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-muted">💸 총보수</span>
                            <span className="text-[13px] font-semibold tabular-nums text-muted">{(etf.ter * 100).toFixed(2)}%</span>
                          </div>
                        </div>
                      </td>"""

if old_thead in content and old_tbody_tr in content:
    content = content.replace(old_thead, new_thead)
    content = content.replace(old_tbody_tr, new_tbody_tr)
    with open('components/screener/screener.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Successfully applied table redesign.')
else:
    print('Failed to find exact block.')
    if old_thead not in content:
        print('thead not found')
    if old_tbody_tr not in content:
        print('tbody_tr not found')
