# Capital API

The Kingdom's backend — receives events from villages, holds the realm's data, and serves the dashboard.

## What this is

Express + TypeScript + better-sqlite3. 19 routes covering:
- `/api/track` — usage events from villages (Power Automate, Tracks, Interceptor)
- `/api/errors`, `/api/todos`, `/api/checkpoints` — read by Hand, Herald, and the dashboard
- `/api/health`, `/api/apps`, `/api/events` — registry and monitoring
- `/api/bureau`, `/api/log-guru`, `/api/dependencies` — agent-facing endpoints
- `/api/auth` — Azure AD (MSAL) for the operator

Lifted from `~/admin-center/backend/` on 2026-05-27 as part of the admin-center decommission. The source-of-truth code now lives here; the running container is `kingdom-capital-api`, built from this source via `Kingdom/docker-compose.yml`.

## State

- **Source:** here, in Kingdom
- **Running container:** `kingdom-capital-api` on port 5001 (built from `Kingdom/docker-compose.yml`)
- **Database:** `Kingdom/capital/api/data/app-registry.db` (live; migrated from admin-center 2026-05-27)
- **Legacy:** `admin-center-frontend` container stopped, `admin-center-backend` container stopped, `RSA-Omen/Admin-Center` repo archived. Local `~/admin-center/` remains for ~1 week as a rollback path, then moves to `~/Archive/`.

## Run locally (dev)

```bash
cd ~/Kingdom/capital/api
npm install
cp .env.example .env
# Fill in .env (Azure AD secrets, Telegram, etc.)
npm run dev    # or: npm run build && npm start
```

## Run in production

```bash
cd ~/Kingdom
docker compose up -d capital-api
```

## See also

- [`capital-api`](../../scriptorium/content/villages/kingdom/wiki/capital-api.md) — Scriptorium wiki entry with the full migration history.
