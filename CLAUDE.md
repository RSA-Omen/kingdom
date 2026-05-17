# CLAUDE.md — Kingdom

This file gives Claude Code guidance for working on the Kingdom — Gekko's internal developer platform.

For the standards every village must meet, see `docs/GEKKO_STANDARD.md` (to be written).
For the canonical agent roster, see `docs/ROYAL_COURT.md` (to be written).
For how the Kingdom talks to the king (chat / dispatch / Telegram / Telegraph), see `docs/COMMUNICATION.md`.
For deferred work, see `TODO.md`.

---

## What this project is

The **Kingdom** is Gekko's umbrella platform. It absorbs and replaces what were previously separate efforts (Admin Center, The Bureau, the Newsroom design). One project, one mental model, one place where the agents live and the dashboard is served.

The Kingdom does three things:

1. **Receives events** from every village — health, usage, errors, feedback — into the Capital's backend
2. **Hosts the Royal Court** — agents that watch the kingdom and produce findings
3. **Publishes Telegraph** — a daily paper, written by The Herald from the council's reports, delivered each morning

---

## The mental model

```
                        THE KINGDOM (Gekko)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   THE CAPITAL          THE VILLAGES          THE BRIDGES
   (this project)       (apps)                (external systems)
        │                     │                     │
   ┌────┴─────┐            Gekko Tracks      Power Automate
   The Castle             PDF Removal        Copilot Studio
   ├ api/                 Interceptor       (Microsoft 365)
   ├ dashboard/           Timesheet Bot
   ├ mcp/                 n8n
   └ herald/              Open WebUI
        │                  Bender ──── Pronto Xi
   The Royal Court
   (council/)
```

- **Kingdom** = Gekko (the company, the realm)
- **Capital** = this project — the seat of operation
- **Castle** = `capital/` (api, dashboard, MCP, Telegraph)
- **Villages** = each app (lives elsewhere on the server; the Kingdom only watches)
- **Bridges** = integrations to systems we don't control
- **Royal Court** = the agents — created one by one as they're needed

**Note on Pronto Xi:** Pronto is reached *through Bender* — a village that drives Pronto's UI by keystroke. There is no `bridges/pronto/` folder. The Interceptor is a separate, narrow Pronto path (NextCloud routing for implied-link URLs) that predates Bender and is not replaced by it. See `docs/PRONTO_ACCESS.md` for the canonical policy.

---

## Directory layout

```
Kingdom/
├── README.md             ← human-facing project intro
├── CLAUDE.md             ← this file (how to work on the Kingdom)
├── TODO.md               ← deferred work and ideas, until GitHub Issues
├── docs/
│   ├── GEKKO_STANDARD.md     ← *(forthcoming)* the contract every village must meet
│   ├── DESIGN_SYSTEM.md      ← visual and interaction language
│   ├── ROYAL_COURT.md        ← *(forthcoming)* canonical agent roster
│   ├── PRONTO_ACCESS.md      ← how the Kingdom talks to Pronto Xi (Bender vs. Interceptor)
│   └── admin-center-audit.md ← inventory of what already exists in admin-center
├── capital/
│   ├── api/                  ← *(forthcoming)* migrated from ~/admin-center/backend/
│   ├── dashboard/            ← Next.js 16 + Tailwind 4 + shadcn (scaffolded)
│   ├── mcp/                  ← *(forthcoming)* MCP servers, migrated from admin-center/mcp-server
│   └── herald/               ← *(forthcoming)* Telegraph composition + delivery
├── council/                  ← agent subfolders, created only when an agent is built
└── bridges/                  ← *(forthcoming)* external system integrations
```

**Empty folders are not pre-created.** Council members get a subfolder when they're being built, not before. Bridges get a subfolder when the integration is real.

---

## Build principles

These rules govern *how the Kingdom is built*. They are different from the Gekko Standard, which governs how villages are built.

### 1. Human-in-the-loop, always

