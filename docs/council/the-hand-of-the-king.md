# The Hand of the King

**Beat:** The king's direct assistant. Reads the realm's ledger of matters (TODO.md, then GitHub Issues), prioritises before the king, surfaces what's overdue, drafts the day's agenda. Has authority over the rest of the Council in scheduling.

**Status:** v0 (TODO-only; GitHub Issues integration deferred)
**First summoned:** 2026-04-28

---

## What he watches

| Source | Read pattern |
|---|---|
| `~/Kingdom/TODO.md` | Re-read on every brief request and on a 30-min poll cycle |
| `~/Kingdom/.hand-state.json` | Persistent state — last seen tasks, deferral schedules, completion log |
| **Future:** GitHub Issues across watched repos | Once the GitHub Manager is built |

---

## What he produces

Two outputs from the same data, regenerated on demand:

### 1. The Brief (markdown, human-readable)
For Telegram delivery and the Throne Room widget. Format:

```markdown
**Sire, your agenda for {date}.**

🔴 **{count}** matters of the highest priority.
🟡 **{count}** matters of medium priority.
🟢 **{count}** ideas worth keeping warm.

**Today's three:**
1. **{P1 item}** — {brief context, why this one}
2. **{P1 item}** — {…}
3. **{P2 item}** — {…}

**The Master Builder noted** that {high-leverage architectural item}.
**The Castellan suggests** {cleanup item}.

— *The Hand, {timestamp}*
```

### 2. The Agenda (JSON, machine-readable)
For the dashboard, MCP tools, and any other consumer.

```json
{
  "generated_at": "2026-04-28T06:00:00+02:00",
  "summary": {
    "total_open": 47,
    "p1_count": 6,
    "p2_count": 19,
    "p3_count": 14,
    "ideas": 8,
    "overdue_p1": 2
  },
  "today": [
    {"id": "p1.1", "section": "Right now (foundation work)", "priority": "P1", "title": "Build The Hand of the King", "deferred_since": null},
    ...
  ],
  "by_section": {
    "Right now (foundation work)": [...],
    "The Royal Court": [...],
    ...
  }
}
```

---

## Prioritisation logic

For v0, kept simple and explainable:

1. **All open matters** are extracted from TODO.md (lines starting with `- [ ]`)
2. Each matter is assigned a **priority weight**:
   - `[P1]` → 100
   - `[P2]` → 50
   - `[P3]` → 20
   - `[IDEA]` → 5
   - No tag → 30 (treated as P2-ish)
3. **Adjustment factors** (additive):
   - Has been deferred ≥1 time: +10
   - Is in the "Right now (foundation work)" section: +20
   - Is the next item the king asked about (recent conversation): +30 *(future, not in v0)*
4. The **today's three** are the top 3 by adjusted weight, with at most 2 from any single section (to avoid the king being shown only one type of work).

The king can override at any time via `/promote` and `/defer`. Overrides write to `.hand-state.json`.

---

## Interfaces

### CLI (v0, today)

```bash
python -m hand brief         # full markdown brief to stdout
python -m hand today         # JSON of today's three
python -m hand agenda        # full JSON agenda
python -m hand done <id>     # mark item complete (writes to TODO.md)
python -m hand defer <id> <days>   # defer item N days
```

### Telegram (next iteration)

Slash commands routed via the existing Telegram bot:
- `/agenda` → full brief
- `/today` → today's three
- `/done <id>` / `/defer <id> <days>` / `/promote <id>` / `/add <text>`

Morning push at 06:00 CAT (Africa/Johannesburg) via cron.

### Throne Room widget (next iteration)

Component on `/` (the landing page) titled *"The Hand of the King says…"*. Pulls JSON agenda from the Hand's HTTP endpoint or static file. Shows today's three with action buttons.

### MCP (next iteration)

Three tools, exposed via the Capital MCP server:
- `hand_get_agenda(scope?: "today" | "full")`
- `hand_act(item_id, action: "done" | "defer" | "promote", value?)`
- `hand_propose_priorities()` — returns a ranked, explained list, no actions taken

---

## What he cannot do

The Hand is the most powerful member of the Council in scheduling, but the constraints from `CLAUDE.md` apply:

- He **does not** edit code. His writes are limited to TODO.md (mark done, defer, add) and his own state file.
- He **does not** delete TODO entries. Marking complete moves them to a "Completed" section at the bottom of TODO.md (with a date).
- He **does not** decide priorities for the king without explanation. Every "today's three" comes with a one-line "why".
- He **does not** push notifications more than once per day without urgent cause. Quiet by default.

---

## Schedule (when wired up)

| Trigger | What runs |
|---|---|
| Daily 06:00 CAT | Generate brief, push to Telegram, write JSON for dashboard |
| Every 30 min | Re-read TODO.md, regenerate JSON (no notification unless overdue change) |
| On `/agenda` slash command | Generate brief on demand |
| On TODO.md edit (filesystem watch — future) | Regenerate JSON immediately |

For v0, the schedule is not yet active — only on-demand CLI invocation. Cron entry will be added as a separate task.

---

## Open questions / future work

- **Dependency awareness.** Some matters depend on others (e.g. The Maester depends on the Standard being written). The Hand v0 doesn't know this. Future: parse `depends-on:` markers in TODO entries.
- **Calendar integration.** The Hand could check the king's calendar and avoid scheduling overdue items on busy days.
- **Effort estimates.** TODO entries don't currently have effort tags. Adding `[S]`, `[M]`, `[L]` tags would let The Hand balance the day.
- **Conversation integration.** When the king mentions something in a Claude Code session, that should bump priority. Requires hooking into recent transcripts (the `/fewer-permission-prompts` skill demonstrates the technique).
