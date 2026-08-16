$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\components\etf-detail\price-history-chart.tsx'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))
$pattern = 'defaultDates\.start(?!\s*\?\?)'
if ($text -notmatch $pattern) { throw 'No unguarded defaultDates.start reference was found; no file was changed.' }
$updated = [regex]::Replace($text, $pattern, '(defaultDates.start ?? "")')
[System.IO.File]::WriteAllText((Resolve-Path $path), $updated, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Guarded all default MAX start-date references.'
