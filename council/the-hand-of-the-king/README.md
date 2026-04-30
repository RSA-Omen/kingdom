# The Hand of the King

The king's direct assistant. Reads `~/Kingdom/TODO.md`, prioritises matters before the king, surfaces what's overdue, drafts the day's agenda.

For the full spec, see `~/Kingdom/docs/council/the-hand-of-the-king.md`.

## Usage

```bash
cd ~/Kingdom

# Read what The Hand has to say (markdown brief)
python -m council.the-hand-of-the-king brief

# Just today's three (JSON)
python -m council.the-hand-of-the-king today

# Full agenda (JSON, for the dashboard / MCP)
python -m council.the-hand-of-the-king agenda

# Mark a matter complete (id from `agenda` output)
python -m council.the-hand-of-the-king done <id>

# Defer a matter N days
python -m council.the-hand-of-the-king defer <id> 7
```

The dashed name `the-hand-of-the-king` is awkward as a Python module path. A wrapper at the kingdom root is provided — see `~/Kingdom/bin/hand`:

```bash
~/Kingdom/bin/hand brief
~/Kingdom/bin/hand today
```

## State

State persists at `~/Kingdom/.hand-state.json` (deferral counts, completion log).

## What v0 does and doesn't

**v0 does:**
- Read TODO.md, parse priority tags (`[P1]`, `[P2]`, `[P3]`, `[IDEA]`)
- Score matters by priority + section + deferral history
- Pick today's three (top weighted, max 2 per section for variety)
- Compose a markdown brief and a JSON agenda
- Mark items done (writes back to TODO.md with strikethrough)
- Defer items by N days

**v0 does not (yet):**
- Push to Telegram (next iteration)
- Serve from an HTTP endpoint or write to a file the dashboard polls (next iteration)
- Run on a schedule (next iteration — cron entry)
- Read GitHub Issues (deferred until GitHub Manager exists)
- Understand task dependencies (`depends-on:` tags) (future)
