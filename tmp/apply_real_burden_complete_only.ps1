$path = 'components\etf-detail\etf-detail.tsx'
$content = [IO.File]::ReadAllText($path)

$anchor = 'const isFeeVerified = fee?.verificationStatus === "verified_official";'
$logic = @'
const isFeeVerified = fee?.verificationStatus === "verified_official";
  const hasCompleteRealBurden =
    isFeeVerified &&
    fee?.totalFeePct !== null &&
    fee?.otherCostPct !== null &&
    fee?.tradingCostPct !== null;
  const realBurdenPct = hasCompleteRealBurden
    ? fee.totalFeePct + fee.otherCostPct + fee.tradingCostPct
    : null;
'@
if ($content.IndexOf($anchor) -lt 0) { throw 'fee verification anchor not found' }
if ($content.Contains('const hasCompleteRealBurden')) { throw 'real burden logic already exists' }
$content = $content.Replace($anchor, $logic)

$needle = 'getFeeStatusText(fee?.verificationStatus)'
$needleAt = $content.IndexOf($needle)
if ($needleAt -lt 0) { throw 'main fee status expression not found' }
$start = $content.LastIndexOf('{isFeeVerified', $needleAt)
$end = $content.IndexOf('}', $needleAt)
if ($start -lt 0 -or $end -lt $start) { throw 'main fee expression bounds not found' }

$replacement = '{realBurdenPct !== null ? `${realBurdenPct.toFixed(4)}%` : <span className="text-[12px] font-semibold text-amber-700">{"\uD655\uC778 \uC911"}</span>}'
$content = $content.Substring(0, $start) + $replacement + $content.Substring($end + 1)
[IO.File]::WriteAllText($path, $content, [Text.UTF8Encoding]::new($false))
Write-Output 'real burden complete-only logic applied'
