$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\scripts\update_daily_data.py'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path))
$old = @'
        itd_anchor = as_float(old_return.get("itd_anchor_close"))
        if is_new and itd_anchor is None and listing_close is not None:
            itd_anchor = listing_close
            old_return["itd_anchor_close"] = listing_close
        old_return["r_itd"] = pct(current_close, itd_anchor) if is_new else ""
'@
$new = @'
        # Preserve an existing verified ITD anchor. The anchor is first filled
        # from the official listing-date snapshot and is never blanked merely
        # because the ETF has aged past its new-listing window.
        itd_anchor = as_float(old_return.get("itd_anchor_close"))
        if itd_anchor is None and listing_close is not None:
            itd_anchor = listing_close
            old_return["itd_anchor_close"] = listing_close
            old_return["itd_anchor_date"] = listing_day.isoformat() if listing_day else ""
            old_return["itd_source"] = source
            old_return["itd_quality_status"] = "official_listing_snapshot"
        old_return["r_itd"] = pct(current_close, itd_anchor)
        old_return["itd_latest_date"] = as_of.isoformat()
        old_return["itd_latest_close"] = current_close if current_close is not None else ""
        old_return["itd_return_type"] = "price_return"
'@
if (-not $text.Contains($old)) { throw 'Expected ITD update block was not found; no file was changed.' }
[System.IO.File]::WriteAllText((Resolve-Path $path), $text.Replace($old, $new), [System.Text.UTF8Encoding]::new($false))
Write-Output 'Updated scripts/update_daily_data.py ITD block.'
