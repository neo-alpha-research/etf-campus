$path = 'lib\data\etf-repository.ts'
$content = [IO.File]::ReadAllText($path)

$issuerImport = 'import { resolveIssuer } from "./etf-amc-mapping";'
$feeImport = 'import { loadOfficialEtfFeeIndex } from "./etf-fee-registry";'
if (-not $content.Contains($feeImport)) {
  if (-not $content.Contains($issuerImport)) { throw 'issuer import anchor not found' }
  $content = $content.Replace($issuerImport, "$issuerImport`r`n$feeImport")
}

$masterAnchor = '  const masterRows = readCsv(path.join(dataDirectory, "etf_master_draft.csv"));'
$feeIndexLine = '  const feeByTicker = loadOfficialEtfFeeIndex(dataDirectory);'
if (-not $content.Contains($feeImport)) {
  if (-not $content.Contains($issuerImport)) { throw 'issuer import anchor not found' }
  $content = $content.Replace($issuerImport, "$issuerImport`r`n$feeImport")
}

$masterAnchor = '  const masterRows = readCsv(path.join(dataDirectory, "etf_master_draft.csv"));'
$feeIndexLine = '  const feeByTicker = loadOfficialEtfFeeIndex(dataDirectory);'
if (-not $content.Contains($feeIndexLine)) {
  if (-not $content.Contains($masterAnchor)) { throw 'master rows anchor not found' }
  $content = $content.Replace($masterAnchor, "$masterAnchor`r`n$feeIndexLine")
}

$aumAnchor = '      aum: parseNumberField(master, "aum", `master:${ticker}`),'
$feeLine = '      fee: feeByTicker.get(ticker) ?? null,'
if (-not $content.Contains($feeLine)) {
  if (-not $content.Contains($aumAnchor)) { throw 'aum anchor not found' }
  $content = $content.Replace($aumAnchor, "$aumAnchor`r`n$feeLine")
}

[IO.File]::WriteAllText($path, $content, [Text.UTF8Encoding]::new($false))
Write-Output 'etf-repository fee registry integration applied'
