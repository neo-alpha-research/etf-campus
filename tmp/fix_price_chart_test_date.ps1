$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\components\etf-detail\__tests__\price-history-chart.test.tsx'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))
$old = 'start=2020-09-28-01-01'
$new = 'start=2020-09-28'
if (-not $text.Contains($old)) { throw 'Expected malformed MAX test date was not found; no file was changed.' }
[System.IO.File]::WriteAllText((Resolve-Path $path), $text.Replace($old, $new), [System.Text.UTF8Encoding]::new($false))
Write-Output 'Repaired MAX request expectation date.'
