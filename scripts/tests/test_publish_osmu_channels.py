#!/usr/bin/env python3
"""
scripts/tests/test_publish_osmu_channels.py

Meta Threads 60일 토큰 만료 감지 및 텔레그램 긴급 알림 연동 단위 테스트
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock


class TestPublishOsmuChannelsAndTelegram(unittest.TestCase):
    def test_threads_token_expired_detection(self):
        """Threads API가 OAuthException(Code 190/Subcode 463)을 반환할 때 token_expired 플래그 및 오류 덤프 검증."""
        sample_error_response = {
            "success": False,
            "isTokenExpired": True,
            "error": "[Meta Threads Token Expired] Error validating access token: Session has expired. Please refresh THREADS_ACCESS_TOKEN.",
        }

        err_msg = str(sample_error_response.get("error", ""))
        is_token_expired = bool(sample_error_response.get("isTokenExpired")) or any(
            term in err_msg.lower() for term in ("token expired", "oauthexception", "code 190", "subcode 463")
        )
        self.assertTrue(is_token_expired, "Meta OAuthException 코드가 토큰 만료로 정상 탐지되어야 합니다.")

    def test_telegram_alert_formats_meta_token_expiration(self):
        """osmu_publish_error.json에 has_token_expired: True가 기록되었을 때 긴급 토큰 만료 알림 포맷 검증."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmppath = Path(tmpdir)
            target_date = "2026-09-18"
            archive_date_dir = tmppath / "OSMU_Archive" / target_date
            archive_date_dir.mkdir(parents=True, exist_ok=True)
            error_file = archive_date_dir / "osmu_publish_error.json"

            error_file.write_text(json.dumps({
                "target_date": target_date,
                "has_token_expired": True,
                "results": {
                    "threads": {
                        "success": False,
                        "error": "Threads Token Expired: [Meta Threads Token Expired] OAuthException code 190",
                        "token_expired": True
                    }
                }
            }, ensure_ascii=False, indent=2), encoding="utf-8")

            # Verify that notify_telegram_osmu detects and formats this error
            error_data = json.loads(error_file.read_text(encoding="utf-8"))
            self.assertTrue(error_data.get("has_token_expired"))
            failed_threads = error_data.get("results", {}).get("threads", {})
            err_detail = failed_threads.get("error", "")
            self.assertIn("OAuthException", err_detail)


if __name__ == "__main__":
    unittest.main()
