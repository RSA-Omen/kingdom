# /kingdom-enrich — Guild Board Chain Enricher

You are interviewing the king to enrich Guild Board chains with real operational history.
Your job: make each chain as accurate as possible by uncovering communications, incident timelines, blockers, and resolutions — then write them back so they appear as nodes in the chain.

---

## Step 1 — Fetch the queue

Start by fetching the live feed:

```
GET http://localhost:5001/api/guild-board/feed
```

Extract items from `attention` first (Needs Attention), then `flight` (In Flight).
Print a numbered list like:

```
NEEDS ATTENTION (4)
1. [PROJECT] Inbox · Gekko Tracks  —  REVIEW  —  <1d
2. [INCIDENT] gvdi-30 · systemd[1165] Failed to start timesheet-bot.service  —  1d open

IN FLIGHT (16)
3. [PROJECT] Inbox · Reception Flow to Asana group  —  REVIEW
...
```

Ask: **"Which item do you want to enrich first? (enter a number, or 'all' to go through them in order)"**

If the user says 'all', work through the list sequentially. If a number, start there.

---

## Step 2 — Load the chain

For the selected item, fetch its current chain:

```
GET http://localhost:5001/api/guild-board/chain/{id}
```

Display what is already known:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENRICHING: Gekko Tracks [PROJECT · Inbox]
Status: REVIEW   Started: 2025-12-15   Last comms: 2026-05-28
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current chain nodes:
  ◆ Created — 2025-12-15
  ☁ Lord Chamberlain Triage Report — 2026-05-28
  ○ REVIEW (current, stuck)
  ◇ Done (not reached)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 3 — Interview protocol

Ask these questions one at a time. Don't batch them — let the user respond before asking the next.

### All items:

1. **"What's the current situation in plain English? Is this moving, stuck waiting on someone, or essentially resolved?"**

2. **"Since [last_comms date or 'the last update'], have you made any contact with the client/stakeholder/team? (email, call, WhatsApp, in-person)"**
   - If yes → go to the Comms Proof step below
   - If no → note it as "No comms since [date]"

3. **"Is there anything blocking progress right now that isn't captured in the system?"**

4. **"What's the next action and who is responsible?"**

### Projects additionally:

5. **"Has scope changed since this started? Any decisions made that aren't documented?"**

6. **"Is there a delivery date or milestone we're working toward?"**

### Incidents additionally:

5. **"Walk me through the timeline: when did it start, what was tried, what happened?"**

6. **"Is this still occurring, intermittent, or has it stopped? Was root cause found?"**

7. **"Has the affected village/team been notified? Was there user impact?"**

---

## Step 4 — Comms proof

When the user says they made a communication:

Ask: **"Can you paste the message, email thread, call notes, or WhatsApp text here? Paste as much or as little as you have."**

Accept whatever they provide. Extract:
- **Date** of the communication
- **Channel** (email / call / WhatsApp / in-person / Slack / Teams)
- **Who** was contacted (name or role)
- **What was said** (summary of the outgoing message)
- **Their response** (if any, and when)

If they can't provide proof, note it as "King reports call/email on [approximate date] — no written record" and continue.

---

## Step 5 — Format the enrichment note

Compose a structured note from everything gathered. Use this format:

```
📋 Chain enrichment — {today's date}

CURRENT STATUS
{plain English: is this moving / stuck / resolved, who's waiting on whom}

COMMUNICATIONS LOG
{date} · {channel} · {who} — {what was communicated} → {response / no response}
(repeat for each communication)

BLOCKERS
{describe any blockers, or "None reported"}

NEXT ACTION
{who does what by when}

SCOPE / DECISIONS
{any scope changes or decisions made, or omit if nothing new}

— Recorded by the king via /kingdom-enrich
```

Show the drafted note to the user and ask:
**"Does this look right? I'll post this as a chain note once you confirm. (yes / edit / skip)"**

- **yes** → post it (Step 6)
- **edit** → let the user modify the text, then re-confirm
- **skip** → move to next item without posting

---

## Step 6 — Post the note

Post the confirmed note:

```
POST http://localhost:5001/api/guild-board/chain/{id}/note
Content-Type: application/json

{
  "text": "...",
  "author": "king"
}
```

For **Asana task items** (non-incident ids), the backend will post this to Asana automatically as a comment, so it appears in the task's Asana timeline. Confirm to the user: **"✓ Posted to chain + Asana."**

For **incidents** (id starts with `incident:`), it's stored in Capital DB. Confirm: **"✓ Posted to incident chain."**

---

## Step 7 — Next item

After posting, ask: **"Next item? (enter a number from the list, 'continue' for the next in sequence, or 'done' to finish)"**

---

## Session rules

- One item at a time. Don't rush or combine questions.
- If the user says "I don't know" or "nothing to add" — accept it. Note "No updates" and move on.
- Never post a note that contains no new information (e.g. all fields say "unknown" or "N/A").
- After completing all items, print a summary:
  ```
  ━━ Enrichment session complete ━━
  Enriched: 3 items
  Skipped: 2 items
  Notes posted: 3 (2 to Asana, 1 to Capital DB)
  ```
- If the Capital API is unreachable (localhost:5001), say so clearly and stop — don't invent data.
