# The Gekko Standard — What Every Village Must Keep

**Version:** 1.3  
**Effective:** 2026-05-20  
**Enforced by:** The Master of Laws

This document is the contract between the Capital (Kingdom infrastructure) and every Village (app, service, system). Villages that meet the Standard are recognised as part of the Realm.

---

## 1. Health Endpoint

**Requirement:** Every village must expose a `/health` endpoint that returns structured JSON.

**Endpoint:** `GET /health`

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-04-29T10:35:43Z",
  "version": "1.2.3",
  "checks": {
    "database": "healthy",
    "cache": "healthy",
    "external_api": "degraded"
  }
}
```

**Status values:**
- `healthy` — all systems nominal
- `degraded` — non-critical systems failing, but core functions work
- `unhealthy` — critical systems down, village cannot serve requests

**Criticality:** Each village defines which dependencies are critical vs. nice-to-have.

**SLA:** Must respond in <5 seconds. The Steward will time out after 5s and mark as unreachable.

---

## 2. Usage Tracking

**Requirement:** Every action that delivers value to the user must be reported to the Capital.

**Endpoint:** `POST /api/track`  
**Target:** Capital API at `localhost:5001/api/track` (or configured endpoint)

**Request body:**
```json
{
  "app": "gekko-tracks",
  "action": "receipt_scanned",
  "user_oid": "user-uuid-from-azure-ad",
  "timestamp": "2026-04-29T10:35:43Z",
  "multiplier": 1,
  "metadata": {
    "receipt_id": "rx-12345",
    "amount": 152.50,
    "currency": "ZAR"
  }
}
```

**Fields:**
- `app` — village name (must match registry)
- `action` — what the user did (snake_case)
- `user_oid` — Azure AD object ID (from token, never user email)
- `timestamp` — ISO 8601 UTC
- `multiplier` — how many "units" this action is worth (default 1)
- `metadata` — optional context (JSON object)

**SLA:** Best-effort; failures should not break the user's action.

**Retention:** Capital keeps 90 days of usage events.

---

## 3. Error Reporting

**Requirement:** Every error must be reported to the Capital for triage and trending.

**Endpoint:** `POST /api/log-guru/analyze`  
**Target:** Capital API

**Request body:**
```json
{
  "app": "gekko-tracks",
  "error_type": "ValidationError",
  "message": "Receipt date is in the future",
  "stack": "File 'receipt.py', line 142...",
  "fingerprint": "sha256(error_type + message)",
  "user_oid": "user-uuid-or-null",
  "timestamp": "2026-04-29T10:35:43Z",
  "context": {
    "request_id": "req-abc123",
    "environment": "production"
  }
}
```

**Fields:**
- `app` — village name
- `error_type` — exception class name
- `message` — error message (first 200 chars)
- `stack` — full traceback (first 2000 chars)
- `fingerprint` — hash of `error_type + message` for grouping (you compute this)
- `user_oid` — who hit the error (or null for system errors)
- `timestamp` — ISO 8601 UTC
- `context` — optional metadata

**Grouping:** Errors with the same fingerprint are grouped by The Log Guru. Unique fingerprints trigger automated issue creation in GitHub.

**SLA:** Best-effort; failures should log locally and retry.

---

## 4. Authentication

**Requirement:** All user identity comes from Azure AD. Villages must not maintain their own user tables.

**Standard:** OAuth 2.0 (MSAL) with Azure AD

**Token format:** JWT issued by Azure AD

**User identifier:** `oid` claim in the JWT (Azure AD object ID)

**Token validation:**
- Verify signature against Azure AD's public key
- Check `aud` (audience) matches village's registered client ID
- Check `exp` (expiration)
- Extract `oid` as the user's stable identifier

**No local users:** Villages must not store username/password, create user accounts, or maintain user directories. All identity is transitive through Azure AD.

**Access control:** Villages may store per-user settings, but user identity is always resolved via Azure AD token.

---

## 5. Logs

**Requirement:** Structured logging to stdout; the Capital collects and centralizes.

**Format:** JSON, one object per line

**Fields (required):**
```json
{
  "timestamp": "2026-04-29T10:35:43.123456Z",
  "level": "INFO",
  "message": "Receipt processed",
  "app": "gekko-tracks"
}
```

**Fields (optional but recommended):**
```json
{
  "request_id": "req-abc123",
  "user_oid": "user-uuid",
  "action": "receipt_scanned",
  "duration_ms": 245,
  "error": null,
  "context": { ... }
}
```

**Log levels:** DEBUG, INFO, WARN, ERROR, FATAL

**Destination:** stdout (Docker logs will collect; systemd services pipe to journald)

**Retention:** Capital keeps 30 days of logs; older logs are archived.

---

## 6. Documentation

**Requirement:** Villages must document their purpose, API, and operations.

**README.md (required):**
- One-line purpose
- Setup instructions
- How to run locally
- Env vars and config
- How to deploy

**OpenAPI/Swagger (recommended):**
- Document all public endpoints
- Include auth requirements
- Example requests/responses

**Runbook (if applicable):**
- How to restart the service
- How to debug common issues
- Escalation contacts
- Backup/recovery procedures

**Location:** Root of the repo. Capital's Maester will scrape and index.

---

## 7. GitHub Repository

**Requirement:** Every village's code must live in a Git repo registered with the Kingdom.

**Registry:** The Master of Laws keeps `~/.kingdom-villages.json` with:
```json
{
  "gekko-tracks": {
    "repo": "https://github.com/gekkotech/gekko-tracks",
    "main_branch": "main",
    "tags_pattern": "v*",
    "owner": "lauchlan"
  }
}
```

**Standards:**
- Must use `main` or `develop` as default branch (not `master`)
- Semantic versioning for releases (v1.2.3)
- Every deploy refs a git tag
- Commits must be atomic and descriptive

**Backups:** All repos are backed up to a second remote (automatic).

---

## 8. Changelog

**Requirement:** Every release must include a human-readable changelog.

**Format:** Markdown, in a `CHANGELOG.md` file at repo root

**Entry format:**
```markdown
## [1.2.0] - 2026-04-29

