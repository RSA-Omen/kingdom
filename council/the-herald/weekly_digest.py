#!/usr/bin/env python3
"""
Kingdom Weekly — Monday morning newsletter for the whole team (subjects).
Friendly tone, no raw stack traces, no system detail.
Delivered Monday 06:00 CAT (04:00 UTC).
Gracefully no-ops when SUBJECTS_CHAT_ID is unset.
"""
import json
import os
import subprocess
import sys
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path

KINGDOM_API = os.getenv("KINGDOM_API", "http://localhost:5001")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
SUBJECTS_CHAT_ID = os.getenv("SUBJECTS_CHAT_ID", "")

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
    if not TELEGRAM_BOT_TOKEN or not SUBJECTS_CHAT_ID:
        print("SUBJECTS_CHAT_ID not set — Weekly edition skipped.")
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    for chunk in [message[i:i+4000] for i in range(0, len(message), 4000)]:
        requests.post(url, json={"chat_id": SUBJECTS_CHAT_ID, "text": chunk, "parse_mode": "HTML"}, timeout=10)


def fetch(path: str) -> dict:
    return requests.get(f"{KINGDOM_API}{path}", timeout=5).json()


def week_start_ts() -> tuple[int, int]:
    """Return (start_of_this_week, start_of_last_week) as Unix timestamps."""
    now = datetime.now()
    sow = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return int(sow.timestamp()), int((sow - timedelta(days=7)).timestamp())


def git_commits_this_week() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "--since=7 days ago"],
            capture_output=True, text=True, timeout=5,
            cwd=os.path.expanduser("~/Kingdom"),
        )
        lines = [l.strip() for l in result.stdout.strip().split("\n") if l.strip()]
        # Strip hash, keep message
        return [" ".join(l.split()[1:]) for l in lines]
    except Exception:
        return []


def run_steward_brief() -> str:
    try:
        result = subprocess.run(
            ["python3", "-m", "council.the-steward", "brief"],
            capture_output=True, text=True, timeout=10,
            cwd=os.path.expanduser("~/Kingdom"),
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return ""


def humanise_commit(msg: str) -> str:
    """Turn a git commit message into something readable for non-developers."""
    msg = msg.lower()
    if msg.startswith("feat:"):
        return "✨ " + msg[5:].strip().capitalize()
    if msg.startswith("fix:"):
        return "🔧 " + msg[4:].strip().capitalize()
    if msg.startswith("docs:"):
        return "📝 " + msg[5:].strip().capitalize()
    if msg.startswith("refactor:"):
        return "♻️  " + msg[9:].strip().capitalize()
    return "· " + msg.capitalize()


# Updated by /kingdom-checkpoint at the end of each work session.
# One plain-English entry per completed feature. Replace with current week's work.
RECENT_ADDITIONS = [
    "Capital API error deduplication — the same error reported multiple times by a village now updates a single row instead of creating new rows. The `occurrence_count` and `last_seen_at` columns track how often and how recently an error has fired. The Guild Board's incident feed now reads these counts directly, so the '×4' badge on an incident card reflects the true repeat count rather than how many rows happened to survive the fingerprint grouping.",
]


def main():
    if not SUBJECTS_CHAT_ID:
        print("SUBJECTS_CHAT_ID not set — Weekly edition skipped.")
        return

    now = datetime.now()
    week_start_date = (now - timedelta(days=now.weekday())).strftime("%-d %b")
    week_end_date = (now - timedelta(days=now.weekday()) + timedelta(days=6)).strftime("%-d %b %Y")

    try:
        all_errors = fetch("/api/errors?limit=500")
        todo_summary = fetch("/api/todos/summary")
    except Exception as e:
        send_telegram(f"⚠ Weekly digest fetch failed: {e}")
        sys.exit(1)

    this_week_ts, last_week_ts = week_start_ts()
    errors_list = all_errors.get("errors", [])

    this_week = [e for e in errors_list if e.get("created_at", 0) >= this_week_ts]
    last_week = [e for e in errors_list if last_week_ts <= e.get("created_at", 0) < this_week_ts]
    resolved_this_week = [e for e in this_week if e.get("status") == "resolved"]
    still_open = [e for e in this_week if e.get("status") == "open"]

    # Village health from Steward
    steward = run_steward_brief()
    healthy = steward.count("✅") if steward else 0
    degraded = steward.count("⚠") if steward else 0
    down = steward.count("❌") if steward else 0

    # Git activity
    commits = git_commits_this_week()
    feats = [c for c in commits if c.lower().startswith("feat")]
    fixes = [c for c in commits if c.lower().startswith("fix")]

    open_todos = todo_summary.get("open", 0)

    # Trend vs last week
    delta = len(this_week) - len(last_week)
    if delta > 0:
        trend = f"▲ {delta} more than last week"
    elif delta < 0:
        trend = f"▼ {abs(delta)} fewer than last week"
    else:
        trend = "same as last week"

    lines = [
        f"📰 <b>Gekko Weekly — {week_start_date}–{week_end_date}</b>",
        "",
    ]

    # App health
    if steward:
        if down == 0 and degraded == 0:
            lines.append(f"🟢 <b>All {healthy} apps running smoothly</b>")
        elif down > 0:
            lines.append(f"🔴 <b>Apps:</b> {healthy} healthy, {degraded} degraded, {down} down — check the dashboard")
        else:
            lines.append(f"🟡 <b>Apps:</b> {healthy} healthy, {degraded} need attention")
    else:
        lines.append("🏰 App health unavailable — check the dashboard")

    # Errors this week
    lines.append("")
    if not this_week:
        lines.append("🎉 <b>Zero errors this week.</b> The realm was quiet.")
    else:
        lines.append(f"🔴 <b>Errors this week:</b> {len(this_week)} ({trend})")
        if resolved_this_week:
            lines.append(f"  ✅ {len(resolved_this_week)} resolved")
        if still_open:
            lines.append(f"  📋 {len(still_open)} still open")

    # What shipped — prefer plain-English RECENT_ADDITIONS, fall back to git commits
    lines.append("")
    if RECENT_ADDITIONS:
        lines.append(f"🔧 <b>What's new in the Kingdom</b>")
        for entry in RECENT_ADDITIONS[:6]:
            lines.append(f"  · {entry}")
        if len(RECENT_ADDITIONS) > 6:
            lines.append(f"  · ...and {len(RECENT_ADDITIONS) - 6} more")
    elif commits:
        lines.append(f"🔧 <b>What we shipped</b> ({len(commits)} change{'s' if len(commits) != 1 else ''})")
        highlights = feats[:3] + fixes[:3]
        if not highlights:
            highlights = commits[:4]
        for c in highlights[:6]:
            lines.append(f"  {humanise_commit(c)}")
        remaining = len(commits) - len(highlights[:6])
        if remaining > 0:
            lines.append(f"  · ...and {remaining} more")
    else:
        lines.append("🔧 <b>What we shipped</b> — nothing committed this week")

    # Open tasks
    lines.append("")
    if open_todos == 0:
        lines.append("✅ <b>Task board is clear.</b>")
    else:
        lines.append(f"✅ <b>{open_todos} open task{'s' if open_todos != 1 else ''}</b> on the board")

    lines += ["", "Have a good week.", "— The Kingdom team"]

    message = "\n".join(lines)
    send_telegram(message)
    save_edition("weekly", message)
    print("Weekly sent.")


if __name__ == "__main__":
    main()
