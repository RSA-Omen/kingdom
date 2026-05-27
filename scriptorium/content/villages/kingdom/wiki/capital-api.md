# The Capital API

The Capital API is the Kingdom's backend — the Express + TypeScript service that holds the realm's data, receives events from every village, and serves every dashboard, agent, and operator-facing endpoint.

It runs as a single Docker container called **`kingdom-capital-api`** on port **5001**.

## What it does

- **Receives events from villages.** Usage tracking (`POST /api/track`), error reports (`POST /api/errors`), checkpoint events (`POST /api/checkpoints`). Power Automate, Gekko Tracks, the Interceptor, and the kingdom-checkpoint script all push here.
- **Holds the realm's ledger.** A 14 MB SQLite database (`app-registry.db`) with errors, todos, usage events, health history, log analyses, dependency audit history, GitHub sync state, and checkpoint events. WAL mode, with scheduled backups.
- **Serves the Royal Court.** The Hand reads todos, the Herald reads error/todo summaries for the morning Telegraph, the Master of Laws audits health history, the Lord Chamberlain reads usage friction signals. They all hit endpoints here.
- **Serves the dashboard.** Every page in `capital/dashboard/` that needs persistent state proxies to here.
- **Runs schedulers.** Log Guru error analysis (every 30 min), GitHub Issues sync (every 30 min), Graylog error sync (every 5 min), HTTP error sync (every 2 min), dependency audit (daily 1 AM), backup (daily 1 AM), false-positive cleanup (daily 2 AM), health checks (per-app intervals).

## Where the code lives

`Kingdom/capital/api/` — 19 routes, 13 services, 19 SQL migrations.

| Route | What it serves |
|---|---|
| `/api/track` | Usage events from villages |
| `/api/errors` | Error reporting + CRUD |
| `/api/todos` | Action items |
| `/api/checkpoints` | Village git commits (kingdom-checkpoint hook) |
| `/api/health` | Service health + history |
| `/api/apps` | App registry |
| `/api/usage`, `/api/metrics` | Analytics |
| `/api/log-guru` | AI log triage |
| `/api/dependencies` | npm audit results + repair suggestions |
| `/api/backups` | Backup history |
| `/api/bureau` | Aggregated agent-facing read endpoints |
| `/api/reports` | Daily/weekly PDF + JSON reports |
| `/api/auth` | Azure AD SSO (dormant — basic auth is the active path) |

## Where the data lives

`Kingdom/capital/api/data/app-registry.db`

The directory is gitignored — it's runtime state, ~14 MB of live data plus ~200 MB of backups and dependency-resolution snapshots.

## How it gets configured

`docker-compose.yml` at the Kingdom root builds the `capital-api` service from `capital/api/Dockerfile`. Environment variables are sourced from `Kingdom/.env` (compose substitution) for the values that need to vary by environment.

For Azure AD secrets, `capital/api/.env` is read by `dotenv.config()` at runtime — though in current production, Azure SSO is not configured and the basic-auth fallback handles operator access. The frontend was decommissioned with the admin-center cutover.

## History — the admin-center inheritance

The Capital API was **lifted wholesale from the legacy `admin-center` project on 2026-05-27**. Admin-center had ~70% of what the Kingdom needed already built — health monitoring, usage tracking, error grouping with hashing/burst detection, app registry, dependency scanning, AI log triage, backup management — and Kingdom build rule #6 says "don't migrate by rewriting". So the Capital API isn't a clean-room implementation: it's admin-center's backend, moved into Kingdom and rebuilt as a Kingdom-owned container.

**The cutover happened in three steps:**

1. **Source lift (2026-05-27, morning).** `admin-center/backend/` → `Kingdom/capital/api/`. `admin-center/mcp-server/` → `Kingdom/capital/mcp/`. The `admin-center-frontend` container was stopped (nobody used it). The `RSA-Omen/Admin-Center` GitHub repo was archived (read-only).

2. **Container cutover (2026-05-27, afternoon).** Built `kingdom-capital-api` from `Kingdom/capital/api/`. Stopped `admin-center-backend`, copied `admin-center/data/` → `Kingdom/capital/api/data/` (222 MB), brought `kingdom-capital-api` up on port 5001. Total downtime: 3 seconds. Verified all 19 routes serving real data.

3. **Local archive (pending).** Once `kingdom-capital-api` has run stable for ~1 week, `~/admin-center/` moves to `~/Archive/admin-center-final/`. Until then, the old directory and its database snapshot stay put as a rollback path.

The Capital API now sits inside Kingdom, builds from Kingdom's source, runs as a Kingdom-owned container, and writes to a Kingdom-owned database. The admin-center repo is a museum exhibit.
