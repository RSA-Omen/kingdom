# The Royal Court of the Kingdom

Canonical roster of agents, their beats (responsibilities), schedules, and escalation paths.

## Overview

The Kingdom operates as a distributed intelligence network — seven council members patrol the realm continuously, detect issues, and coordinate responses. The Herald publishes the morning briefing. Escalations flow through incident channels when things go wrong.

## The Council

### 1. The Steward
**Beat:** Day-to-day operations across every village. Health-checks all services, surfaces alerts, builds status reports.

**Responsibilities:**
- Monitor health of all registered services (villages)
- Surface service failures and degradation
- Build daily operational status report
- Track service availability trends

**Schedule:**
- `*/5 * * * *` — Health checks every 5 minutes
- `22:45 UTC (00:45 CAT)` — Daily telegram report with status summary

**Escalation Path:**
- Critical service down → Reported to Captain of the Guard (scan picks it up from Steward)
- Status sent to Telegram daily for operator awareness

**State:** `~/.steward.db` (tracks service health history)

**Commands:**
```bash
python3 -m council.the-steward check      # Run health checks
python3 -m council.the-steward status     # Show current status (JSON)
python3 -m council.the-steward report     # Generate daily report
python3 -m council.the-steward telegram   # Send status to Telegram
```

---

### 2. The Master of Works
**Beat:** Infrastructure watchkeeper. Monitors system resources (CPU, memory, disk, GPU), container health, and critical service availability.

**Responsibilities:**
- Monitor CPU, memory, disk, GPU utilization
- Track container health and availability
- Detect resource saturation and anomalies
- Recommend scaling or intervention

**Schedule:**
- `*/5 * * * *` — Infrastructure checks every 5 minutes
- `23:00 UTC (01:00 CAT)` — Daily infrastructure report to Telegram

**Escalation Path:**
- Critical resource exhaustion → Reported to Captain of the Guard
- Sustained high utilization → Escalates to Quartermaster for forecasting
- Infrastructure report sent to Telegram daily

**State:** `~/.master-of-works.db` (tracks resource trends)

**Commands:**
```bash
python3 -m council.the-master-of-works check    # Run infrastructure checks
python3 -m council.the-master-of-works report   # Generate report
python3 -m council.the-master-of-works db       # Show statistics
```

---

### 3. The Quartermaster
**Beat:** Resource provisioning advisor. Monitors disk space, forecasts when quotas will be exceeded, and recommends provisioning.

**Responsibilities:**
- Monitor current disk usage across all volumes
- Forecast usage growth and quota exhaustion
- Flag anomalous growth patterns (storage spikes)
- Recommend provisioning actions

**Schedule:**
- `0 * * * *` — Hourly resource checks and forecasting
- `23:30 UTC (01:30 CAT)` — Daily resource forecast report to Telegram

**Escalation Path:**
- Quota will be exceeded within 7 days → Alert to Telegram
- Anomalous growth (>10 GB/day) → Flagged as suspicious, requires manual review
- Forecast sent to Telegram daily for operator awareness

**State:** `~/.quartermaster.db` (tracks usage history and forecasts)

**Caveats:**
- Requires 6 hours minimum data window before forecast is valid
- Rejects implausible growth rates (>10 GB/day) as anomalies
- Growth forecast assumes linear trend

**Commands:**
```bash
python3 -m council.the-quartermaster check    # Check usage and forecast
python3 -m council.the-quartermaster report   # Send Telegram report
python3 -m council.the-quartermaster db       # Show statistics
```

---

### 4. The Captain of the Guard
**Beat:** Incident response coordinator. Detects incidents, categorizes severity, sends alerts, and creates GitHub issues.

**Responsibilities:**
- Aggregate incident reports from Steward, Quartermaster, and other monitors
- Categorize incidents by severity (Critical, High, Medium, Low)
- Route critical incidents to Telegram and GitHub
- Track incident lifecycle (open → resolved)
- Deliver periodic incident summaries

**Schedule:**
- `*/5 * * * *` — Scan for new incidents every 5 minutes
- `23:15 UTC (01:15 CAT)` — Overnight incident summary to Telegram
- `10:00 UTC (12:00 CAT)` — Midday incident check-in to Telegram
- `16:00 UTC (18:00 CAT)` — Evening incident check-in to Telegram

