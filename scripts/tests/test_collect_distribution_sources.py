from __future__ import annotations

import csv
import socket
import tempfile
import urllib.error
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from scripts import collect_distribution_sources as collector


class FakeHeaders:
    def get_content_type(self) -> str:
        return "text/html"


class FakeResponse:
    def __init__(self, status: int, body: bytes, url: str = "https://issuer.example/notice") -> None:
        self.status = status
        self._body = body
        self._url = url
        self.headers = FakeHeaders()

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self) -> bytes:
        return self._body

    def geturl(self) -> str:
        return self._url


def error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError("https://issuer.example/notice", code, "failure", FakeHeaders(), None)


def sequence_opener(*outcomes: object):
    remaining = list(outcomes)

    def opener(*args: object, **kwargs: object) -> FakeResponse:
        outcome = remaining.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome  # type: ignore[return-value]

    return opener


class FetchUrlRetryTest(TestCase):
    def test_timeout_retries_with_exponential_backoff(self) -> None:
        delays: list[float] = []
        result = collector.fetch_url(
            "https://issuer.example/notice",
            max_attempts=3,
            opener=sequence_opener(socket.timeout("timed out"), socket.timeout("timed out"), FakeResponse(200, b"official")),
            sleeper=delays.append,
        )
        self.assertEqual(result.status, 200)
        self.assertEqual(result.attempts, 3)
        self.assertEqual(delays, [1.0, 2.0])

    def test_http_429_retries(self) -> None:
        delays: list[float] = []
        result = collector.fetch_url(
            "https://issuer.example/notice",
            max_attempts=2,
            opener=sequence_opener(error(429), FakeResponse(200, b"official")),
            sleeper=delays.append,
        )
        self.assertEqual(result.status, 200)
        self.assertEqual(result.attempts, 2)
        self.assertEqual(delays, [1.0])

    def test_http_5xx_retries(self) -> None:
        delays: list[float] = []
        result = collector.fetch_url(
            "https://issuer.example/notice",
            max_attempts=2,
            opener=sequence_opener(error(503), FakeResponse(200, b"official")),
            sleeper=delays.append,
        )
        self.assertEqual(result.status, 200)
        self.assertEqual(result.attempts, 2)
        self.assertEqual(delays, [1.0])

    def test_auth_failures_do_not_retry(self) -> None:
        for status in (401, 403):
            with self.subTest(status=status):
                delays: list[float] = []
                result = collector.fetch_url(
                    "https://issuer.example/notice",
                    max_attempts=3,
                    opener=sequence_opener(error(status)),
                    sleeper=delays.append,
                )
                self.assertEqual(result.status, status)
                self.assertEqual(result.category, "http_auth_or_access_denied")
                self.assertEqual(result.attempts, 1)
                self.assertEqual(delays, [])

    def test_empty_official_response_is_not_success(self) -> None:
        result = collector.fetch_url(
            "https://issuer.example/notice",
            opener=sequence_opener(FakeResponse(200, b"")),
            sleeper=lambda _: None,
        )
        self.assertEqual(result.category, "empty_response")
        self.assertFalse(result.retryable)
        self.assertEqual(result.attempts, 1)

    def test_empty_url_is_reported_as_unconfigured(self) -> None:
        result = collector.fetch_url("", sleeper=lambda _: None)
        self.assertEqual(result.category, "unconfigured_source_url")
        self.assertEqual(result.attempts, 0)


