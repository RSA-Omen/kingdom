#!/usr/bin/env python3
"""
The Castellan — Keeps the castle clean.
Identifies abandoned wings, recommends archive or demolish.
"""

import os
import sys
import shutil
import sqlite3
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import requests

HOME = Path.home()
DB_PATH = HOME / ".castellan.db"
KINGDOM_DIR = HOME / "Kingdom"
ARCHIVE_DIR = HOME / "Archive"
REPORTS_DIR = KINGDOM_DIR / "docs" / "castellan-reports"
TELEGRAM_ENV_FALLBACK = HOME / "telegram_notify_service" / ".env"
KINGDOM_ENV = HOME / ".kingdom.env"

STALENESS_DAYS = 90

# Top-level dirs in ~ to check (each entry is scanned one level deep)
SCAN_ROOTS = [
    HOME / "Operations",
    HOME / "Platform",
    HOME / "Management",
    HOME / "Archive",
    HOME / "bureau",
    HOME / "worker-agent",
    HOME / "scripts",
    HOME / "Gaia",
    HOME / "backend",
    HOME / "mcp_server",
    HOME / "mcp_gateway",
    HOME / "local_service",
]

# Subdirs to skip during scanning
SKIP_DIRS = {
    ".git", "node_modules", ".next", ".venv", "venv",
    "__pycache__", ".cache", "dist", "build", ".mypy_cache",
    ".pytest_cache", ".tox",
}

# Category constants
DEMOLISH = "DEMOLISH"
ARCHIVE = "ARCHIVE"
REVIEW = "REVIEW"


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

