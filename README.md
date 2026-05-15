# Kingdom

Gekko's internal developer platform. The Capital, the Council, and the bridges to all our systems.

The Kingdom is the umbrella project that absorbs what was Admin Center, what was The Bureau, and what would have been the Newsroom. One repo. One mental model. One place where every village reports in and every agent files its briefs.

## The mental model

- **The Kingdom** — Gekko, the whole company
- **The Capital** — this project (the platform itself)
  - **The Castle** — `capital/api/` and `capital/dashboard/` (the backend, frontend, and MCP servers)
  - **The Herald** — `capital/herald/` (Telegraph, the daily paper)
- **The Villages** — every app that meets the Gekko Standard (Gekko Tracks, PDF Removal, Interceptor, Bender, etc.) — they live elsewhere on the server, the Kingdom only watches. **Pronto Xi is reached through Bender** — see `docs/PRONTO_ACCESS.md`.
- **The Bridges** — `bridges/` (integrations to systems we don't control: Power Automate, Copilot Studio, Microsoft 365)
- **The Royal Court** — `council/` (the agents that observe, analyse, and report)

The agents (each a member of the Royal Court) include The Maester, The Master of Works, The Master of Whisperers, The Steward, The Captain of the Guard, The Master of Laws, The Lord Chamberlain, The Castellan, The Quartermaster, The Master Builder, The Master of Coin, and The Herald. They are introduced one at a time as they're needed. See `docs/ROYAL_COURT.md` (forthcoming) for the canonical roster.

## Status

**Foundation phase.** The Kingdom has just been founded. The dashboard scaffold is in `capital/dashboard/`. The Admin Center backend (running at `~/admin-center/`) will eventually move to `capital/api/`. The Royal Court has been named but no agents have been built. See `TODO.md` for the build order.

## Documentation

- `CLAUDE.md` — how Claude Code should work on this project
- `TODO.md` — the working backlog (until we move to GitHub Issues)
- `docs/GEKKO_STANDARD.md` — *(to be written)* the contract every village must meet
- `docs/DESIGN_SYSTEM.md` — visual and interaction language for the dashboard
- `docs/PRONTO_ACCESS.md` — how the Kingdom talks to Pronto Xi (Bender vs. Interceptor)
- `docs/admin-center-audit.md` — inventory of what already exists in the Admin Center backend
- `docs/ROYAL_COURT.md` — *(to be written)* canonical roster of agents, their beats, schedules, and escalation paths

## Running locally

```bash
cd capital/dashboard
npm install
npm run dev
```

The dashboard reads from the Admin Center backend at `http://localhost:5001` (configurable via `NEXT_PUBLIC_API_BASE`). The backend lives at `~/admin-center/` until it moves into `capital/api/`.
