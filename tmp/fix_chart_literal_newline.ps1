$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\components\etf-detail\price-history-chart.tsx'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))
$literal = ';`n'
if (-not $text.Contains($literal)) { throw 'Literal newline marker was not found; no file was changed.' }
$text = $text.Replace($literal, ";`r`n")
[System.IO.File]::WriteAllText((Resolve-Path $path), $text, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Replaced literal newline marker in chart source.'
