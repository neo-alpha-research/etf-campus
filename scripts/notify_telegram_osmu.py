#!/usr/bin/env python3
"""
scripts/notify_telegram_osmu.py

OSMU(One Source Multi Use) 아카이브 생성 완료 시,
최신 마켓 브리핑 핵심 요약 텍스트와 그래픽 카드 이미지를
지정된 텔레그램(채널 또는 채팅방)으로 자동 발송하는 스크립트입니다.

- 자본시장법 제101조 및 Zero-Hallucination 지침 준수
- TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 시 Graceful Skip (종료 코드 0)
- 표준 라이브러리(urllib, json, pathlib 등)만 사용하여 추가 패키지 의존성 없음
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

REQUEST_TIMEOUT_SECONDS = 25
BRIEFING_WEB_URL = "https://etf-campus.pages.dev/briefing"
DISTRIBUTOR_DASHBOARD_URL = "https://market-briefing-distributor.neo-alpha-research.workers.dev/preview"


def find_latest_osmu_dir(base_dir: Path) -> Path | None:
    if not base_dir.exists():
        return None
    date_dirs = [
        d for d in base_dir.iterdir()
        if d.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", d.name)
    ]
    if not date_dirs:
        return None
    date_dirs.sort(key=lambda d: d.name, reverse=True)
    return date_dirs[0]


def send_telegram_photo(bot_token: str, chat_id: str, photo_path: Path, caption: str) -> bool:
    boundary = f"----TelegramBoundary{uuid.uuid4().hex}"
    filename = photo_path.name

    with open(photo_path, "rb") as f:
        file_bytes = f.read()

    body = bytearray()

    # chat_id
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="chat_id"\r\n\r\n{chat_id}\r\n'.encode("utf-8"))

    # caption (Telegram photo caption max 1024 characters)
    if caption:
        safe_caption = caption[:1024]
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="caption"\r\n\r\n{safe_caption}\r\n'.encode("utf-8"))

    # photo file
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="photo"; filename="{filename}"\r\n'.encode("utf-8"))
    body.extend(b"Content-Type: image/png\r\n\r\n")
    body.extend(file_bytes)
    body.extend(b"\r\n")

    # end boundary
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
    req = urllib.request.Request(
        url,
        data=bytes(body),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "ETF-Campus-OSMU/1.0",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return bool(res_data.get("ok"))
    except Exception as e:
        print(f"⚠️ Telegram sendPhoto failed: {type(e).__name__} - {e}", file=sys.stderr)
        return False


def send_telegram_message(bot_token: str, chat_id: str, text: str) -> bool:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": False,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "ETF-Campus-OSMU/1.0",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return bool(res_data.get("ok"))
    except Exception as e:
        print(f"⚠️ Telegram sendMessage failed: {type(e).__name__} - {e}", file=sys.stderr)
        return False


def main() -> int:
    bot_token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = (os.environ.get("TELEGRAM_CHAT_ID") or "").strip()

    if not bot_token or not chat_id:
        print("ℹ️ TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다. 텔레그램 알림을 건너뜁니다.")
        return 0

    base_archive = Path("OSMU_Archive")
    latest_dir = find_latest_osmu_dir(base_archive)

    if not latest_dir:
        print("ℹ️ 전송할 OSMU 아카이브 디렉토리를 찾을 수 없습니다. 건너뜁니다.")
        return 0

    as_of_date = latest_dir.name
    print(f"📢 최신 OSMU 아카이브 확인: 기준일 {as_of_date}")

    threads_script_file = latest_dir / "2_Threads" / "threads_script.txt"
    threads_image_file = latest_dir / "2_Threads" / "threads_image.png"

    summary_content = ""
    if threads_script_file.exists():
        summary_content = threads_script_file.read_text(encoding="utf-8").strip().lstrip("\ufeff")

    dashboard_token = os.environ.get("MANUAL_RUN_TOKEN") or "etf-campus-osmu-internal-2026"
    dashboard_link = f"{DISTRIBUTOR_DASHBOARD_URL}?date={as_of_date}&token={dashboard_token}"

    header = f"📊 [ETF CAMPUS] 마켓 브리핑 & OSMU 생성 완료 ({as_of_date})\n"
    notice = "오늘자 마켓 브리핑 및 OSMU 에셋(인스타그램 카드, 스레드 원고/이미지, 뉴스레터) 생성이 완료되었습니다.\n대시보드에서 내용을 확인하신 후 즉시 발송하실 수 있습니다.\n"
    
    links = (
        f"👉 검토 및 즉시 발송 대시보드:\n{dashboard_link}\n\n"
        f"🌐 ETF Campus 웹 브리핑:\n{BRIEFING_WEB_URL}"
    )

    if summary_content:
        full_message = f"{header}\n{notice}\n{summary_content}\n\n{links}"
    else:
        full_message = f"{header}\n{notice}\n{links}"

    photo_sent = False
    if threads_image_file.exists():
        print(f"🖼️ 그래픽 카드 이미지 발견: {threads_image_file} ({threads_image_file.stat().st_size:,} bytes)")
        
        # 캡션이 1024자 이하인 경우 이미지와 텍스트를 함께 전송
        if len(full_message) <= 1024:
            photo_sent = send_telegram_photo(bot_token, chat_id, threads_image_file, full_message)
        else:
            short_caption = f"📊 [ETF CAMPUS] {as_of_date} 마켓 브리핑 & OSMU 생성 완료\n\n👉 검토 및 즉시 발송 대시보드:\n{dashboard_link}\n\n🌐 웹 브리핑:\n{BRIEFING_WEB_URL}"
            photo_sent = send_telegram_photo(bot_token, chat_id, threads_image_file, short_caption)
            if photo_sent:
                send_telegram_message(bot_token, chat_id, full_message)

    if not photo_sent:
        print("📝 텍스트 전용 메시지 발송 시도...")
        text_sent = send_telegram_message(bot_token, chat_id, full_message)
        if text_sent:
            print("✅ 텔레그램 텍스트 알림 발송 완료.")
        else:
            print("⚠️ 텔레그램 메시지 발송 실패.")
    else:
        print("✅ 텔레그램 이미지 카드 및 브리핑 알림 발송 완료.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
