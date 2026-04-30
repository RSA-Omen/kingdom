# Admin Center Backend Audit

**Source:** `/home/lauchlandupreez/admin-center/backend/`
**Audit date:** 2026-04-28
**Purpose:** Inventory existing capabilities so the Newsroom wraps and extends rather than rebuilds.

---

## Executive Summary

Admin Center is a **mature, feature-rich operational platform** with ~70% of the capabilities the Newsroom will need. It provides a robust foundation for:

- Health monitoring per app (scheduled checks, history tracking)
- Usage tracking (events, aggregates, stats, time-saved)
- Error analysis & grouping (Log Guru — AI-powered with error hashing and burst detection)
- Dependency scanning (npm audit + caching)
- Backup management (SQLite/PostgreSQL snapshots)
- System resource monitoring (RAM, CPU, disk, Docker stats)
- Bureau integration (agents, command whitelisting, Telegram delivery)
- Azure AD authentication
- Docker management (restart, logs, status)
- Reporting (PDF generation, daily/weekly, time-saved metrics)

The codebase is **well-structured, maintainable, and production-ready**. Many features exceed initial expectations.

---

## 1. Routes Inventory

All routes require authentication (Azure AD JWT or basic auth) unless otherwise noted. The track endpoint allows API key auth. Bureau endpoints are intentionally unauthenticated to allow n8n and agent access.

### `/api/auth` — Authentication

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/login` | Initiate Microsoft OAuth flow | None |
| GET | `/callback` | OAuth callback | None |
| GET | `/logout` | Log out user | None |
| GET | `/me` | Get current user | Azure/Basic |

### `/api/health` — Health Monitoring

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | Overall health status | None |
| GET | `/history/:slug` | Health history for an app | Auth |
| POST | `/check/:slug` | Manually trigger health check | Auth |

Default check interval: 5 minutes (configurable per app via `health_check_interval_seconds`).

### `/api/reports` — Reporting

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/weekly` | Weekly usage report (JSON) | Auth |
| GET | `/weekly/pdf` | Weekly PDF report | Auth |
| GET | `/daily` | Daily usage report (JSON) | Auth |
| POST | `/daily/email` | Send daily report via email | Auth |
| POST | `/daily/slack` | Send daily report to Slack | Auth |
| POST | `/dependencies/refresh` | Refresh dependency cache | Auth |
| GET | `/daily/export` | Export usage data (CSV/JSON) | Auth |

Reports include time-saved metrics (hours), vulnerability fixes over time, and dependency resolution documentation.

### `/api/metrics` — System Metrics

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | System overview (apps, containers, events, top apps) | Auth |

### `/api/bureau` — Bureau (Agents Interface)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/systems` | List all monitored systems | None |
| GET | `/health` | Aggregated health status | None |
| GET | `/status/:slug` | Detailed status for one system | None |
| POST | `/diagnose/:slug` | Run diagnostics | None |
| POST | `/restart/:slug` | Restart a system (requires `confirmed: true`) | None |
| GET | `/logs/:slug` | Recent logs | None |
| POST | `/command` | Execute whitelisted command | None |
| GET | `/capabilities` | List available agent commands | None |
| POST | `/send-chart` | Send chart image to Telegram | None |
| GET | `/briefing` | Generate formatted briefing | None |

Telegram delivery requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

### `/api/track` — Usage Tracking

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/` | Track app usage event | API Key or None |
| GET | `/:app_slug/count` | Total usage count | Auth |
| GET | `/:app_slug/stats` | Usage stats over N days | Auth |

POST returns 200 even on error (Power Automate compatibility). Auto-registers apps if not found.

### `/api/log-guru` — Log Analysis (AI)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/analyses` | List analyses (filterable, groupable) | Auth |
| POST | `/analyze` | Analyze a specific error | Auth |
| POST | `/scan` | Scan logs for an app | Auth |
| POST | `/scan-all` | Scan all apps (async) | Auth |
| PATCH | `/analyses/:id` | Mark as real/false (0=unknown, 1=real, 2=false) | Auth |
| PATCH | `/groups/:groupId` | Mark entire group | Auth |
| GET | `/stats` | Statistics on analyses | Auth |
| POST | `/analyses/:id/fix` | Generate fix via Groq | Auth |
| POST | `/execute-command` | Execute command (sandboxed) | Auth |
| POST | `/read-file` | Read a file | Auth |
| POST | `/write-file` | Write a file (with optional backup) | Auth |
| POST | `/file-info` | Get file metadata | Auth |

Uses Groq API (`llama-3.3-70b-versatile`) for analysis. Error grouping via hashing.

### `/api/system-resources` — System Resources

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | RAM, CPU, disk, Docker stats | Auth |

Executes `uptime`, `free`, `df`, `docker stats`. Top 20 containers by CPU.

### `/api/apps` — App Registry

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | List all apps (filterable) | Auth |
| GET | `/:slug` | Get single app | Auth |
| POST | `/` | Create new app | Auth |
| PATCH | `/:slug` | Update app | Auth |
| DELETE | `/:slug` | Delete app | Auth |
| GET | `/:slug/status` | Container status | Auth |
| POST | `/:slug/logs/analyze` | Analyze error log with AI | Auth |
| GET | `/:slug/logs` | Get container logs | Auth |
| POST | `/:slug/restart` | Restart container | Auth |
| GET | `/:slug/config` | Get compose/env config (passwords masked) | Auth |

