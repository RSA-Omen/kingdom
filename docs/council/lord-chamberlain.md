# Lord Chamberlain — Product Requirements Document

**Role:** First point of contact for all inbound requests to the Digital team  
**Beat:** Convert intentional inputs into triaged, routed, enriched Asana tasks  
**Status:** PRD finalised 2026-05-28 — ready for Phase 1 build  
**Location:** `council/lord-chamberlain/`

---

## 1. Problem Statement

The Digital team (currently one person) receives work requests from multiple surfaces — emails, Teams messages, verbal conversations, SharePoint forms. These arrive in unstructured form, get lost in personal inboxes, or accumulate in a mental queue. There is no consistent triage: no classification, no priority signal, no routing to the right Asana section, no audit trail of what was requested and why.

The result: work is dropped, duplicated, or prioritised by whoever shouted last rather than by actual impact.

**Lord Chamberlain solves this by being the single intake officer for all Digital work requests.**

---

## 2. Goals

| Goal | Measure |
|---|---|
| Every inbound request becomes an Asana task | 0 requests handled only in personal inbox / chat |
| Every new task is classified and routed within 5 minutes | Poll cycle ≤ 5 min |
| Priority and type fields are filled before the king sees the task | 100% of triaged tasks have Priority + Task Type set |
| Code-related tasks have related/duplicate issues surfaced before a new one is created | Search run on every bug/feature triage |
| No private content enters the system | Inputs are form-only or operator-initiated paste; no inbox watching |
| Operator can correct any triage decision | Re-triage comment trigger available on every task |
| PAT health monitored | Telegram alert within 5 min of token failure |

## 3. Non-Goals

- Lord Chamberlain does **not** assign tasks to other people (operator decides)
- Lord Chamberlain does **not** set due dates (operator decides)
- Lord Chamberlain does **not** close or complete tasks
- Lord Chamberlain does **not** watch personal Outlook or Teams inboxes
- Lord Chamberlain does **not** contact requestors directly — requestor confirmation is Power Automate's responsibility
- Lord Chamberlain does **not** make purchasing, HR, or financial decisions
- Lord Chamberlain does **not** monitor its own input PA flow — Bender's PA checker does that

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT LAYER                              │
│                                                                 │
│  SharePoint Form          Paste-to-Ticket Interface             │
│  (structured request)     (operator pastes raw text)            │
│       │                         │                               │
│       └──── Power Automate ─────┘   Capital API                 │
│                   │             POST /api/tickets/ingest         │
│                   └──── Asana task created ─────────────────────┤
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LORD CHAMBERLAIN AGENT                       │
│                    (polls every 5 minutes)                      │
│                                                                 │
│  MAIN LOOP                                                      │
│  1. Poll Asana My Tasks → Recently Assigned                     │
│  2. Skip tasks already marked processed (DB + Asana tag)        │
│  3. Claude classifies each new task                             │
│  4. Search GitHub: open + resolved issues, find related         │
│  5. Apply routing + enrichment rules                            │
│  6. Update Asana task (fields + comment + section + lc-tag)     │
│  7. Create GitHub issue if code-related and no duplicate found  │
│  8. Send Telegram notification to operator                      │
│                                                                 │
│  RE-TRIAGE LOOP (runs alongside main loop)                      │
│  1. Fetch stories (comments) on all lc-processed tasks          │
│  2. If comment contains `/retriage` → remove from processed     │
│     table, remove lc-tag, re-enter main loop                   │
│                                                                 │
│  HEALTH CHECK (runs on every cycle)                             │
│  1. Ping Asana API with current PAT                             │
│  2. If 401/403 → Telegram alert immediately, skip cycle         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Input Sources

### 5.1 Input A — SharePoint Form (primary)

Barry configures a Power Automate flow (same pattern as existing IT Support form). **Requestor confirmation (auto-reply) is PA's responsibility, not Lord Chamberlain's.**

| Form field | Maps to Asana |
|---|---|
| Request title | Task name |
| Description | Task notes |
| Requestor name | Custom field: `Raised by` |
| Request type | Tag on task (hint for classification) |
| Product / area | Tag on task (hint for routing) |
| Urgency (self-assessed) | Stored in notes; Lord Chamberlain may override |

Power Automate:
- Trigger: form submitted
- Action 1: create Asana task in Digital project, assigned to operator
- Action 2: send confirmation email to requestor — "Your request has been received. Reference: [task GID]."
- Result: task lands in **My Tasks → Recently Assigned**

**PA flow health monitoring:** Bender's existing PA flow checker monitors the Digital intake flow. If the flow shows failed runs, Bender's health check surfaces it — no additional monitoring needed in Lord Chamberlain.

### 5.2 Input B — Paste-to-Ticket (operator-initiated)

When a relevant message arrives in the operator's personal inbox or Teams DM, the operator copies and pastes the raw text into one of two surfaces:

**Surface 1: Kingdom Dashboard**
- URL: `/tickets/new` on the Capital dashboard
- UI: text area + optional "context" field (who sent it, what channel)
- Action: POST to `Capital API → /api/tickets/ingest`

