$path = 'components\etf-detail\etf-detail.tsx'
$content = [IO.File]::ReadAllText($path)
$newDisplay = '{realBurdenPct !== null ? `${realBurdenPct.toFixed(4)}%` : "확인 중"}'
$updated = [regex]::Replace($content, '\{realBurdenPct !== null \? `\$\{realBurdenPct\.toFixed\(4\)\}%` : .*?\}', $newDisplay, 1)
if ($updated -eq $content) { throw 'real burden display expression not found' }
[IO.File]::WriteAllText($path, $updated, [Text.UTF8Encoding]::new($false))
Write-Output 'real burden JSX corrected'
