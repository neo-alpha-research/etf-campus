$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\functions\api\prices\history.js'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))
$old = @'
  // Hard limit: 5 years (approx 1826 days)
  const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 1826) {
    return json({ error: "range_too_large" }, 400);
  }
'@
$new = @'
  // The 5-year guard protects only alternate series that can delegate to an
  // external provider.  The default PR series is a bounded D1 read and must
  // serve a genuine MAX range from the ETF's listing/first-trading date.
  const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (basis !== "pr" && diffDays > 1826) {
    return json({ error: "range_too_large", scope: "external_series" }, 400);
  }
'@
if (-not $text.Contains($old)) { throw 'Expected range-limit block was not found; no file was changed.' }
[System.IO.File]::WriteAllText((Resolve-Path $path), $text.Replace($old, $new), [System.Text.UTF8Encoding]::new($false))
Write-Output 'Updated history API range guard for local PR data.'