### `/api/events` — Events Log

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | List events (filterable) | Auth |

Event types: `restart`, `alert`, `health_check_failed`, `error_burst`, etc.

### `/api/usage` — Usage Analytics

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/top` | Top apps by usage | Auth |
| GET | `/:slug/events` | Events for an app (paginated) | Auth |
| GET | `/:slug` | Usage stats for an app | Auth |

### `/api/backups` — Backup Management

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | List all backups | Auth |
| GET | `/reports` | Get backup reports | Auth |
| GET | `/reports/:date` | Get report for date | Auth |
| POST | `/trigger` | Manually trigger backup | Auth |
| GET | `/stats` | Backup statistics | Auth |

### `/api/dependencies` — Dependency Scanning

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | Scan dependencies (cached) | Auth |
| GET | `/projects` | List scanned projects | Auth |
| GET | `/progress` | Current scan progress | Auth |
| GET | `/project/*` | Scan specific project | Auth |
| POST | `/repair` | Attempt fixes (with optional dryRun) | Auth |

---

## 2. Services Inventory

### health.ts
Periodic HTTP/Docker health checks. Runs continuously, default 5-minute interval per app. Persists to `health_history` table.

### scheduler.ts
- **Daily 1 AM:** Dependency check (npm audit) + backup runs
- **Every 30 min:** Log Guru scan (errors)
- **Daily 2 AM:** False positive cleanup

### usage.ts
Records usage events (auto-registers apps on first event). Computes time-saved from `manual_time_seconds - automation_time_seconds`. Aggregates hourly/daily into `usage_aggregates` for fast reporting.

### logGuru.ts
Error analysis with deduplication via hashing. Groups errors by normalized pattern (HTTP codes, exception types). Tracks burst episodes (first/last/count). Uses Groq for AI-generated summaries and fixes. User-feedback loop (mark real/false).

### docker.ts
Wraps Dockerode. List, inspect, restart, logs, stats. CPU/memory parsing.

### dependencies.ts
Recursive scan of `package.json` files. Runs `npm audit --json`. Cached 24h. Tracks vulnerabilities over time in `vulnerability_history`. Severity breakdown (critical/high/medium/low).

### bureau.ts
Aggregates health, exposes whitelisted commands for AI agents, sends Telegram notifications, generates briefings. Probes GKGPU for Ollama availability.

### reports.ts
Generates daily/weekly reports with usage, health, dependencies, time-saved. Exports to PDF (via pdfkit), email (nodemailer), Slack (webhooks).

### backup.ts
SQLite + PostgreSQL backups. Scheduled 1 AM daily. Stores in `../data/backups/`. Records to `backup_records` and `backup_reports`.

### dependencyRepair.ts
Attempts fixes via `npm upgrade`. Optional dry-run. Rollback support via package-lock backup.

### dependencyResolutions.ts
Documented ledger of vulnerability fixes (audit trail).

### fileService.ts
Sandboxed file ops with path-traversal protection. Read, write (with backup), execute commands.

---

## 3. Database Schema

**Storage:** SQLite (better-sqlite3), `../data/app-registry.db`. WAL mode.

| Table | Purpose |
|---|---|
| `apps` | Master registry — name, slug, container, ports, health endpoint, type, owner, manual_time_seconds, automation_time_seconds, metadata JSON |
| `health_history` | Every health check result with status, response time, timestamp, error message |
| `events` | System event log (restarts, alerts, error bursts) with metadata JSON |
| `usage_events` | Per-action records: app, user, action, source, duration_ms, metadata JSON |
| `usage_aggregates` | Hourly/daily materialised aggregates: total_events, unique_users, total_duration_ms, avg_duration_ms |
| `log_analyses` | Error analyses: error_log, error_name, context_before/after, analysis_summary, analysis_fix, is_real_issue (0/1/2), error_hash, group_id, occurrence_count, burst_count |
| `dependency_cache` | Latest npm audit summary with severity breakdown |
| `vulnerability_history` | Per-day, per-app vulnerability records with status (active/fixed/new) |
| `backup_records` | Individual backup runs with size, status, error |
| `backup_reports` | Daily aggregated backup summaries |

**Time-saved calculation:** `(manual_time_seconds - automation_time_seconds) × event_count`. Schema supports the per-action multiplier model we designed.

---

## 4. MCP Server

**Location:** `~/admin-center/mcp-server/src/index.ts`. Stdio transport. Wraps backend HTTP API with Basic Auth.

**Tools exposed:**

| Tool | Purpose |
|---|---|
| `list_containers` | List all registered apps |
| `container_status` | Get container status |
| `tail_logs` | Fetch or stream logs |
| `restart_container` | Restart a container |
| `read_config` | Read docker-compose.yml or .env (masked) |
| `health_check` | Trigger health check |
| `read_registry` / `write_registry` / `update_registry` | App CRUD |
| `get_logs` | Get app logs |
| `analyze_error` | Analyze error with AI |
| `scan_logs` | Scan all logs for errors |
| `get_health_history` | Trend health over time |
| `get_usage_stats` | Usage analytics |
| `get_top_apps` | Most-used apps |
| `list_dependencies` / `repair_dependencies` | Vulnerability ops |
| `get_backup_stats` / `trigger_backup` | Backup ops |
| `get_system_resources` | RAM/CPU/disk |

---

## 5. Capabilities Map

| Newsroom feature | Admin Center | Where | Gaps |
|---|---|---|---|
| Health monitoring per app | ✅ | `/api/health`, health.ts, health_history | No alerting threshold logic yet |
| Usage tracking per user action | ✅ | `/api/track`, usage.ts, usage_events | Auto-registers apps |
| Time saved per action | ✅ | apps.manual_time_seconds + duration_ms | Schema supports it; need Newsroom UI to set per-action minutes |
| Error reporting | ✅ | `/api/log-guru`, log_analyses | Captures from Docker logs |
| Error AI grouping/triage | ✅ | logGuru.ts (hashing, group_id, burst tracking) | Already sophisticated |
| App registry | ✅ | `/api/apps`, apps table | Auto-registers from track events |
| Azure AD auth | ✅ | auth.ts, MSAL | Falls back to basic auth |
| Docker management | ✅ | docker.ts, dockerode | Restart, logs, stats |
| System resources | ✅ | `/api/system-resources` | Top 20 containers |
| Backup management | ✅ | `/api/backups`, backup.ts | SQLite + Postgres, scheduled |
| Dependency tracking | ✅ | `/api/dependencies` | 24h cache, history snapshots |
| Log analysis (AI) | ✅ | logGuru.ts + Groq | llama-3.3-70b |
| Bureau integration | ✅ | `/api/bureau` | Already designed for agents |
| Telegram delivery | ✅ | bureau.sendChartToTelegram | Configurable chat ID |
| Per-app changelog | ⚠️ partial | apps.metadata JSON | No dedicated endpoint/UI |
| Feedback widget endpoint | ⚠️ partial | track endpoint accepts metadata | Could add `/api/feedback` |
| GitHub integration | ❌ | — | Newsroom must build |

---

## 6. Five Most Surprising Findings

### 1. Groq API for real-time error analysis
Admin Center calls Groq (`llama-3.3-70b-versatile`) for human-readable error summaries, step-by-step fixes, and code snippets — both on-demand and in batch. **We had been planning to use Claude. Decision needed: keep Groq for speed/cost, or migrate to Claude for consistency with the rest of the agent stack.**

### 2. Sophisticated error hashing & grouping
Log Guru normalises errors (strips timestamps, request IDs), hashes them, groups by pattern (HTTP codes, exception types), tracks burst episodes (`first_occurrence_time`, `last_occurrence_time`, `burst_count`), and has a real/false-positive feedback loop. This is the AI-triage we designed in conversation — already built.

### 3. Automatic app registration from events
Apps self-register when they post their first usage event. `project_type` is inferred from the `source` field. Aligns perfectly with the Gekko Standard onboarding model.

### 4. PDF reports with time-saved charts
Reports export to PDF with embedded charts, weekly/daily breakdowns, time-saved hours, and vulnerability fix tracking. Time-saved is already a first-class metric.

### 5. Bureau as a read-only agent gateway
Bureau routes are intentionally unauthenticated, with whitelisted commands (`health-check`, `system-status`, `restart-system`), for n8n and AI-agent access. This is essentially the Newsroom's agent-gateway architecture, already implemented.

---

## Gaps the Newsroom must build

1. **GitHub Integration** — PR creation, issue linking, release notes. Required for the GitHub Manager / Telegraph todo flow.
2. **Explicit Feedback widget endpoint** — `/api/feedback` (today's track endpoint accepts metadata but isn't formal).
3. **Per-app changelog** — Schema supports JSON metadata, but no changelog API/UI.
4. **Real-time alerts/thresholds** — Health checks run, but no alert rules ("restart if down >10 min").
5. **Cost attribution** — No infrastructure cost tracking per app.
6. **Rate limiting** — No API quotas (relevant if Newsroom exposes endpoints externally).
7. **Telegraph (the digest)** — None of the morning-paper composition exists yet.
8. **Named agents (Curator/Mechanic/Scout/etc.)** — The building blocks exist as services; the agent personas, schedules, and finding-store don't.

---

## Strategy implication

Admin Center is **the event backbone**. Newsroom is **the intelligence layer on top**.

The Newsroom should:
1. **Wrap** Bureau and MCP endpoints — these are already agent-friendly
2. **Extend** with GitHub integration, explicit feedback, changelog, alerting thresholds
3. **Reuse** the database schema — add tables for Newsroom-specific data, don't fork
4. **Compose** named agents (Curator, Mechanic, etc.) that read Admin Center's tables and produce structured findings consumed by Telegraph

The 30% gap is mostly **agents that interpret signals and take action**, not missing infrastructure.