### Added
- Receipt OCR now supports handwritten dates

### Fixed
- Duplicate receipt detection was matching unrelated documents

### Changed
- Increased timeout for large PDF uploads from 30s to 60s

### Deprecated
- Old `/receipts/list` endpoint; use `/receipts` instead
```

**Timing:** Changelog must be updated BEFORE the release is tagged.

---

## 9. Feedback Widget

**Requirement:** Users must have a way to send feedback directly from the app.

**UI:** Simple widget (button or form) saying "Send feedback"

**Endpoint:** `POST /api/feedback`

**Request body:**
```json
{
  "app": "gekko-tracks",
  "feedback": "The receipt scanner is too slow on large images",
  "category": "performance",
  "user_oid": "user-uuid",
  "timestamp": "2026-04-29T10:35:43Z",
  "context": {
    "page": "receipt-scanner",
    "browser": "Chrome 120"
  }
}
```

**Categories:** feature-request, bug, performance, ux, other

**SLA:** Capital collects all feedback; The Lord Chamberlain reviews daily and prioritises.

---

## 10. Notifications

**Requirement:** Villages may send notifications to the king via Telegram.

**Channel:** Authorized villages have a Telegram bot token. Do not hard-code; read from env var `TELEGRAM_BOT_TOKEN`.

**Format:** Plain text or Markdown

**Rules:**
- Only critical alerts (errors, degradation, high-value events)
- No spam: batch if possible
- Include context: what village, what happened, when, suggested action
- Include request ID if from a user action

**Example:**
```
🔴 **Gekko Tracks** — High error rate detected
- Errors in last 5min: 42 (normal: <5)
- Sample error: "Database connection timeout"
- Action: Check database health
- More: http://dashboard/incidents/xyz
```

---

## 11. Database & Persistence

**Requirement:** If a village has a database, it must have a migration system.

**Standard:** Semantic versioning for schema changes

**Migrations:**
- Every schema change is a new timestamped migration file
- Migrations are idempotent (safe to run twice)
- Rollback procedure documented
- Applied on deploy

**Backups:**
- Daily automated backups
- Backed-up data encrypted at rest
- RTO (recovery time): <1 hour
- RPO (recovery point): <24 hours

**Example structure:**
```
db/
  migrations/
    001_create_receipts_table.sql
    002_add_receipt_metadata.sql
    003_create_users_table.sql
  backups/           # kept 30 days
```

---

## 12. Deployment Artifact

**Requirement:** Villages must ship a reproducible, versioned artifact.

**Standard:** Docker image tagged with the git commit hash and semver tag

**Naming:** `registry.example.com/gekko-tracks:v1.2.3` and `registry.example.com/gekko-tracks:abc123def`

**Dockerfile:**
- Multi-stage builds OK
- Should be runnable locally: `docker build -t app . && docker run -p 8000:8000 app`
- Health check defined: `HEALTHCHECK --interval=30s CMD curl -f http://localhost/health`

