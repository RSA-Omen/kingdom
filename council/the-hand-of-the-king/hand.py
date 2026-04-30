"""The Hand of the King — v0.

The king's direct assistant. Reads TODO.md, prioritises matters, drafts the day's
agenda. Stdlib only — no external dependencies.

Usage:
    python -m hand brief                  # markdown brief to stdout
    python -m hand today                  # today's three (JSON)
    python -m hand agenda                 # full agenda (JSON)
    python -m hand done <id>              # mark item complete
    python -m hand defer <id> <days>      # defer item N days

State is persisted at ~/Kingdom/.hand-state.json. TODO source is ~/Kingdom/TODO.md
(override via KINGDOM_TODO env var).
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

KINGDOM_DIR = Path(os.environ.get("KINGDOM_DIR", Path.home() / "Kingdom"))
TODO_PATH = Path(os.environ.get("KINGDOM_TODO", KINGDOM_DIR / "TODO.md"))
STATE_PATH = Path(os.environ.get("KINGDOM_HAND_STATE", KINGDOM_DIR / ".hand-state.json"))
SNAPSHOT_PATH = Path(
    os.environ.get("KINGDOM_HAND_SNAPSHOT", KINGDOM_DIR / ".hand-snapshot.json")
)
TELEGRAM_ENV_FALLBACK = Path.home() / "telegram_notify_service" / ".env"

PRIORITY_WEIGHTS = {"P1": 100, "P2": 50, "P3": 20, "IDEA": 5, None: 30}
FOUNDATION_SECTION = "Right now (foundation work)"
FOUNDATION_BONUS = 20
DEFERRED_BONUS = 10

# ─────────────────────────────────────────────────────────────────────────────


@dataclasses.dataclass
class Matter:
    id: str  # stable hash of section + raw line text
    section: str
    priority: Optional[str]  # "P1", "P2", "P3", "IDEA", or None
    title: str  # the trimmed text after the priority tag
    raw: str  # the original line, for round-tripping edits
    line_no: int  # 1-indexed line number in the source file
    deferred_count: int = 0
    deferred_until: Optional[str] = None  # ISO date string

    @property
    def weight(self) -> int:
        base = PRIORITY_WEIGHTS.get(self.priority, PRIORITY_WEIGHTS[None])
        if self.section == FOUNDATION_SECTION:
            base += FOUNDATION_BONUS
        if self.deferred_count > 0:
            base += DEFERRED_BONUS
        return base

    @property
    def overdue(self) -> bool:
        if not self.deferred_until:
            return False
        try:
            until = dt.date.fromisoformat(self.deferred_until)
        except ValueError:
            return False
        return until < dt.date.today()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "section": self.section,
            "priority": self.priority,
            "title": self.title,
            "line_no": self.line_no,
            "weight": self.weight,
            "deferred_count": self.deferred_count,
            "deferred_until": self.deferred_until,
            "overdue": self.overdue,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Parsing


HEADING_RE = re.compile(r"^##\s+(.+?)\s*$")
TASK_RE = re.compile(r"^- \[ \]\s+(.+?)\s*$")
PRIORITY_RE = re.compile(r"^\[(P[123]|IDEA)\]\s+(.+)$")


def _matter_id(section: str, raw: str) -> str:
    """A short stable id from section + raw line text."""
    return hashlib.sha1(f"{section}::{raw}".encode()).hexdigest()[:8]


def parse_todo(todo_path: Path = TODO_PATH) -> list[Matter]:
    """Walk TODO.md and extract every open matter."""
    if not todo_path.exists():
        return []

    matters: list[Matter] = []
    section = "(unsectioned)"
    state = _load_state()

    for i, line in enumerate(todo_path.read_text().splitlines(), start=1):
        h = HEADING_RE.match(line)
        if h:
            section = h.group(1).strip()
            continue
        m = TASK_RE.match(line)
        if not m:
            continue
        body = m.group(1).strip()
        priority: Optional[str] = None
        title = body
        pm = PRIORITY_RE.match(body)
        if pm:
            priority = pm.group(1)
            title = pm.group(2).strip()

        mid = _matter_id(section, body)
        meta = state.get("matters", {}).get(mid, {})
        matters.append(
            Matter(
                id=mid,
                section=section,
                priority=priority,
                title=title,
                raw=line,
                line_no=i,
                deferred_count=meta.get("deferred_count", 0),
                deferred_until=meta.get("deferred_until"),
            )
        )
    return matters


# ─────────────────────────────────────────────────────────────────────────────
# State


def _load_state() -> dict:
    if not STATE_PATH.exists():
        return {"matters": {}, "completed": []}
    try:
        return json.loads(STATE_PATH.read_text())
    except Exception:
        return {"matters": {}, "completed": []}


def _save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2))


# ─────────────────────────────────────────────────────────────────────────────
# Agenda construction


def _todays_three(matters: list[Matter]) -> list[Matter]:
    """Top 3 by weight, with at most 2 from any single section."""
    sorted_matters = sorted(matters, key=lambda m: m.weight, reverse=True)
    chosen: list[Matter] = []
    section_counts: dict[str, int] = {}
    for m in sorted_matters:
        if section_counts.get(m.section, 0) >= 2:
            continue
        chosen.append(m)
        section_counts[m.section] = section_counts.get(m.section, 0) + 1
        if len(chosen) == 3:
            break
    return chosen


def build_agenda(matters: list[Matter]) -> dict:
    today = _todays_three(matters)
    by_section: dict[str, list[dict]] = {}
    for m in matters:
        by_section.setdefault(m.section, []).append(m.to_dict())

    summary = {
        "total_open": len(matters),
        "p1_count": sum(1 for m in matters if m.priority == "P1"),
        "p2_count": sum(1 for m in matters if m.priority == "P2"),
        "p3_count": sum(1 for m in matters if m.priority == "P3"),
        "ideas": sum(1 for m in matters if m.priority == "IDEA"),
        "untagged": sum(1 for m in matters if m.priority is None),
        "overdue": sum(1 for m in matters if m.overdue),
    }
    return {
        "generated_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "summary": summary,
        "today": [m.to_dict() for m in today],
        "by_section": by_section,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Brief composition (markdown)


def _priority_emoji(p: Optional[str]) -> str:
    return {"P1": "🔴", "P2": "🟡", "P3": "🟢", "IDEA": "💡"}.get(p, "⚪")


def compose_brief(agenda: dict) -> str:
    s = agenda["summary"]
    today = agenda["today"]
    date_str = dt.date.today().strftime("%A, %d %B %Y")

    lines: list[str] = []
    lines.append(f"**Sire, your agenda for {date_str}.**")
    lines.append("")
    lines.append(
        f"🔴 **{s['p1_count']}** matters of the highest priority.   "
        f"🟡 **{s['p2_count']}** of medium.   "
        f"🟢 **{s['p3_count']}** lesser.   "
        f"💡 **{s['ideas']}** ideas warm."
    )
    if s["overdue"]:
        lines.append(f"⚠️ **{s['overdue']}** are overdue from previous deferrals.")
    lines.append("")
    lines.append("**Today's three:**")
    if not today:
        lines.append("_The realm is at peace, Sire. No matters demand attention._")
    for i, m in enumerate(today, start=1):
        emoji = _priority_emoji(m["priority"])
        title = m["title"]
        # Trim noisy markdown emphasis from titles for cleaner reading
        title = re.sub(r"\*\*([^*]+)\*\*", r"\1", title)
        why = _why_this_one(m)
        lines.append(f"{i}. {emoji} **{title}**")
        lines.append(f"   _{why}_  `id:{m['id']}`")
    lines.append("")
    # Optional asides (placeholder until other agents file briefs)
    lines.append(
        "_Once the rest of the Council is summoned, their notes will appear here._"
    )
    lines.append("")
    lines.append(f"— *The Hand, {agenda['generated_at']}*")
    return "\n".join(lines)


def _why_this_one(m: dict) -> str:
    reasons: list[str] = []
    if m["priority"] == "P1":
        reasons.append("highest priority")
    elif m["priority"] == "P2":
        reasons.append("medium priority")
    elif m["priority"] == "P3":
        reasons.append("lower priority")
    elif m["priority"] == "IDEA":
        reasons.append("worth keeping warm")
    if m["section"] == FOUNDATION_SECTION:
        reasons.append("foundation work")
    if m.get("deferred_count", 0) > 0:
        reasons.append(f"deferred {m['deferred_count']}× already")
    if m.get("overdue"):
        reasons.append("**overdue**")
    return "; ".join(reasons) if reasons else "next in queue"


# ─────────────────────────────────────────────────────────────────────────────
# Mutations: done / defer


def mark_done(item_id: str) -> bool:
    """Move the matched matter to a 'Completed' section at the bottom of TODO.md."""
    matters = parse_todo()
    target = next((m for m in matters if m.id == item_id), None)
    if not target:
        return False

    text = TODO_PATH.read_text().splitlines()
    # Replace the matched line with a strikethrough-ish "completed" marker
    # rather than deleting, so the king can review history.
    today = dt.date.today().isoformat()
    completed_line = f"- [x] {target.raw[6:]}  _(done {today}, by The Hand)_"
    text[target.line_no - 1] = completed_line

    # Append/append to a "Completed" section at the bottom for easy review.
    # If the section already exists we leave it as-is; the inline strikethrough
    # is the canonical record. (Future: roll old completions into the Completed
    # section and remove from their original spot.)
    TODO_PATH.write_text("\n".join(text) + "\n")

    state = _load_state()
    state.setdefault("completed", []).append(
        {"id": item_id, "title": target.title, "completed_at": today}
    )
    state.get("matters", {}).pop(item_id, None)
    _save_state(state)
    return True


def defer(item_id: str, days: int) -> bool:
    """Defer a matter N days. Increments deferred_count, sets deferred_until."""
    matters = parse_todo()
    target = next((m for m in matters if m.id == item_id), None)
    if not target:
        return False

    state = _load_state()
    matters_state = state.setdefault("matters", {})
    cur = matters_state.setdefault(item_id, {"deferred_count": 0})
    cur["deferred_count"] = cur.get("deferred_count", 0) + 1
    cur["deferred_until"] = (dt.date.today() + dt.timedelta(days=days)).isoformat()
    _save_state(state)
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Adding new matters


def add_matter(text: str, priority: str = "P2", section: str = "Right now (foundation work)") -> str:
    """Append a new matter to TODO.md under the given section."""
    body = TODO_PATH.read_text().splitlines()
    section_heading = f"## {section}"
    try:
        idx = body.index(section_heading)
    except ValueError:
        # Section doesn't exist — append it at the end
        body.append("")
        body.append(section_heading)
        body.append("")
        idx = len(body) - 2

    # Find the end of this section (next heading or EOF)
    insert_at = len(body)
    for j in range(idx + 1, len(body)):
        if body[j].startswith("## "):
            insert_at = j
            break

    # Walk backwards from insert_at to find the last non-blank line and insert after it
    while insert_at > 0 and not body[insert_at - 1].strip():
        insert_at -= 1

    new_line = f"- [ ] [{priority}] {text}"
    body.insert(insert_at, new_line)
    TODO_PATH.write_text("\n".join(body) + ("\n" if not body[-1].endswith("\n") else ""))

    return _matter_id(section, new_line[6:])


# ─────────────────────────────────────────────────────────────────────────────
# Snapshot — write agenda + brief to a file the dashboard can read


def write_snapshot() -> Path:
    matters = parse_todo()
    agenda = build_agenda(matters)
    brief = compose_brief(agenda)
    snapshot = {
        "agenda": agenda,
        "brief_markdown": brief,
        "snapshot_path": str(SNAPSHOT_PATH),
    }
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(json.dumps(snapshot, indent=2))
    return SNAPSHOT_PATH


# ─────────────────────────────────────────────────────────────────────────────
# Telegram delivery


def _read_dotenv(path: Path) -> dict[str, str]:
    """Tiny .env parser — KEY=VALUE lines, ignores comments and blanks."""
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip("'\"")
    return out


def _telegram_creds() -> tuple[str, str]:
    """Resolve bot token and chat id from env or fallback .env file."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not (token and chat_id) and TELEGRAM_ENV_FALLBACK.exists():
        env = _read_dotenv(TELEGRAM_ENV_FALLBACK)
        token = token or env.get("TELEGRAM_BOT_TOKEN", "")
        chat_id = chat_id or env.get("TELEGRAM_CHAT_ID", "")
    if not (token and chat_id):
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not found "
            "(set in env or in ~/telegram_notify_service/.env)"
        )
    return token, chat_id


