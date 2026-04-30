#!/usr/bin/env python3
"""
The Master of Laws — Enforces the Gekko Standard across all villages.
Audits village compliance and creates issues for violations.
"""

import os
import sys
import sqlite3
import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import requests
from urllib.error import URLError
from urllib.request import urlopen

DB_PATH = Path.home() / ".master-of-laws.db"
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# Known villages (should come from a registry eventually)
VILLAGES = {
    "gekko-tracks": {
        "name": "Gekko Tracks",
        "health_url": "http://gvdi-30.netbird.selfhosted:8002/health",
        "repo": "gekkotech/gekko-tracks",
        "port": 8002,
    },
    "kanban-ai": {
        "name": "Kanban AI",
        "health_url": "http://localhost:5002/health",
        "repo": "gekkotech/kanban-ai",
        "port": 5002,
    },
    "interceptor": {
        "name": "Interceptor",
        "health_url": "http://localhost:8085/health",
        "repo": "gekkotech/interceptor",
        "port": 8085,
    },
    "open-webui": {
        "name": "Open WebUI",
        "health_url": "http://localhost:3005/health",
        "repo": None,
        "port": 3005,
    },
    "admin-center": {
        "name": "Admin Center",
        "health_url": "http://localhost:5001/health",
        "repo": "gekkotech/admin-center",
        "port": 5001,
    },
}


