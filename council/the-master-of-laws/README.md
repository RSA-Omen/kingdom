# The Master of Laws

Compliance auditor. Verifies every village meets the Gekko Standard and creates issues for violations.

## Commands

```bash
# Audit all registered villages
python3 -m council.the-master-of-laws audit

# Audit and send report via Telegram
python3 -m council.the-master-of-laws report

# Display database statistics
python3 -m council.the-master-of-laws db
```

## State

Database: `~/.master-of-laws.db`

Tracks:
- Compliance audits (per village, timestamp, score)
- Violations (requirement, severity, status)

## Cron Schedule

```
0 8 * * *     python3 -m council.the-master-of-laws report
```

Weekly compliance report every Sunday at 08:00 CAT.

## Gekko Standard Requirements

Every village must have:

1. **Health Endpoint** — `GET /health` returns JSON status (critical)
2. **GitHub Repository** — Registered, accessible, public (high)
3. **CHANGELOG.md** — Tracks all releases (medium)
4. **README.md** — Setup, config, deployment instructions (medium)
5. **Usage Tracking** — POSTs to `/api/track` (medium)
6. **Error Reporting** — POSTs to `/api/log-guru/analyze` (medium)
7. **Azure AD Auth** — No local user tables (high)
8. **Structured Logs** — JSON to stdout (medium)
9. **Docker Artifact** — Versioned image with commit hash + semver (high)

## Village Registry

Villages are configured in master_of_laws.py. Eventually, this will be a configuration file or database.

Currently auditing:
- Gekko Tracks
- Kanban AI
- Interceptor
- Open WebUI
- Admin Center

## Escalation

- **Compliance Score 100%** — Recognized village of the realm
- **75-99%** — Warning; 14 days to fix violations
- **<75%** — Critical; blocked from releases until fixed

## Dependencies

- requests (GitHub API)
- urllib (health checks)
