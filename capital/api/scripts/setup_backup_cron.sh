#!/bin/bash
# Setup cron job for Admin Center database backups
# This script adds a daily backup at 2 AM

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup_database.py"
CRON_JOB="0 2 * * * cd $SCRIPT_DIR && /usr/bin/python3 $BACKUP_SCRIPT >> /tmp/admin-center-backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "Cron job for Admin Center backup already exists."
    crontab -l | grep "$BACKUP_SCRIPT"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✓ Added daily backup cron job for Admin Center (runs at 2 AM)"
    echo "  Log file: /tmp/admin-center-backup.log"
    echo ""
    echo "Current crontab:"
    crontab -l
fi

