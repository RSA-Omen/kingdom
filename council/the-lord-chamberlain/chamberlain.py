#!/usr/bin/env python3
"""
The Lord Chamberlain — Relations with subjects.
Surfaces friction, error pain points, and usage abandonment from the admin-center DB.
"""

import os
import sys
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import requests

HOME = Path.home()
DB_PATH = HOME / ".chamberlain.db"
REGISTRY_DB = Path("/home/lauchlandupreez/admin-center/data/app-registry.db")
KINGDOM_ENV = HOME / ".kingdom.env"
TELEGRAM_ENV_FALLBACK = HOME / "telegram_notify_service" / ".env"

LOOKBACK_DAYS = 7


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

class ChamberlainIndex:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS findings (
                    id INTEGER PRIMARY KEY,
                    key TEXT UNIQUE NOT NULL,
                    kind TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    detail TEXT NOT NULL,
                    first_seen TEXT NOT NULL,
                    last_seen TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'open'
                )
            """)
            conn.commit()

    def upsert_finding(self, key: str, kind: str, subject: str, detail: str):
        now = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(self.db_path) as conn:
            existing = conn.execute(
                "SELECT id FROM findings WHERE key = ?", (key,)
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE findings SET kind=?, subject=?, detail=?, last_seen=? WHERE key=?",
                    (kind, subject, detail, now, key),
                )
            else:
                conn.execute(
                    "INSERT INTO findings (key, kind, subject, detail, first_seen, last_seen) VALUES (?,?,?,?,?,?)",
                    (key, kind, subject, detail, now, now),
                )
            conn.commit()

    def get_open_findings(self) -> List[Dict]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT key, kind, subject, detail, first_seen, last_seen "
                "FROM findings WHERE status='open' ORDER BY kind, subject"
            ).fetchall()
        return [dict(r) for r in rows]

    def dismiss(self, key: str):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("UPDATE findings SET status='dismissed' WHERE key=?", (key,))
            conn.commit()

    def count_open(self) -> int:
        with sqlite3.connect(self.db_path) as conn:
            return conn.execute(
                "SELECT count(*) FROM findings WHERE status='open'"
            ).fetchone()[0]


# ---------------------------------------------------------------------------
# Scanner
# ---------------------------------------------------------------------------

class ChamberlainScanner:
    def __init__(self, index: ChamberlainIndex):
        self.index = index

    def _open_registry(self) -> sqlite3.Connection:
        if not REGISTRY_DB.exists():
            raise FileNotFoundError(f"Registry DB not found: {REGISTRY_DB}")
        conn = sqlite3.connect(f"file:{REGISTRY_DB}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    def _cutoff_unix(self) -> int:
        return int((datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).timestamp())

    def _cutoff_iso(self) -> str:
        return (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).strftime(
            "%Y-%m-%dT%H:%M:%S"
        )

    def _get_all_apps(self, conn: sqlite3.Connection) -> List[Dict]:
        rows = conn.execute("SELECT id, name, slug FROM apps WHERE status='active'").fetchall()
        return [dict(r) for r in rows]

    def _errors_by_village_7d(self, conn: sqlite3.Connection) -> Dict[str, int]:
        """Count open errors per village in last 7 days."""
        cutoff = self._cutoff_unix()
        rows = conn.execute(
            "SELECT village, count(*) as cnt FROM errors "
            "WHERE created_at > ? "
            "GROUP BY village ORDER BY cnt DESC",
            (cutoff,),
        ).fetchall()
        return {r["village"]: r["cnt"] for r in rows}

    def _open_blockers(self, conn: sqlite3.Connection) -> List[Dict]:
        """All open errors (any severity) — the DB only has 'error'/'warning'."""
        rows = conn.execute(
            "SELECT id, village, message, severity, created_at FROM errors "
            "WHERE status='open' ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    def _usage_7d_by_app(self, conn: sqlite3.Connection) -> Dict[str, int]:
        """Usage event count per app_slug in last 7 days."""
        cutoff = self._cutoff_iso()
        rows = conn.execute(
            "SELECT app_slug, count(*) as cnt FROM usage_events "
            "WHERE timestamp > ? GROUP BY app_slug",
            (cutoff,),
        ).fetchall()
        return {r["app_slug"]: r["cnt"] for r in rows}

    def _apps_with_most_errors(
        self, all_apps: List[Dict], errors_by_village: Dict[str, int], threshold: int = 1
    ) -> List[Tuple[str, int]]:
        """
        Match error villages to app slugs/names.
        Village keys may match app slug or app name (case-insensitive partial).
        Returns list of (app_name_or_village, count) sorted descending.
        """
        # Build a lookup: slug -> name, name -> name
        slug_map: Dict[str, str] = {}
        for app in all_apps:
            slug_map[app["slug"].lower()] = app["name"]
            slug_map[app["name"].lower()] = app["name"]

        results = []
        for village, cnt in errors_by_village.items():
            if cnt < threshold:
                continue
            # Try to resolve to app name
            display = slug_map.get(village.lower(), village)
            results.append((display, cnt))
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def _apps_with_zero_usage(
        self, all_apps: List[Dict], usage_by_app: Dict[str, int]
    ) -> List[str]:
        """Apps with zero usage events in last 7 days."""
        active_slugs = {a["slug"] for a in all_apps}
        used_slugs = set(usage_by_app.keys())
        silent = sorted(active_slugs - used_slugs)
        return silent

    def run_scan(self) -> List[Dict]:
        """Read registry DB, find friction signals, persist to chamberlain DB."""
        conn = self._open_registry()
        try:
            all_apps = self._get_all_apps(conn)
            errors_7d = self._errors_by_village_7d(conn)
            open_blockers = self._open_blockers(conn)
            usage_7d = self._usage_7d_by_app(conn)
        finally:
            conn.close()

        # 1. Apps with most errors in 7 days
        error_apps = self._apps_with_most_errors(all_apps, errors_7d)
        for app_name, count in error_apps:
            key = f"errors_7d:{app_name}"
            self.index.upsert_finding(
                key=key,
                kind="error_pain",
                subject=app_name,
                detail=f"{count} error(s) in last 7 days",
            )

        # 2. Apps with zero usage in last 7 days
        silent_apps = self._apps_with_zero_usage(all_apps, usage_7d)
        for slug in silent_apps:
            key = f"zero_usage_7d:{slug}"
            app_name = next((a["name"] for a in all_apps if a["slug"] == slug), slug)
            self.index.upsert_finding(
                key=key,
                kind="abandonment",
                subject=app_name,
                detail="0 usage events in last 7 days",
            )

        # 3. Open blockers (all open errors)
        blocker_ids_seen = set()
        for err in open_blockers:
            err_id = err["id"]
            if err_id in blocker_ids_seen:
                continue
            blocker_ids_seen.add(err_id)
            village = err["village"] or "unknown"
            severity = err["severity"] or "error"
            msg = (err["message"] or "")[:80]
            key = f"open_blocker:{err_id}"
            self.index.upsert_finding(
                key=key,
                kind="open_blocker",
                subject=village,
                detail=f"[{severity}] {msg}",
            )

        return self.index.get_open_findings()


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

KIND_LABELS = {
    "error_pain": "Error Pain",
    "abandonment": "Abandonment",
    "open_blocker": "Open Blockers",
}


def generate_report(findings: List[Dict]) -> str:
    by_kind: Dict[str, List[Dict]] = {k: [] for k in KIND_LABELS}
    for f in findings:
        kind = f["kind"]
        if kind in by_kind:
            by_kind[kind].append(f)

    lines = ["## Lord Chamberlain — Subject Relations Report", ""]

    for kind, label in KIND_LABELS.items():
        items = by_kind[kind]
        lines.append(f"### {label} ({len(items)})")
        for item in items[:10]:
            lines.append(f"  - **{item['subject']}** — {item['detail']}")
        if len(items) > 10:
            lines.append(f"  - …and {len(items) - 10} more")
        lines.append("")

    total = sum(len(v) for v in by_kind.values())
    if total == 0:
        lines.append("No friction signals found. Subjects are at peace.")

    return "\n".join(lines)


def generate_brief(findings: List[Dict]) -> str:
    by_kind: Dict[str, List] = {"error_pain": [], "abandonment": [], "open_blocker": []}
    for f in findings:
        if f["kind"] in by_kind:
            by_kind[f["kind"]].append(f)

    total = sum(len(v) for v in by_kind.values())
    if total == 0:
        return "Chamberlain: no friction signals — subjects are at peace."

    parts = []
    if by_kind["error_pain"]:
        top = by_kind["error_pain"][0]
        parts.append(f"{top['subject']} ({top['detail']})")
    if by_kind["abandonment"]:
        slugs = ", ".join(f["subject"] for f in by_kind["abandonment"][:3])
        parts.append(f"{len(by_kind['abandonment'])} silent app(s): {slugs}")
    if by_kind["open_blocker"]:
        villages = sorted({f["subject"] for f in by_kind["open_blocker"]})
        parts.append(f"{len(by_kind['open_blocker'])} open blocker(s) in {', '.join(villages[:2])}")

    brief_body = " | ".join(parts)
    return f"Chamberlain: {total} friction point(s) — {brief_body}"


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------

def _read_dotenv(path: Path) -> dict:
    result = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                result[k.strip()] = v.strip().strip("\"'")
    return result


def _telegram_creds() -> Tuple[str, str]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    for env_file in [KINGDOM_ENV, TELEGRAM_ENV_FALLBACK]:
        if not (token and chat_id) and env_file.exists():
            env = _read_dotenv(env_file)
            token = token or env.get("TELEGRAM_BOT_TOKEN", "")
            chat_id = chat_id or env.get("TELEGRAM_CHAT_ID", "")
    if not (token and chat_id):
        raise RuntimeError("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not found")
    return token, chat_id


def _format_telegram_message(findings: List[Dict]) -> str:
    by_kind: Dict[str, List[Dict]] = {k: [] for k in KIND_LABELS}
    for f in findings:
        if f["kind"] in by_kind:
            by_kind[f["kind"]].append(f)

    lines = ["<b>Lord Chamberlain — Subject Relations</b>", ""]

    for kind, label in KIND_LABELS.items():
        items = by_kind[kind]
        if not items:
            continue
        lines.append(f"<b>{label} ({len(items)})</b>")
        for item in items[:5]:
            subject = item["subject"]
            detail = item["detail"]
            lines.append(f"  • <b>{subject}</b> — {detail}")
        if len(items) > 5:
            lines.append(f"  • …and {len(items) - 5} more")
        lines.append("")

    total = sum(len(v) for v in by_kind.values())
    if total == 0:
        lines.append("No friction signals. Subjects are at peace.")

    return "\n".join(lines)


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
            print(f"Telegram responded {resp.status_code}: {resp.text}", file=sys.stderr)
    except Exception as e:
        print(f"Failed to send Telegram: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    index = ChamberlainIndex()
    scanner = ChamberlainScanner(index)

    command = sys.argv[1] if len(sys.argv) > 1 else "scan"

    if command == "scan":
        print("Scanning for friction signals…")
        findings = scanner.run_scan()
        print(generate_report(findings))

    elif command == "report":
        print("Scanning and sending report to Telegram…")
        findings = scanner.run_scan()
        msg = _format_telegram_message(findings)
        send_telegram(msg)
        print("Report sent to Telegram.")
        print()
        print(generate_report(findings))

    elif command == "brief":
        findings = index.get_open_findings()
        if not findings:
            findings = scanner.run_scan()
        print(generate_brief(findings))

    elif command == "telegram":
        findings = scanner.run_scan()
        msg = _format_telegram_message(findings)
        send_telegram(msg)
        print("Sent to Telegram.")

    elif command == "db":
        print(f"Database: {DB_PATH}")
        open_count = index.count_open()
        with sqlite3.connect(DB_PATH) as conn:
            total = conn.execute("SELECT count(*) FROM findings").fetchone()[0]
        print(f"Open findings: {open_count} / Total: {total}")

    elif command == "dismiss":
        if len(sys.argv) < 3:
            print("Usage: dismiss <key>", file=sys.stderr)
            sys.exit(1)
        key = sys.argv[2]
        index.dismiss(key)
        print(f"Dismissed: {key}")

    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print("Commands: scan | report | brief | telegram | db | dismiss <key>", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
