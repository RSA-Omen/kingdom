"""Asana API wrapper for The Lord Chamberlain."""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

import requests

from constants import (
    ASANA_BASE_URL,
    CF_PRIORITY,
    CF_TASK_STATUS,
    LC_TAG_NAME,
)

log = logging.getLogger(__name__)

_CACHE_FILE = Path(__file__).parent / ".cf_cache.json"
_CACHE_MAX_AGE = 86400  # 1 day


def _headers() -> dict:
    token = os.environ.get("ASANA_API_TOKEN", "")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def check_pat() -> bool:
    """Return True if the PAT is valid; False on 401/403."""
    try:
        resp = requests.get(f"{ASANA_BASE_URL}/users/me", headers=_headers(), timeout=10)
        if resp.status_code in (401, 403):
            log.error("Asana PAT is invalid (HTTP %s)", resp.status_code)
            return False
        resp.raise_for_status()
        return True
    except requests.RequestException as exc:
        log.error("PAT health check failed: %s", exc)
        # Network errors are not a PAT failure — let cycle continue
        return True


# ---------------------------------------------------------------------------
# Task fetching
# ---------------------------------------------------------------------------

def get_my_recently_assigned(user_task_list_gid: str) -> list[dict]:
    """Fetch all incomplete tasks from the user's Recently Assigned list."""
    params = {
        "completed_since": "now",
        "limit": 100,
        "opt_fields": "gid,name,notes,tags,tags.gid,tags.name",
    }
    try:
        resp = requests.get(
            f"{ASANA_BASE_URL}/user_task_lists/{user_task_list_gid}/tasks",
            headers=_headers(),
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        tasks = resp.json().get("data", [])
        # TODO Phase 1+: handle next_page for lists > 100 tasks
        return tasks
    except requests.RequestException as exc:
        log.error("Failed to fetch recently assigned tasks: %s", exc)
        return []


def get_task_stories_since(task_gid: str, since_unix: int) -> list[dict]:
    """Fetch comments added to a task since a given Unix timestamp.

    # TODO Phase 3 — used by the re-triage loop.
    """
    try:
        resp = requests.get(
            f"{ASANA_BASE_URL}/tasks/{task_gid}/stories",
            headers=_headers(),
            params={"opt_fields": "gid,created_at,text,type"},
            timeout=10,
        )
        resp.raise_for_status()
        stories = resp.json().get("data", [])
        return [
            s for s in stories
            if s.get("type") == "comment"
            and _iso_to_unix(s.get("created_at", "")) >= since_unix
        ]
    except requests.RequestException as exc:
        log.error("Failed to fetch stories for task %s: %s", task_gid, exc)
        return []


def _iso_to_unix(iso: str) -> int:
    if not iso:
        return 0
    from datetime import datetime, timezone
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return int(dt.timestamp())
    except ValueError:
        return 0


# ---------------------------------------------------------------------------
# Task mutation
# ---------------------------------------------------------------------------

def update_task_fields(task_gid: str, priority_gid: str, status_gid: str) -> bool:
    """Set Priority and Task Status custom fields on a task."""
    payload = {
        "data": {
            "custom_fields": {
                CF_PRIORITY:   priority_gid,
                CF_TASK_STATUS: status_gid,
            }
        }
    }
    try:
        resp = requests.put(
            f"{ASANA_BASE_URL}/tasks/{task_gid}",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except requests.RequestException as exc:
        log.error("Failed to update fields on task %s: %s", task_gid, exc)
        return False


def move_task_to_section(task_gid: str, project_gid: str, section_gid: str) -> bool:
    """Add task to a project's section (handles cross-project moves)."""
    payload = {"data": {"project": project_gid, "section": section_gid}}
    try:
        resp = requests.post(
            f"{ASANA_BASE_URL}/tasks/{task_gid}/addProject",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except requests.RequestException as exc:
        log.error("Failed to move task %s to section %s: %s", task_gid, section_gid, exc)
        return False


def add_tag(task_gid: str, tag_gid: str) -> bool:
    """Add a tag to a task."""
    payload = {"data": {"tag": tag_gid}}
    try:
        resp = requests.post(
            f"{ASANA_BASE_URL}/tasks/{task_gid}/addTag",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except requests.RequestException as exc:
        log.error("Failed to add tag %s to task %s: %s", tag_gid, task_gid, exc)
        return False


def remove_tag(task_gid: str, tag_gid: str) -> bool:
    """Remove a tag from a task.

    # TODO Phase 3 — used by the re-triage loop.
    """
    payload = {"data": {"tag": tag_gid}}
    try:
        resp = requests.post(
            f"{ASANA_BASE_URL}/tasks/{task_gid}/removeTag",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except requests.RequestException as exc:
        log.error("Failed to remove tag %s from task %s: %s", tag_gid, task_gid, exc)
        return False


def add_comment(task_gid: str, text: str) -> bool:
    """Post a comment on a task."""
    payload = {"data": {"text": text}}
    try:
        resp = requests.post(
            f"{ASANA_BASE_URL}/tasks/{task_gid}/stories",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except requests.RequestException as exc:
        log.error("Failed to add comment to task %s: %s", task_gid, exc)
        return False


def create_task(
    project_gid: str,
    section_gid: str,
    name: str,
    notes: str,
    assignee_gid: str,
) -> Optional[dict]:
    """Create a new task in a project section and return the task dict.

    # TODO Phase 4 — used by paste-to-ticket endpoint.
    """
    payload = {
        "data": {
            "name": name,
            "notes": notes,
            "assignee": assignee_gid,
            "projects": [project_gid],
            "memberships": [{"project": project_gid, "section": section_gid}],
        }
    }
    try:
        resp = requests.post(
            f"{ASANA_BASE_URL}/tasks",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json().get("data")
    except requests.RequestException as exc:
        log.error("Failed to create task in project %s: %s", project_gid, exc)
        return None


# ---------------------------------------------------------------------------
# Tag management
# ---------------------------------------------------------------------------

def get_or_create_tag(workspace_gid: str, name: str) -> Optional[str]:
    """Return the GID of the named tag, creating it if it doesn't exist."""
    try:
        resp = requests.get(
            f"{ASANA_BASE_URL}/tags",
            headers=_headers(),
            params={"workspace": workspace_gid, "opt_fields": "gid,name", "limit": 100},
            timeout=10,
        )
        resp.raise_for_status()
        for tag in resp.json().get("data", []):
            if tag.get("name", "").lower() == name.lower():
                log.debug("Found existing tag '%s' (gid=%s)", name, tag["gid"])
                return tag["gid"]

        # Tag not found — create it
        payload = {"data": {"name": name, "workspace": workspace_gid}}
        create_resp = requests.post(
            f"{ASANA_BASE_URL}/tags",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        create_resp.raise_for_status()
        gid = create_resp.json()["data"]["gid"]
        log.info("Created tag '%s' (gid=%s)", name, gid)
        return gid
    except requests.RequestException as exc:
        log.error("Failed to get/create tag '%s': %s", name, exc)
        return None


# ---------------------------------------------------------------------------
# Custom-field enum cache
# ---------------------------------------------------------------------------

def get_cf_enum_cache() -> dict:
    """Return cached enum option GIDs for Priority and Task Status.

    Cache lives at council/lord-chamberlain/.cf_cache.json.
    Refreshes when older than 24 hours.
    Structure: {"priority": {"High": "gid", ...}, "task_status": {"In Progress": "gid", ...}}
    """
    if _CACHE_FILE.exists():
        age = time.time() - _CACHE_FILE.stat().st_mtime
        if age < _CACHE_MAX_AGE:
            try:
                return json.loads(_CACHE_FILE.read_text())
            except json.JSONDecodeError:
                pass

    log.info("Refreshing CF enum cache from Asana API")
    cache = {
        "priority":    _fetch_enum_options(CF_PRIORITY),
        "task_status": _fetch_enum_options(CF_TASK_STATUS),
    }
    _CACHE_FILE.write_text(json.dumps(cache, indent=2))
    return cache


def _fetch_enum_options(cf_gid: str) -> dict:
    """Return {option_name: option_gid} for an enum custom field."""
    try:
        resp = requests.get(
            f"{ASANA_BASE_URL}/custom_fields/{cf_gid}",
            headers=_headers(),
            params={"opt_fields": "enum_options,enum_options.gid,enum_options.name,enum_options.enabled"},
            timeout=10,
        )
        resp.raise_for_status()
        options = resp.json().get("data", {}).get("enum_options", [])
        return {
            opt["name"]: opt["gid"]
            for opt in options
            if opt.get("enabled", True)
        }
    except requests.RequestException as exc:
        log.error("Failed to fetch enum options for CF %s: %s", cf_gid, exc)
        return {}
