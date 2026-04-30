#!/usr/bin/env python3
"""
The Master of Works — Infrastructure monitor for the Kingdom.
Watches system resources, container health, network connectivity, and storage.
"""

import os
import sys
import sqlite3
import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional, Dict, List, Tuple
import socket
import requests
from urllib.error import URLError
from urllib.request import urlopen

DB_PATH = Path.home() / ".master-of-works.db"
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")


@dataclass
class ResourceSnapshot:
    timestamp: str
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    gpu_memory_percent: Optional[float]
    load_avg_1: float
    load_avg_5: float
    load_avg_15: float


@dataclass
class ServiceStatus:
    timestamp: str
    service_name: str
    is_healthy: bool
    status: str  # "healthy", "degraded", "unhealthy", "unreachable"
    details: str


class MasterOfWorksIndex:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS resource_snapshots (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    cpu_percent REAL,
                    memory_percent REAL,
                    disk_percent REAL,
                    gpu_memory_percent REAL,
                    load_avg_1 REAL,
                    load_avg_5 REAL,
                    load_avg_15 REAL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS service_statuses (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    service_name TEXT NOT NULL,
                    is_healthy INTEGER,
                    status TEXT,
                    details TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS incidents (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    service_name TEXT,
                    incident_type TEXT,
                    severity TEXT,
                    message TEXT,
                    resolved INTEGER DEFAULT 0,
                    resolved_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def record_snapshot(self, snapshot: ResourceSnapshot):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO resource_snapshots
                (timestamp, cpu_percent, memory_percent, disk_percent, gpu_memory_percent,
                 load_avg_1, load_avg_5, load_avg_15)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                snapshot.timestamp, snapshot.cpu_percent, snapshot.memory_percent,
                snapshot.disk_percent, snapshot.gpu_memory_percent,
                snapshot.load_avg_1, snapshot.load_avg_5, snapshot.load_avg_15
            ))
            conn.commit()

    def record_service_status(self, status: ServiceStatus):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO service_statuses
                (timestamp, service_name, is_healthy, status, details)
                VALUES (?, ?, ?, ?, ?)
            """, (status.timestamp, status.service_name, status.is_healthy, status.status, status.details))
            conn.commit()

    def get_latest_snapshot(self) -> Optional[ResourceSnapshot]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute("""
                SELECT timestamp, cpu_percent, memory_percent, disk_percent, gpu_memory_percent,
                       load_avg_1, load_avg_5, load_avg_15
                FROM resource_snapshots
                ORDER BY timestamp DESC LIMIT 1
            """).fetchone()
            if row:
                return ResourceSnapshot(
                    timestamp=row[0], cpu_percent=row[1], memory_percent=row[2],
                    disk_percent=row[3], gpu_memory_percent=row[4],
                    load_avg_1=row[5], load_avg_5=row[6], load_avg_15=row[7]
                )
        return None

    def get_service_history(self, service_name: str, hours: int = 24) -> List[ServiceStatus]:
        with sqlite3.connect(self.db_path) as conn:
            cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
            rows = conn.execute("""
                SELECT timestamp, service_name, is_healthy, status, details
                FROM service_statuses
                WHERE service_name = ? AND timestamp > ?
                ORDER BY timestamp DESC
            """, (service_name, cutoff)).fetchall()
            return [
                ServiceStatus(row[0], row[1], bool(row[2]), row[3], row[4])
                for row in rows
            ]

    def record_incident(self, service_name: str, incident_type: str, severity: str, message: str):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO incidents (timestamp, service_name, incident_type, severity, message)
                VALUES (?, ?, ?, ?, ?)
            """, (datetime.utcnow().isoformat(), service_name, incident_type, severity, message))
            conn.commit()