**Escalation Path:**
- **Critical incidents** → Telegram alert + GitHub issue creation
- **High incidents** → Telegram alert only
- **Medium incidents** → Logged, no alert
- **Low incidents** → Logged only

**Incident Sources:**
- Steward reports (service failures)
- Quartermaster reports (quota alerts)
- Direct incident feeds (extensible)

**State:** `~/.captain-of-the-guard.db` (tracks incidents, alerts, resolution)

**Configuration:**
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `TELEGRAM_CHAT_ID` — Telegram chat/channel ID
- `GITHUB_TOKEN` — GitHub API token
- `GITHUB_REPO` — GitHub repo (default: `gekkotech/kingdom`)

**Commands:**
```bash
python3 -m council.the-captain-of-the-guard scan      # Scan for incidents
python3 -m council.the-captain-of-the-guard report    # Send incident summary
python3 -m council.the-captain-of-the-guard db        # Show statistics
```

---

### 5. The Maester
**Beat:** Institutional memory for the kingdom. Reads the realm's books (filesystem, git history) and keeps them indexed. Answers questions about what exists, what's new, what's stale.

**Responsibilities:**
- Index filesystem and git history
- Track new files and recent changes
- Surface stale or abandoned code
- Build knowledge base of realm state

**Schedule:**
- `22:30 UTC (00:30 CAT)` — Daily scan and Telegram briefing

**Escalation Path:**
- Large unmaintained codebases flagged in daily briefing
- Stale documentation surfaced for review
- Briefing sent to Telegram for operator awareness

**State:** Indexed filesystem and git history; state persists in-memory and via cron logs

**Commands:**
```bash
python3 -m council.the-maester scan       # Run daily scan
python3 -m council.the-maester index      # Dump full index (JSON)
python3 -m council.the-maester brief      # Show brief (markdown)
python3 -m council.the-maester telegram   # Send Telegram briefing
```

---

### 6. The Master of Laws
**Beat:** Compliance auditor. Verifies every village meets the Gekko Standard and creates issues for violations.

**Responsibilities:**
- Audit registered villages against compliance checklist
- Verify standardization across projects
- Create GitHub issues for compliance violations
- Track compliance metrics

**Schedule:**
- `00:45 UTC (02:45 CAT) Sundays only` — Weekly compliance audit and report

**Escalation Path:**
- Compliance violations → GitHub issues created
- Weekly report sent to Telegram on Sunday mornings
- Violations tracked until resolved

**State:** `~/.master-of-laws.db` (tracks violations and resolutions)

**Commands:**
```bash
python3 -m council.the-master-of-laws audit     # Audit all villages
python3 -m council.the-master-of-laws report    # Audit and send Telegram report
python3 -m council.the-master-of-laws db        # Show statistics
```

---

### 7. The Hand of the King
**Beat:** The king's direct assistant. Reads `~/Kingdom/TODO.md`, prioritizes matters before the king, surfaces what's overdue, drafts the day's agenda.

**Responsibilities:**
- Parse and prioritize TODO.md items
- Score matters by priority and deferral history
- Select today's three priorities
- Track completed and deferred items
- Deliver daily agenda to Telegram

**Schedule:**
- `*/30 * * * *` — Snapshot state every 30 minutes (for dashboard)
- `00:30 UTC (02:30 CAT)` — Deliver day's agenda to Telegram

**Escalation Path:**
- Overdue items flagged in daily agenda
- High-priority (P1) items highlighted
- Agenda sent to Telegram each morning

**State:** `~/.hand-state.json` (deferral counts, completion log, snapshots)

**Current Capabilities (v0):**
- Parse TODO.md with priority tags (`[P1]`, `[P2]`, `[P3]`, `[IDEA]`)
- Score and select top 3 items
- Mark items complete (strikethrough in TODO.md)
- Defer items by N days
- Output markdown brief and JSON agenda

**Planned (v1+):**
- Push to Telegram (implemented)
- Serve via HTTP endpoint for dashboard polling
- Read GitHub Issues
- Understand task dependencies

