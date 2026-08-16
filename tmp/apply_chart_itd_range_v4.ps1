$ErrorActionPreference = 'Stop'

$chartPath = Join-Path $PSScriptRoot '..\components\etf-detail\price-history-chart.tsx'
$chart = [System.IO.File]::ReadAllText((Resolve-Path $chartPath))

$rangePattern = 'getPricePeriodRange\(period,\s*returnBasis === "estimated" \?\s*estimatedAsOfDate : asOfDate\)'
$rangeReplacement = 'getPricePeriodRange(period, returnBasis === "estimated" ? estimatedAsOfDate : asOfDate, { listingDate, actualFirstTradingDate })'
if ($chart -match $rangePattern) {
  $chart = [regex]::Replace($chart, $rangePattern, $rangeReplacement, 1)
}
if ($chart -notmatch 'actualFirstTradingDate') { throw 'Chart has no first-trading-date prop after patch.' }
if ($chart -notmatch 'getPricePeriodRange\(period,[\s\S]*actualFirstTradingDate') { throw 'Chart period range does not receive listing metadata.' }

if ($chart -notmatch 'maxListingDateUnavailable') {
  $chart = [regex]::Replace($chart, '(?m)^(\s*const defaultDates = useMemo\([^\r\n]+\);\r?\n)', '$1  const maxListingDateUnavailable = period === "itd" && defaultDates.dataStatus === "listing_date_unavailable";`n', 1)
}
if ($chart -notmatch 'trBlocked \|\| estimatedBlocked \|\| !startStr') {
  $chart = $chart.Replace('trBlocked || estimatedBlocked ? null : `${baseUrl}/api/prices/history?ticker=${ticker}&start=${startStr}&end=${endStr}&basis=${returnBasis}`', 'trBlocked || estimatedBlocked || !startStr ? null : `${baseUrl}/api/prices/history?ticker=${ticker}&start=${startStr}&end=${endStr}&basis=${returnBasis}`')
}
$chart = $chart.Replace('if (points.length === 0) return false;', 'if (!startStr || points.length === 0) return false;')
[System.IO.File]::WriteAllText((Resolve-Path $chartPath), $chart, [System.Text.UTF8Encoding]::new($false))

$detailPath = Join-Path $PSScriptRoot '..\components\etf-detail\etf-detail.tsx'
$detail = [System.IO.File]::ReadAllText((Resolve-Path $detailPath))
if ($detail -notmatch 'listingDate=\{etf\.listingDate\}') {
  $namePattern = '(?m)^(\s*)etfName=\{etf\.name\}\r?$'
  if ($detail -notmatch $namePattern) { throw 'Could not find PriceHistoryChart etfName prop for safe insertion.' }
  $detail = [regex]::Replace($detail, $namePattern, '$1etfName={etf.name}`n$1listingDate={etf.listingDate}`n$1actualFirstTradingDate={etf.firstTradedDate}', 1)
}
if ($detail -notmatch 'actualFirstTradingDate=\{etf\.firstTradedDate\}') { throw 'Chart metadata props were not inserted.' }
[System.IO.File]::WriteAllText((Resolve-Path $detailPath), $detail, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Connected ETF listing metadata to the chart MAX range.'
