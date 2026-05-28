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
- [x] [P2] Build a kingdom-themed landing page for `capital/dashboard/app/page.tsx` (replacing the placeholder)
- [x] [P2] **NetBird audit** — audited all internal service comms; removed NetBird overlay hostnames from Kingdom (`master_of_laws.py` Gekko Tracks health check) and admin-center (docker-compose, Graylog, integration telemetry files); replaced with `gvdi-30.gekkosystems.local` / `localhost`

## The Royal Court — agents to build (one at a time, only when needed)

Each gets a `council/<role>/` subfolder when its build begins, not before. Names locked in; build order TBD per priority.

- [x] **The Hand of the King** — the king's direct assistant; reads the realm's ledger of matters; prioritises tasks; ensures nothing important is dropped *(first build — the king's daily companion)*
- [x] **The Maester** — knowledge keeper; reads everything, knows everything; the library and archives *(second build)*
- [x] **The Master of Works** — infrastructure; keeps the castle standing; disk, certs, containers, package updates
- [x] **The Quartermaster** — provisions; watches RAM, CPU, disk, GPU memory; warns before the larder runs dry
- [x] **The Master of Whisperers** — intelligence from beyond the borders; new AI models, new tools, what the wider world is doing
- [x] **The Steward** — day-to-day operations of villages; how each is performing, who's been quiet, who's busy. Now auto-fixes dependency vulns: detects → opens GitHub Issue in village repo → `npm audit fix` → build verify → PR → merge → Docker redeploy. Upstream blockers tracked separately; auto-resolves the moment the blocking package releases on npm.
- [x] **The Captain of the Guard** — first responder to incidents; sounds the alarm, gathers facts, drafts the reply
- [x] **The Master of Laws** — enforces the Gekko Standard; audits villages for compliance
- [x] **The Lord Chamberlain** — relations with subjects (users); wellbeing, friction, complaints, abandoned flows
  - [x] [P1] **Phase 1** — Core triage loop: Asana poll, PAT health check, Claude classify, route, comment, `lc-triaged` tag, Capital DB, Telegram. PRD at `docs/council/lord-chamberlain.md` *(2026-05-28 — built, tested against live Asana, systemd timer installed but disabled pending Guild Board wiring)*
  - [ ] [P2] **Phase 2** — GitHub integration: search open + resolved + historical before creating; deduplication; regression flagging
  - [ ] [P2] **Phase 3** — Re-triage trigger: `/retriage` comment detection, DB + tag cleanup, re-queue
  - [ ] [P3] **Phase 4** — Paste-to-ticket: `POST /api/tickets/ingest`, dashboard `/tickets/new`, Telegram `/ticket`
  - [ ] [P3] **Phase 5** — Reporting: dashboard inbound-queue card, Herald weekly digest entry
- [x] **The Castellan** — keeps the castle clean; identifies abandoned wings, recommends archive or demolish
- [x] **The Master Builder** — improves the platform itself; what gets ignored, what's missing
- [x] **The Master of Coin** — finance; tracks costs, infrastructure spend, cost-per-app, Azure/Anthropic bills
- [x] **The Herald** — publishes Telegraph; composes the morning paper from the Council's reports

## Telegraph — the daily paper

- [x] [P2] Telegraph digest engine (built and run by **The Herald**) — pulls findings from agents, ranks them, generates the paper
- [x] [P2] Three editions: **Daily** (king), **Brief** (Barry — technical light), **Weekly** (subjects — friendly, inclusive)
- [ ] [P2] Section structure: Front Page (urgent/new), Today's Work (todos), The Long Read (system self-reflection), Arts & Tech (AI/IT news), Classifieds (feedback/requests)
- [x] [P2] Delivery: Telegram (primary) *(web edition and email still pending)*
- [x] [P2] Morning ritual: deliver around 06:00 CAT before the king wakes

## The Guild Board — the king's single pane of glass

The operator's command centre. Pulls from Asana (Lord Chamberlain's triaged tasks), Capital DB (errors as incidents), and GitHub (multi-repo open issues). Three views: Queue · Chain · Evolution. Lives at `/guild-board` on the Kingdom dashboard. Design bundle from claude.ai/design; CI Desk variant. Theme: Void Teal.

