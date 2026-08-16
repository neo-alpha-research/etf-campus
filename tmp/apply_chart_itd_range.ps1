$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\components\etf-detail\price-history-chart.tsx'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))

if ($text -notmatch 'listingDate\?: string') {
  $text = [regex]::Replace($text, '(?m)^(\s*asOfDate\?: string;\r?\n)', '$1  listingDate?: string | null;`n  actualFirstTradingDate?: string | null;`n', 1)
}

$functionPattern = 'export function PriceHistoryChart\(\{ ticker, etfName, asOfDate, returnDisplayStatus \}\)'
if ($text -match $functionPattern) {
  $text = [regex]::Replace($text, $functionPattern, 'export function PriceHistoryChart({ ticker, etfName, asOfDate, listingDate, actualFirstTradingDate, returnDisplayStatus })', 1)
} elseif ($text -notmatch 'actualFirstTradingDate') {
  throw 'Could not find PriceHistoryChart props for safe replacement.'
}

$rangePattern = 'const \{ start: startStr, end: endStr \} = getPricePeriodRange\(period, asOfDate\);'
$rangeReplacement = @'
const periodRange = getPricePeriodRange(period, asOfDate, {
    listingDate,
    actualFirstTradingDate,
  });
  const startStr = periodRange.start;
  const endStr = periodRange.end;
  const maxListingDateUnavailable = period === "itd" && periodRange.dataStatus === "listing_date_unavailable";
'@
if ($text -match $rangePattern) {
  $text = [regex]::Replace($text, $rangePattern, $rangeReplacement, 1)
} elseif ($text -notmatch 'maxListingDateUnavailable') {
  throw 'Could not find chart period range assignment for safe replacement.'
}

$text = $text.Replace('trBlocked || estimatedBlocked ? null : `${baseUrl}/api/prices/history?ticker=${ticker}&start=${startStr}&end=${endStr}&basis=${returnBasis}`', 'trBlocked || estimatedBlocked || !startStr ? null : `${baseUrl}/api/prices/history?ticker=${ticker}&start=${startStr}&end=${endStr}&basis=${returnBasis}`')
$text = $text.Replace('if (points.length === 0) return false;', 'if (!startStr || points.length === 0) return false;')

if ($text -notmatch 'maxListingDateUnavailable') {
  throw 'The MAX unavailable state was not inserted; no file was changed.'
}
[System.IO.File]::WriteAllText((Resolve-Path $path), $text, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Updated chart MAX request range handling.'
