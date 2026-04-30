#!/usr/bin/env python3
"""
The Herald — Composes Telegraph, the kingdom's daily paper.
Gathers reports from the Royal Court and publishes the morning edition.
"""

import os
import sys
import subprocess
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import requests

def _load_telegram_creds() -> tuple:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    env_file = Path.home() / "telegram_notify_service" / ".env"
    if not (token and chat_id) and env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                if k.strip() == "TELEGRAM_BOT_TOKEN":
                    token = token or v.strip()
                if k.strip() == "TELEGRAM_CHAT_ID":
                    chat_id = chat_id or v.strip()
    return token, chat_id

TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID = _load_telegram_creds()


class Herald:
    def __init__(self):
        self.council_home = Path.home() / "Kingdom" / "council"

    def gather_briefing(self) -> Dict[str, str]:
        """Gather briefings from all active council members."""
        briefings = {}

        # The Hand's agenda
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-hand-of-the-king", "telegram"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.stdout:
                briefings["hand"] = result.stdout
        except Exception as e:
            print(f"Error getting Hand briefing: {e}")

        # The Maester's index
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-maester", "brief"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.stdout:
                briefings["maester"] = result.stdout
        except Exception as e:
            print(f"Error getting Maester briefing: {e}")

        # The Steward's health report
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-steward", "brief"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.stdout:
                briefings["steward"] = result.stdout
        except Exception as e:
            print(f"Error getting Steward briefing: {e}")

        # The Master of Works' infrastructure report
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-master-of-works", "check"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.stdout:
                briefings["master_of_works"] = result.stdout.strip()
        except Exception as e:
            print(f"Error getting Master of Works briefing: {e}")

        # The Quartermaster's resource report
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-quartermaster"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.stdout:
                # Strip the JSON block — only keep the markdown section
                text = result.stdout
                json_start = text.find("\n```json")
                if json_start != -1:
                    text = text[:json_start]
                lines = [l for l in text.split("\n") if l and not l.startswith("```")]
                if lines:
                    briefings["quartermaster"] = "\n".join(lines)
        except Exception as e:
            print(f"Error getting Quartermaster briefing: {e}")

        # The Captain's incident report
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-captain-of-the-guard", "scan"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.stdout:
                briefings["captain"] = result.stdout
        except Exception as e:
            print(f"Error getting Captain briefing: {e}")

        return briefings

    def compose_telegraph(self, briefings: Dict[str, str], edition: str = "daily") -> str:
        """Compose the daily Telegraph from council briefings."""
        today = datetime.now().strftime("%A, %B %d, %Y")

        lines = [
            "═" * 60,
            "📰 TELEGRAPH — THE KINGDOM'S DAILY PAPER",
            today,
            "═" * 60,
            ""
        ]

        # Front Page: Urgent items
        lines.append("🔴 FRONT PAGE — What Demands Immediate Attention")
        lines.append("")

        if "captain" in briefings:
            lines.append(briefings["captain"])
            lines.append("")

        # Today's Agenda
        if "hand" in briefings:
            lines.append("📋 TODAY'S AGENDA — The Hand's Priorities")
            lines.append("")
            lines.append(briefings["hand"])
            lines.append("")

        # The Long Read: System Health
        lines.append("🏰 THE LONG READ — Castle Status")
        lines.append("")

        if "steward" in briefings:
            lines.append(briefings["steward"])
            lines.append("")

        if "master_of_works" in briefings:
            lines.append(briefings["master_of_works"])
            lines.append("")

        # Resources & Provisions
        if "quartermaster" in briefings:
            lines.append("📦 PROVISIONS — Resource Status")
            lines.append("")
            lines.append(briefings["quartermaster"])
            lines.append("")

        # The Maester's Knowledge
        if "maester" in briefings:
            lines.append("📚 LIBRARY & ARCHIVES — What The Maester Knows")
            lines.append("")
            lines.append(briefings["maester"])
            lines.append("")

        # Footer
        lines.append("═" * 60)
        lines.append("Published by The Herald at " + datetime.now().strftime("%H:%M:%S UTC"))
        lines.append("═" * 60)

        return "\n".join(lines)

    def send_telegram(self, message: str):
        """Send Telegraph via Telegram."""
        if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
            print("Telegram not configured, skipping send")
            return

        # Split into chunks if too long (Telegram limit ~4096 chars)
        max_len = 4000
        chunks = [message[i:i+max_len] for i in range(0, len(message), max_len)]

        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

        for chunk in chunks:
            data = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": chunk,
                "parse_mode": "HTML"
            }
            try:
                requests.post(url, json=data, timeout=10)
            except Exception as e:
                print(f"Failed to send Telegram message: {e}")


def main():
    herald = Herald()

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "compose":
            briefings = herald.gather_briefing()
            paper = herald.compose_telegraph(briefings)
            print(paper)

        elif command == "publish":
            briefings = herald.gather_briefing()
            paper = herald.compose_telegraph(briefings)
            herald.send_telegram(paper)
            print("✅ Telegraph published")

        elif command == "brief":
            briefings = herald.gather_briefing()
            # Short version for agent-to-agent communication
            summary = "📰 Telegraph Brief:\n"
            if "captain" in briefings:
                summary += "🔴 Incidents: " + briefings["captain"].split("\n")[0] + "\n"
            if "steward" in briefings:
                summary += "🏰 Health status available\n"
            if "hand" in briefings:
                summary += "📋 Today's agenda available\n"
            print(summary)

    else:
        briefings = herald.gather_briefing()
        paper = herald.compose_telegraph(briefings)
        print(paper)


if __name__ == "__main__":
    main()
