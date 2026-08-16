$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\components\etf-detail\price-history-chart.tsx'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))

if ($text -notmatch 'listingDate\?: string') {
  $inlinePropsPattern = 'asOfDate\?: string;\s*returnDisplayStatus\?:'
  $inlinePropsReplacement = 'asOfDate?: string; listingDate?: string | null; actualFirstTradingDate?: string | null; returnDisplayStatus?:'
  if ($text -notmatch $inlinePropsPattern) { throw 'Could not find inline chart prop type for safe replacement.' }
  $text = [regex]::Replace($text, $inlinePropsPattern, $inlinePropsReplacement, 1)
}

$destructure = '{ ticker, etfName, asOfDate, returnDisplayStatus }: {'
if ($text.Contains($destructure)) {
  $text = $text.Replace($destructure, '{ ticker, etfName, asOfDate, listingDate, actualFirstTradingDate, returnDisplayStatus }: {')
} elseif ($text -notmatch 'actualFirstTradingDate') {
  throw 'Could not find PriceHistoryChart destructured props for safe replacement.'
}

$defaultDatePattern = 'const defaultDates = getPricePeriodRange\(period, asOfDate\);'
$defaultDateReplacement = @'
const defaultDates = getPricePeriodRange(period, asOfDate, {
    listingDate,
    actualFirstTradingDate,
  });
  const maxListingDateUnavailable = period === "itd" && defaultDates.dataStatus === "listing_date_unavailable";
'@
if ($text -match $defaultDatePattern) {
  $text = [regex]::Replace($text, $defaultDatePattern, $defaultDateReplacement, 1)
} elseif ($text -notmatch 'maxListingDateUnavailable') {
  throw 'Could not find chart default period range assignment for safe replacement.'
}

$text = $text.Replace('trBlocked || estimatedBlocked ? null : `${baseUrl}/api/prices/history?ticker=${ticker}&start=${startStr}&end=${endStr}&basis=${returnBasis}`', 'trBlocked || estimatedBlocked || !startStr ? null : `${baseUrl}/api/prices/history?ticker=${ticker}&start=${startStr}&end=${endStr}&basis=${returnBasis}`')
$text = $text.Replace('if (points.length === 0) return false;', 'if (!startStr || points.length === 0) return false;')

if ($text -notmatch 'maxListingDateUnavailable') { throw 'The MAX unavailable state was not inserted; no file was changed.' }
[System.IO.File]::WriteAllText((Resolve-Path $path), $text, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Updated chart MAX request range handling.'
