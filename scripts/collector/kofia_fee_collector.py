#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KOFIA DIS ETF Fee Collector (NHN Cloud / n8n Production Worker)
--------------------------------------------------------------
Author: ETF Campus Data Engineering Team
Purpose:
  Scrapes monthly ETF total expense ratio (명목총보수, 기타비용, TER, 매매중개수수료율)
  directly from KOFIA DIS (금융투자협회 전자공시시스템) using Playwright Headless Browser
  running on NHN Cloud with a domestic static Korean IP address.
"""

import os
import sys
import json
import csv
import re
import time
import argparse
import datetime
from typing import Dict, Any, List, Optional

try:
    from playwright.sync_api import sync_playwright, Response
except ImportError:
    print("[ERROR] Playwright is not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)

KOFIA_DIS_URL = (
    "https://dis.kofia.or.kr/websquare/index.jsp?"
    "w2xPath=/wq/fundann/DISFundFeeCmp.xml&divisionId=MDIS01005001000000&serviceId=SDIS01005001000"
)

def load_master_etfs(master_csv_path: str) -> Dict[str, Dict[str, str]]:
    """Loads etf_master_draft.csv to map tickers with fund standard codes and names."""
    mapping = {}
    if not os.path.exists(master_csv_path):
        print(f"[WARN] Master CSV not found at {master_csv_path}. Proceeding with existing registry.")
        return mapping

    with open(master_csv_path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = row.get("srtnCd", "").strip()
            if ticker:
                mapping[ticker] = {
                    "ticker": ticker,
                    "isin": row.get("isin", "").strip(),
                    "name": row.get("etfNm", "").strip(),
                    "standard_code": row.get("stdCd", "").strip(),
                    "issuer": row.get("issuerName", "").strip(),
                }
    return mapping


def parse_kofia_fee_packet(packet_text: str) -> List[Dict[str, Any]]:
    """Parses XML/JSON response packet intercepted from WebSquare RPC."""
    extracted = []
    
    # WebSquare XML/JSON response parsing
    # Typically contains fund code, fund name, total_fee, other_cost, trading_cost, base_date
    row_matches = re.findall(r'<row>(.*?)</row>', packet_text, re.DOTALL)
    if not row_matches:
        # Fallback to JSON array matching if WebSquare sends JSON
        try:
            data = json.loads(packet_text)
            if isinstance(data, dict):
                # Search for nested row arrays
                for v in data.values():
                    if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                        return v
        except Exception:
            pass
        return extracted

    for r in row_matches:
        # Helper to extract tag value
        def get_val(tag: str) -> Optional[str]:
            m = re.search(rf'<{tag}>([^<]*)</{tag}>', r)
            return m.group(1).strip() if m else None

        standard_code = get_val("standardCd") or get_val("fundCd") or get_val("stdCd")
        fund_name = get_val("fundNm") or get_val("fundKorNm")
        total_fee = get_val("totFee") or get_val("totFeeRate") or get_val("totalFee")
        other_cost = get_val("etcFee") or get_val("etcFeeRate") or get_val("otherCost")
        ter = get_val("ter") or get_val("terRate")
        trading_cost = get_val("tradeFee") or get_val("tradeFeeRate") or get_val("tradingCost")
        base_date = get_val("baseDt") or get_val("stdDt") or get_val("standardDt")

        if standard_code or fund_name:
            extracted.append({
                "standard_code": standard_code,
                "fund_name": fund_name,
                "total_fee": float(total_fee) if total_fee and re.match(r'^\d+(\.\d+)?$', total_fee) else None,
                "other_cost": float(other_cost) if other_cost and re.match(r'^\d+(\.\d+)?$', other_cost) else None,
                "ter": float(ter) if ter and re.match(r'^\d+(\.\d+)?$', ter) else None,
                "trading_cost": float(trading_cost) if trading_cost and re.match(r'^\d+(\.\d+)?$', trading_cost) else None,
                "base_date": base_date,
            })

    return extracted


def scrape_kofia_fees(headless: bool = True) -> List[Dict[str, Any]]:
    """Launches Playwright headless Chromium to query KOFIA DIS and intercept grid data."""
    print(f"[{datetime.datetime.now().isoformat()}] Launching Headless Chromium via Playwright...")
    results = []
    intercepted_packets = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--single-process",
                "--disable-gpu",
            ],
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="ko-KR",
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()

        # Intercept background RPC network responses
        def on_response(response: Response):
            if "callProc" in response.url or "XMLservices" in response.url or "Fee" in response.url:
                try:
                    text = response.text()
                    if "<row>" in text or "totFee" in text or "ter" in text:
                        intercepted_packets.append(text)
                except Exception:
                    pass

        page.on("response", on_response)

        print(f"Navigating to KOFIA DIS: {KOFIA_DIS_URL}")
        page.goto(KOFIA_DIS_URL, wait_until="networkidle", timeout=45000)
        time.sleep(3)

        # 1. Look for ETF / Index fund checkbox or dropdown
        try:
            # Click ETF checkbox or tab if present
            etf_elem = page.locator("text='상장지수(ETF)'").or_(page.locator("text='ETF'"))
            if etf_elem.count() > 0:
                print("Selecting ETF category filter...")
                etf_elem.first.click()
                time.sleep(1)

            # 2. Click Search button
            search_btn = page.locator("input[value='조회']").or_(page.locator("button:has-text('조회')")).or_(page.locator("#btnSearch"))
            if search_btn.count() > 0:
                print("Triggering Search query (조회)...")
                search_btn.first.click()
                time.sleep(5)
                page.wait_for_load_state("networkidle", timeout=30000)
        except Exception as e:
            print(f"[WARN] Interaction issue on KOFIA DIS page: {e}")

        # Process intercepted packets
        print(f"Intercepted {len(intercepted_packets)} RPC response packet(s).")
        for pkt in intercepted_packets:
            rows = parse_kofia_fee_packet(pkt)
            if rows:
                results.extend(rows)

        # If network interception yielded no rows, parse DOM grid directly
        if not results:
            print("Falling back to DOM table extraction from WebSquare Grid...")
            table_rows = page.locator(".w2grid_body_table tbody tr").all()
            print(f"Found {len(table_rows)} DOM grid rows.")
            for tr in table_rows:
                cells = [c.inner_text().strip() for c in tr.locator("td").all()]
                if len(cells) >= 7:
                    # Generic mapping based on standard KOFIA grid layout
                    # [펀드명, 총보수, 기타비용, TER, 매매수수료율, 기준일...]
                    try:
                        results.append({
                            "fund_name": cells[0],
                            "total_fee": float(cells[1].replace("%", "")) if cells[1] else None,
                            "other_cost": float(cells[2].replace("%", "")) if cells[2] else None,
                            "ter": float(cells[3].replace("%", "")) if cells[3] else None,
                            "trading_cost": float(cells[4].replace("%", "")) if cells[4] else None,
                            "base_date": cells[5] if len(cells) > 5 else None,
                        })
                    except ValueError:
                        continue

        browser.close()

    print(f"Total raw fund records extracted from KOFIA DIS: {len(results)}")
    return results


def run_pipeline(
    registry_path: str,
    master_csv_path: str,
    output_path: Optional[str] = None,
    headless: bool = True,
    dry_run: bool = False,
):
    """Integrates scraped KOFIA DIS fees into etf_fee_registry.json with circuit breaker validation."""
    target_output = output_path or registry_path
    master_mapping = load_master_etfs(master_csv_path)

    # Load existing registry
    if not os.path.exists(registry_path):
        print(f"[ERROR] Existing fee registry not found at {registry_path}")
        sys.exit(1)

    with open(registry_path, "r", encoding="utf-8") as f:
        registry_list = json.load(f)

    registry_dict = {item["ticker"]: item for item in registry_list}
    print(f"Loaded existing registry with {len(registry_dict)} tickers.")

    # Scrape KOFIA DIS
    kofia_records = scrape_kofia_fees(headless=headless)

    # Map KOFIA records to tickers
    updated_count = 0
    now_iso = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    effective_date_str = datetime.datetime.now().strftime("%Y%m")

    # Build lookup map by standard code and normalized fund name
    kofia_by_std = {}
    kofia_by_name = {}
    for rec in kofia_records:
        std = rec.get("standard_code")
        if std:
            kofia_by_std[std] = rec
        name = rec.get("fund_name", "")
        if name:
            clean_name = re.sub(r'[\s\(\)\[\]증권상장지수투자신탁]', '', name)
            kofia_by_name[clean_name] = rec

    for ticker, current in registry_dict.items():
        master_info = master_mapping.get(ticker, {})
        std_cd = master_info.get("standard_code") or current.get("fund_standard_code")
        name = master_info.get("name") or current.get("name", "")
        clean_name = re.sub(r'[\s\(\)\[\]증권상장지수투자신탁]', '', name)

        matched_kofia = kofia_by_std.get(std_cd) if std_cd else None
        if not matched_kofia:
            matched_kofia = kofia_by_name.get(clean_name)

        if matched_kofia:
            # Update values if valid
            if matched_kofia.get("total_fee") is not None:
                current["total_fee_pct"] = matched_kofia["total_fee"]
            if matched_kofia.get("other_cost") is not None:
                current["other_cost_pct"] = matched_kofia["other_cost"]
            if matched_kofia.get("ter") is not None:
                current["ter_pct"] = matched_kofia["ter"]
            if matched_kofia.get("trading_cost") is not None:
                current["trading_cost_pct"] = matched_kofia["trading_cost"]

            current["effective_date"] = matched_kofia.get("base_date") or effective_date_str
            current["verified_at"] = now_iso
            current["verification_status"] = "verified_official"
            current["primary_source_type"] = "kofia_disclosure_api"
            current["primary_source_url"] = "https://dis.kofia.or.kr"
            current["source_note"] = "금융투자협회(KOFIA DIS) 펀드별 보수비용 비교 월간 전수 공시"
            updated_count += 1

    print(f"\n=== Statistical Circuit Breaker & Quality Check ===")
    print(f"Universe size: {len(registry_dict)}")
    print(f"Successfully matched and updated: {updated_count} ETFs")
    match_rate = updated_count / max(len(registry_dict), 1)
    print(f"Match rate: {match_rate * 100:.1f}%")

    # 3-tier completeness audit
    complete_count = sum(
        1 for d in registry_dict.values()
        if d.get("total_fee_pct") is not None
        and (d.get("other_cost_pct") is not None or d.get("ter_pct") is not None)
        and d.get("trading_cost_pct") is not None
    )
    print(f"New complete 3-tier coverage: {complete_count}/{len(registry_dict)} ({complete_count/len(registry_dict)*100:.1f}%)")

    # Circuit breaker: if match_rate < 0.60, something broke on KOFIA website (format change)
    if match_rate < 0.60 and not dry_run:
        print("[CRITICAL_ERROR] Match rate below 60%. Aborting registry update to preserve integrity.")
        sys.exit(2)

    if dry_run:
        print("[DRY_RUN] Dry run enabled. Changes not written to file.")
        return

    # Atomic write
    temp_path = f"{target_output}.tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(list(registry_dict.values()), f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(temp_path, target_output)

    print(f"[SUCCESS] Successfully wrote updated registry to {target_output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KOFIA DIS ETF Fee Collector")
    parser.add_argument("--registry", default="data/fees/etf_fee_registry.json", help="Path to etf_fee_registry.json")
    parser.add_argument("--master", default="data/etf_master_draft.csv", help="Path to etf_master_draft.csv")
    parser.add_argument("--output", default=None, help="Output file path (defaults to registry)")
    parser.add_argument("--no-headless", action="store_true", help="Run browser in headful mode (GUI)")
    parser.add_argument("--dry-run", action="store_true", help="Perform scraping without saving file")

    args = parser.parse_args()
    run_pipeline(
        registry_path=args.registry,
        master_csv_path=args.master,
        output_path=args.output,
        headless=not args.no_headless,
        dry_run=args.dry_run,
    )
