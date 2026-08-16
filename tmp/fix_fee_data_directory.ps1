$route = 'app\api\fees\route.ts'
$routeContent = [IO.File]::ReadAllText($route)
if (-not $routeContent.Contains('import path from "node:path";')) {
  $routeContent = $routeContent.Replace('import { NextResponse } from "next/server";', "import path from `"node:path`";`r`nimport { NextResponse } from `"next/server`";")
}
$routeContent = $routeContent.Replace('loadOfficialEtfFeeIndex(process.cwd())', 'loadOfficialEtfFeeIndex(path.join(process.cwd(), "data"))')
[IO.File]::WriteAllText($route, $routeContent, [Text.UTF8Encoding]::new($false))

$test = 'lib\data\__tests__\etf-fee-registry.test.ts'
$testContent = [IO.File]::ReadAllText($test)
if (-not $testContent.Contains('import path from "node:path";')) {
  $testContent = $testContent.Replace('import { describe, expect, it } from "vitest";', "import path from `"node:path`";`r`nimport { describe, expect, it } from "vitest";")
}
$testContent = $testContent.Replace('loadOfficialEtfFeeIndex(process.cwd())', 'loadOfficialEtfFeeIndex(path.join(process.cwd(), "data"))')
[IO.File]::WriteAllText($test, $testContent, [Text.UTF8Encoding]::new($false))
Write-Output 'fee registry data directory references corrected'
