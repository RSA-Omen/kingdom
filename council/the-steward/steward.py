"""The Steward — day-to-day operations across every village.

Health-checks each service, surfaces alerts, builds status reports.
Also audits dependency vulnerabilities across all known components.

Usage:
    python -m council.the-steward check                  # run health + dependency checks
    python -m council.the-steward status                 # show current status (JSON)
    python -m council.the-steward incidents              # show today's incidents
    python -m council.the-steward report                 # generate daily report
    python -m council.the-steward telegram               # post report to Telegram
    python -m council.the-steward deps                   # dependency audit only
    python -m council.the-steward fix                    # auto-fix vulns + redeploy
    python -m council.the-steward fix --component NAME   # fix one component only
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import os
import sqlite3
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parents[1]))
from shared.issue import open_issue  # noqa: E402

HOME = Path.home()
KINGDOM_DIR = Path(os.environ.get("KINGDOM_DIR", HOME / "Kingdom"))
HEALTH_DB = Path(os.environ.get("STEWARD_HEALTH_DB", HOME / ".steward-health.db"))
TELEGRAM_ENV_FALLBACK = HOME / "telegram_notify_service" / ".env"

# Known villages and their health endpoints — single source of truth.
# Drives Telegram alerts, /villages page, "Systems" hexagon, Master of Works card.
# Changelog:
#   2026-05-14: removed Kanban-AI, n8n (retired).
#   2026-05-14: added Interceptor AU (L01) + ZA (L02), split from single interceptor-app.
#   2026-05-14: added PDF Removal API + Web. Local API kept pending review.
VILLAGES = {
    "Gekko Tracks": "http://localhost:8002/health",
    "Admin Center API": "http://localhost:5001/health",
    "Open WebUI": "http://localhost:3005/health",
    "Local API": "http://localhost:8080/health",
    "Interceptor AU": "http://localhost:8001/health",
    "Interceptor ZA": "http://localhost:8004/health",
    "PDF Removal API": "http://localhost:5007/api/health",
    "PDF Removal Web": "http://localhost:3007/",
}

# npm projects to audit for dependency vulnerabilities
COMPONENTS = {
    "Admin Center Backend": HOME / "admin-center/backend",
    "Admin Center Frontend": HOME / "admin-center/frontend",
    "Admin Center MCP Server": HOME / "admin-center/mcp-server",
    "Kingdom Dashboard": KINGDOM_DIR / "capital/dashboard",
}

# Maps component name → village slug (must match github-repos.json)
COMPONENT_VILLAGE = {
    "Admin Center Backend": "admin-center",
    "Admin Center Frontend": "admin-center",
    "Admin Center MCP Server": "admin-center",
    "Kingdom Dashboard": "kingdom",
}

# Fix config: how to fix, verify, and redeploy each component
COMPONENT_FIX_CONFIG = {
    "Admin Center Backend": {
        "git_root": HOME / "admin-center",
        "subdir": "backend",
        "build_cmd": ["npm", "run", "build"],
        "github_repo": "RSA-Omen/Admin-Center",
        "docker_compose_dir": HOME / "admin-center",
        "docker_service": "admin-center-backend",
    },
    "Admin Center Frontend": {
        "git_root": HOME / "admin-center",
        "subdir": "frontend",
        "build_cmd": ["npm", "run", "build"],
        "github_repo": "RSA-Omen/Admin-Center",
        "docker_compose_dir": HOME / "admin-center",
        "docker_service": "admin-center-frontend",
    },
    "Admin Center MCP Server": {
        "git_root": HOME / "admin-center",
        "subdir": "mcp-server",
        "build_cmd": None,
        "github_repo": "RSA-Omen/Admin-Center",
        "docker_compose_dir": None,
        "docker_service": None,
    },
    "Kingdom Dashboard": {
        "git_root": KINGDOM_DIR,
        "subdir": "capital/dashboard",
        "build_cmd": ["npm", "run", "build"],
        "github_repo": "RSA-Omen/kingdom",
        "docker_compose_dir": None,
        "docker_service": None,
    },
}

# Known upstream blockers — vulns we're waiting on a package release to fix.
# When blocking_package reaches min_version on npm, the Steward auto-runs fix
# on the affected components and closes the tracking issue.
UPSTREAM_BLOCKERS = [
    {
        "id": "postcss-next-xss",
        "description": "PostCSS XSS inside Next.js (GHSA-qx2v-qp2m-jg93)",
        "blocking_package": "next",
        "min_version": "16.3.0",
        "affected_components": ["Admin Center Frontend", "Kingdom Dashboard"],
        "advisory": "https://github.com/advisories/GHSA-qx2v-qp2m-jg93",
        "github_issues": {
            "admin-center": 3,
            "kingdom": 27,
        },
    },
]

# Action-only Telegram alerts (added 2026-05-14, see OPERATOR_DUTIES.md #1)
FAILURE_THRESHOLD = 3  # consecutive failed /health checks before alerting
FAILING_STATUSES = {"unhealthy", "unreachable"}

# ─────────────────────────────────────────────────────────────────────────────


@dataclasses.dataclass
class HealthSnapshot:
    service_name: str
    service_url: str
    timestamp: str
    status: str  # healthy, degraded, unhealthy, unreachable
    response_time_ms: Optional[int]
    details: Optional[str]

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)


@dataclasses.dataclass
class ServiceStatus:
    name: str
    url: str
    status: str
    last_check: Optional[str]
    uptime_percent_24h: float
    last_incident: Optional[str]


@dataclasses.dataclass
class DependencyAudit:
    component_name: str
    component_path: str
    timestamp: str
    critical: int
    high: int
    moderate: int
    low: int
    total: int
    error: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────


class StewardIndex:
    """SQLite-backed health and dependency index."""

    def __init__(self, db_path: Path = HEALTH_DB):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS services (
                    name TEXT PRIMARY KEY,
                    url TEXT NOT NULL,
                    criticality TEXT DEFAULT 'normal',
                    last_checked TEXT,
                    current_status TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS health_snapshots (
                    id INTEGER PRIMARY KEY,
                    service_name TEXT NOT NULL,
                    service_url TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    status TEXT NOT NULL,
                    response_time_ms INTEGER,
                    details TEXT,
                    FOREIGN KEY(service_name) REFERENCES services(name)
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS incidents (
                    id INTEGER PRIMARY KEY,
                    service_name TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    root_cause TEXT,
                    mttr_seconds INTEGER,
                    FOREIGN KEY(service_name) REFERENCES services(name)
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS dependency_audits (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    component_name TEXT NOT NULL,
                    component_path TEXT NOT NULL,
                    critical INTEGER DEFAULT 0,
                    high INTEGER DEFAULT 0,
                    moderate INTEGER DEFAULT 0,
                    low INTEGER DEFAULT 0,
                    total INTEGER DEFAULT 0,
                    error TEXT
                )
            ''')
            conn.commit()

    # ── Health ──

    def add_or_update_service(self, name: str, url: str, criticality: str = "normal"):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT OR REPLACE INTO services (name, url, criticality)
                VALUES (?, ?, ?)
            ''', (name, url, criticality))
            conn.commit()

    def record_snapshot(self, snapshot: HealthSnapshot):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT INTO health_snapshots
                (service_name, service_url, timestamp, status, response_time_ms, details)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (snapshot.service_name, snapshot.service_url, snapshot.timestamp,
                  snapshot.status, snapshot.response_time_ms, snapshot.details))
            conn.execute('''
                UPDATE services SET current_status = ?, last_checked = ?
                WHERE name = ?
            ''', (snapshot.status, snapshot.timestamp, snapshot.service_name))
            conn.commit()

    def get_all_services(self) -> list[dict]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute('''
                SELECT name, url, criticality, current_status, last_checked
                FROM services ORDER BY name
            ''').fetchall()
        return [
            {'name': r[0], 'url': r[1], 'criticality': r[2], 'status': r[3], 'last_checked': r[4]}
            for r in rows
        ]

    def get_recent_snapshots(self, hours: int = 24) -> list[HealthSnapshot]:
        since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute('''
                SELECT service_name, service_url, timestamp, status, response_time_ms, details
                FROM health_snapshots
                WHERE timestamp > ?
                ORDER BY timestamp DESC
            ''', (since.isoformat(),)).fetchall()
        return [HealthSnapshot(*row) for row in rows]

    def get_service_status(self, name: str) -> Optional[ServiceStatus]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute('''
                SELECT name, url, current_status, last_checked
                FROM services WHERE name = ?
            ''', (name,)).fetchone()
            if not row:
                return None
            service_name, url, status, last_checked = row

            since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=24)).isoformat()
            snaps = conn.execute('''
                SELECT status FROM health_snapshots
                WHERE service_name = ? AND timestamp > ?
            ''', (name, since)).fetchall()
            uptime = (sum(1 for s in snaps if s[0] == 'healthy') / len(snaps) * 100) if snaps else 100.0

            incident = conn.execute('''
                SELECT start_time FROM incidents
                WHERE service_name = ? AND end_time IS NULL
                ORDER BY start_time DESC LIMIT 1
            ''', (name,)).fetchone()

            return ServiceStatus(
                name=service_name, url=url, status=status or "unknown",
                last_check=last_checked, uptime_percent_24h=uptime,
                last_incident=incident[0] if incident else None,
            )

    # ── Incidents (action-only Telegram path) ──

    def get_recent_snapshot_statuses(self, service_name: str, limit: int = 3) -> list[str]:
        """Latest N snapshot statuses for a service, newest first."""
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute('''
                SELECT status FROM health_snapshots
                WHERE service_name = ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (service_name, limit)).fetchall()
        return [r[0] for r in rows]

    def has_open_incident(self, service_name: str) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute('''
                SELECT id FROM incidents
                WHERE service_name = ? AND end_time IS NULL
                LIMIT 1
            ''', (service_name,)).fetchone()
        return row is not None

    def open_incident(self, service_name: str, start_time: str) -> int:
        with sqlite3.connect(self.db_path) as conn:
            cur = conn.execute('''
                INSERT INTO incidents (service_name, start_time)
                VALUES (?, ?)
            ''', (service_name, start_time))
            conn.commit()
            return cur.lastrowid

    def close_open_incident(self, service_name: str, end_time: str) -> Optional[int]:
        """Close the open incident for a service. Returns mttr_seconds or None."""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute('''
                SELECT id, start_time FROM incidents
                WHERE service_name = ? AND end_time IS NULL
                ORDER BY start_time DESC LIMIT 1
            ''', (service_name,)).fetchone()
            if not row:
                return None
            incident_id, start_time = row
            try:
                start_dt = dt.datetime.fromisoformat(start_time)
                end_dt = dt.datetime.fromisoformat(end_time)
                mttr = int((end_dt - start_dt).total_seconds())
            except Exception:
                mttr = None
            conn.execute('''
                UPDATE incidents SET end_time = ?, mttr_seconds = ?
                WHERE id = ?
            ''', (end_time, mttr, incident_id))
            conn.commit()
            return mttr

    # ── Dependencies ──

    def record_dependency_audit(self, audit: DependencyAudit):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT INTO dependency_audits
                (timestamp, component_name, component_path, critical, high, moderate, low, total, error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (audit.timestamp, audit.component_name, audit.component_path,
                  audit.critical, audit.high, audit.moderate, audit.low, audit.total, audit.error))
            conn.commit()

    def get_latest_dependency_audits(self) -> list[dict]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute('''
                SELECT component_name, component_path, critical, high, moderate, low, total, error, timestamp
                FROM dependency_audits
                WHERE id IN (
                    SELECT MAX(id) FROM dependency_audits GROUP BY component_name
                )
                ORDER BY component_name
            ''').fetchall()
        return [
            {
                'component_name': r[0], 'component_path': r[1],
                'critical': r[2], 'high': r[3], 'moderate': r[4],
                'low': r[5], 'total': r[6], 'error': r[7], 'timestamp': r[8],
            }
            for r in rows
        ]

    def get_previous_dependency_audit(self, component_name: str) -> Optional[dict]:
        """Return the second-most-recent audit for a component (for diffing)."""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute('''
                SELECT critical, high, moderate, low, total, timestamp
                FROM dependency_audits
                WHERE component_name = ?
                ORDER BY timestamp DESC
                LIMIT 1 OFFSET 1
            ''', (component_name,)).fetchone()
        if not row:
            return None
        return {'critical': row[0], 'high': row[1], 'moderate': row[2],
                'low': row[3], 'total': row[4], 'timestamp': row[5]}


# ─────────────────────────────────────────────────────────────────────────────


class StewardHealthChecker:

    def __init__(self, index: Optional[StewardIndex] = None):
        self.index = index or StewardIndex()

    def check_all(self) -> list[HealthSnapshot]:
        for name, url in VILLAGES.items():
            self.index.add_or_update_service(name, url)
        snapshots = [self._check_service(name, url) for name, url in VILLAGES.items()]
        for snap in snapshots:
            self.index.record_snapshot(snap)
        return snapshots

    def _check_service(self, name: str, url: str) -> HealthSnapshot:
        now = dt.datetime.now(dt.timezone.utc).isoformat()
        start = dt.datetime.now()
        try:
            with urllib.request.urlopen(urllib.request.Request(url), timeout=5) as resp:
                elapsed = dt.datetime.now() - start
                try:
                    data = json.loads(resp.read().decode())
                    raw = data.get("status", "healthy")
                    if isinstance(raw, bool):
                        status = "healthy" if raw else "unhealthy"
                    elif raw in ("ok", "OK", "up", "UP"):
                        status = "healthy"
                    else:
                        status = str(raw) if raw is not None else "healthy"
                    details = json.dumps(data) if data else None
                except json.JSONDecodeError:
                    status = "healthy"
                    details = None
                return HealthSnapshot(name, url, now, status,
                                      int(elapsed.total_seconds() * 1000), details)
        except urllib.error.HTTPError as e:
            return HealthSnapshot(name, url, now, "unhealthy", None, f"HTTP {e.code}: {e.reason}")
        except Exception as e:
            return HealthSnapshot(name, url, now, "unreachable", None, str(e)[:100])


class DependencyChecker:

    def __init__(self, index: StewardIndex):
        self.index = index

    def audit_all(self) -> list[DependencyAudit]:
        results = []
        for name, path in COMPONENTS.items():
            result = self._audit_component(name, path)
            results.append(result)
            self.index.record_dependency_audit(result)
        return results

    def _audit_component(self, name: str, path: Path) -> DependencyAudit:
        now = dt.datetime.now(dt.timezone.utc).isoformat()
        if not path.exists():
            return DependencyAudit(name, str(path), now, 0, 0, 0, 0, 0,
                                   error=f"Path not found: {path}")
        try:
            result = subprocess.run(
                ["npm", "audit", "--json"],
                cwd=path, capture_output=True, text=True, timeout=60,
            )
            raw = result.stdout
            start = raw.find("{")
            end = raw.rfind("}")
            if start == -1 or end == -1:
                return DependencyAudit(name, str(path), now, 0, 0, 0, 0, 0,
                                       error="No JSON in npm audit output")
            data = json.loads(raw[start:end + 1])
            meta = data.get("metadata", {}).get("vulnerabilities", {})
            return DependencyAudit(
                component_name=name, component_path=str(path), timestamp=now,
                critical=meta.get("critical", 0), high=meta.get("high", 0),
                moderate=meta.get("moderate", 0), low=meta.get("low", 0),
                total=meta.get("total", 0),
            )
        except subprocess.TimeoutExpired:
            return DependencyAudit(name, str(path), now, 0, 0, 0, 0, 0,
                                   error="Audit timed out after 60s")
        except Exception as e:
            return DependencyAudit(name, str(path), now, 0, 0, 0, 0, 0,
                                   error=str(e)[:200])

    def find_new_criticals(self, current: list[DependencyAudit]) -> list[str]:
        """Component names where critical count increased since the previous run."""
        escalated = []
        for audit in current:
            if audit.critical == 0 or audit.error:
                continue
            prev = self.index.get_previous_dependency_audit(audit.component_name)
            if prev is None or audit.critical > prev["critical"]:
                escalated.append(audit.component_name)
        return escalated


# ─────────────────────────────────────────────────────────────────────────────


def _read_dotenv(path: Path) -> dict:
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
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not (token and chat_id) and TELEGRAM_ENV_FALLBACK.exists():
        env = _read_dotenv(TELEGRAM_ENV_FALLBACK)
        token = token or env.get("TELEGRAM_BOT_TOKEN", "")
        chat_id = chat_id or env.get("TELEGRAM_CHAT_ID", "")
    if not (token and chat_id):
        raise RuntimeError("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not found")
    return token, chat_id


def send_telegram(text: str) -> dict:
    token, chat_id = _telegram_creds()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": "true",
    }).encode()
    with urllib.request.urlopen(
        urllib.request.Request(url, data=data, method="POST"), timeout=15
    ) as resp:
        return json.loads(resp.read().decode())


def generate_report(index: StewardIndex) -> str:
    services = index.get_all_services()
    dep_audits = index.get_latest_dependency_audits()
    lines = ["# The Steward's Report", ""]

    healthy = sum(1 for s in services if s['status'] == 'healthy')
    degraded = sum(1 for s in services if s['status'] == 'degraded')
    unhealthy = sum(1 for s in services if s['status'] in ('unhealthy', 'unreachable'))

    lines.append(f"**Village Health:** {healthy}✅ {degraded}⚠️ {unhealthy}❌")
    lines.append("")
    lines.append("## The Villages")
    lines.append("")
    for svc in services:
        emoji = "✅" if svc['status'] == "healthy" else "❌" if svc['status'] in ("unhealthy", "unreachable") else "⚠️"
        lines.append(f"- {emoji} **{svc['name']}** — {svc['status']}")
    lines.append("")

    if dep_audits:
        total_vulns = sum(d['total'] for d in dep_audits if not d['error'])
        total_critical = sum(d['critical'] for d in dep_audits if not d['error'])
        dep_emoji = "🔴" if total_critical else "🟡" if total_vulns else "✅"
        lines.append(f"## Dependency Security {dep_emoji}")
        lines.append("")
        for d in dep_audits:
            if d['error']:
                lines.append(f"- ⚠️ **{d['component_name']}** — audit error: {d['error'][:60]}")
            elif d['total'] == 0:
                lines.append(f"- ✅ **{d['component_name']}** — clean")
            else:
                parts = []
                if d['critical']: parts.append(f"{d['critical']} critical")
                if d['high']: parts.append(f"{d['high']} high")
                if d['moderate']: parts.append(f"{d['moderate']} moderate")
                if d['low']: parts.append(f"{d['low']} low")
                icon = "🔴" if d['critical'] else "🟡"
                lines.append(f"- {icon} **{d['component_name']}** — {', '.join(parts)}")
        checked_at = dep_audits[0]['timestamp'][:16] if dep_audits else "never"
        lines.append(f"\n_Last audited: {checked_at} UTC_")
        lines.append("")

    lines.append("---")
    lines.append(f"Checked: {dt.datetime.now(dt.timezone.utc).isoformat()[:16]} UTC")
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────


def _npm_latest_version(package: str) -> str | None:
    """Return the current latest stable version of an npm package."""
    try:
        r = subprocess.run(
            ["npm", "view", package, "version"],
            capture_output=True, text=True, timeout=15,
        )
        return r.stdout.strip() if r.returncode == 0 else None
    except Exception:
        return None


def _version_gte(v: str, minimum: str) -> bool:
    """Return True if version v >= minimum (semver, numeric parts only)."""
    def parts(s: str) -> tuple:
        return tuple(int(x) for x in s.split("-")[0].split(".") if x.isdigit())
    try:
        return parts(v) >= parts(minimum)
    except Exception:
        return False


def check_upstream_blockers() -> list[dict]:
    """
    Check each upstream blocker. If the blocking package has reached the
    required version, trigger auto_fix_component for affected components
    and close the tracking GitHub Issues.
    Returns list of dicts: {blocker_id, status, version, fixed_components}
    """
    results = []
    for blocker in UPSTREAM_BLOCKERS:
        pkg = blocker["blocking_package"]
        min_ver = blocker["min_version"]
        latest = _npm_latest_version(pkg)

        if not latest:
            results.append({"id": blocker["id"], "status": "check_failed"})
            continue

        if not _version_gte(latest, min_ver):
            print(f"[upstream] {blocker['id']}: {pkg}@{latest} < {min_ver} — still waiting",
                  flush=True)
            results.append({"id": blocker["id"], "status": "waiting",
                            "version": latest, "needs": min_ver})
            continue

        print(f"[upstream] {blocker['id']}: {pkg}@{latest} >= {min_ver} — RELEASED, fixing now",
              flush=True)

        fixed = []
        for component in blocker["affected_components"]:
            result = auto_fix_component(component)
            if result["status"] == "fixed":
                fixed.append(component)

        # Close tracking issues for components that were fixed
        if fixed:
            for village, issue_number in blocker.get("github_issues", {}).items():
                cfg = COMPONENT_FIX_CONFIG.get(
                    next((c for c in blocker["affected_components"]
                          if COMPONENT_VILLAGE.get(c) == village), ""),
                    {}
                )
                repo = cfg.get("github_repo")
                if repo:
                    subprocess.run(
                        ["gh", "issue", "close", str(issue_number),
                         "--repo", repo,
                         "--comment",
                         f"Resolved automatically by The Steward.\n"
                         f"{pkg}@{latest} released — `npm audit fix` applied and deployed.\n"
                         f"Fixed components: {', '.join(fixed)}"],
                        capture_output=True, timeout=15,
                    )

        results.append({"id": blocker["id"], "status": "released",
                        "version": latest, "fixed_components": fixed})

    return results


def _run(cmd: list, cwd: Path, timeout: int = 120) -> tuple[int, str, str]:
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout, r.stderr


def auto_fix_component(name: str) -> dict:
    """
    Auto-fix npm vulnerabilities for one component.
    Returns a result dict with keys: name, status, pr_url, error.
    Status: 'fixed' | 'no_fixable' | 'build_failed' | 'error'
    """
    cfg = COMPONENT_FIX_CONFIG.get(name)
    if not cfg:
        return {"name": name, "status": "error", "error": "No fix config defined"}

    git_root: Path = cfg["git_root"]
    subdir: str = cfg["subdir"]
    component_path = git_root / subdir
    github_repo: str = cfg["github_repo"]
    build_cmd: list | None = cfg["build_cmd"]
    docker_compose_dir: Path | None = cfg["docker_compose_dir"]
    docker_service: str | None = cfg["docker_service"]

    print(f"\n[fix] Starting: {name}", flush=True)

    # 1 — Check fixable vulns exist before touching anything
    rc, out, _ = _run(["npm", "audit", "--json"], component_path, timeout=60)
    try:
        audit = json.loads(out[out.find("{"):out.rfind("}") + 1] or "{}")
        vulns = audit.get("vulnerabilities", {})
        fixable = [v for v in vulns.values()
                   if v.get("severity") in ("critical", "high") and v.get("fixAvailable")]
        if not fixable:
            print(f"[fix] No fixable critical/high vulns in {name} — skipping", flush=True)
            return {"name": name, "status": "no_fixable"}
    except Exception as e:
        return {"name": name, "status": "error", "error": f"Audit parse failed: {e}"}

    # 2 — Create fix branch in the village repo
    today = dt.date.today().isoformat()
    slug = name.lower().replace(" ", "-")
    branch = f"fix/steward-{slug}-{today}"

    # Ensure we're on main and up to date
    _run(["git", "checkout", "main"], git_root)
    _run(["git", "pull", "--ff-only"], git_root)

    rc, _, err = _run(["git", "checkout", "-b", branch], git_root)
    if rc != 0:
        # Branch may already exist from a previous run today — reuse it
        rc2, _, _ = _run(["git", "checkout", branch], git_root)
        if rc2 != 0:
            return {"name": name, "status": "error", "error": f"Could not create branch: {err}"}

    # 3 — Run npm audit fix
    print(f"[fix] Running npm audit fix in {component_path}", flush=True)
    rc, _, err = _run(["npm", "audit", "fix"], component_path, timeout=120)
    if rc != 0:
        _run(["git", "checkout", "main"], git_root)
        _run(["git", "branch", "-D", branch], git_root)
        return {"name": name, "status": "error", "error": f"npm audit fix failed: {err[:300]}"}

    # 4 — Verify build compiles
    if build_cmd:
        print(f"[fix] Verifying build: {' '.join(build_cmd)}", flush=True)
        rc, _, err = _run(build_cmd, component_path, timeout=180)
        if rc != 0:
            print(f"[fix] Build failed — rolling back", flush=True)
            _run(["git", "checkout", "."], git_root)
            _run(["git", "checkout", "main"], git_root)
            _run(["git", "branch", "-D", branch], git_root)
            return {"name": name, "status": "build_failed",
                    "error": f"Build failed after fix:\n{err[:500]}"}

    # 5 — Commit changed package files
    _run(["git", "add", f"{subdir}/package.json", f"{subdir}/package-lock.json"], git_root)
    rc, out, _ = _run(["git", "diff", "--cached", "--name-only"], git_root)
    if not out.strip():
        # Nothing changed — audit fix made no difference
        _run(["git", "checkout", "main"], git_root)
        _run(["git", "branch", "-D", branch], git_root)
        return {"name": name, "status": "no_fixable"}

    commit_msg = f"fix(deps): npm audit fix — {name} [steward {today}]"
    _run(["git", "commit", "-m", commit_msg], git_root)

    # 6 — Push branch
    rc, _, err = _run(["git", "push", "-u", "origin", branch], git_root)
    if rc != 0:
        _run(["git", "checkout", "main"], git_root)
        return {"name": name, "status": "error", "error": f"Push failed: {err[:300]}"}

    # 7 — Open PR and merge immediately
    pr_body = (
        f"## Automated Dependency Fix\n\n"
        f"**Component:** {name}\n"
        f"**Raised by:** The Steward (daily dependency audit — {today})\n\n"
        f"### What changed\n"
        f"Ran `npm audit fix` to resolve critical/high vulnerabilities. "
        f"Only semver-compatible patches applied (no `--force`).\n\n"
        f"### Verification\n"
        f"- [x] `npm audit fix` completed without errors\n"
        f"{'- [x] `' + ' '.join(build_cmd) + '` passed' if build_cmd else '- [ ] No build step configured'}\n\n"
        f"> Auto-merged by The Steward. Review `package-lock.json` diff for details."
    )
    r = subprocess.run(
        ["gh", "pr", "create",
         "--repo", github_repo,
         "--title", f"fix(deps): npm audit fix — {name}",
         "--body", pr_body,
         "--label", "agent-raised,steward",
         "--head", branch,
         "--base", "main"],
        capture_output=True, text=True, timeout=30,
    )
    pr_url = r.stdout.strip()
    if r.returncode != 0:
        return {"name": name, "status": "error", "error": f"PR create failed: {r.stderr[:300]}"}

    # Extract PR number and merge
    pr_number = pr_url.rstrip("/").split("/")[-1]
    subprocess.run(
        ["gh", "pr", "merge", pr_number, "--repo", github_repo, "--merge", "--delete-branch"],
        capture_output=True, text=True, timeout=30,
    )

    # 8 — Pull merged changes into local main
    _run(["git", "checkout", "main"], git_root)
    _run(["git", "pull", "--ff-only"], git_root)

    # 9 — Rebuild and restart Docker service if applicable
    if docker_compose_dir and docker_service:
        print(f"[fix] Rebuilding Docker service: {docker_service}", flush=True)
        subprocess.run(
            ["docker", "compose", "up", "-d", "--build", docker_service],
            cwd=docker_compose_dir, timeout=300,
        )

    print(f"[fix] Done: {name} — {pr_url}", flush=True)
    return {"name": name, "status": "fixed", "pr_url": pr_url}


# ─────────────────────────────────────────────────────────────────────────────
# Action-only incident detection — added 2026-05-14, OPERATOR_DUTIES.md #1
# ─────────────────────────────────────────────────────────────────────────────


def detect_incidents(snapshots: list[HealthSnapshot],
                     index: StewardIndex) -> list[str]:
    """
    After each /health poll, decide whether to open or close an incident per
    service. Returns Telegram-ready Markdown messages to send.

    Open  → service has had FAILURE_THRESHOLD consecutive failing snapshots
             and no incident is currently open
    Close → service's latest snapshot is healthy and an incident is open
    """
    messages: list[str] = []

    for snap in snapshots:
        if snap.status == "healthy" and index.has_open_incident(snap.service_name):
            mttr = index.close_open_incident(snap.service_name, snap.timestamp)
            messages.append(_format_recovery(snap, mttr))
            continue

        if snap.status in FAILING_STATUSES:
            recent = index.get_recent_snapshot_statuses(
                snap.service_name, limit=FAILURE_THRESHOLD,
            )
            if (len(recent) >= FAILURE_THRESHOLD
                    and all(s in FAILING_STATUSES for s in recent)
                    and not index.has_open_incident(snap.service_name)):
                index.open_incident(snap.service_name, snap.timestamp)
                messages.append(_format_failure(snap))

    return messages


def _format_failure(snap: HealthSnapshot) -> str:
    detail = (snap.details or "no response")[:120]
    return (
        f"🚨 *Village down — action required*\n\n"
        f"*{snap.service_name}* has failed {FAILURE_THRESHOLD} consecutive /health checks.\n\n"
        f"• URL: `{snap.service_url}`\n"
        f"• Status: `{snap.status}`\n"
        f"• Detected: {snap.timestamp[:16]} UTC\n"
        f"• Last error: `{detail}`\n\n"
        f"_Investigate the service._"
    )


def _format_recovery(snap: HealthSnapshot, mttr_seconds: Optional[int]) -> str:
    if mttr_seconds is None:
        duration = "unknown"
    elif mttr_seconds < 60:
        duration = f"{mttr_seconds}s"
    elif mttr_seconds < 3600:
        duration = f"{mttr_seconds // 60} min"
    else:
        h, m = mttr_seconds // 3600, (mttr_seconds % 3600) // 60
        duration = f"{h}h {m}m"
    return (
        f"✅ *Village recovered*\n\n"
        f"*{snap.service_name}* is healthy again.\n\n"
        f"• Down for: {duration}\n"
        f"• Restored: {snap.timestamp[:16]} UTC"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Uptime board — generated on every check, served by ~/reports/ nginx on 8095
# ─────────────────────────────────────────────────────────────────────────────


UPTIME_BOARD_CSS = """
  :root {
    --void: #050510; --void-2: #0a0a18;
    --teal: #81e6d9; --teal-dim: #4fb8aa;
    --amber: #f0c674; --red: #ff6b6b;
    --text: #e6e6f0; --text-dim: #9090a8;
    --border: rgba(129, 230, 217, 0.15);
    --border-strong: rgba(129, 230, 217, 0.35);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--void); color: var(--text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6; min-height: 100vh; }
  body {
    background-image:
      radial-gradient(ellipse at top, rgba(129,230,217,0.04) 0%, transparent 60%),
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='52' viewBox='0 0 60 52'><polygon points='30,1 58,15 58,37 30,51 2,37 2,15' fill='none' stroke='%23192040' stroke-width='0.7'/></svg>");
    background-repeat: no-repeat, repeat;
    background-attachment: fixed;
  }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 56px 28px 80px; }
  header { border-bottom: 1px solid var(--border); padding-bottom: 24px; margin-bottom: 36px; }
  .kicker { color: var(--teal); font-size: 0.78rem; letter-spacing: 0.18em;
    text-transform: uppercase; margin-bottom: 12px; font-weight: 500; }
  h1 { font-size: 2.2rem; font-weight: 600; margin: 0 0 10px;
    letter-spacing: -0.02em; color: #fff; }
  .lede { color: var(--text-dim); font-size: 1rem; margin: 0; }
  .updated { color: var(--text-dim); font-size: 0.82rem; margin-top: 14px;
    font-family: ui-monospace, monospace; }

  h2 { font-size: 0.95rem; font-weight: 500;
    margin: 40px 0 16px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--teal);
    border-bottom: 1px solid var(--border); padding-bottom: 10px; }

  .villages { display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px; }
  .village-card {
    background: linear-gradient(180deg, var(--void-2) 0%, rgba(10,10,24,0.5) 100%);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
  }
  .village-card.healthy { border-color: rgba(129,230,217,0.35); }
  .village-card.failing { border-color: rgba(255,107,107,0.45);
    background: linear-gradient(180deg, rgba(255,107,107,0.05) 0%, rgba(10,10,24,0.5) 100%); }
  .village-name { font-size: 0.98rem; font-weight: 500; color: #fff;
    margin-bottom: 14px; }
  .village-uptime { font-size: 1.85rem; font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.1; margin-bottom: 4px; letter-spacing: -0.02em; }
  .village-meta { color: var(--text-dim); font-size: 0.78rem; }
  .village-status { color: var(--text-dim); font-size: 0.72rem;
    margin-top: 10px; padding-top: 10px;
    border-top: 1px solid rgba(129,230,217,0.08);
    text-transform: uppercase; letter-spacing: 0.12em; }

  .incidents { display: flex; flex-direction: column; gap: 10px; }
  .incident { background: var(--void-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 0.93rem; }
  .incident.open { border-color: rgba(255,107,107,0.5); }
  .incident.closed { border-color: rgba(129,230,217,0.25); }
  .incident strong { color: #fff; }
  .incident-meta { color: var(--text-dim); font-size: 0.78rem;
    font-family: ui-monospace, monospace; }

  .no-incidents { color: var(--text-dim); font-style: italic;
    background: var(--void-2); border: 1px solid var(--border);
    border-radius: 8px; padding: 18px; }

  footer { margin-top: 56px; padding-top: 24px;
    border-top: 1px solid var(--border);
    color: var(--text-dim); font-size: 0.82rem; }
  a { color: var(--teal); text-decoration: none; }
  a:hover { color: #fff; }
"""


def generate_uptime_json(index: StewardIndex) -> dict:
    """Machine-readable village state for the dashboard at gvdi-30:3000/villages."""
    services = index.get_all_services()
    since_7d = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)).isoformat()
    villages = []
    with sqlite3.connect(index.db_path) as conn:
        for svc in services:
            row = conn.execute('''
                SELECT
                  SUM(CASE WHEN status='healthy' THEN 1 ELSE 0 END),
                  COUNT(*)
                FROM health_snapshots
                WHERE service_name=? AND timestamp > ?
            ''', (svc['name'], since_7d)).fetchone()
            healthy_count = row[0] or 0
            total_count = row[1] or 0
            uptime_pct = (healthy_count / total_count * 100) if total_count else 100.0
            villages.append({
                "name": svc['name'],
                "url": svc.get('url'),
                "status": svc.get('status') or "unknown",
                "last_checked": svc.get('last_checked'),
                "uptime_7d_pct": round(uptime_pct, 2),
                "sample_count": total_count,
            })

        open_incidents = [
            {"service_name": r[0], "start_time": r[1]}
            for r in conn.execute(
                "SELECT service_name, start_time FROM incidents WHERE end_time IS NULL"
            ).fetchall()
        ]

    healthy = sum(1 for v in villages if v["status"] == "healthy")
    return {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "total": len(villages),
        "healthy": healthy,
        "unhealthy": len(villages) - healthy,
        "villages": villages,
        "open_incidents": open_incidents,
    }


def generate_uptime_html(index: StewardIndex) -> str:
    """Generate the village uptime board HTML. Refreshes on every check."""
    services = index.get_all_services()
    since_7d = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)).isoformat()

    uptime_data = []
    with sqlite3.connect(index.db_path) as conn:
        for svc in services:
            row = conn.execute('''
                SELECT
                  SUM(CASE WHEN status='healthy' THEN 1 ELSE 0 END),
                  COUNT(*)
                FROM health_snapshots
                WHERE service_name=? AND timestamp > ?
            ''', (svc['name'], since_7d)).fetchone()
            healthy_count = row[0] or 0
            total_count = row[1] or 0
            uptime_pct = (healthy_count / total_count * 100) if total_count else 100.0
            uptime_data.append({**svc, 'uptime_pct': uptime_pct, 'sample_count': total_count})

        incidents = conn.execute('''
            SELECT service_name, start_time, end_time, mttr_seconds
            FROM incidents
            WHERE start_time > ?
            ORDER BY start_time DESC
        ''', (since_7d,)).fetchall()

    open_incidents = [i for i in incidents if i[2] is None]
    closed_incidents = [i for i in incidents if i[2] is not None]

    now_str = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    village_cards = []
    for svc in uptime_data:
        status = svc.get('status') or 'unknown'
        is_healthy = status == 'healthy'
        emoji = "✅" if is_healthy else "❌"
        card_class = "healthy" if is_healthy else "failing"
        pct = svc['uptime_pct']
        pct_color = "var(--teal)" if pct >= 99 else "var(--amber)" if pct >= 95 else "var(--red)"
        village_cards.append(
            f'<div class="village-card {card_class}">'
            f'<div class="village-name">{emoji} {svc["name"]}</div>'
            f'<div class="village-uptime" style="color: {pct_color};">{pct:.1f}%</div>'
            f'<div class="village-meta">7-day uptime · {svc["sample_count"]} samples</div>'
            f'<div class="village-status">{status}</div>'
            f'</div>'
        )

    incidents_blocks = []
    if open_incidents:
        items = []
        for svc_name, start, _, _ in open_incidents:
            try:
                started = dt.datetime.fromisoformat(start)
                mins = int((dt.datetime.now(dt.timezone.utc) - started).total_seconds() / 60)
                dur = f"down {mins} min" if mins < 60 else f"down {mins // 60}h {mins % 60}m"
            except Exception:
                dur = "open"
            items.append(
                f'<div class="incident open"><strong>{svc_name}</strong> — {dur}<br>'
                f'<span class="incident-meta">Started {start[:16]} UTC</span></div>'
            )
        incidents_blocks.append(
            f'<h2>Open Incidents</h2><div class="incidents">{"".join(items)}</div>'
        )

    if closed_incidents:
        items = []
        for svc_name, start, end, mttr in closed_incidents:
            if mttr and mttr < 60:
                dur_str = f"{mttr}s"
            elif mttr and mttr < 3600:
                dur_str = f"{mttr // 60} min"
            elif mttr:
                dur_str = f"{mttr // 3600}h {(mttr % 3600) // 60}m"
            else:
                dur_str = "?"
            items.append(
                f'<div class="incident closed"><strong>{svc_name}</strong> — recovered after {dur_str}<br>'
                f'<span class="incident-meta">{start[:16]} → {end[:16]} UTC</span></div>'
            )
        incidents_blocks.append(
            f'<h2>Recovered This Week</h2><div class="incidents">{"".join(items)}</div>'
        )

    if not incidents_blocks:
        incidents_section = (
            '<h2>Incidents This Week</h2>'
            '<div class="no-incidents">None — the realm was quiet.</div>'
        )
    else:
        incidents_section = "".join(incidents_blocks)

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="300">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Village Uptime — Kingdom</title>
<style>{UPTIME_BOARD_CSS}</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="kicker">The Kingdom · Steward</div>
    <h1>Village Uptime</h1>
    <p class="lede">Every village's health, last 7 days. Page refreshes every 5 minutes; data regenerates inside the Steward's check loop.</p>
    <p class="updated">Last regenerated: {now_str}</p>
  </header>

  <h2>Villages</h2>
  <div class="villages">{"".join(village_cards)}</div>

  {incidents_section}

  <footer>
    Steward · Kingdom ·
    <a href="/Kingdom/operator-duties.html">Operator Duties</a> ·
    <a href="/Kingdom/">Kingdom reports</a>
  </footer>
</div>
</body>
</html>
'''


def main():
    parser = argparse.ArgumentParser(description="The Steward")
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("check", help="Run health + dependency checks")
    subparsers.add_parser("status", help="Show current status (JSON)")
    subparsers.add_parser("incidents", help="Show today's incidents")
    subparsers.add_parser("report", help="Generate daily report")
    subparsers.add_parser("telegram", help="Post report to Telegram")
    subparsers.add_parser("deps", help="Run dependency audit only")
    fix_parser = subparsers.add_parser("fix", help="Auto-fix vulnerabilities and redeploy")
    fix_parser.add_argument("--component", help="Fix one component only (default: all)")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    index = StewardIndex()

    if args.command == "check":
        checker = StewardHealthChecker(index)
        snapshots = checker.check_all()
        for snap in snapshots:
            icon = "✅" if snap.status == "healthy" else "❌"
            rt = f" ({snap.response_time_ms}ms)" if snap.response_time_ms else ""
            print(f"{icon} {snap.service_name}: {snap.status}{rt}")

        # Action-only Telegram — open/close incidents on real transitions
        alerts = detect_incidents(snapshots, index)
        for msg in alerts:
            try:
                send_telegram(msg)
                print(f"[alert] sent: {msg.splitlines()[0]}")
            except Exception as e:
                print(f"[alert] telegram failed: {e}", file=sys.stderr)

        # Regenerate the uptime board (served at http://localhost:8095/Kingdom/uptime.html)
        try:
            html = generate_uptime_html(index)
            board_path = HOME / "reports" / "Kingdom" / "uptime.html"
            board_path.parent.mkdir(parents=True, exist_ok=True)
            board_path.write_text(html)
        except Exception as e:
            print(f"[board] failed: {e}", file=sys.stderr)

        # Write JSON sidecar — canonical machine-readable village state,
        # consumed by the Kingdom dashboard at gvdi-30:3000/villages
        try:
            sidecar = generate_uptime_json(index)
            json_path = HOME / ".steward-health.json"
            json_path.write_text(json.dumps(sidecar, indent=2))
        except Exception as e:
            print(f"[sidecar] failed: {e}", file=sys.stderr)

    elif args.command == "deps":
        dep_checker = DependencyChecker(index)
        results = dep_checker.audit_all()
        new_criticals = dep_checker.find_new_criticals(results)
        for d in results:
            if d.error:
                print(f"⚠️  {d.component_name}: {d.error}")
            elif d.total == 0:
                print(f"✅ {d.component_name}: no vulnerabilities")
            else:
                parts = []
                if d.critical: parts.append(f"{d.critical} critical")
                if d.high: parts.append(f"{d.high} high")
                if d.moderate: parts.append(f"{d.moderate} moderate")
                if d.low: parts.append(f"{d.low} low")
                icon = "🔴" if d.critical else "🟡"
                print(f"{icon} {d.component_name}: {', '.join(parts)} ({d.total} total)")

            # Open a GitHub Issue for new critical vulnerabilities
            # Skip components whose vulns are known upstream blockers
            upstream_blocked = {
                c for b in UPSTREAM_BLOCKERS for c in b["affected_components"]
            }
            if d.component_name in new_criticals and not d.error \
                    and d.component_name not in upstream_blocked:
                village = COMPONENT_VILLAGE.get(d.component_name)
                if village:
                    parts = []
                    if d.critical: parts.append(f"{d.critical} critical")
                    if d.high: parts.append(f"{d.high} high")
                    summary = ", ".join(parts)
                    title = f"[Steward] Dependency vulnerabilities in {d.component_name} ({summary})"
                    body = (
                        f"## Dependency Audit Alert\n\n"
                        f"**Component:** {d.component_name}\n"
                        f"**Path:** `{d.component_path}`\n\n"
                        f"| Severity | Count |\n"
                        f"|---|---|\n"
                        f"| Critical | {d.critical} |\n"
                        f"| High | {d.high} |\n"
                        f"| Moderate | {d.moderate} |\n"
                        f"| Low | {d.low} |\n\n"
                        f"**Detected by:** The Steward (daily dependency audit)\n\n"
                        f"### To investigate\n"
                        f"```bash\ncd {d.component_path}\nnpm audit\n```\n\n"
                        f"### To fix (auto-fixable only)\n"
                        f"```bash\nnpm audit fix\n```\n\n"
                        f"> Review changes before committing. Run tests after fixing."
                    )
                    severity = "critical" if d.critical else "high"
                    open_issue(village=village, title=title, body=body,
                               source="steward", severity=severity)

        print(json.dumps([dataclasses.asdict(d) for d in results], indent=2))

    elif args.command == "fix":
        # Check upstream blockers first — auto-fix any that have been released
        if not args.component:
            upstream_results = check_upstream_blockers()
            for r in upstream_results:
                if r["status"] == "released":
                    print(f"[upstream] {r['id']} resolved — fixed: {r.get('fixed_components', [])}")
                elif r["status"] == "waiting":
                    print(f"[upstream] {r['id']} still waiting on {r.get('needs')} "
                          f"(latest: {r.get('version')})")

        targets = [args.component] if args.component else list(COMPONENT_FIX_CONFIG.keys())
        results = []
        for component in targets:
            result = auto_fix_component(component)
            results.append(result)
        # Summary
        fixed = [r for r in results if r["status"] == "fixed"]
        failed = [r for r in results if r["status"] in ("build_failed", "error")]
        skipped = [r for r in results if r["status"] == "no_fixable"]
        print(f"\n{'─'*50}")
        print(f"Fixed:   {len(fixed)} — {', '.join(r['name'] for r in fixed) or 'none'}")
        print(f"Skipped: {len(skipped)} — {', '.join(r['name'] for r in skipped) or 'none'}")
        print(f"Failed:  {len(failed)} — {', '.join(r['name'] for r in failed) or 'none'}")
        for r in failed:
            print(f"  ⚠️  {r['name']}: {r.get('error','')}")
        # Telegram summary if anything was fixed or failed
        if fixed or failed:
            lines = ["🔧 *Steward — Auto-fix Report*", ""]
            for r in fixed:
                lines.append(f"✅ Fixed: {r['name']}\n   PR: {r.get('pr_url','')}")
            for r in failed:
                lines.append(f"❌ Failed: {r['name']}\n   {r.get('error','')[:150]}")
            try:
                send_telegram("\n".join(lines))
            except Exception:
                pass

    elif args.command == "status":
        print(json.dumps(index.get_all_services(), indent=2))

    elif args.command == "incidents":
        print("No incidents recorded.")

    elif args.command == "report":
        print(generate_report(index))

    elif args.command == "telegram":
        try:
            send_telegram(generate_report(index))
        except Exception as e:
            print(f"Telegram delivery failed: {e}", file=sys.stderr)
            sys.exit(2)
        print("Report delivered.")


if __name__ == "__main__":
    main()