def send_telegram(text: str, parse_mode: str = "Markdown") -> dict:
    """Post a message to the king's Telegram chat. Returns API response."""
    token, chat_id = _telegram_creds()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode(
        {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": "true",
        }
    ).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


# ─────────────────────────────────────────────────────────────────────────────
# CLI


def _cmd_brief(_: argparse.Namespace) -> int:
    matters = parse_todo()
    agenda = build_agenda(matters)
    print(compose_brief(agenda))
    return 0


def _cmd_today(_: argparse.Namespace) -> int:
    matters = parse_todo()
    agenda = build_agenda(matters)
    print(json.dumps({"today": agenda["today"]}, indent=2))
    return 0


def _cmd_agenda(_: argparse.Namespace) -> int:
    matters = parse_todo()
    print(json.dumps(build_agenda(matters), indent=2))
    return 0


def _cmd_done(args: argparse.Namespace) -> int:
    ok = mark_done(args.id)
    if not ok:
        print(f"No matter found with id {args.id}", file=sys.stderr)
        return 1
    print(f"Marked {args.id} as done.")
    return 0


def _cmd_defer(args: argparse.Namespace) -> int:
    ok = defer(args.id, args.days)
    if not ok:
        print(f"No matter found with id {args.id}", file=sys.stderr)
        return 1
    print(f"Deferred {args.id} by {args.days} days.")
    return 0


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="hand", description="The Hand of the King")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("brief", help="markdown brief to stdout").set_defaults(func=_cmd_brief)
    sub.add_parser("today", help="today's three (JSON)").set_defaults(func=_cmd_today)
    sub.add_parser("agenda", help="full agenda (JSON)").set_defaults(func=_cmd_agenda)

    p_done = sub.add_parser("done", help="mark a matter done")
    p_done.add_argument("id")
    p_done.set_defaults(func=_cmd_done)

    p_defer = sub.add_parser("defer", help="defer a matter N days")
    p_defer.add_argument("id")
    p_defer.add_argument("days", type=int)
    p_defer.set_defaults(func=_cmd_defer)

    p_add = sub.add_parser("add", help="add a new matter to TODO.md")
    p_add.add_argument("text", help="the matter text")
    p_add.add_argument("--priority", default="P2", choices=["P1", "P2", "P3", "IDEA"])
    p_add.add_argument(
        "--section",
        default="Right now (foundation work)",
        help="section heading to add under",
    )
    p_add.set_defaults(func=_cmd_add)

    sub.add_parser(
        "snapshot",
        help="write agenda+brief JSON to .hand-snapshot.json (for dashboard)",
    ).set_defaults(func=_cmd_snapshot)

    p_tg = sub.add_parser("telegram", help="post the brief to Telegram")
    p_tg.add_argument(
        "--silent",
        action="store_true",
        help="send with disable_notification=true",
    )
    p_tg.set_defaults(func=_cmd_telegram)

    args = parser.parse_args(argv)
    return args.func(args)


def _cmd_add(args: argparse.Namespace) -> int:
    new_id = add_matter(args.text, priority=args.priority, section=args.section)
    print(f"Added (id:{new_id}) [{args.priority}] {args.text}")
    return 0


def _cmd_snapshot(_: argparse.Namespace) -> int:
    path = write_snapshot()
    print(f"Snapshot written to {path}")
    return 0


def _cmd_telegram(args: argparse.Namespace) -> int:
    matters = parse_todo()
    agenda = build_agenda(matters)
    brief = compose_brief(agenda)
    try:
        result = send_telegram(brief)
    except Exception as e:
        print(f"Telegram delivery failed: {e}", file=sys.stderr)
        return 2
    if not result.get("ok"):
        print(f"Telegram API returned: {result}", file=sys.stderr)
        return 3
    print(f"Brief delivered (message_id={result.get('result', {}).get('message_id')})")
    # Also write a snapshot so the dashboard stays in sync after a push
    write_snapshot()
    return 0


if __name__ == "__main__":
    sys.exit(main())
