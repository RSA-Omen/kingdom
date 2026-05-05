#!/usr/bin/env bash
# The Inspector — Ralph-style loop runner.
# Each iteration spawns a fresh `claude -p` to verify ONE fix-merged issue.
# Loop exits on NO_WORK or when ./STOP exists.

set -euo pipefail

cd "$(dirname "$0")"

MAX_ITERS=${MAX_ITERS:-20}
DRY=0
[[ "${1:-}" == "--dry" ]] && DRY=1

LOG_DIR="logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/run-$(date -u +%Y%m%dT%H%M%SZ).log"

printf 'The Inspector — loop starting\n  cwd:        %s\n  log:        %s\n  max iters:  %s\n  stop file:  ./STOP\n\n' "$(pwd)" "$LOG" "$MAX_ITERS" | tee -a "$LOG"

if [[ ! -f PROMPT.md ]]; then
  echo "ERROR: PROMPT.md not found in $(pwd)" >&2
  exit 2
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: claude CLI not on PATH" >&2
  exit 2
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh CLI not authenticated" >&2
  exit 2
fi

i=0
while (( i < MAX_ITERS )); do
  if [[ -f STOP ]]; then
    echo "STOP file present — halting cleanly." | tee -a "$LOG"
    rm STOP
    break
  fi

  i=$((i+1))
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '\n=== iteration %d (%s) ===\n' "$i" "$ts" | tee -a "$LOG"

  if (( DRY )); then
    echo "[DRY RUN] would invoke: claude -p \"\$(cat PROMPT.md)\" --dangerously-skip-permissions" | tee -a "$LOG"
    break
  fi

  out=$(claude -p "$(cat PROMPT.md)" --dangerously-skip-permissions 2>&1) || true
  printf '%s\n' "$out" | tee -a "$LOG"

  last5=$(printf '%s\n' "$out" | tail -5)
  if printf '%s\n' "$last5" | grep -q '^NO_WORK$'; then
    echo "Queue empty — Inspector reported NO_WORK." | tee -a "$LOG"
    break
  fi

  if ! printf '%s\n' "$last5" | grep -qE '^(VERIFIED|FAILED|DEFERRED|BLOCKED) #[0-9]+'; then
    echo "WARNING: iteration $i did not end with VERIFIED/FAILED/DEFERRED/BLOCKED or NO_WORK. Halting." | tee -a "$LOG"
    break
  fi
done

printf '\nThe Inspector — loop ended after %d iteration(s).\n' "$i" | tee -a "$LOG"
