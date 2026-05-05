# The Inspector

**Beat:** verifies that a merged fix actually eliminated the symptom — independent of the Scout, the Smith, and any tests.

The Inspector is the kingdom's auditor. The Smith says "I forged this"; the Inspector says "I checked, the symptom is gone." Without the Inspector, a merged PR is a hope, not a guarantee.

## What it does, per issue

For each issue with `fix-merged` and not yet `verified`:

1. Reads the issue, the Scout's investigation, the Smith's PR body, and the Marshal's notes
2. Re-runs the **Scout's original reproduction steps** — same commands, same evidence trail — to confirm the symptom no longer reproduces
3. Runs the **Inspector's checklist** from the Smith's PR body
4. Checks that no `area:*` follow-on is needed (e.g., a stale build artifact, a config that needs reload)
5. Posts an Inspector's Audit comment with verdict
6. If verified: applies `verified` label and **closes the issue**
7. If verification fails: applies `verification-failed` label, **reopens** the issue, removes `verified`, and posts a clear write-up. Does not auto-close in this case.

## What it does not do

- Modify code (read-only — same constraint as Scout)
- Apply fixes
- Re-run the Smith
- Skip verification when "the PR body looks right" — the symptom must be tested directly

The Inspector verifies. Trust without verification is the bug we already had.

## How it runs

Same Ralph pattern. Each invocation handles one issue.

```bash
./run.sh
```

To stop cleanly: `touch STOP`.

## Failure modes

- **Repro environment not available** (e.g., service is being restarted, DB locked): Inspector posts a comment "Cannot verify right now: <reason>. Will retry next pass." Removes nothing. Issue stays at `fix-merged` so the next pass picks it up.
- **Symptom still reproduces:** verification fails. Issue reopens with `verification-failed`. Operator reads the audit comment and decides next steps (re-Scout, re-Smith, or accept).
- **Symptom is gone but adjacent issue surfaced:** Inspector closes the original issue as `verified` and notes the adjacent finding for operator follow-up — but does not open new issues itself.
