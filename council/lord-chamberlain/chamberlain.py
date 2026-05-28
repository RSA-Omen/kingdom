#!/usr/bin/env python3
"""The Lord Chamberlain — Digital ticket triage agent.

Polls Asana My Tasks → Recently Assigned every 5 minutes and triages each
new task: classifies via Claude, routes to the correct section, sets custom
fields, adds lc-triaged tag, posts a triage comment, and pings Telegram.

Usage (manual):
    python /home/lauchlandupreez/Kingdom/council/lord-chamberlain/chamberlain.py

Scheduled via systemd user timer lord-chamberlain.timer.
"""

from __future__ import annotations

import logging
import os
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Path setup — allow imports from this directory without package install
# ---------------------------------------------------------------------------
_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))

import asana_client as asana  # noqa: E402
import classifier  # noqa: E402
from constants import (  # noqa: E402
    ASANA_MY_TASKS_GID,
    ASANA_WORKSPACE_GID,
    ASANA_DIGITAL_GID,
    ASANA_IT_SUPPORT_GID,
    KEYWORD_ROUTING,
    LC_TAG_NAME,
    PROJECT_NAMES,
    SECTION_INBOX,
    SECTION_CUSTOMER_SUPPORT,
    SECTION_INTERNAL_SYSTEMS,
    SECTION_IT_NEW_REQUESTS,
    SECTION_NAMES,
    SECTION_PARKING_LOT,
    STATUS_BY_CLASSIFICATION,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [lord-chamberlain] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
HOME = Path.home()
KINGDOM_ENV  = HOME / "Kingdom" / ".env"
KINGDOM_ENV2 = HOME / ".kingdom.env"
CAPITAL_DB   = HOME / "Kingdom" / "capital" / "api" / "data" / "app-registry.db"


# ---------------------------------------------------------------------------
# Environment loading
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


def load_envs() -> None:
    """Populate os.environ from Kingdom .env files for manual runs.

    The systemd EnvironmentFile directive handles this for scheduled runs;
    this function is a no-op if vars are already set.
    """
    for path in (KINGDOM_ENV, KINGDOM_ENV2):
        for k, v in _read_dotenv(path).items():
            if k not in os.environ or not os.environ[k]:
                os.environ[k] = v


# ---------------------------------------------------------------------------
# Capital DB
# ---------------------------------------------------------------------------

def open_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(CAPITAL_DB), timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_migration(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS lord_chamberlain_processed (
            task_gid        TEXT PRIMARY KEY,
            processed_at    INTEGER NOT NULL,
            classification  TEXT,
            confidence      TEXT,
            github_issue_url TEXT,
            retriage_count  INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.commit()


def is_db_processed(conn: sqlite3.Connection, task_gid: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM lord_chamberlain_processed WHERE task_gid = ?", (task_gid,)
    ).fetchone()
    return row is not None


def mark_processed(
    conn: sqlite3.Connection,
    task_gid: str,
    classification: str,
    confidence: str,
) -> None:
    try:
        conn.execute(
            """INSERT OR IGNORE INTO lord_chamberlain_processed
               (task_gid, processed_at, classification, confidence)
               VALUES (?, ?, ?, ?)""",
            (task_gid, int(time.time()), classification, confidence),
        )
        conn.commit()
    except sqlite3.Error as exc:
        log.error("Failed to mark task %s processed in DB: %s", task_gid, exc)


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------

def send_telegram(text: str) -> None:
    token   = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        log.warning("Telegram credentials missing — notification not sent")
        return
    try:
        payload = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode()
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        with urllib.request.urlopen(url, data=payload, timeout=10) as resp:
            if resp.status != 200:
                log.warning("Telegram returned HTTP %s", resp.status)
    except Exception as exc:
        log.error("Telegram send failed: %s", exc)


# ---------------------------------------------------------------------------
# Routing logic
# ---------------------------------------------------------------------------

def determine_routing(classification: str, text: str) -> tuple[Optional[str], Optional[str]]:
    """Return (project_gid, section_gid) for a classification + task text.

    Returns (None, None) for 'unclear' — task is not moved.
    """
    lower = text.lower()

    if classification == "unclear":
        return None, None

    if classification == "it-request":
        return ASANA_IT_SUPPORT_GID, SECTION_IT_NEW_REQUESTS

    if classification == "support":
        return ASANA_DIGITAL_GID, SECTION_CUSTOMER_SUPPORT

    if classification == "internal-tool":
        return ASANA_DIGITAL_GID, SECTION_INTERNAL_SYSTEMS

    if classification == "rd-idea":
        return ASANA_DIGITAL_GID, SECTION_PARKING_LOT

    # bug / feature — keyword routing
    if classification in ("bug", "feature"):
        for keywords, section_gid in KEYWORD_ROUTING:
            if any(kw in lower for kw in keywords):
                return ASANA_DIGITAL_GID, section_gid
        return ASANA_DIGITAL_GID, SECTION_INBOX

    # Fallback
    return ASANA_DIGITAL_GID, SECTION_INBOX


# ---------------------------------------------------------------------------
# Triage comment
# ---------------------------------------------------------------------------

def format_triage_comment(
    classification: str,
    priority: str,
    confidence: str,
    reasoning: str,
    project_gid: Optional[str],
    section_gid: Optional[str],
) -> str:
    if project_gid and section_gid:
        project_name = PROJECT_NAMES.get(project_gid, project_gid)
        section_name = SECTION_NAMES.get(section_gid, section_gid)
        routing_line = f"{project_name} → {section_name}"
    else:
        routing_line = "My Tasks → Recently Assigned (no routing — insufficient information)"

    return (
        f"🤖 Lord Chamberlain — Triage Report\n\n"
        f"Classification: {classification} (confidence: {confidence})\n"
        f"Priority: {priority}\n"
        f"Routing: {routing_line}\n\n"
        f"Reasoning:\n{reasoning}\n\n"
        f"GitHub: [Phase 2 — not yet wired]\n\n"
        f"To re-triage this task, comment: /retriage"
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_lc_tagged(task: dict, lc_tag_gid: str) -> bool:
    tags = task.get("tags") or []
    return any(t.get("gid") == lc_tag_gid for t in tags)


# ---------------------------------------------------------------------------
# Main cycle
# ---------------------------------------------------------------------------

def run_cycle(conn: sqlite3.Connection, lc_tag_gid: str, cf_cache: dict) -> None:
    # 1. PAT health check
    if not asana.check_pat():
        send_telegram("⚠️ Lord Chamberlain: Asana PAT is invalid or expired. Triage paused.")
        log.error("PAT health check failed — skipping cycle")
        return

    # 2. Fetch tasks
    tasks = asana.get_my_recently_assigned(ASANA_MY_TASKS_GID)
    log.info("Fetched %d incomplete tasks from Recently Assigned", len(tasks))

    new_count = 0
    for task in tasks:
        task_gid  = task.get("gid", "")
        task_name = task.get("name", "(no name)")

        # 3. Skip if already processed (Asana tag OR DB record)
        if is_lc_tagged(task, lc_tag_gid):
            continue
        if is_db_processed(conn, task_gid):
            continue

        log.info("Triaging task %s: %s", task_gid, task_name)

        # 4. Classify with Claude
        result = classifier.classify(task)
        classification = result["classification"]
        priority_name  = result["priority"]
        confidence     = result["confidence"]
        reasoning      = result["reasoning"]

        # 5. Resolve CF enum GIDs
        priority_gid = cf_cache.get("priority", {}).get(priority_name)
        status_name  = STATUS_BY_CLASSIFICATION.get(classification, "Review")
        status_gid   = cf_cache.get("task_status", {}).get(status_name)

        if not priority_gid:
            log.warning("No GID for priority '%s' — skipping field update", priority_name)
        if not status_gid:
            log.warning("No GID for status '%s' — skipping field update", status_name)

        # 6. Determine routing
        project_gid, section_gid = determine_routing(
            classification, f"{task_name} {task.get('notes', '')}"
        )

        # 7. Move to section first so custom fields are in scope (best-effort, skip for unclear)
        if project_gid and section_gid:
            asana.move_task_to_section(task_gid, project_gid, section_gid)

        # 8. Update custom fields (best-effort — requires task to be in the right project)
        if priority_gid and status_gid:
            asana.update_task_fields(task_gid, priority_gid, status_gid)

        # 9. Add lc-triaged tag
        asana.add_tag(task_gid, lc_tag_gid)

        # 10. Post triage comment
        comment = format_triage_comment(
            classification, priority_name, confidence, reasoning,
            project_gid, section_gid,
        )
        asana.add_comment(task_gid, comment)

        # TODO Phase 2: GitHub search + issue creation for bug/feature

        # 11. Mark processed in Capital DB (best-effort)
        mark_processed(conn, task_gid, classification, confidence)

        # 12. Telegram notification (best-effort)
        project_name = PROJECT_NAMES.get(project_gid, "") if project_gid else "My Tasks"
        section_name = SECTION_NAMES.get(section_gid, "") if section_gid else "Recently Assigned"
        tg_text = (
            f"📋 Lord Chamberlain triaged a task\n\n"
            f"*{task_name}*\n"
            f"Classification: {classification} (confidence: {confidence})\n"
            f"Priority: {priority_name}\n"
            f"Routing: {project_name} → {section_name}"
        )
        send_telegram(tg_text)

        new_count += 1
        log.info(
            "Triaged %s — %s / %s → %s / %s",
            task_gid, classification, priority_name, project_name, section_name,
        )

    log.info("Cycle complete: %d new tasks triaged", new_count)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    load_envs()

    log.info("Lord Chamberlain starting")

    # Ensure Capital DB table exists
    try:
        conn = open_db()
        ensure_migration(conn)
    except sqlite3.Error as exc:
        log.critical("Cannot open Capital DB at %s: %s", CAPITAL_DB, exc)
        sys.exit(1)

    # Get / create lc-triaged tag (once per cycle startup)
    lc_tag_gid = asana.get_or_create_tag(ASANA_WORKSPACE_GID, LC_TAG_NAME)
    if not lc_tag_gid:
        log.critical("Could not resolve lc-triaged tag GID — aborting")
        conn.close()
        sys.exit(1)

    # Load CF enum cache (once per cycle startup; refreshes from API if stale)
    cf_cache = asana.get_cf_enum_cache()
    if not cf_cache.get("priority") or not cf_cache.get("task_status"):
        log.warning("CF enum cache is empty or incomplete — custom fields may not be set")

    try:
        run_cycle(conn, lc_tag_gid, cf_cache)
    finally:
        conn.close()

    log.info("Lord Chamberlain done")


if __name__ == "__main__":
    main()