**Config:**
- All config via environment variables or mounted files
- No hard-coded secrets
- `.env.example` provided (with dummy values)

---

## 13. Compliance Audit

**Who:** The Master of Laws (automated + manual)

**Frequency:** New villages: before acceptance. Existing: quarterly + on-demand.

**Checklist:**
- [ ] Health endpoint responds 200 OK within 5s
- [ ] Usage events flowing to Capital `/api/track`
- [ ] Errors reported to `/api/log-guru/analyze`
- [ ] Auth via Azure AD (no local users)
- [ ] Logs are JSON to stdout
- [ ] README.md present and current
- [ ] GitHub repo registered
- [ ] Latest release has a CHANGELOG entry
- [ ] Deployment artifact is tagged and traceable
- [ ] No hard-coded secrets in code
- [ ] Repo registered in `github-repos.json`
- [ ] Standard labels created (`agent-raised`, `steward`, `captain`, `master-of-laws`, `master-builder`)
- [ ] Agent-raised issues actioned within SLA (critical: 7 days, standard: 30 days)
- [ ] Scriptorium folder exists at `Kingdom/scriptorium/content/villages/<slug>/` with valid `meta.yml` and all mandatory wiki posts for its type (see Section 15)

**Failure:** Villages that don't meet the Standard will be:
1. Warned (14 days to fix)
2. Blocked from releases (until fixed)
3. Archived (if unmaintained >90 days)

---

## Onboarding a New Village

1. **Create a GitHub repo** in the Kingdom's org
2. **Add `/health` endpoint** returning JSON status
3. **Wire the three reporting integrations** (usage, errors, logs)
4. **Write a README.md** with setup, config, deploy steps
5. **Register the repo** with The Master of Laws
6. **Register the repo** in `github-repos.json` so the Kingdom sync can mirror your issues
7. **Create standard labels** in your repo (`agent-raised`, `steward`, `captain`, `master-of-laws`, `master-builder`)
8. **Create a Scriptorium folder** at `Kingdom/scriptorium/content/villages/<slug>/` with `meta.yml` and the mandatory wiki posts for your type (see Section 15)
9. **Pass the compliance audit** (automated checks)
10. **Announced to the kingdom** (Telegram, dashboard)

The entire process should take <1 hour for a simple service.

---

## 14. Issue Tracking

**Requirement:** Every village's GitHub repo must be registered with the Kingdom so agent-raised issues are visible on the Kingdom dashboard and actioned by the village.

---

### 14.1 Register with the Kingdom sync

Add your repo to `admin-center/backend/github-repos.json`:

```json
{ "village": "your-village-slug", "owner": "RSA-Omen", "repo": "your-repo-name" }
```

Without this, the Kingdom's runner cannot visit your notice board. Your issues will not appear on the dashboard, and agents cannot route work to you.

**This is a hard requirement for recognition as a village of the realm.**

---

### 14.2 Use standard labels

All issues in village repos must use these labels so the Kingdom can filter and route correctly:

| Label | Applied by | Meaning |
|---|---|---|
| `agent-raised` | All Kingdom agents | Machine-detected, not human-filed |
| `steward` | The Steward | Dependency vulnerability |
| `captain` | The Captain of the Guard | Unresolved incident or recurring error |
| `master-of-laws` | The Master of Laws | Compliance failure |
| `master-builder` | The Master Builder | Stale work, ignored issues |

Create these labels in your repo during onboarding. The shared issue helper (`council/shared/issue.py`) applies them automatically.

---

### 14.3 Honour agent-raised issues

When an agent opens an issue in your repo it is the Kingdom telling you something needs fixing. Villages are expected to:

