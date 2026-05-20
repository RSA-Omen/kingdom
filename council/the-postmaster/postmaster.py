#!/usr/bin/env python3
"""
The Postmaster — sorts the king's Gekko M365 inbox and Teams DMs into village-tagged
to-do drafts, files FYI mail, and sweeps clutter to archive on king-approved rules.

v0: stubs only. No Graph auth, no SQLite, no classification. See
docs/council/the-postmaster.md for the v1 work plan.
"""

import sys
from pathlib import Path

DB_PATH = Path.home() / ".postmaster.db"

COMMANDS = ("run", "cleanup", "status")


def run() -> int:
    """Triage cycle: read Outlook + Teams DMs, classify, file, draft to-dos.

    v0 stub. v1 wires Microsoft Graph delta queries, Claude classification,
    folder filing, and writes to `postmaster_drafts`.
    """
    print("The Postmaster: run() — not yet implemented (v0 stub).")
    print(f"  Will read Gekko M365 inbox + Teams DMs every 10 minutes.")
    print(f"  Will write drafts to {DB_PATH}.")
    return 0


def cleanup() -> int:
    """Cleanup sweep: apply king-approved rules to archive matching mail.

    v0 stub. v1 reads `postmaster_cleanup_rules WHERE approved_at IS NOT NULL`,
    moves matching messages to `Postmaster/03-Archive` via the Graph move API,
    and writes a sweep summary to `postmaster_sweeps`.

    No Graph delete endpoint is called anywhere in v1 — archive-only.
    """
    print("The Postmaster: cleanup() — not yet implemented (v0 stub).")
    print("  Will scan inbox + Postmaster/01 + Postmaster/02 every 6 hours")
    print("  and apply king-approved rules from postmaster_cleanup_rules.")
    print("  Action is always 'archive' (move to Postmaster/03-Archive).")
    print("  Hard-delete deferred to v2.")
    return 0


def status() -> int:
    """Report current state: DB existence, last run, last sweep."""
    print("The Postmaster: status() — not yet implemented (v0 stub).")
    print(f"  DB: {DB_PATH} ({'exists' if DB_PATH.exists() else 'not yet created'})")
    return 0


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else "status"

    if command == "run":
        sys.exit(run())
    elif command == "cleanup":
        sys.exit(cleanup())
    elif command == "status":
        sys.exit(status())
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print(f"Commands: {' | '.join(COMMANDS)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