**Commands:**
```bash
python3 -m council.the-hand-of-the-king brief       # Read markdown brief
python3 -m council.the-hand-of-the-king today       # Get today's three (JSON)
python3 -m council.the-hand-of-the-king agenda      # Full agenda (JSON)
python3 -m council.the-hand-of-the-king done <id>   # Mark item complete
python3 -m council.the-hand-of-the-king defer <id> 7 # Defer N days
python3 -m council.the-hand-of-the-king telegram    # Send to Telegram
python3 -m council.the-hand-of-the-king snapshot    # Take state snapshot
```

Wrapper script at `/home/lauchlandupreez/Kingdom/bin/hand`:
```bash
~/Kingdom/bin/hand brief
~/Kingdom/bin/hand today
~/Kingdom/bin/hand done <id>
~/Kingdom/bin/hand defer <id> 7
```

---

## The Capital

### The Herald
**Beat:** Publishes Telegraph, the kingdom's daily paper. Gathers reports from the Royal Court and publishes the morning edition.

**Responsibilities:**
- Collect briefings from all council members
- Compose morning Telegraph with latest intelligence
- Publish to Telegram

**Schedule:**
- `00:00 UTC (02:00 CAT)` — Publish Telegraph each morning

**Escalation Path:**
- Failed report from council member → Herald skips that section
- Telegram publication failure → Logged to cron
- Telegraph sent each morning for operator awareness

**Dependencies:**
- The Hand (agenda)
- The Maester (institutional memory)
- The Steward (status)
- The Master of Works (infrastructure report)
- The Captain of the Guard (incident summary)
- The Quartermaster (resource forecast)
- The Master of Laws (compliance audit)

**Configuration:**
- `TELEGRAM_BOT_TOKEN` — Read from env or `~/telegram_notify_service/.env`
- `TELEGRAM_CHAT_ID` — Read from env or `~/telegram_notify_service/.env`

**Commands:**
```bash
python3 -m capital.herald publish  # Publish Telegraph to Telegram
```

---

## Schedule Summary (CAT = UTC+2)

All times shown in both UTC and CAT. Daily briefings are scheduled before 3AM CAT (1AM UTC).

| Time (UTC) | Time (CAT) | Agent | Action | Log |
|---|---|---|---|---|
| 22:30 | 00:30 | Maester | Scan & Telegram | `.maester-cron.log` |
| 22:45 | 00:45 | Steward | Telegram daily report | `.steward-cron.log` |
| 23:00 | 01:00 | Master of Works | Report | `.master-of-works-cron.log` |
| 23:15 | 01:15 | Captain | Overnight incident summary | `.captain-cron.log` |
| 23:30 | 01:30 | Quartermaster | Resource forecast report | `.quartermaster-cron.log` |
| 00:00 | 02:00 | Herald | Publish Telegraph | `.herald-cron.log` |
| 00:30 | 02:30 | Hand | Deliver day's agenda | `.hand-cron.log` |
| 00:45 | 02:45 | Master of Laws | Weekly compliance audit (Sun only) | `.master-of-laws-cron.log` |
| Hourly | Hourly | Quartermaster | Check usage | `.quartermaster-cron.log` |
| Every 5m | Every 5m | Steward | Health checks | `.steward-cron.log` |
| Every 5m | Every 5m | Master of Works | Infrastructure checks | `.master-of-works-cron.log` |
| Every 5m | Every 5m | Captain | Scan for incidents | `.captain-cron.log` |
| Every 30m | Every 30m | Hand | Snapshot state | `.hand-cron.log` |
| 10:00 | 12:00 | Captain | Midday check-in | `.captain-cron.log` |
| 16:00 | 18:00 | Captain | Evening check-in | `.captain-cron.log` |

---

## Escalation Paths

### Service Failure
1. **Steward detects** service down → Health check fails
2. **Steward logs** incident → State recorded in DB
3. **Captain scans** every 5 minutes → Picks up from Steward reports
4. **Captain evaluates** severity → Critical if production service
5. **Captain escalates:**
   - Critical → Telegram alert + GitHub issue
   - High → Telegram alert
   - Medium → Log only
6. **Herald reports** in morning Telegraph

