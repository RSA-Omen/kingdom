# The Steward

Day-to-day operations across every village. Health-checks all services, audits dependency vulnerabilities, surfaces alerts, builds status reports.

## Usage

```bash
cd ~/Kingdom

# Health checks on all villages
python -m council.the-steward check

# Dependency vulnerability audit across all components
python -m council.the-steward deps

# Show current status (JSON)
python -m council.the-steward status

# Generate daily report (health + dependency summary)
python -m council.the-steward report

# Post report to Telegram
python -m council.the-steward telegram

# Show today's incidents
python -m council.the-steward incidents
```

## State

All data persists at `~/.steward-health.db` (SQLite).

Tables:
- `services` — registered villages with current status
- `health_snapshots` — historical health check results
- `incidents` — outages and their details
- `dependency_audits` — npm audit results per component, per run

## Health checks

Polls `/health` on 6 known services every 5 minutes via cron:
- Gekko Tracks (port 8002)
- Kanban-AI (port 5002)
- Admin Center API (port 5001)
- Open WebUI (port 3005)
- Local API (port 8080)
- n8n (port 5678)

To add a service, edit the `VILLAGES` dict in `steward.py`.

## Dependency security

Audits npm projects once daily via cron. Components watched:
- Admin Center Backend
- Admin Center Frontend
- Admin Center MCP Server
- Kingdom Dashboard

On new critical vulnerabilities, sends an immediate Telegram alert. Results are stored in `dependency_audits` and served by the Kingdom dashboard's `/security` page — no live audit on page load.

To add a component, edit the `COMPONENTS` dict in `steward.py`.

## Scheduling

```
# Health — every 5 minutes
*/5 * * * * cd ~/Kingdom && python3 -m council.the-steward check >> .steward-cron.log 2>&1

# Dependency audit — daily at 22:00 CAT (20:00 UTC)
0 20 * * * cd ~/Kingdom && python3 -m council.the-steward deps >> .steward-cron.log 2>&1
```

## Next steps (v1+)

- Alert thresholds (critical services escalated faster)
- Telegram alerts on health status changes
- Integration with The Captain (incident response)
- MTTR (mean time to recovery) tracking
- pip audit support for Python projects