Agents observe, analyse, and recommend. They never act on production systems without operator (the king's) consent. The Kingdom is a tool that makes the king more capable — never a tool that replaces the king's judgement.

Agents may: read filesystems, logs, databases; call external APIs read-only; generate suggestions, drafts, GitHub issues; send Telegram messages clearly attributed to themselves.

Agents may not: modify production code without an opened PR; delete files outside their own scratch space; send messages to subjects (users) without operator approval; execute trades, money movements, or irreversible external actions.

### 2. One agent per beat

Each member of the Royal Court has a single, narrow beat. No "do everything" agents. The system gets its power from many small, specialised colleagues — not from one generalist. If an agent's responsibilities grow beyond one sentence, split it.

### 3. Events flow inward, agents observe outward

- **Inward:** villages push events to `capital/api/` (health, usage, errors, feedback). Push-based.
- **Outward:** agents pull from anywhere (filesystem, GitHub, external APIs). Pull-based.

Don't mix these.

### 4. The MCP layer is the agent's tongue

Every agent capability that could be useful to other tools (Claude Code Desktop, Claude Cowork, custom workflows) is exposed as an MCP tool in `capital/mcp/`. The dashboard is one consumer of the MCP layer; Claude Code is another; the operator's Telegram bot is a third.

### 5. SQLite first, Postgres later

Start every persistence layer with SQLite. Move to Postgres only when concurrent writes or scale demands it. The platform should be runnable on a laptop for development.

### 6. Don't migrate by rewriting

Admin Center already implements ~70% of the Kingdom (see `docs/admin-center-audit.md`). When code already exists, **wrap, refactor, or move — but preserve the working code.** Rewrites lose institutional knowledge.

### 7. Standards are documented before they are enforced

Before writing code that depends on a Gekko Standard rule, the rule must exist in `docs/GEKKO_STANDARD.md`. The standard document is the single source of truth for what every village owes the Kingdom.

### 8. Claude is the AI of the realm

All AI-assisted work in the Kingdom uses Claude. Admin Center currently uses Groq for log triage; that is being migrated to Claude (see TODO). Consistency matters more than per-call cost.

### 9. The Maester is the institutional memory

Anything the king should be able to ask — "what's in this folder?", "what does this app do?", "when was this last touched?" — must be answerable by The Maester. Never let knowledge live only in the king's head or in a Claude conversation.

### 10. The Castle is austere; the Kingdom is a metaphor

The kingdom analogy is **conceptual scaffolding**, not visual decoration. Use it in language, role names, and information architecture. Do not use parchment textures, faux-medieval typography, or ornate borders. Visual style is clean modern SaaS. See `docs/DESIGN_SYSTEM.md`.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend (Capital API) | Express + TypeScript + better-sqlite3 *(inherited from admin-center)* |
| Database | SQLite (current) → Postgres (future) |
| Agents | Python or TypeScript per agent's needs; scheduled via systemd timers or APScheduler |
| Agent LLM | **Claude** (Sonnet for routine, Opus for triage and synthesis) |
| Dashboard | Next.js 16, React 19, Tailwind 4, shadcn/ui |
| MCP servers | Stdio MCP (TypeScript) — already established in admin-center |
| Auth | Azure AD via MSAL (operator); platform API key for service-to-service |
| Notifications | Telegram bot |
| Logging | Structured JSON to stdout |

---

## How to add a new member of the Royal Court

1. Create `council/<role-slug>/` (e.g. `council/the-maester/`)
2. Add a `README.md` stating the agent's beat in one sentence
3. Add a spec doc at `docs/council/<role-slug>.md` (what it watches, what it produces, what it cannot do)
4. Implement as a module with a `run()` function and a schedule
5. Register useful capabilities as MCP tools in `capital/mcp/`
6. The Herald picks up findings automatically (no Herald changes needed)

---

## How to onboard a new village

This is the operator-facing flow, codified in `docs/GEKKO_STANDARD.md`. The short version:

1. Village implements `/health` per the Standard
2. Village emits usage events to the Capital API on meaningful actions
3. Village emits errors to the Capital API
4. Village registers its docs (or doc URL) for the Kingdom's library
5. Village's repo is added to the GitHub Manager's watch list
6. **The Master of Laws** verifies compliance before the village is declared a recognised village of the realm

---

## Registering a village for monitoring

When a new app needs to appear in the Throne Room "Systems" hexagon, the `/villages` page, the Master of Works card, and the action-only Telegram alerts on failure — **there is exactly one place to edit:**

`council/the-steward/steward.py` → the `VILLAGES` dict.

```python
VILLAGES = {
    ...
    "Your App Name": "http://localhost:PORT/health",
}
```

Save the file. On the next 5-minute Steward `check` cycle (or by running `python3 -m council.the-steward check` from `~/Kingdom`), every downstream surface updates automatically:

- Steward polls `/health` and records snapshots
- `~/.steward-health.json` regenerates — this is the **canonical village state**
- `/villages` page on the Kingdom dashboard picks it up (60s revalidate)
- "Systems" hexagon picks it up (next page load; the Bureau briefing route overlays health from the sidecar)
- Master of Works card picks it up (next briefing call; it reads the sidecar)
- Telegram fires on the action-only threshold (3 consecutive failures)

**Do not also edit:** the admin-center `apps` table, `bureau-systems.json`, or Master of Works's old `services` dict. Those are legacy or hold different data; they no longer drive the hexagon.

### Health-endpoint conventions

The Steward records a village as **healthy** when:
- The endpoint returns 200 with JSON containing `{"status": "healthy"}` (or `"ok"`, `"up"`)
- Or returns 200 with non-JSON body (e.g. an nginx index page) — JSON-parse failure falls back to healthy

**unhealthy** on any 4xx/5xx, **unreachable** on connection failure or timeout.

Prefer a real `/health` route returning JSON. Falling back to `/` on a static site is acceptable but worth a TODO to add a proper endpoint.

### Adding new fields (future)

Per-village metadata (priority, criticality, response runbook) belongs alongside the URL in `VILLAGES`. When that feature lands, the dict structure will widen from `name → url` to `name → {url, priority, runbook}`. Same single-edit guarantee.

---

## Working with this codebase as Claude Code

- **Don't refactor speculatively.** Build the next stone, not the next ten.
- **Don't add abstractions until the second use case exists.** Two villages with the same need is a real pattern; one is a guess.
- **When in doubt, ask the king.** Especially about agent boundaries.
- **Update `TODO.md` whenever you defer something.** Don't leave deferred work in chat history.
- **Update `docs/GEKKO_STANDARD.md` whenever a new village contract is decided.**
- **The kingdom analogy is load-bearing.** Use it in code names, file structure, and conversation. It makes the system understandable to humans and gives every component a clear role.

### Communicating with the king

**This applies realm-wide — to Claude sessions working inside any village's repo, not just the Kingdom repo.** Dispatches are part of the Gekko Standard (Section 15). Every village's `CLAUDE.md` should either mirror this section or reference it.

The realm has four communication channels. Pick the right one:

| Channel | Job | Cadence | Who writes it |
|---|---|---|---|
| **Chat** | Quick answers, live work | Live | Any session |
| **Dispatch** | Substantial proposal, audit, comparison — anything worth re-reading | On-demand | Any session, in any village |
| **Telegram** | "King, you need to act" | Event-driven | Royal Court agents only |
| **Telegraph** | Morning paper | Daily ~06:00 CAT | The Herald only |

**Heuristic:** if you're about to write more than ~30 lines of chat reply, or the king will want to re-read it tomorrow, write a **dispatch** instead.

#### How to write a dispatch (works from any village)

1. **Copy the template** — `cp ~/Kingdom/capital/dispatches/templates/dispatch.html.tpl ~/Kingdom/capital/dispatches/published/YYYY-MM-DD-<slug>.html`
2. **Fill the placeholders** — `{{TITLE}}`, `{{DATE_HUMAN}}`, `{{DATE_ISO}}`, `{{DISPATCH_KIND}}` (e.g. *Proposal*, *Audit*, *Comparison*), `{{LEDE}}`, `{{PLAIN_BODY}}`, `{{TECHNICAL_BODY}}`, footer metadata
3. **Two audiences, in order** — `audience-plain` block first ("In plain English"), `audience-technical` block second ("Technical detail"). This is the contract — never invert it, never drop the plain block
4. **Update the index** — prepend a row to `~/Kingdom/capital/dispatches/published/index.html` (newest first)
5. **Publish** — `bash ~/Kingdom/capital/dispatches/infrastructure/publish.sh` (rsyncs to `~/reports/Kingdom/`, viewable at `http://gvdi-30:8095/Kingdom/`)
6. **Commit** — to the Kingdom repo, with a conventional-commits message; in village PRs, link the dispatch URL in the PR body

If the village session can't reach the Kingdom path (sandbox, container without bind), hand the draft (with both audience blocks already written) back to a Kingdom session and ask it to publish. Don't lose the work to a chat reply.

#### Things the dispatch must be

- **Self-contained.** Single HTML file, inline CSS, no external scripts. Forwardable, saveable, archive-stable.
- **Void Teal.** Use the template's tokens unchanged — same palette as the dashboard.
- **Two audiences, plain first.** Mirrors the rule for PRs (see `feedback_pr_two_audiences` memory note).

Full standard: `docs/COMMUNICATION.md` · Authoring guide: `capital/dispatches/README.md` · Village-CLAUDE.md snippet to copy-paste into your village: `docs/templates/village-claude-snippet.md`.

---

## Current state

**Foundation phase.** The Kingdom has just been founded. The Castle has its dashboard scaffold and design tokens. The Admin Center backend serves the Capital's API role from outside the Kingdom directory until it's migrated.

The first three things to build are:

1. **`docs/GEKKO_STANDARD.md`** — the contract every village must meet
2. **The Maester** (first member of the Royal Court) — institutional memory for the kingdom
3. **The Bureau bridge** — wire the dashboard's Front Page to the existing `/api/bureau/*` endpoints so the kingdom has something visible immediately

Plus the migration: **Groq → Claude** for all AI-assisted work in admin-center.
