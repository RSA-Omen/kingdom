# The Postmaster — Kingdom Council Spec

**Beat:** Reads the king's Gekko M365 inbox and Teams DMs. Drafts village-tagged to-dos for anything that needs action. Files FYI mail to a no-action folder. Sweeps clutter to archive on king-approved rules. Never sends, replies, or contacts subjects.

**Why:** Mail and Teams arrive all day. Without an agent the king's memory is the only thing keeping issues and opportunities from being lost. The Postmaster is the staging surface between *incoming attention* and *village to-do*.

> Renamed from "The Chamberlain" in dispatch rev. 4 (2026-05-20) to avoid collision with the existing **Lord Chamberlain** (subject relations beat).

## The boundary

The Postmaster follows the kingdom's *own-surfaces-vs-external-action* rule:

- **May act freely on the king's own surfaces:** move mail between folders inside the Gekko M365 mailbox; create namespaced folders (`Postmaster/01-Action-needed`, `02-No-action`, `03-Archive`); append to `Kingdom/TODO.md`; write to its own SQLite DB.
- **May never act outward:** no `Mail.Send`, no `Mail.Send.Shared`, no `Chat.ReadWrite`. No reply, no forward, no message body edits, no Teams writes of any kind.
- **No hard-delete in v1.** Cleanup is archive-only. Graph's delete endpoint is not called anywhere in the code — destructive ops are gated by absence, not by permission.

## What The Postmaster does

1. **Scans the inbox and DMs** — every 10 minutes
   - Microsoft Graph delta queries on `/me/messages` and `/me/chats` (filtered to `chatType eq 'oneOnOne'`)
   - Dedupes against `postmaster_drafts.source_id`

2. **Classifies with Claude** — for each new item
   - Village (one of 6, or `personal`, or `NULL` for no-action)
   - Kind (`issue` / `opportunity` / `fyi` / `reply-needed`)
   - Priority (`low` / `med` / `high` / `urgent`)
   - One-sentence summary + rationale

3. **For mail with action:**
   - Drafts a row in `postmaster_drafts` with `status='pending'`
   - Moves the mail to `Postmaster/01-Action-needed`
   - Surfaces on `/postmaster` "Action needed" tab

4. **For FYI / no-action mail:**
   - Drafts a row with `status='filed-fyi'` (no operator decision required)
   - Moves the mail to `Postmaster/02-No-action`
   - Surfaces on `/postmaster` "Filed FYI" tab (auditable)

5. **For Teams DM items:**
   - Drafts the same way as mail
   - Never touches the DM thread itself
   - `mail_folder` is `NULL`

6. **King reviews** at `/postmaster`
   - Approve → promoted to GitHub Issue on the village's repo, or appended under `## Personal` in `Kingdom/TODO.md`
   - Reject → kept for learning; optionally crystallises into a discard rule
   - Edit-then-approve → operator can tweak summary / village / priority before promoting

7. **Cleanup sweep** — every 6 hours
   - Loads approved cleanup rules; no-op if none
   - Moves matching items to `Postmaster/03-Archive`
   - Writes a sweep summary row to `postmaster_sweeps`
   - **No delete API call in v1.**

## Routable villages (v1)

| Village | Slug | Promoted to |
|---|---|---|
| Gekko Tracks | `gekko-tracks` | GitHub Issues on `RSA-Omen/gekko-tracks` |
| Bender | `bender` | GitHub Issues on `RSA-Omen/bender` |
| Interceptor | `interceptor` | GitHub Issues on `RSA-Omen/interceptor` |
| AP Processing | `ap-processing` | GitHub Issues on `RSA-Omen/ap-processing` *(exact repo TBC)* |
| PDF Removal | `pdf-removal` | GitHub Issues on `RSA-Omen/pdf-removal` *(exact repo TBC)* |
| Kingdom | `kingdom` | `Kingdom/TODO.md` (or `RSA-Omen/Kingdom` Issues) |
| (Personal) | `personal` | `Kingdom/TODO.md` under `## Personal` heading |

Adding a new village = one row here + one promote handler in the dashboard. No agent changes.

## Implementation layers (v0 → v1 → v2)

### v0 (this build — stubs only)
- ✅ Spec doc (this file)
- ✅ `council/the-postmaster/` with `README.md`, `__init__.py`, `__main__.py`, `postmaster.py` exposing no-op `run()` and `cleanup()` entrypoints
- ✅ Static `/postmaster` page on the dashboard with three tabs (Action needed · Filed FYI · Cleanup bench) and fixture data
- ❌ No Graph auth
- ❌ No SQLite migration
- ❌ No real classification or filing

### v1
- ❌ Azure AD app + delegated MSAL auth on Gekko M365
- ❌ SQLite migration: `postmaster_drafts`, `postmaster_rules`, `postmaster_cleanup_rules`, `postmaster_sweeps`
- ❌ Outlook ingest (delta query, dedupe)
- ❌ Folder creation + filing
- ❌ Claude classification
- ❌ Teams DM ingest
- ❌ Promote-on-approve (GitHub Issues / TODO.md)
- ❌ Cleanup sweep (bench + dry-run)
- ❌ Cleanup sweep (active, archive-only)
- ❌ MCP capabilities
- ❌ Telegram thresholds

### v2 (future)
- ❌ Hard-delete via destructive-flag rules
- ❌ Reply drafting (likely a separate agent — *The Scribe*)
- ❌ Teams group chats / channels (currently DMs only)
- ❌ Personal Outlook mailbox (currently Gekko M365 only)
- ❌ Cross-thread context (linking a reply to its parent thread for the king)

## State

- **SQLite DB:** `~/.postmaster.db` (separate from `~/.chamberlain.db` which belongs to The Lord Chamberlain)
- **Token cache:** `~/.postmaster-tokens.json` (MSAL serialised; not yet implemented)
- **Sweep log:** `postmaster_sweeps` table in the DB

## Commands (v0 — all stubs)

```bash
python3 -m council.the-postmaster run        # Triage: read + classify + file. (Stub: prints "not yet implemented".)
python3 -m council.the-postmaster cleanup    # Cleanup sweep. (Stub.)
python3 -m council.the-postmaster status     # Print DB stats and last run/sweep. (Stub.)
```

A `bin/postmaster` wrapper can be added when v1 lands, matching the pattern used by `bin/hand` and `bin/maester`.

## Boundaries — quick reference

| | Allowed | Forbidden |
|---|---|---|
| **Outlook** | Read mail. Create `Postmaster/*` folders. Move mail between own folders. | Send. Reply. Forward. Edit bodies. Hard-delete (no API call in v1). |
| **Teams** | Read DMs (`chatType = 'oneOnOne'`). | Anything else — no write, no group chats, no channels, no marking read. |
| **GitHub** | Create Issues on village repos (via the GitHub Manager) — only on operator approval. | Direct PRs. Direct commits. Closing issues. |
| **Kingdom/TODO.md** | Append under `## Personal` — only on operator approval. | Edit other sections. Reorder. Mark complete. |
| **SQLite** | Full read/write on `~/.postmaster.db`. | Touch other agents' DBs. |
| **Telegram** | Send action-only pings on urgent items, growing backlog (`>20 pending`), or unexpectedly broad sweep (`>50 items`). | Routine digests. Per-draft pings. Replies to subjects. |

## Telegram thresholds (action-only)

- Any draft with `priority='urgent'` → ping immediately
- Pending backlog crosses 20 → ping once until backlog drops below 20
- Sweep touches more than 50 items in one cycle → ping with rule id (suggests an unintended pattern match)

Otherwise silent. Per house rule, digests live on the dashboard (pull), not in Telegram (push).