- [x] [P1] **Phase A** — Queue Triage visual shell at `/guild-board` *(2026-05-28)* — pixel-faithful to the CI Desk design, mock data shaped to real schemas, sidebar filters + lifecycle bars + toast on every interactive target. Fixed silent React hydration failure from nested `<main>`.
- [x] [P1] **Phase B** — wire real data *(2026-05-28)* — new `/api/guild-board/feed` on the Capital API aggregates live Asana tasks (triaged + untriaged) with Capital DB errors (deduped by fingerprint + occurrence-count badges). Server-component page on dashboard fetches every 30s. Bucketing rules: untriaged Asana → Attention (LC is behind); High-priority or critical/frequent incidents → Attention; rest → Flight. Sidebar villages list now derived from live feed. Lord Chamberlain timer re-enabled and verified end-to-end (12/12 tasks triaged, board reflects within 30s).
- [x] [P1] **Lord Chamberlain Telegram action-only** *(2026-05-28)* — Telegram now fires only on High-priority, bug, or unclear classifications. Routine Medium/Low priority work lives on the Guild Board surface, not in the king's notifications. Aligns with `feedback_telegram_action_only` memory.
- [ ] [P2] **Phase C** — GitHub multi-repo feed, Chain drill-in view, Evolution timeline, working "+ New X" modals
  - [x] Chain drill-in view *(2026-05-28)* — clicking any triage row opens the project lifecycle chain. Asana stories (section changes + comments) → diamond/circle/cloud nodes with expandable subtrees. Capital DB incidents get a 3-node chain. Metadata sidebar: stakeholder, village, started, last comms, stuck-days alert.
- [ ] [P2] Drafting agent — a Royal Court role that picks up `bug`/`feature` items from the board, spawns Claude Code in a worktree, and attaches a draft solution / demo back to the task. Probably belongs to The Smith or Master Builder; decide roster placement before building.

## The Gekko Standard — what every village must meet

To be written into `docs/GEKKO_STANDARD.md`. Captured here from design discussions:

- [x] **Health** — `/health` endpoint returns `healthy` / `degraded` / `unhealthy`; village defines critical vs non-critical dependencies; Capital polls every 10 minutes; uptime tracked over 30 days
- [x] **Usage** — POST per user action to `/api/track` with `{ app, action, user_oid, timestamp, multiplier, metadata }`; per-action `minutes_saved` configured by king
- [x] **Auth** — Azure AD (MSAL) for all villages; user identifier = Azure AD `oid`; no village-local user identity tables
- [x] **Errors** — POST every error to `/api/log-guru/analyze`; include stack-fingerprint for grouping; AI triage runs on schedule (Claude), creates GitHub issues for unique fingerprints
- [x] **Feedback** — widget in village UI; POSTs to `/api/feedback` *(endpoint to be added)*
- [x] **Logs** — structured JSON to stdout; collected centrally; matrix view links to per-village log tail
- [x] **GitHub** — repo registered with kingdom; current deployed tag visible; backups via push to remote
- [x] **Changelog** — patch-notes style per release; auto-drafted from git commits, edited before publishing
- [ ] **Wiki** — village docs registered in Copilot Studio corpus *(no spec written yet)*
- [x] **Telegram** — per-village notification level (errors only / all events / daily digest)
- [x] **Issue Tracking (Standard v1.1)** — villages must register in `github-repos.json`, create standard labels (`agent-raised`, `steward`, `captain`, `master-of-laws`, `master-builder`, `critical`, `high`, `waiting-upstream`), and honour agent-raised issues within SLA (7 days critical, 30 days standard). All 6 current villages registered and labelled (kingdom, admin-center, gekko-tracks, the-bureau, server-management, bender).
- [x] **Bender onboarded as a village** *(2026-05-15)* — Steward monitors `:8092/health`, repo `RSA-Omen/bender` created with standard labels, `kingdom-bender.service` + `kingdom-bender-chrome.service` user units installed and enabled (lazy cutover — systemd takes over on next reboot), and Bender's web UI restyled to Void Teal. Bender is a village; it carries the realm's Pronto Xi traffic. See `docs/PRONTO_ACCESS.md`.
- [x] **The Scriptorium founded — Standard §15** *(2026-05-20)* — village documentation + design-demo site at `http://gvdi-30:8095/`. Every village owes a folder under `scriptorium/content/villages/<slug>/` with `meta.yml`, mandatory wiki posts per type (app · process · service · bridge), and an auto-maintained `changelog.md` (every `village-checkpoint` appends an entry). Python renderer reads the folders and produces the live site. First four villages live: Gekko Tracks (with receipts + mobile UI), Bender, The Interceptor, AP Process. PR #50.