class CastellanIndex:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS findings (
                    id INTEGER PRIMARY KEY,
                    path TEXT UNIQUE NOT NULL,
                    category TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    first_seen TEXT NOT NULL,
                    last_seen TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'open'
                )
            """)
            conn.commit()

    def upsert_finding(self, path: str, category: str, reason: str):
        now = datetime.utcnow().isoformat()
        with sqlite3.connect(self.db_path) as conn:
            existing = conn.execute(
                "SELECT id, first_seen FROM findings WHERE path = ?", (path,)
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE findings SET category=?, reason=?, last_seen=? WHERE path=?",
                    (category, reason, now, path),
                )
            else:
                conn.execute(
                    "INSERT INTO findings (path, category, reason, first_seen, last_seen) VALUES (?,?,?,?,?)",
                    (path, category, reason, now, now),
                )
            conn.commit()

    def get_open_findings(self) -> List[Dict]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT path, category, reason, first_seen, last_seen FROM findings WHERE status='open' ORDER BY category, path"
            ).fetchall()
        return [
            {"path": r[0], "category": r[1], "reason": r[2],
             "first_seen": r[3], "last_seen": r[4]}
            for r in rows
        ]

    def dismiss(self, path: str):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("UPDATE findings SET status='dismissed' WHERE path=?", (path,))
            conn.commit()

    def count_by_category(self) -> Dict[str, int]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT category, count(*) FROM findings WHERE status='open' GROUP BY category"
            ).fetchall()
        return {r[0]: r[1] for r in rows}

    def resolve(self, path: str, action: str):
        """Mark a finding as resolved with the action taken."""
        now = datetime.utcnow().isoformat()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "UPDATE findings SET status=?, last_seen=? WHERE path=?",
                (f"resolved:{action}", now, path),
            )
            conn.commit()


# ---------------------------------------------------------------------------
# Scanner
# ---------------------------------------------------------------------------

class CastellanScanner:
    def __init__(self, index: CastellanIndex):
        self.index = index
        self._systemd_services: Optional[set] = None

    def _get_systemd_service_paths(self) -> set:
        """Return set of directory paths that have a running systemd service."""
        if self._systemd_services is not None:
            return self._systemd_services
        paths = set()
        try:
            result = subprocess.run(
                ["systemctl", "--user", "list-units", "--type=service",
                 "--state=running", "--no-pager", "--plain"],
                capture_output=True, text=True, timeout=10
            )
            for line in result.stdout.splitlines():
                parts = line.split()
                if not parts:
                    continue
                unit = parts[0]
                if not unit.endswith(".service"):
                    continue
                # Try to find the WorkingDirectory or ExecStart path
                try:
                    show = subprocess.run(
                        ["systemctl", "--user", "show", unit,
                         "--property=WorkingDirectory,ExecStart"],
                        capture_output=True, text=True, timeout=5
                    )
                    for prop_line in show.stdout.splitlines():
                        if prop_line.startswith("WorkingDirectory="):
                            wd = prop_line.split("=", 1)[1].strip()
                            if wd:
                                paths.add(wd)
                except Exception:
                    pass
        except Exception:
            pass
        self._systemd_services = paths
        return paths

    def _has_running_service(self, path: Path) -> bool:
        """Check if any running systemd service is rooted under this path."""
        service_paths = self._get_systemd_service_paths()
        path_str = str(path)
        return any(
            sp == path_str or sp.startswith(path_str + "/")
            for sp in service_paths
        )

    def _is_empty(self, path: Path) -> bool:
        """True if directory has no files at all."""
        try:
            return not any(True for _ in path.rglob("*"))
        except PermissionError:
            return False

    def _last_mtime(self, path: Path) -> Optional[datetime]:
        """Return the most recent mtime of any file under path (shallow, ignores SKIP_DIRS)."""
        latest = None
        try:
            for entry in path.iterdir():
                if entry.name in SKIP_DIRS:
                    continue
                if entry.is_file():
                    mtime = datetime.fromtimestamp(entry.stat().st_mtime)
                    if latest is None or mtime > latest:
                        latest = mtime
                elif entry.is_dir():
                    sub = self._last_mtime(entry)
                    if sub and (latest is None or sub > latest):
                        latest = sub
        except PermissionError:
            pass
        return latest

    def _days_since_mtime(self, path: Path) -> Optional[int]:
        mtime = self._last_mtime(path)
        if mtime is None:
            return None
        return (datetime.now() - mtime).days

    def _last_git_commit_days(self, path: Path) -> Optional[int]:
        """Days since last git commit touching anything under path. None if no git."""
        try:
            result = subprocess.run(
                ["git", "log", "--oneline", "-1",
                 f"--since={STALENESS_DAYS + 1} days ago", "--", str(path)],
                capture_output=True, text=True, timeout=15,
                cwd=path if path.is_dir() else path.parent
            )
            # If output is empty, no commit in that window — check when the last one was
            if not result.stdout.strip():
                # Get the actual last commit date
                result2 = subprocess.run(
                    ["git", "log", "--format=%ct", "-1", "--", str(path)],
                    capture_output=True, text=True, timeout=15,
                    cwd=path if path.is_dir() else path.parent
                )
                ts = result2.stdout.strip()
                if not ts:
                    return None  # Path is not tracked by git at all
                last_commit = datetime.fromtimestamp(int(ts))
                return (datetime.now() - last_commit).days
            else:
                # There was a commit within the stale window
                return 0
        except Exception:
            return None

    def _classify_dir(self, path: Path) -> Optional[Tuple[str, str]]:
        """Return (category, reason) or None if the directory seems active."""
        if not path.exists() or not path.is_dir():
            return None

        if self._has_running_service(path):
            return None  # Active service — leave it alone

        # Empty directory → DEMOLISH
        if self._is_empty(path):
            return DEMOLISH, "Empty directory"

        # Temp/scratch heuristics → DEMOLISH
        name_lower = path.name.lower()
        if any(kw in name_lower for kw in ("temp", "tmp", "scratch", "test-", "trial")):
            age = self._days_since_mtime(path)
            if age and age > STALENESS_DAYS:
                return DEMOLISH, f"Scratch/temp dir, last modified {age}d ago"

        # Check git activity first (if the path is inside a git repo)
        git_days = self._last_git_commit_days(path)

        if git_days is not None:
            # Path is tracked by git
            if git_days < STALENESS_DAYS:
                return None  # Active
            reason = f"No git commits in {git_days}d"
            return ARCHIVE, reason

        # No git tracking — fall back to mtime
        age = self._days_since_mtime(path)
        if age is None:
            return REVIEW, "Cannot determine last activity"
        if age < STALENESS_DAYS:
            return None  # Active

        return ARCHIVE, f"No git tracking; last modified {age}d ago"

    def _is_stub_agent(self, path: Path) -> bool:
        """Return True if this looks like a council dir but has no __main__.py."""
        if not (path / "README.md").exists():
            return False
        return not (path / "__main__.py").exists()

    def scan_council_stubs(self) -> List[Tuple[Path, str, str]]:
        """Find council subdirs that exist but have no __main__.py (stub agents)."""
        findings = []
        council_dir = KINGDOM_DIR / "council"
        if not council_dir.exists():
            return findings
        for entry in sorted(council_dir.iterdir()):
            if not entry.is_dir() or entry.name in SKIP_DIRS or entry.name == "shared":
                continue
            if self._is_stub_agent(entry):
                findings.append((entry, REVIEW, "Council stub: no __main__.py"))
        return findings

    def scan_home_dirs(self) -> List[Tuple[Path, str, str]]:
        """Scan top-level subdirs of the configured scan roots."""
        findings = []
        for root in SCAN_ROOTS:
            if not root.exists():
                continue
            try:
                entries = sorted(root.iterdir())
            except PermissionError:
                continue
            for entry in entries:
                if not entry.is_dir() or entry.name in SKIP_DIRS:
                    continue
                result = self._classify_dir(entry)
                if result:
                    findings.append((entry, result[0], result[1]))
        return findings

    def scan_kingdom_dirs(self) -> List[Tuple[Path, str, str]]:
        """Scan top-level dirs inside ~/Kingdom (excluding council, which is handled separately)."""
        findings = []
        skip_top = {"council", "docs", ".git", ".claude", "node_modules"}
        if not KINGDOM_DIR.exists():
            return findings
        for entry in sorted(KINGDOM_DIR.iterdir()):
            if not entry.is_dir() or entry.name in skip_top or entry.name in SKIP_DIRS:
                continue
            result = self._classify_dir(entry)
            if result:
                findings.append((entry, result[0], result[1]))
        return findings

    def run_scan(self) -> List[Dict]:
        """Full scan — home dirs + kingdom dirs + council stubs. Persist to DB."""
        all_findings: List[Tuple[Path, str, str]] = []
        all_findings.extend(self.scan_home_dirs())
        all_findings.extend(self.scan_kingdom_dirs())
        all_findings.extend(self.scan_council_stubs())

        for path, category, reason in all_findings:
            self.index.upsert_finding(str(path), category, reason)

        return self.index.get_open_findings()


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def _shorten(path: str) -> str:
    """Replace home prefix with ~."""
    home = str(HOME)
    if path.startswith(home):
        return "~" + path[len(home):]
    return path


def generate_report(findings: List[Dict]) -> str:
    by_category: Dict[str, List[Dict]] = {DEMOLISH: [], ARCHIVE: [], REVIEW: []}
    for f in findings:
        cat = f["category"]
        if cat in by_category:
            by_category[cat].append(f)

    lines = ["🏰 The Castellan — Castle Inspection", ""]

    for cat in [DEMOLISH, ARCHIVE, REVIEW]:
        items = by_category[cat]
        lines.append(f"{cat} ({len(items)})")
        for item in items[:5]:  # max 5 per category to stay within 15 lines
            short = _shorten(item["path"])
            lines.append(f"  · {short} — {item['reason']}")
        if len(items) > 5:
            lines.append(f"  · …and {len(items) - 5} more")
        lines.append("")

    total = sum(len(v) for v in by_category.values())
    if total == 0:
        lines.append("No abandoned wings found. The castle is in good order.")
    else:
        lines.append("Run `python3 -m council.the-castellan scan` for full report.")

    return "\n".join(lines)


def generate_brief(findings: List[Dict]) -> str:
    by_cat = {DEMOLISH: 0, ARCHIVE: 0, REVIEW: 0}
    for f in findings:
        if f["category"] in by_cat:
            by_cat[f["category"]] += 1
    total = sum(by_cat.values())
    if total == 0:
        return "Castellan: castle clean, no abandoned wings."
    parts = [f"{v} {k.lower()}" for k, v in by_cat.items() if v > 0]
    return "Castellan: " + ", ".join(parts) + " — run `scan` for details."


# ---------------------------------------------------------------------------
# Execute — archive, demolish, and clean stubs
# ---------------------------------------------------------------------------

def _write_revert_report(actions: List[Dict]) -> Path:
    """Write a markdown report documenting every action and how to revert it."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    report_path = REPORTS_DIR / f"{stamp}_execute.md"

    lines = [
        f"# Castellan Execute Report",
        f"",
        f"**Run at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"",
        f"This file documents every action taken and how to revert.",
        f"",
        f"## Actions",
        f"",
    ]

    for a in actions:
        lines.append(f"### `{_shorten(a['path'])}`")
        lines.append(f"- **Action:** {a['action']}")
        lines.append(f"- **Reason:** {a['reason']}")
        if a.get("destination"):
            lines.append(f"- **Moved to:** `{_shorten(a['destination'])}`")
            lines.append(f"- **Revert:** `mv {_shorten(a['destination'])} {_shorten(a['path'])}`")
        elif a["action"] == "deleted empty directory":
            lines.append(f"- **Revert:** `mkdir -p {_shorten(a['path'])}`")
        lines.append("")

    report_path.write_text("\n".join(lines))
    return report_path


