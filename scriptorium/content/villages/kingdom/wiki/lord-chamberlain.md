# Lord Chamberlain

The Lord Chamberlain is the Kingdom's intake officer — the first point of contact for all inbound work requests to the Digital team. Its beat is narrow: convert intentional inputs into triaged, routed, enriched Asana tasks.

See the [[kingdom/lord-chamberlain-system]] demo for the full system diagram.

## The problem it solves

The Digital team receives requests from multiple surfaces — emails, Teams messages, verbal conversations, SharePoint forms. These arrive in unstructured form, get lost in personal inboxes, or accumulate as mental queue items with no audit trail. There is no consistent triage: no classification, no priority signal, no routing to the right place.

The Lord Chamberlain fixes this by being the single intake officer. Every request goes through one pipeline, gets one classification, and lands in one place.

## Input sources

**Input A — SharePoint form (primary)**

Barry configures a Power Automate flow (same pattern as the existing IT Support form). The PA flow owns requestor confirmation — auto-reply is PA's responsibility, not Lord Chamberlain's. Bender's existing PA flow checker monitors whether the intake flow is healthy.

**Input B — Paste-to-ticket (operator-initiated)**

When a relevant message arrives in the operator's personal inbox or Teams DM, the operator copies and pastes the raw text into the Kingdom dashboard (`/tickets/new`) or sends a Telegram `/ticket` command. Both POST to `Capital API → /api/tickets/ingest`, which creates the Asana task.

**What is not an input source:** personal Outlook inboxes, Teams DMs, any automated email watching. No private content enters the system. The operator chooses what becomes a ticket.

## Triage pipeline

Lord Chamberlain polls **Asana My Tasks → Recently Assigned** every 5 minutes. For each unprocessed task:

1. PAT health check — if Asana token is invalid, alert via Telegram and skip cycle
2. Read task title + notes
3. Send to Claude for classification + priority + confidence
4. Search GitHub: open issues, recently resolved, historical — find related before creating
5. Apply routing rules
6. Update Asana task (fields + section move + `lc-triaged` tag)
7. Add structured triage comment
8. Create GitHub issue if code-related and no strong duplicate found
9. Send Telegram notification to operator
10. Record in Capital DB processed table

## Classification taxonomy

| Classification | What it means | Routes to |
|---|---|---|
| `bug` | Something broken | Product section + GitHub search + issue |
| `feature` | New capability | Product section + GitHub search + issue |
| `support` | How-to question | Digital → Customer Support |
| `internal-tool` | Automation / internal system | Digital → Internal System Automations |
| `it-request` | Hardware, licences, access | IT Support Request → New Requests |
| `rd-idea` | Product concept, brainstorm | Digital → relevant brainstorm section |
| `unclear` | Not enough info | Stays in Recently Assigned + clarification comment |

## GitHub: search first, create second

For `bug` and `feature`, Lord Chamberlain always searches GitHub before creating an issue:

- **Open issues** — keyword match on task title + key nouns
- **Recently resolved** (last 90 days) — flags potential regressions
- **Historical** — looser match for broader context

If a strong match exists (open issue), no new issue is created — the existing one is linked. If a resolved match exists, a new issue is created with a regression flag. All matches are listed as context in the triage comment.

## Re-triage trigger

The operator can correct any triage decision by commenting `/retriage` on the Asana task.

Lord Chamberlain watches for this comment on all `lc-triaged` tasks every cycle. When found, it removes the task from the processed table, strips the `lc-triaged` tag, and re-classifies on the next cycle with the same pipeline — including any new notes the requestor may have added.

This also handles the `unclear` resolution case: when a requestor adds more information, the operator triggers re-triage and Lord Chamberlain re-classifies with full context.

## Processed state — dual truth

A task is considered processed only when **both** of the following are true:

- Its GID is in the Capital DB `lord_chamberlain_processed` table
- It carries the Asana tag `lc-triaged`

If the DB is wiped, the Asana tag prevents re-triage. If the tag is manually removed, the DB catches it.

## PAT health monitor

On every poll cycle, before any Asana API calls, Lord Chamberlain pings `GET /users/me` with the current token. A 401 or 403 response triggers an immediate Telegram alert and skips the cycle. The operator rotates the token in `.env` and restarts the service.

## What it will not do

- Assign tasks to other people (operator decides)
- Set due dates (operator decides)
- Close or complete tasks
- Contact requestors directly — that belongs to Power Automate
- Watch personal inboxes
- Monitor its own PA intake flow — Bender's PA checker does that

## Build phases

**Phase 1 — Core triage loop** · Asana polling, PAT health check, Claude classification, routing, comment + fields + tag, Capital DB tracking, Telegram.

**Phase 2 — GitHub integration** · Search (open + resolved + historical), deduplication, issue creation with related context.

**Phase 3 — Re-triage trigger** · Story polling on `lc-triaged` tasks, `/retriage` detection, DB + tag cleanup.

**Phase 4 — Paste-to-ticket** · `POST /api/tickets/ingest`, dashboard `/tickets/new`, Telegram `/ticket` command.

**Phase 5 — Reporting** · Dashboard inbound-queue card, Herald weekly digest.

## Where the code lives

`Kingdom/council/lord-chamberlain/` — not yet built (PRD finalised 2026-05-28).

| File | Role |
|---|---|
| `chamberlain.py` | Main loop: triage + re-triage + PAT health |
| `asana_client.py` | Asana API wrapper |
| `github_client.py` | Search + create issues |
| `classifier.py` | Claude classification prompt |
| `constants.py` | All Asana GIDs |
| `lord-chamberlain.service` + `.timer` | systemd scheduling |

Poll interval: 5 minutes, matching the Steward.
