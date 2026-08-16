$path = 'components\etf-detail\etf-detail.tsx'
$content = [IO.File]::ReadAllText($path)

$newTooltip = 'className="absolute right-0 sm:left-0 lg:-left-12 top-full mt-3 w-72 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-2xl z-50 opacity-0 invisible group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-all duration-200 pointer-events-none"'
$updated = [regex]::Replace($content, 'className="absolute right-0[^"]+"', $newTooltip, 1)
if ($updated -eq $content) { throw 'fee tooltip class not found' }
$content = $updated

$oldRow = 'className="flex justify-between"'
$newRow = 'className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2"'
if (-not $content.Contains($oldRow)) { throw 'fee detail row anchor not found' }
$content = $content.Replace($oldRow, $newRow)

$content = $content.Replace('border-t border-gray-700 pt-2', 'mt-2 border-t border-slate-200 pt-3')
$content = $content.Replace('text-neutral-400', 'text-slate-500')

[IO.File]::WriteAllText($path, $content, [Text.UTF8Encoding]::new($false))
Write-Output 'fee detail tooltip visuals improved'