class CollectionPreservationTest(TestCase):
    def test_failed_refresh_preserves_prior_verified_raw_document(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data_dir = root / "data" / "distributions"
            raw_file = data_dir / "raw" / "Issuer" / "2026" / "08" / "prior.html"
            raw_file.parent.mkdir(parents=True)
            raw_file.write_bytes(b"prior official document")
            source_hash = collector.sha256(raw_file.read_bytes())

            targets = data_dir / "collection_targets.csv"
            sources = data_dir / "etf_distribution_source_documents.csv"
            data_dir.mkdir(parents=True, exist_ok=True)
            with targets.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=collector.TARGET_COLUMNS)
                writer.writeheader()
                writer.writerow({
                    "source_id": "issuer:test:001", "source_owner": "Issuer", "source_type": "issuer_notice",
                    "source_url": "https://issuer.example/notice", "published_at": "2026-08-16",
                })
            with sources.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=collector.SOURCE_COLUMNS)
                writer.writeheader()
                writer.writerow({
                    "source_id": "issuer:test:001", "source_url": "https://issuer.example/notice",
                    "parse_status": "manual_review", "raw_path": "data/distributions/raw/Issuer/2026/08/prior.html",
                    "content_hash_sha256": source_hash,
                })

            with patch.object(collector, "ROOT", root), patch.object(collector, "DATA_DIR", data_dir), \
                 patch.object(collector, "RAW_DIR", data_dir / "raw"), patch.object(collector, "REPORT_DIR", data_dir / "reports"), \
                 patch.object(collector, "TARGETS_PATH", targets), patch.object(collector, "SOURCES_PATH", sources), \
                 patch.object(collector, "EVENTS_PATH", data_dir / "events.csv"), patch.object(collector, "COVERAGE_PATH", data_dir / "coverage.csv"), \
                 patch.object(collector, "MANUAL_EVENTS_PATH", data_dir / "manual.csv"), patch.object(collector, "MASTER_PATH", root / "master.csv"), \
                 patch.object(collector, "LEGACY_LEDGER_PATH", root / "legacy.csv"), patch.object(collector, "COLLECTION_REPORT_PATH", data_dir / "reports" / "collection.json"), \
                 patch.object(collector, "fetch_url", return_value=collector.FetchResult(b"", 503, "text/html", "https://issuer.example/notice", "HTTP 503", "http_transient", True, 3, (1.0, 2.0))):
                report = collector.collect_sources(force=True, sleep_seconds=0)

            self.assertEqual(report["failed"], 1)
            self.assertEqual(report["preserved_existing_verified_raw"], 1)
            row = collector.read_csv(sources)[0]
            self.assertEqual(row["raw_path"], "data/distributions/raw/Issuer/2026/08/prior.html")
            self.assertEqual(row["content_hash_sha256"], source_hash)


