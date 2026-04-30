#!/usr/bin/env python3
"""
The Captain of the Guard — Incident response and alerting for the Kingdom.
Detects, categorizes, and responds to incidents. Creates GitHub issues and sends alerts.
"""

import os
import sys
import sqlite3
import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List
import requests

DB_PATH = Path.home() / ".captain-of-the-guard.db"
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO", "gekkotech/kingdom")


class CaptainIndex:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS incidents (
                    id INTEGER PRIMARY KEY,
                    incident_id TEXT UNIQUE NOT NULL,
                    timestamp TEXT NOT NULL,
                    severity TEXT,
                    category TEXT,
                    service TEXT,
                    message TEXT,
                    details TEXT,
                    status TEXT DEFAULT 'open',
                    github_issue_url TEXT,
                    resolved_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS alerts_sent (
                    id INTEGER PRIMARY KEY,
                    incident_id TEXT NOT NULL,
                    alert_type TEXT,
                    destination TEXT,
                    message TEXT,
                    sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS incident_history (
                    id INTEGER PRIMARY KEY,
                    incident_id TEXT NOT NULL,
                    action TEXT,
                    details TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id)
                )
            """)
            conn.commit()

    def create_incident(self, incident_id: str, severity: str, category: str,
                       service: str, message: str, details: str = "") -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO incidents
                    (incident_id, timestamp, severity, category, service, message, details, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'open')
                """, (incident_id, datetime.utcnow().isoformat(), severity, category,
                      service, message, details))
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def log_alert(self, incident_id: str, alert_type: str, destination: str, message: str):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO alerts_sent (incident_id, alert_type, destination, message)
                VALUES (?, ?, ?, ?)
            """, (incident_id, alert_type, destination, message))
            conn.commit()

    def log_action(self, incident_id: str, action: str, details: str = ""):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO incident_history (incident_id, action, details)
                VALUES (?, ?, ?)
            """, (incident_id, action, details))
            conn.commit()

    def resolve_incident(self, incident_id: str):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                UPDATE incidents SET status = 'resolved', resolved_at = ?
                WHERE incident_id = ?
            """, (datetime.utcnow().isoformat(), incident_id))
            conn.commit()

    def get_open_incidents(self) -> List[Dict]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute("""
                SELECT incident_id, timestamp, severity, category, service, message
                FROM incidents
                WHERE status = 'open'
                ORDER BY timestamp DESC
            """).fetchall()
            return [
                {
                    "incident_id": row[0],
                    "timestamp": row[1],
                    "severity": row[2],
                    "category": row[3],
                    "service": row[4],
                    "message": row[5]
                }
                for row in rows
            ]


class CaptainChecker:
    def __init__(self, index: CaptainIndex):
        self.index = index

    def check_incidents(self) -> List[Dict]:
        incidents = []

        # Check health status from Steward
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-steward"],
                capture_output=True,
                text=True,
                timeout=15,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.stdout:
                report = result.stdout
                if "unhealthy" in report.lower() or "unreachable" in report.lower():
                    # Parse report to identify failed services
                    for line in report.split("\n"):
                        if "❌" in line:
                            service = line.split("❌")[1].strip().split(":")[0]
                            incident_id = f"health-{service.lower().replace(' ', '-')}"

                            incident = {
                                "incident_id": incident_id,
                                "severity": "high",
                                "category": "service_health",
                                "service": service,
                                "message": f"{service} is unhealthy or unreachable",
                                "details": report
                            }
                            incidents.append(incident)
        except Exception as e:
            print(f"Error checking Steward: {e}")

        # Check for resource alerts from Quartermaster
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-quartermaster", "check"],
                capture_output=True,
                text=True,
                timeout=15,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.stdout:
                if "CRITICAL" in result.stdout or "WARNING" in result.stdout:
                    for line in result.stdout.split("\n"):
                        if "CRITICAL" in line or "WARNING" in line:
                            incident_id = f"resource-{datetime.utcnow().timestamp()}"
                            severity = "critical" if "CRITICAL" in line else "medium"

                            incident = {
                                "incident_id": incident_id,
                                "severity": severity,
                                "category": "resource_quota",
                                "service": "System",
                                "message": line.strip(),
                                "details": result.stdout
                            }
                            incidents.append(incident)
        except Exception as e:
            print(f"Error checking Quartermaster: {e}")

        return incidents

    def process_incident(self, incident: Dict):
        incident_id = incident["incident_id"]

        # Record incident
        created = self.index.create_incident(
            incident_id,
            incident["severity"],
            incident["category"],
            incident["service"],
            incident["message"],
            incident.get("details", "")
        )

        if not created:
            return  # Incident already processed

        self.index.log_action(incident_id, "detected", f"Category: {incident['category']}")

        # Send Telegram alert if critical
        if incident["severity"] in ["critical", "high"]:
            self.send_telegram_alert(incident)

        # Create GitHub issue if critical
        if incident["severity"] == "critical":
            issue_url = self.create_github_issue(incident)
            if issue_url:
                with sqlite3.connect(DB_PATH) as conn:
                    conn.execute("""
                        UPDATE incidents SET github_issue_url = ? WHERE incident_id = ?
                    """, (issue_url, incident_id))
                    conn.commit()
                self.index.log_action(incident_id, "github_issue_created", issue_url)

    def send_telegram_alert(self, incident: Dict):
        if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
            return

        severity_emoji = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🟢"
        }
        emoji = severity_emoji.get(incident["severity"], "⚪")

        message = f"""{emoji} **Incident Alert**
