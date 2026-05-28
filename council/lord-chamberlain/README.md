# The Lord Chamberlain

**Beat:** Convert every inbound Digital work request into a triaged, routed, enriched Asana task.

**Status:** PRD finalised 2026-05-28 — Phase 1 build next.

**Full PRD:** `docs/council/lord-chamberlain.md`  
**Scriptorium:** http://gvdi-30:8095/villages/kingdom.html#lord-chamberlain  
**System diagram demo:** http://gvdi-30:8095/villages/kingdom/demos/2026-05-28-lord-chamberlain-system.html

---

## What it does

Polls Asana My Tasks → Recently Assigned every 5 minutes. For each new task:

1. PAT health check (alerts Telegram on failure, skips cycle)
2. Claude classifies: `bug / feature / support / internal-tool / it-request / rd-idea / unclear`
3. Searches GitHub for open + recently resolved + historical related issues
4. Routes task to correct Asana project + section
5. Sets Priority + Task Status custom fields
6. Adds `lc-triaged` tag (dual-truth with Capital DB)
7. Adds structured triage comment with reasoning + related issues
8. Creates GitHub issue if code-related and no strong duplicate found
9. Sends Telegram notification to operator

Operator can trigger re-triage by commenting `/retriage` on any task.

---

## Build phases

- [ ] **Phase 1** — Core triage loop (Asana poll, Claude classify, route, comment, tag, DB, Telegram)
- [ ] **Phase 2** — GitHub integration (search first, create second)
- [ ] **Phase 3** — Re-triage trigger (`/retriage` comment detection)
- [ ] **Phase 4** — Paste-to-ticket (Capital API endpoint + dashboard UI + Telegram command)
- [ ] **Phase 5** — Reporting (dashboard queue card + Herald digest)

---

## Key constants

```python
ASANA_WORKSPACE_GID      = "1149511082091035"   # Gekko Systems
ASANA_MY_TASKS_GID       = "1211518294083562"   # Lauchlan's My Tasks list
ASANA_DIGITAL_GID        = "1200457408099570"   # Digital project
ASANA_IT_SUPPORT_GID     = "1200470842604591"   # IT Support Request project
ASANA_USER_GID           = "1211518293871240"   # Lauchlan

# Digital sections
SECTION_INBOX            = "1200527647096291"
SECTION_CUSTOMER_SUPPORT = "1203308202412854"
SECTION_INTERNAL_SYSTEMS = "1211583322141287"
SECTION_OLGA             = "1210783271964117"
SECTION_CARBON_SCOUT_MK6 = "1208821439698421"
SECTION_ILR              = "1210746791091336"
SECTION_GAIA             = "1213197771245521"
SECTION_PARKING_LOT      = "1212234392758835"

# IT Support sections
SECTION_IT_NEW_REQUESTS  = "1200470842604593"

# Digital custom field GIDs
CF_PRIORITY              = "1200265450097721"   # enum: High/Medium/Low
CF_TASK_STATUS           = "1200445220494893"   # enum: Good/Review/In Progress/...
```

Asana PAT lives in `~/Operations/bender/.env` as `ASANA_API_TOKEN`.  
Copy to `~/Kingdom/.env` before Phase 1 build.

---

## Input sources

- **SharePoint form** → Barry's existing IT Support PA flow creates Asana task → lands in Recently Assigned
- **Paste-to-ticket** → `POST /api/tickets/ingest` (Phase 4) → same pipeline

## Decisions locked

- GitHub issues go to a **new repo under the Gekko GitHub org** (org to be created)
- Use **Barry's existing IT Support form** — no new form needed
- Processed marker: **`lc-triaged` Asana tag** (not a custom field)
- No Capital DB tickets table — Asana is the source of truth
- Requestor confirmation = PA's job, not Lord Chamberlain's
- PA intake flow health = Bender's PA checker, not Lord Chamberlain's
