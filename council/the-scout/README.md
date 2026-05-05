# The Scout

**Beat:** investigates open `bug`-tagged GitHub issues on `RSA-Omen/kingdom` and posts structured findings as comments.

The Scout rides out, observes, returns with intelligence. The Scout never fights battles — diagnoses only, never fixes.

## What it does, per issue

1. Reads the issue body
2. Reproduces the symptom where possible (read-only commands, real evidence)
3. Reads the cited code (file:line)
4. Traces root cause to a specific decision or defect
5. Recommends the smallest change that would fix it
6. Posts a structured comment in a fixed schema
7. Adds the `scout-reviewed` label

## What it does not do

- Modify any source file (no Edit/Write)
- Apply fixes
- Close issues
- Restart services or mutate any production state
- Push commits

The Scout reports. The operator (or a future Fixer agent) acts.

## How it runs

Ralph-style loop: one issue per process invocation, fresh context every time, state lives in GitHub labels.

**Once (calibration / single issue):**
```bash
claude -p "$(cat PROMPT.md)" --dangerously-skip-permissions
```

**Loop until queue is empty:**
```bash
./run.sh
```

**To stop the loop cleanly:** `touch STOP` (loop checks between iterations).

## Re-investigating an issue

Remove the `scout-reviewed` label in GitHub. The next loop pass will pick it up.

## Status

v0 — manual invocation. Not yet on a schedule. Promotion to systemd timer + Telegraph integration follows once the prompt is dialed in.
