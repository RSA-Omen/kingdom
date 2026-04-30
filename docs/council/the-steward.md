# The Steward — Kingdom Council Spec

**Beat:** Day-to-day operations across every village. Health checks, status reports, alerts.

**Why:** Every app should report its health. The Steward watches them all and alerts the king when something breaks.

## What The Steward does

1. **Health-checks every village**
   - Polls `/health` endpoint on each known service
   - Tracks health state over time
   - Detects transitions (healthy → degraded → unhealthy)

2. **Surfaces alerts**
   - First failure: warning (may be transient)
   - Persistent (>5 min): page the king
   - Critical services: escalate immediately
   
3. **Builds a status dashboard**
   - Per-app health timeline
   - Recent incidents
   - MTTR (mean time to recovery)

4. **Triggers incident response**
   - On critical alert, notify The Captain of the Guard
   - Capture logs, environment state
   - Draft incident report

## Implementation layers (v0 → v1 → v2)

### v0 (this build)
- ✅ Query The Maester's index to discover all villages
- ✅ Periodically poll `/health` on each service
- ✅ Store health snapshots in SQLite
- ✅ Detect unhealthy → healthy transitions
- ✅ Generate daily status report (Telegram)
- ✅ API endpoints for dashboard
- ❌ Incident response integration (v1)
- ❌ MTTR metrics (v1)
- ❌ Root-cause detection (v2)

### v1 (next)
- Alert thresholds by service criticality
- Telegram alerts on state changes
- Integration with The Captain (incident response)
- Detailed health history per service

### v2 (later)
- ML anomaly detection (latency spikes, error rate jumps)
- Automatic mitigation suggestions ("restart the service", "scale up")
- Incident postmortem drafting

## State & persistence

**Health database**: `~/.steward-health.db`
- `services` — name, url, health_endpoint, criticality (critical/high/normal/low), last_checked
- `health_snapshots` — timestamp, service_url, status (healthy/degraded/unhealthy), response_time, details
- `incidents` — start_time, end_time, service_url, root_cause_hypothesis, mttr

**Check interval**: Every 5 minutes (or configurable per service)

## CLI

```bash
cd ~/Kingdom

# Run a health check cycle
python -m council.the-steward check

# Show current status (JSON)
python -m council.the-steward status

# Show today's incidents
python -m council.the-steward incidents

# Generate daily report
python -m council.the-steward report

# Post daily report to Telegram
python -m council.the-steward telegram
```

## Data model

A "village" is any HTTP service with a `/health` endpoint. Examples:
- Gekko Tracks (port 8002)
- Kanban-AI (port 5002)
- Admin Center (port 5001 or 3000)
- n8n (Docker)
- Open WebUI (port 3005)

The Steward maintains a registry, querying The Maester for new services, checking any that have a `docker-compose.yml` or known port.

## Constraints

- **Read-only** — The Steward never restarts services or modifies config
- **Graceful degradation** — if a service is unreachable, treat as unhealthy but don't escalate to incident until persistence
- **No false positives** — transient network hiccups shouldn't page the king
- **Smart alerting** — group related alerts (e.g., if service A fails because its dependency B failed, alert on B only)
