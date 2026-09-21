import io
import json
import unittest
import urllib.error
from unittest.mock import MagicMock, call, patch

from scripts.publish_market_source_snapshot import signed_post


class TestSignedPostRetry(unittest.TestCase):
    def test_default_retry_delays_exceed_90_seconds(self) -> None:
        """지시 1: 지수 백오프 총 대기 시간이 90초 이상인지 검증 (5+10+20+30+40=105s)."""
        from inspect import signature
        sig = signature(signed_post)
        default_delays = sig.parameters["retry_delays"].default
        self.assertGreaterEqual(sum(default_delays), 90.0, "지수 백오프 지연 합계는 최소 90초 이상이어야 합니다.")
        self.assertEqual(default_delays, (5.0, 10.0, 20.0, 30.0, 40.0))

    @patch("time.sleep", return_value=None)
    @patch("urllib.request.urlopen")
    def test_retry_on_500_then_success(self, mock_urlopen: MagicMock, mock_sleep: MagicMock) -> None:
        error_500 = urllib.error.HTTPError(
            url="http://test",
            code=500,
            msg="Internal Server Error",
            hdrs={},
            fp=io.BytesIO(b'{"error":"ingestion_failed"}'),
        )
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"success":true,"count":12}'
        mock_response.__enter__.return_value = mock_response

        mock_urlopen.side_effect = [error_500, mock_response]

        res = signed_post("http://test", "secret_key", {"data": 123})
        self.assertEqual(res, {"success": True, "count": 12})
        self.assertEqual(mock_urlopen.call_count, 2)
        mock_sleep.assert_called_once_with(5.0)

    @patch("time.sleep", return_value=None)
    @patch("urllib.request.urlopen")
    def test_retry_exhaustion_raises_runtime_error(self, mock_urlopen: MagicMock, mock_sleep: MagicMock) -> None:
        error_500 = urllib.error.HTTPError(
            url="http://test",
            code=500,
            msg="Internal Server Error",
            hdrs={},
            fp=io.BytesIO(b'{"error":"ingestion_failed"}'),
        )
        # 6 attempts total (1 initial + 5 retries)
        mock_urlopen.side_effect = [error_500] * 6

        with self.assertRaises(RuntimeError) as ctx:
            signed_post("http://test", "secret_key", {"data": 123})

        self.assertIn("Market source ingest returned HTTP 500", str(ctx.exception))
        self.assertEqual(mock_urlopen.call_count, 6)
        self.assertEqual(mock_sleep.call_count, 5)
        mock_sleep.assert_has_calls([call(5.0), call(10.0), call(20.0), call(30.0), call(40.0)])

    @patch("time.sleep", return_value=None)
    @patch("urllib.request.urlopen")
    def test_no_retry_on_403(self, mock_urlopen: MagicMock, mock_sleep: MagicMock) -> None:
        error_403 = urllib.error.HTTPError(
            url="http://test",
            code=403,
            msg="Forbidden",
            hdrs={},
            fp=io.BytesIO(b'{"error":"invalid_signature"}'),
        )
        mock_urlopen.side_effect = error_403

        with self.assertRaises(RuntimeError) as ctx:
            signed_post("http://test", "secret_key", {"data": 123})

        self.assertIn("Market source ingest returned HTTP 403", str(ctx.exception))
        self.assertEqual(mock_urlopen.call_count, 1)
        mock_sleep.assert_not_called()


if __name__ == "__main__":
    unittest.main()
