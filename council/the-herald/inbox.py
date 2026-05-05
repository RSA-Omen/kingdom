#!/usr/bin/env python3
"""
Kingdom Inbox — phone-friendly action interface via Telegram inline buttons.

Used by ~/scripts/telegram_weekly/bot.py via subprocess CLI. The bot is the
thin dispatcher; this module owns all the kingdom logic.

Two modes:
  --build               Output JSON cards (one per pending action) for the bot
                        to send. Each card has text + an inline_keyboard.
  --callback <data>     Process a callback_data string (button press); output
                        JSON describing the result and any message edit.

Callback data format: <verb>:<id>
  approve:N    → apply `approved` label to issue N           (Marshal pickup next hour)
  auth:N       → apply `ready-to-fix` label to issue N        (Smith pickup next hour)
  merge:N      → merge PR N                                   (Inspector pickup next hour)
  skip:N       → no-op acknowledgement                        (just dismisses card)
  scout:N      → reply with the Scout's full report
  marshal:N    → reply with the Marshal's full routing
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from typing import Any, Optional

GH_REPO = "RSA-Omen/kingdom"


def gh(*args: str, json_out: bool = False) -> tuple[int, str]:
    """Run gh CLI; return (exit_code, stdout)."""
    try:
        result = subprocess.run(
            ["gh", *args, "--repo", GH_REPO],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.returncode, result.stdout
    except subprocess.TimeoutExpired:
        return 1, "(gh timed out)"
    except Exception as e:
        return 1, f"(gh failed: {e})"


def fetch_issues(label: str, exclude_labels: list[str]) -> list[dict]:
    """Open issues with the given label, excluding any with exclude_labels."""
    search_terms = " ".join(f"-label:{lbl}" for lbl in exclude_labels)
    rc, out = gh(
        "issue", "list",
        "--state", "open",
        "--label", label,
        "--search", search_terms,
        "--json", "number,title,labels,url",
        "--limit", "20",
    )
    if rc != 0 or not out.strip():
        return []
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return []


def fetch_open_prs() -> list[dict]:
    """Open PRs awaiting review."""
    rc, out = gh(
        "pr", "list",
        "--state", "open",
        "--json", "number,title,headRefName,url,isDraft",
        "--limit", "20",
    )
    if rc != 0 or not out.strip():
        return []
    try:
        prs = json.loads(out)
        # Filter out drafts — those aren't ready for review yet
        return [pr for pr in prs if not pr.get("isDraft")]
    except json.JSONDecodeError:
        return []


def get_latest_comment(issue_number: int, marker: str) -> Optional[str]:
    """Return the most recent comment whose body contains the given marker."""
    rc, out = gh(
        "issue", "view", str(issue_number),
        "--comments", "--json", "comments",
    )
    if rc != 0 or not out.strip():
        return None
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return None
    for c in reversed(data.get("comments", [])):
        if marker in (c.get("body") or ""):
            return c.get("body")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Card builders


def truncate(s: str, n: int = 80) -> str:
    s = s.replace("\n", " ").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def build_scout_card(issue: dict) -> dict:
    n = issue["number"]
    title = truncate(issue["title"], 80)
    text = (
        f"🔍 *Scout report — \\#{n}*\n"
        f"{title}\n\n"
        f"_Approve to dispatch, or read the full report first._"
    )
    keyboard = {
        "inline_keyboard": [
            [
                {"text": "✅ Approve", "callback_data": f"approve:{n}"},
                {"text": "🔍 Read", "callback_data": f"scout:{n}"},
            ],
            [
                {"text": "⏭ Skip", "callback_data": f"skip:{n}"},
                {"text": "↗ GitHub", "url": issue["url"]},
            ],
        ]
    }
    return {"text": text, "keyboard": keyboard, "parse_mode": "Markdown"}


def build_marshal_card(issue: dict) -> dict:
    n = issue["number"]
    title = truncate(issue["title"], 80)
    labels = {lbl["name"] for lbl in issue.get("labels", [])}
    area = next((lbl for lbl in labels if lbl.startswith("area:")), "area:unknown")
    assigned = next((lbl for lbl in labels if lbl.startswith("assigned:")), "assigned:?")
    text = (
        f"📜 *Dispatch — \\#{n}*\n"
        f"{title}\n\n"
        f"`{area}` → `{assigned}`\n\n"
        f"_Authorise the fix, or read the full routing first._"
    )
    keyboard = {
        "inline_keyboard": [
            [
                {"text": "🔨 Authorise fix", "callback_data": f"auth:{n}"},
                {"text": "📜 Read", "callback_data": f"marshal:{n}"},
            ],
            [
                {"text": "⏭ Skip", "callback_data": f"skip:{n}"},
                {"text": "↗ GitHub", "url": issue["url"]},
            ],
        ]
    }
    return {"text": text, "keyboard": keyboard, "parse_mode": "Markdown"}


def build_pr_card(pr: dict) -> dict:
    n = pr["number"]
    title = truncate(pr["title"], 80)
    text = (
        f"🔨 *PR awaiting review — \\#{n}*\n"
        f"{title}\n\n"
        f"_Merge to ship; the Inspector will verify next hour._"
    )
    keyboard = {
        "inline_keyboard": [
            [
                {"text": "🔀 Merge", "callback_data": f"merge:{n}"},
                {"text": "👀 Review", "url": pr["url"]},
            ],
            [
                {"text": "⏭ Skip", "callback_data": f"skip:{n}"},
            ],
        ]
    }
    return {"text": text, "keyboard": keyboard, "parse_mode": "Markdown"}


# ─────────────────────────────────────────────────────────────────────────────
# Build command


def cmd_build() -> int:
    """Output JSON: a list of cards for the bot to send."""
    cards: list[dict] = []

    # 1. Scout reports awaiting approval
    scout_issues = fetch_issues("scout-reviewed", ["approved"])
    for issue in scout_issues:
        cards.append({"type": "scout", **build_scout_card(issue)})

    # 2. Marshal dispatches awaiting ready-to-fix
    marshal_issues = fetch_issues("dispatched", ["ready-to-fix", "assigned:operator"])
    for issue in marshal_issues:
        cards.append({"type": "marshal", **build_marshal_card(issue)})

    # 3. PRs awaiting review
    prs = fetch_open_prs()
    for pr in prs:
        cards.append({"type": "pr", **build_pr_card(pr)})

    # Header card if there's work, else a "queue empty" card
    if cards:
        header = {
            "type": "header",
            "text": (
                f"🏰 *Kingdom Inbox*\n"
                f"{len(scout_issues)} to approve · "
                f"{len(marshal_issues)} to authorise · "
                f"{len(prs)} PR{'s' if len(prs) != 1 else ''} to review"
            ),
            "parse_mode": "Markdown",
        }
        output = [header] + cards
    else:
        output = [{
            "type": "empty",
            "text": "🏰 *Kingdom Inbox*\n\nNo pending actions. The kingdom is at peace.",
            "parse_mode": "Markdown",
        }]

    print(json.dumps(output, indent=2))
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# Callback command


def cmd_callback(data: str) -> int:
    """Process a callback_data string. Output JSON: {ok, message, edit_text?, alert?}."""
    if ":" not in data:
        out = {"ok": False, "message": f"malformed callback_data: {data}"}
        print(json.dumps(out))
        return 1

    verb, _, target_str = data.partition(":")
    try:
        target = int(target_str)
    except ValueError:
        out = {"ok": False, "message": f"non-numeric target: {target_str}"}
        print(json.dumps(out))
        return 1

    if verb == "approve":
        rc, _ = gh("issue", "edit", str(target), "--add-label", "approved")
        if rc == 0:
            out = {
                "ok": True,
                "alert": f"#{target} approved — Marshal picks up next hour",
                "edit_text": f"✅ *Approved \\#{target}* — queued for Marshal next hour.",
            }
        else:
            out = {"ok": False, "alert": f"failed to label #{target}"}

    elif verb == "auth":
        rc, _ = gh("issue", "edit", str(target), "--add-label", "ready-to-fix")
        if rc == 0:
            out = {
                "ok": True,
                "alert": f"#{target} authorised — Smith picks up next hour",
                "edit_text": f"🔨 *Authorised \\#{target}* — queued for Smith next hour.",
            }
        else:
            out = {"ok": False, "alert": f"failed to label #{target}"}

    elif verb == "merge":
        rc, _ = gh("pr", "merge", str(target), "--merge", "--delete-branch")
        if rc == 0:
            out = {
                "ok": True,
                "alert": f"PR #{target} merged",
                "edit_text": f"🔀 *Merged PR \\#{target}* — Inspector picks up next hour.",
            }
        else:
            out = {"ok": False, "alert": f"failed to merge PR #{target}"}

    elif verb == "skip":
        out = {
            "ok": True,
            "alert": "skipped",
            "edit_text": f"⏭ _Skipped \\#{target}_ (no action taken — still in queue)",
        }

    elif verb == "scout":
        body = get_latest_comment(target, "## 🔍 Scout's Investigation")
        if body:
            out = {"ok": True, "reply": body}
        else:
            out = {"ok": False, "alert": f"no Scout report found on #{target}"}

    elif verb == "marshal":
        body = get_latest_comment(target, "## 📜 Marshal's Routing")
        if body:
            out = {"ok": True, "reply": body}
        else:
            out = {"ok": False, "alert": f"no Marshal routing found on #{target}"}

    else:
        out = {"ok": False, "alert": f"unknown verb: {verb}"}

    print(json.dumps(out))
    return 0 if out.get("ok") else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Kingdom Inbox CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build")
    p_cb = sub.add_parser("callback")
    p_cb.add_argument("data", help="callback_data string from Telegram")
    args = parser.parse_args()

    if args.cmd == "build":
        return cmd_build()
    if args.cmd == "callback":
        return cmd_callback(args.data)
    return 1


if __name__ == "__main__":
    sys.exit(main())
