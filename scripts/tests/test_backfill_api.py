import json
from unittest import TestCase
from unittest.mock import MagicMock, patch

from scripts import backfill_api


class GenerateUpsertBatchesTest(TestCase):
    def test_builds_parameterized_upsert_for_valid_prices(self) -> None:
        batches = backfill_api.generate_upsert_batches(
            {
                "069500": {"TDD_CLSPRC": "12,345"},
                "360750": {"close": 6789},
                "INVALID": {"clpr": "not-a-price"},
                "MISSING": {},
            },
            "2026-08-11",
        )

        self.assertEqual(len(batches), 1)
        sql, params = batches[0]
        self.assertIn("VALUES (?, ?, ?),(?, ?, ?)", sql)
        self.assertIn("ON CONFLICT(ticker, date) DO UPDATE SET close=excluded.close", sql)
        self.assertEqual(
            params,
            ["069500", "2026-08-11", 12345.0, "360750", "2026-08-11", 6789.0],
        )
        self.assertNotIn("069500", sql)
        self.assertNotIn("12,345", sql)

    def test_rejects_negative_and_non_finite_prices(self) -> None:
        batches = backfill_api.generate_upsert_batches(
            {
                "NEGATIVE": {"close": "-1"},
                "NAN": {"close": "nan"},
                "INFINITY": {"close": "inf"},
            },
            "2026-08-11",
        )

        self.assertEqual(batches, [])


class D1QueryTest(TestCase):
    @patch("scripts.backfill_api.urllib.request.urlopen")
    def test_sends_bearer_token_and_parameterized_payload(self, mock_urlopen: MagicMock) -> None:
        response = MagicMock()
        response.read.return_value = json.dumps(
            {"success": True, "result": [{"success": True, "results": []}]}
        ).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = response

        result = backfill_api.d1_query(
            "SELECT ?",
            ["value"],
            account_id="account-id",
            database_id="database-id",
            api_token="token-value",
        )

        self.assertEqual(result, [{"success": True, "results": []}])
        request = mock_urlopen.call_args.args[0]
        self.assertEqual(
            request.full_url,
            "https://api.cloudflare.com/client/v4/accounts/account-id/d1/database/database-id/query",
        )
        self.assertEqual(request.get_header("Authorization"), "Bearer token-value")
        self.assertEqual(
            json.loads(request.data.decode("utf-8")),
            {"sql": "SELECT ?", "params": ["value"]},
        )

    @patch("scripts.backfill_api.urllib.request.urlopen")
    def test_rejects_unsuccessful_cloudflare_response(self, mock_urlopen: MagicMock) -> None:
        response = MagicMock()
        response.read.return_value = json.dumps({"success": False, "errors": [{"code": 1}]}).encode(
            "utf-8"
        )
        mock_urlopen.return_value.__enter__.return_value = response

        with self.assertRaisesRegex(RuntimeError, "was rejected"):
            backfill_api.d1_query(
                "SELECT 1",
                None,
                account_id="account-id",
                database_id="database-id",
                api_token="token-value",
            )


class D1ConfigurationTest(TestCase):
    def test_required_environment_does_not_echo_missing_secret(self) -> None:
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "CLOUDFLARE_D1_TOKEN is required") as error:
                backfill_api.required_environment("CLOUDFLARE_D1_TOKEN")

        self.assertNotIn("token-value", str(error.exception))
