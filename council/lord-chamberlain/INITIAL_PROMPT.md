# Lord Chamberlain — Phase 1 Build Prompt

> Copy everything below this line into a new chat to start the build.

---

We're building **The Lord Chamberlain** — a Royal Court agent in the Kingdom (`~/Kingdom`), Gekko's internal developer platform. The PRD is fully written and all decisions are locked. This chat's job is to build **Phase 1** and only Phase 1.

Read these files first before writing any code:

- `~/Kingdom/docs/council/lord-chamberlain.md` — the full PRD
- `~/Kingdom/council/lord-chamberlain/README.md` — build summary + all Asana GIDs
- `~/Kingdom/CLAUDE.md` — how to work on the Kingdom (build principles, naming, style)

---

## What Phase 1 delivers

A Python agent at `~/Kingdom/council/lord-chamberlain/chamberlain.py` that:

1. **PAT health check** — pings `GET https://app.asana.com/api/1.0/users/me` with the Asana token before each cycle. If 401/403, sends a Telegram alert and skips the cycle.
2. **Polls Asana** — fetches all incomplete tasks from My Tasks → Recently Assigned (`user_task_list_gid = 1211518294083562`).
3. **Skips processed tasks** — checks `lord_chamberlain_processed` table in Capital DB AND checks for `lc-triaged` Asana tag. Both must be absent for a task to be processed.
4. **Claude classifies** — sends task title + notes to Claude Sonnet. Returns: `classification` (one of `bug / feature / support / internal-tool / it-request / rd-idea / unclear`), `priority` (`High / Medium / Low`), `confidence` (`high / medium / low`), and one-paragraph `reasoning`.
5. **Routes** — moves task to the correct Asana project + section based on classification + keyword signals (routing table is in the PRD §7).
6. **Sets custom fields** — Priority + Task Status on the Asana task.
7. **Tags** — adds `lc-triaged` tag to the Asana task (create tag if it doesn't exist via `GET /tags?workspace=...`, create if missing).
8. **Comments** — adds a structured triage comment to the task (format in PRD §8).
9. **Marks processed** — inserts into `lord_chamberlain_processed` table in Capital DB.
10. **Telegrams** — sends one notification per triaged task to the operator.

Phase 1 does **not** include GitHub integration (Phase 2), re-triage trigger (Phase 3), or paste-to-ticket (Phase 4). Leave stubs with `# TODO Phase N` comments where those features will plug in.

---

## File structure to create

```
council/lord-chamberlain/
├── chamberlain.py       ← main loop (already stubbed — extend it)
├── asana_client.py      ← all Asana API calls (create fresh)
├── classifier.py        ← Claude classification prompt (create fresh)
├── constants.py         ← all GIDs (create fresh from README)
├── lord-chamberlain.service   ← systemd unit (create)
└── lord-chamberlain.timer     ← systemd timer, 5-min interval (create)
```

---

## Environment

**Asana PAT** is in `~/Operations/bender/.env` as `ASANA_API_TOKEN`.
Also add it to `~/Kingdom/.env` (create the file if it doesn't exist):
```
ASANA_API_TOKEN=<copy from ~/Operations/bender/.env>
ASANA_WORKSPACE_GID=1149511082091035
ASANA_MY_TASKS_GID=1211518294083562
```

**Telegram** credentials are in `~/.kingdom.env`:
```bash
source ~/.kingdom.env   # gives TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
```

**Capital DB** is at `~/Kingdom/capital/api/data/app-registry.db` (better-sqlite3 in the Node container; from Python use the `sqlite3` stdlib). The migration for `lord_chamberlain_processed` needs to be added to `~/Kingdom/capital/api/src/migrations/` and applied via `docker exec kingdom-capital-api node -e "..."` — look at how other migrations are structured (e.g. `020_pa_flow_tracking.sql`).

**Claude API** — use the `anthropic` Python package. Key is in the environment as `ANTHROPIC_API_KEY`. Use `claude-sonnet-4-5` for classification (routine task).

**Python venv** — the Kingdom uses `.venv` in the repo root. Check if it exists; if not, create it with `python3 -m venv .venv` from `~/Kingdom/` and install dependencies there.

---

## Key constants (already mapped — no API calls needed)

```python
# asana GIDs
ASANA_WORKSPACE_GID      = "1149511082091035"
ASANA_MY_TASKS_GID       = "1211518294083562"
ASANA_DIGITAL_GID        = "1200457408099570"
ASANA_IT_SUPPORT_GID     = "1200470842604591"
ASANA_USER_GID           = "1211518293871240"

# Digital project sections
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

# Custom field GIDs (enum option GIDs need to be fetched at runtime on first run)
CF_PRIORITY              = "1200265450097721"
CF_TASK_STATUS           = "1200445220494893"
```

The enum option GIDs for Priority (High/Medium/Low) and Task Status need to be fetched from the Asana API on first run — call `GET /custom_fields/{CF_PRIORITY}` and cache the result in a local JSON file (`council/lord-chamberlain/.cf_cache.json`). Don't hardcode them.

---

## Classification prompt shape

```python
SYSTEM = """You are Lord Chamberlain, the intake officer for the Gekko Digital team.
You classify inbound work requests and route them to the right place.

Respond with a JSON object only — no prose outside the JSON:
{
  "classification": "bug|feature|support|internal-tool|it-request|rd-idea|unclear",
  "priority": "High|Medium|Low",
  "confidence": "high|medium|low",
  "reasoning": "One paragraph explaining the classification decision."
}"""

USER = f"Task: {task['name']}\n\nNotes: {task.get('notes', '(none)')}"
```

Use `anthropic.Anthropic().messages.create(model="claude-sonnet-4-5", max_tokens=512, ...)`.

---

## Routing keyword signals

| Keywords in title/notes | Section |
|---|---|
| OLGA, draw, drawings, works order, transmittal | `SECTION_OLGA` |
| Carbon Scout, CS, carbon, gold room | `SECTION_CARBON_SCOUT_MK6` |
| ILR, Inline Leach, reactor | `SECTION_ILR` |
| Gaia, biodigester, compost | `SECTION_GAIA` |
| Gekko Tracks, timesheet, leave, reception, voice mail | `SECTION_INTERNAL_SYSTEMS` |
| Pronto, ERP, inventory | `SECTION_INTERNAL_SYSTEMS` |
| No signal | `SECTION_INBOX` |

For `support` → `SECTION_CUSTOMER_SUPPORT`  
For `internal-tool` → `SECTION_INTERNAL_SYSTEMS`  
For `it-request` → IT Support project, `SECTION_IT_NEW_REQUESTS`  
For `rd-idea` → `SECTION_PARKING_LOT` (until brainstorm routing is refined)  
For `unclear` → don't move (stays in Recently Assigned)

---

## Triage comment format

```
🤖 Lord Chamberlain — Triage Report

Classification: {classification} (confidence: {confidence})
Priority: {priority}
Routing: {project_name} → {section_name}

Reasoning:
{reasoning}

GitHub: [Phase 2 — not yet wired]

To re-triage this task, comment: /retriage
```

---

## Processed state DB schema

Add this migration to `~/Kingdom/capital/api/src/migrations/021_lord_chamberlain.sql`:

```sql
CREATE TABLE IF NOT EXISTS lord_chamberlain_processed (
  task_gid        TEXT PRIMARY KEY,
  processed_at    INTEGER NOT NULL,
  classification  TEXT,
  confidence      TEXT,
  github_issue_url TEXT,
  retriage_count  INTEGER NOT NULL DEFAULT 0
);
```

Apply via:
```bash
docker exec kingdom-capital-api node -e "
const Database = require('better-sqlite3');
const db = new Database('/data/app-registry.db');
db.exec(\`CREATE TABLE IF NOT EXISTS lord_chamberlain_processed (
  task_gid TEXT PRIMARY KEY,
  processed_at INTEGER NOT NULL,
  classification TEXT,
  confidence TEXT,
  github_issue_url TEXT,
  retriage_count INTEGER NOT NULL DEFAULT 0
)\`);
console.log('done');
"
```

From Python, access the DB directly with `sqlite3.connect('/home/lauchlandupreez/Kingdom/capital/api/data/app-registry.db')`.

---

## Systemd timer

```ini
# lord-chamberlain.timer
[Unit]
Description=Lord Chamberlain — triage poll every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Unit=lord-chamberlain.service

[Install]
WantedBy=timers.target
```

```ini
# lord-chamberlain.service
[Unit]
Description=Lord Chamberlain — Digital ticket triage agent

[Service]
Type=oneshot
WorkingDirectory=/home/lauchlandupreez/Kingdom
EnvironmentFile=/home/lauchlandupreez/Kingdom/.env
EnvironmentFile=/home/lauchlandupreez/.kingdom.env
ExecStart=/home/lauchlandupreez/Kingdom/.venv/bin/python -m council.lord-chamberlain.chamberlain
StandardOutput=journal
StandardError=journal
```

Install as user units: `~/.config/systemd/user/` — same pattern as the Steward.

---

## Build order suggestion

1. Write `constants.py` — all GIDs, no logic
2. Write `asana_client.py` — PAT check, fetch tasks, update fields, add tag, add comment, move to section
3. Test Asana client manually with a real task before touching Claude
4. Write `classifier.py` — Claude prompt, parse JSON response, fallback to `unclear` on parse error
5. Write the DB migration and apply it
6. Wire `chamberlain.py` — the main loop using all of the above
7. Run manually: `python -m council.lord-chamberlain.chamberlain`
8. Verify on a real Recently Assigned task (create a test task in Asana first)
9. Write systemd units, install, enable

---

## Kingdom build principles (from CLAUDE.md)

- **Human-in-the-loop always.** Lord Chamberlain classifies and moves tasks — it does not contact requestors, delete anything, or take external actions.
- **Best-effort for Capital/Telegram calls.** Failures on these must not prevent the main triage from completing. Wrap in try/except, log, continue.
- **Commit after each phase** using the `kingdom-checkpoint` skill.
- **Don't skip the diff read** before checkpointing — the commit message must reflect what actually changed.