## Bridges to islands

- [ ] [P2] **Microsoft 365 / Power Automate bridge** — read-only view of Power Automate flows; surface their state in the Kingdom; do not bring flows in-house (company policy)
- [ ] [P2] **Copilot Studio / ProntoBot bridge** — monitor the ProntoBot we built but cannot currently see; status, usage, errors
- [x] [P2] **Pronto Xi access — handled by villages, not a bridge.** All new Pronto reads/writes go through **Bender** (keystroke automation village at `gvdi-30:8092`). The implied-link → NextCloud path stays with the **Interceptor** (separate, predates Bender, do not extend). No `bridges/pronto/` folder. Canonical policy: `docs/PRONTO_ACCESS.md`. The old archived `pronto-api-deployment` is superseded by Bender.

## Migrations into the Kingdom

- [x] [P2] **Lift admin-center source into Kingdom** *(2026-05-27)* — `backend/` → `capital/api/`, `mcp-server/` → `capital/mcp/`. Source-of-truth code now lives in Kingdom. `admin-center-frontend` container stopped; `admin-center-backend` container still running on port 5001 (Kingdom dashboard still routes through it). GitHub repo `RSA-Omen/Admin-Center` archived.
- [x] [P1] **Build `kingdom-capital-api` container from `capital/api/`** *(2026-05-27)* — built, port 5001, replaced `admin-center-backend`. Verified `/health`, `/api/errors/summary` (4101 errors), `/api/todos/summary` (12 todos), `/api/checkpoints`, `/api/track` (POST), `/api/health` (7 apps). Cutover took 3 seconds.
- [x] [P1] **Migrate `~/admin-center/data/` → `~/Kingdom/capital/api/data/`** *(2026-05-27)* — 222 MB copied (live DB + backups + dependency-resolutions); original retained at admin-center/data/ as rollback safety net.
- [ ] [P3] **Archive `~/admin-center/` → `~/Archive/admin-center-final/`** — kingdom-capital-api has been running stable for ≥1 week, then move the local repo to Archive. Until then it stays as a rollback path.
- [x] [P1] **Update council agents + dashboard for admin-center decommission** *(2026-05-27)* — Lord Chamberlain, Master of Coin, Master Builder README pointed at new DB path (`Kingdom/capital/api/data/app-registry.db`). Steward + Captain `known_projects` / `COMPONENTS` swapped from admin-center sub-dirs to `capital/api`, `capital/mcp`, `capital/dashboard`. Dashboard security/audit route updated. Scriptorium got a new wiki post at `kingdom/capital-api`.
- [ ] [P2] Migrate `~/admin-center/frontend/` references and styling lessons → `~/Kingdom/capital/dashboard/`; eventually the old frontend is replaced (frontend container already stopped 2026-05-27 — nobody used it; salvage what's useful then drop)
- [ ] [P2] Migrate `~/Operations/The Bureau/` content into the Kingdom — the morning-digest scripts that already exist; absorb into `capital/herald/` and the Telegram delivery layer

## Kingdom cleanup (delegate to The Castellan once it exists)

These tasks now run on Castellan's weekly schedule (Mon 06:30 CAT — scan → execute → Telegram report). Add paths here for the Castellan to pick up on its next run.

- [x] [P3] Archive `~/worker-agent/` sub-dirs → `~/Archive/` *(Castellan executed 2026-05-07)*
- [x] [P3] Archive `~/Operations/pronto-api-deployment`, `~/Operations/tools` → `~/Archive/` *(Castellan executed 2026-05-07)*
- [x] [P3] Archive `~/backend/app` → `~/Archive/` *(Castellan executed 2026-05-07)*
- [x] [P3] Demolish empty dirs `~/bureau/archive`, `~/bureau/files` *(Castellan executed 2026-05-07)*
- [ ] [P3] Demolish `~/Platform/newsroom/` (now empty after move into Kingdom; old CLAUDE.md and TODO.md remain for reference until verified)
- [ ] [P3] Run safe demolitions at home root: `=0.40.0`, `hello_world.py`, `morning-context.txt`, `gvdi-30-morning-a1418c4b.jsonl.bak`, `gvdi-30-morning-a1418c4b-state.bak/`, `testfolder/`
- [ ] [P3] Archive `~/worker-agent/` → `~/Archive/worker-agent/` (early agent attempt, superseded — remaining shell after sub-dirs archived)
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