### Resource Exhaustion
1. **Quartermaster checks** hourly → Forecasts quota exhaustion
2. **Quartermaster flags** if quota exceeded within 7 days
3. **Captain scans** → Picks up quota alert
4. **Captain escalates:**
   - Exhaustion imminent → Telegram alert
5. **Herald reports** in morning Telegraph

### Infrastructure Issue
1. **Master of Works checks** every 5 minutes → Detects high resource utilization
2. **Master of Works logs** → State recorded in DB
3. **Captain scans** → Picks up from Master of Works
4. **Captain escalates** if sustained saturation detected
5. **Herald reports** in morning Telegraph

### Compliance Violation
1. **Master of Laws audits** weekly (Sundays)
2. **Master of Laws creates** GitHub issue for violation
3. **Herald reports** in morning Telegraph
4. **Violation tracked** until resolved

---

## Cron Configuration Location

User crontab: `crontab -l`

All Kingdom cron entries use absolute paths and redirect to log files in `~/./{agent}-cron.log`.

---

## Monitoring Cron Execution

Each agent writes a cron log file in the Kingdom home directory:
- `.captain-cron.log` — Captain scans and reports
- `.hand-cron.log` — Hand snapshots and telegrams
- `.herald-cron.log` — Herald publishes Telegraph
- `.maester-cron.log` — Maester scans realm
- `.master-of-laws-cron.log` — Master of Laws compliance audits
- `.master-of-works-cron.log` — Master of Works infrastructure checks
- `.quartermaster-cron.log` — Quartermaster resource checks
- `.steward-cron.log` — Steward health checks

View latest activity:
```bash
tail -20 /home/lauchlandupreez/Kingdom/.{agent}-cron.log
```

Monitor in real-time:
```bash
tail -f /home/lauchlandupreez/Kingdom/.captain-cron.log
```

---

## Database State Files

Each agent maintains persistent state:
- `~/.captain-of-the-guard.db` — Incidents and alerts
- `~/.master-of-laws.db` — Compliance violations
- `~/.master-of-works.db` — Infrastructure metrics
- `~/.quartermaster.db` — Usage forecasts and quotas
- `~/.steward.db` — Service health history
- `~/.hand-state.json` — Deferral log and completion tracking

Snapshots:
- `~/.hand-snapshot.json` — Latest state snapshot for dashboard

---

## Configuration & Credentials

**Telegram Integration:**
- `TELEGRAM_BOT_TOKEN` — Bot token (env or `~/telegram_notify_service/.env`)
- `TELEGRAM_CHAT_ID` — Channel/chat ID (env or `~/telegram_notify_service/.env`)

**GitHub Integration:**
- `GITHUB_TOKEN` — Personal access token (env)
- `GITHUB_REPO` — Target repo (env, default: `gekkotech/kingdom`)

**Service Monitoring:**
- Services registered in capital/dashboard config
- Health checks defined per service

---

## Troubleshooting

**Agent not running on schedule:**
1. Check crontab: `crontab -l | grep agent-name`
2. Check cron log: `tail -50 /home/lauchlandupreez/Kingdom/.{agent}-cron.log`
3. Run agent manually: `cd ~/Kingdom && python3 -m council.the-{agent-name} {command}`

**Telegram alerts not sending:**
1. Verify credentials: `echo $TELEGRAM_BOT_TOKEN` and `echo $TELEGRAM_CHAT_ID`
2. Check fallback: `cat ~/telegram_notify_service/.env`
3. Test manually: `curl -X POST https://api.telegram.org/bot{TOKEN}/sendMessage -d chat_id={CHAT_ID}&text=test`

**Database corruption:**
1. Locate DB: `ls -la ~/.*-{agent-name}.db`
2. Backup: `cp ~/.*-{agent-name}.db ~/.*-{agent-name}.db.bak`
3. Clear and rebuild: Agent will recreate on next run

---

## Future Enhancements

- [ ] Dashboard HTTP endpoint for real-time status
- [ ] GitHub Issues integration for Hand (read from repo)
- [ ] Task dependency tracking (depends-on: tags)
- [ ] Multi-channel escalation (Slack, Discord, etc.)
- [ ] Custom incident routing rules
- [ ] Alert suppression windows (maintenance mode)
- [ ] Incident trend analysis
- [ ] Automation workflows (auto-remediation for common issues)
