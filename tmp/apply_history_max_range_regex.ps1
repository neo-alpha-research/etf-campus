$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\functions\api\prices\history.js'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))
$pattern = '(?ms)^\s*// Max duration check: 5 years \(approx 1826 days\)\r?\n\s*const diffDays = \(endDate\.getTime\(\) - startDate\.getTime\(\)\) / \(1000 \* 60 \* 60 \* 24\);\r?\n\s*if \(diffDays > 1826\) \{\r?\n\s*return json\(\{ error: "range_too_large" \}, 400\);\r?\n\s*\}\r?\n'
$replacement = @'
  // The 5-year guard protects only alternate series that can delegate to an
  // external provider. The default PR series is a bounded D1 read and must
  // serve a genuine MAX range from the ETF's listing/first-trading date.
  const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (basis !== "pr" && diffDays > 1826) {
    return json({ error: "range_too_large", scope: "external_series" }, 400);
  }
'@
if ($text -notmatch $pattern) { throw 'Expected range-limit block was not found; no file was changed.' }
$updated = [regex]::Replace($text, $pattern, $replacement, 1)
[System.IO.File]::WriteAllText((Resolve-Path $path), $updated, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Updated history API range guard for local PR data.'
