$ErrorActionPreference = 'Stop'
$path = 'components\etf-detail\etf-detail.tsx'
$text = [IO.File]::ReadAllText((Resolve-Path $path), [Text.Encoding]::UTF8)
$start = $text.IndexOf('  const feeSource =')
if ($start -lt 0) { throw 'feeSource start not found' }
$endMarker = '        : null;'
$end = $text.IndexOf($endMarker, $start)
if ($end -lt 0) { throw 'feeSource end not found' }
$end += $endMarker.Length
$helper = @'
  const feeSource = fee?.dartReceiptNo
    ? {
        label: "\uAE08\uAC10\uC6D0 DART \uD22C\uC790\uC124\uBA85\uC11C",
        url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${fee.dartReceiptNo}`,
      }
    : fee?.primarySourceUrl
      ? { label: "\uC6B4\uC6A9\uC0AC \uACF5\uC2DD \uC790\uB8CC", url: fee.primarySourceUrl }
      : fee?.secondarySourceUrl
        ? { label: "\uACF5\uC2DD \uBCF4\uC870 \uC790\uB8CC", url: fee.secondarySourceUrl }
        : null;
'@
$text = $text.Substring(0,$start) + $helper + $text.Substring($end)
$text = $text.Replace('대표 출처:', '\uB300\uD45C \uCD9C\uCC98:')
[IO.File]::WriteAllText((Resolve-Path $path), $text, (New-Object Text.UTF8Encoding($false)))
Write-Output 'fee source tooltip encoding fixed'