def execute_findings(index: CastellanIndex, findings: List[Dict], dry_run: bool = False) -> Tuple[List[Dict], str]:
    """
    Execute open findings:
      DEMOLISH  → rmdir (only if still empty)
      ARCHIVE   → move to ~/Archive/
      REVIEW    → delete if still an empty stub (no files except README.md)
    Returns (actions_taken, report_path).
    """
    ARCHIVE_DIR.mkdir(exist_ok=True)

    actions = []
    skipped = []

    for f in findings:
        path = Path(f["path"])
        cat = f["category"]

        if not path.exists():
            skipped.append(f"{_shorten(str(path))} — already gone")
            index.resolve(str(path), "already_gone")
            continue

        if cat == DEMOLISH:
            # Only act if still empty
            try:
                contents = list(path.iterdir())
            except PermissionError:
                skipped.append(f"{_shorten(str(path))} — permission denied")
                continue
            if contents:
                skipped.append(f"{_shorten(str(path))} — no longer empty, skipping")
                continue
            actions.append({"path": str(path), "action": "deleted empty directory",
                            "reason": f["reason"], "destination": None})
            if not dry_run:
                path.rmdir()
                index.resolve(str(path), "demolished")

        elif cat == ARCHIVE:
            dest = ARCHIVE_DIR / path.name
            # Avoid collisions
            if dest.exists():
                dest = ARCHIVE_DIR / f"{path.name}_{datetime.now().strftime('%Y%m%d')}"
            actions.append({"path": str(path), "action": "moved to Archive",
                            "reason": f["reason"], "destination": str(dest)})
            if not dry_run:
                shutil.move(str(path), str(dest))
                index.resolve(str(path), "archived")

        elif cat == REVIEW:
            # Only demolish council stubs if they contain only README.md (empty stubs)
            try:
                contents = [e.name for e in path.iterdir()]
            except PermissionError:
                skipped.append(f"{_shorten(str(path))} — permission denied")
                continue
            meaningful = [c for c in contents if c not in {"README.md", "__init__.py", ".git"}]
            if meaningful:
                skipped.append(f"{_shorten(str(path))} — has files ({', '.join(meaningful[:3])}), skipping")
                continue
            actions.append({"path": str(path), "action": "deleted empty council stub",
                            "reason": f["reason"], "destination": None})
            if not dry_run:
                shutil.rmtree(str(path))
                index.resolve(str(path), "demolished")

    return actions, skipped


