$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\components\etf-detail\__tests__\price-history-chart.test.tsx'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))
$old = '<PriceHistoryChart ticker="458730" />'
$new = '<PriceHistoryChart ticker="458730" listingDate="2020-09-25" actualFirstTradingDate="2020-09-28" />'
if (-not $text.Contains($old)) { throw 'Expected chart test render call was not found; no file was changed.' }
$text = $text.Replace($old, $new)
$text = $text.Replace('start=1970', 'start=2020-09-28')
[System.IO.File]::WriteAllText((Resolve-Path $path), $text, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Updated MAX chart tests to assert actual first-trading date usage.'
