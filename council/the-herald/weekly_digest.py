#!/usr/bin/env python3
"""
Kingdom Weekly Digest — published by The Herald on Fridays at 17:00 CAT.

Reads activity-update files from docs/updates/YYYY-MM-DD-*.md filed during
the past 7 days, augments with GitHub stats (issues opened/closed/verified,
PRs merged), and sends one Telegram message.

If no activity files exist for the week, the digest still sends — explicitly
saying "quiet week". Silence is never an option (per the trust contract).

Usage:
  python3 council/the-herald/weekly_digest.py            # send to Telegram
  python3 council/the-herald/weekly_digest.py --dry      # print only, don't send
  python3 council/the-herald/weekly_digest.py --since=14 # last 14 days instead of 7
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

KINGDOM_ROOT = Path(__file__).resolve().parents[2]
UPDATES_DIR = KINGDOM_ROOT / "docs" / "updates"
ENV_FILE = Path.home() / "telegram_notify_service" / ".env"
GH_REPO = "RSA-Omen/kingdom"


def load_creds() -> tuple[str, str]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not (token and chat_id) and ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            v = v.strip().strip('"').strip("'")
            if k.strip() == "TELEGRAM_BOT_TOKEN":
                token = token or v
            elif k.strip() == "TELEGRAM_CHAT_ID":
                chat_id = chat_id or v
    if not (token and chat_id):
        raise RuntimeError("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set")
    return token, chat_id


def find_updates(since_days: int) -> list[Path]:
    """Find activity updates from the last `since_days` days.

    Only files whose first non-blank line starts with '🏰' are included —
    that is, files written in the established Kingdom activity-update
    format (X/Y/Z). Long-form stakeholder docs are skipped.
    """
    if not UPDATES_DIR.exists():
        return []
    cutoff = dt.date.today() - dt.timedelta(days=since_days)
    out: list[Path] = []
    pattern = re.compile(r"^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$")
    for p in sorted(UPDATES_DIR.glob("*.md")):
        m = pattern.match(p.name)
        if not m:
            continue
        try:
            date = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            continue
        # Skip the weekly digest itself if it ever lands here
        if "weekly" in m.group(4).lower():
            continue
        if date < cutoff:
            continue
        # Only include files in the activity-update format (🏰 marker)
        try:
            first_line = next(
                (ln for ln in p.read_text().splitlines() if ln.strip()),
                ""
            )
        except OSError:
            continue
        if not first_line.startswith("🏰"):
            continue
        out.append(p)
    return out


def gh(*args: str) -> str:
    """Run `gh` and return stdout. Returns '' on failure (don't break the digest)."""
    try:
        result = subprocess.run(
            ["gh", *args, "--repo", GH_REPO],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            return ""
        return result.stdout
    except Exception:
        return ""


def gh_count(query_args: list[str]) -> Optional[int]:
    """Run a gh issue/pr list and return the count, or None on failure."""
    out = gh(*query_args, "--json", "number", "--jq", "length")
    if not out.strip():
        return None
    try:
        return int(out.strip())
    except ValueError:
        return None


def collect_stats(since_days: int) -> dict:
    """Best-effort GitHub stats for the period."""
    cutoff_iso = (dt.date.today() - dt.timedelta(days=since_days)).isoformat()
    return {
        "issues_opened": gh_count(["issue", "list", "--state", "all",
                                    "--search", f"created:>={cutoff_iso}", "--limit", "200"]),
        "issues_closed": gh_count(["issue", "list", "--state", "closed",
                                    "--search", f"closed:>={cutoff_iso}", "--limit", "200"]),
        "issues_verified": gh_count(["issue", "list", "--state", "all",
                                      "--label", "verified",
                                      "--search", f"closed:>={cutoff_iso}", "--limit", "200"]),
        "prs_merged": gh_count(["pr", "list", "--state", "merged",
                                 "--search", f"merged:>={cutoff_iso}", "--limit", "200"]),
        "scout_reviews_filed": gh_count(["issue", "list", "--state", "all",
                                          "--label", "scout-reviewed",
                                          "--search", f"updated:>={cutoff_iso}", "--limit", "200"]),
    }


def collect_open_state() -> dict:
    """Snapshot of what's open right now, by workflow state."""
    return {
        state: gh_count(["issue", "list", "--state", "open", "--label", state, "--limit", "200"]) or 0
        for state in ("scout-reviewed", "dispatched", "ready-to-fix",
                      "fix-attempted", "fix-merged")
    }


def stat_line(stats: dict) -> str:
    """Compose the 'by the numbers' section."""

    def fmt(v: Optional[int]) -> str:
        return "?" if v is None else str(v)

    parts = [
        f"📈 *By the numbers*",
        f"• {fmt(stats['issues_opened'])} issues filed",
        f"• {fmt(stats['scout_reviews_filed'])} Scout investigations",
        f"• {fmt(stats['prs_merged'])} PRs merged",
        f"• {fmt(stats['issues_verified'])} fixes verified",
        f"• {fmt(stats['issues_closed'])} issues closed",
    ]
    return "\n".join(parts)


def open_state_line(open_state: dict) -> str:
    parts = [
        f"🚧 *Still in flight*",
        f"• {open_state['scout-reviewed']} awaiting your approval",
        f"• {open_state['dispatched']} dispatched, awaiting ready-to-fix",
        f"• {open_state['ready-to-fix']} authorised, queued for the Smith",
        f"• {open_state['fix-attempted']} PRs awaiting your review",
        f"• {open_state['fix-merged']} merged, awaiting verification",
    ]
    return "\n".join(parts)


def extract_update_body(path: Path) -> str:
    """Strip the original header line and return the rest, lightly trimmed."""
    text = path.read_text().strip()
    # Drop the first line if it's a date+header (we'll have our own week header)
    lines = text.splitlines()
    if lines and lines[0].startswith("🏰"):
        lines = lines[1:]
    # Drop trailing signature line if present
    while lines and (lines[-1].strip() == "" or lines[-1].strip().startswith("— *")):
        lines.pop()
    return "\n".join(lines).strip()


def compose(updates: list[Path], stats: dict, open_state: dict, week_ending: dt.date) -> str:
    header = f"🏰 *Kingdom Weekly — week ending {week_ending.strftime('%-d %b %Y')}*"

    body_blocks: list[str] = [header, "", stat_line(stats), ""]

    if updates:
        body_blocks.append("📰 *Activity ledger*")
        body_blocks.append("")
        for p in updates:
            m = re.match(r"^(\d{4}-\d{2}-\d{2})-", p.name)
            date_str = m.group(1) if m else p.stem
            body_blocks.append(f"━━ _{date_str}_")
            body_blocks.append(extract_update_body(p))
            body_blocks.append("")
    else:
        body_blocks.append("📰 *Activity ledger*")
        body_blocks.append("")
        body_blocks.append("_A quiet week. No activity updates filed under `docs/updates/`."
                           " If work happened that should be visible here, the format is:_"
                           " `docs/updates/YYYY-MM-DD-<slug>.md` _with X/Y/Z items._")
        body_blocks.append("")

    body_blocks.append(open_state_line(open_state))
    body_blocks.append("")
    body_blocks.append(f"— _Published by The Herald, {dt.datetime.now().astimezone().strftime('%a %-d %b %Y %H:%M %Z')}_")
    return "\n".join(body_blocks)


def send(text: str) -> dict:
    token, chat_id = load_creds()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
    }).encode()
    with urllib.request.urlopen(url, data=data, timeout=15) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    parser = argparse.ArgumentParser(description="Kingdom Weekly Digest")
    parser.add_argument("--dry", action="store_true",
                        help="Print the digest, don't send to Telegram.")
    parser.add_argument("--since", type=int, default=7,
                        help="Days of activity to include (default 7).")
    args = parser.parse_args()

    updates = find_updates(args.since)
    stats = collect_stats(args.since)
    open_state = collect_open_state()
    week_ending = dt.date.today()

    msg = compose(updates, stats, open_state, week_ending)

    if args.dry:
        print(msg)
        print(f"\n[dry-run] {len(msg)} chars; {len(updates)} update files this week")
        return 0

    # Telegram messages cap at 4096 chars; chunk if needed
    MAX = 4000
    chunks = [msg[i:i + MAX] for i in range(0, len(msg), MAX)]
    for chunk in chunks:
        try:
            result = send(chunk)
        except Exception as e:
            print(f"Telegram delivery failed: {e}", file=sys.stderr)
            return 2
        if not result.get("ok"):
            print(f"Telegram API: {result}", file=sys.stderr)
            return 3

    print(f"Sent {len(chunks)} chunk(s); total {len(msg)} chars; {len(updates)} update files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
