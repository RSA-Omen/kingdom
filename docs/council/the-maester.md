# The Maester — Kingdom Council Spec

**Beat:** Institutional memory. Reads the kingdom's books (filesystem, git history, databases). Answers questions about what exists, what's new, what's stale.

**Why:** The king cannot hold everything in his head. The Maester is a searchable, always-up-to-date mirror of the realm.

## What The Maester does

1. **Scans the realm** — walks home directory structure every day
   - What projects exist
   - What's a repo vs. data vs. config
   - Size, purpose, owner, last activity
   
2. **Reads git** — for every repo
   - Recent commits (last week, month)
   - Branches
   - Tag timeline
   - Who worked on what
   
3. **Indexes codebase** — for each project
   - File structure
   - Key dependencies
   - Main languages
   - README + documentation
   
4. **Tracks databases** — for services that have them
   - SQLite/Postgres schema snapshots
   - Row counts
   - Last backup date
   
5. **Answers questions** — when asked
   - "What apps do we have?" → lists villages with status
   - "What's new?" → recent commits across all repos
   - "What's dusty?" → repos untouched >30 days
   - "Who owns X?" → git blame / maintainer
   - "What changed in the last week?" → commit summary
   - "Show me the schema for X" → database structure

## Implementation layers (v0 → v1 → v2)

### v0 (this build)
- ✅ Scan filesystem: list all projects, parse README.md
- ✅ Index git: recent commits, branch info per repo
- ✅ SQLite persistence: store findings in `~/.maester-index.db`
- ✅ Generate "state of the realm" report
- ✅ Run on daily schedule
- ✅ Output brief to Telegram and/or dashboard
- ❌ Interactive Q&A (deferred to v1)
- ❌ Database schema introspection (v2)
- ❌ Codebase symbol index (v2, if needed)
- ❌ Dependency analysis (v2)

### v1 (next)
- Interactive Q&A mode (run in response to Telegram / dashboard queries)
- Full-text search over index
- Historical diffs ("what changed since last week?")
- Alerts on stale repos or untouched systems

### v2 (later)
- Database schema snapshots + migration tracking
- Codebase symbol index (functions, classes, types)
- Dependency graph + outdated packages
- Code health metrics (test coverage, complexity)

## State & persistence

**Index database**: `~/.maester-index.db`
- `projects` — name, path, type (app/lib/config/script), last_scanned, last_activity, purpose
- `repos` — path, git_url, default_branch, last_commit_date, last_commit_hash, latest_tag
- `recent_commits` — repo_path, commit_hash, date, author, message
- `snapshots` — timestamp, project_count, repo_activity_summary

**Daily scan**: runs at 06:15 CAT (after The Hand's 06:00 brief)

## What v0 reports

1. **Morning brief** (Telegram)
   - What's new (commits from last 24 hours across all repos)
   - What's stale (repos untouched >30 days)
   - Project count + activity summary

2. **Dashboard** (via `/api/maester/*`)
   - Full realm index (for search/browse)
   - Activity timeline
   - Project health status

## CLI

```bash
cd ~/Kingdom

# Daily scan and brief
python -m council.the-maester scan

# Show the index (JSON)
python -m council.the-maester index

# Question the Maester (v1+)
python -m council.the-maester ask "what's new?"

# Raw database query (debug)
python -m council.the-maester db "SELECT * FROM projects"
```

## Constraints

- **Read-only** — The Maester never writes code, commits, or modifies systems
- **No external APIs** — filesystem + git only for v0; database introspection in v1
- **Stdlib only** — no external dependencies (sqlite3 is stdlib)
- **Efficient** — can scan 100 repos in <5 seconds; caches where possible