- **Action within 7 days** for `critical` severity issues
- **Action within 30 days** for standard issues
- **Close via PR** where possible — GitHub will auto-close the issue and the Kingdom sync will mark the todo done
- **Comment with reason** if closing without a fix (e.g. false positive, won't fix)

Ignored issues are monitored by The Master Builder. Issues older than their SLA with no activity are escalated to the king.

---

### 14.4 Never close agent issues silently

Do not close an agent-raised issue without either a linked PR or a comment explaining why. Silent closes are treated as ignored by the Master Builder's stale-todo scan.

---

## 15. Scriptorium Presence

**Requirement:** Every village must have a page in the Scriptorium that describes what it is, how it works, and what its current designs look like.

**Why:** The Scriptorium is the Kingdom's single source of truth for what every village does. Without a page, a village is invisible to the Maester, undiscoverable on the Kingdom dashboard, and impossible to onboard new humans to.

---

### 15.1 Folder layout

A village's Scriptorium content lives in the Kingdom repo at:

```
scriptorium/content/villages/<slug>/
├── meta.yml          # village info (see 15.2)
├── wiki/             # markdown pages
│   ├── index.md      # required: village overview
│   ├── changelog.md  # auto-managed by village-checkpoint (see 15.8)
│   └── *.md          # other pages (see 15.4 for required ones)
├── changelog/        # auto-managed per-checkpoint detail pages (see 15.8)
│   └── <YYYY-MM-DD>-<short-sha>.md
└── demos/            # standalone HTML mockups, flow diagrams, design iterations
    └── <YYYY-MM-DD>-<short-slug>.html
```

The `<slug>` is the village's url-safe identifier — lowercase, hyphens, no spaces (e.g. `gekko-tracks`, `the-interceptor`, `ap-process`).

`wiki/changelog.md` and the `changelog/` sibling folder are both auto-created on a village's first checkpoint; no village needs to pre-create them.

---

### 15.2 meta.yml schema

```yaml
slug: gekko-tracks                          # url-safe, matches folder name
name: Gekko Tracks                          # display name
type: app                                   # one of: app, process, service, bridge
summary: |                                  # one-line description for the homepage card
  Field service software for technician dispatch and on-site capture.
owner: lauchlan                             # responsible human
repo: https://github.com/RSA-Omen/...       # optional, code repo URL
created: 2026-05-20                         # YYYY-MM-DD the page was first created
```

All fields are required except `repo`. Missing or malformed `meta.yml` blocks the village from being rendered.

---

### 15.3 Village types

Every village declares one type. The type determines which wiki pages the village is required to have.

| Type | What it is | Examples |
|---|---|---|
| **app** | A surface a user interacts with — a UI, a screen, a workflow they perform | Gekko Tracks, PDF Removal |
| **process** | A flow that runs against systems — automated or human-driven, with steps and decisions | The Interceptor, AP Process |
| **service** | A capability invoked by other systems — an API, a daemon, an automation harness | Bender, n8n, Open WebUI |
| **bridge** | An integration to a system we don't control — the seam between us and an external | M365 (via Power Automate), Pronto Xi (via Bender) |

If a village genuinely fits two types, pick the one that captures its **primary** purpose; mention the secondary type in the `summary`. Don't invent new types — propose one to the king first.

---

### 15.4 Mandatory wiki posts per type

Every village's `wiki/` must contain `index.md` (overview). On top of that, each type has required posts:

| Type | Required (beyond `index.md`) |
|---|---|
| **app** | `ui.md` (UI mockups, with links to demos), `journeys.md` (user flows) |
| **process** | `flow.md` (current flow diagram, with link to a demo if visual), `integrations.md` (what connects to what) |
| **service** | `sequence.md` (sequence diagram of a typical call), `capabilities.md` (what it can do, what it can't) |
| **bridge** | `crossings.md` (what data crosses, in which direction), `failures.md` (how it breaks, what recovery looks like) |

A village page that's missing a mandatory post displays a **visible gap warning** on its rendered Scriptorium page. Gaps stay loud on purpose — that's the point of having the rule.

Villages may add extra wiki pages freely. Required pages can be stubs initially (one paragraph explaining what will go there), but they must exist.

---

### 15.5 Demo files

Each demo is a standalone HTML file in `demos/`.

- **Naming:** `<YYYY-MM-DD>-<short-slug>.html` (e.g. `2026-05-20-ap-flow-v3.html`)
- **Title:** the first `<title>` tag in the HTML is used as the demo card's title
- **Date:** the date in the filename is shown on the card
- **Self-contained:** demos must render without external scripts on a restricted CSP. Inline styles and embedded SVGs are fine. CDN dependencies are not.

Demos are immutable once committed. To revise a design, drop a new file with a new date — the old version stays accessible as design history.

---

### 15.6 Internal wiki links

Wiki pages may use `[[wiki-link]]` syntax to link to other Scriptorium content:

| Syntax | Resolves to |
|---|---|
| `[[bender]]` | The Bender village's `wiki/index.md` |
| `[[ap-process/flow]]` | The AP Process village's `wiki/flow.md` |
| `[[#overview]]` | A heading on the same page |
| `[[gekko-tracks/ui#dispatcher]]` | A heading on another village's page |

Unresolved links (target doesn't exist) render with a dashed underline so gaps are visible.

---

### 15.7 Editing from any Claude session

When Claude (in any village's repo) is asked to add or update Scriptorium content, the convention is:

1. Edit the relevant file under `~/Kingdom/scriptorium/content/villages/<slug>/`
2. Commit in the **Kingdom repo** (not the village's own repo) with a message prefix:
   - `wiki(<slug>): <change>` for wiki edits
   - `demo(<slug>): <description>` for a new demo
3. Push the Kingdom repo

The build pipeline (forthcoming) rebuilds and redeploys the Scriptorium on commit. Until the pipeline is live, deploy is manual (`cp scriptorium/* ~/reports/`).

Every village's own CLAUDE.md should include a one-line pointer to this section so its Claude sessions know where Scriptorium edits go. The exact wording will land as a template when the build pipeline does.

---

### 15.8 Auto-managed changelog and per-checkpoint detail pages

Every village's checkpoint history is exposed via **two paired surfaces** in the Scriptorium — a one-line index and a per-entry detail page. Both are maintained automatically by the `village-checkpoint` skill; neither is edited by hand.

#### 15.8.1 What each checkpoint produces

| Surface | Path | Purpose |
|---|---|---|
| **Index line** | `wiki/changelog.md` | One bullet per checkpoint, shown on the village's main Scriptorium page. The bullet's commit summary is a hyperlink to that checkpoint's detail page (not to GitHub). |
| **Detail page** | `changelog/<YYYY-MM-DD>-<short-sha>.md` | Standalone page with the full commit message body + metadata (date, SHA, branch, files changed). Rendered by the build to `/villages/<slug>/changelog/<filename>.html`. |

This pattern is **mandatory** for every village. The skill produces both surfaces on every checkpoint, atomically, in one Kingdom commit.

#### 15.8.2 Detail-page file format

Each `changelog/*.md` file begins with a YAML front-matter block read by the renderer:

```markdown
---
title: "<commit summary, same string the index line uses>"
commit_sha: <full 40-char SHA>
commit_date: <YYYY-MM-DD from the commit's author date>
branch: <branch name at the time of commit>
files_changed: <int>
---

# <commit summary>

<full commit body — preserved verbatim, multi-line>
```

The renderer uses the front-matter to fill the meta strip on the detail page and falls back to extracting the H1 if `title` is absent. Body content is rendered with the same markdown extensions used elsewhere in the Scriptorium (fenced_code, tables, sane_lists) and supports `[[wikilinks]]`.

#### 15.8.3 Index line format

The line appended to `wiki/changelog.md` for each checkpoint is:

```markdown
- **<YYYY-MM-DD>** — [<commit summary>](/villages/<slug>/changelog/<YYYY-MM-DD>-<short-sha>.html) (`<short-sha>`)
```

Newest entries are appended to the bottom. The short-SHA is shown in monospace so the reader can correlate with `git log` quickly. The hyperlink always points to the local Scriptorium detail page — **never** to GitHub.

#### 15.8.4 Build and deploy cadence

The Scriptorium is a static site; new detail pages and updated index lines do not become visible until the renderer runs and the output is deployed. The `village-checkpoint` skill (Step 5.6) runs `~/Kingdom/scriptorium/build.py` and copies `build/*` → `~/reports/` (served by nginx on port 8095) at the end of every successful checkpoint. No additional human step is required.

If the build or deploy fails for any reason, the source markdown remains committed to the Kingdom repo. The king can recover by running:

```sh
cd ~/Kingdom/scriptorium && .venv/bin/python build.py && cp -r build/* ~/reports/
```

#### 15.8.5 Editing rules

Auto-managed surfaces (the wiki index line and the changelog detail file) **may not be edited by hand**. To correct a wrong entry:

- **Wrong index line:** delete the line directly in the Kingdom repo with a commit explaining why.
- **Wrong detail page:** delete the file (or amend its body, preserving the front-matter) directly in the Kingdom repo with a commit explaining why. The H1 and front-matter `title` must stay in sync.

Manual edits to fix renderer-side bugs (template tweaks, etc.) are not "edits to auto-managed content" — those are edits to the Scriptorium machinery and are normal.

#### 15.8.6 Folder-missing fallback

If a village's checkpoint runs but the Scriptorium folder for that village does not exist, the skill emits a warning (Standard §15 gap) and the checkpoint still proceeds — the village's own commit is the source of truth, the Scriptorium update is a Kingdom-side mirror that can be repaired later.

### 15.9 Resolving a village's Scriptorium slug

The `village-checkpoint` skill needs to know which Scriptorium folder belongs to the current village. It resolves the slug in this order:

1. A `Scriptorium slug:` line in the village's CLAUDE.md Village Contract block (recommended — explicit and stable)
2. Otherwise, an auto-slug derived from the village name (lowercase, hyphens, alphanumeric only)

Add the `Scriptorium slug:` line to your village's CLAUDE.md Village Contract block to avoid auto-slug surprises.

### 15.10 Audit

A village fails this section if:

- Its folder is missing
- `meta.yml` is missing, malformed, or missing required fields
- `wiki/index.md` is missing
- Any mandatory wiki post for its type is missing
- A required post exists but is empty (zero bytes or whitespace-only)

Stubs are fine. Empty is not. `wiki/changelog.md` and the `changelog/` folder are exempt from the empty-file check — both are auto-created on first checkpoint, and the header alone is sufficient until the first checkpoint lands.

Each entry in `wiki/changelog.md` must hyperlink to a sibling file in `changelog/` (per §15.8.3); a plain-text changelog line without a hyperlink is a §15.8 violation. The renderer does not enforce this, but the Master of Laws audit flags it.

**Grandfather:** plain-text entries written *before* Standard v1.4 (2026-05-21) — typically "village registered in the Scriptorium" seed lines added when a village's folder was first created — are exempt. They predate the paired-surface convention and aren't associated with a real checkpoint commit. All entries dated 2026-05-21 or later must follow §15.8.3.

---

## Enforcement

The Master of Laws runs automated checks quarterly. Violations are reported to the king and the village owner. Persistent non-compliance results in archival (move to `~/Archive/`) until fixed.

This Standard is living. When new practices emerge or infrastructure changes, it will be updated. All villages are responsible for staying current.

---

## FAQ

**Q: Can we use a different auth system?**  
A: No. Azure AD is mandatory. If you need custom role/permission logic, implement it on top of the Azure AD token, not instead of it.

**Q: Do we really need to report every action?**  
A: Yes. Usage events are the kingdom's only metric of value. If you're creating value, it must be tracked.

**Q: What if we're offline and can't reach the Capital?**  
A: Queue locally and retry. Failures on usage/error reporting must not break the user's action.

**Q: Can we add fields to the standard structures (health, usage, errors)?**  
A: Yes. These are minimum specs. Add context in the `metadata` / `context` / `checks` fields as needed. Just don't remove required fields.

**Q: Who owns this Standard?**  
A: The king (you). Changes require explicit approval. But the Master of Laws enforces it.

---

**Version history:**
- **1.4** (2026-05-21) — Expanded §15.8 from a single auto-managed page into the full **paired-surface convention**: every checkpoint now produces both a hyperlinked one-line index entry in `wiki/changelog.md` *and* a per-checkpoint detail page at `changelog/<YYYY-MM-DD>-<short-sha>.md` (rendered by the build to a standalone HTML page). Detail files use YAML front-matter for metadata. The `village-checkpoint` skill also runs build+deploy after every checkpoint so changes go live without a manual step. §15.1 folder layout updated, §15.10 audit gained a new failure mode (plain-text changelog line without hyperlink).
- **1.3** (2026-05-20) — Extended Section 15 with auto-managed wiki pages (§15.8): every village-checkpoint appends an entry to that village's `wiki/changelog.md` in the Scriptorium. Added §15.9 on slug resolution from CLAUDE.md. Renumbered audit subsection.
- **1.2** (2026-05-20) — Added Section 15: Scriptorium Presence. Every village must have a folder under `Kingdom/scriptorium/content/villages/<slug>/` with `meta.yml` and the mandatory wiki posts for its type (app / process / service / bridge). Updated onboarding checklist and compliance audit accordingly.
- **1.1** (2026-05-08) — Added Section 14: Issue Tracking. Villages must register in `github-repos.json`, create standard labels, and honour agent-raised issues within SLA. Updated onboarding checklist and compliance audit accordingly.
- **1.0** (2026-04-29) — Initial Standard. Covers: health, usage, errors, auth, logs, docs, repos, changelog, feedback, notifications, DB, deployment, audit.
