#!/usr/bin/env bash
# publish.sh — sync source dispatches to the live serving directory.
#
# Source:  capital/dispatches/published/   (committed, source of truth)
# Target:  ~/reports/Kingdom/              (served by nginx at :8095/Kingdom/)
#
# Run from anywhere. Idempotent. Safe to re-run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/../published" && pwd)"
TARGET_DIR="${KINGDOM_DISPATCHES_TARGET:-$HOME/reports/Kingdom}"

mkdir -p "$TARGET_DIR"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude='.*' "$SOURCE_DIR/" "$TARGET_DIR/"
else
  cp -a "$SOURCE_DIR/." "$TARGET_DIR/"
fi

echo "Published $(find "$SOURCE_DIR" -maxdepth 1 -name '*.html' | wc -l) HTML file(s) → $TARGET_DIR"
echo "View at: http://$(hostname):8095/Kingdom/"
