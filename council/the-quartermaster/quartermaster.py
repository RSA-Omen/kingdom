#!/usr/bin/env python3
"""
The Quartermaster — Resource provisioning advisor for the Kingdom.
Watches quotas, forecasts resource needs, and recommends provisioning.
"""

import os
import sys
import sqlite3
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List, Tuple
import subprocess
import requests

DB_PATH = Path.home() / ".quartermaster.db"
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")


class QuartermasterIndex:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS quotas (
                    id INTEGER PRIMARY KEY,
                    resource_name TEXT UNIQUE NOT NULL,
                    limit_gb REAL,
                    warning_threshold REAL,
                    critical_threshold REAL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS usage_history (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    resource_name TEXT NOT NULL,
                    used_gb REAL,
                    available_gb REAL,
                    percent_used REAL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (resource_name) REFERENCES quotas(resource_name)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS forecasts (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    resource_name TEXT NOT NULL,
                    days_until_full INTEGER,
                    growth_rate_gb_per_day REAL,
                    recommendation TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    resource_name TEXT NOT NULL,
                    alert_type TEXT,
                    message TEXT,
                    severity TEXT,
                    resolved INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def record_usage(self, resource_name: str, used_gb: float, available_gb: float):
        with sqlite3.connect(self.db_path) as conn:
            percent_used = (used_gb / (used_gb + available_gb) * 100) if (used_gb + available_gb) > 0 else 0
            conn.execute("""
                INSERT INTO usage_history (timestamp, resource_name, used_gb, available_gb, percent_used)
                VALUES (?, ?, ?, ?, ?)
            """, (datetime.utcnow().isoformat(), resource_name, used_gb, available_gb, percent_used))
            conn.commit()

    def get_usage_history(self, resource_name: str, hours: int = 24) -> List[Dict]:
        with sqlite3.connect(self.db_path) as conn:
            cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
            rows = conn.execute("""
                SELECT timestamp, used_gb, available_gb, percent_used
                FROM usage_history
                WHERE resource_name = ? AND timestamp > ?
                ORDER BY timestamp ASC
            """, (resource_name, cutoff)).fetchall()
            return [
                {
                    "timestamp": row[0],
                    "used_gb": row[1],
                    "available_gb": row[2],
                    "percent_used": row[3]
                }
                for row in rows
            ]

    def record_forecast(self, resource_name: str, days_until_full: int, growth_rate: float, recommendation: str):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO forecasts (timestamp, resource_name, days_until_full, growth_rate_gb_per_day, recommendation)
                VALUES (?, ?, ?, ?, ?)
            """, (datetime.utcnow().isoformat(), resource_name, days_until_full, growth_rate, recommendation))
            conn.commit()

    def record_alert(self, resource_name: str, alert_type: str, message: str, severity: str):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO alerts (timestamp, resource_name, alert_type, message, severity)
                VALUES (?, ?, ?, ?, ?)
            """, (datetime.utcnow().isoformat(), resource_name, alert_type, message, severity))
            conn.commit()


class QuartermasterChecker:
    def __init__(self, index: QuartermasterIndex):
        self.index = index
        self.resources = {
            "root": ("/", 80),
            "home": (os.path.expanduser("~"), 70),
        }

    def get_disk_usage(self, path: str) -> Tuple[float, float]:
        try:
            import shutil
            usage = shutil.disk_usage(path)
            used_gb = usage.used / (1024 ** 3)
            available_gb = usage.free / (1024 ** 3)
            return used_gb, available_gb
        except Exception as e:
            print(f"Error getting disk usage for {path}: {e}")
            return 0, 0

    def forecast_resource(self, resource_name: str, history: List[Dict], available_gb: float) -> Tuple[int, float, str]:
        if len(history) < 2:
            return -1, 0, "Not enough data for forecast"

        sorted_history = sorted(history, key=lambda x: x["timestamp"])
        first = sorted_history[0]
        last = sorted_history[-1]

        first_time = datetime.fromisoformat(first["timestamp"])
        last_time = datetime.fromisoformat(last["timestamp"])
        time_diff_hours = (last_time - first_time).total_seconds() / 3600

        # Need at least 6 hours of data for a meaningful trend
        if time_diff_hours < 6:
            return -1, 0, f"Collecting data ({time_diff_hours:.1f}h of 6h needed for forecast)"

        growth_gb = last["used_gb"] - first["used_gb"]
        growth_rate_per_day = (growth_gb / time_diff_hours) * 24

        if growth_rate_per_day <= 0:
            return -1, growth_rate_per_day, "Stable or decreasing"

        # Cap implausible growth rates (>10 GB/day is unusual for this server)
        if growth_rate_per_day > 10:
            return -1, growth_rate_per_day, f"Growth rate ({growth_rate_per_day:.1f} GB/day) seems anomalous — check manually"

        days_until_full = available_gb / growth_rate_per_day if growth_rate_per_day > 0 else 999

        if days_until_full < 3:
            recommendation = f"🔴 CRITICAL: {days_until_full:.1f} days until {resource_name} is full."
        elif days_until_full < 7:
            recommendation = f"🟡 WARNING: {days_until_full:.1f} days until {resource_name} needs expansion."
        else:
            recommendation = f"🟢 OK: ~{days_until_full:.0f} days of capacity remaining."

        return int(days_until_full), growth_rate_per_day, recommendation

    def check_resources(self) -> Dict:
        report = {}

        for resource_name, (path, warning_threshold) in self.resources.items():
            used_gb, available_gb = self.get_disk_usage(path)
            self.index.record_usage(resource_name, used_gb, available_gb)

            history = self.index.get_usage_history(resource_name, hours=72)
            days_until_full, growth_rate, recommendation = self.forecast_resource(
                resource_name, history, available_gb
            )

            if history:
                percent_used = history[-1]["percent_used"]
            else:
                percent_used = (used_gb / (used_gb + available_gb) * 100) if (used_gb + available_gb) > 0 else 0

            report[resource_name] = {
                "path": path,
                "used_gb": used_gb,
                "available_gb": available_gb,
                "percent_used": percent_used,
                "days_until_full": days_until_full,
                "growth_rate_gb_per_day": growth_rate,
                "recommendation": recommendation,
                "status": "healthy" if percent_used < warning_threshold else "warning" if percent_used < 90 else "critical",
            }

            if percent_used >= 85:
                self.index.record_alert(
                    resource_name,
                    "disk_space",
                    f"{resource_name} is {percent_used:.1f}% full",
                    "critical" if percent_used >= 95 else "warning"
                )

        return report


def generate_report(report: Dict[str, Dict]) -> str:
    lines = ["📦 **Quartermaster Report** — Resource Provisioning"]
    lines.append("")

    for resource_name, info in report.items():
        emoji = "🔴" if info["status"] == "critical" else "🟡" if info["status"] == "warning" else "🟢"
        lines.append(f"**{emoji} {resource_name.title()}**")
        lines.append(f"• Used: {info['used_gb']:.1f} GB / Available: {info['available_gb']:.1f} GB ({info['percent_used']:.1f}%)")

        if info["days_until_full"] > 0:
            lines.append(f"• Growth: {info['growth_rate_gb_per_day']:.2f} GB/day → {info['days_until_full']} days until full")
        else:
            lines.append(f"• Growth: {info['growth_rate_gb_per_day']:.2f} GB/day")

        lines.append(f"• {info['recommendation']}")
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
    index = QuartermasterIndex()
    checker = QuartermasterChecker(index)

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "check":
            report = checker.check_resources()
            output = generate_report(report)
            print(output)
            # Also output JSON for programmatic use
            print("\n```json")
            print(json.dumps(report, indent=2, default=str))
            print("```")

        elif command == "report":
            report = checker.check_resources()
            output = generate_report(report)
            send_telegram(output)

        elif command == "db":
            print(f"Database: {DB_PATH}")
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT count(*) FROM usage_history")
                print(f"Usage records: {cursor.fetchone()[0]}")
                cursor.execute("SELECT count(*) FROM alerts")
                print(f"Alerts: {cursor.fetchone()[0]}")
                cursor.execute("SELECT count(*) FROM forecasts")
                print(f"Forecasts: {cursor.fetchone()[0]}")

    else:
        report = checker.check_resources()
        output = generate_report(report)
        print(output)


if __name__ == "__main__":
    main()
