$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\components\etf-detail\etf-detail.tsx'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))
$old = '<PriceHistoryChart ticker={etf.ticker} etfName={etf.name} asOfDate={etf.asOfDate} returnDisplayStatus={returnDisplayStatus as any} />'
$new = '<PriceHistoryChart ticker={etf.ticker} etfName={etf.name} asOfDate={etf.asOfDate} listingDate={etf.listingDate} actualFirstTradingDate={etf.firstTradedDate} returnDisplayStatus={returnDisplayStatus as any} />'
if ($text.Contains($new)) {
  Write-Output 'Chart metadata props are already present.'
} elseif ($text.Contains($old)) {
  [System.IO.File]::WriteAllText((Resolve-Path $path), $text.Replace($old, $new), [System.Text.UTF8Encoding]::new($false))
  Write-Output 'Connected listing metadata to PriceHistoryChart.'
} else {
  throw 'Expected one-line PriceHistoryChart invocation was not found; no file was changed.'
}
