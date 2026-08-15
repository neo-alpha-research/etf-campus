param(
    [string]$StartDate = "20250814",
    [string]$EndDate = "20260814"
)

# Parse secrets.txt and set environment variables
Get-Content .\secrets.txt | ForEach-Object {
    if ($_ -match '^\s*([^#\s][^=]+)=(.*)$') {
        Set-Item -Path "Env:$($matches[1].Trim())" -Value $matches[2].Trim()
    }
}

if (-not $env:PRICE_INGEST_HMAC_SECRET) {
    Write-Error "PRICE_INGEST_HMAC_SECRET not found in secrets.txt"
    exit 1
}

Write-Output "Starting 1-year backfill from $StartDate to $EndDate"

# Define 14 chunks of 30 days to cover a year + some buffer
$current = [datetime]::ParseExact($StartDate, "yyyyMMdd", $null)
$end = [datetime]::ParseExact($EndDate, "yyyyMMdd", $null)

while ($current -le $end) {
    # chunk end is current + 30 days, or $end if it's less
    $chunkEnd = $current.AddDays(30)
    if ($chunkEnd -gt $end) {
        $chunkEnd = $end
    }
    
    $startStr = $current.ToString("yyyyMMdd")
    $endStr = $chunkEnd.ToString("yyyyMMdd")
    
    Write-Output "`n================================================"
    Write-Output "Running backfill for chunk: $startStr to $endStr"
    Write-Output "================================================"
    
    # Run the backfill script
    # It will automatically cap at 25 trading days, which fits nicely in a 30 calendar-day window
    python scripts/backfill_api.py --start-date $startStr --end-date $endStr --source fsc
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Some dates failed in chunk $startStr to $endStr, continuing anyway..."
    }
    
    $current = $chunkEnd.AddDays(1)
    
    Write-Output "Sleeping for 5 seconds to respect rate limits..."
    Start-Sleep -Seconds 5
}

Write-Output "Backfill complete!"
