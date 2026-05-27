# The Master Builder

**Beat:** Improves the platform itself — surfaces what's broken, what's ignored, and what GitHub issues have gone stale.

## What it watches

1. **Stale errors** — `errors` rows with `status='open'` older than 14 days, grouped by village
2. **Stale todos** — `todos` rows with `status='open'` older than 30 days
3. **GitHub issues** — open issues in `RSA-Omen/kingdom` older than 7 days
4. **TODO.md** — count of unchecked `[ ]` items in `/home/lauchlandupreez/Kingdom/TODO.md`

## Data sources

- `/home/lauchlandupreez/Kingdom/capital/api/data/app-registry.db` (read-only SQLite — the Capital API's live DB, migrated from admin-center on 2026-05-27)
- `gh issue list --repo RSA-Omen/kingdom` (via subprocess)
- `~/Kingdom/TODO.md` (local file)

## Commands

| Command | Description |
|---|---|
| `scan` | Run all checks, persist findings to `~/.builder.db`, print markdown summary |
| `report` | Print markdown summary from last scan (no re-scan) |
| `brief` | Single-line status: "🔨 Builder: N stale errors · N GitHub issues · N open TODOs" |
| `telegram` | Send digest via Telegram (uses `~/.kingdom.env`) |

## State

Findings are persisted to `~/.builder.db` between runs.

## Schedule

Intended to run daily as part of the morning Herald cycle.
