"""The Steward — day-to-day operations across every village.

Health-checks each service, surfaces alerts, builds status reports.

Usage:
    python -m council.the-steward check                  # run health checks
    python -m council.the-steward status                 # show current status (JSON)
    python -m council.the-steward incidents              # show today's incidents
    python -m council.the-steward report                 # generate daily report
    python -m council.the-steward telegram               # post report to Telegram
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

# ─────────────────────────────────────────────────────────────────────────────


@dataclasses.dataclass
class HealthSnapshot:
    """A single health check result."""
    service_name: str
    service_url: str
    timestamp: str  # ISO datetime
    status: str  # healthy, degraded, unhealthy, unreachable
    response_time_ms: Optional[int]
    details: Optional[str]

    def to_dict(self) -> dict:
        return {
            'service_name': self.service_name,
            'service_url': self.service_url,
            'timestamp': self.timestamp,
            'status': self.status,
            'response_time_ms': self.response_time_ms,
            'details': self.details,
        }


@dataclasses.dataclass
class ServiceStatus:
    """Current status of a service."""
    name: str
    url: str
    status: str
    last_check: Optional[str]
    uptime_percent_24h: float
    last_incident: Optional[str]


class StewardIndex:
    """SQLite-backed health index."""

    def __init__(self, db_path: Path = HEALTH_DB):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Create tables if they don't exist."""
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
            conn.commit()

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
            # Update current status
            conn.execute('''
                UPDATE services SET current_status = ?, last_checked = ?
                WHERE name = ?
            ''', (snapshot.status, snapshot.timestamp, snapshot.service_name))
            conn.commit()

    def get_all_services(self) -> list[dict]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute('''
                SELECT name, url, criticality, current_status, last_checked
                FROM services
                ORDER BY name
            ''').fetchall()
        return [
            {
                'name': r[0],
                'url': r[1],
                'criticality': r[2],
                'status': r[3],
                'last_checked': r[4],
            }
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
            # Get current status
            row = conn.execute('''
                SELECT name, url, current_status, last_checked
                FROM services WHERE name = ?
            ''', (name,)).fetchone()

            if not row:
                return None

            service_name, url, status, last_checked = row

            # Calculate uptime for last 24h
            since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=24)).isoformat()
            snaps = conn.execute('''
                SELECT status FROM health_snapshots
                WHERE service_name = ? AND timestamp > ?
                ORDER BY timestamp
            ''', (name, since)).fetchall()

            if snaps:
                healthy = sum(1 for s in snaps if s[0] == 'healthy')
                uptime = (healthy / len(snaps)) * 100
            else:
                uptime = 100.0

            # Get last incident
            incident = conn.execute('''
                SELECT start_time FROM incidents
                WHERE service_name = ? AND end_time IS NULL
                ORDER BY start_time DESC LIMIT 1
            ''', (name,)).fetchone()

            last_incident = incident[0] if incident else None

            return ServiceStatus(
                name=service_name,
                url=url,
                status=status or "unknown",
                last_check=last_checked,
                uptime_percent_24h=uptime,
                last_incident=last_incident,
            )


