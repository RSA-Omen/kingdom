# TODO — Kingdom

The interim backlog for the Kingdom and the broader cleanup of the realm. This file exists until we move to GitHub Issues (see "Build the GitHub Manager" below).

**Format:** group by section, prefix with priority where useful: `[P1]` urgent, `[P2]` next, `[P3]` someday, `[IDEA]` not committed.

---

## Right now (foundation work)

- [x] [P1] Build **The Hand of the King** — the first agent. Reads `TODO.md` (and later GitHub Issues), prioritises matters before the king, surfaces what's overdue, drafts the day's agenda. Has authority over the rest of the Council in scheduling.
- [x] [P1] Write `docs/GEKKO_STANDARD.md` — the contract every village must meet
- [x] [P1] Build **The Maester** (second member of the Royal Court — institutional memory; reads filesystem, git, Admin Center DB; answers questions about the kingdom)
- [x] [P1] Build the **Bureau bridge** — wire the dashboard's Throne Room to the existing `/api/bureau/*` endpoints so the kingdom has something visible immediately
- [x] [P1] Migrate **Groq → Claude** for all AI-assisted work currently in admin-center (Log Guru error analysis, fix generation, briefing composition)
- [x] [P2] Write `docs/ROYAL_COURT.md` — canonical roster of agents, beats, schedules, escalation paths
- [x] [P2] Create the GitHub repo `kingdom`, `git init` this directory, push first commit
- [ ] [P2] Build a kingdom-themed landing page for `capital/dashboard/app/page.tsx` (replacing the placeholder)

## The Royal Court — agents to build (one at a time, only when needed)

Each gets a `council/<role>/` subfolder when its build begins, not before. Names locked in; build order TBD per priority.