class MasterOfWorksChecker:
    def __init__(self, index: MasterOfWorksIndex):
        self.index = index
        self.thresholds = {
            "cpu_warn": 80,
            "cpu_crit": 95,
            "memory_warn": 80,
            "memory_crit": 95,
            "disk_warn": 80,
            "disk_crit": 90,
            "gpu_warn": 85,
            "gpu_crit": 95,
        }

    def get_system_resources(self) -> Optional[ResourceSnapshot]:
        try:
            import psutil
        except ImportError:
            return None

        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            load_avg = os.getloadavg()

            gpu_memory = self._get_gpu_memory()

            snapshot = ResourceSnapshot(
                timestamp=datetime.utcnow().isoformat(),
                cpu_percent=cpu_percent,
                memory_percent=mem.percent,
                disk_percent=disk.percent,
                gpu_memory_percent=gpu_memory,
                load_avg_1=load_avg[0],
                load_avg_5=load_avg[1],
                load_avg_15=load_avg[2],
            )
            return snapshot
        except Exception as e:
            print(f"Error getting system resources: {e}")
            return None

    def _get_gpu_memory(self) -> Optional[float]:
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,nounits,noheader"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                used, total = map(int, result.stdout.strip().split(","))
                return (used / total) * 100
        except Exception:
            pass
        return None

    def check_docker(self) -> ServiceStatus:
        try:
            result = subprocess.run(
                ["docker", "info"],
                capture_output=True,
                timeout=5
            )
            is_healthy = result.returncode == 0
            status = ServiceStatus(
                timestamp=datetime.utcnow().isoformat(),
                service_name="Docker",
                is_healthy=is_healthy,
                status="healthy" if is_healthy else "unhealthy",
                details="Docker daemon responding" if is_healthy else "Docker daemon not responding"
            )
        except Exception as e:
            status = ServiceStatus(
                timestamp=datetime.utcnow().isoformat(),
                service_name="Docker",
                is_healthy=False,
                status="unreachable",
                details=str(e)
            )
        return status

    def check_service_health(self, url: str, service_name: str, timeout: int = 5) -> ServiceStatus:
        try:
            response = urlopen(url, timeout=timeout)
            is_healthy = 200 <= response.status < 300
            status = ServiceStatus(
                timestamp=datetime.utcnow().isoformat(),
                service_name=service_name,
                is_healthy=is_healthy,
                status="healthy" if is_healthy else "degraded",
                details=f"HTTP {response.status}"
            )
        except URLError as e:
            status = ServiceStatus(
                timestamp=datetime.utcnow().isoformat(),
                service_name=service_name,
                is_healthy=False,
                status="unreachable",
                details=str(e.reason)[:100]
            )
        except Exception as e:
            status = ServiceStatus(
                timestamp=datetime.utcnow().isoformat(),
                service_name=service_name,
                is_healthy=False,
                status="unreachable",
                details=str(e)[:100]
            )
        return status

    def perform_checks(self) -> Tuple[Optional[ResourceSnapshot], List[ServiceStatus]]:
        snapshot = self.get_system_resources()
        if snapshot:
            self.index.record_snapshot(snapshot)

        statuses = []
        docker_status = self.check_docker()
        statuses.append(docker_status)
        self.index.record_service_status(docker_status)

        services = {
            "Open WebUI": "http://localhost:3005/health",
            "Local API": "http://localhost:8080/health",
            "Kanban AI": "http://localhost:5002/health",
            "Admin Center API": "http://localhost:5001/health",
        }

        for service_name, url in services.items():
            status = self.check_service_health(url, service_name)
            statuses.append(status)
            self.index.record_service_status(status)

        return snapshot, statuses


def generate_report(snapshot: Optional[ResourceSnapshot], statuses: List[ServiceStatus]) -> str:
    lines = ["🏰 **Infrastructure Report** — The Master of Works"]
    lines.append("")

    if snapshot:
        lines.append("**System Resources:**")
        cpu_emoji = "🟢" if snapshot.cpu_percent < 80 else "🟡" if snapshot.cpu_percent < 95 else "🔴"
        mem_emoji = "🟢" if snapshot.memory_percent < 80 else "🟡" if snapshot.memory_percent < 95 else "🔴"
        disk_emoji = "🟢" if snapshot.disk_percent < 80 else "🟡" if snapshot.disk_percent < 90 else "🔴"

        lines.append(f"• {cpu_emoji} CPU: {snapshot.cpu_percent:.1f}%")
        lines.append(f"• {mem_emoji} Memory: {snapshot.memory_percent:.1f}%")
        lines.append(f"• {disk_emoji} Disk: {snapshot.disk_percent:.1f}%")
        if snapshot.gpu_memory_percent is not None:
            gpu_emoji = "🟢" if snapshot.gpu_memory_percent < 85 else "🟡" if snapshot.gpu_memory_percent < 95 else "🔴"
            lines.append(f"• {gpu_emoji} GPU Memory: {snapshot.gpu_memory_percent:.1f}%")
        lines.append(f"• Load: {snapshot.load_avg_1:.2f} {snapshot.load_avg_5:.2f} {snapshot.load_avg_15:.2f}")
        lines.append("")

    lines.append("**Services:**")
    for status in statuses:
        emoji = "✅" if status.is_healthy else "❌"
        lines.append(f"• {emoji} {status.service_name}: {status.status}")
        if not status.is_healthy:
            lines.append(f"  {status.details}")

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
    index = MasterOfWorksIndex()
    checker = MasterOfWorksChecker(index)

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "check":
            snapshot, statuses = checker.perform_checks()
            report = generate_report(snapshot, statuses)
            print(report)

        elif command == "report":
            snapshot, statuses = checker.perform_checks()
            report = generate_report(snapshot, statuses)
            send_telegram(report)

        elif command == "brief":
            snapshot = index.get_latest_snapshot()
            statuses = [
                status for service_name in ["Docker", "Open WebUI", "Local API", "Kanban AI", "Admin Center API"]
                for status in index.get_service_history(service_name, hours=1)
            ][:1]  # Get most recent
            report = generate_report(snapshot, statuses)
            print(report)

        elif command == "db":
            print(f"Database: {DB_PATH}")
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT count(*) FROM resource_snapshots")
                print(f"Resource snapshots: {cursor.fetchone()[0]}")
                cursor.execute("SELECT count(*) FROM service_statuses")
                print(f"Service statuses: {cursor.fetchone()[0]}")
                cursor.execute("SELECT count(*) FROM incidents")
                print(f"Incidents: {cursor.fetchone()[0]}")
    else:
        snapshot, statuses = checker.perform_checks()
        report = generate_report(snapshot, statuses)
        print(report)


if __name__ == "__main__":
    main()
