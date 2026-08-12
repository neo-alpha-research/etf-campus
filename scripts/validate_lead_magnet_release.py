"""Block lead-magnet publication when the three PDF pages are inconsistent.

This command is deliberately offline.  Collection and selection are separate
steps: it verifies that a fully prepared dated dataset and its rendered PDFs
form one auditable release before a human distributes the document.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE_IDS = ("page1", "page2", "page3")
PDF_NAMES = (
    "etf-campus-lead-magnet-page-1.pdf",
    "etf-campus-lead-magnet-page-2.pdf",
    "etf-campus-lead-magnet-page-3.pdf",
)
MERGED_PDF_NAME = "etf-campus-3-page-etf-lead-magnet.pdf"


def compact_date(value: str) -> str:
    normalized = value.strip().replace("-", "")
    if len(normalized) != 8 or not normalized.isdigit():
        raise ValueError("as-of date must use YYYYMMDD or YYYY-MM-DD")
    date.fromisoformat(f"{normalized[:4]}-{normalized[4:6]}-{normalized[6:]}")
    return normalized


def as_iso_date(compact: str) -> str:
    return f"{compact[:4]}-{compact[4:6]}-{compact[6:]}"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as stream:
        return json.load(stream)


def validate_dataset(dataset_dir: Path, as_of: str) -> tuple[list[str], list[dict[str, object]]]:
    """Return release-block codes and evidence for the dated calculation set."""
    expected_iso = as_iso_date(as_of)
    errors: list[str] = []
    evidence: list[dict[str, object]] = []
    required = {
        "page1": ("page1_performance_metrics.csv", "page1_performance_validation.json"),
        "page2": ("page2_metrics.csv", "page2_validation.json"),
        "page3": ("page3_performance_metrics.csv", "page3_performance_validation.json"),
    }
    for page_id, (metrics_name, validation_name) in required.items():
        metrics_path = dataset_dir / metrics_name
        validation_path = dataset_dir / validation_name
        if not metrics_path.is_file() or not validation_path.is_file():
            errors.append("UNSOURCED_DISPLAY_VALUE")
            evidence.append({"page": page_id, "status": "missing_required_artifact"})
            continue

        validation = load_json(validation_path)
        with metrics_path.open(encoding="utf-8-sig", newline="") as stream:
            rows = list(csv.DictReader(stream))
        as_of_value = str(validation.get("as_of") or "")
        reference_dates = sorted({str(row.get("reference_date") or "") for row in rows})
        page_ok = validation.get("status") == "pass" and as_of_value == expected_iso and reference_dates == [expected_iso]
        if not page_ok:
            errors.append("PDF_DATASET_MISMATCH")
        evidence.append(
            {
                "page": page_id,
                "status": "pass" if page_ok else "failed",
                "metrics_rows": len(rows),
                "validation_as_of": as_of_value,
                "reference_dates": reference_dates,
                "validation_status": validation.get("status"),
                "metrics_sha256": sha256(metrics_path),
                "validation_sha256": sha256(validation_path),
            }
        )
    if len({item.get("validation_as_of") for item in evidence if "validation_as_of" in item}) > 1:
        errors.append("AUM_AS_OF_MIXED")
    return sorted(set(errors)), evidence


def validate_pdfs(pdf_dir: Path) -> tuple[list[str], list[dict[str, object]]]:
    # Keep the data-only validation importable in the ordinary collector
    # environment, where xlrd is installed but the PDF runtime may be absent.
    # PDF release checks are intentionally performed in the bundled PDF runtime.
    from pypdf import PdfReader

    errors: list[str] = []
    evidence: list[dict[str, object]] = []
    for page_number, filename in enumerate(PDF_NAMES, start=1):
        path = pdf_dir / filename
        if not path.is_file():
            errors.append("PDF_DATASET_MISMATCH")
            evidence.append({"file": filename, "status": "missing"})
            continue
        reader = PdfReader(path)
        size_ok = len(reader.pages) == 1 and float(reader.pages[0].mediabox.width) > float(reader.pages[0].mediabox.height)
        marker_ok = f"{page_number} / 3" in reader.pages[0].extract_text()
        if not size_ok or not marker_ok:
            errors.append("PDF_DATASET_MISMATCH")
        evidence.append({"file": filename, "status": "pass" if size_ok and marker_ok else "failed", "sha256": sha256(path)})

    merged = pdf_dir / MERGED_PDF_NAME
    if not merged.is_file():
        errors.append("PDF_DATASET_MISMATCH")
        evidence.append({"file": MERGED_PDF_NAME, "status": "missing"})
    else:
        reader = PdfReader(merged)
        pages_ok = len(reader.pages) == 3
        markers_ok = pages_ok and all(f"{index} / 3" in page.extract_text() for index, page in enumerate(reader.pages, start=1))
        if not pages_ok or not markers_ok:
            errors.append("PDF_DATASET_MISMATCH")
        evidence.append({"file": MERGED_PDF_NAME, "status": "pass" if pages_ok and markers_ok else "failed", "sha256": sha256(merged)})
    return sorted(set(errors)), evidence


def release_manifest(root: Path, as_of: str) -> dict[str, object]:
    dataset_dir = root / "data" / "lead_magnet" / "generated" / as_of
    dataset_errors, dataset_evidence = validate_dataset(dataset_dir, as_of)
    pdf_errors, pdf_evidence = validate_pdfs(root / "output" / "pdf")
    block_codes = sorted(set(dataset_errors + pdf_errors))
    return {
        "schema_version": "1.0.0",
        "as_of_date": as_iso_date(as_of),
        "release_status": "blocked" if block_codes else "ready_for_human_approval",
        "block_codes": block_codes,
        "dataset_evidence": dataset_evidence,
        "pdf_evidence": pdf_evidence,
        "notice": "This manifest validates the prepared release only. It does not collect external data or approve publication.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the three-page ETF lead-magnet release.")
    parser.add_argument("--as-of", default="20260810", help="Reference date: YYYYMMDD or YYYY-MM-DD")
    parser.add_argument("--root", type=Path, default=ROOT, help="Repository root, mainly for controlled test runs")
    parser.add_argument("--write-manifest", action="store_true", help="Write release_manifest.json beside the dated metrics")
    args = parser.parse_args()

    as_of = compact_date(args.as_of)
    root = args.root.resolve()
    manifest = release_manifest(root, as_of)
    if args.write_manifest:
        output = root / "data" / "lead_magnet" / "generated" / as_of / "release_manifest.json"
        output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(output)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0 if manifest["release_status"] == "ready_for_human_approval" else 1


if __name__ == "__main__":
    raise SystemExit(main())
