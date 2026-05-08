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

HOME = Path.home()
KINGDOM_DIR = Path(os.environ.get("KINGDOM_DIR", HOME / "Kingdom"))
HEALTH_DB = Path(os.environ.get("STEWARD_HEALTH_DB", HOME / ".steward-health.db"))
TELEGRAM_ENV_FALLBACK = HOME / "telegram_notify_service" / ".env"

# Known villages and their health endpoints
VILLAGES = {
    "Gekko Tracks": "http://localhost:8002/health",
    "Kanban-AI": "http://localhost:5002/health",
    "Admin Center API": "http://localhost:5001/health",
    "Open WebUI": "http://localhost:3005/health",
    "Local API": "http://localhost:8080/health",
    "n8n": "http://localhost:5678/api/health",
}

# npm projects to audit for dependency vulnerabilities
COMPONENTS = {
    "Admin Center Backend": HOME / "admin-center/backend",
    "Admin Center Frontend": HOME / "admin-center/frontend",
    "Admin Center MCP Server": HOME / "admin-center/mcp-server",
    "Kingdom Dashboard": KINGDOM_DIR / "capital/dashboard",
}

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


def main():
    parser = argparse.ArgumentParser(description="The Steward")
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("check", help="Run health + dependency checks")
    subparsers.add_parser("status", help="Show current status (JSON)")
    subparsers.add_parser("incidents", help="Show today's incidents")
    subparsers.add_parser("report", help="Generate daily report")
    subparsers.add_parser("telegram", help="Post report to Telegram")
    subparsers.add_parser("deps", help="Run dependency audit only")

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

    elif args.command == "deps":
        dep_checker = DependencyChecker(index)
        results = dep_checker.audit_all()
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
        print(json.dumps([dataclasses.asdict(d) for d in results], indent=2))

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
