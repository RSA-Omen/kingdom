# The Maester

Institutional memory for the kingdom. Reads the realm's books (filesystem, git history) and keeps them indexed. Answers questions about what exists, what's new, what's stale.

For the full spec, see `~/Kingdom/docs/council/the-maester.md`.

## Usage

```bash
cd ~/Kingdom

# Run the daily scan
python -m council.the-maester scan

# Dump the full index (JSON)
python -m council.the-maester index

# Show what's new and what's stale (markdown brief)
python -m council.the-maester brief

# Raw database query (debug)
python -m council.the-maester db "SELECT name, type FROM projects LIMIT 5"
```

Or via the wrapper:

```bash
~/Kingdom/bin/maester scan
~/Kingdom/bin/maester brief
```

## State

The index lives at `~/.maester-index.db` (SQLite).

Tables:
- `projects` — discovered projects (apps, libs, scripts, services)
- `repos` — git repositories (clone URLs, branches, recent commits)
- `recent_commits` — commits from the last week (for quick lookups)
- `snapshots` — historical scan records

## What v0 does

**Daily scan:**
- Walk the home directory up to 3 levels deep
- Discover projects (README.md, git repos, src/ directories)
- For each repo: fetch last commit, branch info, recent commits
- Store findings in SQLite

**Reports:**
- Markdown brief: what's new (last 24h), what's stale (>30 days)
- Full index (JSON): for the dashboard or programmatic use

**Interactive queries:**
- `ask "What apps do we have?"` → lists all apps with status
- `ask "What's new?"` → recent commits across repos
- `ask "What's stale?"` → projects untouched >30 days
- `ask "How many projects?"` → inventory breakdown by type
- `ask <project-name>` → search by name

**No external dependencies** — uses only stdlib (sqlite3, subprocess, pathlib).

## Scheduling

Runs daily at 06:15 CAT (via cron or systemd timer), after The Hand's 06:00 brief.

Example cron entry:
```
15 6 * * * cd ~/Kingdom && python -m council.the-maester scan >> .maester-cron.log 2>&1
```

## Next steps (v1+)

- Interactive Q&A mode (ask questions like "what's new in the backend?")
- Full-text search over commits
- Database schema snapshots
- Alerts on stale repos