def generate_execute_summary(actions: List[Dict], skipped: List[str], report_path: Optional[Path], dry_run: bool) -> str:
    prefix = "🏰 *The Castellan — Execute Report*" if not dry_run else "🏰 *The Castellan — Dry Run Preview*"
    lines = [prefix, ""]

    if not actions and not skipped:
        lines.append("Nothing to do — no open findings.")
        return "\n".join(lines)

    if actions:
        lines.append(f"*{len(actions)} action{'s' if len(actions) != 1 else ''} taken:*")
        for a in actions:
            icon = "🗑" if "deleted" in a["action"] else "📦"
            lines.append(f"  {icon} `{_shorten(a['path'])}` → {a['action']}")
        lines.append("")

    if skipped:
        lines.append(f"*{len(skipped)} skipped:*")
        for s in skipped[:5]:
            lines.append(f"  ⏭ {s}")
        if len(skipped) > 5:
            lines.append(f"  …and {len(skipped) - 5} more")
        lines.append("")

    if report_path and not dry_run:
        lines.append(f"📄 Revert guide: `{_shorten(str(report_path))}`")

    return "\n".join(lines)


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


def send_telegram(text: str):
    token, chat_id = _telegram_creds()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        requests.post(
            url,
            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
            timeout=10,
        )
    except Exception as e:
        print(f"Failed to send Telegram: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    index = CastellanIndex()
    scanner = CastellanScanner(index)

    command = sys.argv[1] if len(sys.argv) > 1 else "scan"

    if command == "scan":
        print("Scanning for abandoned wings…")
        findings = scanner.run_scan()
        print(generate_report(findings))

    elif command == "report":
        findings = scanner.run_scan()
        msg = generate_report(findings)
        send_telegram(msg)
        print("Report sent to Telegram.")

    elif command == "brief":
        findings = index.get_open_findings()
        print(generate_brief(findings))

    elif command == "db":
        print(f"Database: {DB_PATH}")
        with sqlite3.connect(DB_PATH) as conn:
            count = conn.execute("SELECT count(*) FROM findings WHERE status='open'").fetchone()[0]
            total = conn.execute("SELECT count(*) FROM findings").fetchone()[0]
        print(f"Open findings: {count} / Total: {total}")

    elif command == "dismiss":
        if len(sys.argv) < 3:
            print("Usage: dismiss <path>", file=sys.stderr)
            sys.exit(1)
        path = sys.argv[2]
        index.dismiss(path)
        print(f"Dismissed: {path}")

    elif command in ("execute", "dry-run"):
        dry_run = command == "dry-run"
        findings = index.get_open_findings()
        if not findings:
            print("No open findings. Run `scan` first.")
            sys.exit(0)

        actions, skipped = execute_findings(index, findings, dry_run=dry_run)

        report_path = None
        if actions and not dry_run:
            report_path = _write_revert_report(actions)

        summary = generate_execute_summary(actions, skipped, report_path, dry_run)
        print(summary)

        if not dry_run and actions:
            send_telegram(summary)
            print(f"\nTelegram notification sent.")
            if report_path:
                print(f"Revert guide written to: {report_path}")

    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print("Commands: scan | report | brief | db | execute | dry-run | dismiss <path>", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
