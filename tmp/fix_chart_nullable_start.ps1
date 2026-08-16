$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\components\etf-detail\price-history-chart.tsx'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))
$old = 'const startStr = isCustom ? customStart : defaultDates.start;'
$new = 'const startStr = isCustom ? customStart : (defaultDates.start ?? "");'
if (-not $text.Contains($old)) { throw 'Expected chart start range assignment was not found; no file was changed.' }
[System.IO.File]::WriteAllText((Resolve-Path $path), $text.Replace($old, $new), [System.Text.UTF8Encoding]::new($false))
Write-Output 'Normalized absent MAX start date to an empty request sentinel.'
