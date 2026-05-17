# Village CLAUDE.md snippet — Kingdom Dispatches

This is a copy-pasteable block for every village's `CLAUDE.md` (or `AGENTS.md` / `README.md` if no CLAUDE.md exists). Required by Gekko Standard §15.2.

The snippet is intentionally short — Claude sessions just need a discoverable pointer; the canonical docs live in the Kingdom repo.

---

## How to use

1. Open your village's `CLAUDE.md` (create one if it doesn't exist).
2. Paste the block between the `<!-- BEGIN -->` and `<!-- END -->` markers below into a new "Communicating with the king" section.
3. Commit. That's it.
4. Update if the standard moves; the Master of Laws audit will check for the literal phrase "Kingdom Dispatches" or a link to `docs/COMMUNICATION.md`.

If your village has no `CLAUDE.md` at all, a three-paragraph stub like this is a sufficient first version:

````markdown
# CLAUDE.md — <village name>

This file gives Claude Code guidance for working on <village name>, a village of the Gekko Kingdom.
For platform-wide standards every village must meet, see the Kingdom's `docs/GEKKO_STANDARD.md`.

<!-- paste the snippet below here -->
````

---

## The snippet (copy from here)

<!-- BEGIN: Kingdom Dispatches snippet — v1, mirrors Gekko Standard §15 -->

## Communicating with the king

This village is part of the Gekko Kingdom. The realm has four communication channels — pick the right one:

| Channel | Job | Cadence | Who writes it |
|---|---|---|---|
| **Chat** | Quick answers, live work | Live | Any session |
| **Dispatch** | Substantial proposal, audit, comparison — anything worth re-reading | On-demand | Any session, in any village |
| **Telegram** | "King, you need to act" | Event-driven | Royal Court agents only |
| **Telegraph** | Morning paper | Daily ~06:00 CAT | The Herald only |

**Heuristic:** if you're about to write more than ~30 lines of chat reply, or the king will want to re-read it tomorrow, write a **Kingdom Dispatch** instead.

### Writing a dispatch from this village

1. Copy `~/Kingdom/capital/dispatches/templates/dispatch.html.tpl` to `~/Kingdom/capital/dispatches/published/YYYY-MM-DD-<slug>.html`
2. Fill the placeholders. Two audiences, in order: **"In plain English"** first, then **"Technical detail"** — never invert, never drop the plain block.
3. Prepend a row to `~/Kingdom/capital/dispatches/published/index.html`.
4. Run `bash ~/Kingdom/capital/dispatches/infrastructure/publish.sh`.
5. Commit to the Kingdom repo. Link the dispatch URL (`http://gvdi-30:8095/Kingdom/...`) in your village PR body.

If this session is sandboxed and can't reach `~/Kingdom/`, produce the draft with both audience blocks already written and hand it to a Kingdom session to publish.

**Full standard:** see `~/Kingdom/docs/COMMUNICATION.md` and Gekko Standard §15.

<!-- END: Kingdom Dispatches snippet -->

---

## Versioning

The snippet is versioned in a comment marker (`v1` above). If the standard changes in a way that breaks the snippet, the marker bumps to `v2` and villages re-paste. The Master of Laws audit will warn villages on outdated versions.

## What you do NOT need to copy

- The full `docs/COMMUNICATION.md` — link to it, don't duplicate.
- The `dispatch.html.tpl` template — call it by path; the Kingdom owns the canonical version.
- Telegram or Telegraph mechanics — villages don't write to those channels directly.
