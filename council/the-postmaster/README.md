# The Postmaster

Reads the king's Gekko M365 inbox and Teams DMs; drafts village-tagged to-dos; files FYI mail; sweeps clutter to archive on king-approved rules. Never sends, replies, or contacts subjects.

See `docs/council/the-postmaster.md` for the full spec.

> **Not to be confused with The Lord Chamberlain** (`council/the-lord-chamberlain/`), which has a different beat: subject relations — watching app users for friction and abandonment.

## Status

**v0 — stubs only.** No Graph auth, no SQLite, no classification. `run()` and `cleanup()` are no-ops that print a "not yet implemented" notice. The dashboard page at `/postmaster` shows fixture data.

See the spec's "Implementation layers" section for the v1 work plan.

## Commands

```bash
python3 -m council.the-postmaster run        # Triage stub
python3 -m council.the-postmaster cleanup    # Cleanup sweep stub
python3 -m council.the-postmaster status     # DB / state status stub
```
