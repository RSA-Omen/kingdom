# Phase 1 — Visibility Design Spec
**Date:** 2026-05-04  
**Status:** Approved  
**Roadmap phase:** Phase 1 — Visibility

---

## Goal

Zero silent failures. Every error that occurs in any village lands in the Kingdom before a user reports it. The King sees the state of the realm every morning before opening a laptop.

**Measurable outcome:** Within 2 weeks of deployment, 100% of errors across the three initial villages are captured automatically. Morning digest delivered at 06:00 CAT with no manual input.

---

## What Gets Built

### 1. Error Capture API

A new endpoint on the existing admin-center API (at `~/admin-center/`):

```
POST /api/errors
```

**Payload:**
```json
{
  "village": "interceptor",
  "message": "500 Internal Server Error on /upload",
  "stack": "Traceback...",
  "severity": "error" | "warning" | "info"
}
```

**Response:**
```json
{
  "id": "uuid-v4",
  "received_at": "2026-05-04T06:00:00Z"
}
```

Kingdom assigns UUID and timestamp on receipt. Villages never generate their own error IDs.

**Village error handler (10 lines, dropped into each village):**
```python
import requests, traceback

KINGDOM_API = "http://localhost:5001/api/errors"
VILLAGE_NAME = "interceptor"  # change per village

def report_error(message, exc=None, severity="error"):
    try:
        requests.post(KINGDOM_API, json={
            "village": VILLAGE_NAME,
            "message": message,
            "stack": traceback.format_exc() if exc else "",
            "severity": severity
        }, timeout=2)
    except Exception:
        pass  # never let error reporting break the app
```

Call `report_error("message", exc)` in any `except` block.

---

### 2. Data Model

Two new SQLite tables added to the admin-center database (`~/admin-center/data/kingdom.db`):

**errors**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key, assigned by Kingdom |
| village | TEXT | e.g. "interceptor", "gekko-tracks" |
| message | TEXT | Error message |
| stack | TEXT | Full stack trace (nullable) |
| severity | TEXT | "error", "warning", "info" |
| status | TEXT | "open", "resolved" — default "open" |
| linked_todo_id | TEXT (UUID) | Nullable — set when To-Do is created from this error |
| created_at | INTEGER | Unix timestamp |

**todos**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| village | TEXT | Which village this todo belongs to |
| title | TEXT | Short description |
| description | TEXT | Full detail (nullable) |
| source | TEXT | "manual" or the error UUID that spawned it |
| status | TEXT | "open", "in-progress", "done" — default "open" |
| created_at | INTEGER | Unix timestamp |

Errors link to to-dos one-way via `linked_todo_id`. To-dos reference their origin error via `source`. A to-do can exist without an error (`source = "manual"`).

---

### 3. Dashboard — Four Pages

Built in the existing Next.js dashboard at `capital/dashboard/`.

**Page 1: Dashboard (home)**
- 4 summary cards: Open Errors · Open To-Dos · Errors linked to To-Dos · Villages monitored
- Recent errors feed: village name, message, timestamp, severity dot, `→ TODO` badge if linked
- Auto-refreshes every 60 seconds

**Page 2: Errors**  
Internal tabs: All · By Village · Linked to To-Do  
Each row: severity indicator · village · message · timestamp · status · "Create To-Do" button  
"Create To-Do" spawns a linked to-do with the error UUID pre-filled, updates `linked_todo_id` on the error.

**Page 3: To-Dos**  
Internal tabs: All · By Village · Linked · Unlinked  
Each row: status badge · village · title · source (manual or `→ Error` badge) · created date  
Status can be updated inline (open → in-progress → done).

**Page 4: Villages**  
One row per registered village: name · last error · error count (24h) · open to-do count · health status dot.

---

### 4. Telegram Morning Digest

Delivered daily at **06:00 CAT** via the existing Telegram bot infrastructure.

**Format:**
```
⚔ Kingdom Morning Brief — 4 May 2026

🔴 Errors (12 open, 3 new since yesterday)
  • Interceptor — 2 new errors
  • Gekko Tracks — 1 new error

✅ To-Dos (8 open)
  • 3 linked to errors
  • 5 manual

🏘 Villages
  • Interceptor — ⚠ 2 open errors
  • Gekko Tracks — ⚠ 1 open error  
  • AP Processing — ✓ clean
  • Kanban AI — ✓ clean
```

Implemented as a scheduled Python script run by systemd timer at 06:00 CAT.

---

## Villages Onboarded (in order)

1. **Interceptor** — most active, highest error surface area, Python backend
2. **Gekko Tracks** — FastAPI backend, structured logging already exists
3. **AP Processing** — highest business impact, errors directly affect finance team

All three get the same 10-line error handler. Rollout takes one session per village.

---

## What's Explicitly Not in This Phase

- Automatic to-do creation from repeated errors (Captain of the Guard — Phase 2)
- Error grouping / deduplication (Phase 2)
- Email delivery of digest (Phase 3)
- Village Yarl interface (Phase 4)
- Alerts on error spike (Phase 2)

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Where errors land | Existing admin-center API | Already running, no new service to deploy |
| Database | SQLite in admin-center | Consistent with existing pattern, no new infra |
| Dashboard location | `capital/dashboard/` | Already scaffolded, Next.js + Tailwind |
| Digest delivery | Existing Telegram bot | Already has cron infrastructure |
| To-do creation | Manual (King clicks) | Keeps King in the loop; auto-creation is Phase 2 |
| Error handler approach | 10-line snippet per village | No SDK dependency, no breaking changes to villages |
