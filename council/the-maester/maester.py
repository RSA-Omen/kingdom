"""The Maester — institutional memory for the kingdom.

Scans the realm, indexes projects and repos, answers questions about what exists.

Usage:
    python -m council.the-maester scan                   # run the daily scan
    python -m council.the-maester index                  # dump full index (JSON)
    python -m council.the-maester brief                  # markdown brief of what's new
    python -m council.the-maester telegram               # post brief to Telegram
    python -m council.the-maester ask <question>         # ask a question (v1+)
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import os
import subprocess
import sys
import sqlite3
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

HOME = Path.home()
KINGDOM_DIR = Path(os.environ.get("KINGDOM_DIR", HOME / "Kingdom"))
INDEX_DB = Path(os.environ.get("MAESTER_INDEX", HOME / ".maester-index.db"))
SCAN_INTERVAL_DAYS = 1
STALE_THRESHOLD_DAYS = 30
TELEGRAM_ENV_FALLBACK = HOME / "telegram_notify_service" / ".env"

# Projects to skip during scan
SKIP_PATTERNS = {".git", ".venv", "node_modules", "__pycache__", ".next", ".env", "venv"}

# ─────────────────────────────────────────────────────────────────────────────


@dataclasses.dataclass
class Project:
    """A project (repo, app, script, or data folder)."""
    path: str
    name: str
    project_type: str  # 'app', 'lib', 'config', 'script', 'data', 'service'
    purpose: str  # parsed from README or directory name
    last_scanned: str  # ISO date
    last_activity: Optional[str]  # ISO date (last commit or file modification)

    def to_dict(self) -> dict:
        return {
            'path': self.path,
            'name': self.name,
            'type': self.project_type,
            'purpose': self.purpose,
            'last_scanned': self.last_scanned,
            'last_activity': self.last_activity,
        }


@dataclasses.dataclass
class Repo:
    """A git repository."""
    path: str
    git_url: Optional[str]
    default_branch: str
    last_commit_date: Optional[str]  # ISO date
    last_commit_hash: Optional[str]
    latest_tag: Optional[str]

    def to_dict(self) -> dict:
        return {
            'path': self.path,
            'git_url': self.git_url,
            'default_branch': self.default_branch,
            'last_commit_date': self.last_commit_date,
            'last_commit_hash': self.last_commit_hash,
            'latest_tag': self.latest_tag,
        }


class MaesterIndex:
    """SQLite-backed index of the realm."""

    def __init__(self, db_path: Path = INDEX_DB):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Create tables if they don't exist."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS projects (
                    path TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    purpose TEXT,
                    last_scanned TEXT NOT NULL,
                    last_activity TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS repos (
                    path TEXT PRIMARY KEY,
                    git_url TEXT,
                    default_branch TEXT,
                    last_commit_date TEXT,
                    last_commit_hash TEXT,
                    latest_tag TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS recent_commits (
                    id INTEGER PRIMARY KEY,
                    repo_path TEXT NOT NULL,
                    commit_hash TEXT NOT NULL,
                    commit_date TEXT NOT NULL,
                    author TEXT,
                    message TEXT,
                    UNIQUE(repo_path, commit_hash)
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    project_count INTEGER,
                    repo_count INTEGER,
                    summary TEXT
                )
            ''')
            conn.commit()

    def save_project(self, project: Project):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT OR REPLACE INTO projects
                (path, name, type, purpose, last_scanned, last_activity)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (project.path, project.name, project.project_type,
                  project.purpose, project.last_scanned, project.last_activity))
            conn.commit()

    def save_repo(self, repo: Repo):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT OR REPLACE INTO repos
                (path, git_url, default_branch, last_commit_date,
                 last_commit_hash, latest_tag)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (repo.path, repo.git_url, repo.default_branch,
                  repo.last_commit_date, repo.last_commit_hash, repo.latest_tag))
            conn.commit()

    def get_all_projects(self) -> list[Project]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute('SELECT * FROM projects ORDER BY path').fetchall()
        return [Project(*row) for row in rows]

    def get_all_repos(self) -> list[Repo]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute('SELECT * FROM repos ORDER BY path').fetchall()
        return [Repo(*row) for row in rows]

    def add_recent_commit(self, repo_path: str, commit: dict):
        """Add a commit to recent_commits table."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT OR REPLACE INTO recent_commits
                (repo_path, commit_hash, commit_date, author, message)
                VALUES (?, ?, ?, ?, ?)
            ''', (repo_path, commit.get('hash'), commit.get('date'),
                  commit.get('author'), commit.get('message')))
            conn.commit()

    def get_recent_commits(self, since_hours: int = 24) -> list[dict]:
        """Get commits from the last N hours."""
        since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=since_hours)
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute('''
                SELECT repo_path, commit_hash, commit_date, author, message
                FROM recent_commits
                WHERE commit_date > ?
                ORDER BY commit_date DESC
            ''', (since.isoformat(),)).fetchall()
        return [
            {
                'repo_path': r[0],
                'hash': r[1],
                'date': r[2],
                'author': r[3],
                'message': r[4],
            }
            for r in rows
        ]

    def save_snapshot(self, summary: str, project_count: int, repo_count: int):
        """Save a scan snapshot."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT INTO snapshots (timestamp, project_count, repo_count, summary)
                VALUES (?, ?, ?, ?)
            ''', (dt.datetime.now(dt.timezone.utc).isoformat(),
                  project_count, repo_count, summary))
            conn.commit()


