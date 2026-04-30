# The Gekko Standard — What Every Village Must Keep

**Version:** 1.0  
**Effective:** 2026-04-29  
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
6. **Pass the compliance audit** (automated checks)
7. **Announced to the kingdom** (Telegram, dashboard)

The entire process should take <1 hour for a simple service.

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
- **1.0** (2026-04-29) — Initial Standard. Covers: health, usage, errors, auth, logs, docs, repos, changelog, feedback, notifications, DB, deployment, audit.