class PartialCollectionTest(TestCase):
    def test_partial_batch_keeps_successful_source_and_records_failed_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data_dir = root / "data" / "distributions"
            data_dir.mkdir(parents=True)
            targets = data_dir / "collection_targets.csv"
            sources = data_dir / "etf_distribution_source_documents.csv"
            with targets.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=collector.TARGET_COLUMNS)
                writer.writeheader()
                writer.writerows([
                    {"source_id": "issuer:test:success", "source_owner": "Issuer", "source_type": "issuer_notice", "source_url": "https://issuer.example/success", "published_at": "2026-08-16"},
                    {"source_id": "issuer:test:failure", "source_owner": "Issuer", "source_type": "issuer_notice", "source_url": "https://issuer.example/failure", "published_at": "2026-08-16"},
                ])
            with sources.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=collector.SOURCE_COLUMNS)
                writer.writeheader()

            responses = [
                collector.FetchResult(b"official success", 200, "text/html", "https://issuer.example/success"),
                collector.FetchResult(b"", 503, "text/html", "https://issuer.example/failure", "HTTP 503", "http_transient", True, 3, (1.0, 2.0)),
            ]
            with patch.object(collector, "ROOT", root), patch.object(collector, "DATA_DIR", data_dir), \
                 patch.object(collector, "RAW_DIR", data_dir / "raw"), patch.object(collector, "REPORT_DIR", data_dir / "reports"), \
                 patch.object(collector, "TARGETS_PATH", targets), patch.object(collector, "SOURCES_PATH", sources), \
                 patch.object(collector, "EVENTS_PATH", data_dir / "events.csv"), patch.object(collector, "COVERAGE_PATH", data_dir / "coverage.csv"), \
                 patch.object(collector, "MANUAL_EVENTS_PATH", data_dir / "manual.csv"), patch.object(collector, "MASTER_PATH", root / "master.csv"), \
                 patch.object(collector, "LEGACY_LEDGER_PATH", root / "legacy.csv"), patch.object(collector, "COLLECTION_REPORT_PATH", data_dir / "reports" / "collection.json"), \
                 patch.object(collector, "fetch_url", side_effect=responses):
                report = collector.collect_sources(sleep_seconds=0)

            self.assertEqual(report["collected"], 1)
            self.assertEqual(report["failed"], 1)
            self.assertEqual(report["issues"][0]["source_id"], "issuer:test:failure")
            rows = {row["source_id"]: row for row in collector.read_csv(sources)}
            self.assertTrue(rows["issuer:test:success"]["raw_path"])
            self.assertEqual(rows["issuer:test:failure"]["parse_status"], "failed")

    def test_command_run_skips_normalization_when_collection_has_a_real_failure(self) -> None:
        args = type("Args", (), {"force": False, "limit": None, "sleep": 0.0, "timeout": 1, "max_attempts": 1})()
        collection = {"failed": 1, "status": "failed"}
        with patch.object(collector, "bootstrap"), patch.object(collector, "collect_sources", return_value=collection), \
             patch.object(collector, "normalise_events") as normalize, patch.object(collector, "validate") as validate:
            exit_code = collector.command_run(args)
        self.assertEqual(exit_code, 3)
        normalize.assert_not_called()
        validate.assert_not_called()


class NonRetryableFailureTest(TestCase):
    def test_http_404_does_not_retry(self) -> None:
        delays: list[float] = []
        result = collector.fetch_url(
            "https://issuer.example/missing",
            max_attempts=3,
            opener=sequence_opener(error(404)),
            sleeper=delays.append,
        )
        self.assertEqual(result.category, "http_not_found")
        self.assertEqual(result.attempts, 1)
        self.assertEqual(delays, [])

    def test_unconfigured_target_is_incomplete_not_passed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data_dir = root / "data" / "distributions"
            data_dir.mkdir(parents=True)
            targets = data_dir / "collection_targets.csv"
            sources = data_dir / "etf_distribution_source_documents.csv"
            with targets.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=collector.TARGET_COLUMNS)
                writer.writeheader()
                writer.writerow({"source_id": "issuer:test:pending", "source_owner": "Issuer", "source_type": "issuer_notice", "source_url": ""})
            with sources.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=collector.SOURCE_COLUMNS)
                writer.writeheader()

            with patch.object(collector, "ROOT", root), patch.object(collector, "DATA_DIR", data_dir), \
                 patch.object(collector, "RAW_DIR", data_dir / "raw"), patch.object(collector, "REPORT_DIR", data_dir / "reports"), \
                 patch.object(collector, "TARGETS_PATH", targets), patch.object(collector, "SOURCES_PATH", sources), \
                 patch.object(collector, "EVENTS_PATH", data_dir / "events.csv"), patch.object(collector, "COVERAGE_PATH", data_dir / "coverage.csv"), \
                 patch.object(collector, "MANUAL_EVENTS_PATH", data_dir / "manual.csv"), patch.object(collector, "MASTER_PATH", root / "master.csv"), \
                 patch.object(collector, "LEGACY_LEDGER_PATH", root / "legacy.csv"), patch.object(collector, "COLLECTION_REPORT_PATH", data_dir / "reports" / "collection.json"):
                report = collector.collect_sources(sleep_seconds=0)

            self.assertEqual(report["status"], "incomplete_unconfigured_sources")
            self.assertEqual(report["unconfigured"], 1)
            self.assertEqual(report["failed"], 0)