class RealmScanner:
    """Scans the home directory to discover projects and repos."""

    def __init__(self, start_path: Path = HOME, index: Optional[MaesterIndex] = None):
        self.start_path = start_path
        self.index = index or MaesterIndex()

    def scan(self) -> tuple[list[Project], list[Repo]]:
        """Scan the realm and return discovered projects and repos."""
        projects = []
        repos = []
        now = dt.date.today().isoformat()

        for item in self._walk_safe(self.start_path, max_depth=3):
            if not item.is_dir():
                continue

            # Check if it's a git repo
            if (item / ".git").exists():
                repo = self._analyze_repo(item)
                if repo:
                    repos.append(repo)
                    self.index.save_repo(repo)

            # Check if it's a project (has README or is a known project type)
            if self._is_project(item):
                purpose = self._extract_purpose(item)
                project_type = self._classify_project(item)
                last_activity = self._get_last_activity(item)

                project = Project(
                    path=str(item),
                    name=item.name,
                    project_type=project_type,
                    purpose=purpose,
                    last_scanned=now,
                    last_activity=last_activity,
                )
                projects.append(project)
                self.index.save_project(project)

        return projects, repos

    def _walk_safe(self, path: Path, max_depth: int = 3, current_depth: int = 0):
        """Safe walk that skips hidden/expensive directories."""
        if current_depth >= max_depth:
            return

        try:
            for item in path.iterdir():
                if item.name.startswith('.') or item.name in SKIP_PATTERNS:
                    continue
                yield item
                if item.is_dir():
                    yield from self._walk_safe(item, max_depth, current_depth + 1)
        except (PermissionError, OSError):
            pass

    def _is_project(self, path: Path) -> bool:
        """Check if directory looks like a project."""
        has_readme = any(f.exists() for f in [
            path / "README.md",
            path / "readme.md",
            path / "Readme.md",
        ])
        has_src = any(f.exists() for f in [
            path / "src",
            path / "lib",
            path / "api",
            path / "app",
        ])
        return has_readme or has_src or (path / ".git").exists()

    def _classify_project(self, path: Path) -> str:
        """Guess project type from structure."""
        if (path / "src" / "main").exists() or (path / "main.py").exists():
            return "app"
        if (path / "lib").exists() or (path / "src" / "lib").exists():
            return "lib"
        if (path / "app.py").exists() or (path / "index.ts").exists():
            return "app"
        if (path / "docker-compose.yml").exists():
            return "service"
        return "project"

    def _extract_purpose(self, path: Path) -> str:
        """Extract purpose from README or directory name."""
        readme_files = [
            path / "README.md",
            path / "readme.md",
            path / "Readme.md",
        ]

        for readme in readme_files:
            if readme.exists():
                try:
                    content = readme.read_text(errors='ignore')
                    # Get first non-empty line after title
                    lines = content.split('\n')
                    for line in lines[1:]:
                        if line.strip() and not line.startswith('#'):
                            return line.strip()[:100]
                except Exception:
                    pass

        return f"Project at {path.name}"

    def _analyze_repo(self, path: Path) -> Optional[Repo]:
        """Analyze a git repository."""
        try:
            # Get origin URL
            result = subprocess.run(
                ["git", "config", "--get", "remote.origin.url"],
                cwd=path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            git_url = result.stdout.strip() if result.returncode == 0 else None

            # Get current branch
            result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            default_branch = result.stdout.strip() if result.returncode == 0 else "main"

            # Get last commit
            result = subprocess.run(
                ["git", "log", "-1", "--format=%ai|%H|%an"],
                cwd=path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            last_commit_date = None
            last_commit_hash = None
            if result.returncode == 0 and result.stdout.strip():
                parts = result.stdout.strip().split('|')
                last_commit_date = parts[0][:10]  # ISO date
                last_commit_hash = parts[1]

            # Get latest tag
            result = subprocess.run(
                ["git", "describe", "--tags", "--abbrev=0"],
                cwd=path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            latest_tag = result.stdout.strip() if result.returncode == 0 else None

            # Fetch recent commits for index
            result = subprocess.run(
                ["git", "log", "--pretty=format:%H|%ai|%an|%s", "-20"],
                cwd=path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line:
                        parts = line.split('|', 3)
                        self.index.add_recent_commit(str(path), {
                            'hash': parts[0],
                            'date': parts[1][:10],
                            'author': parts[2] if len(parts) > 2 else 'unknown',
                            'message': parts[3] if len(parts) > 3 else '',
                        })

            return Repo(
                path=str(path),
                git_url=git_url,
                default_branch=default_branch,
                last_commit_date=last_commit_date,
                last_commit_hash=last_commit_hash,
                latest_tag=latest_tag,
            )
        except Exception as e:
            print(f"Warning: failed to analyze {path}: {e}", file=sys.stderr)
            return None

    def _get_last_activity(self, path: Path) -> Optional[str]:
        """Get last modification date from filesystem."""
        try:
            mtime = max(
                (f.stat().st_mtime for f in path.rglob("*") if f.is_file()),
                default=None
            )
            if mtime:
                return dt.datetime.fromtimestamp(mtime).date().isoformat()
        except Exception:
            pass
        return None


def brief(index: MaesterIndex) -> str:
    """Generate a markdown brief of what's new."""
    lines = ["# The Maester's Brief", ""]

    # Recent activity
    recent = index.get_recent_commits(since_hours=24)
    if recent:
        lines.append("## 🆕 New Work (Last 24h)")
        lines.append("")
        by_repo = {}
        for commit in recent:
            repo = commit['repo_path'].split('/')[-1]
            if repo not in by_repo:
                by_repo[repo] = []
            by_repo[repo].append(commit)

        for repo, commits in sorted(by_repo.items()):
            lines.append(f"### {repo}")
            for c in commits[:3]:  # Show top 3 per repo
                lines.append(f"- {c['message'][:60]} ({c['author']})")
            if len(commits) > 3:
                lines.append(f"- ... and {len(commits) - 3} more")
            lines.append("")
    else:
        lines.append("## The realm is quiet.")
        lines.append("")

    # Stale repos
    projects = index.get_all_projects()
    stale = [
        p for p in projects
        if p.last_activity and (
            dt.date.fromisoformat(p.last_activity) <
            dt.date.today() - dt.timedelta(days=STALE_THRESHOLD_DAYS)
        )
    ]

    if stale:
        lines.append("## 😴 Stale (>30 days)")
        lines.append("")
        for p in sorted(stale, key=lambda x: x.last_activity or ""):
            days_ago = (dt.date.today() - dt.date.fromisoformat(p.last_activity)).days
            lines.append(f"- {p.name}: {days_ago} days ago")
        lines.append("")

    lines.append(f"---")
    lines.append(f"Realm index: {len(projects)} projects, {len([p for p in projects if p.project_type == 'app'])} apps")
    lines.append(f"Scanned: {dt.datetime.now(dt.timezone.utc).isoformat()}")

    return "\n".join(lines)


def index_to_json(index: MaesterIndex) -> dict:
    """Export full index as JSON."""
    projects = index.get_all_projects()
    repos = index.get_all_repos()

    return {
        'timestamp': dt.datetime.now(dt.timezone.utc).isoformat(),
        'projects': [p.to_dict() for p in projects],
        'repos': [r.to_dict() for r in repos],
        'summary': {
            'total_projects': len(projects),
            'total_repos': len(repos),
            'stale_count': sum(1 for p in projects if p.last_activity and (
                dt.date.fromisoformat(p.last_activity) <
                dt.date.today() - dt.timedelta(days=STALE_THRESHOLD_DAYS)
            )),
        }
    }


def ask_maester(index: MaesterIndex, question: str) -> str:
    """Answer a question about the realm."""
    projects = index.get_all_projects()
    repos = index.get_all_repos()
    q = question.lower().strip()

    # "What apps do we have?"
    if any(word in q for word in ["apps", "applications", "what do we have", "services"]):
        apps = [p for p in projects if p.project_type == 'app']
        if not apps:
            return "No apps found in the realm."
        lines = ["**Apps in the realm:**", ""]
        for app in apps:
            status = "🟢" if app.last_activity and (
                dt.date.fromisoformat(app.last_activity) >= dt.date.today() - dt.timedelta(days=7)
            ) else "🔴"
            lines.append(f"{status} {app.name} — {app.purpose[:60]}")
        return "\n".join(lines)

    # "What's new?" or "What changed?"
    if any(word in q for word in ["new", "changed", "recent", "latest"]):
        commits = index.get_recent_commits(since_hours=24)
        if not commits:
            return "The realm is quiet. No changes in the last 24 hours."
        lines = ["**New work (last 24h):**", ""]
        by_repo = {}
        for c in commits:
            repo = c['repo_path'].split('/')[-1]
            if repo not in by_repo:
                by_repo[repo] = []
            by_repo[repo].append(c)
        for repo, commits_list in sorted(by_repo.items())[:5]:
            lines.append(f"**{repo}**")
            for c in commits_list[:2]:
                lines.append(f"- {c['message'][:60]} ({c['author']})")
        return "\n".join(lines)

    # "What's stale?" or "What's old?"
    if any(word in q for word in ["stale", "old", "dusty", "untouched"]):
        stale = [
            p for p in projects
            if p.last_activity and (
                dt.date.fromisoformat(p.last_activity) <
                dt.date.today() - dt.timedelta(days=STALE_THRESHOLD_DAYS)
            )
        ]
        if not stale:
            return "No stale projects. The realm is active."
        lines = [f"**{len(stale)} stale projects (>30 days):**", ""]
        for p in sorted(stale, key=lambda x: x.last_activity or "")[:10]:
            days = (dt.date.today() - dt.date.fromisoformat(p.last_activity)).days
            lines.append(f"- {p.name}: {days} days ago")
        return "\n".join(lines)

    # "How many projects?"
    if any(word in q for word in ["how many", "count", "total"]):
        by_type = {}
        for p in projects:
            by_type[p.project_type] = by_type.get(p.project_type, 0) + 1
        lines = [f"**Realm inventory:**", ""]
        lines.append(f"- Total projects: {len(projects)}")
        lines.append(f"- Total repos: {len(repos)}")
        for ptype, count in sorted(by_type.items()):
            lines.append(f"- {ptype.capitalize()}s: {count}")
        return "\n".join(lines)

    # Default: search by name
    found = [p for p in projects if question.lower() in p.name.lower()]
    if found:
        lines = [f"**Found {len(found)} project(s):**", ""]
        for p in found:
            lines.append(f"**{p.name}** ({p.project_type})")
            lines.append(f"- Purpose: {p.purpose[:80]}")
            lines.append(f"- Path: `{p.path}`")
            if p.last_activity:
                lines.append(f"- Last active: {p.last_activity}")
            lines.append("")
        return "\n".join(lines)

    return f"I don't understand '{question}'. Try asking: 'What apps?', 'What's new?', 'What's stale?', or just a project name."


def _read_dotenv(path: Path) -> dict:
    """Read a simple .env file."""
    result = {}
    if path.exists():
        for line in path.read_text().split('\n'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                k, v = line.split('=', 1)
                result[k.strip()] = v.strip().strip('"\'')
    return result


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
    """Post a message to Telegram. Returns API response."""
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


def main():
    parser = argparse.ArgumentParser(
        description="The Maester — institutional memory for the kingdom"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command")

    subparsers.add_parser("scan", help="Run the daily scan")
    subparsers.add_parser("index", help="Dump full index (JSON)")
    subparsers.add_parser("brief", help="Print markdown brief")
    subparsers.add_parser("telegram", help="Post brief to Telegram")

    ask_parser = subparsers.add_parser("ask", help="Ask The Maester a question")
    ask_parser.add_argument("question", help="Your question")

    db_parser = subparsers.add_parser("db", help="Raw SQL query")
    db_parser.add_argument("query", help="SQL query")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    index = MaesterIndex()

    if args.command == "scan":
        scanner = RealmScanner(start_path=HOME, index=index)
        projects, repos = scanner.scan()
        summary = f"Found {len(projects)} projects, {len(repos)} repos"
        index.save_snapshot(summary, len(projects), len(repos))
        print(f"✓ Scan complete: {summary}")
        print(brief(index))

    elif args.command == "index":
        data = index_to_json(index)
        print(json.dumps(data, indent=2))

    elif args.command == "brief":
        print(brief(index))

    elif args.command == "telegram":
        try:
            msg = brief(index)
            result = send_telegram(msg)
        except Exception as e:
            print(f"Telegram delivery failed: {e}", file=sys.stderr)
            sys.exit(2)
        if not result.get("ok"):
            print(f"Telegram API returned: {result}", file=sys.stderr)
            sys.exit(3)
        print(f"Brief delivered (message_id={result.get('result', {}).get('message_id')})")

    elif args.command == "ask":
        answer = ask_maester(index, args.question)
        print(answer)

    elif args.command == "db":
        with sqlite3.connect(index.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(args.query).fetchall()
            for row in rows:
                print(dict(row))


if __name__ == "__main__":
    main()
