#!/usr/bin/env python3
"""
Kingdom Brief — daily compact technical digest for Barry.
Delivered at 06:00 CAT alongside the king's morning digest.
Gracefully no-ops when BARRY_CHAT_ID is unset.
"""
import json
import os
import subprocess
import sys
import requests
from datetime import datetime, timezone
from pathlib import Path

KINGDOM_API = os.getenv("KINGDOM_API", "http://localhost:5001")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
BARRY_CHAT_ID = os.getenv("BARRY_CHAT_ID", "")

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
    if not TELEGRAM_BOT_TOKEN or not BARRY_CHAT_ID:
        print("BARRY_CHAT_ID not set — Brief edition skipped.")
        return
    requests.post(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
        json={"chat_id": BARRY_CHAT_ID, "text": message, "parse_mode": "HTML"},
        timeout=10,
    )


def fetch(path: str) -> dict:
    return requests.get(f"{KINGDOM_API}{path}", timeout=5).json()


def run_agent(module: str, cmd: str, timeout: int = 10) -> str:
    try:
        result = subprocess.run(
            ["python3", "-m", module, cmd],
            capture_output=True, text=True, timeout=timeout,
            cwd=os.path.expanduser("~/Kingdom"),
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return ""


def extract_resource_lines(qm_output: str) -> list[str]:
    """Pull lines with a percentage that mention a resource metric."""
    keywords = ("cpu", "ram", "disk", "memory", "gpu")
    lines = []
    for line in qm_output.split("\n"):
        stripped = line.strip()
        if "%" in stripped and any(k in stripped.lower() for k in keywords):
            # Drop markdown headers and bullet prefixes for cleanliness
            cleaned = stripped.lstrip("#•- ").strip()
            lines.append(cleaned)
    return lines[:3]


def main():
    if not BARRY_CHAT_ID:
        print("BARRY_CHAT_ID not set — Brief edition skipped.")
        return

    today = datetime.now().strftime("%-d %b %Y")

    try:
        error_summary = fetch("/api/errors/summary")
        errors_resp = fetch("/api/errors?status=open&limit=200")
    except Exception as e:
        send_telegram(f"⚠ Kingdom Brief fetch failed: {e}")
        sys.exit(1)

    open_count = error_summary.get("open", 0)
    new_24h = error_summary.get("new_24h", 0)

    by_village: dict[str, int] = {}
    for err in errors_resp.get("errors", []):
        v = err.get("village", "unknown")
        by_village[v] = by_village.get(v, 0) + 1
    top_villages = sorted(by_village.items(), key=lambda x: -x[1])[:4]

    qm_output = run_agent("council.the-quartermaster", "brief")
    resource_lines = extract_resource_lines(qm_output) if qm_output else []

    lines = [f"⚙ <b>Kingdom Brief — {today}</b>", ""]

    # Errors
    if open_count == 0:
        lines.append("🟢 No open errors")
    else:
        lines.append(
            f"🔴 <b>{open_count} open error{'s' if open_count != 1 else ''}</b>"
            + (f"  (+{new_24h} new)" if new_24h else "")
        )
        for village, count in top_villages:
            lines.append(f"  · {village}: {count}")

    # Resources
    if resource_lines:
        lines.append("")
        lines.append("📦 Resources")
        for rl in resource_lines:
            lines.append(f"  · {rl}")

    lines += ["", "— Kingdom Capital"]

    message = "\n".join(lines)
    send_telegram(message)
    save_edition("brief", message)
    print("Brief sent.")


if __name__ == "__main__":
    main()
