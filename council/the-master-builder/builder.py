#!/usr/bin/env python3
"""
The Master Builder — Improves the platform itself.
Surfaces stale errors, ignored todos, and stagnant GitHub issues.
"""

import json
import os
import re
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

HOME = Path.home()
DB_PATH = HOME / ".builder.db"
KINGDOM_DIR = HOME / "Kingdom"
REGISTRY_DB = HOME / "admin-center" / "data" / "app-registry.db"
TODO_MD = KINGDOM_DIR / "TODO.md"
KINGDOM_ENV = HOME / ".kingdom.env"

STALE_ERRORS_DAYS = 14
STALE_TODOS_DAYS = 30
STALE_GITHUB_DAYS = 7

GH_REPO = "RSA-Omen/kingdom"
GH_BIN = "/usr/bin/gh"


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

class BuilderIndex:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS findings (
                    id INTEGER PRIMARY KEY,
                    category TEXT NOT NULL,
                    key TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    detail TEXT,
                    first_seen TEXT NOT NULL,
                    last_seen TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'open',
                    UNIQUE(category, key)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS scan_runs (
                    id INTEGER PRIMARY KEY,
                    ran_at TEXT NOT NULL,
                    stale_errors INTEGER NOT NULL DEFAULT 0,
                    stale_todos INTEGER NOT NULL DEFAULT 0,
                    github_issues INTEGER NOT NULL DEFAULT 0,
                    todo_md_count INTEGER NOT NULL DEFAULT 0
                )
            """)
            conn.commit()

    def upsert_finding(self, category: str, key: str, summary: str, detail: str = ""):
        now = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(self.db_path) as conn:
            existing = conn.execute(
                "SELECT id FROM findings WHERE category=? AND key=?", (category, key)
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE findings SET summary=?, detail=?, last_seen=?, status='open' WHERE category=? AND key=?",
                    (summary, detail, now, category, key),
                )
            else:
                conn.execute(
                    "INSERT INTO findings (category, key, summary, detail, first_seen, last_seen) VALUES (?,?,?,?,?,?)",
                    (category, key, summary, detail, now, now),
                )
            conn.commit()

    def resolve_stale(self, category: str, active_keys: List[str]):
        """Mark findings in this category as resolved if their key is no longer active."""
        if not active_keys:
            # Resolve all open findings in this category
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "UPDATE findings SET status='resolved' WHERE category=? AND status='open'",
                    (category,),
                )
                conn.commit()
            return
        placeholders = ",".join("?" * len(active_keys))
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                f"UPDATE findings SET status='resolved' WHERE category=? AND status='open' AND key NOT IN ({placeholders})",
                [category] + active_keys,
            )
            conn.commit()

    def get_open_findings(self) -> List[Dict]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT category, key, summary, detail, first_seen, last_seen "
                "FROM findings WHERE status='open' ORDER BY category, last_seen DESC"
            ).fetchall()
        return [
            {
                "category": r[0],
                "key": r[1],
                "summary": r[2],
                "detail": r[3],
                "first_seen": r[4],
                "last_seen": r[5],
            }
            for r in rows
        ]

    def record_run(self, stale_errors: int, stale_todos: int, github_issues: int, todo_md_count: int):
        now = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO scan_runs (ran_at, stale_errors, stale_todos, github_issues, todo_md_count) VALUES (?,?,?,?,?)",
                (now, stale_errors, stale_todos, github_issues, todo_md_count),
            )
            conn.commit()

    def counts_by_category(self) -> Dict[str, int]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT category, count(*) FROM findings WHERE status='open' GROUP BY category"
            ).fetchall()
        return {r[0]: r[1] for r in rows}

    def last_run(self) -> Optional[Dict]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT ran_at, stale_errors, stale_todos, github_issues, todo_md_count "
                "FROM scan_runs ORDER BY id DESC LIMIT 1"
            ).fetchone()
        if not row:
            return None
        return {
            "ran_at": row[0],
            "stale_errors": row[1],
            "stale_todos": row[2],
            "github_issues": row[3],
            "todo_md_count": row[4],
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_ts(value) -> Optional[datetime]:
    """Parse a created_at value — handles Unix int/float or ISO string."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except (OSError, OverflowError, ValueError):
            return None
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        # Try ISO format variations
        for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S"):
            try:
                return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                pass
        # Try numeric string
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except (OSError, OverflowError, ValueError):
            pass
    return None


def _days_old(dt: datetime) -> int:
    now = datetime.now(timezone.utc)
    return max(0, (now - dt).days)


def _read_dotenv(path: Path) -> Dict[str, str]:
    result: Dict[str, str] = {}
    if not path.exists():
        return result
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            result[k.strip()] = v.strip().strip("\"'")
    return result


# ---------------------------------------------------------------------------
# Scanners
# ---------------------------------------------------------------------------

def scan_stale_errors(index: BuilderIndex) -> List[Dict]:
    """Find open errors older than STALE_ERRORS_DAYS, grouped by village."""
    if not REGISTRY_DB.exists():
        print(f"  [warn] registry DB not found: {REGISTRY_DB}", file=sys.stderr)
        return []

    findings = []
    try:
        conn = sqlite3.connect(f"file:{REGISTRY_DB}?mode=ro", uri=True)
        rows = conn.execute(
            "SELECT id, village, message, created_at FROM errors WHERE status='open'"
        ).fetchall()
        conn.close()
    except sqlite3.Error as e:
        print(f"  [warn] error reading errors table: {e}", file=sys.stderr)
        return []

    # Group by village, tracking stale ones
    by_village: Dict[str, List] = {}
    active_keys = []

    for row in rows:
        error_id, village, message, created_at_raw = row
        dt = _parse_ts(created_at_raw)
        if dt is None:
            continue
        age = _days_old(dt)
        if age < STALE_ERRORS_DAYS:
            continue
        village = village or "unknown"
        if village not in by_village:
            by_village[village] = []
        by_village[village].append({"id": error_id, "message": message, "age": age})

    for village, errors in by_village.items():
        key = f"stale_errors:{village}"
        active_keys.append(key)
        count = len(errors)
        oldest = max(e["age"] for e in errors)
        sample = errors[0]["message"][:80] if errors[0]["message"] else "(no message)"
        summary = f"{count} open error{'s' if count != 1 else ''} in '{village}', oldest {oldest}d"
        detail = f"Sample: {sample}"
        index.upsert_finding("stale_errors", key, summary, detail)
        findings.append({"village": village, "count": count, "oldest_days": oldest})

    index.resolve_stale("stale_errors", active_keys)
    return findings


def scan_stale_todos(index: BuilderIndex) -> List[Dict]:
    """Find open todos older than STALE_TODOS_DAYS."""
    if not REGISTRY_DB.exists():
        return []

    findings = []
    active_keys = []

    try:
        conn = sqlite3.connect(f"file:{REGISTRY_DB}?mode=ro", uri=True)
        rows = conn.execute(
            "SELECT id, village, title, created_at FROM todos WHERE status='open'"
        ).fetchall()
        conn.close()
    except sqlite3.Error as e:
        print(f"  [warn] error reading todos table: {e}", file=sys.stderr)
        return []

    for row in rows:
        todo_id, village, title, created_at_raw = row
        dt = _parse_ts(created_at_raw)
        if dt is None:
            continue
        age = _days_old(dt)
        if age < STALE_TODOS_DAYS:
            continue
        key = f"stale_todo:{todo_id}"
        active_keys.append(key)
        village = village or "unknown"
        title_short = (title or "(no title)")[:80]
        summary = f"Todo in '{village}' open for {age}d: {title_short}"
        index.upsert_finding("stale_todos", key, summary)
        findings.append({"id": todo_id, "village": village, "title": title_short, "age": age})

    index.resolve_stale("stale_todos", active_keys)
    return findings


def scan_github_issues(index: BuilderIndex) -> List[Dict]:
    """Find open GitHub issues older than STALE_GITHUB_DAYS."""
    findings = []
    active_keys = []

    try:
        result = subprocess.run(
            [GH_BIN, "issue", "list",
             "--repo", GH_REPO,
             "--state", "open",
             "--json", "number,title,createdAt,labels",
             "--limit", "50"],
            capture_output=True, text=True, timeout=20,
        )
        if result.returncode != 0 or not result.stdout.strip():
            if result.stderr:
                print(f"  [warn] gh issue list failed: {result.stderr[:120]}", file=sys.stderr)
            return []
        issues = json.loads(result.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError, Exception) as e:
        print(f"  [warn] GitHub issues unavailable: {e}", file=sys.stderr)
        return []

    for issue in issues:
        number = issue.get("number")
        title = issue.get("title", "(no title)")
        created_at = issue.get("createdAt", "")
        labels = [lb.get("name", "") for lb in issue.get("labels", [])]

        dt = _parse_ts(created_at)
        if dt is None:
            continue
        age = _days_old(dt)
        if age < STALE_GITHUB_DAYS:
            continue

        key = f"gh_issue:{number}"
        active_keys.append(key)
        label_str = ", ".join(labels) if labels else "no labels"
        summary = f"#{number}: {title[:70]} ({age}d old, {label_str})"
        index.upsert_finding("github_issues", key, summary)
        findings.append({"number": number, "title": title, "age": age, "labels": labels})

    index.resolve_stale("github_issues", active_keys)
    return findings


def scan_todo_md() -> int:
    """Count unchecked [ ] items in TODO.md."""
    if not TODO_MD.exists():
        return 0
    count = 0
    for line in TODO_MD.read_text().splitlines():
        if re.search(r"- \[ \]", line):
            count += 1
    return count


# ---------------------------------------------------------------------------
# Full scan
# ---------------------------------------------------------------------------

class BuilderScanner:
    def __init__(self, index: BuilderIndex):
        self.index = index

    def run_scan(self) -> Dict:
        print("Scanning stale errors…")
        stale_errors = scan_stale_errors(self.index)

        print("Scanning stale todos…")
        stale_todos = scan_stale_todos(self.index)

        print("Scanning GitHub issues…")
        github_issues = scan_github_issues(self.index)

        print("Counting TODO.md items…")
        todo_md_count = scan_todo_md()

        self.index.record_run(
            stale_errors=len(stale_errors),
            stale_todos=len(stale_todos),
            github_issues=len(github_issues),
            todo_md_count=todo_md_count,
        )

        return {
            "stale_errors": stale_errors,
            "stale_todos": stale_todos,
            "github_issues": github_issues,
            "todo_md_count": todo_md_count,
        }


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def generate_report(results: Dict) -> str:
    lines = ["## The Master Builder — Platform Health Report", ""]

    # Stale errors
    stale_errors: List[Dict] = results.get("stale_errors", [])
    lines.append(f"### Stale Errors ({len(stale_errors)} village{'s' if len(stale_errors) != 1 else ''})")
    if stale_errors:
        for item in sorted(stale_errors, key=lambda x: -x["count"]):
            lines.append(f"- **{item['village']}**: {item['count']} open error{'s' if item['count'] != 1 else ''}, oldest {item['oldest_days']}d")
    else:
        lines.append("- No stale open errors. Clean.")
    lines.append("")

    # Stale todos
    stale_todos: List[Dict] = results.get("stale_todos", [])
    lines.append(f"### Stale Todos ({len(stale_todos)})")
    if stale_todos:
        for item in sorted(stale_todos, key=lambda x: -x["age"])[:10]:
            lines.append(f"- [{item['village']}] {item['title'][:60]} — {item['age']}d open")
        if len(stale_todos) > 10:
            lines.append(f"- …and {len(stale_todos) - 10} more")
    else:
        lines.append("- No stale open todos.")
    lines.append("")

    # GitHub issues
    github_issues: List[Dict] = results.get("github_issues", [])
    lines.append(f"### Stale GitHub Issues ({len(github_issues)})")
    if github_issues:
        for item in sorted(github_issues, key=lambda x: -x["age"])[:10]:
            label_str = f" [{', '.join(item['labels'])}]" if item["labels"] else ""
            lines.append(f"- #{item['number']}: {item['title'][:60]}{label_str} — {item['age']}d")
        if len(github_issues) > 10:
            lines.append(f"- …and {len(github_issues) - 10} more")
    else:
        lines.append("- No stale GitHub issues.")
    lines.append("")

    # TODO.md
    todo_md_count: int = results.get("todo_md_count", 0)
    lines.append(f"### TODO.md Open Items: {todo_md_count}")
    lines.append("")

    return "\n".join(lines)


def generate_brief(results: Dict) -> str:
    stale_errors = len(results.get("stale_errors", []))
    stale_todos = len(results.get("stale_todos", []))
    github_issues = len(results.get("github_issues", []))
    todo_md_count = results.get("todo_md_count", 0)

    parts = []
    if stale_errors:
        parts.append(f"{stale_errors} stale error{'s' if stale_errors != 1 else ''}")
    if stale_todos:
        parts.append(f"{stale_todos} stale todo{'s' if stale_todos != 1 else ''}")
    if github_issues:
        parts.append(f"{github_issues} GitHub issue{'s' if github_issues != 1 else ''}")
    if todo_md_count:
        parts.append(f"{todo_md_count} open TODO{'s' if todo_md_count != 1 else ''}")

    if not parts:
        return "🔨 Builder: platform looks clean — no stale signals."
    return "🔨 Builder: " + " · ".join(parts)


def generate_telegram_digest(results: Dict) -> str:
    stale_errors: List[Dict] = results.get("stale_errors", [])
    stale_todos: List[Dict] = results.get("stale_todos", [])
    github_issues: List[Dict] = results.get("github_issues", [])
    todo_md_count: int = results.get("todo_md_count", 0)

    lines = ["<b>🔨 The Master Builder — Platform Digest</b>", ""]

    # Stale errors
    lines.append(f"<b>Stale Errors ({len(stale_errors)} village{'s' if len(stale_errors) != 1 else ''})</b>")
    if stale_errors:
        for item in sorted(stale_errors, key=lambda x: -x["count"])[:5]:
            lines.append(f"  • <b>{item['village']}</b>: {item['count']} error{'s' if item['count'] != 1 else ''}, oldest {item['oldest_days']}d")
        if len(stale_errors) > 5:
            lines.append(f"  • …and {len(stale_errors) - 5} more villages")
    else:
        lines.append("  No stale errors.")
    lines.append("")

    # Stale todos
    lines.append(f"<b>Stale Todos ({len(stale_todos)})</b>")
    if stale_todos:
        for item in sorted(stale_todos, key=lambda x: -x["age"])[:5]:
            lines.append(f"  • [{item['village']}] {item['title'][:50]} ({item['age']}d)")
        if len(stale_todos) > 5:
            lines.append(f"  • …and {len(stale_todos) - 5} more")
    else:
        lines.append("  No stale todos.")
    lines.append("")

    # GitHub issues
    lines.append(f"<b>Stale GitHub Issues ({len(github_issues)})</b>")
    if github_issues:
        for item in sorted(github_issues, key=lambda x: -x["age"])[:5]:
            lines.append(f"  • #{item['number']}: {item['title'][:50]} ({item['age']}d)")
        if len(github_issues) > 5:
            lines.append(f"  • …and {len(github_issues) - 5} more")
    else:
        lines.append("  No stale issues.")
    lines.append("")

    # TODO.md
    lines.append(f"<b>TODO.md open items:</b> {todo_md_count}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------

def _telegram_creds() -> Tuple[str, str]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    if not (token and chat_id) and KINGDOM_ENV.exists():
        env = _read_dotenv(KINGDOM_ENV)
        token = token or env.get("TELEGRAM_BOT_TOKEN", "")
        chat_id = chat_id or env.get("TELEGRAM_CHAT_ID", "")

    if not (token and chat_id):
        raise RuntimeError("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not found in env or ~/.kingdom.env")

    return token, chat_id


def send_telegram(text: str):
    token, chat_id = _telegram_creds()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        resp = requests.post(
            url,
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
        if not resp.ok:
            print(f"  [warn] Telegram returned {resp.status_code}: {resp.text[:120]}", file=sys.stderr)
    except Exception as e:
        print(f"  [warn] Failed to send Telegram: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    index = BuilderIndex()
    scanner = BuilderScanner(index)

    command = sys.argv[1] if len(sys.argv) > 1 else "scan"

    if command == "scan":
        results = scanner.run_scan()
        print()
        print(generate_report(results))
        print(generate_brief(results))

    elif command == "report":
        last = index.last_run()
        if not last:
            print("No scan data found. Run `scan` first.", file=sys.stderr)
            sys.exit(1)
        findings = index.get_open_findings()
        # Reconstruct counts from DB for report header
        counts = index.counts_by_category()
        results = {
            "stale_errors": [{"village": f["key"].replace("stale_errors:", ""), "count": 1, "oldest_days": 0}
                             for f in findings if f["category"] == "stale_errors"],
            "stale_todos": [{"id": f["key"], "village": "?", "title": f["summary"], "age": 0}
                           for f in findings if f["category"] == "stale_todos"],
            "github_issues": [{"number": 0, "title": f["summary"], "age": 0, "labels": []}
                              for f in findings if f["category"] == "github_issues"],
            "todo_md_count": last.get("todo_md_count", 0),
        }
        print(generate_report(results))
        print(generate_brief(results))

    elif command == "brief":
        last = index.last_run()
        if not last:
            print("🔨 Builder: no scan data yet — run `scan` first.")
            return
        results = {
            "stale_errors": [None] * last["stale_errors"],
            "stale_todos": [None] * last["stale_todos"],
            "github_issues": [None] * last["github_issues"],
            "todo_md_count": last["todo_md_count"],
        }
        print(generate_brief(results))

    elif command == "telegram":
        results = scanner.run_scan()
        msg = generate_telegram_digest(results)
        send_telegram(msg)
        print("Digest sent to Telegram.")
        print(generate_brief(results))

    elif command == "db":
        print(f"Database: {DB_PATH}")
        with sqlite3.connect(DB_PATH) as conn:
            open_count = conn.execute("SELECT count(*) FROM findings WHERE status='open'").fetchone()[0]
            total_count = conn.execute("SELECT count(*) FROM findings").fetchone()[0]
            runs = conn.execute("SELECT count(*) FROM scan_runs").fetchone()[0]
        print(f"Open findings: {open_count} / Total: {total_count}")
        print(f"Scan runs recorded: {runs}")
        last = index.last_run()
        if last:
            print(f"Last scan: {last['ran_at']}")

    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print("Commands: scan | report | brief | telegram | db", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
