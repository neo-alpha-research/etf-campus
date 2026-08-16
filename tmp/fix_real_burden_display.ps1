$path = 'components\etf-detail\etf-detail.tsx'
$content = [IO.File]::ReadAllText($path)

$feeAnchor = '  const isFeeVerified = fee?.verificationStatus === "verified_official";'
$feeLogic = @'
  const isFeeVerified = fee?.verificationStatus === "verified_official";
  const hasCompleteRealBurden =
    isFeeVerified &&
    fee?.totalFeePct !== null &&
    fee?.otherCostPct !== null &&
    fee?.tradingCostPct !== null;
  const realBurdenPct = hasCompleteRealBurden
    ? fee.totalFeePct + fee.otherCostPct + fee.tradingCostPct
    : null;
'@.TrimEnd()
if (-not $content.Contains($feeAnchor)) { throw 'fee verification anchor not found' }
$content = $content.Replace($feeAnchor, $feeLogic)

$oldDisplay = '{isFeeVerified && fee?.totalFeePct !== null ? `${fee.totalFeePct}%` : "확인 중"}'
$newDisplay = '{realBurdenPct !== null ? `${realBurdenPct.toFixed(4)}%` : "확인 중"}'
if (-not $content.Contains($oldDisplay)) { throw 'real burden display anchor not found' }
$content = $content.Replace($oldDisplay, $newDisplay)

[IO.File]::WriteAllText($path, $content, [Text.UTF8Encoding]::new($false))
Write-Output 'real burden display now requires all three official cost components'
