#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KOFIA DIS ETF Fee & Fund Type Collector (Production Worker).

--------------------------------------------------------------
Author: ETF Campus Data Engineering Team
Purpose:
  1. Scrapes monthly ETF total expense ratio (명목총보수, 기타비용, TER, 매매중개수수료율)
     directly from KOFIA DIS (금융투자협회 전자공시시스템) using Playwright Headless Browser.
  2. Extends collection to capture official Fund Basic Information (협회 펀드유형, 기준일자)
     for statutory retirement pension (DC/IRP) regulatory classification.
  3. Preserves raw XML snapshots in data/regulatory/sources/ and exports data/regulatory/kofia_fund_types.csv.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("[ERROR] Playwright is not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

KOFIA_DIS_URL = (
    "https://dis.kofia.or.kr/websquare/index.jsp?"
    "w2xPath=/wq/fundann/DISFundFeeCMS.xml&divisionId=MDIS01005001000000&serviceId=SDIS01005001000"
)


def load_master_etfs(master_csv_path: str) -> Dict[str, Dict[str, str]]:
    """Loads etf_master_draft.csv to map tickers with fund standard codes and names."""
    mapping = {}
    if not os.path.exists(master_csv_path):
        print(f"[WARN] Master CSV not found at {master_csv_path}. Proceeding with empty mapping.")
        return mapping

    with open(master_csv_path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = (row.get("ticker") or row.get("srtnCd") or "").strip()
            if ticker:
                mapping[ticker] = {
                    "ticker": ticker,
                    "isin": (row.get("isin_cd") or row.get("isin") or "").strip(),
                    "name": (row.get("name") or row.get("etfNm") or "").strip(),
                    "standard_code": (row.get("standard_code") or row.get("stdCd") or "").strip(),
                    "issuer": (row.get("issuer") or row.get("issuerName") or "").strip(),
                    "aum": (row.get("aum") or "0").strip(),
                    "asset_class": (row.get("asset_class") or "").strip(),
                    "pension_limit": (row.get("pension_limit") or "").strip(),
                }
    return mapping


def clean_kofia_name(s: str) -> str:
    """Normalize fund name for matching across disclosure registries."""
    if not s:
        return ""
    s = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    s = re.sub(
        r"^(미래에셋|삼성|KB|한화|신한|한국투자|키움|NH-Amundi|우리|하나|타임폴리오|에셋플러스|마이다스|IBK|유진|대신|DB|BNK|현대|트러스톤|교보악사|KCGI)\s*",
        "",
        s,
    )
    s = re.sub(r"(증권|특수자산|혼합자산|부동산|특별자산)?(상장지수)?(투자신탁|투자회사|투자기구)", "", s)
    s = re.sub(r"[\s\(\)\[\]_\-·]", "", s)
    return s.lower()


def parse_kofia_select_meta(packet_text: str) -> List[Dict[str, Any]]:
    """Parse <selectMeta> nodes from KOFIA ProFrame XML response."""
    extracted = []
    select_metas = re.findall(r"<selectMeta>(.*?)</selectMeta>", packet_text, re.DOTALL)
    for sm in select_metas:
        def get_val(tag: str) -> Optional[str]:
            m = re.search(rf"<{tag}>([^<]*)</{tag}>", sm)
            return m.group(1).strip() if m else None

        issuer = get_val("tmpV1")
        fund_name = get_val("tmpV2")
        fund_type = get_val("tmpV3")
        base_date = get_val("tmpV4")
        tot_fee = get_val("tmpV9")
        other_cost = get_val("tmpV10")
        ter = get_val("tmpV12")
        std_code = get_val("tmpV15")
        trade_cost = get_val("tmpV16")

        def to_float(val: Optional[str]) -> Optional[float]:
            if not val:
                return None
            try:
                # Handle leading dots like '.4' -> 0.4
                return float(val)
            except ValueError:
                return None

        if std_code or fund_name:
            extracted.append({
                "issuer": issuer or "",
                "standard_code": std_code or "",
                "fund_name": fund_name or "",
                "fund_type": fund_type or "",
                "base_date": base_date or "",
                "total_fee": to_float(tot_fee),
                "other_cost": to_float(other_cost),
                "ter": to_float(ter),
                "trading_cost": to_float(trade_cost),
            })
    return extracted


def scrape_kofia_fees(
    headless: bool = True,
    save_snapshot: bool = True,
    sources_dir: Optional[Path] = None,
) -> tuple[List[Dict[str, Any]], str]:
    """Launches Playwright headless Chromium to query KOFIA DIS and intercept full fund grid.

    Returns:
        tuple of (records_list, raw_xml_text)
    """
    print(f"[{datetime.datetime.now().isoformat()}] Launching Headless Chromium via Playwright...")
    results: List[Dict[str, Any]] = []
    raw_xml = ""

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
                "--disable-gpu",
            ],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="ko-KR",
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()

        print(f"Navigating to KOFIA DIS: {KOFIA_DIS_URL}")
        page.goto(KOFIA_DIS_URL, wait_until="networkidle", timeout=60000)
        time.sleep(5)

        # Hook CallProFrame to serialize XMLDocument e.responseBody
        page.evaluate("""() => {
            window.savedResponseBody = null;
            const origCallService = CallProFrame.callService;
            CallProFrame.callService = function(app, svc, fn, dto, opt, cb) {
                const origSuccess = cb ? cb.success : null;
                if (cb) {
                    cb.success = function(e) {
                        try {
                            if (e.responseBody && typeof e.responseBody === 'object') {
                                window.savedResponseBody = new XMLSerializer().serializeToString(e.responseBody);
                            } else {
                                window.savedResponseBody = String(e.responseBody);
                            }
                        } catch(err) {
                            window.savedResponseBody = "ERROR: " + err.message;
                        }
                        if (origSuccess) origSuccess(e);
                    };
                }
                origCallService.call(this, app, svc, fn, dto, opt, cb);
            };

            var DISCondFuncDTO = {'DISCondFuncDTO' : {}};
            CallProFrame.insertValue(DISCondFuncDTO, "tmpV30", nextDate.getValue());
            CallProFrame.insertValue(DISCondFuncDTO, "tmpV11", "");
            CallProFrame.insertValue(DISCondFuncDTO, "tmpV12", "");
            CallProFrame.insertValue(DISCondFuncDTO, "tmpV3", "");
            CallProFrame.insertValue(DISCondFuncDTO, "tmpV5", "");
            CallProFrame.insertValue(DISCondFuncDTO, "tmpV4", "");

            MetaGridMaker.getDataBind(DISCondFuncDTO, 'grdMain', function() {
                console.log("KOFIA DataBind completed successfully.");
            });
        }""")

        # Poll for response completion (max 45 seconds)
        print("Waiting for KOFIA DIS XML payload...")
        for _ in range(45):
            time.sleep(1)
            is_ready = page.evaluate("() => window.savedResponseBody !== null")
            if is_ready:
                break

        raw_xml = page.evaluate("() => window.savedResponseBody") or ""
        browser.close()

    if raw_xml and not raw_xml.startswith("ERROR"):
        print(f"Captured KOFIA XML payload: {len(raw_xml):,} bytes")
        results = parse_kofia_select_meta(raw_xml)
        print(f"Parsed {len(results):,} fund records from <selectMeta> nodes.")

        # Save snapshot
        if save_snapshot:
            s_dir = sources_dir or (REPO_ROOT / "data" / "regulatory" / "sources")
            s_dir.mkdir(parents=True, exist_ok=True)
            today_str = datetime.datetime.now().strftime("%Y%m%d")
            snapshot_path = s_dir / f"kofia_dis_response_{today_str}.xml"
            with open(snapshot_path, "w", encoding="utf-8") as f:
                f.write(raw_xml)
            print(f"[SNAPSHOT] Saved raw KOFIA response snapshot to: {snapshot_path}")
    else:
        print("[WARN] Failed to capture ProFrame responseBody via hook. Checking fallback...")

    return results, raw_xml


def match_and_export_fund_types(
    kofia_records: List[Dict[str, Any]],
    master_csv_path: str,
    fee_registry_path: str,
    output_fund_types_csv: Path,
) -> int:
    """Matches KOFIA fund records against ETF master universe and writes kofia_fund_types.csv."""
    master_info = load_master_etfs(master_csv_path)

    # Load fee registry for standard_code and legal_fund_name lookups
    std_to_ticker: Dict[str, str] = {}
    name_to_ticker: Dict[str, str] = {}

    if os.path.exists(fee_registry_path):
        try:
            with open(fee_registry_path, "r", encoding="utf-8") as f:
                fee_list = json.load(f)
            for item in fee_list:
                tk = (item.get("ticker") or "").strip()
                std = (item.get("fund_standard_code") or "").strip()
                nm = (item.get("name") or "").strip()
                leg_nm = (item.get("legal_fund_name") or "").strip()
                if std and tk:
                    std_to_ticker[std] = tk
                if nm and tk:
                    name_to_ticker[clean_kofia_name(nm)] = tk
                if leg_nm and tk:
                    name_to_ticker[clean_kofia_name(leg_nm)] = tk
        except Exception as e:
            print(f"[WARN] Error reading fee registry for fund type matching: {e}")

    # Build KOFIA lookup indices
    kofia_by_std: Dict[str, Dict[str, Any]] = {}
    kofia_by_cleaned_name: Dict[str, Dict[str, Any]] = {}

    for rec in kofia_records:
        std = rec.get("standard_code")
        if std:
            kofia_by_std[std] = rec
        fn = rec.get("fund_name", "")
        if fn:
            c_fn = clean_kofia_name(fn)
            if c_fn:
                kofia_by_cleaned_name[c_fn] = rec

    # Match each ETF in master universe
    matched_rows: List[Dict[str, str]] = []
    matched_tickers: set[str] = set()

    for ticker, m_etf in master_info.items():
        nm = m_etf["name"]
        k_rec = None

        # 1. By standard code from registry or master
        for std, tk in std_to_ticker.items():
            if tk == ticker and std in kofia_by_std:
                k_rec = kofia_by_std[std]
                break

        # 2. By cleaned exact name
        if not k_rec:
            cnm = clean_kofia_name(nm)
            if cnm in kofia_by_cleaned_name:
                k_rec = kofia_by_cleaned_name[cnm]

        # 3. By base core name (ignoring synthetic/hedged suffixes)
        if not k_rec:
            cnm = clean_kofia_name(nm)
            cnm_base = re.sub(r"(합성h?|h)$", "", cnm)
            for kn, kr in kofia_by_cleaned_name.items():
                kn_base = re.sub(r"(합성h?|h)$", "", kn)
                if cnm_base and (cnm_base == kn_base or (len(cnm_base) >= 6 and cnm_base in kn_base)):
                    k_rec = kr
                    break

        # 4. Strict AMC-checked TR/TotalReturn matching
        if not k_rec and ("TR" in nm or "TotalReturn" in nm):
            brand_map = {
                "TIGER": ["미래에셋"],
                "KODEX": ["삼성"],
                "ACE": ["한국투자"],
                "RISE": ["KB"],
                "KBSTAR": ["KB"],
                "SOL": ["신한"],
                "PLUS": ["한화"],
                "ARIRANG": ["한화"],
                "KIWOOM": ["키움"],
                "KOSEF": ["키움"],
                "HANARO": ["NH-AMUNDI", "NH"],
                "마이티": ["DB"],
            }
            first_tok = nm.split()[0].upper()
            allowed = brand_map.get(first_tok, [])
            if allowed:
                def norm_tr(s: str) -> str:
                    s_up = s.upper()
                    s_up = re.sub(r"TOTAL\s*RETURN", "TR", s_up)
                    s_up = re.sub(r"TOTALRETURN", "TR", s_up)
                    for p in [f"미래에셋{first_tok}", f"삼성{first_tok}", f"한국투자{first_tok}", f"KB{first_tok}", f"신한{first_tok}", f"한화{first_tok}", f"키움{first_tok}", f"NH-AMUNDI{first_tok}", f"DB{first_tok}", first_tok]:
                        if s_up.startswith(p.upper()):
                            s_up = s_up[len(p):]
                            break
                    s_up = re.sub(r"증권(상장지수투자신탁|투자신탁|자투자신탁)[\(\[\w\-\)\]]*", "", s_up)
                    s_up = re.sub(r"상장지수투자신탁[\(\[\w\-\)\]]*", "", s_up)
                    s_up = re.sub(r"\[주식[\w\-]*\]|\(주식[\w\-]*\)|\[채권[\w\-]*\]|\(채권[\w\-]*\)", "", s_up)
                    return re.sub(r"[\s\(\)\[\]\-_]", "", s_up)

                c_m = norm_tr(nm)
                for rec in kofia_records:
                    iss_up = rec.get("issuer", "").upper()
                    if not any(a in iss_up for a in allowed):
                        continue
                    c_x = norm_tr(rec.get("fund_name", ""))
                    if c_m and c_m == c_x:
                        k_rec = rec
                        break

        if k_rec:
            matched_tickers.add(ticker)
            matched_rows.append({
                "ticker": ticker,
                "standard_code": k_rec.get("standard_code", ""),
                "fund_name": k_rec.get("fund_name", ""),
                "fund_type": k_rec.get("fund_type", ""),
                "base_date": k_rec.get("base_date", ""),
                "issuer": k_rec.get("issuer", ""),
            })

    output_fund_types_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_fund_types_csv.open("w", encoding="utf-8-sig", newline="") as f:
        fieldnames = ["ticker", "standard_code", "fund_name", "fund_type", "base_date", "issuer"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(matched_rows)

    print(f"[FUND_TYPES] Matched {len(matched_rows):,} / {len(master_info):,} ETFs to KOFIA fund types.")
    print(f"[FUND_TYPES] Exported fund types table to: {output_fund_types_csv}")
    return len(matched_rows)


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
    print(f"Loaded existing fee registry with {len(registry_dict)} tickers.")

    # Scrape KOFIA DIS
    kofia_records, raw_xml = scrape_kofia_fees(headless=headless)

    # Export KOFIA Fund Types (Stage 1 extension)
    fund_types_csv = REPO_ROOT / "data" / "regulatory" / "kofia_fund_types.csv"
    try:
        match_and_export_fund_types(
            kofia_records=kofia_records,
            master_csv_path=master_csv_path,
            fee_registry_path=registry_path,
            output_fund_types_csv=fund_types_csv,
        )
    except Exception as e:
        print(f"[WARN] Error during fund type matching/export (fee pipeline continues): {e}")

    # Map KOFIA records to tickers for fee registry
    updated_count = 0
    now_iso = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    effective_date_str = datetime.datetime.now().strftime("%Y%m")

    kofia_by_std = {}
    kofia_by_name = {}
    for rec in kofia_records:
        std = rec.get("standard_code")
        if std:
            kofia_by_std[std] = rec
        name = rec.get("fund_name", "")
        if name:
            clean_name = re.sub(r"[\s\(\)\[\]증권상장지수투자신탁]", "", name)
            kofia_by_name[clean_name] = rec

    for ticker, current in registry_dict.items():
        master_info = master_mapping.get(ticker, {})
        std_cd = master_info.get("standard_code") or current.get("fund_standard_code")
        name = master_info.get("name") or current.get("name", "")
        clean_name = re.sub(r"[\s\(\)\[\]증권상장지수투자신탁]", "", name)

        matched_kofia = kofia_by_std.get(std_cd) if std_cd else None
        if not matched_kofia:
            matched_kofia = kofia_by_name.get(clean_name)

        if matched_kofia:
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

    complete_count = sum(
        1 for d in registry_dict.values()
        if d.get("total_fee_pct") is not None
        and (d.get("other_cost_pct") is not None or d.get("ter_pct") is not None)
        and d.get("trading_cost_pct") is not None
    )
    print(f"New complete 3-tier coverage: {complete_count}/{len(registry_dict)} ({complete_count/len(registry_dict)*100:.1f}%)")

    # Circuit breaker: if match_rate < 0.60, something broke on KOFIA website
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

    print(f"[SUCCESS] Successfully wrote updated fee registry to {target_output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KOFIA DIS ETF Fee & Fund Type Collector")
    parser.add_argument("--registry", default=str(REPO_ROOT / "data/fees/etf_fee_registry.json"), help="Path to etf_fee_registry.json")
    parser.add_argument("--master", default=str(REPO_ROOT / "data/etf_master_draft.csv"), help="Path to etf_master_draft.csv")
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
