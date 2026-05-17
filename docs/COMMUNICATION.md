# Kingdom Communication Standard

**Version:** 1.0
**Effective:** 2026-05-17
**Owners:** the king (chooses), Claude sessions (uphold), the Royal Court (compose)

This document defines how the Kingdom talks to the king. Where the **Gekko Standard** is the contract between villages and the Capital, this is the contract between the Kingdom and its operator.

Four channels, four jobs. Picking the wrong one is the most common communication failure — verbose chat, alert-fatigue Telegram, dispatches that should have been a one-line reply. This document is the disambiguator.

---

## The four channels

| Channel | Direction | Cadence | Job | Where it lives |
|---|---|---|---|---|
| **Chat** | Two-way | Live | Quick answers, working together, decisions in flight | The current session |
| **Dispatch** | One-way (king pulls) | On-demand | Substantial proposal, audit, comparison — anything worth re-reading | `gvdi-30:8095/Kingdom/` |
| **Telegram** | One-way (push) | Event-driven | "King, you need to act" | The king's Telegram |
| **Telegraph** | One-way (push) | Daily, ~06:00 CAT | The morning paper | Telegram + (future) web edition |

---

## When to use which

### Chat
**Use when:** the king is actively in the session and the matter resolves in a few exchanges.
**Don't use when:** the answer is more than ~30 lines, the king will want to re-read it, or it deserves to outlive the session transcript.

### Dispatch
**Use when:** the output is something the king would want to **re-read, forward, or refer back to** — proposals, audits, side-by-side comparisons, post-mortems, plan reviews.
**Don't use when:** it can be said in chat; it's an action item (use Telegram); it's part of the daily rhythm (Telegraph picks it up).

**Trigger phrases that strongly suggest a dispatch:**
- "Write up a proposal for…"
- "Compare X and Y in detail…"
- "Audit how we do…"
- "What's the plan for…"

### Telegram
**Use when:** the king must do something or decide something and is not currently in a session. **Action-only.** Digests and FYIs do not belong here.
**Don't use when:** the message is informational, the action is non-urgent, or the same notification has fired in the last hour.

(See memory note: *Telegram Action-Only — Royal Court agents ping Telegram only when king must act; digests stay on dashboard.*)

### Telegraph
**Use when:** the content is part of the **morning paper**. The Herald composes it from Royal Court findings. Sessions don't write directly to Telegraph — they produce dispatches and Royal Court reports, and the Herald may surface them.

---

## Decision flowchart

```
Is the king actively in this session?
├── YES → Is the reply more than ~30 lines or worth re-reading?
│         ├── NO  → Chat
│         └── YES → Dispatch (still ping in chat with the link)
└── NO  → Does the king need to ACT on this?
          ├── YES → Telegram
          └── NO  → Dispatch, queued for Telegraph in the morning
```

---

## Dispatch contract

Every dispatch is governed by these rules:

### 1. Two audiences, always, in order
Every dispatch leads with **"In plain English"** before **"Technical detail"**. The plain section explains what's happening, why it matters, and what the king should decide — without jargon. The technical section is for verification, hand-off, or implementation.

This mirrors the same rule for PRs (see the `pr_two_audiences` memory note).

### 2. Self-contained HTML
Each dispatch is a single HTML file with inline CSS. No shared stylesheets, no external scripts, no CDN links. This guarantees:

- The king can save one file and read it offline.
- The king can forward one file to a colleague.
- A dispatch written in 2026 still renders in 2028, even if the design system has moved on.

Cost: ~6 KB of duplicated CSS per file. Worth it.

### 3. Void Teal house style
Uses the same design tokens as the dashboard (`capital/dashboard/app/globals.css`): `#050510` page, `#81e6d9` accent, isometric triangle hex grid background, Inter + JetBrains Mono. Dispatches must look like part of the Kingdom, not like random web pages.

The canonical template is `capital/dispatches/templates/dispatch.html.tpl`. Use it; don't reinvent the chrome.

### 4. Source of truth in git
Dispatches live in `capital/dispatches/published/` (committed) and are synced to `~/reports/Kingdom/` (served) by `infrastructure/publish.sh`. The serving directory is a build artifact; never edit it by hand.

### 5. Filenames are dated and slugged
`YYYY-MM-DD-<short-kebab-slug>.html`. The date is the publication date in the king's local time (Africa/Johannesburg).

### 6. Each dispatch updates the index
`published/index.html` lists dispatches reverse-chronologically. A new dispatch prepends a row; it doesn't auto-generate. Manual index updates keep us honest about which dispatches matter (we'd remove decommissioned ones rather than letting them accumulate).

---

## Telegram contract (recap)

Already established, restated here for completeness:

- **Action-only.** Every Telegram message must contain a clear action the king can take. If there is no action, it goes on the dashboard or in Telegraph.
- **Attributed.** The agent name is in the message (e.g. *"— The Steward"*).
- **De-duplicated.** Don't fire the same alert more than once per cooldown window.
- **Quiet hours respected.** Non-emergency alerts hold until 06:00 CAT.

Source: memory note `telegram_action_only`.

---

## Telegraph contract (summary)

Composed daily by **The Herald** from Royal Court findings.

- **Daily Edition** — for the king. Front page, today's work, the long read, classifieds.
- **Brief Edition** — for Barry. Technical light.
- **Weekly Edition** — for subjects. Friendly, inclusive.

Delivery currently via Telegram around 06:00 CAT. Web edition and email still pending (see `TODO.md`).

Sessions don't write Telegraph directly. They write dispatches and Royal Court reports; the Herald composes.

---

## What this standard is NOT

- It's not a publishing pipeline. There's no CMS, no scheduled builds, no RSS. Dispatches are hand-authored HTML; the publish script is rsync.
- It's not a public surface. Reports server is intranet-only.
- It's not a replacement for code documentation. Living docs go in `docs/`; dispatches are point-in-time communications.
- It's not exhaustive. New patterns earn a place in this document only after the second use.

---

## Living references

- Channel infrastructure: `capital/dispatches/README.md`
- Dispatch template: `capital/dispatches/templates/dispatch.html.tpl`
- Live dispatch index: `http://gvdi-30:8095/Kingdom/`
- Design tokens: `capital/dashboard/app/globals.css` (Void Teal source of truth)
- Royal Court roster: `docs/ROYAL_COURT.md`
- Operator duties: `docs/OPERATOR_DUTIES.md`
