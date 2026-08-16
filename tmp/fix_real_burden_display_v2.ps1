$path = 'components\etf-detail\etf-detail.tsx'
$content = [IO.File]::ReadAllText($path)

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
$updated = [regex]::Replace($content, 'const isFeeVerified = fee\?\.verificationStatus === "verified_official";', $feeLogic, 1)
if ($updated -eq $content) { throw 'fee verification expression not found' }
$content = $updated

$newDisplay = '{realBurdenPct !== null ? `${realBurdenPct.toFixed(4)}%` : <span className="text-[12px] font-semibold text-amber-700">확인 중</span>}'
$updated = [regex]::Replace($content, '\{isFeeVerified && fee\?\.totalFeePct !== null \? `\$\{fee\.totalFeePct\}%` : <span[^>]*>.*?</span>\}', $newDisplay, 1)
if ($updated -eq $content) { throw 'real burden JSX expression not found' }
$content = $updated

[IO.File]::WriteAllText($path, $content, [Text.UTF8Encoding]::new($false))
Write-Output 'real burden display now requires all three official cost components'
