# Capital API

The Kingdom's backend — receives events from villages, holds the realm's data, and serves the dashboard.

## What this is

Express + TypeScript + better-sqlite3. 19 routes covering:
- `/api/track` — usage events from villages (Power Automate, Tracks, Interceptor)
- `/api/errors`, `/api/todos`, `/api/checkpoints` — read by Hand, Herald, and the dashboard
- `/api/health`, `/api/apps`, `/api/events` — registry and monitoring
- `/api/bureau`, `/api/log-guru`, `/api/dependencies` — agent-facing endpoints
- `/api/auth` — Azure AD (MSAL) for the operator

Lifted from `~/admin-center/backend/` on 2026-05-27 as part of the admin-center decommission. The source-of-truth code now lives here; the running container at port 5001 is still `admin-center-backend` until a `kingdom-capital-api` container is built from this source and cut over.

## State

- **Source:** here, in Kingdom
- **Running container:** still `admin-center-backend` (image built from old admin-center repo)
- **Database:** `~/admin-center/data/app-registry.db` (will move to `capital/api/data/` during the container cutover)
- **Frontend:** `admin-center-frontend` container stopped 2026-05-27 — nobody used it

## Setup

```bash
cd ~/Kingdom/capital/api
npm install
cp .env.example .env
# Fill in .env (Azure AD secrets, Telegram, etc.)
npm run dev    # or: npm run build && npm start
```

## Next phase (queued in TODO.md)

Build `kingdom-capital-api` Docker container from this source, point it at a migrated copy of the DB, verify, then cut over from `admin-center-backend`. After that, `~/admin-center/` can be archived to `~/Archive/`.
