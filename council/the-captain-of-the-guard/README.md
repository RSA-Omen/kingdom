# The Captain of the Guard

Incident response coordinator. Detects incidents, categorizes severity, sends alerts, and creates GitHub issues.

## Commands

```bash
# Scan for incidents and process them
python3 -m council.the-captain-of-the-guard scan

# Send Telegram report of open incidents
python3 -m council.the-captain-of-the-guard report

# Display database statistics
python3 -m council.the-captain-of-the-guard db
```

## State

Database: `~/.captain-of-the-guard.db`

Tracks:
- Open and resolved incidents
- Alert delivery (Telegram, GitHub)
- Incident history and actions

## Cron Schedule

```
*/5 * * * *   python3 -m council.the-captain-of-the-guard scan
0 6,12,18 * * * python3 -m council.the-captain-of-the-guard report
```

Scans every 5 minutes for new incidents. Reports at 06:00, 12:00, 18:00 CAT.

## Incident Sources

Monitors:
- **Steward reports** — Service health failures
- **Quartermaster reports** — Resource quota alerts
- Direct incident feeds (extensible)

## Incident Handling

- **Critical:** Telegram alert + GitHub issue
- **High:** Telegram alert
- **Medium:** Logged, no alert
- **Low:** Logged only

## Configuration

Environment variables:
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `TELEGRAM_CHAT_ID` — Telegram chat/channel ID
- `GITHUB_TOKEN` — GitHub API token
- `GITHUB_REPO` — GitHub repo (default: `gekkotech/kingdom`)

## Dependencies

- requests (Telegram, GitHub API)
- subprocess (council integrations)
