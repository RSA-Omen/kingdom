# The Smith

**Beat:** opens a pull request implementing the Scout's recommended fix for one operator-authorised GitHub issue per invocation.

The Smith is the kingdom's craftsman. The Scout investigates, the Marshal routes, the operator authorises — then the Smith forges the fix in steel: a focused branch, a minimal diff, a clear PR.

## What it does, per issue

For each issue with `ready-to-fix` and not yet `fix-attempted`:

1. Reads the issue body, the Scout's investigation comment, and the Marshal's routing comment
2. Creates an isolated git worktree at `.claude/worktrees/smith-issue-N/` from `origin/main`
3. Applies **only** the change the Scout recommended — no surrounding refactor, no scope creep
4. Runs whatever tests exist for the area (best effort — doesn't block PR if no tests)
5. Pushes branch `smith/N-<slug>` and opens a PR with body linking back to the issue
6. Posts a Smith's Forge comment on the issue with PR link, diff summary, and verification steps
7. Applies `fix-attempted` label
8. Removes the temporary worktree (PR + branch on GitHub are the durable artifacts)
9. Exits

## What it does not do

- Modify code outside the Scout's recommended change
- Push to `main` directly (always via PR)
- Merge its own PR (operator gate)
- Apply `fix-merged` (the GitHub PR-merge event applies that)
- Apply `verified` (that's the Inspector's call)
- Touch issues without `ready-to-fix`

The Smith forges. The operator merges. The Inspector verifies.

## How it runs

Same Ralph pattern as Scout/Marshal. Each invocation handles one issue.

```bash
./run.sh
```

To stop cleanly: `touch STOP`.

## Failure modes

- **Main checkout has the same change uncommitted:** Smith aborts, posts a comment asking operator to reconcile, exits cleanly. Issue stays at `ready-to-fix` for next pass.
- **Tests fail after fix applied:** Smith opens PR anyway with `[draft] Tests failing — operator review needed` and leaves clear evidence in the comment. Operator decides whether the test failure is the fix's fault or pre-existing.
- **Recommended fix is ambiguous:** Smith aborts and posts a comment requesting Scout re-investigation. Issue label is reset to allow Scout to pick it up again.
- **Cross-repo fix needed:** Smith aborts, posts a comment explaining the issue's `area:*` is in a different repo than where the Smith operates. Operator handles cross-repo manually.

## Re-attempting

Remove the `fix-attempted` label and (if a PR was opened) close it. The next pass picks the issue up again.
