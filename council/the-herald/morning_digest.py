#!/usr/bin/env python3
"""
Kingdom Morning Digest — delivered at 06:00 CAT by The Herald.
Queries the Kingdom API for errors and todos, sends a Telegram summary.
"""
import json
import os
import sys
import requests
from datetime import datetime, timezone
from pathlib import Path

KINGDOM_API = os.getenv("KINGDOM_API", "http://localhost:5001")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

EDITIONS_PATH = Path.home() / "Kingdom" / "capital" / "herald" / "editions.json"


def save_edition(edition: str, content: str) -> None:
    try:
        existing = json.loads(EDITIONS_PATH.read_text()) if EDITIONS_PATH.exists() else {}
    except Exception:
        existing = {}
    existing[edition] = {
        "published_at": datetime.now(timezone.utc).isoformat(),
        "content": content,
        "date_label": datetime.now().strftime("%A, %-d %B %Y"),
    }
    EDITIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    EDITIONS_PATH.write_text(json.dumps(existing, indent=2))


def send_telegram(message: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — printing instead:")
        print(message)
        return
    requests.post(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
        json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"},
        timeout=10,
    )


def fetch(path: str) -> dict:
    return requests.get(f"{KINGDOM_API}{path}", timeout=5).json()


def main():
    today = datetime.now().strftime("%-d %b %Y")

    try:
        error_summary = fetch("/api/errors/summary")
        todo_summary = fetch("/api/todos/summary")
        villages = fetch("/api/errors?status=open&limit=100")
    except Exception as e:
        send_telegram(f"⚠ Kingdom digest failed to fetch data: {e}")
        sys.exit(1)

    by_village: dict[str, int] = {}
    for err in villages.get("errors", []):
        by_village[err["village"]] = by_village.get(err["village"], 0) + 1

    village_lines = []
    for village, count in sorted(by_village.items(), key=lambda x: -x[1]):
        village_lines.append(f"  • {village.capitalize()} — {count} open error{'s' if count > 1 else ''}")

    lines = [
        f"⚔ <b>Kingdom Morning Brief — {today}</b>",
        "",
        f"🔴 <b>Errors</b> ({error_summary.get('open', 0)} open, {error_summary.get('new_24h', 0)} new since yesterday)",
    ]
    lines += village_lines if village_lines else ["  • No open errors — the realm is quiet."]
    lines += [
        "",
        f"✅ <b>To-Dos</b> ({todo_summary.get('open', 0)} open)",
        f"  • {todo_summary.get('linked', 0)} linked to errors",
        f"  • {todo_summary.get('open', 0) - todo_summary.get('linked', 0)} manual",
    ]

    message = "\n".join(lines)
    send_telegram(message)
    save_edition("daily", message)
    print("Digest sent.")


if __name__ == "__main__":
    main()
