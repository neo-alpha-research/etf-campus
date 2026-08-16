$path = 'lib\domain\etf-types.ts'
$content = [IO.File]::ReadAllText($path)
$old = '  fee: EtfFeeInfo | null;'
$new = '  fee?: EtfFeeInfo | null;'
if (-not $content.Contains($old)) { throw 'fee type anchor not found' }
$content = $content.Replace($old, $new)
[IO.File]::WriteAllText($path, $content, [Text.UTF8Encoding]::new($false))
Write-Output 'Etf fee field made optional for fixture compatibility'