class MasterOfLawsIndex:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS compliance_audits (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    village_slug TEXT NOT NULL,
                    compliance_score REAL,
                    violations_count INTEGER,
                    violations_json TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS violations (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    village_slug TEXT NOT NULL,
                    requirement TEXT,
                    status TEXT,
                    severity TEXT,
                    github_issue_url TEXT,
                    resolved_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def record_audit(self, village_slug: str, score: float, violations: List[Dict]):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO compliance_audits (timestamp, village_slug, compliance_score, violations_count, violations_json)
                VALUES (?, ?, ?, ?, ?)
            """, (
                datetime.utcnow().isoformat(),
                village_slug,
                score,
                len(violations),
                json.dumps(violations)
            ))
            conn.commit()


class MasterOfLawsChecker:
    def __init__(self, index: MasterOfLawsIndex):
        self.index = index

    def check_health_endpoint(self, village_slug: str, health_url: str) -> Dict:
        try:
            response = urlopen(health_url, timeout=5)
            data = json.loads(response.read().decode())
            return {
                "requirement": "Health Endpoint (/health)",
                "status": "pass",
                "details": f"Returns {response.status}",
            }
        except Exception as e:
            return {
                "requirement": "Health Endpoint (/health)",
                "status": "fail",
                "details": str(e),
                "severity": "critical",
            }

    def check_github_repo(self, village_slug: str, repo: Optional[str]) -> Dict:
        if not repo:
            return {
                "requirement": "GitHub Repository",
                "status": "fail",
                "details": "No repository configured",
                "severity": "high",
            }

        if not GITHUB_TOKEN:
            return {
                "requirement": "GitHub Repository",
                "status": "skip",
                "details": "No GitHub token",
            }

        try:
            url = f"https://api.github.com/repos/{repo}"
            headers = {"Authorization": f"token {GITHUB_TOKEN}"}
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                return {
                    "requirement": "GitHub Repository",
                    "status": "pass",
                    "details": f"{repo} is accessible",
                }
        except Exception as e:
            pass

        return {
            "requirement": "GitHub Repository",
            "status": "fail",
            "details": f"Cannot access {repo}",
            "severity": "high",
        }

    def check_changelog(self, village_slug: str, repo: Optional[str]) -> Dict:
        if not repo:
            return {
                "requirement": "CHANGELOG.md",
                "status": "skip",
                "details": "No repository",
            }

        if not GITHUB_TOKEN:
            return {
                "requirement": "CHANGELOG.md",
                "status": "skip",
                "details": "No GitHub token",
            }

        try:
            url = f"https://api.github.com/repos/{repo}/contents/CHANGELOG.md"
            headers = {"Authorization": f"token {GITHUB_TOKEN}"}
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                return {
                    "requirement": "CHANGELOG.md",
                    "status": "pass",
                    "details": "Changelog exists",
                }
        except Exception as e:
            pass

        return {
            "requirement": "CHANGELOG.md",
            "status": "fail",
            "details": "No CHANGELOG.md in repository",
            "severity": "medium",
        }

    def check_readme(self, village_slug: str, repo: Optional[str]) -> Dict:
        if not repo:
            return {
                "requirement": "README.md",
                "status": "skip",
                "details": "No repository",
            }

        if not GITHUB_TOKEN:
            return {
                "requirement": "README.md",
                "status": "skip",
                "details": "No GitHub token",
            }

        try:
            url = f"https://api.github.com/repos/{repo}/contents/README.md"
            headers = {"Authorization": f"token {GITHUB_TOKEN}"}
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                return {
                    "requirement": "README.md",
                    "status": "pass",
                    "details": "README exists",
                }
        except Exception as e:
            pass

        return {
            "requirement": "README.md",
            "status": "fail",
            "details": "No README.md in repository",
            "severity": "medium",
        }

    def audit_village(self, village_slug: str, village_config: Dict) -> Dict:
        """Perform compliance audit on a village."""
        violations = []
        checks = []

        # Check health endpoint
        if village_config.get("health_url"):
            checks.append(self.check_health_endpoint(village_slug, village_config["health_url"]))

        # Check GitHub repo
        checks.append(self.check_github_repo(village_slug, village_config.get("repo")))

        # Check changelog
        checks.append(self.check_changelog(village_slug, village_config.get("repo")))

        # Check README
        checks.append(self.check_readme(village_slug, village_config.get("repo")))

        # Collect violations
        for check in checks:
            if check["status"] == "fail":
                violations.append({
                    "requirement": check["requirement"],
                    "details": check["details"],
                    "severity": check.get("severity", "medium"),
                })

        # Calculate compliance score
        pass_count = sum(1 for c in checks if c["status"] == "pass")
        skip_count = sum(1 for c in checks if c["status"] == "skip")
        total = len(checks) - skip_count

        score = (pass_count / total * 100) if total > 0 else 0

        self.index.record_audit(village_slug, score, violations)

        return {
            "village_slug": village_slug,
            "village_name": village_config["name"],
            "compliance_score": score,
            "violations": violations,
            "checks": checks,
        }

    def audit_all_villages(self) -> List[Dict]:
        """Audit all known villages."""
        results = []
        for slug, config in VILLAGES.items():
            result = self.audit_village(slug, config)
            results.append(result)
        return results


def generate_report(audits: List[Dict]) -> str:
    lines = ["⚖️ **Master of Laws Report** — Gekko Standard Compliance"]
    lines.append("")

    # Summary
    total_villages = len(audits)
    avg_score = sum(a["compliance_score"] for a in audits) / total_villages if audits else 0
    compliant = sum(1 for a in audits if a["compliance_score"] == 100)

    lines.append(f"**Summary:** {compliant}/{total_villages} villages fully compliant (avg: {avg_score:.0f}%)")
    lines.append("")

    # Per-village details
    for audit in sorted(audits, key=lambda a: a["compliance_score"]):
        emoji = "✅" if audit["compliance_score"] == 100 else "⚠️" if audit["compliance_score"] >= 75 else "🔴"
        lines.append(f"{emoji} **{audit['village_name']}** — {audit['compliance_score']:.0f}%")

        if audit["violations"]:
            for v in audit["violations"]:
                severity_emoji = "🔴" if v["severity"] == "critical" else "🟡" if v["severity"] == "high" else "⚪"
                lines.append(f"   {severity_emoji} {v['requirement']}: {v['details']}")

        lines.append("")

    return "\n".join(lines)


def send_telegram(message: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    data = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "Markdown"
    }

    try:
        requests.post(url, json=data, timeout=10)
    except Exception as e:
        print(f"Failed to send Telegram: {e}")


def main():
    index = MasterOfLawsIndex()
    checker = MasterOfLawsChecker(index)

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "audit":
            audits = checker.audit_all_villages()
            report = generate_report(audits)
            print(report)

        elif command == "report":
            audits = checker.audit_all_villages()
            report = generate_report(audits)
            send_telegram(report)

        elif command == "db":
            print(f"Database: {DB_PATH}")
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT count(*) FROM compliance_audits")
                print(f"Audits: {cursor.fetchone()[0]}")
                cursor.execute("SELECT count(*) FROM violations")
                print(f"Violations: {cursor.fetchone()[0]}")

    else:
        audits = checker.audit_all_villages()
        report = generate_report(audits)
        print(report)


if __name__ == "__main__":
    main()
