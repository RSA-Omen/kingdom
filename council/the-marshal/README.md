# The Marshal

**Beat:** routes operator-approved issues to an area and a responsible role, identifies dependencies, and posts a dispatch note.

The Marshal is the kingdom's traffic conductor. The Scout investigates one issue at a time; the Marshal sees the wave, decides who handles what, and in what order.

## What it does, per issue

For each issue with `approved` and not yet `dispatched`:

1. Reads the issue body + the Scout's most recent investigation comment
2. Cross-references the rest of the approved-but-not-dispatched queue to spot dependencies and ordering
3. Determines:
   - **Area** (`area:council`, `area:capital`, `area:admin-center`, `area:infrastructure`)
   - **Assigned role** (`assigned:steward`, `assigned:herald`, `assigned:hand`, `assigned:bureau`, `assigned:operator`, `assigned:smith`)
   - **Urgency** (high / medium / low — informed by Scout confidence + impact)
   - **Dependencies** (does this issue need another fixed first?)
4. Posts a Marshal's Routing comment with rationale
5. Applies `area:*`, `assigned:*`, and `dispatched` labels
6. Exits

## What it does not do

- Modify code (read-only — same constraint as Scout)
- Apply `ready-to-fix` (that's the operator's gate, not the Marshal's)
- Open PRs (that's the Smith)
- Close issues
- Override the Scout's verdict

The Marshal routes. The operator authorises fixes. The Smith forges them.

## How it runs

Same Ralph pattern as The Scout. Each invocation handles one issue.

```bash
./run.sh
```

To stop cleanly: `touch STOP`.

## Re-routing

Remove the `dispatched` label (and any `area:*` / `assigned:*` labels) — the next pass picks it up again.
