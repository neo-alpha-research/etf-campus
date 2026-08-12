import base64
import hashlib
import hmac
import io
import json
import urllib.error
from unittest import TestCase
from unittest.mock import MagicMock, patch

from scripts import backfill_api


class NormalizePriceRecordsTest(TestCase):
    def test_normalizes_only_valid_six_digit_ticker_prices(self) -> None:
        records = backfill_api.normalize_price_records(
            {
                "069500": {"TDD_CLSPRC": "12,345"},
                "360750": {"close": 6789},
                "INVALID": {"clpr": "1000"},
                "123456": {"clpr": "not-a-price"},
                "654321": {"close": "-1"},
            },
            "2026-08-11",
        )

        self.assertEqual(
            records,
            [
                {"ticker": "069500", "date": "2026-08-11", "close": 12345.0},
                {"ticker": "360750", "date": "2026-08-11", "close": 6789.0},
            ],
        )

    def test_chunks_records_with_a_fixed_maximum(self) -> None:
        records = [{"ticker": f"{index:06d}", "date": "2026-08-11", "close": 1000.0} for index in range(501)]
        chunks = backfill_api.chunk_records(records)

        self.assertEqual([len(chunk) for chunk in chunks], [500, 1])


class SignedPayloadTest(TestCase):
    def test_builds_compact_json_and_expected_hmac_signature(self) -> None:
        records = [{"ticker": "069500", "date": "2026-08-11", "close": 12345.0}]
        body, signature = backfill_api.build_signed_payload(
            records,
            request_id="batch_20260811_0001",
            timestamp=1_786_000_000,
            secret="signing-secret",
        )

        self.assertEqual(
            json.loads(body),
            {"requestId": "batch_20260811_0001", "records": records},
        )
        expected = base64.b64encode(
            hmac.new(
                b"signing-secret",
                b"POST\n1786000000\n" + body,
                hashlib.sha256,
            ).digest()
        ).decode("ascii")
        self.assertEqual(signature, expected)


class SignedIngestionRequestTest(TestCase):
    @patch("scripts.backfill_api.urllib.request.urlopen")
    def test_sends_only_price_schema_and_hmac_headers(self, mock_urlopen: MagicMock) -> None:
        response = MagicMock()
        response.read.return_value = json.dumps({"accepted": 1, "requestId": "batch_20260811_0002"}).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = response
        records = [{"ticker": "069500", "date": "2026-08-11", "close": 12345.0}]

        accepted = backfill_api.send_price_batch(
            records,
            endpoint="https://etf-campus.pages.dev/api/internal/ingest-prices",
            secret="secret-value",
            request_id="batch_20260811_0002",
            now=1_786_000_000,
        )

        self.assertEqual(accepted, 1)
        request = mock_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://etf-campus.pages.dev/api/internal/ingest-prices")
        self.assertEqual(request.get_header("X-etf-ingest-timestamp"), "1786000000")
        self.assertTrue(request.get_header("X-etf-ingest-signature"))
        self.assertEqual(
            json.loads(request.data.decode("utf-8")),
            {"requestId": "batch_20260811_0002", "records": records},
        )
        self.assertNotIn("sql", request.data.decode("utf-8").lower())

    @patch("scripts.backfill_api.urllib.request.urlopen")
    def test_hides_hmac_secret_when_endpoint_rejects_request(self, mock_urlopen: MagicMock) -> None:
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "https://etf-campus.pages.dev/api/internal/ingest-prices",
            401,
            "Unauthorized",
            {},
            io.BytesIO(b'{"error":"invalid_signature"}'),
        )

        with self.assertRaisesRegex(RuntimeError, "HTTP 401") as caught:
            backfill_api.send_price_batch(
                [{"ticker": "069500", "date": "2026-08-11", "close": 12345.0}],
                endpoint="https://etf-campus.pages.dev/api/internal/ingest-prices",
                secret="secret-value",
                request_id="batch_20260811_0003",
                now=1_786_000_000,
            )

        self.assertNotIn("secret-value", str(caught.exception))


class ConfigurationTest(TestCase):
    def test_required_environment_strips_secret_whitespace(self) -> None:
        with patch.dict("os.environ", {"PRICE_INGEST_HMAC_SECRET": "  secret-value\n"}, clear=True):
            self.assertEqual(
                backfill_api.required_environment("PRICE_INGEST_HMAC_SECRET"), "secret-value"
            )

    def test_rejects_an_endpoint_outside_etf_campus(self) -> None:
        with patch.dict("os.environ", {"PRICE_INGEST_ENDPOINT": "https://example.com/ingest"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "must target the ETF Campus internal price endpoint"):
                backfill_api.get_ingest_endpoint()
