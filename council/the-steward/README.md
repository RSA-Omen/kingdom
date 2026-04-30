# The Steward

Day-to-day operations across every village. Health-checks all services, surfaces alerts, builds status reports.

For the full spec, see `~/Kingdom/docs/council/the-steward.md`.

## Usage

```bash
cd ~/Kingdom

# Run health checks on all villages
python -m council.the-steward check

# Show current status (JSON)
python -m council.the-steward status

# Generate daily report
python -m council.the-steward report

# Post report to Telegram
python -m council.the-steward telegram

# Show today's incidents
python -m council.the-steward incidents
```

## State

Health data persists at `~/.steward-health.db` (SQLite).

Tables:
- `services` — registered villages with current status
- `health_snapshots` — historical health check results
- `incidents` — outages and their details

## What v0 does

**Health checks:**
- Polls `/health` endpoint on 6 known services (Gekko Tracks, Kanban-AI, Admin Center, etc.)
- Records status, response time, details
- Every time `check` command runs (manually or via cron)

**Reports:**
- Markdown summary: how many services healthy/degraded/unhealthy
- Per-service status and last check time
- JSON export of all services

**Telegram integration:**
- Posts daily report to your Telegram chat
- Shows emoji summary (✅⚠️❌)

**No external dependencies** — uses only stdlib (sqlite3, urllib, subprocess).

## Scheduling

Run on a schedule (e.g., cron every 5 minutes):
```
*/5 * * * * cd ~/Kingdom && python3 -m council.the-steward check >> .steward-cron.log 2>&1
```

Daily report (e.g., 06:20 CAT, after The Maester):
```
20 6 * * * cd ~/Kingdom && python3 -m council.the-steward telegram >> .steward-cron.log 2>&1
```

## Known services

Currently checks:
- Gekko Tracks (port 8002)
- Kanban-AI (port 5002)
- Admin Center API (port 5001)
- Open WebUI (port 3005)
- Local API (port 8080)
- n8n (port 5678)

To add a service, edit the `VILLAGES` dict in `steward.py`.

## Next steps (v1+)

- Alert thresholds (critical services get escalated faster)
- Telegram alerts on status changes
- Integration with The Captain (incident response)
- MTTR (mean time to recovery) tracking