**Severity:** {incident['severity'].upper()}
**Service:** {incident['service']}
**Category:** {incident['category']}
**Message:** {incident['message']}
**Timestamp:** {datetime.utcnow().isoformat()}
"""

        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        data = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "Markdown"
        }

        try:
            response = requests.post(url, json=data, timeout=10)
            self.index.log_alert(
                incident["incident_id"],
                "telegram",
                TELEGRAM_CHAT_ID,
                message
            )
        except Exception as e:
            print(f"Failed to send Telegram alert: {e}")

    def create_github_issue(self, incident: Dict) -> Optional[str]:
        if not GITHUB_TOKEN:
            return None

        headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json"
        }

        title = f"[{incident['severity'].upper()}] {incident['service']}: {incident['message'][:50]}"
        body = f"""Incident detected by The Captain of the Guard.

**Severity:** {incident['severity']}
**Service:** {incident['service']}
**Category:** {incident['category']}
**Message:** {incident['message']}

**Details:**
```
{incident.get('details', 'N/A')}
```

**Timestamp:** {datetime.utcnow().isoformat()}
"""

        data = {
            "title": title,
            "body": body,
            "labels": [incident['severity'], incident['category']]
        }

        try:
            url = f"https://api.github.com/repos/{GITHUB_REPO}/issues"
            response = requests.post(url, headers=headers, json=data, timeout=10)
            if response.status_code == 201:
                issue_data = response.json()
                return issue_data.get("html_url")
        except Exception as e:
            print(f"Failed to create GitHub issue: {e}")

        return None


def generate_report(incidents: List[Dict]) -> str:
    open_incidents = [i for i in incidents if i.get("status") == "open"] if incidents else []

    if not open_incidents:
        return "🛡️ **Captain's Report** — All is quiet. No open incidents."

    lines = [f"🛡️ **Captain's Report** — {len(open_incidents)} incident(s)"]
    lines.append("")

    for incident in open_incidents:
        emoji_map = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}
        emoji = emoji_map.get(incident["severity"], "⚪")
        lines.append(f"{emoji} **{incident['service']}** — {incident['message']}")
        lines.append(f"   *{incident['category']}* ({incident['severity']})")
        lines.append("")

    return "\n".join(lines)


def main():
    index = CaptainIndex()
    checker = CaptainChecker(index)

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "scan":
            incidents = checker.check_incidents()
            for incident in incidents:
                checker.process_incident(incident)
            report = generate_report(index.get_open_incidents())
            print(report)

        elif command == "report":
            open_incidents = index.get_open_incidents()
            report = generate_report(open_incidents)
            if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
                url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
                data = {"chat_id": TELEGRAM_CHAT_ID, "text": report, "parse_mode": "Markdown"}
                try:
                    requests.post(url, json=data, timeout=10)
                except Exception as e:
                    print(f"Failed to send report: {e}")

        elif command == "db":
            print(f"Database: {DB_PATH}")
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT count(*) FROM incidents WHERE status = 'open'")
                print(f"Open incidents: {cursor.fetchone()[0]}")
                cursor.execute("SELECT count(*) FROM incidents")
                print(f"Total incidents: {cursor.fetchone()[0]}")
    else:
        incidents = checker.check_incidents()
        for incident in incidents:
            checker.process_incident(incident)
        report = generate_report(index.get_open_incidents())
        print(report)


if __name__ == "__main__":
    main()
