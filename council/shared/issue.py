"""
Kingdom Issue Helper — opens GitHub Issues in the correct village repo.

Usage:
    from council.shared.issue import open_issue, issue_exists

    open_issue(
        village="admin-center",
        title="Fix critical vuln: lodash CVE-2024-1234",
        body="Details...",
        source="steward",
        severity="critical",
    )
"""
import json
import os
import subprocess
from pathlib import Path

REPOS_CONFIG = Path(os.environ.get(
    "KINGDOM_REPOS_CONFIG",
    Path.home() / "admin-center" / "data" / "github-repos.json",
))

# Labels applied by each agent source — must exist in the target repo
SOURCE_LABELS = {
    "steward": ["agent-raised", "steward"],
    "captain": ["agent-raised", "captain"],
    "master-of-laws": ["agent-raised", "master-of-laws"],
    "master-builder": ["agent-raised", "master-builder"],
}

SEVERITY_LABELS = {
    "critical": ["critical"],
    "high": ["high"],
    "waiting-upstream": ["waiting-upstream"],
}


def _load_registry() -> dict[str, dict]:
    if not REPOS_CONFIG.exists():
        return {}
    data = json.loads(REPOS_CONFIG.read_text())
    return {r["village"]: r for r in data.get("repos", [])}


def _repo_slug(village: str) -> str | None:
    registry = _load_registry()
    entry = registry.get(village)
    if not entry:
        return None
    return f"{entry['owner']}/{entry['repo']}"


def issue_exists(village: str, title: str) -> bool:
    """Return True if an open issue with this exact title already exists in the village repo."""
    slug = _repo_slug(village)
    if not slug:
        return False
    try:
        result = subprocess.run(
            ["gh", "issue", "list", "--repo", slug, "--state", "open",
             "--search", f'"{title}" in:title', "--json", "title", "--limit", "10"],
            capture_output=True, text=True, timeout=15,
        )
        issues = json.loads(result.stdout or "[]")
        return any(i["title"].strip() == title.strip() for i in issues)
    except Exception:
        return False


def open_issue(
    village: str,
    title: str,
    body: str,
    source: str,
    severity: str = "",
) -> str | None:
    """
    Open a GitHub Issue in the village's repo. Returns the issue URL or None on failure.
    Skips silently if an open issue with the same title already exists (dedup).
    """
    slug = _repo_slug(village)
    if not slug:
        print(f"[issue] No repo registered for village '{village}' — skipping", flush=True)
        return None

    if issue_exists(village, title):
        print(f"[issue] Already open: '{title}' in {slug} — skipping", flush=True)
        return None

    labels = SOURCE_LABELS.get(source, ["agent-raised"])
    if severity in SEVERITY_LABELS:
        labels = labels + SEVERITY_LABELS[severity]

    try:
        result = subprocess.run(
            ["gh", "issue", "create",
             "--repo", slug,
             "--title", title,
             "--body", body,
             "--label", ",".join(labels)],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            url = result.stdout.strip()
            print(f"[issue] Opened: {url}", flush=True)
            return url
        print(f"[issue] Failed to open issue in {slug}: {result.stderr.strip()}", flush=True)
        return None
    except Exception as e:
        print(f"[issue] Error: {e}", flush=True)
        return None
