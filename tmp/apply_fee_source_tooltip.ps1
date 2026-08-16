$ErrorActionPreference = 'Stop'
$path = 'components\etf-detail\etf-detail.tsx'
$text = [IO.File]::ReadAllText((Resolve-Path $path), [Text.Encoding]::UTF8)
$anchor = '  const isFeeVerified = fee?.verificationStatus === "verified_official";'
$helper = @'
  const feeSource = fee?.dartReceiptNo
    ? {
        label: "금감원 DART 투자설명서",
        url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${fee.dartReceiptNo}`,
      }
    : fee?.primarySourceUrl
      ? { label: "운용사 공식 자료", url: fee.primarySourceUrl }
      : fee?.secondarySourceUrl
        ? { label: "공식 보조 자료", url: fee.secondarySourceUrl }
        : null;
'@
if (-not $text.Contains($anchor)) { throw 'fee verification anchor not found' }
if (-not $text.Contains('const feeSource =')) { $text = $text.Replace($anchor, "$anchor`r`n$helper") }
$tooltipOpen = '<div className="absolute right-0 sm:left-0 lg:-left-12 top-full mt-3 w-72'
$idx = $text.IndexOf($tooltipOpen)
if ($idx -lt 0) { throw 'tooltip opening not found' }
$gt = $text.IndexOf('>', $idx)
if ($gt -lt 0) { throw 'tooltip opening tag end not found' }
$sourceBlock = @'

                {feeSource && (
                  <div className="mt-3 border-t border-neutral-600 pt-2 text-[11px] text-neutral-300">
                    <span className="mr-1 text-neutral-400">대표 출처:</span>
                    <a
                      className="underline decoration-neutral-500 underline-offset-2 hover:text-white"
                      href={feeSource.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {feeSource.label}
                    </a>
                  </div>
                )}
'@
if (-not $text.Contains('대표 출처:')) { $text = $text.Insert($gt + 1, $sourceBlock) }
[IO.File]::WriteAllText((Resolve-Path $path), $text, (New-Object Text.UTF8Encoding($false)))
Write-Output 'fee source tooltip applied'
