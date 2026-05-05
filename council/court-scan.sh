#!/usr/bin/env bash
# The Court Scan — kingdom-wide workflow scan.
#
# Runs the full pipeline once: Scout → Marshal → Smith → Inspector.
# Each agent is a Ralph loop on its own state-label query. Idempotent —
# any agent with no work prints NO_WORK and exits cleanly.
#
# Designed to run on a schedule (cron / systemd timer). One pass per hour
# is the recommended cadence. Each pass advances every issue that's ready
# for its next state transition.
#
# Usage:
#   ./court-scan.sh             # full scan
#   ./court-scan.sh scout       # only Scout
#   ./court-scan.sh marshal     # only Marshal
#   ./court-scan.sh smith       # only Smith
#   ./court-scan.sh inspector   # only Inspector

set -euo pipefail

cd "$(dirname "$0")"

LOG_DIR="logs"
mkdir -p "$LOG_DIR"
SCAN_LOG="$LOG_DIR/court-scan-$(date -u +%Y%m%dT%H%M%SZ).log"

log() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$SCAN_LOG"
}

run_agent() {
  local name="$1"
  local dir="$2"
  log ""
  log "════════════════════════════════════════════════════"
  log "  Running $name"
  log "════════════════════════════════════════════════════"
  if [[ ! -d "$dir" ]]; then
    log "  SKIP — $dir does not exist"
    return 0
  fi
  if [[ ! -x "$dir/run.sh" ]]; then
    log "  SKIP — $dir/run.sh missing or not executable"
    return 0
  fi
  ( cd "$dir" && ./run.sh 2>&1 ) | tee -a "$SCAN_LOG"
}

agents=("scout:the-scout" "marshal:the-marshal" "smith:the-smith" "inspector:the-inspector")

selected="${1:-all}"

log "Court Scan starting (selected: $selected)"
log "Master log: $SCAN_LOG"

for entry in "${agents[@]}"; do
  IFS=':' read -r short_name dir_name <<< "$entry"
  if [[ "$selected" == "all" || "$selected" == "$short_name" ]]; then
    run_agent "${short_name^}" "$dir_name"
  fi
done

log ""
log "════════════════════════════════════════════════════"
log "  Court Scan complete"
log "════════════════════════════════════════════════════"

# Print a one-line state summary for the operator
log ""
log "Queue state:"
for state in approved scout-reviewed dispatched ready-to-fix fix-attempted fix-merged verified; do
  count=$(gh issue list --repo RSA-Omen/kingdom --label "$state" --state all --json number --jq 'length' 2>/dev/null || echo "?")
  log "  $(printf '%-18s' "$state"): $count"
done
