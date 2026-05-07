#!/usr/bin/env python3
"""
The Master of Coin — Watches the realm's finances.
Tracks infrastructure spend signals, Docker disk usage, system disk, and
time saved through automation.
"""

import os
import sys
import json
import shutil
import sqlite3
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

HOME = Path.home()
DB_PATH = HOME / ".coin.db"
KINGDOM_ENV = HOME / ".kingdom.env"
APP_REGISTRY_DB = Path("/home/lauchlandupreez/admin-center/data/app-registry.db")


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

class CoinIndex:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY,
                    scanned_at TEXT NOT NULL,
                    time_saved_hours REAL,
                    docker_images_size TEXT,
                    docker_containers_size TEXT,
                    docker_volumes_size TEXT,
                    docker_build_cache_size TEXT,
                    disk_used_gb REAL,
                    disk_total_gb REAL,
                    disk_percent REAL,
                    per_app_json TEXT,
                    top_containers_json TEXT,
                    docker_available INTEGER NOT NULL DEFAULT 1
                )
            """)
            conn.commit()

    def save_snapshot(self, data: Dict):
        now = datetime.utcnow().isoformat()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO snapshots (
                    scanned_at,
                    time_saved_hours,
                    docker_images_size,
                    docker_containers_size,
                    docker_volumes_size,
                    docker_build_cache_size,
                    disk_used_gb,
                    disk_total_gb,
                    disk_percent,
                    per_app_json,
                    top_containers_json,
                    docker_available
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    now,
                    data.get("time_saved_hours"),
                    data.get("docker_images_size"),
                    data.get("docker_containers_size"),
                    data.get("docker_volumes_size"),
                    data.get("docker_build_cache_size"),
                    data.get("disk_used_gb"),
                    data.get("disk_total_gb"),
                    data.get("disk_percent"),
                    json.dumps(data.get("per_app", [])),
                    json.dumps(data.get("top_containers", [])),
                    1 if data.get("docker_available", True) else 0,
                ),
            )
            conn.commit()

    def latest_snapshot(self) -> Optional[Dict]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM snapshots ORDER BY scanned_at DESC LIMIT 1"
            ).fetchone()
            if not row:
                return None
            # PRAGMA table_info returns (cid, name, type, notnull, dflt_value, pk)
            cols = [d[1] for d in conn.execute("PRAGMA table_info(snapshots)").fetchall()]
        result = dict(zip(cols, row))
        result["per_app"] = json.loads(result.get("per_app_json") or "[]")
        result["top_containers"] = json.loads(result.get("top_containers_json") or "[]")
        return result


# ---------------------------------------------------------------------------
# Data collection
# ---------------------------------------------------------------------------

def _collect_time_saved() -> Tuple[float, List[Dict]]:
    """
    Query app-registry for automation_time_seconds and usage counts.
    Returns (total_hours_saved, per_app_list).
    """
    if not APP_REGISTRY_DB.exists():
        return 0.0, []

    try:
        conn = sqlite3.connect(f"file:{APP_REGISTRY_DB}?mode=ro", uri=True)
        apps = conn.execute(
            "SELECT id, name, slug, automation_time_seconds FROM apps WHERE automation_time_seconds IS NOT NULL"
        ).fetchall()

        usage_counts = {}
        for row in conn.execute(
            "SELECT app_slug, count(*) FROM usage_events GROUP BY app_slug"
        ).fetchall():
            usage_counts[row[0]] = row[1]

        conn.close()
    except Exception as e:
        print(f"Warning: could not read app-registry: {e}", file=sys.stderr)
        return 0.0, []

    per_app = []
    total_seconds = 0.0

    for app_id, name, slug, automation_time_seconds in apps:
        count = usage_counts.get(slug, 0)
        saved_seconds = automation_time_seconds * count
        total_seconds += saved_seconds
        per_app.append({
            "name": name,
            "slug": slug,
            "usage_count": count,
            "automation_time_seconds": automation_time_seconds,
            "saved_seconds": saved_seconds,
            "saved_hours": round(saved_seconds / 3600, 2),
        })

    per_app.sort(key=lambda x: x["saved_seconds"], reverse=True)
    return round(total_seconds / 3600, 2), per_app


def _collect_docker() -> Dict:
    """
    Run docker system df --format json to get disk usage.
    Returns dict with size fields, or marks docker_available=False on failure.
    """
    result = {
        "docker_available": False,
        "docker_images_size": None,
        "docker_containers_size": None,
        "docker_volumes_size": None,
        "docker_build_cache_size": None,
    }

    try:
        proc = subprocess.run(
            ["docker", "system", "df", "--format", "{{json .}}"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if proc.returncode != 0:
            return result

        for line in proc.stdout.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            t = obj.get("Type", "")
            size = obj.get("Size", "0B")
            if t == "Images":
                result["docker_images_size"] = size
            elif t == "Containers":
                result["docker_containers_size"] = size
            elif t == "Local Volumes":
                result["docker_volumes_size"] = size
            elif t == "Build Cache":
                result["docker_build_cache_size"] = size

        result["docker_available"] = True
    except FileNotFoundError:
        pass  # docker not installed
    except subprocess.TimeoutExpired:
        print("Warning: docker system df timed out", file=sys.stderr)
    except Exception as e:
        print(f"Warning: docker system df failed: {e}", file=sys.stderr)

    return result


def _collect_docker_stats() -> List[Dict]:
    """
    Run docker stats --no-stream to get container memory usage.
    Returns top 5 containers by memory (parsed MiB value).
    """
    containers = []
    try:
        proc = subprocess.run(
            ["docker", "stats", "--no-stream", "--format",
             "{{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if proc.returncode != 0:
            return containers

        for line in proc.stdout.strip().splitlines():
            parts = line.strip().split("\t")
            if len(parts) < 3:
                continue
            name, mem_usage, cpu_perc = parts[0], parts[1], parts[2]
            # mem_usage looks like "93.8MiB / 31.32GiB"
            mem_used_str = mem_usage.split("/")[0].strip()
            mem_mib = _parse_mem_to_mib(mem_used_str)
            containers.append({
                "name": name,
                "mem_usage": mem_usage,
                "mem_mib": mem_mib,
                "cpu_perc": cpu_perc,
            })

        containers.sort(key=lambda x: x["mem_mib"], reverse=True)
        return containers[:5]

    except FileNotFoundError:
        return []
    except subprocess.TimeoutExpired:
        print("Warning: docker stats timed out", file=sys.stderr)
        return []
    except Exception as e:
        print(f"Warning: docker stats failed: {e}", file=sys.stderr)
        return []


def _parse_mem_to_mib(s: str) -> float:
    """Convert memory string like '93.8MiB', '2.208GiB', '512MB' to MiB float."""
    s = s.strip()
    try:
        if s.endswith("GiB"):
            return float(s[:-3]) * 1024
        if s.endswith("MiB"):
            return float(s[:-3])
        if s.endswith("KiB"):
            return float(s[:-3]) / 1024
        if s.endswith("GB"):
            return float(s[:-2]) * 953.674
        if s.endswith("MB"):
            return float(s[:-2])
        if s.endswith("KB"):
            return float(s[:-2]) / 1024
        if s.endswith("B"):
            return float(s[:-1]) / (1024 * 1024)
    except ValueError:
        pass
    return 0.0


def _collect_disk() -> Dict:
    """Return root partition disk usage."""
    try:
        usage = shutil.disk_usage("/")
        gb = 1024 ** 3
        used_gb = round(usage.used / gb, 1)
        total_gb = round(usage.total / gb, 1)
        percent = round(usage.used / usage.total * 100, 1)
        return {
            "disk_used_gb": used_gb,
            "disk_total_gb": total_gb,
            "disk_percent": percent,
        }
    except Exception as e:
        print(f"Warning: could not read disk usage: {e}", file=sys.stderr)
        return {"disk_used_gb": None, "disk_total_gb": None, "disk_percent": None}


# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------

def run_scan() -> Dict:
    """Collect all metrics and persist to DB. Returns the data dict."""
    print("Collecting time saved from app-registry…")
    total_hours, per_app = _collect_time_saved()

    print("Collecting Docker disk usage…")
    docker = _collect_docker()

    print("Collecting container memory…")
    top_containers = _collect_docker_stats()

    print("Collecting system disk…")
    disk = _collect_disk()

    data = {
        "time_saved_hours": total_hours,
        "per_app": per_app,
        "top_containers": top_containers,
        "docker_available": docker["docker_available"],
        "docker_images_size": docker["docker_images_size"],
        "docker_containers_size": docker["docker_containers_size"],
        "docker_volumes_size": docker["docker_volumes_size"],
        "docker_build_cache_size": docker["docker_build_cache_size"],
        **disk,
    }

    index = CoinIndex()
    index.save_snapshot(data)
    return data


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def generate_report(data: Dict) -> str:
    lines = ["# Master of Coin — Finance Snapshot", ""]

    # Time saved
    lines.append("## Time Saved by Automation")
    total_h = data.get("time_saved_hours", 0) or 0
    lines.append(f"**Total: {total_h:.1f} hours**")
    lines.append("")
    per_app = data.get("per_app") or []
    if per_app:
        lines.append("| App | Uses | Per Use | Saved |")
        lines.append("|-----|------|---------|-------|")
        for app in per_app:
            per_use = app["automation_time_seconds"]
            per_use_str = f"{per_use}s" if per_use < 60 else f"{per_use // 60}m {per_use % 60}s"
            lines.append(
                f"| {app['name']} | {app['usage_count']} | {per_use_str} | {app['saved_hours']:.1f}h |"
            )
    else:
        lines.append("No usage data available.")
    lines.append("")

    # Docker disk
    lines.append("## Docker Disk Usage")
    if data.get("docker_available"):
        lines.append(f"- Images:      {data.get('docker_images_size', 'n/a')}")
        lines.append(f"- Containers:  {data.get('docker_containers_size', 'n/a')}")
        lines.append(f"- Volumes:     {data.get('docker_volumes_size', 'n/a')}")
        lines.append(f"- Build Cache: {data.get('docker_build_cache_size', 'n/a')}")
    else:
        lines.append("Docker unavailable — could not retrieve disk usage.")
    lines.append("")

    # System disk
    lines.append("## System Disk (root)")
    used = data.get("disk_used_gb")
    total = data.get("disk_total_gb")
    pct = data.get("disk_percent")
    if used is not None:
        lines.append(f"- Used:  {used} GB / {total} GB ({pct}%)")
    else:
        lines.append("Could not read disk usage.")
    lines.append("")

    # Container memory
    lines.append("## Top 5 Containers by Memory")
    top = data.get("top_containers") or []
    if top:
        lines.append("| Container | Memory | CPU |")
        lines.append("|-----------|--------|-----|")
        for c in top:
            lines.append(f"| {c['name']} | {c['mem_usage']} | {c['cpu_perc']} |")
    else:
        lines.append("No container stats available.")

    return "\n".join(lines)


def generate_brief(data: Optional[Dict]) -> str:
    if not data:
        return "Coin: no snapshot — run `scan` first."
    hours = data.get("time_saved_hours") or 0
    pct = data.get("disk_percent") or 0

    # Sum docker disk sizes into a rough total
    docker_parts = []
    for key in ("docker_images_size", "docker_containers_size", "docker_volumes_size", "docker_build_cache_size"):
        val = data.get(key)
        if val:
            docker_parts.append(val)

    if docker_parts:
        # Use images + containers + volumes as the primary "Docker" figure (skip build cache)
        docker_str = data.get("docker_images_size") or "n/a"
        brief_docker = f"Docker images {docker_str}"
    else:
        brief_docker = "Docker unavailable"

    hours_str = f"{hours:.1f}h" if hours < 10 else f"{hours:.0f}h"
    return f"Coin: {hours_str} saved · {brief_docker} · Disk {pct}%"


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
    if not (token and chat_id) and KINGDOM_ENV.exists():
        env = _read_dotenv(KINGDOM_ENV)
        token = token or env.get("TELEGRAM_BOT_TOKEN", "")
        chat_id = chat_id or env.get("TELEGRAM_CHAT_ID", "")
    if not (token and chat_id):
        raise RuntimeError("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not found in ~/.kingdom.env or environment")
    return token, chat_id


def _build_telegram_html(data: Dict) -> str:
    hours = data.get("time_saved_hours") or 0
    per_app = data.get("per_app") or []
    pct = data.get("disk_percent") or 0
    used = data.get("disk_used_gb") or 0
    total = data.get("disk_total_gb") or 0
    top = data.get("top_containers") or []
    docker_available = data.get("docker_available", False)

    lines = [
        "<b>Master of Coin — Finance Digest</b>",
        "",
        f"<b>Time Saved:</b> {hours:.1f} hours total",
    ]

    if per_app:
        for app in per_app:
            if app["usage_count"] > 0:
                lines.append(f"  · {app['name']}: {app['saved_hours']:.1f}h ({app['usage_count']} uses)")

    lines.append("")
    lines.append("<b>Docker Disk:</b>")
    if docker_available:
        lines.append(f"  Images:      {data.get('docker_images_size', 'n/a')}")
        lines.append(f"  Containers:  {data.get('docker_containers_size', 'n/a')}")
        lines.append(f"  Volumes:     {data.get('docker_volumes_size', 'n/a')}")
        lines.append(f"  Build Cache: {data.get('docker_build_cache_size', 'n/a')}")
    else:
        lines.append("  docker unavailable")

    lines.append("")
    lines.append(f"<b>System Disk:</b> {used}GB / {total}GB ({pct}%)")

    if top:
        lines.append("")
        lines.append("<b>Top Containers (memory):</b>")
        for c in top:
            lines.append(f"  · {c['name']}: {c['mem_usage'].split('/')[0].strip()} ({c['cpu_perc']} CPU)")

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
            print(f"Telegram error {resp.status_code}: {resp.text}", file=sys.stderr)
    except Exception as e:
        print(f"Failed to send Telegram: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "scan"

    if command == "scan":
        data = run_scan()
        print()
        print(generate_report(data))

    elif command == "report":
        index = CoinIndex()
        snapshot = index.latest_snapshot()
        if not snapshot:
            print("No snapshot found. Run `scan` first.", file=sys.stderr)
            sys.exit(1)
        print(generate_report(snapshot))

    elif command == "brief":
        index = CoinIndex()
        snapshot = index.latest_snapshot()
        print(generate_brief(snapshot))

    elif command == "telegram":
        index = CoinIndex()
        snapshot = index.latest_snapshot()
        if not snapshot:
            print("No snapshot found. Running scan first…")
            snapshot = run_scan()
        msg = _build_telegram_html(snapshot)
        send_telegram(msg)
        print("Digest sent to Telegram.")

    elif command == "db":
        print(f"Database: {DB_PATH}")
        index = CoinIndex()
        with sqlite3.connect(DB_PATH) as conn:
            count = conn.execute("SELECT count(*) FROM snapshots").fetchone()[0]
            latest_ts = conn.execute(
                "SELECT scanned_at FROM snapshots ORDER BY scanned_at DESC LIMIT 1"
            ).fetchone()
        print(f"Snapshots: {count}")
        if latest_ts:
            print(f"Latest:    {latest_ts[0]}")

    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print("Commands: scan | report | brief | telegram | db", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
