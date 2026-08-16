$path = 'lib\data\etf-repository.ts'
$content = [IO.File]::ReadAllText($path)
$duplicate = "      fee: feeByTicker.get(ticker) ?? null,`r`n      fee: null,"
$replacement = "      fee: feeByTicker.get(ticker) ?? null,"
if (-not $content.Contains($duplicate)) { throw 'expected duplicate fee field not found' }
$content = $content.Replace($duplicate, $replacement)
[IO.File]::WriteAllText($path, $content, [Text.UTF8Encoding]::new($false))
Write-Output 'duplicate fee field removed'