**Surface 2: Telegram command**
- Command: `/ticket <pasted text>`
- Handled by: Telegram bot → POST to `Capital API → /api/tickets/ingest`

---

## 6. Classification Taxonomy

Claude reads the task title + notes and assigns one primary classification:

| Classification | Description | Routing destination |
|---|---|---|
| `bug` | Something is broken or not working as expected | Product section (see §7) + GitHub search + issue |
| `feature` | New capability requested | Product section + GitHub search + issue |
| `support` | How-to question, user needs help using a tool | Digital → Customer Support |
| `internal-tool` | Request for automation or internal system improvement | Digital → Internal System Automations |
| `it-request` | Hardware, software licence, access, infrastructure | IT Support Request project → New Requests |
| `rd-idea` | Product concept, brainstorm, speculative idea | Digital → relevant brainstorm section |
| `unclear` | Insufficient information to classify | Stays in Recently Assigned + comment requesting clarification |

Claude also assigns:
- **Priority**: `High` / `Medium` / `Low` — based on urgency language, business impact, affected users
- **Confidence**: `high` / `medium` / `low` — stored in triage comment

---

## 7. Routing Rules

### Product routing for `bug` and `feature`

| Keyword signals | Target section in Digital |
|---|---|
| OLGA, draw, drawings, works order, transmittal | OLGA Defects and Improvements |
| Carbon Scout, CS, carbon, gold room | Carbon Scout Mk6 / Mk7 sections |
| ILR, Inline Leach, reactor | Inline Leach Reactors |
| Gaia, biodigester, compost | Gaia Biodigester Improvements |
| Gekko Tracks, timesheet, leave | Internal System Automations |
| Pronto, ERP, inventory | Internal System Automations |
| Reception, voice mail, phone | Internal System Automations |
| None of the above | Digital → Inbox section (unrouted) |

### Section routing for other classifications

| Classification | Project | Section |
|---|---|---|
| `support` | Digital | Customer Support |
| `internal-tool` | Digital | Internal System Automations |
| `it-request` | IT Support Request | New Requests |
| `rd-idea` | Digital | Matching brainstorm section or Parking Lot |
| `unclear` | (stays in My Tasks) | Recently Assigned |

---

## 8. Asana Actions Per Triage

For every triaged task, Lord Chamberlain:

1. **Sets `Priority`** custom field (High / Medium / Low)
2. **Sets `Task Status`** custom field:
   - `bug` / `feature` → `In Progress`
   - `support` → `Waiting-Internal`
   - `it-request` → `Waiting-External`
   - `unclear` → `Review`
3. **Moves task** to target section in target project
4. **Adds tag `lc-triaged`** to the task — dual truth alongside Capital DB
5. **Adds a comment** structured as:

```
🤖 Lord Chamberlain — Triage Report

Classification: Feature Request (confidence: high)
Priority: Medium
Routing: Digital → Internal System Automations

Reasoning:
The request asks for an automation to sync Drawing records from Pronto to the
OLGA portal. No existing code path handles this. Treat as a new feature.

Related issues found:
  • #38 (open) — OLGA: Drawing sync fails on special characters [OPEN]
  • #21 (closed) — Pronto → OLGA export MVP [RESOLVED 2026-03-12]

GitHub: https://github.com/Gekko/digital/issues/42

To re-triage this task, comment: /retriage
```

6. **GitHub search + issue creation** (for `bug` / `feature` only — see §10)
7. **Sends Telegram notification** to operator

---

## 9. Re-Triage Trigger

Operator can correct any triage decision by commenting `/retriage` on the Asana task.

**Lord Chamberlain re-triage loop (every poll cycle):**

1. Fetch all stories (comments) added since last poll on tasks tagged `lc-triaged`
2. If any comment text contains `/retriage`:
   - Remove task GID from `lord_chamberlain_processed` table
   - Remove `lc-triaged` tag from Asana task
   - Task re-enters main triage loop on the next cycle
   - Lord Chamberlain comments: "Re-triage requested. Will re-process on next cycle."

This handles both manual corrections and the `unclear` resolution case — when a requestor adds more information to an unclear task, the operator adds `/retriage` to trigger re-classification with the new context.

---

## 10. GitHub Integration — Search First, Create Second

For `bug` and `feature` classifications, Lord Chamberlain **always searches before creating.**

### Search strategy

Three searches run against the target repo:

1. **Open issues** — keyword match on task title + key nouns from description
2. **Recently resolved** (closed in last 90 days) — same keyword match
3. **Historical** (closed, older) — looser match on product area + classification

### Decision logic

| Search result | Action |
|---|---|
| Strong match found (open issue) | Link existing issue in triage comment. No new issue created. |
| Strong match found (recently resolved) | Flag in comment: "This may be a regression of #XX resolved on DATE." Create new issue with link. |
| Weak / partial matches | List as related context in triage comment. Create new issue. |
| No matches | Create new issue. |

### Issue creation

- Title: task name
- Body: description + Asana task link + related issues found + triage reasoning
- Labels: `bug` or `enhancement` + product label (`olga`, `carbon-scout`, `ilr`, `gaia`, `digital-platform`)
- Issue URL stored back in Asana triage comment