- [x] **The Hand of the King** — the king's direct assistant; reads the realm's ledger of matters; prioritises tasks; ensures nothing important is dropped *(first build — the king's daily companion)*
- [x] **The Maester** — knowledge keeper; reads everything, knows everything; the library and archives *(second build)*
- [x] **The Master of Works** — infrastructure; keeps the castle standing; disk, certs, containers, package updates
- [x] **The Quartermaster** — provisions; watches RAM, CPU, disk, GPU memory; warns before the larder runs dry
- [ ] **The Master of Whisperers** — intelligence from beyond the borders; new AI models, new tools, what the wider world is doing
- [x] **The Steward** — day-to-day operations of villages; how each is performing, who's been quiet, who's busy
- [x] **The Captain of the Guard** — first responder to incidents; sounds the alarm, gathers facts, drafts the reply
- [ ] **The Master of Laws** — enforces the Gekko Standard; audits villages for compliance
- [ ] **The Lord Chamberlain** — relations with subjects (users); wellbeing, friction, complaints, abandoned flows
- [ ] **The Castellan** — keeps the castle clean; identifies abandoned wings, recommends archive or demolish
- [ ] **The Master Builder** — improves the platform itself; what gets ignored, what's missing
- [ ] **The Master of Coin** — finance; tracks costs, infrastructure spend, cost-per-app, Azure/Anthropic bills
- [ ] **The Herald** — publishes Telegraph; composes the morning paper from the Council's reports

## Telegraph — the daily paper

- 🟡 [P2] Telegraph digest engine (built and run by **The Herald**) — pulls findings from agents, ranks them, generates the paper
- [ ] [P2] Three editions: **Daily** (king), **Brief** (Barry — technical light), **Weekly** (subjects — friendly, inclusive)
- [ ] [P2] Section structure: Front Page (urgent/new), Today's Work (todos), The Long Read (system self-reflection), Arts & Tech (AI/IT news), Classifieds (feedback/requests)
- [ ] [P2] Delivery: Telegram (primary), web edition, email
- [ ] [P2] Morning ritual: deliver around 06:00 CAT before the king wakes

## The Gekko Standard — what every village must meet

To be written into `docs/GEKKO_STANDARD.md`. Captured here from design discussions:

- [ ] **Health** — `/health` endpoint returns `healthy` / `degraded` / `unhealthy`; village defines critical vs non-critical dependencies; Capital polls every 10 minutes; uptime tracked over 30 days
- [ ] **Usage** — POST per user action to `/api/track` with `{ app, action, user_oid, timestamp, multiplier, metadata }`; per-action `minutes_saved` configured by king
- [ ] **Auth** — Azure AD (MSAL) for all villages; user identifier = Azure AD `oid`; no village-local user identity tables
- [ ] **Errors** — POST every error to `/api/log-guru/analyze`; include stack-fingerprint for grouping; AI triage runs on schedule (Claude), creates GitHub issues for unique fingerprints
- [ ] **Feedback** — widget in village UI; POSTs to `/api/feedback` *(endpoint to be added)*
- [ ] **Logs** — structured JSON to stdout; collected centrally; matrix view links to per-village log tail
- [ ] **GitHub** — repo registered with kingdom; current deployed tag visible; backups via push to remote
- [ ] **Changelog** — patch-notes style per release; auto-drafted from git commits, edited before publishing
- [ ] **Wiki** — village docs registered in Copilot Studio corpus
- [ ] **Telegram** — per-village notification level (errors only / all events / daily digest)

## Bridges to islands

- [ ] [P2] **Microsoft 365 / Power Automate bridge** — read-only view of Power Automate flows; surface their state in the Kingdom; do not bring flows in-house (company policy)
- [ ] [P2] **Copilot Studio / ProntoBot bridge** — monitor the ProntoBot we built but cannot currently see; status, usage, errors
- [ ] [P2] **Pronto Xi bridge** — already partly exists via pronto-api-deployment; promote to a formal bridge with monitoring

## Migrations into the Kingdom

- [ ] [P2] Migrate `~/admin-center/backend/` → `~/Kingdom/capital/api/` — running service; requires careful migration; do not break Power Automate's POST `/api/track` integration
- [ ] [P2] Migrate `~/admin-center/frontend/` references and styling lessons → `~/Kingdom/capital/dashboard/`; eventually the old frontend is replaced (do not delete until parity is reached)
- [ ] [P2] Migrate `~/admin-center/mcp-server/` → `~/Kingdom/capital/mcp/`
- [ ] [P2] Migrate `~/Operations/The Bureau/` content into the Kingdom — the morning-digest scripts that already exist; absorb into `capital/herald/` and the Telegram delivery layer

## Kingdom cleanup (delegate to The Castellan once it exists)

These are tasks to defer until **The Castellan** can do them on schedule. Don't do them by hand.

- [ ] [P3] Demolish `~/Platform/newsroom/` (now empty after move into Kingdom; old CLAUDE.md and TODO.md remain for reference until verified)
- [ ] [P3] Run safe demolitions at home root: `=0.40.0`, `hello_world.py`, `morning-context.txt`, `gvdi-30-morning-a1418c4b.jsonl.bak`, `gvdi-30-morning-a1418c4b-state.bak/`, `testfolder/`
- [ ] [P3] Archive `~/worker-agent/` → `~/Archive/worker-agent/` (early agent attempt, superseded)
- [ ] [P3] Archive `~/bureau/` → `~/Archive/bureau-aider-workflow/` (Aider dev workflow; not the same as `Operations/The Bureau/`)
- [ ] [P3] Archive `~/Operations/D-2510-004-credit-card-coding/` and `~/Operations/D-2511-002 AP Processing Implied Links/` → `~/Archive/` (project-coded folders from OneDrive era; preserved for documentation; link from current projects when documentation system is built)
- [ ] [P3] Consolidate 6× `windows_ssh_config*.txt` files at home root → one file under `~/Scripts/` or in the Kingdom's `docs/setup/`
- [ ] [P3] Demolish Nov-2025 docker setup scripts at home root (`setup-docker-*.ps1/sh`, `diagnose-docker-context.ps1`, `docker-gvdi30.ps1`, `prepare-certs-for-windows.sh`, `copy-certs-instructions.sh`, `setup-docker-tls.sh`, `reset-portainer.sh`, `analyze_quicklink_error.py`)
- [ ] [P3] Consolidate `convert_to_pptx.py` + `convert_to_pptx_enhanced.py` into one and move to `~/Scripts/`
- [ ] [P3] Move `PRESENTATION_2026.pptx` + `_ENHANCED.pptx` to `~/Archive/` or `~/docs/presentations/`
- [ ] [P3] Demolish `~/codevisualizer-1.0.0-compatible.vsix` (1.1MB orphan extension installer)
- [ ] [P3] Demolish empty `~/interceptor-app/` (root-owned, contains only empty `.env/`)
- [ ] [P3] Move `~/pronto-help-scrape/`, `~/pronto-api-scrape/`, `~/pronto-designs/` → `~/Scrapes/`
- [ ] [P3] Move `~/Gaia/` → `~/Clients/gaia/` (sister-company demo, on hold)
- [ ] [P3] Move `~/Operations/gaia-demo/` → `~/Clients/gaia/demo/`
- [ ] [P3] Move `~/projects/` (kanban-ai-copy, transaction-prediction, unifying-sales-deals) → `~/Lab/`
- [ ] [P3] Move `~/project-templates/` → `~/Lab/`
- [ ] [P2] Investigate `~/Management/server-management/` — contains a near-duplicate of home directory; determine if backup, working clone, or accidental, then decide

## Big deferred items

- [ ] [P2] **Rename `~/Management/` (purpose only)** — case-collision with the now-archived MANAGEMENT/ is gone, so the rename is no longer urgent. If we do rename, must stop `docker_alerts.py` (PID 480300) and update 15+ references first.
- [ ] [P2] **Audit `~/Management/single-brain/` for reusable beams** — burnt-down predecessor of the Newsroom (now Kingdom). Has 6 agents, dashboard, 3 MCP servers. Salvage what fits, document findings, then archive.
- [ ] [P2] **Decide ownership of orphan home-root folders:** `~/backend/` (likely superseded Gekko Tracks Phase 1), `~/data/`, `~/notes/`, `~/config/`
- [ ] [P2] **Resolve `~/Operations/The Bureau/` rename** — has a space in the directory name; should be merged into `Kingdom/capital/herald/` during The Bureau migration

## Build the GitHub Manager (graduates this TODO.md)

- [ ] [P2] **GitHub Manager** as a separate app — works across Kingdom-related repos AND the king's personal product suite
- [ ] [P2] Reads issues across all repos via GitHub API
- [ ] [P2] Daily view: "what to work on today" — sorted by priority × age × frequency
- [ ] [P2] AI explains each issue in plain English; king marks doing/done/deferred
- [ ] [P2] Telegram digest each morning + slash commands for triage
- [ ] [P2] Exposes everything as MCP so other tools can read the king's todo state
- [ ] [P2] **Once this exists, this TODO.md becomes archived; all new TODOs go to GitHub**
- [ ] [IDEA] Cool name candidates: Telegraph (overlaps with Herald — confusing), The Wire, The Dispatch, The Almanac, The Lookout, The Loop, Compass, The Sentinel

## Bigger ideas worth keeping warm

- [ ] [IDEA] **Agentcraft** — orchestration tool for agents; evaluate in `~/Lab/` before adopting; we don't need orchestration yet (Claude Code Desktop is the orchestrator)
- [ ] [IDEA] **Self-improvement reports from agents** — *"The Herald noticed you haven't read the Long Read in 5 days, want me to make it shorter?"* — the system reflects on its own use and proposes changes
- [ ] [IDEA] **Three-edition Telegraph** — Daily for king (full depth), Brief for Barry (technical-light, AI news, no todo list), Weekly for subjects (friendly, inclusive, "here's what we built for you, here's what's coming")
- [ ] [IDEA] **AI-triaged error groups → GitHub issues** — every unique error fingerprint becomes one issue with category, priority, effort, root-cause hypothesis, suggested fix. Goal: under 100 errors/week before adding Telegram alerts on errors.
- [ ] [IDEA] **The "newspaper" reading experience** — sit down with coffee, read what matters, never feel behind. Front page → urgent. Long read → reflection. Back pages → AI/IT news. Classifieds → feedback/requests.
- [ ] [IDEA] **Documentation system** — long-term goal: every village has registered docs in Copilot Studio corpus; archived projects (D-2510-004, D-2511-002) link to current versions; The Maester answers historical questions
- [ ] [IDEA] **Time-saved as the platform's killer metric** — "This month, 4 users saved 67 hours across 6 apps." Per-action `minutes_saved` configured by king. Multipliers supported.
- [ ] [IDEA] **The Bookkeeper / The Diplomat / future agents** — as the kingdom grows, hire new agents for new beats

## House rules / preferences (captured across sessions)

- Solo developer; "I'm going to need friends, so why not make my own?"
- Curious but not deeply technical on infra/Azure — system must be explainable, no opaque magic
- Wants to be in the loop on every change — AI explains, king decides
- Kingdom analogy is **load-bearing** — use it in code names and conversation
- Build the castle, then send agents to demolish the kingdom — don't manually clean what an agent will eventually clean on schedule
- "Make everybody's job lighter, not heavier" is the king's stated mission
- Council subfolders are NOT pre-created — only created when the agent is being built