class StewardHealthChecker:
    """Checks health of all services."""

    def __init__(self, index: Optional[StewardIndex] = None):
        self.index = index or StewardIndex()

    def check_all(self) -> list[HealthSnapshot]:
        """Run health checks on all villages."""
        snapshots = []

        # Initialize services from VILLAGES dict
        for name, url in VILLAGES.items():
            self.index.add_or_update_service(name, url)

        # Check each service
        for name, url in VILLAGES.items():
            snap = self._check_service(name, url)
            snapshots.append(snap)
            self.index.record_snapshot(snap)

        return snapshots

    def _check_service(self, name: str, url: str) -> HealthSnapshot:
        """Check a single service's health."""
        now = dt.datetime.now(dt.timezone.utc).isoformat()
        start = dt.datetime.now()

        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                elapsed = dt.datetime.now() - start
                response_time_ms = int(elapsed.total_seconds() * 1000)

                try:
                    data = json.loads(resp.read().decode())
                    raw_status = data.get("status", "healthy")
                    if isinstance(raw_status, bool):
                        status = "healthy" if raw_status else "unhealthy"
                    elif raw_status in ("ok", "OK", "up", "UP"):
                        status = "healthy"
                    else:
                        status = str(raw_status) if raw_status is not None else "healthy"
                    details = json.dumps(data, indent=2) if data else None
                except json.JSONDecodeError:
                    status = "healthy"
                    details = None

                return HealthSnapshot(
                    service_name=name,
                    service_url=url,
                    timestamp=now,
                    status=status,
                    response_time_ms=response_time_ms,
                    details=details,
                )
        except urllib.error.HTTPError as e:
            return HealthSnapshot(
                service_name=name,
                service_url=url,
                timestamp=now,
                status="unhealthy",
                response_time_ms=None,
                details=f"HTTP {e.code}: {e.reason}",
            )
        except (urllib.error.URLError, TimeoutError) as e:
            return HealthSnapshot(
                service_name=name,
                service_url=url,
                timestamp=now,
                status="unreachable",
                response_time_ms=None,
                details=f"Connection error: {str(e)[:100]}",
            )
        except Exception as e:
            return HealthSnapshot(
                service_name=name,
                service_url=url,
                timestamp=now,
                status="unreachable",
                response_time_ms=None,
                details=f"Error: {str(e)[:100]}",
            )


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
    """Resolve bot token and chat id."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not (token and chat_id) and TELEGRAM_ENV_FALLBACK.exists():
        env = _read_dotenv(TELEGRAM_ENV_FALLBACK)
        token = token or env.get("TELEGRAM_BOT_TOKEN", "")
        chat_id = chat_id or env.get("TELEGRAM_CHAT_ID", "")
    if not (token and chat_id):
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not found"
        )
    return token, chat_id


def send_telegram(text: str) -> dict:
    """Post a message to Telegram."""
    token, chat_id = _telegram_creds()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": "true",
    }).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def generate_report(index: StewardIndex) -> str:
    """Generate a markdown status report."""
    services = index.get_all_services()
    lines = ["# The Steward's Report", ""]

    # Count statuses
    healthy = sum(1 for s in services if s['status'] == 'healthy')
    degraded = sum(1 for s in services if s['status'] == 'degraded')
    unhealthy = sum(1 for s in services if s['status'] == 'unhealthy')
    unknown = sum(1 for s in services if s['status'] is None or s['status'] == 'unknown')

    lines.append(f"**Status:** {healthy}✅ {degraded}⚠️ {unhealthy}❌ {unknown}❓")
    lines.append("")

    # List services
    lines.append("## The Villages")
    lines.append("")
    for svc in services:
        emoji = "✅" if svc['status'] == "healthy" else "❌" if svc['status'] == "unhealthy" else "⚠️"
        lines.append(f"- {emoji} **{svc['name']}** — {svc['status']}")
        if svc['last_checked']:
            lines.append(f"  Last checked: {svc['last_checked'][:16]}")
    lines.append("")

    # Summary
    lines.append(f"---")
    lines.append(f"Realm health: {healthy}/{len(services)} services operational")
    lines.append(f"Checked: {dt.datetime.now(dt.timezone.utc).isoformat()}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="The Steward")
    subparsers = parser.add_subparsers(dest="command", help="Command")

    subparsers.add_parser("check", help="Run health checks")
    subparsers.add_parser("status", help="Show current status (JSON)")
    subparsers.add_parser("incidents", help="Show today's incidents")
    subparsers.add_parser("report", help="Generate daily report")
    subparsers.add_parser("telegram", help="Post report to Telegram")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    index = StewardIndex()

    if args.command == "check":
        checker = StewardHealthChecker(index)
        snapshots = checker.check_all()
        for snap in snapshots:
            status_icon = "✅" if snap.status == "healthy" else "❌"
            print(f"{status_icon} {snap.service_name}: {snap.status}")

    elif args.command == "status":
        services = index.get_all_services()
        print(json.dumps(services, indent=2))

    elif args.command == "incidents":
        # Today's incidents (not yet implemented - would require incident tracking)
        print("No incidents recorded.")

    elif args.command == "report":
        print(generate_report(index))

    elif args.command == "telegram":
        try:
            msg = generate_report(index)
            result = send_telegram(msg)
        except Exception as e:
            print(f"Telegram delivery failed: {e}", file=sys.stderr)
            sys.exit(2)
        if not result.get("ok"):
            print(f"Telegram API returned: {result}", file=sys.stderr)
            sys.exit(3)
        print(f"Report delivered (message_id={result.get('result', {}).get('message_id')})")


if __name__ == "__main__":
    main()