---

## 11. PAT Health Monitor

Every poll cycle, before any Asana API calls:

```python
def check_pat_health() -> bool:
    resp = GET /api/1.0/users/me  (with current ASANA_API_TOKEN)
    if resp.status == 401 or resp.status == 403:
        telegram.send("⚠️ Lord Chamberlain: Asana PAT is invalid or expired. Triage paused.")
        return False
    return True
```

If health check fails: skip cycle, send Telegram alert, log to Capital errors table.

The PAT is a personal access token tied to `Lauchlan.DuPreez@gekkos.com`. When it needs rotation, the new token goes in `.env` on gvdi-30 and the service is restarted.

---

## 12. Processed State Tracking

Dual truth — both Capital DB and Asana tag must be set for a task to be considered processed:

**Capital DB table:**
```sql
CREATE TABLE lord_chamberlain_processed (
  task_gid        TEXT PRIMARY KEY,
  processed_at    INTEGER NOT NULL,
  classification  TEXT,
  confidence      TEXT,
  github_issue_url TEXT,
  retriage_count  INTEGER NOT NULL DEFAULT 0
);
```

**Asana tag:** `lc-triaged` added to each processed task.

If DB is wiped, the Asana tag prevents re-triage. If the tag is manually removed, the DB catches it. Both must be present to skip.

---

## 13. Asana Client Module

Lives at: `council/lord-chamberlain/asana_client.py`

```python
def check_pat() -> bool
    # GET /users/me — returns True if 200, False on 401/403

def get_my_recently_assigned(user_task_list_gid: str) -> list[dict]
    # GET /user_task_lists/{gid}/tasks?completed_since=now

def get_task_stories_since(task_gid: str, since_unix: int) -> list[dict]
    # GET /tasks/{gid}/stories — filter to comments after since_unix

def update_task_fields(task_gid: str, priority_gid: str, status_gid: str) -> bool
    # PATCH /tasks/{gid} with custom_fields

def move_task_to_section(task_gid: str, section_gid: str) -> bool
    # POST /sections/{gid}/addTask

def add_tag(task_gid: str, tag_gid: str) -> bool
    # POST /tasks/{gid}/addTag

def remove_tag(task_gid: str, tag_gid: str) -> bool
    # POST /tasks/{gid}/removeTag

def add_comment(task_gid: str, text: str) -> bool
    # POST /tasks/{gid}/stories

def create_task(project_gid: str, section_gid: str, name: str, notes: str, assignee_gid: str) -> dict
    # POST /tasks

def get_or_create_tag(workspace_gid: str, name: str) -> str
    # GET /tags?workspace={gid} — find by name, or POST /tags to create
```

---

## 14. Capital API Contract

### POST /api/tickets/ingest

Accepts raw pasted text and creates an Asana task.

**Request:**
```json
{
  "raw_text": "Hi Lauchlan, the OLGA drawing export is broken again...",
  "context": "Pasted from Teams DM — Mike Harrington, 28 May 2026",
  "source": "paste | telegram"
}
```

**Response:**
```json
{
  "ok": true,
  "asana_task_gid": "1215184471028159",
  "asana_task_url": "https://app.asana.com/0/...",
  "message": "Task created. Lord Chamberlain will triage within 5 minutes."
}
```

---

## 15. Key Constants

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
CF_PRIORITY              = "1200265450097721"
CF_TASK_STATUS           = "1200445220494893"

# Priority enum option GIDs — fetch at runtime on first run
# Tag GID for lc-triaged — create on first run via get_or_create_tag()
```

---

## 16. File Structure

```
council/lord-chamberlain/
├── chamberlain.py        ← main loop: triage + re-triage + health check
├── asana_client.py       ← Asana API wrapper (all functions in §13)
├── github_client.py      ← search + create issues
├── classifier.py         ← Claude prompt: classification + priority + confidence
├── constants.py          ← all GIDs from §15
├── lord-chamberlain.service
└── lord-chamberlain.timer
```

---

## 17. Build Phases

### Phase 1 — Core triage loop
Asana client, PAT health check, poll + classify, routing, comment + fields + tag, Capital DB tracking, Telegram notification.

### Phase 2 — GitHub integration
Search (open + resolved + historical), deduplication logic, issue creation with related context.

### Phase 3 — Re-triage trigger
Story polling on `lc-triaged` tasks, `/retriage` detection, DB + tag cleanup, re-queue.

### Phase 4 — Paste-to-ticket
`POST /api/tickets/ingest` Capital endpoint, Kingdom dashboard `/tickets/new` page, Telegram `/ticket` command handler.

### Phase 5 — Reporting
Dashboard inbound-queue card, Herald integration for weekly ticket digest.

---

## 18. Decisions (resolved 2026-05-28)

| # | Decision |
|---|---|
| 1 | **GitHub:** New repo under the Gekko GitHub org (to be created) |
| 2 | **Form:** Use the existing IT Support form Barry already has — no new form needed |
| 3 | **Processed marker:** Asana tag `lc-triaged` (simpler, easy to strip for `/retriage`) |
