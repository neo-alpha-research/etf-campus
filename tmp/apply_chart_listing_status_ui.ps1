$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\components\etf-detail\price-history-chart.tsx'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))
if ($text -match '상장일 확인 중') {
  Write-Output 'Listing-date status UI is already present.'
  exit 0
}
$pattern = '\)\s*:\s*error\s*\?\s*\('
$replacement = @'
) : maxListingDateUnavailable ? (
        <div className="p-8 text-center text-muted bg-neutral-50 rounded-2xl text-sm font-medium">
          상장일 확인 중
        </div>
      ) : error ? (
'@
if ($text -notmatch $pattern) { throw 'Could not find chart error-state branch; no file was changed.' }
$updated = [regex]::Replace($text, $pattern, $replacement, 1)
[System.IO.File]::WriteAllText((Resolve-Path $path), $updated, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Added listing-date-unavailable chart status UI.'
